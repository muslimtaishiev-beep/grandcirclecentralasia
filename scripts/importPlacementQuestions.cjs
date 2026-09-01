#!/usr/bin/env node
/**
 * Импорт банка вопросов среза из CSV — командная строка.
 *
 *   node scripts/importPlacementQuestions.cjs <файл.csv> [--tenant org_x] [--dry] [--with-warnings]
 *
 * Использует ТОТ ЖЕ разбор, что и кабинет завуча (src/lib/placementParser.ts),
 * поэтому файл, который чисто выглядит в браузере, импортируется здесь
 * идентично. Строки с ошибками не пишутся никогда: вопрос, на который нельзя
 * ответить правильно, хуже отсутствующего.
 */
const admin = require("firebase-admin");
const { readFileSync, existsSync, mkdirSync } = require("fs");
const { execSync } = require("child_process");
const path = require("path");

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const tenantId = (args.includes("--tenant") ? args[args.indexOf("--tenant") + 1] : null) || "org_future_leaders";
const dry = args.includes("--dry");
const withWarnings = args.includes("--with-warnings");
if (!file) { console.error("Укажите CSV: node scripts/importPlacementQuestions.cjs вопросы.csv"); process.exit(1); }

// Собираем парсер из TypeScript, чтобы не держать вторую копию логики.
const out = path.join(process.cwd(), "scratch", ".placementParser.cjs");
if (!existsSync(path.dirname(out))) mkdirSync(path.dirname(out), { recursive: true });
execSync(`npx esbuild src/lib/placementParser.ts --bundle --format=cjs --platform=node --outfile=${out}`, { stdio: "pipe" });
const { analyseFile } = require(out);

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync("serviceAccountKey.json", "utf8"))) });
const db = admin.firestore();

(async () => {
  const existing = new Set();
  (await db.collection("exam_questions").where("tenantId", "==", tenantId).get()).forEach(d => existing.add(d.id));

  const report = analyseFile(readFileSync(file, "utf8"), existing);
  if (report.fatal.length) {
    console.error("🔴 Файл не подходит:");
    report.fatal.forEach(f => console.error("   • " + f));
    process.exit(1);
  }

  console.log(`строк: ${report.questions.length} — готовы ${report.ok}, с замечаниями ${report.warnings}, с ошибками ${report.errors}\n`);

  const problems = report.questions.filter(q => q.status !== "ok");
  if (problems.length) {
    console.log("Проблемные строки:");
    problems.slice(0, 25).forEach(q => {
      const mark = q.status === "error" ? "🔴 НЕ ЗАГРУЗИТСЯ" : "⚠  проверьте";
      console.log(`  ${mark} стр.${q.row}: ${(q.text || "(пусто)").slice(0, 50)}`);
      q.issues.forEach(i => console.log(`        ${i}`));
    });
    if (problems.length > 25) console.log(`  … и ещё ${problems.length - 25}`);
    console.log("");
  }

  console.log("Пополнение банка:");
  Object.entries(report.byBucket).sort().forEach(([k, n]) => console.log(`   ${k}: ${n}`));

  const toWrite = report.questions.filter(q => q.status === "ok" || (q.status === "warning" && withWarnings));
  console.log(`\nбудет записано: ${toWrite.length}` +
    (report.warnings && !withWarnings ? `  (замечания пропущены; --with-warnings чтобы включить)` : ""));

  if (dry) { console.log("--dry: ничего не записано"); process.exit(0); }
  if (!toWrite.length) { console.error("Нечего импортировать."); process.exit(1); }

  let batch = db.batch(), inBatch = 0, written = 0;
  for (const q of toWrite) {
    batch.set(db.collection("exam_questions").doc(q.id), {
      id: q.id, tenantId, subject: q.subject, grades: q.grades, topic: q.topic,
      difficulty: q.difficulty, type: q.type, text: q.text, options: q.options,
      answer: q.answer, points: 1, active: true,
      needsReview: q.status === "warning", importIssues: q.issues.slice(0, 5),
      importedAt: admin.firestore.Timestamp.now(),
    });
    if (++inBatch === 400) { await batch.commit(); written += inBatch; batch = db.batch(); inBatch = 0; }
  }
  if (inBatch) { await batch.commit(); written += inBatch; }
  console.log(`\n✅ записано: ${written} (tenant: ${tenantId})`);
  process.exit(0);
})();
