/**
 * Экзамены: банк вопросов организации — единственный источник правил.
 *
 * Банк общий на организацию и разбит на дисциплины с кодом (LOG, MAT…).
 * Дисциплина не принадлежит одному экзамену: логика Академии одинакова для
 * всех классов, и экзамены разных классов берут её из одного места. Классы
 * (или любые другие уровни) — пометки на вопросе внутри дисциплины.
 *
 * У вопроса постоянный номер «КОД-0001»: по нему вопрос обновляется при
 * повторном импорте и находится в результатах.
 *
 * Типы вопросов — те же, что в прежнем вступительном тесте; отрисовка
 * (components/tests/QuestionFactory) и проверка ответа
 * (lib/scoringEngine.isAnswerCorrect) остаются прежними, чтобы перенесённые
 * вопросы вели себя ровно так же. Импортируют модуль и сервер, и браузер.
 */

export type QuestionType =
  | "multiple_choice" | "free_text" | "number_input" | "two_step"
  | "inline_dropdown" | "dropdown_multiple" | "logic_matrix" | "drag_and_drop"
  | "inline_inputs" | "clickable_text";

export const QUESTION_TYPES: { key: QuestionType; label: string; hint: string }[] = [
  { key: "multiple_choice", label: "Выбор ответа", hint: "Один верный вариант из нескольких" },
  { key: "free_text", label: "Ответ текстом", hint: "Короткий ответ словом или фразой" },
  { key: "number_input", label: "Ответ числом", hint: "Число; единицы после числа не мешают" },
  { key: "two_step", label: "Найти и исправить", hint: "Список предложений и поле для исправленного слова" },
  { key: "inline_dropdown", label: "Выбор в пропуске", hint: "Предложение с [gap] и выпадающим списком" },
  { key: "dropdown_multiple", label: "Несколько списков", hint: "Каждому пункту — свой выпадающий список" },
  { key: "logic_matrix", label: "Логическая таблица", hint: "Строки сопоставить со столбцами" },
  { key: "drag_and_drop", label: "Упорядочить", hint: "Расставить элементы в правильном порядке" },
  { key: "inline_inputs", label: "Пропуски в тексте", hint: "Вписать буквы или слова в несколько пропусков" },
  { key: "clickable_text", label: "Расставить знаки", hint: "Отметить места, где нужна запятая" },
];
export const TYPE_LABEL = Object.fromEntries(QUESTION_TYPES.map(t => [t.key, t.label])) as Record<QuestionType, string>;
export const isQuestionType = (v: unknown): v is QuestionType => QUESTION_TYPES.some(t => t.key === v);

export interface DropdownItem { label: string; options: string[] }
export type InlineSegment = { type: "text"; text: string } | { type: "input"; id: string };
export interface ClickableSegment { text: string; id?: string; isTarget?: boolean }

/** Содержимое вопроса — поля, которые видит ученик. */
export interface QuestionContent {
  text: string;
  html?: string;
  instruction?: string;
  options?: string[];
  optionsHtml?: string[];
  step2Text?: string;
  inlineOptions?: string[];
  dropdownItems?: DropdownItem[];
  matrixRows?: string[];
  matrixCols?: string[];
  dragItems?: string[];
  inlineSegments?: InlineSegment[];
  clickableSegments?: ClickableSegment[];
}

export type Difficulty = 1 | 2 | 3;
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { 1: "Лёгкий", 2: "Средний", 3: "Сложный" };

export interface BankQuestion extends QuestionContent {
  id: string;
  tenantId: string;
  disciplineId: string;
  number: number;
  /** Классы или любые уровни: «7», «8»… Пусто — подходит всем. */
  levels: string[];
  topic: string;
  difficulty: Difficulty;
  type: QuestionType;
  points: number;
  /** Ключ ответа. Несколько допустимых — через «||». Ученику не отдаётся. */
  answer: string;
  active: boolean;
  /** Порядок в исходном тесте — для экзаменов с фиксированным набором. */
  order?: number;
  source?: { kind: string; ref?: string; levels?: string[] };
  /** Наборы (отдельные банки), в которые входит вопрос: «Вступительный 2026», «Контрольная 1 четверть». */
  sets?: string[];
  createdAt: number;
  updatedAt: number;
  updatedBy?: string;
}

