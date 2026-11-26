/**
 * «Документы школы» — папки, файлы и сборы документов у сотрудников.
 * Общий модуль сервера и кабинета: адресаты, доступ к папкам, проверка
 * файлов, сводка сбора. Пишет только сервер.
 *
 * Адресаты (Audience) — по должностям, классам, ступеням, предметам и своим
 * группам из «Где работает» сотрудника. Внутри одного признака — «или»
 * (5 или 6 класс), между признаками — «и» (учитель И 5 класс). include —
 * добавить людей поимённо, exclude — убрать. all — вся организация.
 */
import { levelsOf, placementOf, type SchoolLevel, type StaffPlacement } from "./staffPlacement.js";

export interface Audience {
  all: boolean;
  positions: string[];
  grades: number[];
  levels: SchoolLevel[];
  subjects: string[];
  groups: string[];
  include: string[];
  exclude: string[];
}
export const EMPTY_AUDIENCE: Audience = { all: false, positions: [], grades: [], levels: [], subjects: [], groups: [], include: [], exclude: [] };

/** Сотрудник — то, что нужно для подбора адресатов. */
export interface StaffLite { uid: string; name: string; positionId: string | null; positionName: string; placement: StaffPlacement; full: boolean }

export interface FolderAccess {
  /** Кто видит папку. */
  view: Audience;
  /** Кто может загружать. */
  upload: Audience;
  /** Кто управляет (кроме тех, у кого право «Управление документами»). */
  managers: string[];
  /** Загружающие видят только свои файлы (по умолчанию). */
  ownOnly: boolean;
  /** Брать доступ у родительской папки. */
  inherit: boolean;
}

export interface DocFolder {
  id: string;
  name: string;
  parentId: string | null;
  access: FolderAccess;
  createdBy: { uid: string; name: string };
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface DocFile {
  id: string;
  folderId: string;
  name: string;
  size: number;
  type: string;
  path: string;
  uploadedBy: { uid: string; name: string };
  at: number;
  requestId?: string | null;
  itemId?: string | null;
  status: "uploading" | "ready";
  deletedAt?: number | null;
}

export const ROOT_ACCESS: FolderAccess = { view: { ...EMPTY_AUDIENCE, all: true }, upload: { ...EMPTY_AUDIENCE }, managers: [], ownOnly: true, inherit: false };
export const CHILD_ACCESS: FolderAccess = { ...ROOT_ACCESS, inherit: true };

const clip = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const ids = (v: unknown, max = 300) => [...new Set((Array.isArray(v) ? v : []).map(x => String(x)).filter(x => /^[\w-]{1,128}$/.test(x)))].slice(0, max);
const labels = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).map(x => clip(x, 60)).filter(Boolean))].slice(0, 40);

export function sanitizeAudience(raw: unknown): Audience {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const lv = new Set(["primary", "middle", "high"]);
  return {
    all: r.all === true,
    positions: ids(r.positions, 40),
    grades: [...new Set((Array.isArray(r.grades) ? r.grades : []).map(Number).filter(g => Number.isInteger(g) && g >= 1 && g <= 11))].sort((a, b) => a - b),
    levels: [...new Set((Array.isArray(r.levels) ? r.levels : []).map(String).filter(x => lv.has(x)))] as SchoolLevel[],
    subjects: labels(r.subjects), groups: labels(r.groups),
    include: ids(r.include), exclude: ids(r.exclude),
  };
}

export function sanitizeAccess(raw: unknown, root: boolean): FolderAccess {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    view: sanitizeAudience(r.view ?? ROOT_ACCESS.view), upload: sanitizeAudience(r.upload),
    managers: ids(r.managers, 50), ownOnly: r.ownOnly !== false, inherit: !root && r.inherit !== false,
  };
}

export const audienceEmpty = (a: Audience) => !a.all && !a.positions.length && !a.grades.length && !a.levels.length && !a.subjects.length && !a.groups.length && !a.include.length;

/** Подходит ли сотрудник под адресатов. */
export function inAudience(a: Audience, s: StaffLite): boolean {
  if (a.exclude.includes(s.uid)) return false;
  if (a.include.includes(s.uid)) return true;
  if (a.all) return true;
  const crit = a.positions.length || a.grades.length || a.levels.length || a.subjects.length || a.groups.length;
  if (!crit) return false;
  const p = s.placement; const low = (xs: string[]) => xs.map(x => x.toLowerCase());
  if (a.positions.length && !(s.positionId && a.positions.includes(s.positionId))) return false;
  if (a.grades.length && !a.grades.some(g => p.grades.includes(g))) return false;
  if (a.levels.length && !a.levels.some(l => levelsOf(p).includes(l))) return false;
  if (a.subjects.length && !low(a.subjects).some(x => low(p.subjects).includes(x))) return false;
  if (a.groups.length && !low(a.groups).some(x => low(p.groups).includes(x))) return false;
  return true;
}

export const audienceMembers = (a: Audience, staff: StaffLite[]) => staff.filter(s => inAudience(a, s));

