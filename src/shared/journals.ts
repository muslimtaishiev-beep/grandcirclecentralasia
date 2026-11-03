/**
 * Журналы — единственный источник правил.
 *
 * Журнал — это конструктор, а не одна жёстко зашитая таблица: организация
 * собирает колонки из готовых типов, и тот же движок ведёт трудовые
 * отработки, инструктажи, выдачу имущества и что угодно ещё. Отработки —
 * просто первый шаблон.
 *
 * Модуль импортируют и сервер (авторитетная проверка), и браузер (чтобы
 * сотрудник узнал об ошибке до сохранения). Записи пишет только сервер:
 * подпись по QR и сверка имени куратора не должны подделываться с клиента.
 */

export type JournalColumnType =
  | "text" | "number" | "date" | "select" | "checkbox" | "photo"
  | "qr_sign" | "name_sign";

export const COLUMN_TYPE_LABEL: Record<JournalColumnType, string> = {
  text: "Текст",
  number: "Число",
  date: "Дата",
  select: "Выбор из списка",
  checkbox: "Отметка да / нет",
  photo: "Фото",
  qr_sign: "Подпись по QR",
  name_sign: "Подпись по имени",
};

export const COLUMN_TYPE_HINT: Record<JournalColumnType, string> = {
  text: "Свободный текст, например примечание",
  number: "Количество, часы, баллы",
  date: "Дата события или срок",
  select: "Ученик, вид нарушения, класс — список загружается из таблицы",
  checkbox: "Пришёл / не пришёл, сдал / не сдал",
  photo: "Снимок с телефона прямо в запись",
  qr_sign: "Человек сканирует QR своим телефоном и подтверждает — сервер сохраняет время и устройство",
  name_sign: "Сотрудник пишет своё имя, система сверяет со списком разрешённых",
};

export interface SelectOption {
  label: string;
  /** Группа для статистики: класс ученика, отдел сотрудника. */
  group?: string;
}

export type SignSubfieldType = "checkbox" | "text" | "photo";

/** Поле мини-формы, которую видит подписывающий по QR. */
export interface SignSubfield {
  id: string;
  type: SignSubfieldType;
  label: string;
  required: boolean;
  /** Текст сверяется со значением этой колонки записи (например ФИО ученика). */
  matchColumnId?: string;
}

export interface JournalColumn {
  id: string;
  type: JournalColumnType;
  label: string;
  hint?: string;
  /** Заполняют только ответственные за журнал (например вид отработки — завуч). */
  managersOnly?: boolean;
  /** select */
  options?: SelectOption[];
  /** checkbox */
  yesLabel?: string;
  noLabel?: string;
  /** date: при создании записи подставлять сегодняшнюю дату. */
  defaultToday?: boolean;
  /** qr_sign */
  subfields?: SignSubfield[];
  tokenTtlHours?: number;
  /** name_sign */
  allowedNames?: string[];
  allowEmployees?: boolean;
}

export type JournalRole = "view" | "edit" | "manage";
export const ROLE_LABEL: Record<JournalRole, string> = {
  view: "Просмотр и статистика",
  edit: "Ведёт записи",
  manage: "Ответственный (настройки и доступ)",
};
const ROLE_RANK: Record<JournalRole, number> = { view: 1, edit: 2, manage: 3 };
export const roleAtLeast = (r: JournalRole | null | undefined, need: JournalRole) =>
  !!r && ROLE_RANK[r] >= ROLE_RANK[need];

export interface JournalAccess {
  /** Что получают все сотрудники организации, не названные поимённо. */
  everyone: "none" | JournalRole;
  /** uid сотрудника → роль. */
  members: Record<string, JournalRole>;
}

export interface JournalSettings {
  /** Запись закрыта, когда заполнены все эти колонки. */
  doneColumnIds: string[];
  /** Срок: если дата прошла, а запись не закрыта — она просрочена. */
  deadlineColumnId?: string;
  /** Кто в записи — для статистики по людям и группам. */
  personColumnId?: string;
  /** Основная дата записи — для периодов в статистике. */
  dateColumnId?: string;
}

