/**
 * Перенос вопросов Академии в банк «Экзаменов».
 *
 * Источники (из бэкапа JSON, не из живой базы — запуск повторяем):
 *  - вступительный тест: tests/test_grade_{7..11}_org_future_leaders и ключи
 *    из test_answer_keys в том же порядке приоритета, что у сервера;
 *  - банк среза: exam_questions.
 * Одинаковые вопросы разных классов (логика, часть английского) становятся
 * одним вопросом с несколькими классами.
 *
 *   npx tsx scripts/migrateExamBank.ts <папка бэкапа> <out.json>            — только расчёт
 *   npx tsx scripts/migrateExamBank.ts <папка бэкапа> <out.json> --commit   — запись в базу
 */
import fs from "fs";
import {
  isQuestionType, normalizeLevels, questionId, sanitizeContent, validateQuestion,
  type BankQuestion, type Discipline, type QuestionType,
} from "../src/shared/exams";

const [dir, outFile, flag] = process.argv.slice(2);
const T = "org_future_leaders";
const load = (n: string) => JSON.parse(fs.readFileSync(`${dir}/${n}.json`, "utf8")) as { id: string; data: any }[];
const tests = Object.fromEntries(load("tests").map(d => [d.id, d.data]));
const keyDocs = Object.fromEntries(load("test_answer_keys").map(d => [d.id, d.data]));
const placement = load("exam_questions").map(d => ({ ...d.data, id: d.id }));

const DISC: Record<string, { code: string; name: string }> = {
  logic: { code: "LOG", name: "Логика" },
  russian: { code: "RUS", name: "Русский язык" },
  math: { code: "MAT", name: "Математика" },
  english: { code: "ENG", name: "Английский язык" },
};
const SUBJECTS = ["russian", "math", "logic", "english"];
const now = Date.now();

const asObj = (v: any) => (Array.isArray(v) ? Object.fromEntries(v.map((x, i) => [String(i), x])) : v || {});
function mergedKeys(g: number) {
  const acc: Record<string, Record<string, any>> = { russian: {}, math: {}, logic: {}, english: {} };
  for (const id of [`test_grade_${g}_${T}`, `test_grade_${g}`, `key_grade_${g}_${T}`, `key_grade_${g}_GLOBAL`, `${g}`]) {
    const k = keyDocs[id]?.keys || {};
    for (const s of SUBJECTS) if (k[s]) acc[s] = { ...asObj(k[s]), ...acc[s] };
  }
  return acc;
}

type Draft = Omit<BankQuestion, "id" | "number" | "createdAt" | "updatedAt"> & { sig: string; refs: { level: string; oldId: string }[] };
const drafts: Record<string, Draft[]> = { LOG: [], RUS: [], MAT: [], ENG: [] };
const problems: string[] = [];

// 1. Вступительный тест
for (let g = 7; g <= 11; g++) {
  const t = tests[`test_grade_${g}_${T}`];
  const keys = mergedKeys(g);
  for (const s of SUBJECTS) {
    (t.questions?.[s] || []).forEach((q: any, idx: number) => {
      const code = DISC[s].code;
      const key = keys[s][q.id];
      if (!isQuestionType(q.type)) { problems.push(`${g}/${s}/${q.id}: неизвестный тип ${q.type}`); return; }
      const content = sanitizeContent(q.type as QuestionType, q);
      const answer = String(key?.ans ?? "").trim();
      const sig = JSON.stringify({ type: q.type, content, answer });
      const existing = drafts[code].find(d => d.sig === sig);
      if (existing) {
        existing.levels = normalizeLevels([...existing.levels, String(g)]);
        existing.refs.push({ level: String(g), oldId: q.id });
        return;
      }
      drafts[code].push({
        ...content, sig, refs: [{ level: String(g), oldId: q.id }],
        tenantId: T, disciplineId: code, type: q.type, answer,
        levels: [String(g)], topic: String(key?.topic || "").slice(0, 160), difficulty: 2,
        points: Number(key?.pts ?? q.points ?? 1) || 1, active: true, order: idx + 1,
        source: { kind: "admission_test" },
      });
    });
  }
}

