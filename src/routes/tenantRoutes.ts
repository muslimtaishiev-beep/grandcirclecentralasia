import { Router } from "express";
import admin from "firebase-admin";
import { requireFirebaseAuth } from "./authRoutes";

const router = Router();

// POST /api/tenants/request - Request a new organization
router.post("/request", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const { organizationName, contactEmail, contactPhone, contactPerson, description } = req.body;
    const uid = req.user.uid;
    const db = admin.firestore();

    if (!organizationName || !contactEmail) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const inviteId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const requestData = {
      id: inviteId,
      organizationName,
      contactEmail,
      contactPhone: contactPhone || "",
      contactPerson: contactPerson || req.user.email,
      description: description || "",
      requestedByUserId: uid,
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      rejectReason: null,
    };

    await db.collection("tenant_invites").doc(inviteId).set(requestData);

    return res.json({ success: true, request: requestData });
  } catch (error: any) {
    console.error("[Tenants/Request] Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/tenants/my - List current user's organizations
router.get("/my", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const uid = req.user.uid;
    const db = admin.firestore();

    const membershipsSnapshot = await db
      .collection("memberships")
      .where("userId", "==", uid)
      .where("status", "==", "active")
      .get();

    const tenantIds = membershipsSnapshot.docs.map(doc => doc.data().tenantId);

    if (tenantIds.length === 0) {
      return res.json({ success: true, tenants: [] });
    }

    // Fetch tenant details
    const tenantsSnapshot = await db
      .collection("tenants")
      .where("id", "in", tenantIds.slice(0, 10))
      .get();

    const tenants = tenantsSnapshot.docs.map(doc => doc.data());

    return res.json({ success: true, tenants });
  } catch (error: any) {
    console.error("[Tenants/My] Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Middleware to check if user is an admin of the tenant
const requireTenantAdmin = async (req: any, res: any, next: any) => {
  try {
    const uid = req.user.uid;
    const tenantId = req.params.id;
    const db = admin.firestore();

    const membershipsSnapshot = await db
      .collection("memberships")
      .where("userId", "==", uid)
      .where("tenantId", "==", tenantId)
      .where("status", "==", "active")
      .get();

    if (membershipsSnapshot.empty) {
      return res.status(403).json({ error: "Access denied. Not a member." });
    }

    const membership = membershipsSnapshot.docs[0].data();
    if (membership.role !== "org:owner" && membership.role !== "org:admin") {
      return res.status(403).json({ error: "Access denied. Requires org:admin role." });
    }

    req.membership = membership;
    next();
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// POST /api/tenants/:id/invite - Invite staff to the organization
router.post("/:id/invite", requireFirebaseAuth, requireTenantAdmin, async (req: any, res: any) => {
  try {
    const { email, role } = req.body;
    const tenantId = req.params.id;
    const uid = req.user.uid;
    const db = admin.firestore();

    if (!email || !role) {
      return res.status(400).json({ success: false, error: "Missing email or role" });
    }

    const allowedRoles = ["org:admin", "org:manager", "org:teacher", "org:student"];
    if (role === "org:owner" && req.membership.role !== "org:owner") {
      return res.status(403).json({ success: false, error: "Only an org:owner can transfer or grant owner role." });
    }
    if (role !== "org:owner" && !allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, error: "Invalid role specified." });
    }

    // Typically you would send an email here. For now, just create a membership record 
    // or link it if the user already exists.
    
    // Check if user exists
    let targetUserId = "";
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      targetUserId = userRecord.uid;
    } catch (authErr: any) {
      if (authErr.code === "auth/user-not-found") {
        // User doesn't exist yet, we could create a placeholder or just store the invite by email.
        return res.status(404).json({ success: false, error: "User with this email not found. They must register first." });
      }
      throw authErr;
    }

    // Check if membership already exists
    const existingSnapshot = await db.collection("memberships")
      .where("userId", "==", targetUserId)
      .where("tenantId", "==", tenantId)
      .get();

    if (!existingSnapshot.empty) {
      return res.status(400).json({ success: false, error: "User is already a member or invited" });
    }

    const membershipId = `mem_${targetUserId}_${tenantId}`;
    await db.collection("memberships").doc(membershipId).set({
      id: membershipId,
      userId: targetUserId,
      tenantId: tenantId,
      role: role,
      status: "active", // In a real app, this would be 'invited' until they accept
      invitedBy: uid,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ success: true, message: "User invited successfully" });
  } catch (error: any) {
    console.error("[Tenants/Invite] Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/tenants/:id/members - List members
router.get("/:id/members", requireFirebaseAuth, requireTenantAdmin, async (req: any, res: any) => {
  try {
    const tenantId = req.params.id;
    const db = admin.firestore();

    const snapshot = await db.collection("memberships").where("tenantId", "==", tenantId).get();
    const memberships = snapshot.docs.map(doc => doc.data());

    // Populate user info (basic implementation)
    const userIds = memberships.map(m => m.userId);
    let usersMap: Record<string, any> = {};
    
    if (userIds.length > 0) {
      const usersSnapshot = await db.collection("users").where("id", "in", userIds.slice(0, 10)).get();
      usersSnapshot.forEach(doc => {
        usersMap[doc.id] = doc.data();
      });
    }

    const membersWithData = memberships.map(m => ({
      ...m,
      user: usersMap[m.userId] || { email: "Unknown", displayName: "Unknown" }
    }));

    return res.json({ success: true, members: membersWithData });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
