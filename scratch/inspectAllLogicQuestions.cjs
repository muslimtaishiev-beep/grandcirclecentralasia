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

// Import testsData from compiled JS or tsx
const testsDataFile = path.join(__dirname, '../src/data/testsData.ts');
const testsDataContent = fs.readFileSync(testsDataFile, 'utf-8');

async function inspectLogic() {
  console.log("=== INSPECTING FIRESTORE LOGIC KEYS FOR ALL GRADES ===");
  for (const grade of [7, 8, 9, 10, 11]) {
    const docSnap = await db.collection("test_answer_keys").doc(`test_grade_${grade}`).get();
    if (docSnap.exists) {
      const keys = docSnap.data()?.keys || {};
      console.log(`\nGrade ${grade} Logic Keys in Firestore:`);
      console.log(JSON.stringify(keys.logic, null, 2));
    }
  }

  process.exit(0);
}

inspectLogic().catch(err => {
  console.error(err);
  process.exit(1);
});
