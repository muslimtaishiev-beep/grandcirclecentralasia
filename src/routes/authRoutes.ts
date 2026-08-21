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
      // Create default profile if it doesn't exist
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
      // Update last login
      await db.collection("users").doc(uid).update({
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      userData.lastLoginAt = new Date().toISOString();
    }

    // Get memberships
    const membershipsSnapshot = await db
      .collection("memberships")
      .where("userId", "==", uid)
      .where("status", "==", "active")
      .get();

    const memberships = membershipsSnapshot.docs.map((doc) => doc.data());

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

export default router;
