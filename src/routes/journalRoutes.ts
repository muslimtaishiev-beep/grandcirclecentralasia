import { Router } from "express";
import admin from "firebase-admin";
import { createHash, randomBytes } from "crypto";
import { requireFirebaseAuth } from "./authRoutes.js";
import { activeMembership, membershipPermissions } from "../server/access.js";
import { checkTenantOpen, requireScreen } from "../server/tenantAccess.js";
import { hasFullAccess } from "../shared/permissions.js";
import { tenantLogos } from "../shared/legal.js";
import {
  BLANK_TEMPLATE, JOURNAL_LIMITS, JOURNAL_TEMPLATES,
  displayValue, hashableValues, isPhotoValue, matchName, newId, normalizeValue, roleAtLeast,
  sanitizeAccess, sanitizeColumns, sanitizeSettings,
  type Journal, type JournalChange, type JournalColumn, type JournalEntry, type JournalRole,
  type NameSignature, type QrSignature,
} from "../shared/journals.js";

/**
 * Журналы делопроизводства: конструктор колонок, записи, подписи.
 *
 * Всё пишет сервер. Доступ к журналу — не право должности, а список в
 * настройках самого журнала: завуч решает, кто видит журнал отработок,
 * и это не требует похода к администратору за новой ролью. Видеть журналы
 * могут только сотрудники организации (активное членство).
 *
 * Подпись по QR — единственная ручка, открытая без входа: одноразовая
 * ссылка на одну ячейку одной записи. Вместе с подписью сохраняется всё,
 * что сервер знает о моменте: время, адрес, устройство, кто выдал код и
 * отпечаток значений записи.
 */
const router = Router();
const db = () => admin.firestore();
const col = (t: string, name: string) => db().collection("tenants").doc(t).collection(name);
const TOKENS = "journal_sign_tokens";
const str = (v: unknown, max = 200) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const fail = (res: any, status: number, error: string) => res.status(status).json({ success: false, error });

// ── Кто вызывает ────────────────────────────────────────────────────────

interface Caller { uid: string; name: string; full: boolean; canCreate: boolean }

/** Только сотрудник организации: активное членство или суперадмин. */
const requireEmployee = async (req: any, res: any, next: any) => {
  try {
    const t = String(req.params.tenantId || "");
    const uid = String(req.user?.uid || "");
    const name = str(req.user?.name || req.user?.email || uid, 120);
    if (req.user?.isSuperadmin === true) {
      req.caller = { uid, name, full: true, canCreate: true } as Caller;
      return next();
    }
    const m = await activeMembership(db(), uid, t);
    if (!m) return fail(res, 403, "Журналы доступны только сотрудникам организации");
    const perms = await membershipPermissions(db(), m);
    const full = hasFullAccess(m.role);
    req.caller = { uid, name: str(m.displayName, 120) || name, full, canCreate: full || perms.has("journals:manage") } as Caller;
    next();
  } catch (e: any) { return fail(res, 500, e.message); }
};
const guard = [requireFirebaseAuth, requireScreen("journals", (req: any) => req.params.tenantId), requireEmployee];

export function journalRole(j: Pick<Journal, "access" | "createdBy">, c: Caller): JournalRole | null {
  if (c.full || j.createdBy === c.uid) return "manage";
  const own = j.access?.members?.[c.uid];
  if (own) return own;
  return j.access?.everyone && j.access.everyone !== "none" ? j.access.everyone : null;
}

async function loadJournal(req: any, res: any, need: JournalRole): Promise<{ j: Journal; role: JournalRole } | null> {
  const snap = await col(req.params.tenantId, "journals").doc(String(req.params.journalId)).get();
  if (!snap.exists || snap.data()?.archived) { fail(res, 404, "Журнал не найден"); return null; }
  const j = { ...(snap.data() as Journal), id: snap.id };
  const role = journalRole(j, req.caller);
  if (!roleAtLeast(role, need)) {
    fail(res, 403, need === "manage" ? "Менять настройки может только ответственный за журнал" : need === "edit" ? "У вас доступ к журналу только на просмотр" : "Нет доступа к этому журналу");
    return null;
  }
  return { j, role: role as JournalRole };
}