export interface Journal {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  columns: JournalColumn[];
  settings: JournalSettings;
  access: JournalAccess;
  templateKey?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: number;
  updatedAt: number;
  archived?: boolean;
}

/** Метаданные подписи по QR — всё, что сервер знает о моменте подписи. */
export interface SignMeta {
  ip: string;
  userAgent: string;
  acceptLanguage: string;
  timezone: string;
  screen: string;
  platform: string;
  language: string;
  touch: boolean;
  issuedBy: string;
  issuedByName: string;
  issuedAt: number;
  /** Отпечаток значений записи в момент подписи. */
  entryHash: string;
}

export interface QrSignature {
  signedAt: number;
  answers: Record<string, string | boolean>;
  meta: SignMeta;
}

export interface NameSignature {
  /** Имя из списка разрешённых, с которым совпало введённое. */
  name: string;
  /** Как сотрудник написал своё имя. */
  typed: string;
  by: string;
  byName: string;
  at: number;
}

export interface JournalChange {
  at: number;
  by: string;
  byName: string;
  columnId: string;
  from: string;
  to: string;
}

export interface JournalEntry {
  id: string;
  journalId: string;
  values: Record<string, any>;
  createdAt: number;
  createdBy: string;
  createdByName: string;
  updatedAt: number;
  updatedBy?: string;
  deleted?: boolean;
  changes?: JournalChange[];
  /** Отпечаток значений на момент каждой подписи — чтобы показать «правили после подписи». */
  signedHash?: Record<string, string>;
}

// ── Лимиты ──────────────────────────────────────────────────────────────

export const JOURNAL_LIMITS = {
  maxColumns: 40,
  maxOptions: 3000,
  maxSubfields: 10,
  maxAllowedNames: 500,
  maxText: 2000,
  /** Фото — data-URL; документ Firestore не больше 1 МБ. */
  maxPhotoChars: 350 * 1024,
  maxEntryChars: 900 * 1024,
  maxChanges: 200,
  maxBulk: 500,
  maxTokenTtlHours: 24 * 14,
} as const;

// ── Утилиты ─────────────────────────────────────────────────────────────

export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const str = (v: unknown, max = 200) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const ID = /^[a-z][a-z0-9_]{1,40}$/i;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const todayIso = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const isPhotoValue = (v: unknown): v is string =>
  typeof v === "string" && /^data:image\/(jpeg|png|webp);base64,/i.test(v);

/**
 * Список из вставленной таблицы: строка — вариант, второй столбец — группа.
 * Копия из Excel/Google Таблиц приходит с табуляцией, из CSV — с ; или ,.
 */
export function parseOptionsTable(text: string): SelectOption[] {
  const out: SelectOption[] = [];
  const seen = new Set<string>();
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.includes("\t") ? line.split("\t") : line.split(/;|,(?=\s*\S)/);
    const label = str(parts[0], 120);
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    const group = str(parts[1], 60);
    out.push(group ? { label, group } : { label });
  }
  return out;
}

export const optionsToTable = (opts: SelectOption[] = []) =>
  opts.map(o => (o.group ? `${o.label}\t${o.group}` : o.label)).join("\n");

// ── Сверка имён ─────────────────────────────────────────────────────────

// Любые буквы, а не только а–я: кыргызские и казахские (ү, ө, ң, ә…) раньше
// становились разделителями, и «Үмүт» превращалось в «м т». Повторы слова
// убираются: «Анна Анна» не должно считаться двумя словами имени.
const nameTokens = (s: string) =>
  [...new Set(String(s || "").toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/[\s-]+/).filter(Boolean))];

/**
 * Совпадает ли введённое имя с одним из разрешённых.
 *
 * Порядок слов не важен («Иванова Анна» = «Анна Иванова»), ё = е, регистр
 * не важен. Отчество можно не писать: два слова из трёх засчитываются.
 * Одного слова мало — «Анна» совпала бы с половиной школы.
 */