/** «Учитель · 5, 6 класс · Математика · + 2 человека». */
export function describeAudience(a: Audience, names: { positions: Record<string, string>; people: Record<string, string> }): string {
  if (a.all && !a.exclude.length) return "Все сотрудники";
  const parts = [
    a.all ? "Все сотрудники" : "",
    a.positions.map(p => names.positions[p] || "должность").join(" / "),
    a.grades.length ? `${a.grades.join(", ")} класс` : "",
    a.levels.map(l => ({ primary: "начальная", middle: "средняя", high: "старшая" }[l])).join(" / "),
    a.subjects.join(" / "), a.groups.join(" / "),
  ].filter(Boolean);
  const plus = a.include.length ? `+ ${a.include.map(u => names.people[u] || "сотрудник").join(", ")}` : "";
  const minus = a.exclude.length ? `кроме ${a.exclude.map(u => names.people[u] || "сотрудник").join(", ")}` : "";
  return [parts.join(" · "), plus, minus].filter(Boolean).join(" ") || "Никто";
}

/** Сотрудник из документа членства (+ имя должности). */
export const staffLite = (m: any, positionName = ""): StaffLite => ({
  uid: String(m.userId), name: String(m.displayName || m.email || "Сотрудник"),
  positionId: m.customRoleId ? String(m.customRoleId) : null, positionName,
  placement: placementOf(m), full: ["owner", "org:owner", "admin", "org:admin"].includes(String(m.role || "")),
});

// ── Доступ к папкам ────────────────────────────────────────────────────

/** Действующий доступ папки: наследование поднимается к ближайшей папке со своим доступом. */
export function effectiveAccess(folder: DocFolder, byId: Map<string, DocFolder>): FolderAccess {
  let cur = folder; const seen = new Set<string>([folder.id]);
  while (cur.access.inherit && cur.parentId) {
    const p = byId.get(cur.parentId);
    if (!p || seen.has(p.id)) return ROOT_ACCESS;
    seen.add(p.id); cur = p;
  }
  return cur.access;
}

export interface FolderRights { see: boolean; upload: boolean; manage: boolean; seeAll: boolean }

/**
 * Что сотрудник может в папке. manageAll — право «Управление документами»
 * или полный доступ. Управляющие папкой видят всё; загружающие при ownOnly —
 * только свои файлы.
 */
export function folderRights(folder: DocFolder, byId: Map<string, DocFolder>, s: StaffLite, manageAll: boolean): FolderRights {
  if (manageAll || s.full) return { see: true, upload: true, manage: true, seeAll: true };
  const a = effectiveAccess(folder, byId);
  // Управляющие — свои у папки и у всех папок выше.
  let manage = false; let cur: DocFolder | undefined = folder; const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) { seen.add(cur.id); if (cur.access.managers.includes(s.uid)) { manage = true; break; } cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
  if (manage) return { see: true, upload: true, manage: true, seeAll: true };
  const upload = inAudience(a.upload, s);
  const see = upload || inAudience(a.view, s);
  return { see, upload, manage: false, seeAll: see && !a.ownOnly };
}

/** Путь папки от корня: [корень, …, папка]. */
export function folderPath(folder: DocFolder, byId: Map<string, DocFolder>): DocFolder[] {
  const out: DocFolder[] = []; let cur: DocFolder | undefined = folder; const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) { seen.add(cur.id); out.unshift(cur); cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
  return out;
}

// ── Файлы ──────────────────────────────────────────────────────────────

export const FILE_LIMIT = 50 * 1024 * 1024;
/** Общий объём на организацию по умолчанию (можно поднять в настройках). */
export const TENANT_QUOTA = 5 * 1024 * 1024 * 1024;

/** Разрешённые расширения → тип. Всё прочее (exe, скрипты, html) — нельзя. */
export const FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text", ods: "application/vnd.oasis.opendocument.spreadsheet", odp: "application/vnd.oasis.opendocument.presentation",
  rtf: "application/rtf", txt: "text/plain", csv: "text/csv",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", heic: "image/heic", heif: "image/heif",
  mp4: "video/mp4", mov: "video/quicktime", mp3: "audio/mpeg", m4a: "audio/mp4",
  zip: "application/zip", rar: "application/vnd.rar", "7z": "application/x-7z-compressed",
};
export const extOf = (name: string) => (String(name).toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1] || "");

/** Имя файла без опасных знаков; расширение сохраняется. */
export function cleanFileName(name: unknown): string {
  const s = clip(name, 180).replace(/[\\/:*?"<>|#%{}^~[\]`]/g, " ").replace(/\s+/g, " ").replace(/^\.+/, "").trim();
  return s || "файл";
}

/** Можно ли загрузить такой файл. null — можно, иначе понятная причина. */
export function fileProblem(name: string, size: number): string | null {
  const ext = extOf(name);
  if (!ext || !FILE_TYPES[ext]) return `Файлы .${ext || "?"} загружать нельзя: только документы, таблицы, презентации, PDF, картинки, видео, архивы`;
  if (!Number.isFinite(size) || size <= 0) return "Пустой файл";
  if (size > FILE_LIMIT) return `Файл больше ${Math.round(FILE_LIMIT / 1048576)} МБ`;
  return null;
}

export const fmtSize = (n: number) => (n >= 1073741824 ? `${(n / 1073741824).toFixed(1)} ГБ` : n >= 1048576 ? `${(n / 1048576).toFixed(1)} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`).replace(".", ",");
