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

async function inspect() {
  const grades = [7, 8, 9, 10, 11];
  for (const g of grades) {
    console.log(`\n=================== GRADE ${g} ===================`);
    const testDoc = await db.collection("tests").doc(`test_grade_${g}`).get();
    const keyDoc = await db.collection("test_answer_keys").doc(`test_grade_${g}`).get();

    if (testDoc.exists) {
      const qData = testDoc.data().questions || {};
      console.log("QUESTION IDs:");
      console.log("  Russian:", (qData.russian || []).map(q => q.id));
      console.log("  Math:", (qData.math || []).map(q => q.id));
      console.log("  Logic:", (qData.logic || []).map(q => q.id));
      console.log("  English:", (qData.english || []).map(q => q.id));
    } else {
      console.log("Test doc MISSING!");
    }

    if (keyDoc.exists) {
      const kData = keyDoc.data().keys || {};
      console.log("KEY IDs:");
      console.log("  Russian:", Object.keys(kData.russian || {}));
      console.log("  Math:", Object.keys(kData.math || {}));
      console.log("  Logic:", Object.keys(kData.logic || {}));
      console.log("  English:", Object.keys(kData.english || {}));
    } else {
      console.log("Key doc MISSING!");
    }
  }
  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