export function matchName(input: string, candidates: string[]): string | null {
  const t = nameTokens(input);
  if (!t.length) return null;
  for (const c of candidates) {
    const ct = nameTokens(c);
    if (!ct.length) continue;
    if (ct.length === 1) { if (t.length === 1 && t[0] === ct[0]) return c; continue; }
    if (t.length < 2) continue;
    if (t.every(x => ct.includes(x)) && t.length >= Math.min(2, ct.length)) return c;
  }
  return null;
}

// ── Колонки ─────────────────────────────────────────────────────────────

const TYPES = Object.keys(COLUMN_TYPE_LABEL) as JournalColumnType[];

/** Колонки из запроса → безопасный вид. Неизвестное отбрасывается. */
export function sanitizeColumns(raw: unknown): JournalColumn[] {
  const list = Array.isArray(raw) ? raw.slice(0, JOURNAL_LIMITS.maxColumns) : [];
  const out: JournalColumn[] = [];
  const ids = new Set<string>();
  for (const r of list as any[]) {
    const type = TYPES.includes(r?.type) ? (r.type as JournalColumnType) : null;
    if (!type) continue;
    let id = str(r?.id, 42);
    if (!ID.test(id) || ids.has(id)) id = newId("c");
    ids.add(id);
    const col: JournalColumn = { id, type, label: str(r?.label, 80) || COLUMN_TYPE_LABEL[type] };
    const hint = str(r?.hint, 200);
    if (hint) col.hint = hint;
    if (r?.managersOnly === true) col.managersOnly = true;
    if (type === "select") {
      const opts: SelectOption[] = [];
      const seen = new Set<string>();
      for (const o of (Array.isArray(r?.options) ? r.options : []).slice(0, JOURNAL_LIMITS.maxOptions)) {
        const label = str(typeof o === "string" ? o : o?.label, 120);
        if (!label || seen.has(label.toLowerCase())) continue;
        seen.add(label.toLowerCase());
        const group = str(o?.group, 60);
        opts.push(group ? { label, group } : { label });
      }
      col.options = opts;
    }
    if (type === "checkbox") {
      col.yesLabel = str(r?.yesLabel, 40) || "Да";
      col.noLabel = str(r?.noLabel, 40) || "Нет";
    }
    if (type === "date" && r?.defaultToday === true) col.defaultToday = true;
    if (type === "qr_sign") {
      const subs: SignSubfield[] = [];
      const sids = new Set<string>();
      for (const s of (Array.isArray(r?.subfields) ? r.subfields : []).slice(0, JOURNAL_LIMITS.maxSubfields)) {
        const st: SignSubfieldType | null = ["checkbox", "text", "photo"].includes(s?.type) ? s.type : null;
        if (!st) continue;
        let sid = str(s?.id, 42);
        if (!ID.test(sid) || sids.has(sid)) sid = newId("s");
        sids.add(sid);
        const sub: SignSubfield = { id: sid, type: st, label: str(s?.label, 300) || "Подтверждаю", required: s?.required !== false };
        if (st === "text" && s?.matchColumnId) sub.matchColumnId = str(s.matchColumnId, 42);
        subs.push(sub);
      }
      if (!subs.length) subs.push({ id: newId("s"), type: "checkbox", label: "Подтверждаю", required: true });
      col.subfields = subs;
      const ttl = Math.round(Number(r?.tokenTtlHours));
      col.tokenTtlHours = Number.isFinite(ttl) && ttl > 0 ? Math.min(ttl, JOURNAL_LIMITS.maxTokenTtlHours) : 24;
    }
    if (type === "name_sign") {
      const names = (Array.isArray(r?.allowedNames) ? r.allowedNames : [])
        .map((n: unknown) => str(n, 120)).filter(Boolean);
      col.allowedNames = [...new Set<string>(names)].slice(0, JOURNAL_LIMITS.maxAllowedNames);
      col.allowEmployees = r?.allowEmployees !== false;
    }
    out.push(col);
  }
  // Сверка в подписи может ссылаться только на существующую колонку.
  for (const c of out) for (const s of c.subfields || []) {
    if (s.matchColumnId && !out.some(x => x.id === s.matchColumnId && x.id !== c.id)) delete s.matchColumnId;
  }
  return out;
}