// ── Сотрудники ──────────────────────────────────────────────────────────

const employeesCache = new Map<string, { at: number; list: { uid: string; name: string; email: string }[] }>();
export async function listEmployees(t: string) {
  const hit = employeesCache.get(t);
  if (hit && Date.now() - hit.at < 60_000) return hit.list;
  const ms = await db().collection("memberships").where("tenantId", "==", t).where("status", "==", "active").get();
  const uids = [...new Set(ms.docs.map(d => String(d.data().userId || "")).filter(Boolean))];
  const users = uids.length ? await db().getAll(...uids.map(u => db().collection("users").doc(u))) : [];
  const byUid = new Map(users.map(u => [u.id, u.data() || {}]));
  const seen = new Set<string>();
  const list = ms.docs.map(d => {
    const m = d.data(); const u: any = byUid.get(m.userId) || {};
    const email = str(m.email || u.email, 120);
    return { uid: String(m.userId || ""), name: str(m.displayName || u.displayName || u.fullName || u.name, 120) || email, email };
  }).filter(e => e.uid && !seen.has(e.uid) && (seen.add(e.uid), true))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  employeesCache.set(t, { at: Date.now(), list });
  return list;
}

// ── Записи: облегчённый вид для таблицы ─────────────────────────────────

const hashOf = (j: Journal, values: Record<string, any>) =>
  createHash("sha256").update(hashableValues(j.columns, values)).digest("hex").slice(0, 32);

/** Подписи помечаются, если запись правили после них. */
function markChanged(j: Journal, e: JournalEntry): JournalEntry {
  const now = hashOf(j, e.values || {});
  const values: Record<string, any> = { ...e.values };
  for (const c of j.columns) {
    const v = values[c.id];
    const was = e.signedHash?.[c.id];
    if (c.type === "qr_sign" && v?.signedAt && was) values[c.id] = { ...v, changedAfter: was !== now };
  }
  return { ...e, values };
}

/** Фото в таблицу не отдаём: сотни записей по 300 КБ положат страницу. */
function lighten(j: Journal, e0: JournalEntry): JournalEntry {
  const e = markChanged(j, e0);
  const values: Record<string, any> = { ...e.values };
  for (const c of j.columns) {
    const v = values[c.id];
    if (c.type === "photo" && isPhotoValue(v)) values[c.id] = { photo: true };
    if (c.type === "qr_sign" && v?.answers) {
      const answers: Record<string, any> = {};
      for (const [k, a] of Object.entries(v.answers)) answers[k] = isPhotoValue(a) ? "[фото]" : a;
      values[c.id] = { ...v, answers };
    }
  }
  const { changes, ...rest } = e;
  return { ...rest, values, changes: undefined, ...(changes?.length ? { changeCount: changes.length } : {}) } as JournalEntry;
}

/**
 * Проверка и подготовка значений из запроса.
 * Подписи отсюда не ставятся — только имя куратора (со сверкой) и очистка
 * подписи ответственным.
 */
