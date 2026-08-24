const { calculateScoresTs, isAnswerCorrect } = require('../src/lib/scoringEngine.ts');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let serviceAccount;
const keyPath = path.join(__dirname, '../serviceAccountKey.json');

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else if (fs.existsSync(keyPath)) {
  serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
} else {
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function testAllGrade9Ru() {
  const keyDoc = await db.collection("test_answer_keys").doc("test_grade_9").get();
  const keys = keyDoc.exists ? keyDoc.data()?.keys || {} : {};
  const ruKeys = keys.russian || {};

  const answers = {
    "ru_9_q1": "2) Быстро бежать",
    "ru_9_q2": "2) Вставная конструкция",
    "ru_9_q3": "2) Иду по лесной тропинке.",
    "ru_9_q4": "3) три ученика",
    "ru_9_q5": "нн, н",
    "ru_9_q6": "1) Утомленные долгим путем туристы отдыхали.",
    "ru_9_q7": "1, 4",
    "ru_9_q8": "3) (не) закрыв дверь",
    "ru_9_q9": "2) (не) навидевший",
    "ru_9_q10": "2) Закончив работу я пошел гулять.",
    "ru_9_q11": "1) Кажется дождь начинается.",
    "ru_9_q12": "3) Составное глагольное.",
    "ru_9_q13": "1) Безличное предложение",
    "ru_9_q14": "1) Двоеточие между частями БСП, запятая на стыке союзов не ставится из-за ТО, запятые обособляют придаточное"
  };

  console.log("=== TESTING ALL 14 GRADE 9 RUSSIAN QUESTIONS ===");
  Object.keys(ruKeys).forEach(qId => {
    const uVal = answers[qId];
    const targetVal = ruKeys[qId].ans;
    const ok = isAnswerCorrect(uVal, targetVal);
    console.log(`${qId}: Correct? ${ok ? '✅ YES' : '❌ NO'} (User="${uVal}" | Target="${targetVal}")`);
  });

  const scoreRes = calculateScoresTs(9, answers, keys);
  console.log(`\nTOTAL GRADE 9 RUSSIAN SCORE: ${scoreRes.scores.russian} / 14`);

  process.exit(0);
}

testAllGrade9Ru().catch(err => {
  console.error(err);
  process.exit(1);
});
