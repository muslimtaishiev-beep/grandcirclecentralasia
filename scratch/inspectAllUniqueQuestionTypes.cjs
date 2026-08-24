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

async function inspectAllUnusual() {
  for (const grade of [7, 8, 9, 10, 11]) {
    const docSnap = await db.collection("tests").doc(`test_grade_${grade}`).get();
    if (docSnap.exists) {
      const questionsObj = docSnap.data()?.questions || {};
      for (const subj of Object.keys(questionsObj)) {
        const qList = questionsObj[subj] || [];
        qList.forEach(q => {
          if (q.type === 'inline_inputs' || q.type === 'clickable_text' || q.inlineSegments || q.clickableSegments) {
            console.log(`\nGrade ${grade} [${subj}] Q ID=${q.id} Type=${q.type}`);
            console.log(JSON.stringify(q, null, 2));
          }
        });
      }
    }
  }
  process.exit(0);
}

inspectAllUnusual().catch(err => {
  console.error(err);
  process.exit(1);
});
