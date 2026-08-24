import admin from "firebase-admin";
import path from "path";
import { readFileSync, existsSync } from "fs";
import https from "https";

const keyPath = path.join(process.cwd(), "serviceAccountKey.json");
if (existsSync(keyPath)) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}

const db = admin.firestore();
const scriptUrl = "https://script.google.com/macros/s/AKfycbymI1U53npCYIscbcWG-0Cflkop2u7KocPvXY_yUSjJlDscQ8FkoYDXOTh2uNlpQHPr/exec";

function fetchGasStudents() {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      action: "getAllStudents",
      apiKey: "GRAND_CIRCLE_SECURE_API_KEY_2026"
    });

    const req = https.request(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let finalRes = res;
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, (redRes) => {
          let body = '';
          redRes.on('data', chunk => body += chunk);
          redRes.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(e);
            }
          });
        }).on('error', reject);
      } else {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      }
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log("=== Fetching 55 Students from Google Apps Script ===");
  try {
    const gasData = await fetchGasStudents();
    const students = Array.isArray(gasData) ? gasData : (gasData.students || gasData.data || []);
    console.log(`Found ${students.length} students in Google Apps Script!`);

    const tenantId = "org_future_leaders";
    const batch = db.batch();

    let count = 0;
    for (const st of students) {
      const shortId = (st.shortId || st.studentShortId || Math.floor(100000 + Math.random() * 900000)).toString();
      const studentName = st.childName || st.studentName || st.name || `Ученик ${shortId}`;
      const grade = Number(st.grade || 7);
      const phone = st.phone || st.parentPhone || "—";
      const parentName = st.parentName || "—";
      
      const ruScore = Number(st.ru || st.russian || 0);
      const maScore = Number(st.ma || st.math || 0);
      const loScore = Number(st.lo || st.logic || 0);
      const enScore = Number(st.en || st.english || 0);
      const totalScore = ruScore + maScore + loScore + enScore;

      const cheated = Boolean(st.cheated);
      const managerName = st.managerName || "Не назначен";
      const finalDecision = st.finalDecision || "НЕ ОБРАБОТАН";

      // 1. Submissions
      const submissionId = `sub_${shortId}`;
      const subRef = db.collection("submissions").doc(submissionId);
      batch.set(subRef, {
        id: submissionId,
        tenantId,
        testId: `test_${shortId}`,
        sessionId: `test_${shortId}`,
        studentName,
        studentShortId: shortId,
        grade,
        submittedAt: admin.firestore.Timestamp.now(),
        cheated,
        scores: {
          russian: ruScore,
          math: maScore,
          logic: loScore,
          english: enScore,
          total: totalScore
        },
        maxScoreSnapshot: 35,
        status: "ЗАВЕРШЕН",
        managerName,
        finalDecision,
        source: "google_sheets_import"
      }, { merge: true });

      // 2. crm_contacts (Root & Tenant)
      const contactId = `cnt_${tenantId}_${shortId}`;
      const contactDoc = {
        id: contactId,
        tenantId,
        fullName: studentName,
        name: studentName,
        shortId,
        phone,
        parentName,
        email: `${shortId}@student.edu`,
        type: "student",
        grade,
        totalScore,
        scores: {
          russian: ruScore,
          math: maScore,
          logic: loScore,
          english: enScore,
          total: totalScore
        },
        status: finalDecision === "ЗАЧИСЛЕН" ? "enrolled" : "test_completed",
        managerName,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };
      batch.set(db.collection("crm_contacts").doc(contactId), contactDoc, { merge: true });
      batch.set(db.collection("tenants").doc(tenantId).collection("crm_contacts").doc(contactId), contactDoc, { merge: true });

      // 3. crm_deals (Root & Tenant)
      const dealId = `deal_${tenantId}_${shortId}`;
      const dealDoc = {
        id: dealId,
        tenantId,
        title: `Поступление: ${studentName} (${grade} класс)`,
        contactName: studentName,
        contactPhone: phone,
        shortId,
        grade,
        stageId: finalDecision === "ЗАЧИСЛЕН" ? "stage_won" : "stage_new",
        value: 15000,
        testScore: totalScore,
        cheated,
        managerName,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };
      batch.set(db.collection("crm_deals").doc(dealId), dealDoc, { merge: true });
      batch.set(db.collection("tenants").doc(tenantId).collection("crm_deals").doc(dealId), dealDoc, { merge: true });

      count++;
    }

    await batch.commit();
    console.log(`🎉 SUCCESS! Fast batch imported ${count} students into Firestore!`);
  } catch (err) {
    console.error("Batch import failed:", err);
  }
  process.exit(0);
}

run();
