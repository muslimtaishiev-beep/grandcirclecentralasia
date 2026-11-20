import { Router } from "express";
import admin from "firebase-admin";
import { requireFirebaseAuth } from "./authRoutes.js";
import { journalRole } from "./journalRoutes.js";
import { activeMembership, membershipPermissions } from "../server/access.js";
import { checkTenantOpen } from "../server/tenantAccess.js";
import { geminiJson, GeminiError, type GeminiPart } from "../server/gemini.js";
import { writeAudit, actorOf } from "../server/audit.js";
import { hasFullAccess, type PermissionKey } from "../shared/permissions.js";
import { roleAtLeast, type Journal, type JournalColumn } from "../shared/journals.js";
import {
  DIGITIZE_LIMITS,
  type DigitizeMode, type DigitizeResult, type DigitizedBlock, type DigitizedBlockType,
  type DigitizedDocument, type DigitizedJournal, type DigitizedScan, type DigitizedTable, type DigitizeTargetType,
} from "../shared/digitize.js";

/**
 * Оцифровка: фото страницы → документ, таблица или записи журнала.
 *
 * Сервер только распознаёт и хранит оригиналы. Сам результат сохраняет
 * сотрудник после проверки — обычными путями документа, таблицы или журнала,
 * со всеми их проверками доступа.
 *
 * Распознавание платное, поэтому у организации месячный лимит страниц:
 * tenant.digitizeMonthlyPages или общий по умолчанию.
 */
const router = Router();
const db = () => admin.firestore();
const tcol = (t: string, name: string) => db().collection("tenants").doc(t).collection(name);
const str = (v: unknown, max = 200) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim().slice(0, max);
const fail = (res: any, status: number, error: string) => res.status(status).json({ success: false, error });
const DATA_URL = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;

// ── Кто вызывает ────────────────────────────────────────────────────────

interface Caller { uid: string; name: string; full: boolean; all: boolean; roleId: string; perms: Set<PermissionKey> }

const requireEmployee = async (req: any, res: any, next: any) => {
  try {
    const t = String(req.params.tenantId || "");
    const gate = await checkTenantOpen(t);
    if (!gate.ok) return fail(res, gate.status || 403, gate.error || "Организация недоступна");
    req.tenant = gate.tenant;
    const uid = String(req.user?.uid || "");
    const name = str(req.user?.name || req.user?.email || uid, 120);
    if (req.user?.isSuperadmin === true) {
      req.caller = { uid, name, full: true, all: true, roleId: "", perms: new Set() } as Caller;
      return next();
    }
    const m = await activeMembership(db(), uid, t);
    if (!m) return fail(res, 403, "Оцифровка доступна только сотрудникам организации");
    const perms = await membershipPermissions(db(), m);
    const full = hasFullAccess(m.role);
    req.caller = {
      uid, name: str(m.displayName, 120) || name, full,
      all: full || perms.has("journals:all" as PermissionKey),
      roleId: str((m as any).customRoleId, 128), perms,
    } as Caller;
    next();
  } catch (e: any) { return fail(res, 500, e.message); }
};
const guard = [requireFirebaseAuth, requireEmployee];
const can = (c: Caller, p: PermissionKey) => c.full || c.perms.has(p);

// ── Лимит страниц на организацию ────────────────────────────────────────

const monthKey = () => new Date().toISOString().slice(0, 7);
const usageRef = (t: string) => tcol(t, "usage").doc("digitize");
function monthlyLimit(tenant: any): number {
  const n = Number(tenant?.digitizeMonthlyPages);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DIGITIZE_LIMITS.defaultMonthlyPages;
}
async function readUsage(t: string): Promise<number> {
  const s = await usageRef(t).get();
  const d = s.data() || {};
  return d.month === monthKey() ? Number(d.pages) || 0 : 0;
}
async function addUsage(t: string, uid: string): Promise<number> {
  const ref = usageRef(t);
  return db().runTransaction(async tx => {
    const d = (await tx.get(ref)).data() || {};
    const month = monthKey();
    const pages = (d.month === month ? Number(d.pages) || 0 : 0) + 1;
    tx.set(ref, { month, pages, updatedAt: Date.now(), lastBy: uid });
    return pages;
  });
}

// ── Подсказки и схемы для ИИ ────────────────────────────────────────────

