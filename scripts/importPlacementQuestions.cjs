#!/usr/bin/env node
/**
 * Импорт банка вопросов среза из CSV-шаблона школы.
 *
 *   node scripts/importPlacementQuestions.cjs <файл.csv> [--tenant org_future_leaders] [--dry]
 *
 * Колонки шаблона (Ключи_ответов/Шаблон_вопросов_для_школы.csv):
 *   id | предмет | классы | тема | сложность | вопрос | вариант_А..Г | правильный
 *
 * Every row is validated BEFORE anything is written: duplicate ids, an empty
 * question, a difficulty outside 1-3, a correct answer that names a missing
 * option — each failure is reported with its row number. A file with any
 * error writes nothing: half-imported banks are how students meet questions
 * with no right answer.
 *
 * --dry prints the report without writing.
 */
const admin = require("firebase-admin");
const { readFileSync } = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const tenantId = (args.includes("--tenant") ? args[args.indexOf("--tenant") + 1] : null) || "org_future_leaders";
const dry = args.includes("--dry");
if (!file) { console.error("Укажите CSV-файл: node scripts/importPlacementQuestions.cjs вопросы.csv"); process.exit(1); }

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(path.join(process.cwd(), "serviceAccountKey.json"), "utf8"))) });
const db = admin.firestore();

// Tiny CSV parser that survives quoted fields with commas and newlines.
function parseCSV(text) {
  const rows = []; let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cell); cell = ""; }
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

const SUBJECTS = { "математика": "math", "math": "math", "английский": "english", "english": "english", "англ": "english" };
const LETTERS = ["А", "Б", "В", "Г"];
const foldLetter = s => String(s || "").trim().toUpperCase()
  .replace("A", "А").replace("B", "Б").replace("V", "В").replace("G", "Г");

(async () => {
  const raw = readFileSync(file, "utf8").replace(/^﻿/, "");
  const rows = parseCSV(raw);
  const header = rows.shift().map(h => h.trim().toLowerCase());
  const col = name => header.findIndex(h => h.includes(name));
  const C = {
    id: col("id"), subject: col("предмет"), grades: col("класс"), topic: col("тема"),
    difficulty: col("сложн"), text: col("вопрос"), correct: col("правильн"),
    opts: LETTERS.map(l => header.findIndex(h => h.includes(l.toLowerCase()) && h.includes("вариант"))),
  };
  for (const [k, v] of Object.entries({ id: C.id, предмет: C.subject, классы: C.grades, тема: C.topic, сложность: C.difficulty, вопрос: C.text, правильный: C.correct })) {
    if (v === -1) { console.error(`🔴 В файле нет колонки «${k}» — используйте шаблон.`); process.exit(1); }
  }

  const errors = [], questions = [], seen = new Set();
  rows.forEach((r, i) => {
    const line = i + 2;
    const id = (r[C.id] || "").trim();
    const subject = SUBJECTS[(r[C.subject] || "").trim().toLowerCase()];
    const grades = (r[C.grades] || "").split(/[;,\s]+/).map(Number).filter(g => g >= 5 && g <= 11);
    const topic = (r[C.topic] || "").trim();
    const difficulty = Number(r[C.difficulty]);
    const text = (r[C.text] || "").trim();
    const options = C.opts.map(ix => (ix >= 0 ? (r[ix] || "").trim() : "")).filter(Boolean);
    const correct = foldLetter(r[C.correct]);

    if (!id) errors.push(`строка ${line}: пустой id`);
    else if (seen.has(id)) errors.push(`строка ${line}: id «${id}» уже встречался`);
    seen.add(id);
    if (!subject) errors.push(`строка ${line}: предмет «${r[C.subject]}» — нужно «математика» или «английский»`);
    if (!grades.length) errors.push(`строка ${line}: классы «${r[C.grades]}» — укажите 5–11 через точку с запятой`);
    if (!topic) errors.push(`строка ${line}: пустая тема`);
    if (![1, 2, 3].includes(difficulty)) errors.push(`строка ${line}: сложность «${r[C.difficulty]}» — нужно 1, 2 или 3`);
    if (!text) errors.push(`строка ${line}: пустой текст вопроса`);
    if (options.length < 2) errors.push(`строка ${line}: меньше двух вариантов ответа`);
    if (!LETTERS.includes(correct)) errors.push(`строка ${line}: правильный ответ «${r[C.correct]}» — нужна буква А–Г`);
    else if (LETTERS.indexOf(correct) >= options.length) errors.push(`строка ${line}: правильный ответ ${correct}, но варианта ${correct} нет`);

    questions.push({ id, tenantId, subject, grades, topic, difficulty, type: "multiple_choice",
      text, options: options.map((o, j) => `${LETTERS[j]}) ${o}`), answer: correct, points: 1, active: true });
  });

  console.log(`строк прочитано: ${rows.length}`);
  if (errors.length) {
    console.log(`\n🔴 ОШИБОК: ${errors.length} — файл НЕ импортирован, исправьте и запустите снова:`);
    errors.slice(0, 30).forEach(e => console.log("   • " + e));
    if (errors.length > 30) console.log(`   … и ещё ${errors.length - 30}`);
    process.exit(1);
  }

  const byKey = {};
  questions.forEach(q => {
    const k = `${q.subject} · сложность ${q.difficulty}`;
    byKey[k] = (byKey[k] || 0) + 1;
  });
  console.log("\nраспределение:");
  Object.entries(byKey).sort().forEach(([k, n]) => console.log(`   ${k}: ${n}`));

  if (dry) { console.log("\n--dry: ничего не записано"); process.exit(0); }

  let batch = db.batch(), inBatch = 0, written = 0;
  for (const q of questions) {
    batch.set(db.collection("exam_questions").doc(q.id), { ...q, importedAt: admin.firestore.Timestamp.now() });
    if (++inBatch === 400) { await batch.commit(); written += inBatch; batch = db.batch(); inBatch = 0; }
  }
  if (inBatch) { await batch.commit(); written += inBatch; }
  console.log(`\n✅ записано вопросов: ${written} (tenant: ${tenantId})`);
  process.exit(0);
})();
