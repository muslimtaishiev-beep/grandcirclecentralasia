import { Router } from "express";
import admin from "firebase-admin";
import { requireFirebaseAuth } from "./authRoutes.js";
import { requirePerm } from "../server/access.js";
import { requireScreen } from "../server/tenantAccess.js";
import { writeAudit, actorOf } from "../server/audit.js";
import { cashCol, cashEntryDoc } from "../server/cash.js";
import {
  normTime, lessonsOverlap, subscriptionStatus, sanitizeDirectory, sanitizePlan,
  type EduDirectory, type SubAction,
} from "../shared/edu.js";

/**
 * Расписание и абонементы: запись только через сервер.
 * Справочники (кабинеты, группы, виды абонементов) — tenants/{t}/edu_settings/directory,
 * преподаватели — сотрудники организации. Время занятий — местное время
 * организации строкой «ГГГГ-ММ-ДДTчч:мм» без пояса: что ввели, то и видно.
 */
const router = Router();
const db = () => admin.firestore();
const col = (t: string, name: string) => db().collection("tenants").doc(t).collection(name);
const str = (v: unknown, max = 120) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };

const schedGuard = (screen: "schedule" | "subscriptions") => [requireFirebaseAuth, requireScreen(screen, (req: any) => req.params.tenantId), requirePerm(db, "edu:schedule")];
const audit = (req: any, action: string, detail: string, target?: { kind: string; id: string; name?: string }, changes?: any[]) =>
  writeAudit(db(), req.params.tenantId, { actor: actorOf(req.user), action, section: "data", detail, target, changes });

