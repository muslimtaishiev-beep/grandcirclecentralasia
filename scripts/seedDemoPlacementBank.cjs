#!/usr/bin/env node
/**
 * Демо-банк вопросов среза — чтобы строить и прогонять экзамен, пока школа не
 * прислала реальные вопросы. Все документы помечены demo:true и удаляются
 * одной командой перед импортом настоящего банка:
 *
 *   node scripts/seedDemoPlacementBank.cjs           # засеять
 *   node scripts/seedDemoPlacementBank.cjs --wipe    # удалить демо-вопросы
 *
 * Math questions are GENERATED with computed answers — a demo bank with
 * invented answer keys would make every scoring test meaningless. English is a
 * small hand-checked set shared across grades.
 */
const admin = require("firebase-admin");
const { readFileSync } = require("fs");
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync("serviceAccountKey.json", "utf8"))) });
const db = admin.firestore();
const TENANT = "org_future_leaders";
const L = ["А", "Б", "В", "Г"];

// Deterministic RNG so re-seeding produces the same bank (stable E2E).
let seed = 42;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

function mcq(correctValue, wrongs) {
  const opts = [correctValue, ...wrongs].map(String);
  // shuffle deterministically
  for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  const answer = L[opts.indexOf(String(correctValue))];
  return { options: opts.map((o, i) => `${L[i]}) ${o}`), answer };
}

function mathQuestion(grade, difficulty, n) {
  let text, correct, wrongs, topic;
  if (difficulty === 1) {
    const a = ri(12, 89) * grade, b = ri(11, 78);
    topic = "Арифметика";
    text = `Вычислите: ${a} + ${b}`;
    correct = a + b; wrongs = [correct + 10, correct - 10, correct + 1];
  } else if (difficulty === 2) {
    const base = ri(2, 9) * 20, pct = [10, 15, 20, 25, 50][ri(0, 4)];
    topic = "Дроби и проценты";
    text = `Найдите ${pct}% от числа ${base}`;
    correct = base * pct / 100; wrongs = [correct + 5, correct * 2, Math.max(1, correct - 5)];
  } else {
    const x = ri(2, 9), b = ri(1, 15), c = x * ri(2, 6) + b;
    topic = "Уравнения";
    text = `Решите уравнение: ${Math.round((c - b) / x)}x + ${b} = ${c}`;
    correct = x; wrongs = [x + 1, x - 1 || x + 2, x + 3];
  }
  const { options, answer } = mcq(correct, wrongs);
  return { id: `demo_ma_${grade}_${difficulty}_${n}`, subject: "math", grades: [grade], topic, difficulty, text, options, answer };
}

// Hand-checked English items; grades: all 5-11 (demo only).
const EN = [
  [1, "Present Simple", "She ___ to school every day.", ["go", "goes", "going", "gone"], "Б"],
  [1, "Present Simple", "They ___ football on Sundays.", ["plays", "play", "playing", "played"], "Б"],
  [1, "To be", "I ___ a student.", ["am", "is", "are", "be"], "А"],
  [1, "Plural", "There are three ___ on the table.", ["book", "books", "bookes", "book's"], "Б"],
  [1, "Articles", "I saw ___ elephant at the zoo.", ["a", "an", "the", "—"], "Б"],
  [1, "Pronouns", "This is my sister. ___ name is Anna.", ["His", "Her", "Its", "Their"], "Б"],
  [1, "Prepositions", "The cat is ___ the table.", ["under", "at", "of", "off"], "А"],
  [1, "Have got", "He ___ got a bike.", ["have", "has", "is", "does"], "Б"],
  [2, "Past Simple", "They ___ the film last night.", ["watch", "watches", "watched", "watching"], "В"],
  [2, "Past Simple", "She ___ to London in 2020.", ["go", "goes", "went", "gone"], "В"],
  [2, "Comparatives", "This book is ___ than that one.", ["interesting", "more interesting", "most interesting", "interestinger"], "Б"],
  [2, "Present Continuous", "Listen! Somebody ___ the piano.", ["plays", "is playing", "played", "play"], "Б"],
  [2, "Future", "I think it ___ tomorrow.", ["rains", "rain", "will rain", "raining"], "В"],
  [2, "Modal verbs", "You ___ smoke here. It is forbidden.", ["must", "mustn't", "can", "may"], "Б"],
  [2, "Countable", "How ___ money do you have?", ["many", "much", "few", "a few"], "Б"],
  [2, "Present Perfect", "I ___ never ___ sushi.", ["have / eaten", "has / eaten", "have / ate", "had / eat"], "А"],
  [3, "Conditionals", "If I ___ earlier, I wouldn't have missed the train.", ["left", "leave", "had left", "would leave"], "В"],
  [3, "Passive", "The letter ___ yesterday.", ["sent", "was sent", "is sent", "has sent"], "Б"],
  [3, "Reported speech", "He said that he ___ tired.", ["is", "was", "be", "has been"], "Б"],
  [3, "Gerund/Infinitive", "She avoided ___ him a direct answer.", ["to give", "give", "giving", "gave"], "В"],
  [3, "Relative clauses", "The man ___ car was stolen called the police.", ["who", "which", "whose", "that"], "В"],
  [3, "Past Perfect", "By the time we arrived, the film ___ .", ["started", "has started", "had started", "starts"], "В"],
];

(async () => {
  if (process.argv.includes("--wipe")) {
    const snap = await db.collection("exam_questions").where("demo", "==", true).get();
    let batch = db.batch(), n = 0;
    for (const d of snap.docs) { batch.delete(d.ref); if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); } }
    await batch.commit();
    console.log(`удалено демо-вопросов: ${snap.size}`);
    process.exit(0);
  }

  const questions = [];
  for (let grade = 5; grade <= 11; grade++) {
    for (const difficulty of [1, 2, 3]) {
      // 10 per difficulty per grade → blueprint 7+8+5 always satisfiable.
      for (let n = 1; n <= 10; n++) questions.push(mathQuestion(grade, difficulty, n));
    }
  }
  EN.forEach(([difficulty, topic, text, opts, answer], i) => {
    questions.push({
      id: `demo_en_${i + 1}`, subject: "english", grades: [5, 6, 7, 8, 9, 10, 11],
      topic, difficulty, text, options: opts.map((o, j) => `${L[j]}) ${o}`), answer,
    });
  });

  let batch = db.batch(), n = 0;
  for (const q of questions) {
    batch.set(db.collection("exam_questions").doc(q.id), {
      ...q, tenantId: TENANT, type: "multiple_choice", points: 1, active: true, demo: true,
      importedAt: admin.firestore.Timestamp.now(),
    });
    if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();
  console.log(`записано демо-вопросов: ${questions.length} (математика ${questions.length - EN.length}, английский ${EN.length})`);
  console.log("удалить перед реальным импортом: node scripts/seedDemoPlacementBank.cjs --wipe");
  process.exit(0);
})();
