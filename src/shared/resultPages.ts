/**
 * Страницы результатов: поступающий открывает ссылку и видит результаты по
 * шагам — заставка, видео, письмо с решением. Для каждого исхода (решения из
 * анкеты кандидата) своя версия страницы.
 *
 * Модель общая для сервера (очистка, подстановки) и для браузера (редактор и
 * показ). Текст простой: пустая строка — новый абзац, **так** — жирный; HTML не
 * хранится и не принимается. Переменные {{…}} подставляет сервер при выдаче.
 */
import { fillVars } from "./emailTemplate.js";

export type Frame = "card" | "full" | "vintage";
export type FontKind = "serif" | "sans";

/** Картинка или видео: ссылка (https или файл сайта) либо загрузка в хранилище организации. */
export interface MediaRef {
  source: "url" | "upload";
  /** url — адрес; upload — подписанная ссылка на чтение (ставит сервер при выдаче, не хранится). */
  url: string;
  /** Только upload: result_media/{организация}/{файл}. */
  path?: string;
  name?: string;
}

export interface Theme {
  frame: Frame;
  confetti: boolean;
  accent: string;
  background: string;
  font: FontKind;
  /** Печать — логотип организации. */
  seal: boolean;
  /** Строка над письмом: «Приёмная комиссия». */
  header: string;
}

export interface SplashStep { id: string; type: "splash"; title: string; subtitle: string; buttonText: string }
export interface VideoStep { id: string; type: "video"; media: MediaRef; skippable: boolean; caption: string }
export interface LetterStep { id: string; type: "letter"; blocks: Block[] }
export type Step = SplashStep | VideoStep | LetterStep;

export interface HeadingBlock { id: string; type: "heading"; text: string }
export interface TextBlock { id: string; type: "text"; text: string }
export interface ResultsBlock { id: string; type: "results"; title: string }
export interface FeedbackBlock { id: string; type: "feedback"; title: string }
export interface TrialBlock { id: string; type: "trial"; title: string }
export interface SignatureBlock { id: string; type: "signature"; name: string; role: string; image: MediaRef | null }
export interface ImageBlock { id: string; type: "image"; media: MediaRef; alt: string }
export interface ButtonBlock { id: string; type: "button"; text: string; url: string }
export interface DividerBlock { id: string; type: "divider" }
export type Block = HeadingBlock | TextBlock | ResultsBlock | FeedbackBlock | TrialBlock | SignatureBlock | ImageBlock | ButtonBlock | DividerBlock;
export type BlockType = Block["type"];

export const BLOCK_TYPES: { type: BlockType; label: string }[] = [
  { type: "heading", label: "Заголовок" },
  { type: "text", label: "Текст" },
  { type: "results", label: "Результаты по предметам" },
  { type: "feedback", label: "Обратная связь" },
  { type: "trial", label: "Пробный период" },
  { type: "signature", label: "Подпись" },
  { type: "image", label: "Картинка" },
  { type: "button", label: "Кнопка" },
  { type: "divider", label: "Разделитель" },
];

export interface Variant { theme: Theme; steps: Step[] }

/** Ключ варианта: id решения из анкеты кандидата или «default». */
export type VariantKey = string;
export interface ResultPage {
  id: string;
  name: string;
  variants: Record<VariantKey, Variant>;
  updatedAt: number;
  updatedBy: string;
}

export const DEFAULT_VARIANT_KEY = "default";

/** Данные для блоков results / feedback / trial — из работы и анкеты кандидата. */
export interface ResultData {
  child: string;
  examTitle: string;
  subjects: { title: string; percent: number; level: string }[];
  feedback: string;
  trial: { from: string; to: string; klass: string } | null;
}

/** Что отдаёт ссылка /a/:token, когда страница включена: вариант уже с подставленными переменными. */
export interface ResultPageView { pageId: string; pageName: string; outcomeId: string; variant: Variant; data: ResultData }

// ── Переменные ──────────────────────────────────────────────────────────

