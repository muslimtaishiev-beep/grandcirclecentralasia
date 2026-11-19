/**
 * Условия «показывать, если…» — общий движок для всего продукта.
 *
 * Условие — дерево: группа «все (И)» или «любое (ИЛИ)» из строк «поле ·
 * оператор · значение» и вложенных групп (один уровень). Какие поля есть,
 * решает место, где условие живёт (анкета, форма, письмо…): оно отдаёт
 * каталог CondField[] и функцию чтения значения. Движок и окно — одни.
 *
 * Значение UNKNOWN («ещё неизвестно» — класс не указан, бланк печатается
 * пустым) условие не скрывает: строка считается выполненной.
 */

export type CondOp = "eq" | "neq" | "in" | "nin" | "has" | "nhas" | "contains" | "filled" | "empty" | "gt" | "gte" | "lt" | "lte";
export interface Cond { field: string; op: CondOp; value?: string | string[] }
export interface CondGroup { mode: "all" | "any"; items: CondNode[] }
export type CondNode = Cond | CondGroup;
export type When = CondGroup;

export type CondKind = "grade" | "choice" | "multi" | "rating" | "text" | "number" | "date";
export interface CondField { id: string; label: string; kind: CondKind; options?: { id: string; label: string }[]; group?: string }

export const UNKNOWN: unique symbol = Symbol("unknown");
export type CondValue = string | string[] | number | null | undefined | typeof UNKNOWN;

/** Классы, которые понимает система, — одни для всех организаций. */
export const SCHOOL_GRADES = Array.from({ length: 13 }, (_, i) => i);

export const isGroup = (n: CondNode): n is CondGroup => !!n && typeof n === "object" && "items" in n;

/** Какие операторы у поля — и как они подписаны в окне. */
export const OPS: Record<CondKind, CondOp[]> = {
  grade: ["in", "nin"],
  choice: ["eq", "neq", "in", "filled", "empty"],
  rating: ["eq", "neq", "in", "filled", "empty"],
  multi: ["has", "nhas", "filled", "empty"],
  text: ["filled", "empty", "contains"],
  number: ["eq", "gt", "gte", "lt", "lte", "filled", "empty"],
  date: ["eq", "gt", "gte", "lt", "lte", "filled", "empty"],
};
export const OP_LABEL: Record<CondOp, string> = {
  eq: "=", neq: "≠", in: "один из", nin: "не из", has: "отмечено", nhas: "не отмечено",
  contains: "содержит", filled: "заполнено", empty: "не заполнено", gt: ">", gte: "≥", lt: "<", lte: "≤",
};
/** Оператор без значения. */
export const NO_VALUE = (op: CondOp) => op === "filled" || op === "empty";
/** Оператор со списком значений. */
export const LIST_VALUE = (op: CondOp) => op === "in" || op === "nin" || op === "has" || op === "nhas";

// ── Вычисление ──────────────────────────────────────────────────────────

const isEmpty = (v: CondValue) => v === null || v === undefined || (Array.isArray(v) ? !v.length : !String(v).trim());
const asList = (v: CondValue): string[] => (Array.isArray(v) ? v.map(String) : isEmpty(v) ? [] : [String(v)]);
const cmp = (a: CondValue, b: string): number | null => {
  if (isEmpty(a) || !String(b).trim()) return null;
  const x = Number(a), y = Number(b);
  if (Number.isFinite(x) && Number.isFinite(y)) return x - y;
  const s = String(a), t = String(b);
  return s < t ? -1 : s > t ? 1 : 0; // даты ГГГГ-ММ-ДД сравниваются как строки
};

/** Равно: число — как число («5» = «5.0»), остальное — дословно. */
const eq = (v: CondValue, want: string) => (Array.isArray(v) ? v.length === 1 && v[0] === want : !isEmpty(v) && cmp(v, want) === 0);

function evalCond(c: Cond, get: (field: string) => CondValue): boolean {
  const v = get(c.field);
  if (v === UNKNOWN) return true;
  const want = asList(c.value as CondValue);
  switch (c.op) {
    case "filled": return !isEmpty(v);
    case "empty": return isEmpty(v);
    case "eq": return eq(v, String(c.value ?? ""));
    case "neq": return !eq(v, String(c.value ?? ""));
    case "in": return asList(v).some(x => want.includes(x));
    case "nin": return !asList(v).some(x => want.includes(x));
    case "has": return asList(v).some(x => want.includes(x));
    case "nhas": return !asList(v).some(x => want.includes(x));
    case "contains": return !isEmpty(v) && String(Array.isArray(v) ? v.join(" ") : v).toLowerCase().includes(String(c.value ?? "").toLowerCase().trim());
    case "gt": { const d = cmp(v, String(c.value ?? "")); return d !== null && d > 0; }
    case "gte": { const d = cmp(v, String(c.value ?? "")); return d !== null && d >= 0; }
    case "lt": { const d = cmp(v, String(c.value ?? "")); return d !== null && d < 0; }
    case "lte": { const d = cmp(v, String(c.value ?? "")); return d !== null && d <= 0; }
    default: return true;
  }
}

