import { documentService } from "../../services/collab/documentService";
import { sheetService } from "../../services/collab/sheetService";
import { indexToCol, cellId, MAX_COLUMNS, MAX_ROWS } from "../../services/collab/sheetCore";
import type { DocBlock } from "../../types/collab";
import { generateShortId } from "../../lib/utils";
import {
  JOURNAL_LIMITS, newId, normalizeValue, sanitizeColumns,
  type JournalColumn, type JournalEntry,
} from "../../shared/journals";
import {
  BLOCK_TO_DOC, toIsoDate,
  type DigitizeMode, type DigitizeResult, type DigitizedBlock, type DigitizedScan, type DigitizeTargetType,
} from "../../shared/digitize";

export type Api = (path: string, init?: RequestInit) => Promise<unknown>;

// ── Черновики проверки ──────────────────────────────────────────────────

export interface DocDraft { title: string; blocks: DigitizedBlock[] }
export interface TableRowDraft { cells: string[]; doubt: boolean[] }
export interface TableDraft { title: string; headers: string[]; rows: TableRowDraft[] }
export interface JournalRowDraft { values: Record<string, string>; doubt: string[] }
export type FillType = "text" | "number" | "date" | "checkbox";
export interface NewColumnDraft { id: string; label: string; type: FillType; skip: boolean }
export interface NewJournalDraft { title: string; cols: NewColumnDraft[]; rows: JournalRowDraft[] }

export const FILL_TYPE_LABEL: Record<FillType, string> = { text: "Текст", number: "Число", date: "Дата", checkbox: "Да-нет" };

/** Результаты страниц → один черновик. Пустые (не распознанные) страницы пропускаются. */
export function mergeDocument(results: (DigitizeResult | null)[]): DocDraft {
  let title = "";
  const blocks: DigitizedBlock[] = [];
  for (const r of results) {
    if (!r || r.mode !== "document") continue;
    if (!title) title = r.document.title;
    blocks.push(...r.document.blocks);
  }
  return { title, blocks };
}

export function mergeTable(results: (DigitizeResult | null)[]): TableDraft {
  let title = "";
  let headers: string[] | null = null;
  const rows: TableRowDraft[] = [];
  for (const r of results) {
    if (!r || r.mode !== "table") continue;
    const t = r.table;
    if (!headers) { headers = [...t.headers]; title = t.title; }
    const n = headers.length;
    const bad = new Set(t.doubt.map(d => `${d.row}:${d.col}`));
    t.rows.forEach((row, ri) => {
      const cells = Array.from({ length: n }, (_, i) => row[i] ?? "");
      rows.push({ cells, doubt: cells.map((_, ci) => bad.has(`${ri}:${ci}`)) });
    });
  }
  return { title, headers: headers || [], rows };
}

export function mergeJournal(results: (DigitizeResult | null)[]): JournalRowDraft[] {
  const rows: JournalRowDraft[] = [];
  for (const r of results) {
    if (!r || r.mode !== "journal") continue;
    for (const row of r.journal.rows) rows.push({ values: { ...row.values }, doubt: [...row.doubt] });
  }
  return rows;
}

/** Таблица → черновик нового журнала: у каждого заголовка своя колонка. */
export function tableToNewJournal(t: TableDraft): NewJournalDraft {
  const cols: NewColumnDraft[] = t.headers.map((h, i) => ({ id: newId("c"), label: h.trim() || `Колонка ${i + 1}`, type: "text", skip: false }));
  const rows: JournalRowDraft[] = t.rows.map(r => {
    const values: Record<string, string> = {};
    const doubt: string[] = [];
    cols.forEach((c, i) => { values[c.id] = r.cells[i] ?? ""; if (r.doubt[i]) doubt.push(c.id); });
    return { values, doubt };
  });
  return { title: t.title, cols, rows };
}

export const newColumnsToJournal = (cols: NewColumnDraft[]): JournalColumn[] =>
  cols.filter(c => !c.skip).map(c => ({
    id: c.id, type: c.type, label: c.label.trim() || FILL_TYPE_LABEL[c.type],
    ...(c.type === "checkbox" ? { yesLabel: "Да", noLabel: "Нет" } : {}),
  }));

// ── Значения журнала ────────────────────────────────────────────────────

const norm = (s: string) => s.trim().toLowerCase().replace(/ё/g, "е");

/** Текст с бумаги → значение колонки; null — пусто или не распознано. */
export function convertRaw(c: JournalColumn, raw: string): unknown {
  const v = raw.trim();
  if (!v) return null;
  if (c.type === "date") return toIsoDate(v);
  if (c.type === "checkbox") {
    if (/^(да|yes|true|1|\+|✓)$/i.test(v) || norm(v) === norm(c.yesLabel || "да")) return true;
    if (/^(нет|no|false|0|-)$/i.test(v) || norm(v) === norm(c.noLabel || "нет")) return false;
    return null;
  }
  if (c.type === "number") return Number(v.replace(",", ".").replace(/\s/g, ""));
  return v;
}

/** Текст ошибки ячейки или null, если всё в порядке. */
export function checkCell(c: JournalColumn, raw: string): string | null {
  const v = convertRaw(c, raw);
  if (v === null) return raw.trim() ? `«${c.label}»: нужно да или нет` : null;
  if (typeof v === "number" && Number.isNaN(v)) return `«${c.label}»: нужно число`;
  const r = normalizeValue(c, v);
  return "error" in r ? r.error : null;
}

export function countJournalErrors(columns: JournalColumn[], rows: JournalRowDraft[]): number {
  let n = 0;
  for (const r of rows) if (columns.some(c => checkCell(c, r.values[c.id] ?? "") !== null)) n++;
  return n;
}