async function loadDirectory(t: string): Promise<EduDirectory> {
  const snap = await col(t, "edu_settings").doc("directory").get();
  return sanitizeDirectory(snap.data() || {});
}
async function teachers(t: string) {
  const ms = await db().collection("memberships").where("tenantId", "==", t).where("status", "==", "active").get();
  return ms.docs.map(d => ({ id: d.id, name: str(d.data().displayName || d.data().email || d.id) }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}
async function currencyOf(t: string): Promise<string> {
  const s = await col(t, "payroll_settings").doc("current").get();
  return str(s.data()?.currency || "KGS", 8);
}

// ── Справочники ──
router.get("/:tenantId/directory", requireFirebaseAuth, requirePerm(db, "edu:schedule"), async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const [dir, staff, currency] = await Promise.all([loadDirectory(t), teachers(t), currencyOf(t)]);
    return res.json({ success: true, ...dir, teachers: staff, currency });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});
router.put("/:tenantId/directory", ...schedGuard("schedule"), async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const prev = await loadDirectory(t);
    const dir = sanitizeDirectory(req.body || {});
    await col(t, "edu_settings").doc("directory").set({ ...dir, updatedAt: Date.now(), updatedBy: req.caller.name });
    const names = (xs: { name: string }[]) => xs.map(x => x.name).join(", ");
    const changes = (["rooms", "groups", "plans"] as const).filter(k => names(prev[k]) !== names(dir[k])).map(k => ({ label: k, from: names(prev[k]), to: names(dir[k]) }));
    if (changes.length) await audit(req, "edu.directory", "Справочники расписания", undefined, changes);
    return res.json({ success: true, ...dir });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

// ── Занятия ──
/** Ученики для выбора: имя и id, без телефонов и прочих данных CRM. */
router.get("/:tenantId/students", requireFirebaseAuth, requirePerm(db, "edu:schedule"), async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const [a, b, c] = await Promise.all([
      col(t, "students").limit(2000).get().catch(() => null),
      col(t, "crm_contacts").limit(2000).get().catch(() => null),
      db().collection("crm_contacts").where("tenantId", "==", t).limit(2000).get().catch(() => null),
    ]);
    const seen = new Map<string, string>();
    for (const s of [a, b, c]) for (const d of s?.docs || []) {
      const x: any = d.data();
      const name = str(x.fullName || x.name || [x.firstName, x.lastName].filter(Boolean).join(" "));
      if (name && !seen.has(d.id)) seen.set(d.id, name);
    }
    return res.json({ success: true, students: [...seen].map(([id, name]) => ({ id, name })).sort((x, y) => x.name.localeCompare(y.name, "ru")) });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

async function lessonFromBody(t: string, b: any) {
  const startTime = normTime(b.startTime), endTime = normTime(b.endTime);
  if (!startTime || !endTime) return { error: "Укажите дату, начало и конец" };
  if (endTime <= startTime) return { error: "Конец позже начала" };
  if (startTime.slice(0, 10) !== endTime.slice(0, 10)) return { error: "Занятие в пределах одного дня" };
  const [dir, staff] = await Promise.all([loadDirectory(t), teachers(t)]);
  const group = dir.groups.find(g => g.id === b.groupId);
  if (!group) return { error: "Выберите группу" };
  const teacher = b.teacherStaffId ? staff.find(s => s.id === b.teacherStaffId) : null;
  if (b.teacherStaffId && !teacher) return { error: "Преподаватель не найден" };
  const room = b.roomId ? dir.rooms.find(r => r.id === b.roomId) : null;
  if (b.roomId && !room) return { error: "Кабинет не найден" };
  const status = ["scheduled", "completed", "canceled"].includes(b.status) ? b.status : "scheduled";
  return {
    lesson: {
      tenantId: t, groupId: group.id, groupName: group.name,
      teacherStaffId: teacher?.id || "", teacherName: teacher?.name || "",
      roomId: room?.id || "", roomName: room?.name || "",
      startTime, endTime, status, topic: str(b.topic, 200), note: str(b.note, 500),
    },
  };
}

async function conflict(t: string, l: any, ignoreId?: string): Promise<string | null> {
  if (l.status === "canceled") return null;
  const day = l.startTime.slice(0, 10);
  const snap = await col(t, "edu_schedule").where("startTime", ">=", day).where("startTime", "<", `${day}T99`).get();
  for (const d of snap.docs) {
    if (d.id === ignoreId) continue;
    const o: any = d.data();
    if (o.status === "canceled" || !lessonsOverlap(l, { startTime: normTime(o.startTime), endTime: normTime(o.endTime) })) continue;
    if (l.roomId && o.roomId === l.roomId) return `Кабинет «${l.roomName}» занят: ${o.groupName || "другое занятие"}`;
    if (l.teacherStaffId && o.teacherStaffId === l.teacherStaffId) return `${l.teacherName} уже ведёт: ${o.groupName || "другое занятие"}`;
    if (o.groupId === l.groupId) return `У группы «${l.groupName}» уже есть занятие в это время`;
  }
  return null;
}

const LESSON_LABEL: Record<string, string> = { groupName: "Группа", teacherName: "Преподаватель", roomName: "Кабинет", startTime: "Начало", endTime: "Конец", status: "Статус", topic: "Тема" };
const diff = (a: any, b: any) => Object.keys(LESSON_LABEL).filter(k => String(a?.[k] ?? "") !== String(b?.[k] ?? "")).map(k => ({ label: LESSON_LABEL[k], from: String(a?.[k] ?? ""), to: String(b?.[k] ?? "") }));

router.post("/:tenantId/lessons", ...schedGuard("schedule"), async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const repeat = Math.max(1, Math.min(52, Math.floor(num(req.body?.repeatWeeks)) || 1));
    const r = await lessonFromBody(t, req.body || {});
    if ("error" in r) return res.status(400).json({ success: false, error: r.error });
    const created: string[] = []; const skipped: string[] = [];
    for (let w = 0; w < repeat; w++) {
      const shift = (s: string) => { const d = new Date(`${s.slice(0, 10)}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 7 * w); return d.toISOString().slice(0, 10) + s.slice(10); };
      const l = { ...r.lesson, startTime: shift(r.lesson.startTime), endTime: shift(r.lesson.endTime) };
      const c = await conflict(t, l);
      if (c) { if (repeat === 1) return res.status(409).json({ success: false, error: c }); skipped.push(`${l.startTime.slice(0, 10)}: ${c}`); continue; }
      const ref = col(t, "edu_schedule").doc();
      await ref.set({ ...l, createdAt: Date.now(), createdBy: req.caller.name, history: [{ at: Date.now(), by: req.caller.name, action: "create" }] });
      created.push(ref.id);
    }
    await audit(req, "edu.lesson.create", `${r.lesson.groupName}: ${r.lesson.startTime.replace("T", " ")}${repeat > 1 ? ` × ${created.length}` : ""}`, { kind: "lesson", id: created[0] || "" });
    return res.json({ success: true, created, skipped });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

router.put("/:tenantId/lessons/:id", ...schedGuard("schedule"), async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const ref = col(t, "edu_schedule").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "Занятие не найдено" });
    const r = await lessonFromBody(t, req.body || {});
    if ("error" in r) return res.status(400).json({ success: false, error: r.error });
    const c = await conflict(t, r.lesson, ref.id);
    if (c) return res.status(409).json({ success: false, error: c });
    const changes = diff(snap.data(), r.lesson);
    await ref.update({ ...r.lesson, updatedAt: Date.now(), history: admin.firestore.FieldValue.arrayUnion({ at: Date.now(), by: req.caller.name, action: "update", changes }) });
    if (changes.length) await audit(req, "edu.lesson.update", `${r.lesson.groupName}: ${r.lesson.startTime.replace("T", " ")}`, { kind: "lesson", id: ref.id }, changes);
    return res.json({ success: true });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

router.delete("/:tenantId/lessons/:id", ...schedGuard("schedule"), async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const ref = col(t, "edu_schedule").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "Занятие не найдено" });
    const l: any = snap.data();
    await col(t, "edu_schedule_trash").doc(ref.id).set({ ...l, deletedAt: Date.now(), deletedBy: req.caller.name });
    await ref.delete();
    await audit(req, "edu.lesson.delete", `${l.groupName}: ${String(l.startTime).replace("T", " ").slice(0, 16)}`, { kind: "lesson", id: ref.id });
    return res.json({ success: true });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

/** Скопировать занятия недели на следующую (или на N недель вперёд). */
router.post("/:tenantId/lessons/copy-week", ...schedGuard("schedule"), async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const from = str(req.body?.weekStart, 10);
    const weeks = Math.max(1, Math.min(12, Math.floor(num(req.body?.weeks)) || 1));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return res.status(400).json({ success: false, error: "Укажите неделю" });
    const end = new Date(`${from}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 7);
    const snap = await col(t, "edu_schedule").where("startTime", ">=", from).where("startTime", "<", end.toISOString().slice(0, 10)).get();
    let created = 0; const skipped: string[] = [];
    for (let w = 1; w <= weeks; w++) {
      for (const d of snap.docs) {
        const o: any = d.data();
        if (o.status === "canceled") continue;
        const shift = (s: string) => { const x = new Date(`${normTime(s).slice(0, 10)}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + 7 * w); return x.toISOString().slice(0, 10) + normTime(s).slice(10); };
        const l = { tenantId: t, groupId: o.groupId, groupName: o.groupName, teacherStaffId: o.teacherStaffId || "", teacherName: o.teacherName || "", roomId: o.roomId || "", roomName: o.roomName || "", startTime: shift(o.startTime), endTime: shift(o.endTime), status: "scheduled", topic: "", note: "" };
        const c = await conflict(t, l);
        if (c) { skipped.push(`${l.startTime.replace("T", " ")}: ${c}`); continue; }
        await col(t, "edu_schedule").add({ ...l, createdAt: Date.now(), createdBy: req.caller.name, history: [{ at: Date.now(), by: req.caller.name, action: "copy" }] });
        created++;
      }
    }
    await audit(req, "edu.lesson.copy", `Копия недели ${from}: ${created}`, undefined);
    return res.json({ success: true, created, skipped });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

// ── Абонементы ──
async function allSubs(t: string) {
  const [own, flat] = await Promise.all([
    col(t, "edu_subscriptions").get(),
    db().collection("edu_subscriptions").where("tenantId", "==", t).get().catch(() => null),
  ]);
  const out = new Map<string, any>();
  for (const d of own.docs) out.set(d.id, { ...d.data(), id: d.id });
  // Старые выдачи писались ещё и в общую коллекцию под другим id — дубль с тем же
  // содержимым пропускаем, одиночные (только там) показываем.
  const key = (x: any) => `${x.studentContactId}|${x.createdAt}`;
  const ownKeys = new Set([...out.values()].map(key));
  for (const d of flat?.docs || []) { const x = { ...d.data(), id: `flat_${d.id}` }; if (!ownKeys.has(key(x))) out.set(x.id, x); }
  const today = new Date().toISOString().slice(0, 10);
  return [...out.values()].map(s => ({ ...s, status: subscriptionStatus(s, today) })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

router.get("/:tenantId/subscriptions", ...schedGuard("subscriptions"), async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const [subs, dir, currency] = await Promise.all([allSubs(t), loadDirectory(t), currencyOf(t)]);
    return res.json({ success: true, subscriptions: subs, plans: dir.plans, groups: dir.groups, currency });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

/** Выдача: абонемент и приход в кассу — одной транзакцией. */
router.post("/:tenantId/subscriptions", ...schedGuard("subscriptions"), async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const b = req.body || {};
    const studentName = str(b.studentName);
    if (!studentName) return res.status(400).json({ success: false, error: "Укажите ученика" });
    const [dir, currency] = await Promise.all([loadDirectory(t), currencyOf(t)]);
    const plan = b.planId ? dir.plans.find(p => p.id === b.planId) : null;
    const p = sanitizePlan({ ...(plan || {}), ...b, id: plan?.id || "custom", name: plan?.name || str(b.planName) || "Абонемент" });
    if (!p) return res.status(400).json({ success: false, error: "Проверьте вид, число занятий и цену" });
    const startDate = /^\d{4}-\d{2}-\d{2}$/.test(b.startDate) ? b.startDate : new Date().toISOString().slice(0, 10);
    const exp = new Date(`${startDate}T00:00:00Z`); exp.setUTCDate(exp.getUTCDate() + p.days);
    const group = b.groupId ? dir.groups.find(g => g.id === b.groupId) : null;
    const ref = col(t, "edu_subscriptions").doc();
    const sub = {
      id: ref.id, tenantId: t, studentContactId: str(b.studentContactId) || "", studentName,
      groupId: group?.id || "", groupName: group?.name || "",
      planId: p.id, planName: p.name, type: p.type,
      totalLessons: p.type === "lessons_pack" ? p.lessons : 0, remainingLessons: p.type === "lessons_pack" ? p.lessons : 0,
      pricePaid: p.price, currency, startDate, expiryDate: exp.toISOString().slice(0, 10),
      isFrozen: false, status: "active", createdAt: Date.now(), createdBy: req.caller.name,
      history: [{ at: Date.now(), by: req.caller.name, action: "issue", note: `${p.name} · ${p.price} ${currency}` }],
    };
    const paid = b.paid !== false && p.price > 0;
    await db().runTransaction(async tx => {
      tx.set(ref, sub);
      if (paid) tx.set(cashCol(db(), t).doc(`sub_${ref.id}`), cashEntryDoc({
        kind: "in", amount: p.price, date: startDate, category: "Абонементы", account: b.account === "cash" ? "cash" : "bank",
        note: p.name, counterparty: studentName, source: "subscription", sourceId: ref.id, createdBy: req.caller.name,
      }));
    });
    await audit(req, "edu.subscription.issue", `${studentName}: ${p.name}`, { kind: "subscription", id: ref.id, name: studentName });
    return res.json({ success: true, subscription: sub });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

const ACTIONS: SubAction[] = ["deduct", "return", "freeze", "unfreeze", "extend", "cancel"];
router.post("/:tenantId/subscriptions/:id/:action", ...schedGuard("subscriptions"), async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const action = String(req.params.action) as SubAction;
    if (!ACTIONS.includes(action)) return res.status(400).json({ success: false, error: "Неизвестное действие" });
    if (String(req.params.id).startsWith("flat_")) return res.status(409).json({ success: false, error: "Старая запись — выдайте абонемент заново" });
    const ref = col(t, "edu_subscriptions").doc(req.params.id);
    const note = str(req.body?.note, 300);
    const today = new Date().toISOString().slice(0, 10);
    let result: any = null;
    const err = await db().runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) return "Абонемент не найден";
      const s: any = snap.data();
      const st = subscriptionStatus(s, today);
      const upd: any = {};
      if (action === "deduct") {
        if (st !== "active") return "Абонемент не активен";
        if (s.type === "lessons_pack") upd.remainingLessons = Math.max(0, (s.remainingLessons || 0) - 1);
        upd.attended = (s.attended || 0) + 1;
      } else if (action === "return") {
        if (s.type === "lessons_pack") { if ((s.remainingLessons || 0) >= (s.totalLessons || 0)) return "Списаний нет"; upd.remainingLessons = (s.remainingLessons || 0) + 1; }
        upd.attended = Math.max(0, (s.attended || 0) - 1);
      } else if (action === "freeze") {
        if (st !== "active") return "Заморозить можно только активный";
        const until = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.until) ? req.body.until : "";
        if (!until || until <= today) return "Укажите дату окончания заморозки";
        // Срок продлевается на дни заморозки.
        const days = Math.round((Date.parse(until) - Date.parse(today)) / 864e5);
        const exp = new Date(`${s.expiryDate.slice(0, 10)}T00:00:00Z`); exp.setUTCDate(exp.getUTCDate() + days);
        Object.assign(upd, { isFrozen: true, frozenUntilDate: until, expiryDate: exp.toISOString().slice(0, 10) });
      } else if (action === "unfreeze") {
        if (!s.isFrozen) return "Абонемент не заморожен";
        Object.assign(upd, { isFrozen: false, frozenUntilDate: admin.firestore.FieldValue.delete() });
      } else if (action === "extend") {
        const days = Math.floor(num(req.body?.days));
        const lessons = Math.floor(num(req.body?.lessons));
        if (!(days > 0) && !(lessons > 0)) return "Укажите дни или занятия";
        if (days > 0) { const exp = new Date(`${s.expiryDate.slice(0, 10)}T00:00:00Z`); exp.setUTCDate(exp.getUTCDate() + Math.min(days, 730)); upd.expiryDate = exp.toISOString().slice(0, 10); }
        if (lessons > 0 && s.type === "lessons_pack") { upd.totalLessons = (s.totalLessons || 0) + Math.min(lessons, 500); upd.remainingLessons = (s.remainingLessons || 0) + Math.min(lessons, 500); }
      } else if (action === "cancel") {
        if (st === "canceled") return "Уже отменён";
        if (!note) return "Укажите причину";
        upd.canceled = { at: Date.now(), by: req.caller.name, reason: note };
        const refund = Math.max(0, num(req.body?.refund) || 0);
        if (refund > 0) {
          if (refund > (s.pricePaid || 0)) return "Возврат больше оплаты";
          upd.refunded = refund;
          tx.set(cashCol(db(), t).doc(`subref_${ref.id}`), cashEntryDoc({
            kind: "out", amount: refund, date: today, category: "Возврат", account: req.body?.account === "cash" ? "cash" : "bank",
            note: `${s.planName || "Абонемент"}: ${note}`, counterparty: s.studentName, source: "subscription", sourceId: ref.id, createdBy: req.caller.name,
          }));
        }
      }
      upd.history = admin.firestore.FieldValue.arrayUnion({ at: Date.now(), by: req.caller.name, action, ...(note ? { note } : {}) });
      tx.update(ref, upd);
      result = { ...s, ...upd, history: undefined };
      return null;
    });
    if (err) return res.status(409).json({ success: false, error: err });
    await audit(req, `edu.subscription.${action}`, `${result.studentName}: ${action}${note ? ` (${note})` : ""}`, { kind: "subscription", id: ref.id, name: result.studentName });
    return res.json({ success: true });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

export default router;
