const { calculateScoresTs } = require('../src/lib/scoringEngine.ts');
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

async function testScoreCalculation() {
  const grade = 10;
  const docSnap = await db.collection("test_answer_keys").doc("test_grade_10").get();
  const keys = docSnap.data()?.keys || {};

  console.log("Keys loaded from test_grade_10:");
  console.log("  Russian keys count:", Object.keys(keys.russian || {}).length);
  console.log("  Math keys count:", Object.keys(keys.math || {}).length);
  console.log("  Logic keys count:", Object.keys(keys.logic || {}).length);

  // Sample student answers for Grade 10:
  const studentAnswers = {
    // Russian 10
    "ru_10_q1": "2) газопрОвод", // Key is 2
    "ru_10_q2": "1) Летом в ЛЕСИСТОЙ чащобе...", // Key is 1
    "ru_10_q3": "2) Катя приняла решение...", // Key is 2
    
    // Math 10
    "ma_10_q1": "2) 4,8", // Key is 2
    "ma_10_q2": "1) (x - 2)(x + 2)", // Key is 1
    "ma_10_q3": "1) 12", // Key is 1

    // Logic
    "logic_1": "Белов-Чёрная,Серов-Белая,Чернов-Серая",
    "logic_2": "Сахар,Крупа,Вермишель",
    "logic_3": "Митя,Толя,Сеня,Костя,Юра",
    "logic_6": "60",
    "logic_7": "8"
  };

  const result = calculateScoresTs(10, studentAnswers, keys);
  console.log("\nSCORING RESULT:");
  console.log(JSON.stringify(result.scores, null, 2));
  process.exit(0);
}

testScoreCalculation().catch(err => {
  console.error(err);
  process.exit(1);
});
