import admin from "firebase-admin";
import path from "path";
import { readFileSync, existsSync } from "fs";

// Initialize Firebase Admin
const keyPath = path.join(process.cwd(), "serviceAccountKey.json");
if (existsSync(keyPath)) {
  const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("Firebase initialized from serviceAccountKey.json");
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("Firebase initialized from process.env");
} else {
  console.error("No serviceAccountKey.json or process.env found");
  process.exit(1);
}

const targetEmail = "butyakaz24@gmail.com";
const tenantId = "org_future_leaders";
const tenantName = "Академия Будущих Лидеров";

async function run() {
  try {
    const db = admin.firestore();
    
    // 1. Get or Create user in Firebase Auth
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(targetEmail);
      console.log(`Found Auth user: ${userRecord.uid} (${userRecord.email})`);
    } catch (err) {
      console.log(`User ${targetEmail} not found in Auth. Creating user...`);
      userRecord = await admin.auth().createUser({
        email: targetEmail,
        displayName: "butyakaz24",
        emailVerified: true
      });
      console.log(`Created Auth user: ${userRecord.uid}`);
    }

    const uid = userRecord.uid;

    // 2. Set user record in `users` collection
    await db.collection("users").doc(uid).set({
      id: uid,
      email: targetEmail,
      displayName: userRecord.displayName || "butyakaz24",
      defaultTenantId: tenantId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`Updated Firestore users/${uid} with defaultTenantId=${tenantId}`);

    // 3. Create or Update membership in `memberships` collection
    const membershipId = `mem_${uid}_${tenantId}`;
    const membershipData = {
      id: membershipId,
      userId: uid,
      tenantId: tenantId,
      tenantName: tenantName,
      displayName: userRecord.displayName || "butyakaz24",
      email: targetEmail,
      role: "Администратор",
      permissions: {
        canReviewSubmissions: true,
        canManageSchedule: true,
        canCreateTests: true,
        canManageOrganization: true,
        canManageCRM: true,
        canManageDocs: true,
        canManageTasks: true
      },
      status: "active",
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("memberships").doc(membershipId).set(membershipData, { merge: true });
    console.log(`Created/Updated membership ${membershipId} for tenant ${tenantId}`);

    // 4. Create membership in tenant subcollection `tenants/{tenantId}/memberships`
    await db.collection("tenants").doc(tenantId).collection("memberships").doc(uid).set(membershipData, { merge: true });
    console.log(`Created/Updated subcollection membership tenants/${tenantId}/memberships/${uid}`);

    console.log(`✅ SUCCESS: Granted tenant '${tenantName}' (${tenantId}) to ${targetEmail}!`);
    process.exit(0);
  } catch (e) {
    console.error("Error granting tenant:", e);
    process.exit(1);
  }
}

run();
