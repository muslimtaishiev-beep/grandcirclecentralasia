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

async function inspectTestsCollection() {
  console.log("=== INSPECTING FIRESTORE COLLECTION 'tests' ===");
  for (const grade of [7, 8, 9, 10, 11]) {
    const docSnap = await db.collection("tests").doc(`test_grade_${grade}`).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      const logicQuestions = data.questions?.logic || [];
      console.log(`\nGrade ${grade} Logic Questions count in Firestore tests: ${logicQuestions.length}`);
      logicQuestions.forEach((q, idx) => {
        console.log(`\n  Q${idx+1}: ID=${q.id} | Type=${q.type}`);
        console.log(`  Text:`, q.text || q.prompt);
        console.log(`  Keys/Props:`, Object.keys(q));
        if (q.type === 'matrix_grid' || q.type === 'logic_matrix' || q.type === 'matrix') {
          console.log(`  matrixRows:`, q.matrixRows || q.rows);
          console.log(`  matrixCols:`, q.matrixCols || q.columns);
        }
        if (q.dropdownItems) console.log(`  dropdownItems:`, JSON.stringify(q.dropdownItems));
        if (q.inlineOptions) console.log(`  inlineOptions:`, JSON.stringify(q.inlineOptions));
        if (q.options) console.log(`  options:`, JSON.stringify(q.options));
        if (q.items || q.dragItems) console.log(`  items:`, JSON.stringify(q.items || q.dragItems));
      });
    } else {
      console.log(`Doc test_grade_${grade} NOT FOUND in collection 'tests'!`);
    }
  }

  process.exit(0);
}

inspectTestsCollection().catch(err => {
  console.error(err);
  process.exit(1);
});
