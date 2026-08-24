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

async function inspectGrade9Ru() {
  const testDoc = await db.collection("tests").doc("test_grade_9").get();
  const keyDoc = await db.collection("test_answer_keys").doc("test_grade_9").get();
  const ruKeys = keyDoc.exists ? (keyDoc.data()?.keys || {}).russian || {} : {};

  if (testDoc.exists) {
    const ruQuestions = testDoc.data()?.questions?.russian || [];
    console.log(`Grade 9 Russian Questions count: ${ruQuestions.length}`);
    ruQuestions.forEach((q, idx) => {
      const keyEntry = ruKeys[q.id];
      console.log(`\n--- Q${idx+1}: ID=${q.id} | Type=${q.type} ---`);
      console.log(`  Text:`, q.text || q.prompt);
      console.log(`  Key ans: "${keyEntry?.ans}"`);
      console.log(`  Options:`, JSON.stringify(q.options));
    });
  }
  process.exit(0);
}

inspectGrade9Ru().catch(err => {
  console.error(err);
  process.exit(1);
});
