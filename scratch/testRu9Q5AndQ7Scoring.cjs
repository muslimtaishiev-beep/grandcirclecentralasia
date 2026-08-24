const { isAnswerCorrect } = require('../src/lib/scoringEngine.ts');
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

async function testRu9Scoring() {
  const keyDoc = await db.collection("test_answer_keys").doc("test_grade_9").get();
  const ruKeys = keyDoc.exists ? (keyDoc.data()?.keys || {}).russian || {} : {};

  const q5Target = ruKeys['ru_9_q5']?.ans;
  const q7Target = ruKeys['ru_9_q7']?.ans;

  console.log(`ru_9_q5 Target Key: "${q5Target}"`);
  console.log(`ru_9_q7 Target Key: "${q7Target}"`);

  // User answers from component
  const q5User = "нн, н";
  const q7User = "1, 4";

  console.log("Q5 Correct?", isAnswerCorrect(q5User, q5Target) ? "✅ YES" : "❌ NO");
  console.log("Q7 Correct?", isAnswerCorrect(q7User, q7Target) ? "✅ YES" : "❌ NO");

  process.exit(0);
}

testRu9Scoring().catch(err => {
  console.error(err);
  process.exit(1);
});
