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

async function findEnglishKeys() {
  const snap = await db.collection("test_answer_keys").get();
  console.log(`Found ${snap.size} documents in test_answer_keys:`);
  snap.forEach(d => {
    const data = d.data();
    const keys = data.keys || {};
    const enKeys = keys.english || {};
    const enCount = Object.keys(enKeys).length;
    console.log(`  Doc ID: ${d.id} | Grade: ${data.grade} | Tenant: ${data.tenantId} | English Keys Count: ${enCount}`);
    if (enCount > 0) {
      console.log(`     Sample keys:`, Object.keys(enKeys).slice(0, 5));
    }
  });

  process.exit(0);
}

findEnglishKeys().catch(err => {
  console.error(err);
  process.exit(1);
});
