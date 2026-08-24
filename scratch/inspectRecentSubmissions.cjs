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

async function inspectRecent() {
  console.log("=== RECENT SUBMISSIONS IN FIRESTORE ===");
  const subSnap = await db.collection("submissions").orderBy("submittedAt", "desc").limit(5).get();
  subSnap.forEach(d => {
    const data = d.data();
    console.log(`\nDoc ID: ${d.id}`);
    console.log(`Student: ${data.studentName} | Grade: ${data.grade}`);
    console.log(`Scores:`, data.scores);
    console.log(`Answers JSON (first 300 chars):`, String(data.answersJson).substring(0, 300));
  });

  console.log("\n=== RECENT AUDIT LOGS IN FIRESTORE ===");
  const auditSnap = await db.collection("audit_logs").orderBy("timestamp", "desc").limit(5).get();
  auditSnap.forEach(d => {
    const data = d.data();
    console.log(`\nAudit ID: ${d.id}`);
    console.log(`Action: ${data.action} | Student: ${data.studentName} | Grade: ${data.grade}`);
    console.log(`Scores:`, data.scores);
  });

  process.exit(0);
}

inspectRecent().catch(err => {
  console.error(err);
  process.exit(1);
});
