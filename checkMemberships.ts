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
  const snapshot = await db.collection('memberships').get();
  console.log(`Found ${snapshot.size} memberships.`);
  snapshot.forEach(doc => {
    console.log(doc.id, "=>", doc.data());
  });
  
  const tenants = await db.collection('tenants').get();
  console.log(`\nFound ${tenants.size} tenants.`);
  tenants.forEach(doc => {
    console.log(doc.id, "=>", doc.data().name);
  });
}

check().catch(console.error);
