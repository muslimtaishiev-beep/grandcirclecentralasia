import { isPermissionKey, type PermissionKey } from "./permissions.js";

/**
 * Анкеты приёма — общий движок.
 *
 * Анкета — шаблон из блоков и пунктов. Кто её заполняет и кто видит целиком,
 * задаётся правами в самом шаблоне (fillPermission / viewPermission), а не в
 * коде: психологическая диагностика, собеседование с завучем или анкета
 * родителя — один механизм, меняется в настройках.
 *
 * Пункт может зависеть от класса ребёнка: виден не всем классам (grades),
 * подсказывает свои вопросы методики (prompts) и сверяет введённые цифры с
 * нормами своего класса (norms) — система предлагает оценку, человек решает.
 *
 * Ответ хранит снимок шаблона на момент заполнения: правка шаблона не меняет
 * смысл старых анкет.
 */

export type QKind = "text" | "longtext" | "date" | "number" | "phone" | "choice" | "multi" | "rating" | "note";
export type ScaleId = "norm4" | "emo4";
export type Level = "norm" | "mild" | "severe" | "na";

/** Шкалы бланка: «Соотв. норме / Отд. трудности / Выр. трудности / Н/О». */
export const SCALES: Record<ScaleId, { id: Level; label: string; short: string }[]> = {
  norm4: [
    { id: "norm", label: "Соответствует норме", short: "Норма" },
    { id: "mild", label: "Отдельные трудности", short: "Отд. трудности" },
    { id: "severe", label: "Выраженные трудности", short: "Выр. трудности" },
    { id: "na", label: "Не оценивалось", short: "Н/О" },
  ],
  emo4: [
    { id: "norm", label: "Не выявлено", short: "Не выявлено" },
    { id: "mild", label: "Отдельные трудности", short: "Отд. трудности" },
    { id: "severe", label: "Выраженные трудности", short: "Выр. трудности" },
    { id: "na", label: "Не оценивалось", short: "Н/О" },
  ],
};

export interface QOption { id: string; label: string }
export interface QPrompt { grades: number[]; text: string }
export interface QMeasure { id: string; label: string; suffix?: string }
/**
 * Норма для класса: метрика — значение измерения, сумма нескольких или их
 * доля в процентах. better: что лучше — больше (объём, воспроизведено) или
 * меньше (ошибки). norm — граница нормы, mild — граница «отдельных трудностей».
 */
export interface QNorm {
  grades: number[];
  metric: { measure: string } | { sum: string[] } | { ratio: [string, string] };
  better: "higher" | "lower";
  norm: number;
  mild: number;
  label?: string;
}
/** Связь пункта с карточкой поступающего: ответ заполняет пустое поле карточки. */
export type QBind = "child.name" | "child.birthDate" | "child.school" | "parent.name" | "parent.phone" | "parent.email";

export interface QItem {
  id: string;
  kind: QKind;
  label: string;
  hint?: string;
  required?: boolean;
  grades?: number[];
  options?: QOption[];
  scale?: ScaleId;
  /** Поле «результат, характер трудностей, необходимая помощь» / «наблюдения». */
  comment?: boolean;
  prompts?: QPrompt[];
  measures?: QMeasure[];
  norms?: QNorm[];
  /** Ответы родительской анкеты, которые показать рядом (id пунктов). */
  showParent?: string[];
  bind?: QBind;
  /** Материалы (id вложений шаблона), которые нужны для этого пункта. */
  materials?: string[];
}
export interface QSection { id: string; title: string; hint?: string; grades?: number[]; items: QItem[] }
export interface QOutcomeOption { id: string; label: string; description: string; allowsTest: boolean; tone: "good" | "warn" | "bad" }
/**
 * Материал методики: show — показать ребёнку (таблица образов, картинки);
 * sheet — ребёнок заполняет сам, печатается на каждого с QR и № поступающего.
 */
export interface QAttachment { id: string; name: string; url: string; kind: "show" | "sheet"; grades?: number[]; hint?: string }