export interface ResultVar { key: string; label: string; sample: string }
export const RESULT_VARS: ResultVar[] = [
  { key: "ребёнок", label: "Ребёнок", sample: "Асанов Тимур" },
  { key: "класс", label: "Класс поступления", sample: "5" },
  { key: "решение", label: "Решение", sample: "Принят" },
  { key: "организация", label: "Организация", sample: "Ваша организация" },
  { key: "дата", label: "Дата", sample: "21 ноября 2026 г." },
  { key: "обратная_связь", label: "Обратная связь", sample: "Сильные стороны: логика, внимательность. Зона роста: скорость чтения." },
  { key: "пробный_с", label: "Пробный период с", sample: "01.09.2026" },
  { key: "пробный_по", label: "Пробный период по", sample: "30.11.2026" },
  { key: "класс_зачисления", label: "Класс зачисления", sample: "5" },
];

/** Примерные значения для предпросмотра в редакторе. */
export const resultSampleVars = (): Record<string, string> => Object.fromEntries(RESULT_VARS.map(v => [v.key, v.sample]));

export const SAMPLE_RESULT_DATA: ResultData = {
  child: "Асанов Тимур",
  examTitle: "Вступительный экзамен",
  subjects: [
    { title: "Математика", percent: 86, level: "Высокий" },
    { title: "Русский язык", percent: 72, level: "Средний" },
    { title: "Английский язык", percent: 64, level: "Средний" },
  ],
  feedback: "Сильные стороны: логика, внимательность. Зона роста: скорость чтения.",
  trial: { from: "01.09.2026", to: "30.11.2026", klass: "5" },
};

// ── Очистка ─────────────────────────────────────────────────────────────

const LIMITS = { variants: 8, steps: 4, blocks: 40 };
const str = (v: unknown, max: number) => String(v ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, max);
const line = (v: unknown, max: number) => str(v, max).replace(/\n/g, " ").trim();
const HEX = /^#[0-9a-fA-F]{6}$/;
const color = (v: unknown, def: string) => (HEX.test(String(v ?? "")) ? String(v) : def);
const bool = (v: unknown, def: boolean) => (typeof v === "boolean" ? v : def);
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const UPLOAD = /^result_media\/([A-Za-z0-9_-]{2,80})\/[A-Za-z0-9_-]{16,40}\.(mp4|webm|jpg|png)$/;
/** Свой путь сайта (например /acceptance.mp4) — без https. */
const SITE_PATH = /^\/(?!\/)[A-Za-z0-9_\-./]{1,200}$/;

export const emptyMedia = (): MediaRef => ({ source: "url", url: "" });

/** Медиа: https-ссылка, файл сайта или загрузка этой организации (tenantId не задан — любая). */
export function cleanMedia(raw: unknown, tenantId?: string): MediaRef {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (r.source === "upload") {
    const path = line(r.path, 200);
    const m = path.match(UPLOAD);
    if (m && (!tenantId || m[1] === tenantId) && !path.includes("..")) return { source: "upload", url: "", path, name: line(r.name, 120) };
    return emptyMedia();
  }
  const url = line(r.url, 600);
  const ok = /^https:\/\/[^\s"'<>]+$/.test(url) || (SITE_PATH.test(url) && !url.includes(".."));
  return ok ? { source: "url", url } : emptyMedia();
}

/** Ссылка кнопки: https-адрес или подстановка {{…}}. */
export function cleanButtonUrl(v: unknown): string {
  const s = line(v, 600);
  if (/^\{\{[^{}]{1,30}\}\}$/.test(s)) return s;
  return /^https:\/\/[^\s"'<>]+$/.test(s) ? s : "";
}

export const newId = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const DEFAULT_THEME: Theme = { frame: "card", confetti: false, accent: "#4f46e5", background: "#f1f5f9", font: "serif", seal: true, header: "" };

function cleanTheme(raw: unknown): Theme {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    frame: r.frame === "full" || r.frame === "vintage" ? r.frame : "card",
    confetti: bool(r.confetti, DEFAULT_THEME.confetti),
    accent: color(r.accent, DEFAULT_THEME.accent),
    background: color(r.background, DEFAULT_THEME.background),
    font: r.font === "sans" ? "sans" : "serif",
    seal: bool(r.seal, DEFAULT_THEME.seal),
    header: line(r.header, 120),
  };
}

function cleanBlock(raw: unknown, i: number, tenantId?: string): Block | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const id = ID.test(String(r.id ?? "")) ? String(r.id) : `b${i}${newId().slice(0, 4)}`;
  switch (r.type) {
    case "heading": return { id, type: "heading", text: line(r.text, 200) };
    case "text": return { id, type: "text", text: str(r.text, 5000).trim() };
    case "results": return { id, type: "results", title: line(r.title, 80) };
    case "feedback": return { id, type: "feedback", title: line(r.title, 80) };
    case "trial": return { id, type: "trial", title: line(r.title, 80) };
    case "signature": {
      const img = r.image ? cleanMedia(r.image, tenantId) : null;
      return { id, type: "signature", name: line(r.name, 120), role: line(r.role, 120), image: img && img.url + (img.path || "") ? img : null };
    }
    case "image": return { id, type: "image", media: cleanMedia(r.media, tenantId), alt: line(r.alt, 200) };
    case "button": return { id, type: "button", text: line(r.text, 60), url: cleanButtonUrl(r.url) };
    case "divider": return { id, type: "divider" };
    default: return null;
  }
}

