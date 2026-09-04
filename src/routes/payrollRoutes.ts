import { Router } from "express";
import admin from "firebase-admin";
import { requireFirebaseAuth } from "./authRoutes.js";
import { hasAnyPermission } from "../server/access.js";
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

/** Право на зарплаты: edu:payroll или полный доступ. */
const requirePayroll = async (req: any, res: any, next: any) => {
  const tenantId = String(req.params.tenantId || "");
  if (req.user?.isSuperadmin === true || await hasAnyPermission(db(), req.user, tenantId, ["edu:payroll"])) return next();
  return res.status(403).json({ success: false, error: "Нужно право «Расчёт зарплат»" });
};
const guard = [requireFirebaseAuth, requireScreen("payroll", (req: any) => req.params.tenantId), requirePayroll];

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
    await col(req.params.tenantId, "payroll_settings").doc("current").set({ ...settings, updatedAt: ts(), updatedBy: req.user.email || req.user.uid });
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
  return out.sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));
}
router.get("/:tenantId/employees", ...guard, async (req: any, res: any) => {
  try { return res.json({ success: true, employees: await listEmployees(req.params.tenantId) }); }
  catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});
router.put("/:tenantId/employees/:membershipId", ...guard, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const id = req.params.membershipId;
    const mem = await db().collection("memberships").doc(id).get();
    if (!mem.exists || mem.data()?.tenantId !== t) return res.status(404).json({ success: false, error: "Сотрудник не найден в этой организации" });
    const b = req.body?.terms || {};
    const doc = {
      membershipId: id,
      fullName: str(b.fullName) || str(mem.data()?.displayName),
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
    return res.json({ success: true, terms: doc });
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
    const batch = db().batch(); let created = 0, refreshed = 0, skipped = 0;
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
    return res.json({ success: true, created, refreshed, skipped, records: snap.docs.map(d => d.data()) });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

router.put("/:tenantId/records/:id", ...guard, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const ref = col(t, "payroll_records").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "Запись не найдена" });
    const prev: any = snap.data();
    if (prev.status !== "draft") return res.status(409).json({ success: false, error: "Утверждённую запись не редактируют — верните её в черновик" });
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
    // Порядок: черновик → утверждено → выплачено; назад — только до черновика из «утверждено».
    const allowed: Record<string, string[]> = { draft: ["approved"], approved: ["paid", "draft"], paid: [] };
    if (!allowed[prev.status]?.includes(status)) return res.status(409).json({ success: false, error: `Из «${prev.status}» нельзя перейти в «${status}»` });
    const entry = { status, at: Date.now(), by: req.user.email || req.user.uid };
    await ref.update({ status, history: admin.firestore.FieldValue.arrayUnion(entry), updatedAt: Date.now(),
      ...(status === "paid" ? { paidAt: Date.now() } : {}) });
    return res.json({ success: true, status });
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

export default router;