/**
 * Набор — отдельный банк внутри банка организации. Вопросы по-прежнему
 * разложены по дисциплинам, а набор отвечает на вопрос «для чего»: экзамен
 * подключает дисциплину из конкретного набора, и вопросы контрольной не
 * попадают во вступительный тест того же класса.
 */
export interface QuestionSet {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}
export const SET_ID = /^set_[a-z0-9]{4,24}$/;
export const normalizeSetIds = (v: unknown): string[] =>
  [...new Set((Array.isArray(v) ? v : []).map(x => String(x ?? "").trim()).filter(x => SET_ID.test(x)))].slice(0, 20);

export interface Discipline {
  code: string;
  name: string;
  description?: string;
  nextNumber: number;
  createdAt: number;
  updatedAt: number;
}

export const DISCIPLINE_CODE = /^[A-Z][A-Z0-9]{1,7}$/;
export const questionId = (code: string, n: number) => `${code}-${String(n).padStart(4, "0")}`;
export const QUESTION_ID = /^([A-Z][A-Z0-9]{1,7})-(\d{4,6})$/;

export const LIMITS = { text: 4000, option: 600, options: 12, items: 20, segments: 80, levels: 30, topic: 160 } as const;

// ── Санитизация ─────────────────────────────────────────────────────────

const str = (v: unknown, max = 600) => String(v ?? "").replace(/\u0000/g, "").trim().slice(0, max);
const strList = (v: unknown, max: number = LIMITS.options, len: number = LIMITS.option) =>
  (Array.isArray(v) ? v : []).map(x => str(x, len)).filter(Boolean).slice(0, max);

export function normalizeLevels(v: unknown): string[] {
  // Пробел — часть уровня («7 А»), разделители — только ; , и перенос строки.
  const raw = Array.isArray(v) ? v : String(v ?? "").split(/[;,\n]+/);
  const out = raw.map(x => str(x, 20)).filter(Boolean);
  return [...new Set(out)].slice(0, LIMITS.levels).sort((a, b) => (Number(a) - Number(b)) || a.localeCompare(b, "ru"));
}

/** Содержимое из запроса → только поля своего типа. */
export function sanitizeContent(type: QuestionType, raw: any): QuestionContent {
  const c: QuestionContent = { text: str(raw?.text, LIMITS.text) };
  const html = str(raw?.html, LIMITS.text * 2); if (html) c.html = html;
  const instruction = str(raw?.instruction, 400); if (instruction) c.instruction = instruction;
  switch (type) {
    case "multiple_choice": {
      c.options = strList(raw?.options);
      const oh = strList(raw?.optionsHtml, LIMITS.options, LIMITS.option * 4);
      if (oh.length) c.optionsHtml = oh;
      break;
    }
    case "two_step":
      c.options = strList(raw?.options, LIMITS.items);
      c.step2Text = str(raw?.step2Text, 400);
      break;
    case "inline_dropdown":
      c.inlineOptions = strList(raw?.inlineOptions ?? raw?.options);
      break;
    case "dropdown_multiple":
      c.dropdownItems = (Array.isArray(raw?.dropdownItems) ? raw.dropdownItems : []).slice(0, LIMITS.items)
        .map((d: any) => ({ label: str(d?.label, 300), options: strList(d?.options) }))
        .filter((d: DropdownItem) => d.label || d.options.length);
      break;
    case "logic_matrix":
      c.matrixRows = strList(raw?.matrixRows, LIMITS.items, 200);
      c.matrixCols = strList(raw?.matrixCols, LIMITS.items, 200);
      break;
    case "drag_and_drop":
      c.dragItems = strList(raw?.dragItems, LIMITS.items, 300);
      break;
    case "inline_inputs": {
      let n = 0;
      c.inlineSegments = (Array.isArray(raw?.inlineSegments) ? raw.inlineSegments : []).slice(0, LIMITS.segments)
        .map((s: any): InlineSegment | null => s?.type === "input"
          ? { type: "input", id: str(s.id, 40) || `input${++n}` }
          : (s?.text ? { type: "text", text: String(s.text).slice(0, 1000) } : null))
        .filter(Boolean) as InlineSegment[];
      break;
    }
    case "clickable_text":
      c.clickableSegments = (Array.isArray(raw?.clickableSegments) ? raw.clickableSegments : []).slice(0, LIMITS.segments)
        .map((s: any) => {
          const seg: ClickableSegment = { text: String(s?.text ?? "").slice(0, 1000) };
          const id = str(s?.id, 20);
          if (id) { seg.id = id; seg.isTarget = s?.isTarget === true; }
          return seg;
        })
        .filter((s: ClickableSegment) => s.text || s.id);
      break;
  }
  return c;
}