// 2. Банк среза
const LETTERS = ["АA", "БB", "ВCV", "ГDG", "ДEД"];
for (const q of placement.sort((a, b) => (a.grades?.[0] - b.grades?.[0]) || String(a.subject).localeCompare(b.subject) || Number(a.id) - Number(b.id))) {
  const code = q.subject === "english" ? "ENG" : "MAT";
  const options: string[] = q.options || [];
  let answer = String(q.answer ?? "").trim();
  let type: QuestionType = "multiple_choice";
  if (q.type === "text_input") type = /^-?\d+(?:[.,]\d+)?$/.test(answer) ? "number_input" : "free_text";
  else {
    // Ключ среза — буква варианта; в банке храним сам вариант, как в тесте.
    const up = answer.toUpperCase();
    const li = LETTERS.findIndex(l => l.includes(up)) ;
    if (up.length === 1 && li >= 0 && options[li]) answer = options[li];
    else if (!options.some(o => o.trim() === answer)) problems.push(`срез ${q.id}: ответ «${answer}» не найден среди вариантов`);
  }
  const content = sanitizeContent(type, { text: q.text, options });
  const joke = (q.grades || []).length === 1 && q.grades[0] === 7; // шуточный тест «про Мусю»
  drafts[code].push({
    ...content, sig: "", refs: [{ level: (q.grades || []).join(";"), oldId: q.id }],
    tenantId: T, disciplineId: code, type, answer,
    levels: normalizeLevels((q.grades || []).map(String)), topic: String(q.topic || "").slice(0, 160),
    difficulty: ([1, 2, 3].includes(q.difficulty) ? q.difficulty : 2) as 1 | 2 | 3,
    points: Number(q.points) || 1, active: q.active !== false && !joke,
    source: { kind: joke ? "placement_test_joke" : "placement" },
  });
}

// 3. Номера и проверка
const out: BankQuestion[] = [];
const disciplines: Discipline[] = [];
for (const [s, d] of Object.entries(DISC)) {
  const list = drafts[d.code];
  list.forEach((x, i) => {
    const { sig: _s, refs, ...rest } = x;
    const q: BankQuestion = { ...rest, id: questionId(d.code, i + 1), number: i + 1, createdAt: now, updatedAt: now, updatedBy: "migration",
      source: { ...rest.source!, ref: refs.map(r => `${r.level}:${r.oldId}`).join(" ") } };
    const issues = validateQuestion(q);
    for (const is of issues) problems.push(`${q.id} [${is.level}] ${is.message} (${q.source?.ref})`);
    out.push(q);
  });
  disciplines.push({ code: d.code, name: d.name, nextNumber: list.length + 1, createdAt: now, updatedAt: now, description: s === "logic" ? "Общая для всех классов" : "" });
}

const summary: any = {};
for (const q of out) {
  const k = q.disciplineId; summary[k] = summary[k] || { total: 0, active: 0, byKind: {}, byLevel: {}, byType: {} };
  summary[k].total++; if (q.active) summary[k].active++;
  summary[k].byKind[q.source!.kind] = (summary[k].byKind[q.source!.kind] || 0) + 1;
  summary[k].byLevel[q.levels.join(",")] = (summary[k].byLevel[q.levels.join(",")] || 0) + 1;
  summary[k].byType[q.type] = (summary[k].byType[q.type] || 0) + 1;
}
fs.writeFileSync(outFile, JSON.stringify({ disciplines, questions: out }, null, 1));
console.log(JSON.stringify(summary, null, 1));
console.log(`всего вопросов: ${out.length}; замечаний: ${problems.length}`);
for (const p of problems.slice(0, 40)) console.log("  ·", p);

if (flag === "--commit") {
  const admin = (await import("firebase-admin")).default;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(new URL("../serviceAccountKey.json", import.meta.url), "utf8"))) });
  const db = admin.firestore();
  const tdoc = db.collection("tenants").doc(T);
  const existing = await tdoc.collection("exam_bank").limit(1).get();
  if (!existing.empty) { console.error("В банке уже есть вопросы — перенос остановлен, чтобы ничего не задвоить."); process.exit(1); }
  for (const d of disciplines) await tdoc.collection("exam_disciplines").doc(d.code).set(d);
  for (let i = 0; i < out.length; i += 400) {
    const b = db.batch();
    for (const q of out.slice(i, i + 400)) b.set(tdoc.collection("exam_bank").doc(q.id), JSON.parse(JSON.stringify(q)));
    await b.commit();
  }
  const cnt = await tdoc.collection("exam_bank").count().get();
  console.log(`ЗАПИСАНО: дисциплин ${disciplines.length}, вопросов в базе ${cnt.data().count}`);
  process.exit(0);
}
