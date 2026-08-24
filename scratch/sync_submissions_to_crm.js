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
  console.log("=== Syncing Submissions to CRM Contacts & Deals ===");

  // 1. Fetch all submissions
  const subSnap = await db.collection("submissions").get();
  console.log(`Found ${subSnap.size} submissions in Firestore.`);

  let createdContacts = 0;
  let createdDeals = 0;

  for (const doc of subSnap.docs) {
    const data = doc.data();
    const tenantId = data.tenantId || "org_future_leaders";
    const shortId = data.studentShortId || data.shortId || doc.id.replace("sub_", "");
    const studentName = data.studentName || "Ученик " + shortId;
    const studentPhone = data.studentPhone || data.phone || "—";
    const studentEmail = data.studentEmail || data.email || `${shortId}@student.edu`;
    const grade = data.grade || 7;
    const scores = data.scores || {};
    const totalScore = scores.total || (scores.russian + scores.math + scores.logic) || 0;

    // Contact Doc ID
    const contactId = `cnt_${tenantId}_${shortId}`;
    const contactData = {
      id: contactId,
      tenantId,
      fullName: studentName,
      name: studentName,
      email: studentEmail,
      phone: studentPhone,
      shortId: shortId,
      type: "student",
      grade: Number(grade),
      totalScore: totalScore,
      scores: scores,
      status: "test_completed",
      totalDealsCount: 1,
      totalRevenueGenerated: 0,
      createdAt: data.submittedAt || admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Save to root crm_contacts & tenant nested crm_contacts
    await db.collection("crm_contacts").doc(contactId).set(contactData, { merge: true });
    await db.collection("tenants").doc(tenantId).collection("crm_contacts").doc(contactId).set(contactData, { merge: true });
    createdContacts++;

    // Deal Doc ID
    const dealId = `deal_${tenantId}_${shortId}`;
    const dealData = {
      id: dealId,
      tenantId,
      title: `Поступление: ${studentName} (${grade} класс)`,
      contactName: studentName,
      contactPhone: studentPhone,
      contactEmail: studentEmail,
      shortId: shortId,
      grade: Number(grade),
      stageId: "stage_new",
      value: 15000,
      testScore: totalScore,
      cheated: Boolean(data.cheated),
      createdAt: data.submittedAt || admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Save to root crm_deals & tenant nested crm_deals
    await db.collection("crm_deals").doc(dealId).set(dealData, { merge: true });
    await db.collection("tenants").doc(tenantId).collection("crm_deals").doc(dealId).set(dealData, { merge: true });
    createdDeals++;
  }

  // 2. Also check `exam_sessions`
  const sessionSnap = await db.collection("exam_sessions").get();
  console.log(`Found ${sessionSnap.size} exam_sessions in Firestore.`);

  for (const doc of sessionSnap.docs) {
    const data = doc.data();
    const tenantId = data.tenantId || "org_future_leaders";
    const shortId = data.studentShortId || doc.id;
    const studentName = data.studentName || "Ученик " + shortId;
    const contactId = `cnt_${tenantId}_${shortId}`;

    const contactData = {
      id: contactId,
      tenantId,
      fullName: studentName,
      name: studentName,
      shortId: shortId,
      type: "student",
      grade: Number(data.grade || 7),
      status: data.status === "COMPLETED" ? "test_completed" : "testing_in_progress",
      createdAt: data.startedAt || admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("crm_contacts").doc(contactId).set(contactData, { merge: true });
    await db.collection("tenants").doc(tenantId).collection("crm_contacts").doc(contactId).set(contactData, { merge: true });
  }

  console.log(`✅ CRM Sync Completed! Created/Updated ${createdContacts} Contacts and ${createdDeals} Deals in Firestore.`);
  process.exit(0);
}

run();