export const CONTENT_KEYS: (keyof QuestionContent)[] = [
  "text", "html", "instruction", "options", "optionsHtml", "step2Text", "inlineOptions",
  "dropdownItems", "matrixRows", "matrixCols", "dragItems", "inlineSegments", "clickableSegments",
];

/**
 * Только то, что можно показать ученику: без ключа и служебных полей.
 * У «Расставить знаки» ключ спрятан и в разметке — флаг isTarget у мест
 * для запятой; его тоже вырезаем, иначе ответ виден в инструментах браузера.
 */
export function studentView(q: BankQuestion): QuestionContent & { id: string; type: QuestionType; points: number } {
  const out: any = { id: q.id, type: q.type, points: q.points };
  for (const k of CONTENT_KEYS) if (q[k] !== undefined) out[k] = q[k];
  if (out.clickableSegments) out.clickableSegments = out.clickableSegments.map(({ isTarget: _t, ...s }: ClickableSegment) => s);
  return out;
}

// ── Проверка вопроса ────────────────────────────────────────────────────

export interface QuestionIssue { level: "error" | "warning"; message: string }

const fold = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();

/**
 * Что не так с вопросом. Ошибка — вопрос нельзя сохранить; предупреждение —
 * можно, но стоит посмотреть (например, ответ не совпал ни с одним вариантом
 * буквально — проверка всё равно засчитает «Б» для «Б) …»).
 */