async function prepareValues(
  t: string, j: Journal, role: JournalRole, caller: Caller, input: Record<string, unknown>, prev: Record<string, any> = {},
): Promise<{ values: Record<string, any>; changes: JournalChange[] } | { error: string }> {
  const values: Record<string, any> = {};
  const changes: JournalChange[] = [];
  const now = Date.now();
  let employees: { uid: string; name: string }[] | null = null;
  for (const [cid, raw] of Object.entries(input || {})) {
    const c = j.columns.find(x => x.id === cid);
    if (!c) continue;
    if (c.managersOnly && role !== "manage") return { error: `«${c.label}» заполняет только ответственный за журнал` };
    let next: any;
    if (c.type === "qr_sign") {
      if (raw !== null) return { error: `«${c.label}» ставится только сканированием QR` };
      if (prev[cid] && role !== "manage") return { error: "Отменить подпись может только ответственный за журнал" };
      next = null;
    } else if (c.type === "name_sign") {
      if (raw === null || raw === "") {
        if (prev[cid] && role !== "manage" && prev[cid]?.by !== caller.uid) return { error: "Снять чужую подпись может только ответственный за журнал" };
        next = null;
      } else {
        const typed = str(raw, 120);
        // Имя из списка журнала (у этих людей нет аккаунтов) — принимаем как
        // есть, кто ввёл — записываем. Имя сотрудника — только своё: иначе
        // любой ведущий записи мог подписаться за куратора.
        let hit = matchName(typed, c.allowedNames || []);
        if (!hit && c.allowEmployees) {
          employees = employees || await listEmployees(t);
          const emp = matchName(typed, employees.map(e => e.name));
          if (emp) {
            const owners = employees.filter(e => e.name === emp).map(e => e.uid);
            if (!owners.includes(caller.uid) && !caller.full) return { error: `«${c.label}»: подписать именем сотрудника «${emp}» может только он сам` };
            hit = emp;
          }
        }
        if (!hit) return { error: `«${c.label}»: имя «${typed}» не найдено среди разрешённых. Напишите фамилию и имя полностью.` };
        next = { name: hit, typed, by: caller.uid, byName: caller.name, at: now } as NameSignature;
      }
    } else {
      const r = normalizeValue(c, raw);
      if (!r.ok) return { error: (r as { error: string }).error };
      next = r.value;
    }
    const before = displayValue(c, prev[cid]);
    const after = displayValue(c, next);
    if (before === after && JSON.stringify(prev[cid] ?? null) === JSON.stringify(next ?? null)) continue;
    values[cid] = next;
    changes.push({ at: now, by: caller.uid, byName: caller.name, columnId: cid, from: before.slice(0, 200), to: after.slice(0, 200) });
  }
  return { values, changes };
}

/**
 * Влезет ли документ записи в лимит Firestore (1 МиБ). Считаем байты UTF-8
 * всего документа — с историей и подписями: кириллица весит 2 байта, и
 * подсчёт символов одних значений пропускал записи, которые потом уже не
 * сохранялись (в том числе подпись по QR).
 */
const sizeOk = (doc: object) => Buffer.byteLength(JSON.stringify(doc), "utf8") <= 950_000;

// ── QR-подпись: публичная часть ─────────────────────────────────────────
// Объявлена раньше кабинетных ручек: иначе /sign/:token совпал бы с
// /:tenantId/:journalId и «sign» приняли бы за организацию.

async function loadToken(token: string) {
  if (!/^[\w-]{20,40}$/.test(token)) return { error: "Ссылка недействительна", status: 404 };
  const tSnap = await db().collection(TOKENS).doc(token).get();
  const tk = tSnap.data();
  if (!tk) return { error: "Ссылка недействительна", status: 404 };
  const gate = await checkTenantOpen(tk.tenantId, "journals");
  if (!gate.ok) return { error: gate.error, status: gate.status };
  const [jSnap, eSnap] = await Promise.all([
    col(tk.tenantId, "journals").doc(tk.journalId).get(),
    col(tk.tenantId, "journal_entries").doc(tk.entryId).get(),
  ]);
  const j = jSnap.exists ? ({ ...(jSnap.data() as Journal), id: jSnap.id }) : null;
  const e = eSnap.data() as (JournalEntry & { pendingTokens?: Record<string, string> }) | undefined;
  const c = j?.columns.find(x => x.id === tk.columnId && x.type === "qr_sign");
  if (!j || j.archived || !e || e.deleted || !c) return { error: "Запись больше не существует", status: 404 };
  return { tk, tSnap, j, e, c, tenant: gate.tenant };
}

