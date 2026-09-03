import { Router } from "express";
import { hasFullAccess, isPermissionKey } from "../shared/permissions.js";
import admin from "firebase-admin";
import { sendStaffInviteEmail } from "../../emailService.js";
import { callerPermissions } from "../server/access.js";
import { syncClaims } from "../server/claims.js";

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

    let memberships = membershipsSnapshot.docs.map((doc) => doc.data());

    // Link orphaned memberships: TenantProvisioningService.provisionNewTenant creates
    // the owner's membership by email BEFORE that person necessarily has a Firebase
    // Auth account, so it's written with no userId. Without this, that membership is
    // permanently invisible to the userId-keyed query above even after the owner signs
    // up/logs in with the matching email — they'd never see their own organization.
    //
    // Только при ПОДТВЕРЖДЁННОЙ почте: иначе достаточно зарегистрироваться с
    // чужим адресом, чтобы забрать чужое членство владельца.
    if (req.user.email && req.user.email_verified === true) {
      const emailRaw = String(req.user.email);
      const emailLc = emailRaw.toLowerCase();
      const seen = new Set<string>();
      const snaps = await Promise.all(
        [...new Set([emailRaw, emailLc])].map(e => db.collection("memberships").where("email", "==", e).get())
      );
      const orphanedDocs = snaps.flatMap(sn => sn.docs).filter(d => (seen.has(d.id) ? false : (seen.add(d.id), true)));
      const linkable = orphanedDocs.filter(d => !d.data().userId);
      if (linkable.length > 0) {
        await Promise.all(linkable.map(d => d.ref.update({ userId: uid, status: d.data().status || 'active' })));
        const relinked = linkable.map(d => ({ ...d.data(), userId: uid, status: d.data().status || 'active' }));
        memberships = [...memberships, ...relinked];
      }
    }

    // Членство по users.defaultTenantId здесь больше НЕ создаётся: это поле
    // пользователь мог записать себе сам и войти в любую организацию.
    // Членства заводят только приглашение и провижининг — на сервере.

    // Sync Firebase Auth custom claims with active tenant memberships so that
    // firestore.rules can enforce real tenant isolation (resource.data.tenantId
    // in request.auth.token.tenantIds) instead of just "is authenticated", AND
    // per-tenant admin authority (tenantAdminIds) instead of any member being
    // able to rewrite roles/permissions in their own tenant.
    const activeMemberships = memberships.filter((m: any) => m.status === 'active');
    const activeTenantIds = Array.from(new Set(activeMemberships.map((m: any) => m.tenantId).filter(Boolean)));
    // Claims считаются из прав (должность + личные), а не из названия роли.
    const claimsChanged = await syncClaims(db, uid, req.user);

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
    const { email, fullName, tenantName, tenantId, permissions, role, customRoleId } = req.body;
    if (!email) return res.status(400).json({ error: "Missing email" });
    // Организация обязательна. Раньше без неё подставлялась Академия — и
    // приглашение из любой другой компании уходило туда.
    if (!tenantId) return res.status(400).json({ success: false, error: "Не указана организация" });

    const db = admin.firestore();
    const targetTenantId = String(tenantId);
    const targetTenantDoc = await db.collection("tenants").doc(targetTenantId).get();
    if (!targetTenantDoc.exists) return res.status(404).json({ success: false, error: "Организация не найдена" });
    // Название организации — из её документа, а не из тела запроса и не
    // «Академия» по умолчанию: письмо приглашённому должно быть от его компании.
    const orgName = String(targetTenantDoc.data()?.name || tenantName || "Организация").trim();

    // SECURITY: only a tenant admin/owner (or platform superadmin) may invite staff
    // into a tenant. Without this check, any authenticated member of ANY tenant
    // could grant arbitrary permissions (including canManageOrganization) to a
    // brand new membership in a tenant they merely belong to.
    // Приглашать может тот, у кого есть право «Управление сотрудниками»
    // (или суперадмин) — считается из должности и личных прав.
    const isSuperadminDoc = await db.collection("superadmins").doc(req.user.uid).get();
    const callerIsSA = req.user?.isSuperadmin === true || isSuperadminDoc.exists;
    const mine = await callerPermissions(db, req.user.uid, targetTenantId, { ...req.user, isSuperadmin: callerIsSA });
    if (!callerIsSA && !mine.has("team:manage")) {
      return res.status(403).json({
        success: false,
        error: "Нужно право «Управление сотрудниками», чтобы приглашать людей в организацию.",
      });
    }
    // Системные роли (владелец, администратор) этим путём не выдаются.
    if (hasFullAccess(role)) {
      return res.status(400).json({ success: false, error: "Системную роль назначает владелец в разделе «Роли и доступы»" });
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
    //
    // Единая модель доступа: если передана должность (customRoleId), доступ
    // идёт от неё, а личные permissions не проставляются — иначе новичок
    // получал легаси-набор булевых прав в обход должности, и два экрана
    // показывали разное. Название роли берём из документа должности, чтобы в
    // карточке сотрудника сразу читалось «Волонтёр», а не «Работник».
    const resolvedRole = String(role || "Работник").trim().slice(0, 40);
    const membershipId = `mem_${uid}_${targetTenantId}`;
    // Повторное приглашение не должно понижать владельца до «Работника».
    const existingMem = await db.collection("memberships").doc(membershipId).get();
    if (existingMem.exists && hasFullAccess(existingMem.data()?.role) && !callerIsSA) {
      return res.status(403).json({ success: false, error: "Этот сотрудник — владелец или администратор организации" });
    }
    const membershipDoc: Record<string, any> = {
      id: membershipId,
      userId: uid,
      tenantId: targetTenantId,
      displayName: fullName || email.split("@")[0],
      email: email.trim().toLowerCase(),
      status: "active",
      invitedBy: req.user?.uid || "admin",
      joinedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (customRoleId) {
      const roleDoc = await db.collection("custom_roles").doc(String(customRoleId)).get();
      // Должность обязана принадлежать этой же организации — иначе через инвайт
      // можно было бы прицепить чужую роль.
      if (roleDoc.exists && roleDoc.data()?.tenantId === targetTenantId) {
        membershipDoc.customRoleId = customRoleId;
        membershipDoc.role = roleDoc.data()?.name || resolvedRole;
        membershipDoc.permissions = [];
      } else {
        return res.status(400).json({ success: false, error: "Должность не найдена в этой организации" });
      }
    } else {
      membershipDoc.role = resolvedRole;
      // Права выдаём ровно те, что отметили галочками (и только из каталога);
      // без выбора — пусто, а не легаси-набор, который тихо открывал лишнее.
      const wanted = (Array.isArray(permissions) ? permissions : []).filter(isPermissionKey);
      // Нельзя выдать то, чего нет у самого.
      const excess = wanted.filter((p: string) => !mine.has(p as any));
      if (excess.length && !callerIsSA) {
        return res.status(403).json({ success: false, error: `Нельзя выдать права, которых нет у вас: ${excess.join(", ")}` });
      }
      membershipDoc.permissions = wanted;
    }
    await db.collection("memberships").doc(membershipId).set(membershipDoc, { merge: true });

    // Claims приглашённого — из его прав, чтобы правила Firestore применились
    // после первого обновления токена.
    await syncClaims(db, uid);

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
        tenantName: orgName,
        role: membershipDoc.role || resolvedRole,
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