export function validateQuestion(q: Pick<BankQuestion, "type" | "answer" | "points" | "difficulty"> & QuestionContent): QuestionIssue[] {
  const out: QuestionIssue[] = [];
  const err = (message: string) => out.push({ level: "error", message });
  const warn = (message: string) => out.push({ level: "warning", message });
  if (!q.text && !q.html) err("Нет текста вопроса");
  if (!q.answer?.trim()) err("Нет правильного ответа");
  if (!(q.points > 0)) err("Баллы должны быть больше нуля");
  const alts = (q.answer || "").split("||").map(a => a.trim()).filter(Boolean);
  const parts = (a: string) => a.split(/\s*,\s*/).filter(Boolean);
  switch (q.type) {
    case "multiple_choice": {
      const opts = q.options || [];
      if (opts.length < 2) err("Нужно хотя бы два варианта ответа");
      const hit = alts.some(a => opts.some(o => fold(o) === fold(a) || fold(o).startsWith(fold(a) + ")") || fold(o).startsWith(fold(a) + ".") || fold(o).startsWith(fold(a) + " ")));
      if (opts.length && alts.length && !hit) warn("Ответ не совпадает ни с одним вариантом — проверьте");
      break;
    }
    case "number_input":
      if (alts.length && !alts.every(a => /^-?\d+(?:[.,]\d+)?$/.test(a))) warn("Для ответа числом ключ должен быть числом");
      break;
    case "two_step":
      if (!(q.options || []).length) warn("Нет предложений, среди которых искать ошибку");
      break;
    case "inline_dropdown":
      if ((q.inlineOptions || []).length < 2) err("Нужно хотя бы два варианта для пропуска");
      else if (alts.length && !alts.some(a => (q.inlineOptions || []).some(o => fold(o) === fold(a)))) warn("Ответ не совпадает ни с одним вариантом");
      break;
    case "dropdown_multiple": {
      const items = q.dropdownItems || [];
      if (!items.length) err("Нет ни одного списка");
      if (items.some(i => i.options.length < 2)) err("В каждом списке нужно хотя бы два варианта");
      if (alts[0] && parts(alts[0]).length !== items.length) warn(`В ответе ${parts(alts[0]).length} знач., а списков ${items.length}`);
      break;
    }
    case "logic_matrix":
      if ((q.matrixRows || []).length < 2 || (q.matrixCols || []).length < 2) err("Нужно хотя бы две строки и два столбца");
      if (alts[0] && !alts[0].includes("-")) warn("Ответ записывается парами «Строка-Столбец» через запятую");
      break;
    case "drag_and_drop": {
      const items = q.dragItems || [];
      if (items.length < 2) err("Нужно хотя бы два элемента");
      if (alts[0]) {
        const want = parts(alts[0]).map(fold).sort().join("|");
        if (want !== items.map(fold).sort().join("|")) warn("Ответ должен содержать те же элементы, что и список");
      }
      break;
    }
    case "inline_inputs": {
      const n = (q.inlineSegments || []).filter(s => s.type === "input").length;
      if (!n) err("Нет ни одного пропуска");
      if (alts[0] && parts(alts[0]).length !== n) warn(`В ответе ${parts(alts[0]).length} знач., а пропусков ${n}`);
      break;
    }
    case "clickable_text": {
      const ids = (q.clickableSegments || []).filter(s => s.id).map(s => String(s.id));
      if (!ids.length) err("Нет ни одного места для знака");
      if (alts[0] && parts(alts[0]).some(p => !ids.includes(p))) warn("В ответе есть номер места, которого нет в тексте");
      break;
    }
  }
  return out;
}

/**
 * Ключ ответа из разметки вопроса, где он однозначен: для «расставить знаки»
 * — отмеченные места. Удобно в редакторе: отметил места — ключ готов.
 */
export function derivedAnswer(q: QuestionContent & { type: QuestionType }): string | null {
  if (q.type === "clickable_text") {
    const ids = (q.clickableSegments || []).filter(s => s.id && s.isTarget).map(s => String(s.id));
    return ids.length ? ids.join(", ") : null;
  }
  return null;
}

/** Текст вопроса без разметки — для списков и поиска. */
export function plainText(q: QuestionContent): string {
  const t = q.text || (q.html || "").replace(/<[^>]+>/g, " ");
  if (t.trim()) return t.replace(/\s+/g, " ").trim();
  const seg = (q.inlineSegments || []).map(s => (s.type === "text" ? s.text : "___")).join("");
  return seg.replace(/\s+/g, " ").trim();
}

// ── Импорт и экспорт таблицей ───────────────────────────────────────────

/**
 * Колонки таблицы банка. Выгрузка пишет ровно их, импорт принимает их же
 * (и привычные синонимы), поэтому выгруженный банк можно поправить в Excel
 * и загрузить обратно: строки с номером обновят свои вопросы.
 *
 * Простые типы описываются колонками целиком. Сложной разметке (таблица,
 * пропуски, знаки, несколько списков) — колонка «Данные (JSON)»; её
 * заполняет выгрузка, руками её обычно не пишут.
 */
export const SHEET_COLUMNS = [
  "Номер", "Дисциплина", "Наборы", "Классы", "Тема", "Сложность", "Тип", "Баллы",
  "Вопрос", "Инструкция", "Варианты", "Правильный ответ", "Активен", "Данные (JSON)",
] as const;

