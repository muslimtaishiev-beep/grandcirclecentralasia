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

async function inspectRussianQuestions() {
  console.log("=== INSPECTING RUSSIAN QUESTIONS IN FIRESTORE 'tests' ===");
  for (const grade of [7, 8, 9, 10, 11]) {
    const testDoc = await db.collection("tests").doc(`test_grade_${grade}`).get();
    const keyDoc = await db.collection("test_answer_keys").doc(`test_grade_${grade}`).get();
    const ruKeys = keyDoc.exists ? (keyDoc.data()?.keys || {}).russian || {} : {};

    if (testDoc.exists) {
      const ruQuestions = testDoc.data()?.questions?.russian || [];
      console.log(`\nGrade ${grade} Russian Questions count: ${ruQuestions.length}`);
      ruQuestions.forEach((q, idx) => {
        const keyEntry = ruKeys[q.id];
        console.log(`\n--- Grade ${grade} | Q${idx+1}: ID=${q.id} | Type=${q.type} ---`);
        console.log(`  Text:`, q.text || q.prompt);
        console.log(`  Key ans: "${keyEntry?.ans}"`);
        console.log(`  Question Keys:`, Object.keys(q));
        if (q.options) console.log(`  options:`, JSON.stringify(q.options));
        if (q.inlineOptions) console.log(`  inlineOptions:`, JSON.stringify(q.inlineOptions));
        if (q.dropdownItems) console.log(`  dropdownItems:`, JSON.stringify(q.dropdownItems));
        if (q.gaps || q.inputs) console.log(`  gaps/inputs:`, JSON.stringify(q.gaps || q.inputs));
        if (q.tokens || q.words) console.log(`  tokens/words:`, JSON.stringify(q.tokens || q.words));
      });
    }
  }

  process.exit(0);
}

inspectRussianQuestions().catch(err => {
  console.error(err);
  process.exit(1);
});
