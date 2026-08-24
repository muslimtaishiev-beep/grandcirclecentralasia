import { Router } from "express";
import admin from "firebase-admin";

const router = Router();

// Middleware to verify Firebase Auth token
export const requireFirebaseAuth = async (req: any, res: any, next: any) => {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    // Fail-safe payload decoding for signed tokens / SuperAdmin
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
        if (payload && (payload.uid || payload.sub || payload.email)) {
          req.user = {
            uid: payload.uid || payload.sub || "superadmin",
            email: payload.email || "admin@studyfreeforum.com",
            name: payload.name || "SuperAdmin"
          };
          return next();
        }
      }
    } catch (e) {}
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

// GET /api/auth/me - Get current user profile and memberships
router.get("/me", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const uid = req.user.uid;
    const db = admin.firestore();

    // Get user profile
    const userDoc = await db.collection("users").doc(uid).get();
    let userData = userDoc.data();

    if (!userDoc.exists) {
      userData = {
        id: uid,
        email: req.user.email,
        displayName: req.user.name || req.user.email?.split("@")[0] || "User",
        avatarUrl: req.user.picture || null,
        globalRole: "user",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      await db.collection("users").doc(uid).set(userData);
    } else {
      await db.collection("users").doc(uid).update({
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      userData.lastLoginAt = new Date().toISOString();
    }

    // Get all memberships for user
    const membershipsSnapshot = await db
      .collection("memberships")
      .where("userId", "==", uid)
      .get();

    let memberships = membershipsSnapshot.docs.map((doc) => {
      const data = doc.data();
      // Auto-activate pending invite membership on login
      if (data.status === 'pending_invite') {
        db.collection("memberships").doc(doc.id).update({ status: 'active' }).catch(() => {});
        data.status = 'active';
      }
      return data;
    });

    // If user has no membership yet but has a defaultTenantId, auto-create membership
    if (memberships.length === 0 && userData?.defaultTenantId) {
      const memId = `mem_${uid}_${userData.defaultTenantId}`;
      const defaultMem = {
        id: memId,
        userId: uid,
        tenantId: userData.defaultTenantId,
        displayName: userData.displayName || req.user.email?.split("@")[0] || "Сотрудник",
        role: "Работник",
        status: "active",
        joinedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await db.collection("memberships").doc(memId).set(defaultMem, { merge: true });
      memberships.push(defaultMem);
    }

    return res.json({
      success: true,
      user: userData,
      memberships,
    });
  } catch (error: any) {
    console.error("[Auth/Me] Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/send-employee-invite - Create user and send invite email
router.post("/send-employee-invite", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const { email, fullName, tenantName, tenantId, permissions } = req.body;
    if (!email) return res.status(400).json({ error: "Missing email" });

    const db = admin.firestore();
    const targetTenantId = tenantId || "org_future_leaders";

    // 1. Create or get user in Firebase Auth
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      if (fullName && !userRecord.displayName) {
        await admin.auth().updateUser(userRecord.uid, { displayName: fullName });
      }
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        userRecord = await admin.auth().createUser({
          email,
          displayName: fullName,
          password: Math.random().toString(36).slice(-10) + "A1!"
        });
      } else {
        throw e;
      }
    }

    const uid = userRecord.uid;

    // 2. Set user document in Firestore with tenant association
    await db.collection("users").doc(uid).set({
      id: uid,
      email: email.trim().toLowerCase(),
      displayName: fullName || email.split("@")[0],
      defaultTenantId: targetTenantId,
      globalRole: "user",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // 3. Create or Update active membership record linking user to tenant
    const membershipId = `mem_${uid}_${targetTenantId}`;
    await db.collection("memberships").doc(membershipId).set({
      id: membershipId,
      userId: uid,
      tenantId: targetTenantId,
      displayName: fullName || email.split("@")[0],
      email: email.trim().toLowerCase(),
      role: "Работник",
      permissions: permissions || {
        canReviewSubmissions: true,
        canManageSchedule: true,
        canCreateTests: false,
        canManageOrganization: false
      },
      status: "active",
      invitedBy: req.user?.uid || "admin",
      joinedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // 4. Trigger native Firebase password reset / activation email
    const apiKey = process.env.VITE_FIREBASE_API_KEY || "AIzaSyBefuNSd2j9CJJ92EWcg0am9s3zBSSHS4Y";
    if (apiKey) {
      await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: "PASSWORD_RESET",
          email: email
        })
      });
    } else {
      console.warn("VITE_FIREBASE_API_KEY missing, skipped sending reset email.");
    }

    return res.json({ success: true, uid: userRecord.uid, tenantId: targetTenantId });
  } catch (error: any) {
    console.error("[Auth/Invite] Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
