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
  console.error("No service account key found");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function inspectServerQuery() {
  const resolvedTenantId = 'org_future_leaders';
  for (const grade of [7, 8, 9, 10, 11]) {
    console.log(`\n--- SERVER FETCH FOR GRADE ${grade} ---`);
    let keySnap = await db.collection("test_answer_keys")
      .where("tenantId", "==", resolvedTenantId)
      .where("grade", "==", Number(grade))
      .limit(1)
      .get();

    if (!keySnap.empty) {
      const doc = keySnap.docs[0];
      console.log(`Matched Doc ID: ${doc.id}`);
      const keys = doc.data()?.keys || {};
      console.log("  Russian keys:", Object.keys(keys.russian || {}));
      console.log("  Math keys:", Object.keys(keys.math || {}));
      console.log("  Logic keys:", Object.keys(keys.logic || {}));
      console.log("  English keys:", Object.keys(keys.english || {}));
    } else {
      console.log("No doc matched query!");
    }
  }
  process.exit(0);
}

inspectServerQuery().catch(err => {
  console.error(err);
  process.exit(1);
});
