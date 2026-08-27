import { Router } from "express";
import admin from "firebase-admin";
import { sendStaffInviteEmail } from "../../emailService.js";

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
    // NOTE: a "fail-safe" fallback used to decode the JWT payload WITHOUT
    // verifying its signature and accept any uid/sub/email it contained — an
    // authentication bypass for every endpoint behind this middleware
    // (/api/auth/me, staff invites). Signature verification is now mandatory.
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

    // This endpoint runs on every page render, so a log line per call would
    // bury the audit trail in noise. Only a genuinely new session is recorded:
    // a first-ever profile, or a gap of more than 30 minutes since the last
    // seen request. That gives one row per sign-in, which is what an audit
    // reader actually wants.
    const SESSION_GAP_MS = 30 * 60 * 1000;
    let isNewSession = false;

    if (!userDoc.exists) {
      isNewSession = true;
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
      const prev = userData?.lastLoginAt;
      const prevMs = prev?.toMillis ? prev.toMillis() : (prev ? Date.parse(prev) : 0);
      isNewSession = !prevMs || (Date.now() - prevMs) > SESSION_GAP_MS;
      await db.collection("users").doc(uid).update({
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      userData.lastLoginAt = new Date().toISOString();
    }

    if (isNewSession) {
      db.collection("audit_logs").add({
        timestamp: admin.firestore.Timestamp.now(),
        createdAt: new Date().toISOString(),
        action: "LOGIN_SUCCESS",
        tenantId: userData?.defaultTenantId || "unknown",
        actorUid: uid,
        actorEmail: req.user.email || "",
        actorName: userData?.displayName || "",
        ip: (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() || req.ip || "",
        userAgent: (req.headers["user-agent"] || "").toString().slice(0, 200),
      }).catch(() => {});
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

    // Link orphaned memberships: TenantProvisioningService.provisionNewTenant creates
    // the owner's membership by email BEFORE that person necessarily has a Firebase
    // Auth account, so it's written with no userId. Without this, that membership is
    // permanently invisible to the userId-keyed query above even after the owner signs
    // up/logs in with the matching email — they'd never see their own organization.
    if (req.user.email) {
      const orphanedByEmail = await db.collection("memberships")
        .where("email", "==", req.user.email)
        .get();
      const linkable = orphanedByEmail.docs.filter(d => !d.data().userId);
      if (linkable.length > 0) {
        await Promise.all(linkable.map(d => d.ref.update({ userId: uid, status: d.data().status || 'active' })));
        const relinked = linkable.map(d => ({ ...d.data(), userId: uid, status: d.data().status || 'active' }));
        memberships = [...memberships, ...relinked];
      }
    }

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

    // Sync Firebase Auth custom claims with active tenant memberships so that
    // firestore.rules can enforce real tenant isolation (resource.data.tenantId
    // in request.auth.token.tenantIds) instead of just "is authenticated", AND
    // per-tenant admin authority (tenantAdminIds) instead of any member being
    // able to rewrite roles/permissions in their own tenant.
    const activeMemberships = memberships.filter((m: any) => m.status === 'active');
    const activeTenantIds = Array.from(new Set(activeMemberships.map((m: any) => m.tenantId).filter(Boolean)));
    const ADMIN_ROLES = new Set(['org:owner', 'org:admin', 'owner', 'admin', 'Администратор']);
    const tenantAdminIds = Array.from(new Set(
      activeMemberships
        .filter((m: any) => ADMIN_ROLES.has(m.role) || String(m.role || '').includes('Руководитель'))
        .map((m: any) => m.tenantId)
        .filter(Boolean)
    ));
    const isSuperadminDoc = await db.collection("superadmins").doc(uid).get();
    const existingClaims = (req.user as any) || {};
    const claimsChanged =
      isSuperadminDoc.exists !== Boolean(existingClaims.isSuperadmin) ||
      JSON.stringify([...activeTenantIds].sort()) !== JSON.stringify([...(existingClaims.tenantIds || [])].sort()) ||
      JSON.stringify([...tenantAdminIds].sort()) !== JSON.stringify([...(existingClaims.tenantAdminIds || [])].sort());

    if (claimsChanged) {
      await admin.auth().setCustomUserClaims(uid, {
        tenantIds: activeTenantIds,
        tenantAdminIds,
        isSuperadmin: isSuperadminDoc.exists,
      });
    }

    return res.json({
      success: true,
      user: userData,
      memberships,
      tenantIds: activeTenantIds,
      claimsRefreshed: claimsChanged,
    });
  } catch (error: any) {
    console.error("[Auth/Me] Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/send-employee-invite - Create user and send invite email
router.post("/send-employee-invite", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const { email, fullName, tenantName, tenantId, permissions, role } = req.body;
    if (!email) return res.status(400).json({ error: "Missing email" });

    const db = admin.firestore();
    const targetTenantId = tenantId || "org_future_leaders";

    // SECURITY: only a tenant admin/owner (or platform superadmin) may invite staff
    // into a tenant. Without this check, any authenticated member of ANY tenant
    // could grant arbitrary permissions (including canManageOrganization) to a
    // brand new membership in a tenant they merely belong to.
    const isSuperadminDoc = await db.collection("superadmins").doc(req.user.uid).get();
    if (!isSuperadminDoc.exists) {
      const callerMemberships = await db.collection("memberships")
        .where("userId", "==", req.user.uid)
        .where("tenantId", "==", targetTenantId)
        .where("status", "==", "active")
        .get();
      const ADMIN_ROLES = new Set(['org:owner', 'org:admin', 'owner', 'admin', 'Администратор']);
      const isTenantAdmin = callerMemberships.docs.some(d => {
        const role = d.data().role;
        return ADMIN_ROLES.has(role) || String(role || '').includes('Руководитель');
      });
      if (!isTenantAdmin) {
        return res.status(403).json({ success: false, error: "Access denied. Requires tenant admin/owner role." });
      }
    }

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
      role: role || "Работник",
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

    // Refresh custom claims (tenantIds + tenantAdminIds) so tenant-scoped Firestore
    // rules apply on next token refresh — mirrors the sync logic in GET /api/auth/me.
    const allMemberships = await db.collection("memberships")
      .where("userId", "==", uid)
      .where("status", "==", "active")
      .get();
    const tenantIds = Array.from(new Set(allMemberships.docs.map(d => d.data().tenantId).filter(Boolean)));
    const ADMIN_ROLES = new Set(['org:owner', 'org:admin', 'owner', 'admin', 'Администратор']);
    const tenantAdminIds = Array.from(new Set(
      allMemberships.docs
        .filter(d => { const r = d.data().role; return ADMIN_ROLES.has(r) || String(r || '').includes('Руководитель'); })
        .map(d => d.data().tenantId)
        .filter(Boolean)
    ));
    const targetIsSuperadminDoc = await db.collection("superadmins").doc(uid).get();
    await admin.auth().setCustomUserClaims(uid, { tenantIds, tenantAdminIds, isSuperadmin: targetIsSuperadminDoc.exists });

    // 4. Send a branded Russian invite email (via Resend) carrying a real Firebase
    // password-reset link — replaces the old sendOobCode call, which only fires
    // Firebase's default (unbranded, English-first) template with no control over
    // content or language.
    let emailResult: { sent: boolean; reason?: string } = { sent: false, reason: "not attempted" };
    try {
      const resetLink = await admin.auth().generatePasswordResetLink(email);
      emailResult = await sendStaffInviteEmail({
        to: email,
        fullName: fullName || email.split("@")[0],
        tenantName: tenantName || "Академия Будущих Лидеров",
        role: role || "Работник",
        resetLink,
      });
      if (!emailResult.sent) {
        console.warn("[Auth/Invite] Branded invite email not sent:", emailResult.reason);
      }
    } catch (mailErr: any) {
      console.warn("[Auth/Invite] Failed to generate/send invite email:", mailErr.message);
    }

    return res.json({ success: true, uid: userRecord.uid, tenantId: targetTenantId, emailSent: emailResult.sent });
  } catch (error: any) {
    console.error("[Auth/Invite] Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