function cleanVariant(raw: unknown, tenantId?: string): Variant {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  // Письмо ищем среди всех шагов: оно всегда занимает последнее место из четырёх.
  const all: any[] = Array.isArray(r.steps) ? r.steps : [];
  const src = [...all.filter(s => s?.type !== "letter").slice(0, LIMITS.steps - 1), ...all.filter(s => s?.type === "letter").slice(0, 1)];
  const steps: Step[] = [];
  let letter: LetterStep | null = null;
  src.forEach((s: any, i: number) => {
    const id = ID.test(String(s?.id ?? "")) ? String(s.id) : `s${i}${newId().slice(0, 4)}`;
    if (s?.type === "splash") steps.push({ id, type: "splash", title: line(s.title, 120), subtitle: line(s.subtitle, 200), buttonText: line(s.buttonText, 40) || "Открыть" });
    else if (s?.type === "video") steps.push({ id, type: "video", media: cleanMedia(s.media, tenantId), skippable: bool(s.skippable, true), caption: line(s.caption, 200) });
    else if (s?.type === "letter" && !letter) {
      const blocks = (Array.isArray(s.blocks) ? s.blocks : []).slice(0, LIMITS.blocks).map((b: unknown, j: number) => cleanBlock(b, j, tenantId)).filter((b: Block | null): b is Block => !!b);
      letter = { id, type: "letter", blocks };
    }
  });
  // Письмо — единственное и всегда последнее; без него страница пуста.
  if (!letter) letter = { id: `s_letter${newId().slice(0, 4)}`, type: "letter", blocks: [] };
  return { theme: cleanTheme(r.theme), steps: [...steps, letter] };
}

/**
 * Белый список полей и лимиты: 8 вариантов, 4 шага, 40 блоков. Варианты — только
 * для исходов организации и «default». Ссылки — https или свой путь сайта; медиа
 * загрузки — только из хранилища этой организации.
 */
export function sanitizeResultPage(raw: unknown, outcomes: string[], tenantId?: string): { name: string; variants: Record<VariantKey, Variant> } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const allowed = new Set([DEFAULT_VARIANT_KEY, ...outcomes]);
  const vsrc = (r.variants && typeof r.variants === "object" ? r.variants : {}) as Record<string, unknown>;
  const variants: Record<VariantKey, Variant> = {};
  // «По умолчанию» занимает одно из восьми мест; остальные — по порядку.
  for (const [k, v] of Object.entries(vsrc).sort(([a], [b]) => (a === DEFAULT_VARIANT_KEY ? -1 : b === DEFAULT_VARIANT_KEY ? 1 : 0))) {
    if (Object.keys(variants).length >= LIMITS.variants) break;
    if (!allowed.has(k) || !ID.test(k)) continue;
    variants[k] = cleanVariant(v, tenantId);
  }
  if (!variants[DEFAULT_VARIANT_KEY]) {
    // Нет «по умолчанию» — освобождаем место под него, последний исход уходит.
    const keys = Object.keys(variants);
    if (keys.length >= LIMITS.variants) delete variants[keys[keys.length - 1]];
    variants[DEFAULT_VARIANT_KEY] = cleanVariant({}, tenantId);
  }
  return { name: line(r.name, 80), variants };
}

