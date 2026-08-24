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

async function inspectAllRecent() {
  const subSnap = await db.collection("submissions").limit(20).get();
  console.log("Found submissions count:", subSnap.size);
  subSnap.forEach(d => {
    const data = d.data();
    console.log(`\nDoc ID: ${d.id}`);
    console.log(`Student: ${data.studentName} | Grade: ${data.grade} | Status: ${data.status}`);
    console.log(`Scores:`, data.scores);
    if (data.answersJson) {
      console.log(`Answers JSON:`, String(data.answersJson).substring(0, 200));
    }
  });

  process.exit(0);
}

inspectAllRecent().catch(err => {
  console.error(err);
  process.exit(1);
});