const HEADER_ALIASES: Record<string, (typeof SHEET_COLUMNS)[number]> = {
  "номер": "Номер", "id": "Номер", "№": "Номер",
  "дисциплина": "Дисциплина", "код дисциплины": "Дисциплина", "код": "Дисциплина", "предмет": "Дисциплина",
  "классы": "Классы", "класс": "Классы", "уровни": "Классы", "уровень": "Классы", "группы": "Классы",
  "тема": "Тема", "сложность": "Сложность", "тип": "Тип", "баллы": "Баллы", "балл": "Баллы",
  "вопрос": "Вопрос", "текст": "Вопрос", "текст вопроса": "Вопрос",
  "инструкция": "Инструкция", "варианты": "Варианты", "варианты ответа": "Варианты",
  "правильный ответ": "Правильный ответ", "ответ": "Правильный ответ", "правильный": "Правильный ответ", "ключ": "Правильный ответ",
  "наборы": "Наборы", "набор": "Наборы", "банк": "Наборы",
  "активен": "Активен", "активный": "Активен", "данные (json)": "Данные (JSON)", "данные": "Данные (JSON)", "json": "Данные (JSON)",
};
export const canonicalHeader = (h: string) => HEADER_ALIASES[String(h || "").trim().toLowerCase().replace(/\s+/g, " ")] || null;

const TYPE_ALIASES: Record<string, QuestionType> = Object.fromEntries([
  ...QUESTION_TYPES.map(t => [t.key, t.key]),
  ...QUESTION_TYPES.map(t => [t.label.toLowerCase(), t.key]),
  ["выбор", "multiple_choice"], ["тест", "multiple_choice"], ["text_input", "free_text"], ["текст", "free_text"],
  ["число", "number_input"], ["пропуск", "inline_dropdown"], ["таблица", "logic_matrix"], ["порядок", "drag_and_drop"],
]);

const splitList = (s: string) => String(s || "").split(/\r?\n|\s\|\s|\|/).map(x => x.trim()).filter(Boolean);

export interface ImportedRow {
  rowNumber: number;
  id: string | null;
  disciplineId: string;
  /** Названия наборов из колонки «Наборы» — сервер сопоставит их с наборами банка. */
  setNames: string[];
  question: Omit<BankQuestion, "id" | "tenantId" | "disciplineId" | "number" | "createdAt" | "updatedAt"> | null;
  issues: QuestionIssue[];
}

