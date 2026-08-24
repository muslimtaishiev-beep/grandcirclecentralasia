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
  const userRecord = await admin.auth().getUserByEmail('admin@futureleaders.kz').catch(() => null);
  if (!userRecord) {
    console.log("User not found in Auth");
    return;
  }
  
  const uid = userRecord.uid;
  console.log("Found UID:", uid);
  
  await db.collection('memberships').doc('org_future_leaders_admin_futureleaders_kz').update({
    userId: uid,
    status: 'active'
  });
  
  console.log("Fixed membership!");
}

fix().catch(console.error);