export interface QTemplate {
  id: string;
  title: string;
  description: string;
  audience: "parent" | "staff";
  fillPermission: PermissionKey | null;
  viewPermission: PermissionKey | null;
  /** Данные о здоровье и развитии — закрыты для тех, у кого нет viewPermission. */
  sensitive: boolean;
  sections: QSection[];
  outcome: { label: string; options: QOutcomeOption[] } | null;
  attachments: QAttachment[];
  /** Текст согласия (для анкеты родителя). */
  consentText?: string;
  version: number;
  archived?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface QAnswer {
  value?: string | string[];
  rating?: Level;
  comment?: string;
  measures?: Record<string, number | null>;
}
export type QAnswers = Record<string, QAnswer>;

// ── Класс ребёнка ───────────────────────────────────────────────────────

/** «7», «7А», «7 класс» → 7; не номер класса → null. */
export function gradeOf(v: unknown): number | null {
  const m = String(v ?? "").match(/\d{1,2}/);
  const n = m ? Number(m[0]) : NaN;
  return n >= 0 && n <= 12 ? n : null;
}
const inGrades = (grades: number[] | undefined, g: number | null) => !grades?.length || g === null || grades.includes(g);
export const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export const sectionVisible = (s: QSection, g: number | null) => inGrades(s.grades, g);
export const itemVisible = (i: QItem, g: number | null) => inGrades(i.grades, g);
export function visibleSections(t: Pick<QTemplate, "sections">, g: number | null): QSection[] {
  return t.sections.filter(s => sectionVisible(s, g)).map(s => ({ ...s, items: s.items.filter(i => itemVisible(i, g)) })).filter(s => s.items.length);
}
/** Вопросы методики для класса: общие (без классов) + своей полосы. */
export const promptsFor = (i: QItem, g: number | null) => (i.prompts || []).filter(p => !p.grades.length || g === null || p.grades.includes(g));
export const normFor = (i: QItem, g: number | null) => (g === null ? undefined : (i.norms || []).find(n => n.grades.includes(g)));
export const attachmentsFor = (t: Pick<QTemplate, "attachments">, g: number | null) => t.attachments.filter(a => inGrades(a.grades, g));

// ── Нормы → подсказка оценки ────────────────────────────────────────────

export function metricValue(n: QNorm, m: Record<string, number | null> | undefined): number | null {
  const v = (id: string) => { const x = m?.[id]; return typeof x === "number" && Number.isFinite(x) ? x : null; };
  if ("measure" in n.metric) return v(n.metric.measure);
  if ("sum" in n.metric) { const xs = n.metric.sum.map(v); return xs.some(x => x === null) ? null : xs.reduce((a, b) => a + (b as number), 0); }
  const [a, b] = n.metric.ratio.map(v);
  return a === null || b === null || !b ? null : Math.round((a / b) * 1000) / 10;
}

/**
 * Подсказка оценки по нормам класса. null — норм для класса нет или цифры
 * не введены. Решает психолог: подсказка не ставится сама.
 */
export function suggestRating(i: QItem, g: number | null, m: Record<string, number | null> | undefined): { level: Level; value: number; norm: QNorm } | null {
  const n = normFor(i, g);
  if (!n) return null;
  const value = metricValue(n, m);
  if (value === null) return null;
  const ok = (bound: number) => (n.better === "higher" ? value >= bound : value <= bound);
  return { level: ok(n.norm) ? "norm" : ok(n.mild) ? "mild" : "severe", value, norm: n };
}
export function normText(n: QNorm): string {
  return n.label || (n.better === "higher" ? `норма от ${n.norm}` : `норма до ${n.norm}`);
}

// ── Итоги анкеты ────────────────────────────────────────────────────────

export const outcomeOf = (t: Pick<QTemplate, "outcome">, id: string | null | undefined) => t.outcome?.options.find(o => o.id === id) || null;

/** Сколько пунктов с трудностями — сводка для списка и карточки. */
export function ratingSummary(t: Pick<QTemplate, "sections">, a: QAnswers, g: number | null) {
  const out = { norm: 0, mild: 0, severe: 0, na: 0, empty: 0 };
  for (const s of visibleSections(t, g)) for (const i of s.items) {
    if (i.kind !== "rating") continue;
    const r = a[i.id]?.rating;
    if (r) out[r]++; else out.empty++;
  }
  return out;
}

/** Чего не хватает до сдачи: обязательные пункты, оценки, итог. */
export function missingFor(t: QTemplate, a: QAnswers, g: number | null, outcome: string | null): string[] {
  const miss: string[] = [];
  for (const s of visibleSections(t, g)) for (const i of s.items) {
    const x = a[i.id];
    if (i.kind === "rating" && !x?.rating) miss.push(i.label);
    else if (i.required && i.kind !== "note" && i.kind !== "rating") {
      const v = x?.value;
      if (Array.isArray(v) ? !v.length : !String(v ?? "").trim()) miss.push(i.label);
    }
  }
  if (t.outcome && !outcomeOf(t, outcome)) miss.push(t.outcome.label);
  return miss;
}

// ── Очистка ─────────────────────────────────────────────────────────────

const str = (v: unknown, max = 300) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim().slice(0, max);
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const id = (v: unknown, fallback: string) => (ID.test(String(v)) ? String(v) : fallback);
const KINDS: QKind[] = ["text", "longtext", "date", "number", "phone", "choice", "multi", "rating", "note"];
const grades = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 12))].sort((a, b) => a - b);
const num = (v: unknown, def = 0) => { const n = Number(v); return Number.isFinite(n) ? n : def; };
const BINDS: QBind[] = ["child.name", "child.birthDate", "child.school", "parent.name", "parent.phone", "parent.email"];

