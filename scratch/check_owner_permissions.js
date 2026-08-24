import admin from "firebase-admin";
import path from "path";
import { readFileSync, existsSync } from "fs";

const keyPath = path.join(process.cwd(), "serviceAccountKey.json");
if (existsSync(keyPath)) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}

async function run() {
  const db = admin.firestore();
  const snap = await db.collection("memberships").where("email", "==", "butyakaz24@gmail.com").get();
  console.log(`Found ${snap.size} membership documents for butyakaz24@gmail.com:`);
  snap.docs.forEach(doc => {
    console.log("Doc ID:", doc.id, "Data:", JSON.stringify(doc.data(), null, 2));
  });
  process.exit(0);
}

run();