export function sanitizeSettings(raw: any, columns: JournalColumn[]): JournalSettings {
  const has = (id: unknown, types?: JournalColumnType[]) =>
    columns.some(c => c.id === id && (!types || types.includes(c.type)));
  const done = (Array.isArray(raw?.doneColumnIds) ? raw.doneColumnIds : []).map((x: unknown) => String(x)).filter((x: string) => has(x));
  const s: JournalSettings = { doneColumnIds: [...new Set<string>(done)] };
  if (has(raw?.deadlineColumnId, ["date"])) s.deadlineColumnId = String(raw.deadlineColumnId);
  if (has(raw?.personColumnId, ["select", "text"])) s.personColumnId = String(raw.personColumnId);
  if (has(raw?.dateColumnId, ["date"])) s.dateColumnId = String(raw.dateColumnId);
  return s;
}

export function sanitizeAccess(raw: any): JournalAccess {
  const roles: JournalRole[] = ["view", "edit", "manage"];
  const everyone = roles.includes(raw?.everyone) ? raw.everyone : "none";
  const members: Record<string, JournalRole> = {};
  for (const [uid, r] of Object.entries(raw?.members || {}).slice(0, 500)) {
    if (/^[\w-]{6,128}$/.test(uid) && roles.includes(r as JournalRole)) members[uid] = r as JournalRole;
  }
  return { everyone, members };
}

// ── Значения ────────────────────────────────────────────────────────────

export type NormalizeResult = { ok: true; value: any } | { ok: false; error: string };

/**
 * Значение обычной колонки → сохраняемый вид. Подписи сюда не приходят:
 * их пишет только сервер по своим правилам.
 * null / "" — очистить ячейку.
 */
export function normalizeValue(col: JournalColumn, v: unknown): NormalizeResult {
  if (v === null || v === undefined || v === "") return { ok: true, value: null };
  switch (col.type) {
    case "text": return { ok: true, value: str(v, JOURNAL_LIMITS.maxText) || null };
    case "number": {
      const n = Number(String(v).replace(",", "."));
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: `«${col.label}»: нужно число` };
    }
    case "date": {
      const s = String(v).slice(0, 10);
      return DATE.test(s) ? { ok: true, value: s } : { ok: false, error: `«${col.label}»: неверная дата` };
    }
    case "select": {
      const s = str(v, 120).toLowerCase();
      const hit = (col.options || []).find(o => o.label.toLowerCase() === s);
      return hit ? { ok: true, value: hit.label } : { ok: false, error: `«${col.label}»: такого варианта нет в списке` };
    }
    case "checkbox":
      if (v === true || v === "true") return { ok: true, value: true };
      if (v === false || v === "false") return { ok: true, value: false };
      return { ok: false, error: `«${col.label}»: нужно да или нет` };
    case "photo":
      if (!isPhotoValue(v)) return { ok: false, error: `«${col.label}»: можно приложить только фото` };
      if (v.length > JOURNAL_LIMITS.maxPhotoChars) return { ok: false, error: `«${col.label}»: фото слишком большое` };
      return { ok: true, value: v };
    default:
      return { ok: false, error: `«${col.label}» заполняется подписью` };
  }
}

export const isSignColumn = (c: JournalColumn) => c.type === "qr_sign" || c.type === "name_sign";

export function isFilled(col: JournalColumn, v: any): boolean {
  if (v === null || v === undefined || v === "") return false;
  if (col.type === "checkbox") return v === true;
  if (col.type === "qr_sign") return typeof v?.signedAt === "number";
  if (col.type === "name_sign") return !!v?.name;
  return true;
}

/** Ячейка как текст — для поиска, CSV и истории правок. */
export function displayValue(col: JournalColumn, v: any): string {
  if (v === null || v === undefined || v === "") return "";
  switch (col.type) {
    case "checkbox": return v === true ? (col.yesLabel || "Да") : v === false ? (col.noLabel || "Нет") : "";
    case "date": { const [y, m, d] = String(v).split("-"); return d ? `${d}.${m}.${y}` : String(v); }
    case "photo": return "фото";
    case "qr_sign": return v?.signedAt ? `подписано ${new Date(v.signedAt).toLocaleString("ru-RU")}` : "";
    case "name_sign": return v?.name || "";
    default: return String(v);
  }
}

