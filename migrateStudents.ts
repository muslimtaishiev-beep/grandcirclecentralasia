import * as dotenv from 'dotenv';
import admin from 'firebase-admin';
import * as path from 'path';

dotenv.config();

const keyPath = path.join(process.cwd(), "serviceAccountKey.json");
import * as fs from "fs"; const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf-8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

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
  
  const batch = db.batch();
  let count = 0;
  
  for (const s of students) {
    const contactRef = db.collection('tenants').doc(TARGET_TENANT).collection('crm_contacts').doc();
    
    const fullName = s.childName || s.studentName || s.shortId || "Unknown Student";
    const phone = s.parentPhone || s.phone || "";
    const email = s.email || "";
    
    // Remove undefined values
    const dataObj: any = {
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
      if (dataObj[key] === undefined || dataObj[key] === null) {
        delete dataObj[key]; // Delete both null and undefined for clean admin sdk writes
      }
    });

    batch.set(contactRef, dataObj);
    count++;
  }
  
  if (count > 0) {
    await batch.commit();
    console.log(`Successfully migrated ${count} students to Firestore via Admin SDK!`);
  } else {
    console.log("No students to migrate.");
  }
}

migrate().catch(console.error);
