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

async function inspectKeys() {
  for (const grade of [7, 8, 9, 10, 11]) {
    console.log(`\n================ GRADE ${grade} KEYS ===============`);
    const keyDoc = await db.collection("test_answer_keys").doc(`test_grade_${grade}`).get();
    const keys = keyDoc.exists ? keyDoc.data()?.keys || {} : {};

    const testDoc = await db.collection("tests").doc(`test_grade_${grade}`).get();
    const questions = testDoc.exists ? testDoc.data()?.questions || {} : {};

    for (const subj of ['logic', 'russian', 'math', 'english']) {
      const qList = questions[subj] || [];
      const keyMap = keys[subj] || {};
      qList.forEach(q => {
        if (q.type !== 'multiple_choice') {
          const keyEntry = keyMap[q.id];
          console.log(`[${subj.toUpperCase()}] ${q.id} (${q.type}):`);
          console.log(`   Text: ${q.text || q.prompt}`);
          console.log(`   Key ans: "${keyEntry?.ans}"`);
          if (q.matrixRows) console.log(`   matrixRows:`, q.matrixRows, `matrixCols:`, q.matrixCols);
          if (q.dropdownItems) console.log(`   dropdownItems:`, JSON.stringify(q.dropdownItems));
          if (q.inlineOptions) console.log(`   inlineOptions:`, JSON.stringify(q.inlineOptions));
          if (q.dragItems || q.items) console.log(`   dragItems:`, q.dragItems || q.items);
        }
      });
    }
  }

  process.exit(0);
}

inspectKeys().catch(err => {
  console.error(err);
  process.exit(1);
});