/**
 * Значения записи без подписей в устойчивом порядке — для отпечатка.
 * Подписи не входят: подпись куратора после подписи ученика — не правка.
 */
export function hashableValues(columns: JournalColumn[], values: Record<string, any>): string {
  const pick: Record<string, unknown> = {};
  for (const c of [...columns].sort((a, b) => a.id.localeCompare(b.id))) {
    if (isSignColumn(c)) continue;
    const v = values?.[c.id];
    if (v === null || v === undefined) continue;
    pick[c.id] = v;
  }
  return JSON.stringify(pick);
}

// ── Статус записи ──────────────────────────────────────────────────────

export type EntryStatus = "done" | "open" | "overdue";
export const STATUS_LABEL: Record<EntryStatus, string> = { done: "Закрыта", open: "Открыта", overdue: "Просрочена" };

export function entryStatus(j: Pick<Journal, "columns" | "settings">, e: Pick<JournalEntry, "values">, today = todayIso()): EntryStatus {
  const need = j.settings.doneColumnIds.map(id => j.columns.find(c => c.id === id)).filter(Boolean) as JournalColumn[];
  if (need.length && need.every(c => isFilled(c, e.values?.[c.id]))) return "done";
  const dl = j.settings.deadlineColumnId ? e.values?.[j.settings.deadlineColumnId] : null;
  if (typeof dl === "string" && dl < today) return "overdue";
  return "open";
}

// ── Статистика ─────────────────────────────────────────────────────────

export interface StatRow { label: string; total: number; done: number; open: number; overdue: number }
export interface JournalStats {
  total: number; done: number; open: number; overdue: number;
  byColumn: { column: JournalColumn; rows: StatRow[]; empty: number }[];
  byGroup: StatRow[];
  people: StatRow[];
  byMonth: StatRow[];
  signatures: { column: JournalColumn; signed: number; unsigned: number }[];
  signers: StatRow[];
}

const bump = (m: Map<string, StatRow>, label: string, st: EntryStatus) => {
  const r = m.get(label) || { label, total: 0, done: 0, open: 0, overdue: 0 };
  r.total++; r[st]++;
  m.set(label, r);
};
const sorted = (m: Map<string, StatRow>) => [...m.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "ru"));

export function computeStats(j: Pick<Journal, "columns" | "settings">, entries: Pick<JournalEntry, "values">[], today = todayIso()): JournalStats {
  const s: JournalStats = { total: 0, done: 0, open: 0, overdue: 0, byColumn: [], byGroup: [], people: [], byMonth: [], signatures: [], signers: [] };
  const colMaps = new Map<string, { m: Map<string, StatRow>; empty: number }>();
  const groups = new Map<string, StatRow>(), people = new Map<string, StatRow>(), months = new Map<string, StatRow>(), signers = new Map<string, StatRow>();
  const sig = new Map<string, { signed: number; unsigned: number }>();
  const person = j.columns.find(c => c.id === j.settings.personColumnId);
  const groupOf = new Map((person?.options || []).filter(o => o.group).map(o => [o.label, o.group as string]));
  const dateCol = j.settings.dateColumnId;

  for (const e of entries) {
    const st = entryStatus(j, e, today);
    s.total++; s[st]++;
    for (const c of j.columns) {
      const v = e.values?.[c.id];
      if (c.type === "select" || c.type === "checkbox") {
        const slot = colMaps.get(c.id) || { m: new Map(), empty: 0 };
        const label = displayValue(c, v);
        if (label) bump(slot.m, label, st); else slot.empty++;
        colMaps.set(c.id, slot);
      }
      if (isSignColumn(c)) {
        const x = sig.get(c.id) || { signed: 0, unsigned: 0 };
        if (isFilled(c, v)) x.signed++; else x.unsigned++;
        sig.set(c.id, x);
        if (c.type === "name_sign" && v?.name) bump(signers, v.name, st);
      }
    }
    if (person) {
      const p = displayValue(person, e.values?.[person.id]);
      if (p) {
        bump(people, p, st);
        const g = groupOf.get(p);
        if (g) bump(groups, g, st);
      }
    }
    if (dateCol) {
      const d = e.values?.[dateCol];
      if (typeof d === "string" && d.length >= 7) bump(months, d.slice(0, 7), st);
    }
  }
  for (const c of j.columns) {
    const slot = colMaps.get(c.id);
    if (slot && c.id !== person?.id) s.byColumn.push({ column: c, rows: sorted(slot.m), empty: slot.empty });
    const x = sig.get(c.id);
    if (x) s.signatures.push({ column: c, ...x });
  }
  s.byGroup = sorted(groups);
  s.people = sorted(people);
  s.byMonth = [...months.values()].sort((a, b) => a.label.localeCompare(b.label));
  s.signers = sorted(signers);
  return s;
}

