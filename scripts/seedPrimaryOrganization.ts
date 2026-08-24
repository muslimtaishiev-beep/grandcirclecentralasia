import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (getApps().length === 0) {
  const keyPath = path.join(__dirname, "../serviceAccountKey.json");
  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

async function seedPrimaryOrganization() {
  console.log("Starting seed for primary organization...");
  
  const tenantId = "org_future_leaders";
  
  // 1. Create Tenant Document
  const tenantDoc = {
    id: tenantId,
    name: "Future Leaders Academy",
    subdomain: "futureleaders",
    tierId: "enterprise",
    status: "active",
    enabledModules: [
      'MODULE_ANTI_CHEAT_PROCTORING', 
      'MODULE_STUDENT_QR_IDENTIFIERS', 
      'MODULE_DIAGNOSTIC_PDF_ENGINE', 
      'MODULE_EDU_CORE_JOURNAL', 
      'MODULE_CRM_PIPELINES', 
      'MODULE_WEBRTC_CONFERENCING', 
      'MODULE_NOCODE_FUNCTION_STUDIO', 
      'MODULE_SITE_LANDING_BUILDER', 
      'MODULE_COLLAB_DOCS_SHEETS'
    ],
    ownerEmail: "admin@futureleaders.kz",
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await db.collection("tenants").doc(tenantId).set(tenantDoc, { merge: true });
  console.log("✅ Created tenant:", tenantId);

  // 2. Create Owner Membership
  const memberId = `${tenantId}_admin_futureleaders_kz`;
  await db.collection("memberships").doc(memberId).set({
    tenantId,
    email: "admin@futureleaders.kz",
    role: "org:owner",
    createdAt: Date.now()
  }, { merge: true });
  console.log("✅ Created owner membership");

  // 3. Optional: Create Default CRM Pipeline
  await db.collection(`tenants/${tenantId}/crm_pipelines`).doc("default_pipeline").set({
    name: "Воронка продаж",
    stages: ["Новый лид", "В работе", "Принимает решение", "Успешно реализовано", "Закрыто и не реализовано"]
  }, { merge: true });
  console.log("✅ Created default CRM pipeline");

  console.log("🏁 Seeding complete!");
  process.exit(0);
}

seedPrimaryOrganization().catch(err => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
