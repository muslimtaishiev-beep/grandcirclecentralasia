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
  const uid = "Q0aFPyNAQnfpFl4KCkA1lSEkgS62";
  const email = "butyakaz24@gmail.com";
  const tenantId = "org_future_leaders";

  // 1. Activate the owner's original membership document
  const ownerDocId = "mem_1787574043574_mprb3";
  const ownerPermissions = [
    "tests:read",
    "tests:review",
    "crm:read",
    "tests:manage",
    "certificates:issue",
    "edu:schedule",
    "crm:manage",
    "team:manage"
  ];

  await db.collection("memberships").doc(ownerDocId).set({
    status: "active",
    userId: uid,
    displayName: "Казиева Алима Канатовна",
    name: "Казиева Алима Канатовна",
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  // 2. Also update canonical user profile name
  await db.collection("users").doc(uid).set({
    displayName: "Казиева Алима Канатовна",
    defaultTenantId: tenantId
  }, { merge: true });

  // 3. Update second canonical membership to include the exact owner permissions list
  const canonicalDocId = `mem_${uid}_${tenantId}`;
  await db.collection("memberships").doc(canonicalDocId).set({
    displayName: "Казиева Алима Канатовна",
    name: "Казиева Алима Канатовна",
    role: "admin",
    ownerPermissions: ownerPermissions,
    status: "active",
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  console.log("✅ Synchronized owner permissions for Казиева Алима Канатовна!");
  process.exit(0);
}

run();