function tokenState(tk: any, e: any, c: JournalColumn): string | null {
  if (e.values?.[c.id]?.signedAt) return "Запись уже подписана";
  if (tk.usedAt) return "Ссылка уже использована";
  if (tk.failures >= 5) return "Слишком много неверных попыток — попросите новый QR";
  if (Date.now() > tk.expiresAt) return "Срок ссылки истёк — попросите новый QR";
  if (e.pendingTokens?.[c.id] !== tk.__id) return "Эта ссылка заменена новой — отсканируйте последний QR";
  return null;
}

router.get("/sign/:token", async (req: any, res: any) => {
  try {
    const got: any = await loadToken(String(req.params.token));
    if (got.error) return fail(res, got.status, got.error);
    const { tk, j, e, c, tenant } = got;
    tk.__id = String(req.params.token);
    // Что подписывающий видит о записи. Не показываем: колонку, с которой
    // сверяется его ответ (иначе сверка ФИО бессмысленна), поля только для
    // ответственного и свободный текст. После использования, истечения или
    // замены ссылки — ничего: сфотографированный QR не должен открывать запись.
    const closed = tokenState(tk, e, c);
    const hidden = new Set((c.subfields || []).map((s: any) => s.matchColumnId).filter(Boolean));
    const summary = closed ? [] : j.columns
      .filter((x: JournalColumn) => ["number", "date", "select", "checkbox"].includes(x.type) && !x.managersOnly && !hidden.has(x.id))
      .map((x: JournalColumn) => ({ label: x.label, value: displayValue(x, e.values?.[x.id]) }))
      .filter((x: { value: string }) => x.value);
    return res.json({
      success: true,
      org: { name: str(tenant?.name, 120), ...tenantLogos(tenant) },
      journal: { title: j.title },
      column: { label: c.label, subfields: (c.subfields || []).map(({ id, type, label, required }: any) => ({ id, type, label, required })) },
      summary,
      closed,
      expiresAt: tk.expiresAt,
    });
  } catch (e: any) { return fail(res, 500, e.message); }
});

router.post("/sign/:token", async (req: any, res: any) => {
  try {
    const token = String(req.params.token);
    const got: any = await loadToken(token);
    if (got.error) return fail(res, got.status, got.error);
    const { j, c } = got;
    const answersIn = req.body?.answers || {};
    const client = req.body?.client || {};
    const out = await db().runTransaction(async tx => {
      const tRef = db().collection(TOKENS).doc(token);
      const eRef = col(got.tk.tenantId, "journal_entries").doc(got.tk.entryId);
      const [tSnap, eSnap] = await Promise.all([tx.get(tRef), tx.get(eRef)]);
      const tk: any = { ...tSnap.data(), __id: token };
      const e: any = eSnap.data();
      const closed = tokenState(tk, e, c);
      if (closed) return { status: 409, error: closed };

      const answers: Record<string, string | boolean> = {};
      for (const s of c.subfields || []) {
        const v = answersIn[s.id];
        if (s.type === "checkbox") {
          if (s.required && v !== true) return { status: 400, error: `Отметьте: «${s.label}»` };
          answers[s.id] = v === true;
        } else if (s.type === "text") {
          const text = str(v, 300);
          if (s.required && !text) return { status: 400, error: `Заполните: «${s.label}»` };
          if (s.matchColumnId && text) {
            const mc = j.columns.find((x: JournalColumn) => x.id === s.matchColumnId);
            const expected = mc ? displayValue(mc, e.values?.[mc.id]) : "";
            if (expected && !matchName(text, [expected])) {
              tx.update(tRef, { failures: admin.firestore.FieldValue.increment(1) });
              return { status: 400, error: `«${s.label}» не совпадает с записью в журнале. Проверьте, что пишете свои фамилию и имя.`, commit: true };
            }
          }
          answers[s.id] = text;
        } else if (s.type === "photo") {
          if (v && (!isPhotoValue(v) || v.length > JOURNAL_LIMITS.maxPhotoChars)) return { status: 400, error: `«${s.label}»: фото не подходит или слишком большое` };
          if (s.required && !v) return { status: 400, error: `Приложите фото: «${s.label}»` };
          if (v) answers[s.id] = v;
        }
      }
      const now = Date.now();
      const hash = hashOf(j, e.values || {});
      const sig: QrSignature = {
        signedAt: now, answers,
        meta: {
          ip: str(req.ip, 64), userAgent: str(req.headers["user-agent"], 400), acceptLanguage: str(req.headers["accept-language"], 120),
          timezone: str(client.timezone, 64), screen: str(client.screen, 32), platform: str(client.platform, 64),
          language: str(client.language, 32), touch: client.touch === true,
          issuedBy: str(tk.issuedBy, 128), issuedByName: str(tk.issuedByName, 120), issuedAt: Number(tk.issuedAt) || 0,
          entryHash: hash,
        },
      };
      const values = { ...e.values, [c.id]: sig };
      if (!sizeOk({ ...e, values })) return { status: 400, error: "Фото слишком большое" };
      const change: JournalChange = { at: now, by: "qr", byName: "Подпись по QR", columnId: c.id, from: "", to: displayValue(c, sig) };
      tx.update(eRef, {
        values, updatedAt: now,
        [`signedHash.${c.id}`]: hash,
        [`pendingTokens.${c.id}`]: admin.firestore.FieldValue.delete(),
        changes: [...(e.changes || []), change].slice(-JOURNAL_LIMITS.maxChanges),
      });
      tx.update(tRef, { usedAt: now });
      return { ok: true, signedAt: now };
    });
    if ((out as any).error) return fail(res, (out as any).status, (out as any).error);
    return res.json({ success: true, signedAt: (out as any).signedAt });
  } catch (e: any) { return fail(res, 500, e.message); }
});

