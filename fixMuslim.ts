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

async function fix() {
  const uids = ["UfuVj4uTaUNB0l13S0baEMe0Tl33", "ihXPrTxNpQR8ABL1vdSAFWl6LL83"];
  for (const uid of uids) {
    const memId = `mem_${uid}_org_future_leaders`;
    await db.collection("memberships").doc(memId).set({
      id: memId,
      userId: uid,
      tenantId: "org_future_leaders",
      displayName: "Muslim Taishiev",
      role: "org:owner",
      status: "active",
      permissions: {
        canManageOrganization: true,
        canManageUsers: true,
        canCreateTests: true,
        canReviewSubmissions: true,
        canViewAnalytics: true,
        canManageSchedule: true,
        canViewFinancials: true
      },
      joinedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("Added membership for UID:", uid);
  }
}

fix().catch(console.error);
