import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import * as fs from 'fs';
import * as path from 'path';

// Firebase Config
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyB-xxxxx", // Will read from .env
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Read allowedStudents.ts
const code = fs.readFileSync(path.join(__dirname, 'src/data/allowedStudents.ts'), 'utf-8');
const match = code.match(/export const allowedStudents = \[([\s\S]*?)\];/);
if (match) {
  const students = match[1].split(',').map(s => s.trim().replace(/"/g, '')).filter(s => s.length > 0);
  
  async function seed() {
    console.log(`Seeding ${students.length} students into 'decisions' collection...`);
    let count = 0;
    for (const name of students) {
      try {
        await setDoc(doc(db, 'decisions', name), {
          fullName: name,
          decisionStatus: 'pending',
          updatedAt: new Date().toISOString()
        }, { merge: true }); // merge to not overwrite existing decisions
        count++;
        if (count % 10 === 0) console.log(`Seeded ${count}...`);
      } catch (err) {
        console.error(`Failed for ${name}`, err);
      }
    }
    console.log(`Finished seeding ${count} students.`);
    process.exit(0);
  }
  
  seed();
} else {
  console.log("Could not parse allowedStudents.ts");
}
