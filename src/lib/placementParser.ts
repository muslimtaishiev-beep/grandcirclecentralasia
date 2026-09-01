/**
 * Разбор и проверка файла с вопросами для вступительного среза.
 *
 * Shared by the CLI importer and the cabinet's upload screen, so a file that
 * previews cleanly in the browser imports identically from the terminal.
 *
 * The point is not to parse — it is to REFUSE to parse silently. A question
 * that arrives malformed and gets written anyway becomes a question a real
 * student cannot answer correctly, discovered only after the exam. So every
 * row is classified: ready / needs attention / broken, with the reason stated
 * in the words a manager can act on.
 */

export type QuestionType = "multiple_choice" | "text_input";
export type RowStatus = "ok" | "warning" | "error";

export interface ParsedQuestion {
  row: number;
  id: string;
  generatedId: boolean;
  subject: "math" | "english" | "";
  grades: number[];
  topic: string;
  difficulty: number;
  type: QuestionType;
  text: string;
  options: string[];
  answer: string;
  status: RowStatus;
  issues: string[];
}

export interface ParseReport {
  questions: ParsedQuestion[];
  ok: number;
  warnings: number;
  errors: number;
  /** Errors that are about the file itself, not a row (missing column, etc). */
  fatal: string[];
  byBucket: Record<string, number>;
}

const LETTERS = ["А", "Б", "В", "Г", "Д", "Е"];

const SUBJECT_ALIASES: Record<string, "math" | "english"> = {
  "математика": "math", "матем": "math", "math": "math", "мат": "math",
  "английский": "english", "англ": "english", "english": "english", "eng": "english",
};

const TYPE_ALIASES: Record<string, QuestionType> = {
  "": "multiple_choice",
  "выбор": "multiple_choice", "тест": "multiple_choice", "варианты": "multiple_choice",
  "multiple_choice": "multiple_choice", "mc": "multiple_choice",
  "ввод": "text_input", "вписать": "text_input", "текст": "text_input",
  "text_input": "text_input", "открытый": "text_input", "число": "text_input",
};

/** Latin/Cyrillic lookalikes fold: А and A are different code points. */
const LOOKALIKES: Record<string, string> = {
  "a": "а", "b": "б", "c": "с", "e": "е", "k": "к", "m": "м",
  "h": "н", "o": "о", "p": "р", "t": "т", "x": "х", "y": "у",
};
export function normalizeLetter(raw: string): string {
  const c = String(raw || "").trim().toUpperCase().slice(0, 1).toLowerCase();
  return (LOOKALIKES[c] ?? c).toUpperCase();
}

/**
 * CSV parser that survives quoted fields containing the delimiter and newlines.
 *
 * The delimiter is detected from the header line rather than accepting any of
 * comma/semicolon/tab everywhere: schools write multiple grades as "5;6" in a
 * comma-separated file, and treating ";" as a delimiter split that into two
 * cells, shifting every column after it by one for the whole row.
 */
export function parseCSV(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const counts: Record<string, number> = {
    ",": (firstLine.match(/,/g) || []).length,
    ";": (firstLine.match(/;/g) || []).length,
    "\t": (firstLine.match(/\t/g) || []).length,
  };
  const delim = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [","])[0];

  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(x => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); if (row.some(x => x.trim() !== "")) rows.push(row); }
  return rows;
}

const slug = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]/g, "");