// ── Журналы ─────────────────────────────────────────────────────────────

router.get("/:tenantId/templates", ...guard, (_req: any, res: any) =>
  res.json({ success: true, templates: JOURNAL_TEMPLATES.map(({ key, title, description }) => ({ key, title, description })) }));

router.get("/:tenantId/employees", ...guard, async (req: any, res: any) => {
  try { return res.json({ success: true, employees: await listEmployees(req.params.tenantId) }); }
  catch (e: any) { return fail(res, 500, e.message); }
});

router.get("/:tenantId", ...guard, async (req: any, res: any) => {
  try {
    const snap = await col(req.params.tenantId, "journals").get();
    const journals = snap.docs.map(d => ({ ...(d.data() as Journal), id: d.id }))
      .filter(j => !j.archived)
      .map(j => ({ j, role: journalRole(j, req.caller) }))
      .filter(x => x.role)
      .map(({ j, role }) => ({
        id: j.id, title: j.title, description: j.description, templateKey: j.templateKey,
        columnCount: j.columns.length, updatedAt: j.updatedAt, role,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return res.json({ success: true, journals, canCreate: req.caller.canCreate });
  } catch (e: any) { return fail(res, 500, e.message); }
});

router.post("/:tenantId", ...guard, async (req: any, res: any) => {
  try {
    if (!req.caller.canCreate) return fail(res, 403, "Создавать журналы может сотрудник с правом «Создание журналов»");
    const tpl = JOURNAL_TEMPLATES.find(x => x.key === req.body?.templateKey) || BLANK_TEMPLATE;
    const columns = sanitizeColumns(tpl.columns);
    const now = Date.now();
    const id = newId("j");
    const j: Journal = {
      id, tenantId: req.params.tenantId,
      title: str(req.body?.title, 120) || tpl.title,
      description: tpl.description,
      columns, settings: sanitizeSettings(tpl.settings, columns),
      access: { everyone: "none", members: {} },
      templateKey: tpl.key,
      createdBy: req.caller.uid, createdByName: req.caller.name, createdAt: now, updatedAt: now,
    };
    await col(req.params.tenantId, "journals").doc(id).set(j);
    return res.json({ success: true, journal: j });
  } catch (e: any) { return fail(res, 500, e.message); }
});

router.get("/:tenantId/:journalId", ...guard, async (req: any, res: any) => {
  try {
    const got = await loadJournal(req, res, "view"); if (!got) return;
    const snap = await col(req.params.tenantId, "journal_entries").where("journalId", "==", got.j.id).get();
    const entries = snap.docs.map(d => ({ ...(d.data() as JournalEntry), id: d.id }))
      .filter(e => !e.deleted)
      .map(e => lighten(got.j, e))
      .sort((a, b) => b.createdAt - a.createdAt);
    return res.json({ success: true, journal: got.j, role: got.role, entries });
  } catch (e: any) { return fail(res, 500, e.message); }
});

router.put("/:tenantId/:journalId", ...guard, async (req: any, res: any) => {
  try {
    const got = await loadJournal(req, res, "manage"); if (!got) return;
    const b = req.body || {};
    const columns = b.columns !== undefined ? sanitizeColumns(b.columns) : got.j.columns;
    if (!columns.length) return fail(res, 400, "В журнале должна быть хотя бы одна колонка");
    const patch: Partial<Journal> = {
      title: b.title !== undefined ? (str(b.title, 120) || got.j.title) : got.j.title,
      description: b.description !== undefined ? str(b.description, 500) : got.j.description,
      columns,
      settings: sanitizeSettings(b.settings !== undefined ? b.settings : got.j.settings, columns),
      access: b.access !== undefined ? sanitizeAccess(b.access) : got.j.access,
      updatedAt: Date.now(),
    };
    // Ответственный не может отнять доступ у самого себя — иначе журнал
    // останется без хозяина и настроить его будет некому, кроме админа.
    if (!req.caller.full && got.j.createdBy !== req.caller.uid && patch.access!.members[req.caller.uid] !== "manage") {
      patch.access!.members[req.caller.uid] = "manage";
    }
    // update, а не set с merge: merge сливает вложенные словари и не удаляет
    // из них ключи — убранный «Срок» или снятый с доступа сотрудник
    // оставались в базе. update заменяет каждое поле верхнего уровня целиком.
    await col(req.params.tenantId, "journals").doc(got.j.id).update(patch);
    return res.json({ success: true, journal: { ...got.j, ...patch } });
  } catch (e: any) { return fail(res, 500, e.message); }
});

router.delete("/:tenantId/:journalId", ...guard, async (req: any, res: any) => {
  try {
    const got = await loadJournal(req, res, "manage"); if (!got) return;
    await col(req.params.tenantId, "journals").doc(got.j.id).update({ archived: true, archivedAt: Date.now(), archivedBy: req.caller.uid });
    return res.json({ success: true });
  } catch (e: any) { return fail(res, 500, e.message); }
});

// ── Записи ──────────────────────────────────────────────────────────────

/**
 * Новая запись или сразу несколько: { values } или { entries: [{ values }] }.
 * Несколько — когда опоздал целый класс: одна общая форма, запись на каждого.
 */
router.post("/:tenantId/:journalId/entries", ...guard, async (req: any, res: any) => {
  try {
    const got = await loadJournal(req, res, "edit"); if (!got) return;
    const list: Record<string, unknown>[] = Array.isArray(req.body?.entries)
      ? req.body.entries.map((x: any) => x?.values || {})
      : [req.body?.values || {}];
    if (!list.length) return fail(res, 400, "Нет данных для записи");
    if (list.length > JOURNAL_LIMITS.maxBulk) return fail(res, 400, `За раз — не больше ${JOURNAL_LIMITS.maxBulk} записей`);
    const now = Date.now();
    const created: JournalEntry[] = [];
    for (const input of list) {
      const r = await prepareValues(req.params.tenantId, got.j, got.role, req.caller, input);
      if ("error" in r) return fail(res, 400, r.error);
      if (!sizeOk({ values: r.values })) return fail(res, 400, "Запись слишком большая: уменьшите фото");
      created.push({
        id: newId("e"), journalId: got.j.id, values: r.values,
        createdAt: now, createdBy: req.caller.uid, createdByName: req.caller.name, updatedAt: now,
        changes: [],
      });
    }
    for (let i = 0; i < created.length; i += 400) {
      const batch = db().batch();
      for (const e of created.slice(i, i + 400)) batch.set(col(req.params.tenantId, "journal_entries").doc(e.id), { ...e, tenantId: req.params.tenantId });
      await batch.commit();
    }
    return res.json({ success: true, entries: created.map(e => lighten(got.j, e)) });
  } catch (e: any) { return fail(res, 500, e.message); }
});

router.get("/:tenantId/:journalId/entries/:entryId", ...guard, async (req: any, res: any) => {
  try {
    const got = await loadJournal(req, res, "view"); if (!got) return;
    const snap = await col(req.params.tenantId, "journal_entries").doc(String(req.params.entryId)).get();
    const e = snap.data() as JournalEntry | undefined;
    if (!e || e.journalId !== got.j.id || e.deleted) return fail(res, 404, "Запись не найдена");
    return res.json({ success: true, entry: markChanged(got.j, { ...e, id: snap.id }) });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/** Дозаполнить или исправить запись: { values: { колонка: значение } }. */
router.patch("/:tenantId/:journalId/entries/:entryId", ...guard, async (req: any, res: any) => {
  try {
    const got = await loadJournal(req, res, "edit"); if (!got) return;
    const ref = col(req.params.tenantId, "journal_entries").doc(String(req.params.entryId));
    // Права и значения проверяются по записи, прочитанной в транзакции: иначе
    // подпись, пришедшая между чтением и записью, затиралась бы — в том
    // числе тем, кому снимать подписи нельзя.
    const out = await db().runTransaction(async tx => {
      const snap = await tx.get(ref);
      const e = snap.data() as JournalEntry | undefined;
      if (!e || e.journalId !== got.j.id || e.deleted) return { status: 404, error: "Запись не найдена" };
      const r = await prepareValues(req.params.tenantId, got.j, got.role, req.caller, req.body?.values || {}, e.values || {});
      if ("error" in r) return { status: 400, error: r.error };
      const values = { ...e.values, ...r.values };
      if (!sizeOk({ ...e, values })) return { status: 400, error: "Запись слишком большая: уменьшите фото" };
      const changes = [...(e.changes || []), ...r.changes].slice(-JOURNAL_LIMITS.maxChanges);
      const signedHash = { ...(e.signedHash || {}) };
      for (const [k, v] of Object.entries(r.values)) if (v === null) delete signedHash[k];
      const next = { ...e, id: snap.id, values, changes, signedHash, updatedAt: Date.now(), updatedBy: req.caller.uid };
      tx.set(ref, next);
      return { entry: next };
    });
    if ("error" in out) return fail(res, out.status as number, out.error as string);
    return res.json({ success: true, entry: lighten(got.j, out.entry as JournalEntry) });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/** Массово: { ids, action: "set", columnId, value } или { ids, action: "delete" }. */
router.post("/:tenantId/:journalId/entries/bulk", ...guard, async (req: any, res: any) => {
  try {
    const got = await loadJournal(req, res, "edit"); if (!got) return;
    const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map((x: unknown) => str(x, 80)).filter(Boolean))] as string[];
    if (!ids.length) return fail(res, 400, "Не выбраны записи");
    if (ids.length > JOURNAL_LIMITS.maxBulk) return fail(res, 400, `За раз — не больше ${JOURNAL_LIMITS.maxBulk} записей`);
    const action = req.body?.action;
    if (action !== "set" && action !== "delete") return fail(res, 400, "Неизвестное действие");
    if (action === "delete" && got.role !== "manage") return fail(res, 403, "Удалять записи может только ответственный за журнал");
    const refs = ids.map(id => col(req.params.tenantId, "journal_entries").doc(id));
    const snaps = await db().getAll(...refs);
    const now = Date.now();
    const updated: JournalEntry[] = [];
    let batch = db().batch(); let n = 0;
    if (action === "set") {
      // Каждая запись — своей транзакцией по свежему снимку: пачка со старыми
      // копиями затирала бы подпись, поставленную учеником в эту же минуту.
      const cid = str(req.body?.columnId, 42);
      for (const s0 of snaps) {
        const out = await db().runTransaction(async tx => {
          const s = await tx.get(s0.ref);
          const e = s.data() as JournalEntry | undefined;
          if (!e || e.journalId !== got.j.id || e.deleted) return null;
          const r = await prepareValues(req.params.tenantId, got.j, got.role, req.caller, { [cid]: req.body?.value }, e.values || {});
          if ("error" in r) return { error: r.error };
          if (!r.changes.length) return null;
          const next = { ...e, id: s.id, values: { ...e.values, ...r.values }, changes: [...(e.changes || []), ...r.changes].slice(-JOURNAL_LIMITS.maxChanges), updatedAt: now, updatedBy: req.caller.uid };
          if (!sizeOk(next)) return null;
          tx.set(s.ref, next);
          return { entry: next };
        });
        if (out && "error" in out) return fail(res, 400, out.error as string);
        if (out?.entry) updated.push(out.entry as JournalEntry);
      }
      return res.json({ success: true, count: updated.length, entries: updated.map(e => lighten(got.j, e)) });
    }
    for (const s of snaps) {
      const e = s.data() as JournalEntry | undefined;
      if (!e || e.journalId !== got.j.id || e.deleted) continue;
      batch.update(s.ref, { deleted: true, deletedAt: now, deletedBy: req.caller.uid });
      if (++n % 400 === 0) { await batch.commit(); batch = db().batch(); }
    }
    await batch.commit();
    return res.json({ success: true, count: n, entries: [] });
  } catch (e: any) { return fail(res, 500, e.message); }
});

// ── QR-подпись: выдача кода ─────────────────────────────────────────────

/**
 * Одноразовая ссылка на подпись одной ячейки. Новая ссылка отменяет
 * прежнюю: запись помнит только последний выданный код.
 */
router.post("/:tenantId/:journalId/entries/:entryId/sign-token", ...guard, async (req: any, res: any) => {
  try {
    const got = await loadJournal(req, res, "edit"); if (!got) return;
    const c = got.j.columns.find(x => x.id === req.body?.columnId && x.type === "qr_sign");
    if (!c) return fail(res, 400, "Колонка подписи не найдена");
    if (c.managersOnly && got.role !== "manage") return fail(res, 403, `«${c.label}» выдаёт только ответственный за журнал`);
    const ref = col(req.params.tenantId, "journal_entries").doc(String(req.params.entryId));
    const snap = await ref.get();
    const e = snap.data() as JournalEntry | undefined;
    if (!e || e.journalId !== got.j.id || e.deleted) return fail(res, 404, "Запись не найдена");
    if (e.values?.[c.id]?.signedAt) return fail(res, 409, "Запись уже подписана");
    const token = randomBytes(18).toString("base64url");
    const now = Date.now();
    const expiresAt = now + (c.tokenTtlHours || 24) * 3600_000;
    await db().collection(TOKENS).doc(token).set({
      tenantId: req.params.tenantId, journalId: got.j.id, entryId: snap.id, columnId: c.id,
      issuedBy: req.caller.uid, issuedByName: req.caller.name, issuedAt: now, expiresAt, usedAt: null, failures: 0,
    });
    await ref.update({ [`pendingTokens.${c.id}`]: token });
    return res.json({ success: true, token, path: `/j/${token}`, expiresAt });
  } catch (e: any) { return fail(res, 500, e.message); }
});

export default router;
