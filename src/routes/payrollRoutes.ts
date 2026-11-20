import { Router } from "express";
import admin from "firebase-admin";
import { requireFirebaseAuth } from "./authRoutes.js";
import { requirePerm, type StaffCaller } from "../server/access.js";
import { writeAudit, actorOf } from "../server/audit.js";
import { cashCol, cashEntryDoc, cashSummary, isDay, tenantToday } from "../server/cash.js";
import { requireScreen } from "../server/tenantAccess.js";
import {
  calculatePayroll, resolvePayrollSettings, DEFAULT_PAYROLL_SETTINGS,
  type EmployeeTerms, type PayrollInputs, type PayrollStatus,
} from "../shared/payroll.js";

/**
 * Зарплаты организации: все сотрудники, расчёт по правилам КР, ведомость.
 *
 * Прежний модуль считал только преподавателей, заводил записи от отметок
 * посещаемости, ставок задать было негде, налогов и взносов не знал.
 * Здесь источник правды — сервер: условия оплаты по каждому сотруднику,
 * настройки ставок организации, записи за месяц с полным расчётом и
 * историей статусов. Клиент ничего не считает сам.
 */
const router = Router();
const db = () => admin.firestore();
const col = (t: string, name: string) => db().collection("tenants").doc(t).collection(name);
const ts = () => admin.firestore.FieldValue.serverTimestamp();
const num = (v: unknown, max = 1e9) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0; };
const str = (v: unknown, max = 120) => String(v ?? "").trim().slice(0, max);
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Право на зарплаты: edu:payroll или полный доступ. Кладёт req.caller. */
const guard = [requireFirebaseAuth, requireScreen("payroll", (req: any) => req.params.tenantId), requirePerm(db, "edu:payroll")];

/**
 * Своё не трогают: условия оплаты, суммы и статусы своей записи меняет
 * другой сотрудник с этим правом. Владельцу и администратору можно.
 */
async function isSelf(c: StaffCaller, t: string, membershipId: string): Promise<boolean> {
  if (c.full || !membershipId || membershipId.startsWith("ext_")) return false;
  const m = await db().collection("memberships").doc(membershipId).get();
  return m.exists && m.data()?.tenantId === t && String(m.data()?.userId || "") === c.uid;
}
const SELF_DENIED = "Свою зарплату меняет другой сотрудник с правом на зарплаты";
const audit = (req: any, action: string, detail: string, target?: { kind: string; id: string; name?: string }, changes?: any[]) =>
  writeAudit(db(), req.params.tenantId, { actor: actorOf(req.user), action, section: "data", detail, target, changes });

async function loadSettings(t: string) {
  const snap = await col(t, "payroll_settings").doc("current").get();
  return resolvePayrollSettings(snap.exists ? snap.data() : {});
}

// ── Настройки расчёта ──
router.get("/:tenantId/settings", ...guard, async (req: any, res: any) => {
  try { return res.json({ success: true, settings: await loadSettings(req.params.tenantId), defaults: DEFAULT_PAYROLL_SETTINGS }); }
  catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});
