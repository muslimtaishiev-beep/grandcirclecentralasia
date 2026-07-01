import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import * as fs from 'fs';
import * as path from 'path';

// Replace these values with your actual Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyBefuNSd2j9CJJ92EWcg0am9s3zBSSHS4Y",
  authDomain: "study-64ebf.firebaseapp.com",
  projectId: "study-64ebf",
  storageBucket: "study-64ebf.firebasestorage.app",
  messagingSenderId: "53040624855",
  appId: "1:53040624855:web:ec3ffb04513bc2237fac92",
  measurementId: "G-L1SZKG6Y2J"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Read allowedStudents.ts
const code = fs.readFileSync(path.join(process.cwd(), 'src/data/allowedStudents.ts'), 'utf-8');
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