/** Строка таблицы (уже с каноническими заголовками) → вопрос и замечания. */
export function parseSheetRow(row: Record<string, string>, rowNumber: number): ImportedRow {
  const issues: QuestionIssue[] = [];
  const g = (k: (typeof SHEET_COLUMNS)[number]) => String(row[k] ?? "").trim();
  const id = g("Номер").toUpperCase() || null;
  if (id && !QUESTION_ID.test(id)) issues.push({ level: "error", message: `Номер «${id}» не по образцу КОД-0001` });
  const disciplineId = (g("Дисциплина") || (id ? id.split("-")[0] : "")).toUpperCase();
  if (!disciplineId) issues.push({ level: "error", message: "Не указан код дисциплины" });
  else if (!DISCIPLINE_CODE.test(disciplineId)) issues.push({ level: "error", message: `Код дисциплины «${disciplineId}»: латиница и цифры, 2–8 знаков` });
  if (id && disciplineId && !id.startsWith(disciplineId + "-")) issues.push({ level: "error", message: `Номер ${id} не из дисциплины ${disciplineId}` });

  const typeRaw = g("Тип").toLowerCase();
  const type = (typeRaw ? TYPE_ALIASES[typeRaw] : "multiple_choice") as QuestionType | undefined;
  if (!type) issues.push({ level: "error", message: `Неизвестный тип «${g("Тип")}»` });

  let extra: any = {};
  if (g("Данные (JSON)")) {
    try { extra = JSON.parse(g("Данные (JSON)")); }
    catch { issues.push({ level: "error", message: "В колонке «Данные (JSON)» ошибка разметки" }); }
  }
  const list = splitList(g("Варианты"));
  const rawContent: any = { ...extra, text: g("Вопрос") || extra.text, instruction: g("Инструкция") || extra.instruction };
  if (list.length) {
    if (type === "multiple_choice" || type === "two_step") rawContent.options = list;
    else if (type === "inline_dropdown") rawContent.inlineOptions = list;
    else if (type === "drag_and_drop") rawContent.dragItems = list;
  }

  const diff = Number(g("Сложность") || 2);
  if (![1, 2, 3].includes(diff)) issues.push({ level: "error", message: "Сложность — 1, 2 или 3" });
  const points = Number(String(g("Баллы") || "1").replace(",", "."));
  const activeRaw = g("Активен").toLowerCase();
  const active = !["нет", "no", "0", "false", "выкл"].includes(activeRaw);

  const setNames = [...new Set(g("Наборы").split(/[;\n]+/).map(x => x.trim().slice(0, 80)).filter(Boolean))].slice(0, 20);
  if (!type || issues.some(i => i.level === "error")) return { rowNumber, id, disciplineId, setNames, question: null, issues };
  const content = sanitizeContent(type, rawContent);
  let answer = g("Правильный ответ") || derivedAnswer({ ...content, type }) || "";
  answer = letterToOption(answer, type === "multiple_choice" ? content.options : type === "inline_dropdown" ? content.inlineOptions : undefined);
  const question = {
    ...content, type, answer,
    levels: normalizeLevels(g("Классы")),
    topic: g("Тема").slice(0, LIMITS.topic),
    difficulty: diff as Difficulty,
    points: Number.isFinite(points) && points > 0 ? Math.min(points, 100) : 1,
    active,
  };
  issues.push(...validateQuestion(question));
  return { rowNumber, id, disciplineId, setNames, question: issues.some(i => i.level === "error") ? null : question, issues };
}

/**
 * Ключ буквой («Б», «b») при вариантах без букв → сам вариант. Если варианты
 * начинаются с букв («Б) 3/4»), букву оставляем: проверка понимает её сама.
 */
export function letterToOption(answer: string, options?: string[]): string {
  const a = answer.trim();
  if (!options?.length || a.length !== 1) return answer;
  // Ключ уже совпадает с вариантом («a» среди «the / a / an») — это не буква варианта.
  if (options.some(o => o.trim().toLowerCase() === a.toLowerCase())) return answer;
  if (options.some(o => /^\s*[A-Za-zА-Яа-яЁё][).]/.test(o))) return answer;
  const idx = ["АA", "БB", "ВCV", "ГDG", "ДEД", "ЕF"].findIndex(l => l.includes(a.toUpperCase()));
  return idx >= 0 && options[idx] ? options[idx] : answer;
}

/** Вопрос → строка таблицы для выгрузки. */
export function questionToSheetRow(q: BankQuestion, setName: (id: string) => string = id => id): string[] {
  const simple = q.type === "multiple_choice" || q.type === "two_step" || q.type === "inline_dropdown" || q.type === "drag_and_drop";
  const list = q.type === "inline_dropdown" ? q.inlineOptions : q.type === "drag_and_drop" ? q.dragItems : q.options;
  const extra: any = {};
  for (const k of CONTENT_KEYS) {
    if (k === "text" || k === "instruction" || q[k] === undefined) continue;
    if (simple && (k === "options" || k === "inlineOptions" || k === "dragItems")) continue;
    extra[k] = q[k];
  }
  return [
    q.id, q.disciplineId, (q.sets || []).map(setName).join(";"), q.levels.join(";"), q.topic, String(q.difficulty), TYPE_LABEL[q.type], String(q.points),
    q.text || "", q.instruction || "", simple ? (list || []).join("\n") : "", q.answer, q.active ? "да" : "нет",
    Object.keys(extra).length ? JSON.stringify(extra) : "",
  ];
}