export function analyseFile(text: string, existingIds: Set<string> = new Set()): ParseReport {
  const clean = text.replace(/^﻿/, "");
  const rows = parseCSV(clean);
  const fatal: string[] = [];
  if (rows.length < 2) {
    return { questions: [], ok: 0, warnings: 0, errors: 0, byBucket: {},
      fatal: ["Файл пуст или содержит только заголовок."] };
  }

  const header = rows.shift()!.map(h => slug(h));
  const find = (...names: string[]) => header.findIndex(h => names.some(n => h.includes(n)));
  const C = {
    id: find("id", "ид"),
    subject: find("предмет", "subject"),
    grades: find("класс", "grade"),
    topic: find("тема", "topic"),
    difficulty: find("сложн", "difficulty"),
    type: find("тип", "type"),
    text: find("вопрос", "текст", "question"),
    answer: find("правильн", "ответ", "answer", "correct"),
    // Match the option column by its LAST character, not by "contains". slug()
    // strips the separator, so "вариант_А" becomes "варианта" — and a
    // contains-check for "а" then matches вариантб/в/г too, because every one
    // of them contains "вариант" plus stray letters. Every option column
    // resolved to the first one, and four distinct options looked like four
    // copies of the same answer.
    options: LETTERS.map(l => header.findIndex(h =>
      h.startsWith("вариант") && h.slice(7) === slug(l))),
  };

  const required: [string, number][] = [
    ["предмет", C.subject], ["классы", C.grades], ["тема", C.topic],
    ["сложность", C.difficulty], ["вопрос", C.text], ["правильный ответ", C.answer],
  ];
  for (const [label, idx] of required) {
    if (idx === -1) fatal.push(`В файле нет колонки «${label}».`);
  }
  if (fatal.length) return { questions: [], ok: 0, warnings: 0, errors: 0, byBucket: {}, fatal };

  const seen = new Set<string>(existingIds);
  const counters: Record<string, number> = {};
  const questions: ParsedQuestion[] = [];

  rows.forEach((r, i) => {
    const row = i + 2; // +1 header, +1 for 1-based
    const issues: string[] = [];
    const cell = (idx: number) => (idx >= 0 ? String(r[idx] ?? "").trim() : "");

    const subject = SUBJECT_ALIASES[slug(cell(C.subject))] || "";
    if (!subject) issues.push(`предмет «${cell(C.subject)}» не распознан — нужно «математика» или «английский»`);

    const grades = cell(C.grades).split(/[;,\s/]+/).map(Number).filter(g => Number.isInteger(g) && g >= 5 && g <= 11);
    if (!grades.length) issues.push(`классы «${cell(C.grades)}» не распознаны — укажите числа 5–11 через точку с запятой`);

    const topic = cell(C.topic);
    if (!topic) issues.push("не указана тема — по темам строится анализ у завуча");

    const difficulty = Number(cell(C.difficulty));
    if (![1, 2, 3].includes(difficulty)) issues.push(`сложность «${cell(C.difficulty)}» — нужно 1, 2 или 3`);

    const rawType = slug(cell(C.type));
    let type: QuestionType = TYPE_ALIASES[rawType] ?? "multiple_choice";
    if (rawType && !(rawType in TYPE_ALIASES)) {
      issues.push(`тип «${cell(C.type)}» не распознан, принят как «выбор варианта»`);
    }

    const text = cell(C.text);
    if (!text) issues.push("пустой текст вопроса");
    else if (text.length < 8) issues.push(`текст подозрительно короткий (${text.length} симв.) — возможно, вопрос обрезан при разборе`);

    const options = C.options.map(ix => cell(ix)).filter(Boolean);
    const answerRaw = cell(C.answer);
    let answer = answerRaw;

    if (type === "multiple_choice") {
      // A file with no option columns at all is almost certainly text-input
      // questions that were labelled as multiple choice, not a broken file.
      if (options.length === 0) {
        type = "text_input";
        issues.push("нет вариантов ответа — вопрос принят как «вписать ответ»");
      } else {
        if (options.length < 2) issues.push(`только ${options.length} вариант — проверьте разбор строки`);
        // Match the answer's TEXT against the options first. Checking the
        // letter first mangles an answer like "7" — normalizeLetter keeps its
        // first character, "7" is not a letter, and by then the raw value is
        // already lost. Schools write the value as often as the letter.
        const byText = options.findIndex(o =>
          slug(o.replace(/^[А-ЯA-Z][).]\s*/, "")) === slug(answerRaw));
        if (byText >= 0) {
          answer = LETTERS[byText];
        } else {
          const letter = normalizeLetter(answerRaw);
          if (LETTERS.includes(letter)) {
            answer = letter;
            if (LETTERS.indexOf(letter) >= options.length) {
              issues.push(`правильный ответ «${letter}», но варианта ${letter} нет`);
            }
          } else {
            issues.push(`правильный ответ «${answerRaw}» — нужна буква А–Г или точный текст варианта`);
          }
        }
        const dupes = options.filter((o, j) => options.findIndex(x => slug(x) === slug(o)) !== j);
        if (dupes.length) issues.push(`повторяющиеся варианты: ${[...new Set(dupes)].join(", ")}`);
      }
    }
    if (type === "text_input" && !answerRaw) issues.push("не указан правильный ответ");

    let id = cell(C.id);
    let generatedId = false;
    if (!id) {
      // Автогенерация: предмет + класс + порядковый номер, стабильно и читаемо.
      const prefix = `pl_${subject === "english" ? "en" : "ma"}_${grades[0] || 0}`;
      counters[prefix] = (counters[prefix] || 0) + 1;
      let candidate = `${prefix}_${String(counters[prefix]).padStart(4, "0")}`;
      while (seen.has(candidate)) {
        counters[prefix]++;
        candidate = `${prefix}_${String(counters[prefix]).padStart(4, "0")}`;
      }
      id = candidate;
      generatedId = true;
    } else if (seen.has(id)) {
      issues.push(`id «${id}» уже существует — этот вопрос перезапишет прежний`);
    }
    seen.add(id);

    // A row is broken only when it cannot be answered at all; everything else
    // is a warning the manager may knowingly accept and fix later.
    const blocking = !subject || !grades.length || !text ||
      ![1, 2, 3].includes(difficulty) ||
      (type === "multiple_choice" && (options.length < 2 || !LETTERS.includes(answer) || LETTERS.indexOf(answer) >= options.length)) ||
      (type === "text_input" && !answerRaw);

    questions.push({
      row, id, generatedId, subject: subject as any, grades, topic, difficulty, type,
      text, options: options.map((o, j) => `${LETTERS[j]}) ${o.replace(/^[А-ЯA-Z][).]\s*/, "")}`),
      answer, issues,
      status: blocking ? "error" : issues.length ? "warning" : "ok",
    });
  });

  const byBucket: Record<string, number> = {};
  questions.filter(q => q.status !== "error").forEach(q => {
    const k = `${q.subject === "english" ? "английский" : "математика"} · сложность ${q.difficulty}`;
    byBucket[k] = (byBucket[k] || 0) + 1;
  });

  return {
    questions, fatal, byBucket,
    ok: questions.filter(q => q.status === "ok").length,
    warnings: questions.filter(q => q.status === "warning").length,
    errors: questions.filter(q => q.status === "error").length,
  };
}
