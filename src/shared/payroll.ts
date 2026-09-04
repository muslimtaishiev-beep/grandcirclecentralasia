/**
 * Расчёт заработной платы по правилам Кыргызской Республики.
 *
 * Один чистый расчёт для сервера и клиента. Все ставки — параметры
 * организации: законодательство меняется, и цифры ниже — умолчания на
 * дату написания, которые бухгалтер обязан сверить:
 *  — подоходный налог 10 %;
 *  — взносы в Соцфонд с работника 10 % (Пенсионный фонд 8 % + ГНПФ 2 %);
 *  — взносы работодателя 17,25 % (ПФ 15 %, ФОМС 2 %, Фонд оздоровления 0,25 %);
 *  — вычеты из базы подоходного налога: 6,5 расчётного показателя (РП) на
 *    работника и 1 РП на каждого иждивенца; РП = 100 сом;
 *  — взносы работника в Соцфонд тоже уменьшают базу подоходного налога.
 * Для договора ГПХ по умолчанию удерживается только подоходный налог.
 */
export type ContractType = "employment" | "civil";
export type PayType = "monthly" | "hourly" | "per_lesson";
export type PayrollStatus = "draft" | "approved" | "paid";

export interface PayrollSettings {
  currency: string;
  /** Расчётный показатель, сом. */
  rp: number;
  personalDeductionRp: number;
  dependentDeductionRp: number;
  incomeTaxPct: number;
  sfEmployeePensionPct: number;
  sfEmployeeAccumPct: number;
  sfEmployerPensionPct: number;
  sfEmployerMedicalPct: number;
  sfEmployerHealthPct: number;
  /** ГПХ: удерживать ли взносы Соцфонда с исполнителя и платить ли за него работодателю. */
  civilSfEmployeePct: number;
  civilSfEmployerPct: number;
  /** День выплаты (1–31) — для ведомости. */
  payDay: number;
}

export const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  currency: "KGS",
  rp: 100,
  personalDeductionRp: 6.5,
  dependentDeductionRp: 1,
  incomeTaxPct: 10,
  sfEmployeePensionPct: 8,
  sfEmployeeAccumPct: 2,
  sfEmployerPensionPct: 15,
  sfEmployerMedicalPct: 2,
  sfEmployerHealthPct: 0.25,
  civilSfEmployeePct: 0,
  civilSfEmployerPct: 0,
  payDay: 10,
};

export interface EmployeeTerms {
  membershipId: string;
  fullName: string;
  position: string;
  contractType: ContractType;
  payType: PayType;
  /** Оклад в месяц, ставка за час или за занятие — по payType. */
  rate: number;
  dependents: number;
  /** ИНН сотрудника — для ведомости и отчётности. */
  inn?: string;
  active: boolean;
}

export interface PayrollInputs {
  /** Отработано: занятий / часов (для повременных и сдельных). */
  lessons: number;
  hours: number;
  /** Доплаты до налогообложения: премии, надбавки. */
  bonuses: number;
  /** Удержания после налогов: алименты, недостачи, займы. */
  otherDeductions: number;
  /** Уже выплаченный аванс. */
  advance: number;
  note?: string;
}

export interface PayrollCalc {
  gross: number;
  sfEmployee: number;
  sfEmployeePension: number;
  sfEmployeeAccum: number;
  deductionsBase: number;
  taxable: number;
  incomeTax: number;
  net: number;
  toPay: number;
  sfEmployer: number;
  sfEmployerPension: number;
  sfEmployerMedical: number;
  sfEmployerHealth: number;
  totalCost: number;
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const pct = (base: number, p: number) => r2(base * (Number(p) || 0) / 100);

export function resolvePayrollSettings(raw: unknown): PayrollSettings {
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<PayrollSettings>;
  const out: any = { ...DEFAULT_PAYROLL_SETTINGS };
  for (const k of Object.keys(DEFAULT_PAYROLL_SETTINGS) as (keyof PayrollSettings)[]) {
    const v = (c as any)[k];
    if (k === "currency") { if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 8); continue; }
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
  }
  return out as PayrollSettings;
}

export function grossFor(terms: EmployeeTerms, inputs: PayrollInputs): number {
  const rate = Number(terms.rate) || 0;
  const base = terms.payType === "monthly" ? rate
    : terms.payType === "hourly" ? rate * (Number(inputs.hours) || 0)
    : rate * (Number(inputs.lessons) || 0);
  return r2(base + (Number(inputs.bonuses) || 0));
}

export function calculatePayroll(terms: EmployeeTerms, inputs: PayrollInputs, settingsRaw: unknown): PayrollCalc {
  const s = resolvePayrollSettings(settingsRaw);
  const gross = grossFor(terms, inputs);
  const civil = terms.contractType === "civil";

  const sfEmployeePension = civil ? 0 : pct(gross, s.sfEmployeePensionPct);
  const sfEmployeeAccum = civil ? 0 : pct(gross, s.sfEmployeeAccumPct);
  const sfEmployee = civil ? pct(gross, s.civilSfEmployeePct) : r2(sfEmployeePension + sfEmployeeAccum);

  // Вычеты: только по трудовому договору и только если есть что вычитать.
  const deductionsBase = civil ? 0 : r2(s.rp * (s.personalDeductionRp + s.dependentDeductionRp * (Number(terms.dependents) || 0)));
  const taxable = Math.max(0, r2(gross - sfEmployee - deductionsBase));
  const incomeTax = pct(taxable, s.incomeTaxPct);

  const net = r2(gross - sfEmployee - incomeTax);
  const toPay = r2(net - (Number(inputs.otherDeductions) || 0) - (Number(inputs.advance) || 0));

  const sfEmployerPension = civil ? 0 : pct(gross, s.sfEmployerPensionPct);
  const sfEmployerMedical = civil ? 0 : pct(gross, s.sfEmployerMedicalPct);
  const sfEmployerHealth = civil ? 0 : pct(gross, s.sfEmployerHealthPct);
  const sfEmployer = civil ? pct(gross, s.civilSfEmployerPct) : r2(sfEmployerPension + sfEmployerMedical + sfEmployerHealth);

  return {
    gross, sfEmployee, sfEmployeePension, sfEmployeeAccum, deductionsBase, taxable, incomeTax, net, toPay,
    sfEmployer, sfEmployerPension, sfEmployerMedical, sfEmployerHealth, totalCost: r2(gross + sfEmployer),
  };
}

export const PAY_TYPE_LABEL: Record<PayType, string> = { monthly: "Оклад в месяц", hourly: "Почасовая", per_lesson: "За занятие" };
export const CONTRACT_LABEL: Record<ContractType, string> = { employment: "Трудовой договор", civil: "Договор ГПХ" };
export const STATUS_LABEL: Record<PayrollStatus, string> = { draft: "Черновик", approved: "Утверждено", paid: "Выплачено" };

/** Сумма прописью не нужна для ведомости; форматируем числа единообразно. */
export const money = (n: number, currency = "KGS") =>
  `${(Number(n) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
