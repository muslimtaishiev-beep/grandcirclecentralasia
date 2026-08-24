import * as dotenv from 'dotenv';
import admin from 'firebase-admin';
import * as path from 'path';

dotenv.config();
const keyPath = path.join(process.cwd(), "serviceAccountKey.json");
import * as fs from "fs";
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf-8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fix() {
  const userRecord = await admin.auth().getUserByEmail('leaderskg75@gmail.com').catch(() => null);
  if (!userRecord) {
    console.log("Aigerim not found in Auth");
    return;
  }
  
  const uid = userRecord.uid;
  console.log("Found Aigerim UID:", uid);
  
  const snap = await db.collection('memberships').where('email', '==', 'leaderskg75@gmail.com').get();
  snap.forEach(async (doc) => {
    await doc.ref.update({
      userId: uid,
      status: 'active'
    });
    console.log("Fixed Aigerim membership:", doc.id);
  });
}

fix().catch(console.error);