router.put("/:tenantId/settings", ...guard, async (req: any, res: any) => {
  try {
    const settings = resolvePayrollSettings(req.body?.settings);
    const prev = await loadSettings(req.params.tenantId);
    await col(req.params.tenantId, "payroll_settings").doc("current").set({ ...settings, updatedAt: ts(), updatedBy: req.user.email || req.user.uid });
    const changes = Object.keys(settings).filter(k => String((prev as any)[k]) !== String((settings as any)[k])).map(k => ({ label: k, from: String((prev as any)[k]), to: String((settings as any)[k]) }));
    if (changes.length) await audit(req, "payroll.settings", "Ставки и вычеты зарплат", undefined, changes);
    return res.json({ success: true, settings });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

// ── Сотрудники и условия оплаты ──
async function listEmployees(t: string) {
  const [ms, terms] = await Promise.all([
    db().collection("memberships").where("tenantId", "==", t).where("status", "==", "active").get(),
    col(t, "payroll_employees").get(),
  ]);
  const byId = new Map(terms.docs.map(d => [d.id, d.data()]));
  const out: EmployeeTerms[] = [];
  for (const d of ms.docs) {
    const m = d.data();
    let email = m.email || "";
    if (!m.displayName && !email && m.userId) { try { email = (await admin.auth().getUser(m.userId)).email || ""; } catch { /* нет аккаунта */ } }
    const tdoc: any = byId.get(d.id) || {};
    out.push({
      membershipId: d.id,
      fullName: str(tdoc.fullName) || str(m.displayName) || email || d.id,
      position: str(tdoc.position) || str(m.role) || "",
      contractType: tdoc.contractType === "civil" ? "civil" : "employment",
      payType: ["monthly", "hourly", "per_lesson"].includes(tdoc.payType) ? tdoc.payType : "monthly",
      rate: num(tdoc.rate),
      dependents: num(tdoc.dependents, 20),
      inn: str(tdoc.inn, 20) || undefined,
      active: tdoc.active !== false && tdoc.rate !== undefined,
    });
  }
  // Сотрудники без входа в систему (сторож, исполнитель по ГПХ) — только для расчёта.
  for (const d of terms.docs) {
    const tdoc: any = d.data();
    if (!d.id.startsWith("ext_") || tdoc.archived) continue;
    out.push({
      membershipId: d.id, fullName: str(tdoc.fullName) || d.id, position: str(tdoc.position),
      contractType: tdoc.contractType === "civil" ? "civil" : "employment",
      payType: ["monthly", "hourly", "per_lesson"].includes(tdoc.payType) ? tdoc.payType : "monthly",
      rate: num(tdoc.rate), dependents: num(tdoc.dependents, 20), inn: str(tdoc.inn, 20) || undefined,
      active: tdoc.active !== false, external: true,
    });
  }
  return out.sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));
}
router.get("/:tenantId/employees", ...guard, async (req: any, res: any) => {
  try { return res.json({ success: true, employees: await listEmployees(req.params.tenantId) }); }
  catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});
router.put("/:tenantId/employees/:membershipId", ...guard, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const id = req.params.membershipId;
    const ext = id.startsWith("ext_");
    const mem = ext ? null : await db().collection("memberships").doc(id).get();
    const prevSnap = await col(t, "payroll_employees").doc(id).get();
    if (ext ? !prevSnap.exists : (!mem?.exists || mem.data()?.tenantId !== t)) return res.status(404).json({ success: false, error: "Сотрудник не найден в этой организации" });
    if (await isSelf(req.caller, t, id)) return res.status(403).json({ success: false, error: SELF_DENIED });
    const b = req.body?.terms || {};
    const prev: any = prevSnap.data() || {};
    const doc = {
      membershipId: id,
      fullName: str(b.fullName) || str(mem?.data()?.displayName) || str(prev.fullName),
      position: str(b.position, 80),
      contractType: b.contractType === "civil" ? "civil" : "employment",
      payType: ["monthly", "hourly", "per_lesson"].includes(b.payType) ? b.payType : "monthly",
      rate: num(b.rate),
      dependents: Math.round(num(b.dependents, 20)),
      inn: str(b.inn, 20),
      active: b.active !== false,
      updatedAt: ts(), updatedBy: req.user.email || req.user.uid,
    };
    await col(t, "payroll_employees").doc(id).set(doc, { merge: true });
    const keys: [keyof typeof doc, string][] = [["fullName", "ФИО"], ["position", "Должность"], ["contractType", "Договор"], ["payType", "Тип оплаты"], ["rate", "Ставка"], ["dependents", "Иждивенцы"], ["inn", "ИНН"], ["active", "В расчёте"]];
    const changes = keys.filter(([k]) => prev[k] !== undefined ? String(prev[k]) !== String(doc[k]) : !!doc[k]).map(([k, label]) => ({ label, from: String(prev[k] ?? ""), to: String(doc[k] ?? "") }));
    if (changes.length) {
      await col(t, "payroll_employees").doc(id).update({ changes: admin.firestore.FieldValue.arrayUnion({ at: Date.now(), by: req.caller.name, items: changes }) });
      await audit(req, "payroll.terms", `Условия оплаты: ${doc.fullName}`, { kind: "employee", id, name: doc.fullName }, changes);
    }
    return res.json({ success: true, terms: doc });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

/** Сотрудник только для расчёта — без учётной записи. */
router.post("/:tenantId/employees", ...guard, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const b = req.body?.terms || {};
    const fullName = str(b.fullName);
    if (!fullName) return res.status(400).json({ success: false, error: "Укажите ФИО" });
    const ref = col(t, "payroll_employees").doc(`ext_${db().collection("_").doc().id}`);
    const doc = {
      membershipId: ref.id, fullName, position: str(b.position, 80),
      contractType: b.contractType === "civil" ? "civil" : "employment",
      payType: ["monthly", "hourly", "per_lesson"].includes(b.payType) ? b.payType : "monthly",
      rate: num(b.rate), dependents: Math.round(num(b.dependents, 20)), inn: str(b.inn, 20),
      active: true, external: true, archived: false, createdAt: Date.now(), updatedAt: ts(), updatedBy: req.user.email || req.user.uid,
    };
    await ref.set(doc);
    await audit(req, "payroll.employee.add", `Добавлен в расчёт: ${fullName}`, { kind: "employee", id: ref.id, name: fullName });
    return res.json({ success: true, terms: doc });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});
/** Архив сотрудника без учётной записи и возврат из архива. */
router.post("/:tenantId/employees/:id/archive", ...guard, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const id = String(req.params.id);
    if (!id.startsWith("ext_")) return res.status(400).json({ success: false, error: "Сотрудника с учётной записью убирают в «Сотрудниках»" });
    const ref = col(t, "payroll_employees").doc(id); const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "Не найден" });
    const archived = req.body?.archived !== false;
    await ref.update({ archived, active: !archived, updatedAt: ts() });
    await audit(req, archived ? "payroll.employee.archive" : "payroll.employee.restore", `${archived ? "В архив" : "Из архива"}: ${snap.data()?.fullName}`, { kind: "employee", id });
    return res.json({ success: true });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});
