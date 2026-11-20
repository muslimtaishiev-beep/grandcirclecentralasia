/**
 * Оцифровка бумажных документов: фото страницы → ИИ → документ, таблица или
 * записи журнала.
 *
 * Модуль общий для сервера и браузера. Распознавание идёт только через
 * сервер: ключ ИИ не должен попасть в браузер, а лимит страниц считается на
 * организацию. Результат ничего не пишет сам — сотрудник проверяет и правит
 * его, и только потом сохраняет в обычный документ, таблицу или журнал.
 */

export type DigitizeMode = "document" | "table" | "journal";

export const DIGITIZE_MODE_LABEL: Record<DigitizeMode, string> = {
  document: "Документ",
  table: "Таблица",
  journal: "Журнал",
};

export type DigitizedBlockType = "heading" | "subheading" | "paragraph" | "bullet" | "numbered" | "quote";

export interface DigitizedBlock {
  type: DigitizedBlockType;
  text: string;
  /** Слова и фрагменты, в которых ИИ не уверена — подсвечиваются при проверке. */
  doubt?: string[];
}

export interface DigitizedDocument {
  title: string;
  blocks: DigitizedBlock[];
}

export interface DigitizedTable {
  title: string;
  headers: string[];
  /** Каждая строка той же длины, что headers. */
  rows: string[][];
  /** Сомнительные ячейки: индекс строки в rows и индекс колонки. */
  doubt: { row: number; col: number }[];
}

export interface DigitizedJournalRow {
  /** id колонки журнала → распознанный текст (как написано на бумаге). */
  values: Record<string, string>;
  /** id колонок, в которых ИИ не уверена. */
  doubt: string[];
}

export interface DigitizedJournal {
  rows: DigitizedJournalRow[];
}

export type DigitizeResult =
  | { mode: "document"; document: DigitizedDocument }
  | { mode: "table"; table: DigitizedTable }
  | { mode: "journal"; journal: DigitizedJournal };

/** POST /api/digitize/:tenantId/recognize — одна страница за запрос. */
export interface DigitizeRequest {
  mode: DigitizeMode;
  /** Обрезанная страница: data:image/jpeg;base64,… */
  image: string;
  /** mode = "journal": в какой журнал раскладывать. */
  journalId?: string;
  /** mode = "table": заголовки с предыдущей страницы — продолжение той же таблицы. */
  continueHeaders?: string[];
}

export interface DigitizeResponse {
  success: true;
  result: DigitizeResult;
  /** Сколько страниц организация распознала в этом месяце и сколько можно. */
  usage: { used: number; limit: number };
}

/** Тип результата, куда сохранили оцифровку. */
export type DigitizeTargetType = "document" | "sheet" | "journal";

/** Запись в разделе «Оцифровка»: оригинал страниц и ссылка на результат. */
export interface DigitizedScan {
  id: string;
  tenantId: string;
  title: string;
  mode: DigitizeMode;
  target: { type: DigitizeTargetType; id: string; title: string };
  pageCount: number;
  /** Сколько строк (таблица, журнал) или блоков (документ) сохранено. */
  itemCount: number;
  createdBy: string;
  createdByName: string;
  createdAt: number;
}

/** POST /api/digitize/:tenantId/scans */
export interface SaveScanRequest {
  title: string;
  mode: DigitizeMode;
  target: { type: DigitizeTargetType; id: string; title: string };
  itemCount: number;
  /** Обрезанные страницы, сжатые для хранения (data:image/jpeg). */
  pages: string[];
}

export const DIGITIZE_LIMITS = {
  /** Страниц в месяц на организацию, если в организации не задано своё число (tenant.digitizeMonthlyPages). */
  defaultMonthlyPages: 300,
  /** Размер одной страницы, отправленной на распознавание (data URL, символов). */
  maxRecognizeImage: 3_500_000,
  /** Длинная сторона страницы для распознавания. */
  recognizeMaxSide: 2200,
  /** Хранимая копия страницы: влезает в документ Firestore. */
  storeMaxSide: 1400,
  storeMaxBytes: 450 * 1024,
  maxPages: 20,
  maxTableColumns: 40,
  maxRows: 500,
} as const;

/** Блоки оцифровки → типы блоков редактора документов. */
export const BLOCK_TO_DOC: Record<DigitizedBlockType, "heading_1" | "heading_2" | "paragraph" | "bullet_list" | "numbered_list" | "quote"> = {
  heading: "heading_1",
  subheading: "heading_2",
  paragraph: "paragraph",
  bullet: "bullet_list",
  numbered: "numbered_list",
  quote: "quote",
};

/** «31.12.2026», «31/12/26» → «2026-12-31»; иначе исходная строка. */
export function toIsoDate(s: string): string {
  const v = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/.exec(v);
  if (!m) return v;
  const y = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}