const SYSTEM = [
  "You transcribe photographed paper documents of an educational organization (school, academy, university).",
  "The page may be handwritten or printed, in Russian, English or another language written in Cyrillic or Latin script, sometimes mixed.",
  "Rules:",
  "- Transcribe exactly what is written, in the original language and script. Never translate, summarize or add content.",
  "- Keep names, numbers, dates and punctuation as written. Fix nothing except obvious line-break hyphenation.",
  "- If a word is hard to read, give your best reading and list it as doubtful. If it is fully illegible, write … in its place and mark it doubtful.",
  "- Ignore stamps, signatures and doodles unless they contain readable text that belongs to the content; write a signature as [подпись] only where a signature line is filled.",
  "- Crossed-out text is omitted.",
].join("\n");

const S = (type: string, extra: Record<string, unknown> = {}) => ({ type, ...extra });
const BLOCK_TYPES: DigitizedBlockType[] = ["heading", "subheading", "paragraph", "bullet", "numbered", "quote"];

const DOC_SCHEMA = S("OBJECT", {
  properties: {
    title: S("STRING", { description: "Short title of the document as written on it, or a 2–5 word description if it has none" }),
    blocks: S("ARRAY", {
      items: S("OBJECT", {
        properties: {
          type: S("STRING", { enum: BLOCK_TYPES }),
          text: S("STRING"),
          doubt: S("ARRAY", { items: S("STRING"), description: "Exact words or fragments from text that are uncertain" }),
        },
        required: ["type", "text"],
      }),
    }),
  },
  required: ["title", "blocks"],
});

const TABLE_SCHEMA = S("OBJECT", {
  properties: {
    title: S("STRING", { description: "Title written above the table, or a 2–5 word description" }),
    headers: S("ARRAY", { items: S("STRING") }),
    rows: S("ARRAY", { items: S("ARRAY", { items: S("STRING") }) }),
    doubt: S("ARRAY", {
      items: S("OBJECT", { properties: { row: S("INTEGER"), col: S("INTEGER") }, required: ["row", "col"] }),
      description: "Uncertain cells: zero-based index in rows and zero-based column index",
    }),
  },
  required: ["title", "headers", "rows"],
});

const JOURNAL_SCHEMA = S("OBJECT", {
  properties: {
    rows: S("ARRAY", {
      items: S("OBJECT", {
        properties: {
          cells: S("ARRAY", {
            items: S("OBJECT", {
              properties: { columnId: S("STRING"), value: S("STRING"), doubt: S("BOOLEAN") },
              required: ["columnId", "value"],
            }),
          }),
        },
        required: ["cells"],
      }),
    }),
  },
  required: ["rows"],
});

const JOURNAL_TYPES = ["text", "number", "date", "select", "checkbox"];
const MAX_OPTIONS_IN_PROMPT = 3000;

function journalPrompt(cols: JournalColumn[]): string {
  const lines = cols.map(c => {
    let rule = "";
    if (c.type === "number") rule = "a number, digits only";
    else if (c.type === "date") rule = "a date as YYYY-MM-DD; if the year is not written, use the current year " + new Date().getFullYear();
    else if (c.type === "checkbox") rule = `"true" if marked / ${c.yesLabel || "да"}, "false" if ${c.noLabel || "нет"} / empty mark`;
    else if (c.type === "select") {
      const opts = (c.options || []).slice(0, MAX_OPTIONS_IN_PROMPT).map(o => o.label);
      rule = `exactly one of these options (choose the one matching what is written, e.g. the same person even if written shorter or with typos; if none matches, return the text as written and mark doubt): ${JSON.stringify(opts)}`;
    } else rule = "text as written";
    return `- columnId "${c.id}": «${c.label}»${c.hint ? ` (${c.hint})` : ""} — ${rule}`;
  });
  return [
    "This page is a paper journal (register). Extract every filled row into these columns of the digital journal.",
    "The paper headers may be worded differently or in another order — match them by meaning. Skip paper columns that match nothing. Leave value empty when the cell is empty.",
    "Skip the header row and completely empty rows.",
    "Columns:",
    ...lines,
  ].join("\n");
}

// ── Приведение ответа ИИ к контракту ────────────────────────────────────

