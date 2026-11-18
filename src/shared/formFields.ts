/**
 * Поля форм заявок: общие правила для публичной формы и сервера.
 *
 * Сверх прежних типов (строка, текст, список, галочка, дата, число, файл):
 * - multi — несколько вариантов флажками, с пределом (maxSelect) и «Другое»;
 * - radio — один вариант кнопками;
 * - section — заголовок раздела (не поле, в заявку не попадает);
 * - hint — подпись под вопросом;
 * - showIf — поле видно, только если ответ на другое поле — один из вариантов
 *   (как «Перейти к разделу на основе ответа» в Google Forms). Скрытое поле не
 *   обязательно и в заявку не попадает.
 */
export type FormFieldType = "text" | "textarea" | "select" | "radio" | "multi" | "file" | "date" | "number" | "checkbox" | "section" | "email";

/** Адрес почты: на него уходят письма по шаблону формы. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface FormFieldDef {
  id: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  hint?: string;
  maxSelect?: number;
  allowOther?: boolean;
  showIf?: { field: string; in: string[] };
}

export const OTHER = "Другое";
export const CHOICE_TYPES: FormFieldType[] = ["select", "radio", "multi"];

/** Видно ли поле при этих ответах. Ссылка на неизвестное поле — видно всегда. */
export function fieldVisible(f: Pick<FormFieldDef, "showIf">, values: Record<string, unknown>): boolean {
  const c = f.showIf;
  if (!c || !c.field || !Array.isArray(c.in) || !c.in.length) return true;
  const v = values[c.field];
  if (Array.isArray(v)) return v.some(x => c.in.includes(String(x)));
  return c.in.includes(String(v ?? ""));
}

/** Видимые поля по порядку: ответ скрытого поля не открывает зависящие от него. */
export function visibleFields<F extends Pick<FormFieldDef, "id" | "showIf">>(fields: F[], values: Record<string, unknown>): F[] {
  const eff: Record<string, unknown> = {};
  return fields.filter(f => {
    if (!fieldVisible(f, eff)) return false;
    eff[f.id] = values[f.id];
    return true;
  });
}

/**
 * Ответ на «несколько вариантов»: только варианты поля (и «Другое: …», если
 * разрешено), без повторов, не больше maxSelect.
 */
export function cleanMulti(f: FormFieldDef, raw: unknown): { value: string[]; error?: string } {
  const opts = new Set((f.options || []).map(String));
  const seen = new Set<string>();
  const value: string[] = [];
  for (const x of Array.isArray(raw) ? raw : []) {
    let s = String(x ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 300);
    if (!s) continue;
    if (!opts.has(s)) {
      if (!f.allowOther || !(s === OTHER || s.startsWith(`${OTHER}:`))) continue;
      if (s === OTHER) continue; // «Другое» без текста — не ответ
    }
    if (seen.has(s)) continue;
    seen.add(s); value.push(s);
  }
  const max = Number(f.maxSelect) || 0;
  if (max > 0 && value.length > max) return { value, error: `«${f.label}»: выберите не больше ${max}` };
  return { value: value.slice(0, 30) };
}