function sanitizeItem(r: any, k: number): QItem | null {
  const kind: QKind = KINDS.includes(r?.kind) ? r.kind : "text";
  const label = str(r?.label, 300);
  if (!label) return null;
  const item: QItem = { id: id(r?.id, `i${k + 1}`), kind, label };
  if (r?.hint) item.hint = str(r.hint, 1000);
  if (r?.required) item.required = true;
  const g = grades(r?.grades); if (g.length) item.grades = g;
  if (kind === "choice" || kind === "multi") {
    item.options = (Array.isArray(r?.options) ? r.options : []).slice(0, 30)
      .map((o: any, j: number) => ({ id: id(o?.id, `o${j + 1}`), label: str(o?.label, 200) })).filter((o: QOption) => o.label);
  }
  if (kind === "rating") {
    item.scale = r?.scale === "emo4" ? "emo4" : "norm4";
    item.comment = r?.comment !== false;
    item.measures = (Array.isArray(r?.measures) ? r.measures : []).slice(0, 6)
      .map((m: any, j: number) => ({ id: id(m?.id, `m${j + 1}`), label: str(m?.label, 80), ...(m?.suffix ? { suffix: str(m.suffix, 20) } : {}) })).filter((m: QMeasure) => m.label);
    const mids = new Set(item.measures.map(m => m.id));
    item.norms = (Array.isArray(r?.norms) ? r.norms : []).slice(0, 12).map((n: any): QNorm | null => {
      const metric = n?.metric?.ratio && mids.has(n.metric.ratio[0]) && mids.has(n.metric.ratio[1]) ? { ratio: [String(n.metric.ratio[0]), String(n.metric.ratio[1])] as [string, string] }
        : Array.isArray(n?.metric?.sum) && n.metric.sum.length && n.metric.sum.every((x: unknown) => mids.has(String(x))) ? { sum: n.metric.sum.map(String) }
        : mids.has(String(n?.metric?.measure)) ? { measure: String(n.metric.measure) } : null;
      const g2 = grades(n?.grades);
      if (!metric || !g2.length) return null;
      return { grades: g2, metric, better: n?.better === "lower" ? "lower" : "higher", norm: num(n?.norm), mild: num(n?.mild), ...(n?.label ? { label: str(n.label, 120) } : {}) };
    }).filter(Boolean) as QNorm[];
    if (!item.measures.length) delete item.measures;
    if (!item.norms.length) delete item.norms;
  } else if (r?.comment) item.comment = true;
  const prompts = (Array.isArray(r?.prompts) ? r.prompts : []).slice(0, 12)
    .map((p: any) => ({ grades: grades(p?.grades), text: str(p?.text, 3000) })).filter((p: QPrompt) => p.text);
  if (prompts.length) item.prompts = prompts;
  const sp = (Array.isArray(r?.showParent) ? r.showParent : []).map((x: unknown) => String(x)).filter((x: string) => ID.test(x)).slice(0, 20);
  if (sp.length) item.showParent = sp;
  if (BINDS.includes(r?.bind)) item.bind = r.bind;
  const mats = (Array.isArray(r?.materials) ? r.materials : []).map(String).filter((x: string) => ID.test(x)).slice(0, 6);
  if (mats.length) item.materials = mats;
  return item;
}

