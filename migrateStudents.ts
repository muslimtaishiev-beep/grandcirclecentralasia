import * as dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, writeBatch } from 'firebase/firestore';

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const GAS_URL = process.env.VITE_GAS_URL || process.env.GAS_URL;
const GAS_API_KEY = process.env.GAS_API_KEY || process.env.VITE_GAS_API_KEY;
const TARGET_TENANT = 'org_future_leaders';

async function migrate() {
  if (!GAS_URL) throw new Error("Missing GAS_URL");
  console.log('Fetching students from GAS...');
  
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'getAllStudents', apiKey: GAS_API_KEY }),
    redirect: 'follow'
  });
  
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse JSON. Response was:");
    console.log(text.substring(0, 500));
    return;
  }
  
  if (!data.success) {
    console.error("GAS returned error:", data);
    return;
  }
  
  const students = data.students || data.data || [];
  console.log(`Found ${students.length} students. Starting migration to tenant: ${TARGET_TENANT}...`);
  
  const batch = writeBatch(db);
  let count = 0;
  
  for (const s of students) {
    const contactRef = doc(collection(db, 'tenants', TARGET_TENANT, 'crm_contacts'));
    
    const fullName = s.childName || s.studentName || s.shortId || "Unknown Student";
    const phone = s.parentPhone || s.phone || "";
    const email = s.email || "";
    
    // Remove undefined values
    const dataObj = {
      fullName,
      phone,
      email,
      type: 'student',
      totalDealsCount: 1,
      totalRevenueGenerated: 0,
      createdAt: Date.now(),
      
      legacy_shortId: s.shortId || null,
      legacy_status: s.status || null,
      legacy_ru: s.ru || null,
      legacy_ma: s.ma || null,
      legacy_lo: s.lo || null,
      legacy_en: s.en || null,
      legacy_grade: s.grade || null,
      legacy_date: s.timestamp || s.date || null
    };
    
    Object.keys(dataObj).forEach(key => {
      if (dataObj[key] === undefined) {
        delete dataObj[key];
      }
    });

    batch.set(contactRef, dataObj);
    count++;
  }
  
  if (count > 0) {
    await batch.commit();
    console.log(`Successfully migrated ${count} students to Firestore!`);
  } else {
    console.log("No students to migrate.");
  }
}

migrate().catch(console.error);