router.get("/:tenantId/employees/archive", ...guard, async (req: any, res: any) => {
  try {
    const snap = await col(req.params.tenantId, "payroll_employees").where("archived", "==", true).get();
    return res.json({ success: true, employees: snap.docs.map(d => d.data()) });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

// ── Записи за месяц ──
const recId = (month: string, membershipId: string) => `${month}_${membershipId}`;

function buildRecord(t: string, month: string, terms: EmployeeTerms, inputs: PayrollInputs, settings: unknown, prev: any = {}) {
  const calc = calculatePayroll(terms, inputs, settings);
  return {
    id: recId(month, terms.membershipId), tenantId: t, month,
    membershipId: terms.membershipId, fullName: terms.fullName, position: terms.position,
    contractType: terms.contractType, payType: terms.payType, rate: terms.rate, dependents: terms.dependents, inn: terms.inn || "",
    inputs, calc, currency: resolvePayrollSettings(settings).currency,
    status: (prev.status as PayrollStatus) || "draft",
    history: Array.isArray(prev.history) ? prev.history : [],
    createdAt: prev.createdAt || Date.now(), updatedAt: Date.now(),
  };
}

/** Занятия из старого учёта посещаемости — если преподаватель был записан тем же id. */
async function legacyLessons(t: string, month: string, membershipId: string, userId: string): Promise<number> {
  for (const id of [membershipId, userId].filter(Boolean)) {
    const snap = await col(t, "edu_payroll").doc(`${id}_${month}`).get();
    if (snap.exists) return num(snap.data()?.totalLessonsConducted);
  }
  return 0;
}

router.get("/:tenantId/records", ...guard, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const month = str(req.query.month, 7);
    if (!MONTH.test(month)) return res.status(400).json({ success: false, error: "Месяц в формате ГГГГ-ММ" });
    const snap = await col(t, "payroll_records").where("month", "==", month).get();
    return res.json({ success: true, records: snap.docs.map(d => d.data()), settings: await loadSettings(t) });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

/** Сформировать/обновить черновики за месяц по всем активным сотрудникам с условиями. */
router.post("/:tenantId/run", ...guard, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const month = str(req.body?.month, 7);
    if (!MONTH.test(month)) return res.status(400).json({ success: false, error: "Месяц в формате ГГГГ-ММ" });
    const [settings, employees, existing] = await Promise.all([
      loadSettings(t), listEmployees(t), col(t, "payroll_records").where("month", "==", month).get(),
    ]);
    const prevById = new Map(existing.docs.map(d => [d.id, d.data()]));
    const memberships = await db().collection("memberships").where("tenantId", "==", t).get();
    const userByMem = new Map(memberships.docs.map(d => [d.id, String(d.data().userId || "")]));
    const batch = db().batch(); let created = 0, refreshed = 0, skipped = 0, removed = 0;
    const activeIds = new Set(employees.filter(e => e.active).map(e => recId(month, e.membershipId)));
    for (const [id, prev] of prevById) {
      if (!activeIds.has(id) && (prev as any).status === "draft") { batch.delete(col(t, "payroll_records").doc(id)); removed++; }
    }
    for (const e of employees) {
      if (!e.active) continue;
      const prev: any = prevById.get(recId(month, e.membershipId));
      if (prev && prev.status !== "draft") { skipped++; continue; }
      const inputs: PayrollInputs = prev?.inputs || {
        lessons: e.payType === "per_lesson" ? await legacyLessons(t, month, e.membershipId, userByMem.get(e.membershipId) || "") : 0,
        hours: 0, bonuses: 0, otherDeductions: 0, advance: 0, note: "",
      };
      batch.set(col(t, "payroll_records").doc(recId(month, e.membershipId)), buildRecord(t, month, e, inputs, settings, prev || {}));
      prev ? refreshed++ : created++;
    }
    await batch.commit();
    const snap = await col(t, "payroll_records").where("month", "==", month).get();
    return res.json({ success: true, created, refreshed, skipped, removed, records: snap.docs.map(d => d.data()) });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

router.put("/:tenantId/records/:id", ...guard, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const ref = col(t, "payroll_records").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "Запись не найдена" });
    const prev: any = snap.data();
    if (prev.status !== "draft") return res.status(409).json({ success: false, error: "Утверждённую запись не редактируют — верните её в черновик" });
    if (await isSelf(req.caller, t, prev.membershipId)) return res.status(403).json({ success: false, error: SELF_DENIED });
    const b = req.body?.inputs || {};
    const inputs: PayrollInputs = {
      lessons: num(b.lessons, 1000), hours: num(b.hours, 1000), bonuses: num(b.bonuses),
      otherDeductions: num(b.otherDeductions), advance: num(b.advance), note: str(b.note, 300),
    };
    const terms: EmployeeTerms = {
      membershipId: prev.membershipId, fullName: prev.fullName, position: prev.position, contractType: prev.contractType,
      payType: prev.payType, rate: prev.rate, dependents: prev.dependents, inn: prev.inn, active: true,
    };
    const rec = buildRecord(t, prev.month, terms, inputs, await loadSettings(t), prev);
    await ref.set(rec);
    const labels: Record<string, string> = { lessons: "Занятий", hours: "Часов", bonuses: "Премии", otherDeductions: "Удержания", advance: "Аванс", note: "Примечание" };
    const changes = Object.keys(labels).filter(k => String(prev.inputs?.[k] ?? "") !== String((inputs as any)[k] ?? "")).map(k => ({ label: labels[k], from: String(prev.inputs?.[k] ?? ""), to: String((inputs as any)[k] ?? "") }));
    if (changes.length) await audit(req, "payroll.record", `Ведомость ${prev.month}: ${prev.fullName}`, { kind: "payroll_record", id: prev.id, name: prev.fullName }, changes);
    return res.json({ success: true, record: rec });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

router.post("/:tenantId/records/:id/status", ...guard, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const ref = col(t, "payroll_records").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "Запись не найдена" });
    const status = String(req.body?.status || "");
    if (!["draft", "approved", "paid"].includes(status)) return res.status(400).json({ success: false, error: "Неизвестный статус" });
    const prev: any = snap.data();
    const c: StaffCaller = req.caller;
    if (await isSelf(c, t, prev.membershipId)) return res.status(403).json({ success: false, error: SELF_DENIED });
    // Порядок: черновик → утверждено → выплачено. Назад: из «утверждено» в
    // черновик; из «выплачено» — сторно с причиной, только владелец или администратор.
    const allowed: Record<string, string[]> = { draft: ["approved"], approved: ["paid", "draft"], paid: ["approved"] };
    if (!allowed[prev.status]?.includes(status)) return res.status(409).json({ success: false, error: `Из «${prev.status}» нельзя перейти в «${status}»` });
    const reason = str(req.body?.reason, 300);
    if (prev.status === "paid") {
      if (!c.full) return res.status(403).json({ success: false, error: "Отменить выплату может владелец или администратор" });
      if (!reason) return res.status(400).json({ success: false, error: "Укажите причину отмены выплаты" });
    }
    // Утвердивший сам не отмечает выплату: нужен второй человек (кроме владельца и администратора).
    const history: any[] = Array.isArray(prev.history) ? prev.history : [];
    const approvedBy = [...history].reverse().find(h => h.status === "approved")?.byUid;
    if (status === "paid" && !c.full && approvedBy && approvedBy === c.uid) return res.status(403).json({ success: false, error: "Выплату отмечает не тот, кто утвердил" });
    const paidDate = isDay(req.body?.paidDate) ? req.body.paidDate : await tenantToday(db(), t);
    const paidAccount = req.body?.paidAccount === "cash" ? "cash" : "bank";
    const entry = { status, at: Date.now(), by: req.user.email || req.user.uid, byUid: c.uid, ...(reason ? { reason } : {}), ...(status === "paid" ? { paidDate, paidAccount } : {}) };
    const del = admin.firestore.FieldValue.delete();
    await ref.update({ status, history: admin.firestore.FieldValue.arrayUnion(entry), updatedAt: Date.now(),
      ...(status === "paid" ? { paidAt: Date.now(), paidDate, paidAccount } : prev.status === "paid" ? { paidAt: del, paidDate: del, paidAccount: del } : {}) });
    await audit(req, `payroll.${status}`, `Ведомость ${prev.month}: ${prev.fullName} → ${status}${reason ? ` (${reason})` : ""}`, { kind: "payroll_record", id: prev.id, name: prev.fullName });
    return res.json({ success: true, status });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

/** Убрать черновик из ведомости. */
router.delete("/:tenantId/records/:id", ...guard, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const ref = col(t, "payroll_records").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "Запись не найдена" });
    const prev: any = snap.data();
    if (prev.status !== "draft") return res.status(409).json({ success: false, error: "Убрать можно только черновик" });
    if (await isSelf(req.caller, t, prev.membershipId)) return res.status(403).json({ success: false, error: SELF_DENIED });
    await ref.delete();
    await audit(req, "payroll.record.remove", `Убран из ведомости ${prev.month}: ${prev.fullName}`, { kind: "payroll_record", id: prev.id, name: prev.fullName });
    return res.json({ success: true });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

// ── Ведомость и сводка ──
router.get("/:tenantId/statement", ...guard, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const month = str(req.query.month, 7);
    if (!MONTH.test(month)) return res.status(400).json({ success: false, error: "Месяц в формате ГГГГ-ММ" });
    const [snap, tenant, settings] = await Promise.all([
      col(t, "payroll_records").where("month", "==", month).get(),
      db().collection("tenants").doc(t).get(), loadSettings(t),
    ]);
    const rows = snap.docs.map(d => d.data()).sort((a: any, b: any) => String(a.fullName).localeCompare(String(b.fullName), "ru"));
    const sum = (k: string) => Math.round(rows.reduce((s: number, r: any) => s + (Number(r.calc?.[k]) || 0), 0) * 100) / 100;
    const totals = {
      gross: sum("gross"), sfEmployee: sum("sfEmployee"), sfEmployeePension: sum("sfEmployeePension"), sfEmployeeAccum: sum("sfEmployeeAccum"),
      incomeTax: sum("incomeTax"), net: sum("net"), toPay: sum("toPay"),
      sfEmployer: sum("sfEmployer"), sfEmployerPension: sum("sfEmployerPension"), sfEmployerMedical: sum("sfEmployerMedical"), sfEmployerHealth: sum("sfEmployerHealth"),
      totalCost: sum("totalCost"),
      advance: Math.round(rows.reduce((s: number, r: any) => s + (Number(r.inputs?.advance) || 0), 0) * 100) / 100,
      otherDeductions: Math.round(rows.reduce((s: number, r: any) => s + (Number(r.inputs?.otherDeductions) || 0), 0) * 100) / 100,
    };
    const td: any = tenant.data() || {};
    const org = { name: td.name || t, legal: td.legal || null };
    if (String(req.query.format) === "csv") {
      const head = ["№", "ФИО", "Должность", "Договор", "ИНН", "Начислено", "Взносы работника (ПФ+ГНПФ)", "Подоходный налог", "Удержания", "Аванс", "К выплате", "Взносы работодателя", "Статус"];
      const lines = rows.map((r: any, i: number) => [i + 1, r.fullName, r.position, r.contractType === "civil" ? "ГПХ" : "Трудовой", r.inn || "",
        r.calc.gross, r.calc.sfEmployee, r.calc.incomeTax, r.inputs.otherDeductions, r.inputs.advance, r.calc.toPay, r.calc.sfEmployer, r.status]);
      lines.push(["", "ИТОГО", "", "", "", totals.gross, totals.sfEmployee, totals.incomeTax, totals.otherDeductions, totals.advance, totals.toPay, totals.sfEmployer, ""]);
      const csv = "﻿" + [head, ...lines].map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="vedomost-${month}.csv"`);
      return res.send(csv);
    }
    return res.json({ success: true, month, org, settings, rows, totals });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

// ── Касса ──
// Смотреть — «Финансовая сводка» или зарплаты; вносить — то же право,
// записи только дописываются и отменяются с причиной (не удаляются).
const cashGuard = [requireFirebaseAuth, requirePerm(db, "finance:view", "edu:payroll")];
const monthBounds = (m: string) => {
  const [y, mm] = m.split("-").map(Number);
  const last = new Date(Date.UTC(y, mm, 0)).getUTCDate();
  return { from: `${m}-01`, to: `${m}-${String(last).padStart(2, "0")}` };
};
router.get("/:tenantId/cash", ...cashGuard, async (req: any, res: any) => {
  try {
    const month = str(req.query.month, 7);
    let from = str(req.query.from, 10), to = str(req.query.to, 10);
    if (MONTH.test(month)) ({ from, to } = monthBounds(month));
    if (!isDay(from) || !isDay(to) || from > to) return res.status(400).json({ success: false, error: "Укажите период" });
    return res.json({ success: true, ...(await cashSummary(db(), req.params.tenantId, from, to)) });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});
router.post("/:tenantId/cash", ...cashGuard, async (req: any, res: any) => {
  try {
    const b = req.body || {};
    const amount = num(b.amount);
    if (!(amount > 0)) return res.status(400).json({ success: false, error: "Сумма больше нуля" });
    if (!isDay(b.date)) return res.status(400).json({ success: false, error: "Укажите дату" });
    const category = str(b.category, 80);
    if (!category) return res.status(400).json({ success: false, error: "Укажите статью" });
    const e = cashEntryDoc({
      kind: b.kind === "out" ? "out" : "in", amount, date: b.date, category,
      account: b.account === "cash" ? "cash" : "bank", note: str(b.note, 300), counterparty: str(b.counterparty, 120),
      source: "manual", createdBy: req.caller.name,
    });
    const ref = await cashCol(db(), req.params.tenantId).add(e);
    await audit(req, "cash.add", `${e.kind === "in" ? "Приход" : "Расход"} ${e.amount}: ${category}`, { kind: "cash", id: ref.id });
    return res.json({ success: true, entry: { ...e, id: ref.id } });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});
router.post("/:tenantId/cash/:id/void", ...cashGuard, async (req: any, res: any) => {
  try {
    const reason = str(req.body?.reason, 300);
    if (!reason) return res.status(400).json({ success: false, error: "Укажите причину" });
    const ref = cashCol(db(), req.params.tenantId).doc(req.params.id); const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "Запись не найдена" });
    if (snap.data()?.voided) return res.status(409).json({ success: false, error: "Уже отменена" });
    await ref.update({ voided: { at: Date.now(), by: req.caller.name, reason } });
    await audit(req, "cash.void", `Отменена запись кассы ${snap.data()?.amount}: ${reason}`, { kind: "cash", id: ref.id });
    return res.json({ success: true });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});
router.get("/:tenantId/categories", ...cashGuard, async (req: any, res: any) => {
  try {
    const snap = await col(req.params.tenantId, "payroll_settings").doc("cash").get();
    const d: any = snap.data() || {};
    const list = (v: any) => (Array.isArray(v) ? v.map((x: any) => str(x, 80)).filter(Boolean) : []);
    return res.json({ success: true, in: list(d.in), out: list(d.out) });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});
router.put("/:tenantId/categories", ...cashGuard, async (req: any, res: any) => {
  try {
    const list = (v: any) => [...new Set((Array.isArray(v) ? v : []).map((x: any) => str(x, 80)).filter(Boolean))].slice(0, 60);
    const doc = { in: list(req.body?.in), out: list(req.body?.out), updatedAt: ts() };
    await col(req.params.tenantId, "payroll_settings").doc("cash").set(doc);
    return res.json({ success: true, in: doc.in, out: doc.out });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

export default router;
