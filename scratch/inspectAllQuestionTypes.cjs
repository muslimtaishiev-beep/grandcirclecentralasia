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

async function inspectAllTypes() {
  const typeMap = new Map();
  for (const grade of [7, 8, 9, 10, 11]) {
    const docSnap = await db.collection("tests").doc(`test_grade_${grade}`).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      const qObj = data.questions || {};
      for (const subj of ['russian', 'math', 'logic', 'english']) {
        const list = qObj[subj] || [];
        list.forEach(q => {
          const key = `${subj} | ${q.type}`;
          typeMap.set(key, (typeMap.get(key) || 0) + 1);
        });
      }
    }
  }

  console.log("=== ALL QUESTION TYPES IN FIRESTORE 'tests' ===");
  for (const [typeKey, count] of typeMap.entries()) {
    console.log(`  ${typeKey}: ${count} questions`);
  }

  process.exit(0);
}

inspectAllTypes().catch(err => {
  console.error(err);
  process.exit(1);
});
