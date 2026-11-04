/**
 * Презентации организации: колоды Claude Slides (слайды HTML 1920×1080,
 * видео со звуком, живые встроенные страницы) и самостоятельные HTML-файлы.
 *
 * Слайды лежат в документе презентации, видео и картинки — в Storage, ключ
 * файла — его id в колоде («/_blob/<id>» в слайде). Отдаёт их сервер только
 * после проверки доступа — временными ссылками.
 */

/**
 * Кто открывает презентацию по ссылке:
 * - private — только тот, кто ею управляет;
 * - org — любой сотрудник организации;
 * - people — выбранные сотрудники;
 * - public — все, у кого есть ссылка, без входа.
 */
export type PresentationAccessMode = "private" | "org" | "people" | "public";
export interface PresentationAccess { mode: PresentationAccessMode; people: string[] }

export const ACCESS_LABEL: Record<PresentationAccessMode, string> = {
  private: "Только управляющие",
  org: "Вся организация",
  people: "Выбранные сотрудники",
  public: "Все по ссылке",
};
export const ACCESS_HINT: Record<PresentationAccessMode, string> = {
  private: "Видите вы и те, у кого право управлять презентациями.",
  org: "Любой сотрудник организации — после входа в аккаунт.",
  people: "Только отмеченные сотрудники — после входа в аккаунт.",
  public: "Любой, у кого есть ссылка, — без входа. Подходит для учеников и родителей.",
};

export interface PresentationFace { family: string; href: string }
export interface PresentationAsset { type: string; size: number }
export interface PresentationSlide { id: string; html: string }

export interface Presentation {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  /** slides — колода Claude Slides; html — одна самостоятельная страница. */
  kind: "slides" | "html";
  slides: PresentationSlide[];
  faces: Record<string, PresentationFace>;
  /** Файлы по id из «/_blob/<id>»; для kind=html — один файл «index». */
  assets: Record<string, PresentationAsset>;
  access: PresentationAccess;
  /** Код короткой ссылки /show/<code>. */
  code: string;
  /** uploading — файлы ещё грузятся, показывать нельзя. */
  status: "uploading" | "ready";
  source?: { kind: string; ref?: string };
  createdBy: string;
  createdByName: string;
  createdAt: number;
  updatedAt: number;
}

export const LIMITS = {
  title: 160,
  description: 600,
  slides: 200,
  /** Слайд — до 120 КБ, все слайды — до 800 КБ: документ Firestore ограничен 1 МБ. */
  slideBytes: 120_000,
  slidesBytes: 800_000,
  assets: 300,
  /** Один файл — до 200 МБ: длинная запись урока со звуком. */
  assetBytes: 200 * 1024 * 1024,
  people: 500,
};

export const ASSET_ID = /^[a-z0-9]{8,64}$/;
export const SLIDE_ID = /^[A-Za-z0-9_-]{1,64}$/;
export const PRESENTATION_CODE = /^[A-Z0-9]{8}$/;
/** Типы файлов, которые можно хранить и отдавать: картинки, видео, звук, шрифты, страница. */
export const ASSET_TYPES = /^(image\/(png|jpeg|gif|webp|svg\+xml|avif)|video\/(mp4|webm|quicktime)|audio\/(mpeg|mp4|aac|ogg|wav|webm)|font\/(woff2?|ttf|otf)|text\/html)$/;
export const FONT_HREF = /^https:\/\/fonts\.googleapis\.com\/css2\?[^"'<>\s]{1,600}$/;

export function sanitizeAccess(raw: any): PresentationAccess {
  const mode: PresentationAccessMode = ["private", "org", "people", "public"].includes(raw?.mode) ? raw.mode : "private";
  const people = [...new Set((Array.isArray(raw?.people) ? raw.people : []).map((x: unknown) => String(x ?? "").trim()).filter((x: string) => /^[A-Za-z0-9_-]{6,128}$/.test(x)))].slice(0, LIMITS.people) as string[];
  return { mode, people };
}

export function sanitizeFaces(raw: any): Record<string, PresentationFace> {
  const out: Record<string, PresentationFace> = {};
  for (const [k, v] of Object.entries(raw && typeof raw === "object" ? raw : {}).slice(0, 8)) {
    const f: any = v;
    const family = String(f?.family || "").trim();
    const href = String(f?.href || "").trim();
    if (/^[A-Za-z][A-Za-z0-9 _-]{0,39}$/.test(family) && FONT_HREF.test(href)) out[String(k).slice(0, 48)] = { family, href };
  }
  return out;
}

/** «/_blob/<id>» в слайде → id файла. */
export const blobIdsIn = (html: string) => [...new Set([...html.matchAll(/\/_blob\/([a-z0-9]{8,64})/g)].map(m => m[1]))];

export const showLink = (origin: string, code: string) => `${origin}/show/${code}`;
