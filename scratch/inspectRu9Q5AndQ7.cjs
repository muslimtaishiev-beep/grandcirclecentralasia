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

async function inspectQ5AndQ7() {
  const testDoc = await db.collection("tests").doc("test_grade_9").get();
  const ruQuestions = testDoc.data()?.questions?.russian || [];
  
  const q5 = ruQuestions.find(q => q.id === 'ru_9_q5');
  const q7 = ruQuestions.find(q => q.id === 'ru_9_q7');

  console.log("=== RU_9_Q5 FULL OBJECT ===");
  console.log(JSON.stringify(q5, null, 2));

  console.log("\n=== RU_9_Q7 FULL OBJECT ===");
  console.log(JSON.stringify(q7, null, 2));

  process.exit(0);
}

inspectQ5AndQ7().catch(err => {
  console.error(err);
  process.exit(1);
});