export function buildEntries(columns: JournalColumn[], rows: JournalRowDraft[]): { values: Record<string, unknown> }[] {
  const out: { values: Record<string, unknown> }[] = [];
  for (const r of rows) {
    const values: Record<string, unknown> = {};
    for (const c of columns) {
      const v = convertRaw(c, r.values[c.id] ?? "");
      if (v === null || (typeof v === "number" && Number.isNaN(v))) continue;
      const n = normalizeValue(c, v);
      if (n.ok && n.value !== null) values[c.id] = n.value;
    }
    if (Object.keys(values).length) out.push({ values });
  }
  return out;
}

// ── Сохранение ──────────────────────────────────────────────────────────

export interface SaveContext {
  tenantId: string;
  staffId: string;
  authorName: string;
  journalApi: Api;
  digitizeApi: Api;
}

export interface Saved { type: DigitizeTargetType; id: string; title: string; itemCount: number; entries?: JournalEntry[] }

export async function saveDocument(ctx: SaveContext, d: DocDraft): Promise<Saved> {
  const title = d.title.trim() || "Оцифрованный документ";
  const id = await documentService.createDocument(ctx.tenantId, ctx.staffId, ctx.authorName, title);
  const blocks: DocBlock[] = d.blocks.filter(b => b.text.trim()).map(b => ({ id: generateShortId(), type: BLOCK_TO_DOC[b.type], content: b.text }));
  if (!blocks.length) blocks.push({ id: generateShortId(), type: "paragraph", content: "" });
  await documentService.updateBlocks(ctx.tenantId, id, blocks, ctx.staffId);
  return { type: "document", id, title, itemCount: blocks.length };
}

export async function saveSheet(ctx: SaveContext, t: TableDraft): Promise<Saved> {
  const title = t.title.trim() || "Оцифрованная таблица";
  const id = await sheetService.createSheet(ctx.tenantId, ctx.staffId, title);
  const rowsNeeded = Math.min(MAX_ROWS, t.rows.length + 1);
  const colsNeeded = Math.min(MAX_COLUMNS, t.headers.length);
  if (rowsNeeded > 100 || colsNeeded > 26) {
    await sheetService.extendGrid(ctx.tenantId, id, Math.max(100, rowsNeeded), Math.max(26, colsNeeded), ctx.staffId);
  }
  const changes: Record<string, string> = {};
  // Текст с бумаги, начатый с «=», не должен стать формулой.
  const asText = (v: string) => (v.startsWith("=") ? ` ${v}` : v);
  t.headers.slice(0, colsNeeded).forEach((h, c) => { if (h.trim()) changes[cellId(c, 1)] = asText(h); });
  t.rows.slice(0, rowsNeeded - 1).forEach((r, ri) => r.cells.slice(0, colsNeeded).forEach((v, c) => { if (v.trim()) changes[cellId(c, ri + 2)] = asText(v); }));
  if (Object.keys(changes).length) await sheetService.updateCells(ctx.tenantId, id, {}, changes, ctx.staffId);
  for (let c = 0; c < colsNeeded; c++) {
    if (t.headers[c]?.trim()) await sheetService.updateCellStyle(ctx.tenantId, id, `${indexToCol(c)}1`, { isBold: true }, ctx.staffId);
  }
  return { type: "sheet", id, title, itemCount: t.rows.length };
}

export async function postEntries(ctx: SaveContext, journalId: string, entries: { values: Record<string, unknown> }[]): Promise<JournalEntry[]> {
  const created: JournalEntry[] = [];
  for (let i = 0; i < entries.length; i += JOURNAL_LIMITS.maxBulk) {
    const j = await ctx.journalApi(`/${journalId}/entries`, { method: "POST", body: JSON.stringify({ entries: entries.slice(i, i + JOURNAL_LIMITS.maxBulk) }) }) as { entries?: JournalEntry[] };
    created.push(...(j.entries || []));
  }
  return created;
}

export async function saveJournalRows(ctx: SaveContext, journalId: string, journalTitle: string, columns: JournalColumn[], rows: JournalRowDraft[]): Promise<Saved> {
  const entries = await postEntries(ctx, journalId, buildEntries(columns, rows));
  return { type: "journal", id: journalId, title: journalTitle, itemCount: entries.length, entries };
}

export async function saveNewJournal(ctx: SaveContext, d: NewJournalDraft): Promise<Saved> {
  const title = d.title.trim() || "Оцифрованный журнал";
  const columns = sanitizeColumns(newColumnsToJournal(d.cols));
  if (!columns.length) throw new Error("Оставьте хотя бы одну колонку");
  const created = await ctx.journalApi("", { method: "POST", body: JSON.stringify({ title }) }) as { journal: { id: string } };
  const id = created.journal.id;
  await ctx.journalApi(`/${id}`, { method: "PUT", body: JSON.stringify({ title, columns }) });
  const entries = await postEntries(ctx, id, buildEntries(columns, d.rows));
  return { type: "journal", id, title, itemCount: entries.length, entries };
}

/** Оригинал страниц. Ошибка не должна терять уже сохранённый результат — вызывающий ловит её сам. */
export async function saveOriginal(ctx: SaveContext, mode: DigitizeMode, saved: Saved, title: string, pages: string[]): Promise<DigitizedScan> {
  const r = await ctx.digitizeApi("/scans", {
    method: "POST",
    body: JSON.stringify({ title: title.trim() || saved.title, mode, target: { type: saved.type, id: saved.id, title: saved.title }, itemCount: saved.itemCount, pageCount: pages.length }),
  }) as { scan: DigitizedScan };
  for (let i = 0; i < pages.length; i++) {
    await ctx.digitizeApi(`/scans/${r.scan.id}/pages`, { method: "POST", body: JSON.stringify({ index: i, image: pages[i] }) });
  }
  return r.scan;
}