function cleanDocument(raw: any): DigitizedDocument {
  const blocks: DigitizedBlock[] = (Array.isArray(raw?.blocks) ? raw.blocks : [])
    .map((b: any) => {
      const type: DigitizedBlockType = BLOCK_TYPES.includes(b?.type) ? b.type : "paragraph";
      const text = str(b?.text, 5000);
      const doubt = (Array.isArray(b?.doubt) ? b.doubt : []).map((d: any) => str(d, 200)).filter((d: string) => d && text.includes(d)).slice(0, 50);
      return { type, text, ...(doubt.length ? { doubt } : {}) };
    })
    .filter((b: DigitizedBlock) => b.text)
    .slice(0, 1000);
  return { title: str(raw?.title, 120), blocks };
}

function cleanTable(raw: any, continueHeaders?: string[]): DigitizedTable {
  let headers = (Array.isArray(raw?.headers) ? raw.headers : []).map((h: any) => str(h, 120)).slice(0, DIGITIZE_LIMITS.maxTableColumns);
  if (continueHeaders?.length && (!headers.length || headers.length === continueHeaders.length)) headers = continueHeaders;
  let rows: string[][] = (Array.isArray(raw?.rows) ? raw.rows : []).slice(0, DIGITIZE_LIMITS.maxRows)
    .map((r: any) => (Array.isArray(r) ? r : []).map((v: any) => str(v, 1000)).slice(0, DIGITIZE_LIMITS.maxTableColumns));
  const width = Math.max(headers.length, ...rows.map(r => r.length), 0);
  headers = Array.from({ length: width }, (_, i) => headers[i] || `Столбец ${i + 1}`);
  rows = rows.map(r => Array.from({ length: width }, (_, i) => r[i] || "")).filter(r => r.some(v => v));
  const doubt = (Array.isArray(raw?.doubt) ? raw.doubt : [])
    .map((d: any) => ({ row: Math.floor(Number(d?.row)), col: Math.floor(Number(d?.col)) }))
    .filter((d: { row: number; col: number }) => d.row >= 0 && d.row < rows.length && d.col >= 0 && d.col < width);
  return { title: str(raw?.title, 120), headers, rows, doubt };
}

function cleanJournal(raw: any, cols: JournalColumn[]): DigitizedJournal {
  const ids = new Set(cols.map(c => c.id));
  const rows = (Array.isArray(raw?.rows) ? raw.rows : []).slice(0, DIGITIZE_LIMITS.maxRows).map((r: any) => {
    const values: Record<string, string> = {};
    const doubt: string[] = [];
    for (const cell of Array.isArray(r?.cells) ? r.cells : []) {
      const id = String(cell?.columnId || "");
      if (!ids.has(id)) continue;
      const v = str(cell?.value, 1000);
      if (v) values[id] = v;
      if (cell?.doubt === true && !doubt.includes(id)) doubt.push(id);
    }
    return { values, doubt };
  }).filter((r: { values: Record<string, string> }) => Object.keys(r.values).length > 0);
  return { rows };
}

// ── Распознавание ───────────────────────────────────────────────────────

/** Одна страница → результат по контракту. Без доступа и лимитов: их проверяет ручка. */
export async function recognizePage(
  mode: DigitizeMode, mimeType: string, base64: string,
  opts: { journalCols?: JournalColumn[]; continueHeaders?: string[] } = {},
): Promise<{ result: DigitizeResult; model: string }> {
  const parts: GeminiPart[] = [{ inlineData: { mimeType, data: base64 } }];
  const cont = opts.continueHeaders || [];
  let schema: Record<string, unknown>;
  if (mode === "document") {
    schema = DOC_SCHEMA;
    parts.push({ text: "Transcribe this page as a document. Use heading for the document title line, subheading for section titles, bullet/numbered for list items, paragraph for everything else. Form fields like «Фамилия: ____» become a paragraph with the filled value." });
  } else if (mode === "table") {
    schema = TABLE_SCHEMA;
    parts.push({ text: cont.length
      ? `This page continues a table with these columns: ${JSON.stringify(cont)}. Return the same headers and put each row's cells in that column order. Skip a repeated header row.`
      : "Transcribe the main table on this page. headers = column headers (merge multi-line headers into one). Every row must have exactly as many cells as headers; use empty string for empty cells." });
  } else {
    schema = JOURNAL_SCHEMA;
    parts.push({ text: journalPrompt(opts.journalCols || []) });
  }
  const { data, model } = await geminiJson<any>({ system: SYSTEM, parts, schema });
  if (mode === "document") return { result: { mode, document: cleanDocument(data) }, model };
  if (mode === "table") return { result: { mode, table: cleanTable(data, cont) }, model };
  return { result: { mode, journal: cleanJournal(data, opts.journalCols || []) }, model };
}

