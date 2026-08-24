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

async function inspectDoc() {
  const docSnap = await db.collection("submissions").doc("sub_702578").get();
  if (docSnap.exists) {
    console.log(JSON.stringify(docSnap.data(), null, 2));
  } else {
    console.log("Not found");
  }
  process.exit(0);
}

inspectDoc().catch(err => {
  console.error(err);
  process.exit(1);
});
