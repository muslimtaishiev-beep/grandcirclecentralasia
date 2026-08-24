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

async function check() {
  const users = await db.collection('users').get();
  console.log(`Found ${users.size} users.`);
  users.forEach(doc => {
    console.log(doc.id, "=>", doc.data().email);
  });
}

check().catch(console.error);