router.post("/:tenantId/recognize", ...guard, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId as string;
    const c = req.caller as Caller;
    const mode = String(req.body?.mode || "") as DigitizeMode;
    if (!["document", "table", "journal"].includes(mode)) return fail(res, 400, "Неизвестный вид оцифровки");

    const image = String(req.body?.image || "");
    if (image.length > DIGITIZE_LIMITS.maxRecognizeImage) return fail(res, 413, "Фото слишком большое");
    const m = DATA_URL.exec(image);
    if (!m) return fail(res, 400, "Нужно фото страницы (JPG или PNG)");

    // Право на то, куда пойдёт результат: документы, таблицы или этот журнал.
    let journalCols: JournalColumn[] = [];
    if (mode === "document" && !can(c, "docs:use")) return fail(res, 403, "Нет доступа к документам");
    if (mode === "table" && !can(c, "sheets:use") && !can(c, "journals:manage")) return fail(res, 403, "Нет доступа к таблицам");
    if (mode === "journal") {
      const jid = str(req.body?.journalId, 128);
      const snap = jid ? await tcol(t, "journals").doc(jid).get() : null;
      const j = snap?.exists ? (snap.data() as Journal) : null;
      if (!j || j.archived) return fail(res, 404, "Журнал не найден");
      if (!roleAtLeast(journalRole(j, c as any), "edit")) return fail(res, 403, "Нет права вести записи в этом журнале");
      journalCols = j.columns.filter(col => JOURNAL_TYPES.includes(col.type) && (!col.managersOnly || roleAtLeast(journalRole(j, c as any), "manage")));
      if (!journalCols.length) return fail(res, 400, "В журнале нет колонок, которые можно заполнить с фото");
    }

    const limit = monthlyLimit(req.tenant);
    const used = await readUsage(t);
    if (used >= limit) return fail(res, 429, `Лимит оцифровки на этот месяц исчерпан: ${limit} стр.`);

    const cont = (Array.isArray(req.body?.continueHeaders) ? req.body.continueHeaders : []).map((h: any) => str(h, 120)).filter(Boolean).slice(0, DIGITIZE_LIMITS.maxTableColumns);
    const { result, model } = await recognizePage(mode, `image/${m[1]}`, m[2], { journalCols, continueHeaders: cont });

    const nowUsed = await addUsage(t, c.uid);
    console.log(`[digitize] ${t} ${mode} by ${c.uid} via ${model}`);
    return res.json({ success: true, result, usage: { used: nowUsed, limit } });
  } catch (e: any) {
    if (e instanceof GeminiError) return fail(res, e.status === 429 ? 429 : 503, e.message);
    return fail(res, 500, e.message);
  }
});

router.get("/:tenantId/usage", ...guard, async (req: any, res: any) => {
  try {
    return res.json({ success: true, usage: { used: await readUsage(req.params.tenantId), limit: monthlyLimit(req.tenant) } });
  } catch (e: any) { return fail(res, 500, e.message); }
});

// ── Оригиналы: раздел «Оцифровка» ───────────────────────────────────────

const SCANS = "digitized_scans";
const TARGETS: DigitizeTargetType[] = ["document", "sheet", "journal"];
/** Все оцифровки видит тот, у кого полный доступ или «Управление сотрудниками»; остальные — свои. */
const seesAll = (c: Caller) => c.full || c.perms.has("team:manage" as PermissionKey);

router.get("/:tenantId/scans", ...guard, async (req: any, res: any) => {
  try {
    const c = req.caller as Caller;
    let q: FirebaseFirestore.Query = tcol(req.params.tenantId, SCANS);
    if (!seesAll(c)) q = q.where("createdBy", "==", c.uid);
    const snap = await q.get();
    const scans = snap.docs.map(d => d.data() as DigitizedScan).sort((a, b) => b.createdAt - a.createdAt).slice(0, 500);
    return res.json({ success: true, scans });
  } catch (e: any) { return fail(res, 500, e.message); }
});

