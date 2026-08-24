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

async function inspectLatestHour() {
  const oneHourAgo = new Date(Date.now() - 3600 * 1000);
  const snap = await db.collection("submissions")
    .where("submittedAt", ">=", oneHourAgo)
    .get();

  console.log(`Submissions in last 1 hour: ${snap.size}`);
  snap.forEach(d => {
    const data = d.data();
    console.log(`\nDoc ID: ${d.id}`);
    console.log(`Student: ${data.studentName} | Grade: ${data.grade}`);
    console.log(`Submitted At: ${data.submittedAt?.toDate ? data.submittedAt.toDate().toISOString() : data.submittedAt}`);
    console.log(`Scores:`, data.scores);
    console.log(`Answers JSON:`, data.answersJson);
  });

  process.exit(0);
}

inspectLatestHour().catch(err => {
  console.error(err);
  process.exit(1);
});
