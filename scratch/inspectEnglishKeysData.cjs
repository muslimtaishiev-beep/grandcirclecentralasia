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

async function inspectEng() {
  for (const g of [8, 9, 10, 11]) {
    const docSnap = await db.collection("test_answer_keys").doc(`key_grade_${g}_org_future_leaders`).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      const keys = data.keys || {};
      const enKeys = keys.english || {};
      console.log(`\n=== key_grade_${g}_org_future_leaders ===`);
      console.log(`Total english keys count: ${Object.keys(enKeys).length}`);
      console.log(`Sample 3 keys:`, JSON.stringify(Object.entries(enKeys).slice(0, 3), null, 2));
    }
  }
  process.exit(0);
}

inspectEng().catch(err => {
  console.error(err);
  process.exit(1);
});