// ── Шаблоны ─────────────────────────────────────────────────────────────

export interface JournalTemplate {
  key: string;
  title: string;
  description: string;
  columns: JournalColumn[];
  settings: JournalSettings;
}

export const JOURNAL_TEMPLATES: JournalTemplate[] = [
  {
    key: "labor",
    title: "Трудовые отработки",
    description: "Нарушение → вид отработки от завуча → отработка с подписью ученика по QR и подписью куратора",
    columns: [
      { id: "student", type: "select", label: "Ученик", hint: "Список учеников с классами — загрузите из таблицы в настройках", options: [] },
      { id: "violation_date", type: "date", label: "Дата нарушения", defaultToday: true },
      { id: "violation", type: "select", label: "Вид нарушения", options: [
        { label: "Опоздание" }, { label: "Нарушение формы одежды" }, { label: "Телефон на уроке" },
        { label: "Нарушение дисциплины" }, { label: "Порча имущества" }, { label: "Другое" },
      ] },
      { id: "work", type: "select", label: "Вид отработки", managersOnly: true, hint: "Назначает завуч", options: [
        { label: "Уборка класса" }, { label: "Уборка территории" }, { label: "Помощь в столовой" },
        { label: "Помощь в библиотеке" }, { label: "Дежурство" },
      ] },
      { id: "work_date", type: "date", label: "Дата отработки", hint: "Срок: после него незакрытая запись — просрочена" },
      { id: "came", type: "checkbox", label: "Явка", yesLabel: "Пришёл", noLabel: "Не пришёл" },
      { id: "student_sign", type: "qr_sign", label: "Подпись отработавшего", tokenTtlHours: 24, subfields: [
        { id: "agree", type: "checkbox", label: "Подтверждаю, что отработал(а) назначенную отработку", required: true },
        { id: "fio", type: "text", label: "Ваши фамилия и имя", required: true, matchColumnId: "student" },
      ] },
      { id: "curator_sign", type: "name_sign", label: "Подпись куратора", allowedNames: [], allowEmployees: true },
      { id: "note", type: "text", label: "Примечание" },
    ],
    settings: { doneColumnIds: ["student_sign", "curator_sign"], deadlineColumnId: "work_date", personColumnId: "student", dateColumnId: "violation_date" },
  },
  {
    key: "safety",
    title: "Инструктаж по технике безопасности",
    description: "Кто прошёл инструктаж, какой, подпись инструктируемого по QR и проводившего",
    columns: [
      { id: "person", type: "select", label: "Инструктируемый", options: [] },
      { id: "date", type: "date", label: "Дата", defaultToday: true },
      { id: "kind", type: "select", label: "Вид инструктажа", options: [
        { label: "Вводный" }, { label: "Первичный" }, { label: "Повторный" }, { label: "Внеплановый" }, { label: "Целевой" },
      ] },
      { id: "person_sign", type: "qr_sign", label: "Подпись инструктируемого", tokenTtlHours: 24, subfields: [
        { id: "agree", type: "checkbox", label: "Инструктаж прослушал(а), правила понятны", required: true },
        { id: "fio", type: "text", label: "Ваши фамилия и имя", required: true, matchColumnId: "person" },
      ] },
      { id: "lead_sign", type: "name_sign", label: "Подпись проводившего", allowedNames: [], allowEmployees: true },
    ],
    settings: { doneColumnIds: ["person_sign", "lead_sign"], personColumnId: "person", dateColumnId: "date" },
  },
  {
    key: "inventory",
    title: "Выдача имущества",
    description: "Что, кому и когда выдано, подпись получения по QR, отметка о возврате",
    columns: [
      { id: "person", type: "select", label: "Получатель", options: [] },
      { id: "item", type: "select", label: "Что выдано", options: [] },
      { id: "issued", type: "date", label: "Дата выдачи", defaultToday: true },
      { id: "due", type: "date", label: "Вернуть до" },
      { id: "receive_sign", type: "qr_sign", label: "Подпись получения", tokenTtlHours: 24, subfields: [
        { id: "agree", type: "checkbox", label: "Получил(а), обязуюсь вернуть в срок и в целости", required: true },
        { id: "photo", type: "photo", label: "Фото полученного", required: false },
      ] },
      { id: "returned", type: "checkbox", label: "Возврат", yesLabel: "Вернул", noLabel: "Не вернул" },
    ],
    settings: { doneColumnIds: ["returned"], deadlineColumnId: "due", personColumnId: "person", dateColumnId: "issued" },
  },
];