/** Выполнено ли условие. Пустое условие — всегда да. */
export function evalWhen(w: When | undefined | null, get: (field: string) => CondValue): boolean {
  if (!w || !w.items?.length) return true;
  const one = (n: CondNode): boolean => (isGroup(n) ? evalWhen(n, get) : evalCond(n, get));
  return w.mode === "any" ? w.items.some(one) : w.items.every(one);
}

/** Сколько строк в условии (для счётчика на кнопке). */
export const countConds = (w: When | undefined | null): number => (w?.items || []).reduce((n, x) => n + (isGroup(x) ? countConds(x) : 1), 0);

/** Поля, на которые ссылается условие. */
export const condFields = (w: When | undefined | null): string[] => (w?.items || []).flatMap(x => (isGroup(x) ? condFields(x) : [x.field]));

// ── Очистка (сервер) ────────────────────────────────────────────────────

const MAX_CONDS = 20;
const clip = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

/**
 * Только известные поля, допустимые для них операторы и существующие
 * варианты; не больше двух уровней и 20 строк. Пустое — undefined.
 */
export function sanitizeWhen(raw: any, fields: CondField[]): When | undefined {
  const byId = new Map(fields.map(f => [f.id, f]));
  let left = MAX_CONDS;
  const cond = (r: any): Cond | null => {
    const f = byId.get(String(r?.field ?? ""));
    if (!f || left <= 0) return null;
    const op = OPS[f.kind].includes(r?.op) ? (r.op as CondOp) : null;
    if (!op) return null;
    if (NO_VALUE(op)) { left--; return { field: f.id, op }; }
    let value: string | string[];
    if (LIST_VALUE(op)) {
      const ok = f.kind === "grade" ? (x: string) => /^\d{1,2}$/.test(x) && Number(x) <= 12 : f.options ? (x: string) => f.options!.some(o => o.id === x) : () => true;
      value = [...new Set((Array.isArray(r?.value) ? r.value : [r?.value]).map((x: unknown) => clip(x, 60)).filter(ok))].slice(0, 40) as string[];
      if (!value.length) return null;
    } else {
      value = clip(Array.isArray(r?.value) ? r.value[0] : r?.value, 200);
      if (!value) return null;
      if (f.options && (op === "eq" || op === "neq") && !f.options.some(o => o.id === value)) return null;
      if (f.kind === "number" && !Number.isFinite(Number(value))) return null;
      if (f.kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    }
    left--;
    return { field: f.id, op, value };
  };
  const group = (r: any, depth: number): CondGroup | null => {
    const items = (Array.isArray(r?.items) ? r.items : []).slice(0, MAX_CONDS).map((x: any) => (x && typeof x === "object" && "items" in x ? (depth < 1 ? group(x, depth + 1) : null) : cond(x))).filter(Boolean) as CondNode[];
    return items.length ? { mode: r?.mode === "any" ? "any" : "all", items } : null;
  };
  return group(raw, 0) || undefined;
}

// ── Текст условия ───────────────────────────────────────────────────────

const fmtGrades = (xs: string[]) => {
  const g = [...new Set(xs.map(Number))].sort((a, b) => a - b);
  const out: string[] = []; let s = g[0], p = g[0];
  for (const x of [...g.slice(1), NaN]) { if (x === p + 1) { p = x; continue; } out.push(s === p ? `${s}` : `${s}–${p}`); s = p = x; }
  return out.join(", ");
};

/** «1–3 класс и „Детский сад“ = Да» — для печати и подписи на кнопке. */
export function describeWhen(w: When | undefined | null, fields: CondField[]): string {
  if (!w?.items?.length) return "";
  const byId = new Map(fields.map(f => [f.id, f]));
  const one = (n: CondNode): string => {
    if (isGroup(n)) { const t = describeWhen(n, fields); return n.items.length > 1 ? `(${t})` : t; }
    const f = byId.get(n.field);
    if (!f) return "?";
    const vals = asList(n.value as CondValue);
    if (f.kind === "grade") return `${n.op === "nin" ? "не " : ""}${fmtGrades(vals)} класс`;
    const lbl = (x: string) => f.options?.find(o => o.id === x)?.label || x;
    const v = vals.map(lbl).join(" / ");
    return NO_VALUE(n.op) ? `«${f.label}» ${OP_LABEL[n.op]}` : `«${f.label}» ${OP_LABEL[n.op]} ${n.op === "contains" ? `«${v}»` : v}`;
  };
  return w.items.map(one).join(w.mode === "any" ? " или " : " и ");
}