// ── Подстановка переменных ──────────────────────────────────────────────

const f = (t: string, vars: Record<string, string>) => fillVars(t, vars);

/** Все тексты варианта с подставленными переменными (кнопка — только если после подстановки это https). */
export function fillVariant(variant: Variant, vars: Record<string, string>): Variant {
  const media = (m: MediaRef): MediaRef => ({ ...m, ...(m.source === "url" ? { url: f(m.url, vars) } : {}) });
  return {
    theme: { ...variant.theme, header: f(variant.theme.header, vars) },
    steps: variant.steps.map((s): Step => {
      if (s.type === "splash") return { ...s, title: f(s.title, vars), subtitle: f(s.subtitle, vars), buttonText: f(s.buttonText, vars) };
      if (s.type === "video") return { ...s, media: media(s.media), caption: f(s.caption, vars) };
      return {
        ...s,
        blocks: s.blocks.map((b): Block => {
          switch (b.type) {
            case "heading": return { ...b, text: f(b.text, vars) };
            case "text": return { ...b, text: f(b.text, vars) };
            case "results": case "feedback": case "trial": return { ...b, title: f(b.title, vars) };
            case "signature": return { ...b, name: f(b.name, vars), role: f(b.role, vars) };
            case "image": return { ...b, alt: f(b.alt, vars) };
            case "button": { const url = f(b.url, vars).trim(); return { ...b, text: f(b.text, vars), url: /^https:\/\/[^\s"'<>]+$/.test(url) ? url : "" }; }
            default: return b;
          }
        }),
      };
    }),
  };
}

// ── Готовые шаблоны ─────────────────────────────────────────────────────

export interface ResultPreset { id: string; name: string; variant: Variant }

const splash = (): SplashStep => ({ id: "splash", type: "splash", title: "Ваши результаты готовы", subtitle: "{{ребёнок}}", buttonText: "Открыть" });
const sign = (): SignatureBlock => ({ id: "sign", type: "signature", name: "Приёмная комиссия", role: "{{организация}}", image: null });

export const PRESETS: ResultPreset[] = [
  {
    id: "enroll", name: "Зачисление: видео и письмо с конфетти",
    variant: {
      theme: { frame: "card", confetti: true, accent: "#4f46e5", background: "#f1f5f9", font: "serif", seal: true, header: "Приёмная комиссия" },
      steps: [
        splash(),
        { id: "video", type: "video", media: { source: "url", url: "/acceptance.mp4" }, skippable: true, caption: "" },
        {
          id: "letter", type: "letter", blocks: [
            { id: "h", type: "heading", text: "Поздравляем, {{ребёнок}}!" },
            { id: "t", type: "text", text: "{{дата}}\n\nМы рады сообщить: решение приёмной комиссии — **{{решение}}**. {{организация}} приглашает вас в {{класс_зачисления}} класс." },
            { id: "r", type: "results", title: "Результаты экзамена" },
            { id: "f", type: "feedback", title: "Комментарий комиссии" },
            { id: "d", type: "divider" },
            sign(),
          ],
        },
      ],
    },
  },
  {
    id: "trial", name: "Пробный период",
    variant: {
      theme: { frame: "card", confetti: false, accent: "#0d9488", background: "#f0fdfa", font: "sans", seal: true, header: "Приёмная комиссия" },
      steps: [
        splash(),
        {
          id: "letter", type: "letter", blocks: [
            { id: "h", type: "heading", text: "{{ребёнок}}, решение по вашему поступлению" },
            { id: "t", type: "text", text: "{{дата}}\n\nПриёмная комиссия {{организация}} приняла решение: **{{решение}}**. Мы приглашаем вас на пробный период — это возможность познакомиться с обучением и показать себя." },
            { id: "tr", type: "trial", title: "Пробный период" },
            { id: "r", type: "results", title: "Результаты экзамена" },
            { id: "f", type: "feedback", title: "Комментарий комиссии" },
            { id: "d", type: "divider" },
            sign(),
          ],
        },
      ],
    },
  },
  {
    id: "decline", name: "Отказ: сдержанное письмо",
    variant: {
      theme: { frame: "card", confetti: false, accent: "#475569", background: "#f8fafc", font: "serif", seal: false, header: "Приёмная комиссия" },
      steps: [
        {
          id: "letter", type: "letter", blocks: [
            { id: "h", type: "heading", text: "Решение по поступлению: {{ребёнок}}" },
            { id: "t", type: "text", text: "{{дата}}\n\nБлагодарим вас за интерес к {{организация}} и за участие во вступительном экзамене. К сожалению, по итогам рассмотрения комиссия приняла решение: **{{решение}}**." },
            { id: "f", type: "feedback", title: "Комментарий комиссии" },
            { id: "t2", type: "text", text: "Мы желаем вам успехов в учёбе и будем рады видеть вас в дальнейшем." },
            { id: "d", type: "divider" },
            sign(),
          ],
        },
      ],
    },
  },
  {
    id: "vintage", name: "Старинная бумага",
    variant: {
      theme: { frame: "vintage", confetti: false, accent: "#8b2e2e", background: "#cbb68a", font: "serif", seal: true, header: "Приёмная комиссия" },
      steps: [
        splash(),
        {
          id: "letter", type: "letter", blocks: [
            { id: "h", type: "heading", text: "{{ребёнок}}" },
            { id: "t", type: "text", text: "{{дата}}\n\nПриёмная комиссия {{организация}} рассмотрела вашу работу и приняла решение: **{{решение}}**." },
            { id: "r", type: "results", title: "Результаты экзамена" },
            { id: "f", type: "feedback", title: "Слово комиссии" },
            { id: "d", type: "divider" },
            sign(),
          ],
        },
      ],
    },
  },
  {
    id: "minimal", name: "Минимализм",
    variant: {
      theme: { frame: "full", confetti: false, accent: "#0f172a", background: "#ffffff", font: "sans", seal: false, header: "" },
      steps: [
        {
          id: "letter", type: "letter", blocks: [
            { id: "h", type: "heading", text: "{{ребёнок}}, ваши результаты" },
            { id: "t", type: "text", text: "Решение приёмной комиссии: **{{решение}}**." },
            { id: "r", type: "results", title: "Результаты" },
            { id: "f", type: "feedback", title: "Комментарий" },
            sign(),
          ],
        },
      ],
    },
  },
];

export const blankVariant = (): Variant => ({
  theme: { ...DEFAULT_THEME },
  steps: [{ id: `s_letter${newId().slice(0, 4)}`, type: "letter", blocks: [{ id: `b${newId().slice(0, 5)}`, type: "heading", text: "{{ребёнок}}" }] }],
});

/** Глубокая копия готового шаблона — его нельзя менять на месте. */
export const presetVariant = (id: string): Variant | null => {
  const p = PRESETS.find(x => x.id === id);
  return p ? JSON.parse(JSON.stringify(p.variant)) : null;
};

/** Новый блок для палитры редактора. */
export function newBlock(type: BlockType): Block {
  const id = `b${newId()}`;
  switch (type) {
    case "heading": return { id, type, text: "Заголовок" };
    case "text": return { id, type, text: "Текст письма" };
    case "results": return { id, type, title: "Результаты экзамена" };
    case "feedback": return { id, type, title: "Комментарий комиссии" };
    case "trial": return { id, type, title: "Пробный период" };
    case "signature": return { id, type, name: "Приёмная комиссия", role: "{{организация}}", image: null };
    case "image": return { id, type, media: emptyMedia(), alt: "" };
    case "button": return { id, type, text: "Подробнее", url: "" };
    case "divider": return { id, type };
  }
}

/** Новый шаг для редактора (письмо — единственное, всегда последнее). */
export function newStep(type: "splash" | "video"): SplashStep | VideoStep {
  const id = `s${newId()}`;
  return type === "splash"
    ? { id, type, title: "Ваши результаты готовы", subtitle: "{{ребёнок}}", buttonText: "Открыть" }
    : { id, type, media: emptyMedia(), skippable: true, caption: "" };
}

export const MEDIA_UPLOAD = {
  types: ["video/mp4", "video/webm", "image/jpeg", "image/png"] as const,
  maxBytes: 100 * 1024 * 1024,
  ext: { "video/mp4": "mp4", "video/webm": "webm", "image/jpeg": "jpg", "image/png": "png" } as Record<string, string>,
};
