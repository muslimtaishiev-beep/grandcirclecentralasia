import admin from "firebase-admin";

/**
 * Касса организации: tenants/{t}/cash_entries — приходы и расходы, которые
 * вносят руками или пишет система (оплата абонемента, выплата зарплаты).
 * Зарплата попадает в расход только при статусе «Выплачено» и датой выплаты:
 * сумма на руки + удержанные налоги и взносы + взносы работодателя.
 * Аванс вносится отдельной строкой расхода, когда его выдают.
 */
type Db = FirebaseFirestore.Firestore;

export type CashKind = "in" | "out";
export type CashAccount = "cash" | "bank";
export interface CashEntry {
  id: string;
  kind: CashKind;
  amount: number;
  date: string;          // ГГГГ-ММ-ДД
  category: string;
  account: CashAccount;
  note: string;
  counterparty: string;
  source: "manual" | "subscription" | "payroll" | "admission";
  sourceId?: string;
  createdBy: string;
  createdAt: number;
  voided?: { at: number; by: string; reason: string };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const num = (v: unknown) => { const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : 0; };
const round2 = (n: number) => Math.round(n * 100) / 100;
const dayOf = (v: any): string => {
  const ms = typeof v === "number" ? v : v?.toMillis?.() ?? (v ? Date.parse(String(v)) : NaN);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : "";
};
export const isDay = (s: unknown): s is string => typeof s === "string" && DAY.test(s);

export const cashCol = (db: Db, t: string) => db.collection("tenants").doc(t).collection("cash_entries");

/** Системная запись кассы (оплата абонемента и т. п.) — внутри транзакции, если она есть. */
export function cashEntryDoc(e: Omit<CashEntry, "id" | "createdAt">): Omit<CashEntry, "id"> {
  return { ...e, amount: round2(Math.abs(num(e.amount))), createdAt: Date.now() };
}

export interface CashSummary {
  from: string; to: string; currency: string;
  opening: number; income: number; expense: number; closing: number;
  payrollPaid: number; payrollTaxes: number;
  rows: (CashEntry & { readonly?: boolean })[];
}

/**
 * Движения за период [from, to] и остаток на начало и конец.
 * Остаток на начало — все движения до from.
 */
export async function cashSummary(db: Db, t: string, from: string, to: string): Promise<CashSummary> {
  const [entries, payroll, settings, legacy] = await Promise.all([
    cashCol(db, t).get(),
    db.collection("tenants").doc(t).collection("payroll_records").where("status", "==", "paid").get(),
    db.collection("tenants").doc(t).collection("payroll_settings").doc("current").get(),
    db.collection("submissions").where("tenantId", "==", t).where("finalDecision", "==", "ПРИНЯТ").get().catch(() => null),
  ]);
  const rows: (CashEntry & { readonly?: boolean })[] = [];
  for (const d of entries.docs) {
    const e = d.data() as any;
    if (e.voided || !isDay(e.date)) continue;
    rows.push({ ...e, id: d.id });
  }
  let payrollPaid = 0, payrollTaxes = 0;
  for (const d of payroll.docs) {
    const r = d.data() as any;
    const date = isDay(r.paidDate) ? r.paidDate : dayOf(r.paidAt);
    if (!date) continue;
    const c = r.calc || {};
    const net = num(c.toPay);
    const taxes = num(c.sfEmployee) + num(c.incomeTax) + num(c.sfEmployer);
    rows.push({
      id: `payroll_${d.id}`, kind: "out", amount: round2(net + taxes), date, category: "Зарплата",
      account: r.paidAccount === "cash" ? "cash" : "bank", note: `${r.month} · на руки ${round2(net)}, налоги и взносы ${round2(taxes)}`,
      counterparty: String(r.fullName || ""), source: "payroll", sourceId: d.id, createdBy: "", createdAt: 0, readonly: true,
    });
    if (date >= from && date <= to) { payrollPaid += net; payrollTaxes += taxes; }
  }
  // Оплаты из старых анкет приёма (до кассы): только чтение.
  for (const d of legacy?.docs || []) {
    const r = d.data() as any;
    const amount = num(r.initialFee) + num(r.monthlyPaidSum || r.firstMonthPaymentAmount || r.firstMonthPayment);
    const date = dayOf(r.submittedAt || r.updatedAt || r.date);
    if (!amount || !date) continue;
    rows.push({
      id: `admission_${d.id}`, kind: "in", amount: round2(amount), date, category: "Оплата обучения",
      account: "bank", note: String(r.paymentInfo || ""), counterparty: String(r.childName || r.studentName || ""),
      source: "admission", sourceId: d.id, createdBy: "", createdAt: 0, readonly: true,
    });
  }
  const signed = (e: CashEntry) => (e.kind === "in" ? 1 : -1) * num(e.amount);
  const before = rows.filter(e => e.date < from);
  const inRange = rows.filter(e => e.date >= from && e.date <= to).sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
  const opening = round2(before.reduce((s, e) => s + signed(e), 0));
  const income = round2(inRange.filter(e => e.kind === "in").reduce((s, e) => s + num(e.amount), 0));
  const expense = round2(inRange.filter(e => e.kind === "out").reduce((s, e) => s + num(e.amount), 0));
  return {
    from, to, currency: String(settings.data()?.currency || "KGS"),
    opening, income, expense, closing: round2(opening + income - expense),
    payrollPaid: round2(payrollPaid), payrollTaxes: round2(payrollTaxes), rows: inRange,
  };
}