export const BLANK_TEMPLATE: JournalTemplate = {
  key: "blank",
  title: "Новый журнал",
  description: "",
  columns: [
    { id: "person", type: "select", label: "Кто", options: [] },
    { id: "date", type: "date", label: "Дата", defaultToday: true },
    { id: "note", type: "text", label: "Примечание" },
  ],
  settings: { doneColumnIds: [], personColumnId: "person", dateColumnId: "date" },
};

// ── Лидерборд не отработанных ───────────────────────────────────────────

export interface LeaderRow {
  person: string;
  group: string;
  total: number;
  done: number;
  /** Не закрыто: открыто + просрочено. */
  unfinished: number;
  overdue: number;
  /** Отметок «нет» в колонках да/нет — для отработок это «не пришёл». */
  noShow: number;
  /** Последняя дата по основной колонке даты. */
  lastDate: string;
}

/**
 * Кто чаще всего не закрывает записи. Сортировка: больше незакрытых,
 * затем больше просроченных, затем больше неявок.
 */
export function leaderboard(j: Pick<Journal, "columns" | "settings">, entries: Pick<JournalEntry, "values">[], today = todayIso()): LeaderRow[] {
  const person = j.columns.find(c => c.id === j.settings.personColumnId);
  if (!person) return [];
  const groupOf = new Map((person.options || []).map(o => [o.label, o.group || ""]));
  const checks = j.columns.filter(c => c.type === "checkbox");
  const dateCol = j.settings.dateColumnId;
  const rows = new Map<string, LeaderRow>();
  for (const e of entries) {
    const name = displayValue(person, e.values?.[person.id]);
    if (!name) continue;
    const r = rows.get(name) || { person: name, group: groupOf.get(name) || "", total: 0, done: 0, unfinished: 0, overdue: 0, noShow: 0, lastDate: "" };
    const st = entryStatus(j, e, today);
    r.total++;
    if (st === "done") r.done++; else r.unfinished++;
    if (st === "overdue") r.overdue++;
    if (checks.some(c => e.values?.[c.id] === false)) r.noShow++;
    const d = dateCol ? e.values?.[dateCol] : "";
    if (typeof d === "string" && d > r.lastDate) r.lastDate = d;
    rows.set(name, r);
  }
  return [...rows.values()].sort((a, b) =>
    b.unfinished - a.unfinished || b.overdue - a.overdue || b.noShow - a.noShow || b.total - a.total || a.person.localeCompare(b.person, "ru"));
}

/** Подпись «нет» первой колонки да/нет — заголовок для неявок. */
export const noShowLabel = (j: Pick<Journal, "columns">) =>
  j.columns.find(c => c.type === "checkbox")?.noLabel || "Отметка «нет»";
