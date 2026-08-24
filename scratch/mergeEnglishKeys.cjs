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

async function mergeEnglishKeys() {
  console.log("=== MERGING ENGLISH KEYS INTO ALL TEST ANSWER KEYS DOCS ===");

  for (const grade of [8, 9, 10, 11]) {
    const srcDoc = await db.collection("test_answer_keys").doc(`key_grade_${grade}_org_future_leaders`).get();
    if (!srcDoc.exists) continue;

    const rawEnglishMap = srcDoc.data()?.keys?.english || {};
    const formattedEnglishMap = {};

    Object.values(rawEnglishMap).forEach(q => {
      if (q && q.id) {
        let ans = q.ans || q.answer || (q.options ? q.options[1] : undefined);
        if (ans !== undefined) {
          formattedEnglishMap[q.id] = {
            ans: String(ans),
            topic: q.topic || "Грамматика и лексика английского языка",
            pts: q.points || 1
          };
        }
      }
    });

    console.log(`Grade ${grade}: Formatted ${Object.keys(formattedEnglishMap).length} English keys`);

    // Targets to update
    const targetDocIds = [
      `test_grade_${grade}`,
      `test_grade_${grade}_org_future_leaders`,
      `${grade}`
    ];

    for (const docId of targetDocIds) {
      const docRef = db.collection("test_answer_keys").doc(docId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const existingKeys = docSnap.data()?.keys || {};
        existingKeys.english = { ...existingKeys.english, ...formattedEnglishMap };
        await docRef.set({ keys: existingKeys }, { merge: true });
        console.log(`  Updated ${docId} with ${Object.keys(formattedEnglishMap).length} English keys`);
      }
    }
  }

  process.exit(0);
}

mergeEnglishKeys().catch(err => {
  console.error(err);
  process.exit(1);
});