router.post("/:tenantId/scans", ...guard, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId as string;
    const c = req.caller as Caller;
    const b = req.body || {};
    const mode = String(b.mode || "") as DigitizeMode;
    if (!["document", "table", "journal"].includes(mode)) return fail(res, 400, "Неизвестный вид оцифровки");
    const type = String(b.target?.type || "") as DigitizeTargetType;
    const targetId = str(b.target?.id, 128);
    if (!TARGETS.includes(type) || !targetId) return fail(res, 400, "Не указано, куда сохранена оцифровка");
    const pageCount = Math.floor(Number(b.pageCount) || 0);
    if (pageCount < 1 || pageCount > DIGITIZE_LIMITS.maxPages) return fail(res, 400, `Страниц: от 1 до ${DIGITIZE_LIMITS.maxPages}`);

    // Страницы приходят следом по одной (POST …/pages): все сразу не влезут в тело запроса.
    const ref = tcol(t, SCANS).doc();
    const scan: DigitizedScan = {
      id: ref.id, tenantId: t,
      title: str(b.title, 120) || "Оцифровка",
      mode,
      target: { type, id: targetId, title: str(b.target?.title, 120) },
      pageCount,
      itemCount: Math.max(0, Math.floor(Number(b.itemCount) || 0)),
      createdBy: c.uid, createdByName: c.name, createdAt: Date.now(),
    };
    await ref.set(scan);
    await writeAudit(db(), t, { actor: actorOf(req.user), action: "digitize.save", section: "data", detail: `${scan.title}: ${pageCount} стр.`, target: { kind: type, id: targetId, name: scan.target.title || scan.title } });
    return res.json({ success: true, scan });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/** POST …/scans/:scanId/pages { index, image } — одна страница оригинала; только автор оцифровки. */
router.post("/:tenantId/scans/:scanId/pages", ...guard, async (req: any, res: any) => {
  try {
    const got = await loadScan(req, res); if (!got) return;
    if (got.scan.createdBy !== req.caller.uid) return fail(res, 403, "Страницы добавляет автор оцифровки");
    const index = Math.floor(Number(req.body?.index));
    if (!(index >= 0 && index < got.scan.pageCount)) return fail(res, 400, "Неверный номер страницы");
    const image = String(req.body?.image || "");
    // Запас к лимиту: base64 длиннее байтов на треть, плюс префикс data URL.
    if (!DATA_URL.test(image) || image.length > Math.ceil(DIGITIZE_LIMITS.storeMaxBytes * 1.37) + 100) return fail(res, 400, "Страница слишком большая или не изображение");
    // Каждая страница — отдельный документ: несколько фото не влезут в один документ Firestore (1 МБ).
    await got.ref.collection("pages").doc(String(index).padStart(3, "0")).set({ index, image });
    return res.json({ success: true });
  } catch (e: any) { return fail(res, 500, e.message); }
});

async function loadScan(req: any, res: any): Promise<{ ref: FirebaseFirestore.DocumentReference; scan: DigitizedScan } | null> {
  const ref = tcol(req.params.tenantId, SCANS).doc(str(req.params.scanId, 128));
  const snap = await ref.get();
  const scan = snap.exists ? (snap.data() as DigitizedScan) : null;
  if (!scan || (!seesAll(req.caller) && scan.createdBy !== req.caller.uid)) { fail(res, 404, "Оцифровка не найдена"); return null; }
  return { ref, scan };
}

router.get("/:tenantId/scans/:scanId", ...guard, async (req: any, res: any) => {
  try {
    const got = await loadScan(req, res); if (!got) return;
    const pages = await got.ref.collection("pages").orderBy("index").get();
    return res.json({ success: true, scan: got.scan, pages: pages.docs.map(d => String(d.data().image || "")) });
  } catch (e: any) { return fail(res, 500, e.message); }
});

router.delete("/:tenantId/scans/:scanId", ...guard, async (req: any, res: any) => {
  try {
    const got = await loadScan(req, res); if (!got) return;
    const pages = await got.ref.collection("pages").get();
    const batch = db().batch();
    pages.docs.forEach(d => batch.delete(d.ref));
    batch.delete(got.ref);
    await batch.commit();
    await writeAudit(db(), req.params.tenantId, { actor: actorOf(req.user), action: "digitize.delete", section: "data", detail: `${got.scan.title}: оригинал удалён`, target: { kind: got.scan.target.type, id: got.scan.target.id, name: got.scan.title } });
    return res.json({ success: true });
  } catch (e: any) { return fail(res, 500, e.message); }
});

export default router;