const ASSET_URL = /^(\/[A-Za-z0-9/_.-]{1,200}|https:\/\/[^\s"'<>]{1,500})$/;

export function sanitizeTemplate(raw: any, prev?: QTemplate): QTemplate {
  const perm = (v: unknown) => (isPermissionKey(v) ? v : null);
  const usedIds = new Set<string>();
  const uniq = (x: string) => { let v = x, n = 2; while (usedIds.has(v)) v = `${x}_${n++}`; usedIds.add(v); return v; };
  const sections = (Array.isArray(raw?.sections) ? raw.sections : []).slice(0, 30).map((s: any, k: number) => {
    const items = (Array.isArray(s?.items) ? s.items : []).slice(0, 60).map(sanitizeItem).filter(Boolean)
      .map((i: QItem) => ({ ...i, id: uniq(i.id) }));
    const g = grades(s?.grades);
    return { id: id(s?.id, `s${k + 1}`), title: str(s?.title, 200) || `Блок ${k + 1}`, ...(s?.hint ? { hint: str(s.hint, 1000) } : {}), ...(g.length ? { grades: g } : {}), items };
  }).filter((s: QSection) => s.items.length);
  const options = (Array.isArray(raw?.outcome?.options) ? raw.outcome.options : []).slice(0, 8).map((o: any, k: number) => ({
    id: id(o?.id, `r${k + 1}`), label: str(o?.label, 120), description: str(o?.description, 600),
    allowsTest: o?.allowsTest === true, tone: (["good", "warn", "bad"].includes(o?.tone) ? o.tone : "warn") as QOutcomeOption["tone"],
  })).filter((o: QOutcomeOption) => o.label);
  const attachments = (Array.isArray(raw?.attachments) ? raw.attachments : []).slice(0, 20).map((a: any, k: number) => ({
    id: id(a?.id, `a${k + 1}`), name: str(a?.name, 120), url: String(a?.url || ""),
    kind: (a?.kind === "sheet" ? "sheet" : "show") as QAttachment["kind"],
    ...(grades(a?.grades).length ? { grades: grades(a?.grades) } : {}), ...(a?.hint ? { hint: str(a.hint, 300) } : {}),
  })).filter((a: QAttachment) => a.name && ASSET_URL.test(a.url));
  const audience = raw?.audience === "parent" ? "parent" : "staff";
  return {
    id: prev?.id || id(raw?.id, "tpl"),
    title: str(raw?.title, 160) || "Анкета",
    description: str(raw?.description, 2000),
    audience,
    fillPermission: audience === "parent" ? null : perm(raw?.fillPermission),
    viewPermission: perm(raw?.viewPermission),
    sensitive: raw?.sensitive !== false,
    sections,
    outcome: audience === "staff" && options.length ? { label: str(raw?.outcome?.label, 120) || "Заключение", options } : null,
    attachments,
    ...(audience === "parent" ? { consentText: str(raw?.consentText, 2000) } : {}),
    version: (prev?.version || 0) + 1,
    ...(raw?.archived ? { archived: true } : {}),
    createdAt: prev?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
}

/** Ответы — только по пунктам шаблона и в их формате. */
export function sanitizeAnswers(t: QTemplate, raw: any): QAnswers {
  const out: QAnswers = {};
  const items = t.sections.flatMap(s => s.items);
  for (const i of items) {
    const r = raw?.[i.id];
    if (!r || typeof r !== "object") continue;
    const a: QAnswer = {};
    if (i.kind === "multi") {
      const ids = new Set((i.options || []).map(o => o.id));
      const v = (Array.isArray(r.value) ? r.value : []).map(String).filter((x: string) => ids.has(x));
      if (v.length) a.value = [...new Set<string>(v)];
    } else if (i.kind === "choice") {
      if ((i.options || []).some(o => o.id === r.value)) a.value = String(r.value);
    } else if (i.kind !== "rating" && i.kind !== "note") {
      const v = str(r.value, i.kind === "longtext" ? 4000 : 300);
      if (v) a.value = v;
    }
    if (i.kind === "rating" && ["norm", "mild", "severe", "na"].includes(r.rating)) a.rating = r.rating;
    if ((i.comment || i.kind === "rating") && r.comment) { const c = str(r.comment, 4000); if (c) a.comment = c; }
    if (i.measures?.length && r.measures && typeof r.measures === "object") {
      const m: Record<string, number | null> = {};
      for (const ms of i.measures) {
        const v = r.measures[ms.id];
        const n = v === null || v === "" || v === undefined ? null : Number(v);
        if (n !== null && Number.isFinite(n) && n >= 0 && n <= 100000) m[ms.id] = n;
      }
      if (Object.keys(m).length) a.measures = m;
    }
    if (Object.keys(a).length) out[i.id] = a;
  }
  return out;
}

/** Текст ответа для таблиц и печати. */
export function answerText(i: QItem, a: QAnswer | undefined): string {
  if (!a) return "";
  if (i.kind === "multi") return (Array.isArray(a.value) ? a.value : []).map(v => i.options?.find(o => o.id === v)?.label || v).join(", ");
  if (i.kind === "choice") return i.options?.find(o => o.id === a.value)?.label || "";
  if (i.kind === "rating") return SCALES[i.scale || "norm4"].find(s => s.id === a.rating)?.short || "";
  return String(a.value ?? "");
}
