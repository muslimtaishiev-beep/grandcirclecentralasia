import { Router } from "express";
import admin from "firebase-admin";
import { requireFirebaseAuth } from "./authRoutes.js";
import { WORKSPACE_SCREENS, NON_HIDEABLE_SCREENS, normalizeTenantStatus } from "../shared/permissions.js";
import { invalidateTenant } from "../server/tenantAccess.js";
import { provisionTenant, ProvisionError } from "../server/provisionTenant.js";
import { syncClaims } from "../server/claims.js";
import { forgetAccount } from "../server/session.js";

const router = Router();

// Helper to record audit log events in Firestore /audit_logs
export const recordAuditLog = async (db: FirebaseFirestore.Firestore, data: {
  userId: string;
  userEmail?: string;
  action: string;
  target?: string;
  details?: string;
  ip?: string;
}) => {
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await db.collection("audit_logs").doc(logId).set({
      id: logId,
      userId: data.userId,
      userEmail: data.userEmail || "system",
      action: data.action,
      target: data.target || "system",
      details: data.details || "",
      ip: data.ip || "127.0.0.1",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("[AuditLog] Failed to record audit log:", err);
  }
};

// Middleware to check if user is a SuperAdmin
export const requireSuperAdmin = async (req: any, res: any, next: any) => {
  try {
    const uid = req.user.uid;
    const db = admin.firestore();

    // Суперадминство живёт ТОЛЬКО в claim isSuperadmin и коллекции superadmins.
    // Поле users.globalRole больше не учитывается: документ users/{uid} пишет
    // сам пользователь, и любой мог записать себе "superadmin".
    if (req.user?.isSuperadmin === true) return next();
    const saDoc = await db.collection("superadmins").doc(uid).get();
    if (saDoc.exists) return next();
    return res.status(403).json({ error: "Access denied. Requires superadmin role." });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// GET /api/superadmin/audit-logs - List system audit logs
router.get("/audit-logs", requireFirebaseAuth, requireSuperAdmin, async (req: any, res: any) => {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection("audit_logs").orderBy("timestamp", "desc").limit(100).get();
    
    const logs = snapshot.docs.map(doc => doc.data());
    return res.json({ success: true, logs });
  } catch (error: any) {
    console.error("[SuperAdmin/AuditLogs] Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/superadmin/stats - System-wide SaaS Metrics
router.get("/stats", requireFirebaseAuth, requireSuperAdmin, async (req: any, res: any) => {
  try {
    const db = admin.firestore();

    const [tenantsSnap, usersSnap, requestsSnap, auditSnap] = await Promise.all([
      db.collection("tenants").get(),
      db.collection("users").get(),
      db.collection("tenant_invites").where("status", "==", "pending").get(),
      db.collection("audit_logs").limit(5).get()
    ]);

    return res.json({
      success: true,
      stats: {
        totalTenants: tenantsSnap.size,
        totalUsers: usersSnap.size,
        pendingRequests: requestsSnap.size,
        recentLogsCount: auditSnap.size
      }
    });
  } catch (error: any) {
    console.error("[SuperAdmin/Stats] Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/superadmin/tenant-requests - List all tenant requests
router.get("/tenant-requests", requireFirebaseAuth, requireSuperAdmin, async (req: any, res: any) => {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection("tenant_invites").orderBy("requestedAt", "desc").get();
    
    const requests = snapshot.docs.map(doc => doc.data());
    return res.json({ success: true, requests });
  } catch (error: any) {
    console.error("[SuperAdmin/TenantRequests] Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/superadmin/tenant-requests/:id - Approve or reject a request
router.post("/tenant-requests/:id", requireFirebaseAuth, requireSuperAdmin, async (req: any, res: any) => {
  try {
    const { action, rejectReason } = req.body;
    const requestId = req.params.id;
    const uid = req.user.uid;
    const db = admin.firestore();

    if (action !== "approve" && action !== "reject") {
      return res.status(400).json({ success: false, error: "Invalid action" });
    }

    const requestRef = db.collection("tenant_invites").doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return res.status(404).json({ success: false, error: "Request not found" });
    }

    const requestData = requestDoc.data();
    if (requestData?.status !== "pending") {
      return res.status(400).json({ success: false, error: "Request is already processed" });
    }

    if (action === "approve") {
      // Создание — общий provisionTenant(): не затирает существующую организацию,
      // пишет членство владельца с userId и воронку CRM по умолчанию.
      let r;
      try {
        r = await provisionTenant(db, {
          name: requestData.organizationName,
          subdomain: String(req.body?.subdomain || requestData.organizationName || ""),
          ownerEmail: String(req.body?.ownerEmail || requestData.contactEmail || ""),
          phone: requestData.contactPhone || "",
          actorUid: uid,
        });
      } catch (e: any) {
        if (e instanceof ProvisionError) return res.status(e.status).json({ success: false, error: e.message });
        throw e;
      }

      // Итог остаётся в заявке: после перезагрузки суперадмин его видит.
      const outcome = {
        tenantId: r.tenantId, subdomain: r.subdomain, ownerEmail: r.ownerEmail, inviteEmailSent: r.inviteEmailSent,
      };
      await requestRef.update({
        status: "approved",
        reviewedBy: uid,
        reviewedByEmail: req.user.email || "",
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        tenantId: r.tenantId,
        outcome,
      });

      await recordAuditLog(db, {
        userId: uid,
        userEmail: req.user.email,
        action: "TENANT_APPROVE",
        target: r.tenantId,
        details: `Approved organization: ${requestData.organizationName}`,
        ip: req.ip
      });

      return res.json({
        success: true, message: "Tenant approved and created",
        ...outcome,
        ...(r.inviteLink ? { inviteLink: r.inviteLink } : {}),
        urls: {
          site: `https://${r.subdomain}.studyfreeforum.com`,
          directory: `/${r.tenantId}/admission`,
          workspace: `/workspace/${r.tenantId}`,
        },
      });
    } else {
      await requestRef.update({
        status: "rejected",
        rejectReason: String(rejectReason || "Причина не указана").slice(0, 500),
        reviewedBy: uid,
        reviewedByEmail: req.user.email || "",
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Record Audit Log
      await recordAuditLog(db, {
        userId: uid,
        userEmail: req.user.email,
        action: "TENANT_REJECT",
        target: requestId,
        details: `Rejected organization: ${requestData.organizationName}. Reason: ${rejectReason}`,
        ip: req.ip
      });

      return res.json({ success: true, message: "Tenant request rejected" });
    }
  } catch (error: any) {
    console.error("[SuperAdmin/TenantRequests] Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────── Что платформа закрыла организации ───────────────────

const tenantRef = (id: string) => admin.firestore().collection("tenants").doc(String(id));

/**
 * PUT /api/superadmin/tenants/:id/platform-screens — разделы, закрытые
 * платформой. Организация их не видит нигде и включить не может — в отличие
 * от disabledScreens, которые она скрывает у себя сама.
 */
router.put("/tenants/:id/platform-screens", requireFirebaseAuth, requireSuperAdmin, async (req: any, res: any) => {
  try {
    const known = new Set(WORKSPACE_SCREENS.map(sx => sx.key));
    const disabled = (Array.isArray(req.body?.platformDisabledScreens) ? req.body.platformDisabledScreens : [])
      .map(String).filter((k: string) => known.has(k) && !NON_HIDEABLE_SCREENS.has(k));
    const ref = tenantRef(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ success: false, error: "Организация не найдена" });
    await ref.update({ platformDisabledScreens: disabled, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    invalidateTenant(req.params.id);
    await recordAuditLog(admin.firestore(), {
      userId: req.user.uid, userEmail: req.user.email, action: "TENANT_PLATFORM_SCREENS",
      target: req.params.id, details: disabled.length ? `Закрыто платформой: ${disabled.join(", ")}` : "Все разделы открыты", ip: req.ip,
    });
    return res.json({ success: true, platformDisabledScreens: disabled });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/superadmin/tenants/:id/status — приостановить или вернуть организацию. */
router.post("/tenants/:id/status", requireFirebaseAuth, requireSuperAdmin, async (req: any, res: any) => {
  try {
    const status = normalizeTenantStatus(req.body?.status);
    const reason = String(req.body?.reason || "").trim().slice(0, 300);
    const ref = tenantRef(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ success: false, error: "Организация не найдена" });
    await ref.update({
      status,
      suspendedAt: status === "suspended" ? admin.firestore.FieldValue.serverTimestamp() : admin.firestore.FieldValue.delete(),
      suspendReason: status === "suspended" ? reason : admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    invalidateTenant(req.params.id);
    await recordAuditLog(admin.firestore(), {
      userId: req.user.uid, userEmail: req.user.email,
      action: status === "suspended" ? "TENANT_SUSPEND" : "TENANT_RESUME",
      target: req.params.id, details: reason || (status === "suspended" ? "Организация приостановлена" : "Организация возобновлена"), ip: req.ip,
    });
    return res.json({ success: true, status });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** PUT /api/superadmin/tenants/:id/proctoring — главный тумблер и детекторы. */
router.put("/tenants/:id/proctoring", requireFirebaseAuth, requireSuperAdmin, async (req: any, res: any) => {
  try {
    const patch: Record<string, any> = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (typeof req.body?.proctoringEnabled === "boolean") patch.proctoringEnabled = req.body.proctoringEnabled;
    if (req.body?.proctoringFlags && typeof req.body.proctoringFlags === "object") {
      const flags: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(req.body.proctoringFlags)) if (/^[a-zA-Z]+$/.test(k)) flags[k] = Boolean(v);
      patch.proctoringFlags = flags;
    }
    const ref = tenantRef(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ success: false, error: "Организация не найдена" });
    await ref.update(patch);
    invalidateTenant(req.params.id);
    await recordAuditLog(admin.firestore(), {
      userId: req.user.uid, userEmail: req.user.email, action: "TENANT_PROCTORING",
      target: req.params.id, details: JSON.stringify({ proctoringEnabled: patch.proctoringEnabled, proctoringFlags: patch.proctoringFlags }), ip: req.ip,
    });
    return res.json({ success: true, proctoringEnabled: patch.proctoringEnabled, proctoringFlags: patch.proctoringFlags });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────── Режим техработ ───────────────────

const MAINT_DEFAULT = { enabled: false, message: "Идут плановые технические работы. Доступ будет восстановлен в ближайшее время.", estimatedTime: "30 минут" };
let maintCache: { at: number; v: any } | null = null;

/** Режим техработ хранится в Firestore (system/maintenance): виден всем экземплярам сервера. */
export async function readMaintenance(): Promise<any> {
  if (maintCache && Date.now() - maintCache.at < 10_000) return maintCache.v;
  let v: any = { ...MAINT_DEFAULT, updatedAt: null };
  try {
    const d = await admin.firestore().collection("system").doc("maintenance").get();
    if (d.exists) v = { ...MAINT_DEFAULT, ...d.data() };
  } catch (e: any) { console.error("[maintenance] read:", e?.message); }
  maintCache = { at: Date.now(), v };
  return v;
}

export async function writeMaintenance(b: any, uid: string): Promise<any> {
  const v = {
    enabled: b?.enabled === true,
    message: String(b?.message || MAINT_DEFAULT.message).slice(0, 500),
    estimatedTime: String(b?.estimatedTime || MAINT_DEFAULT.estimatedTime).slice(0, 60),
    updatedAt: new Date().toISOString(),
    updatedBy: uid,
  };
  await admin.firestore().collection("system").doc("maintenance").set(v);
  maintCache = { at: Date.now(), v };
  return v;
}

// GET /api/superadmin/maintenance — открыто: страницу техработ видят все
router.get("/maintenance", async (_req: any, res: any) => {
  const { updatedBy, ...pub } = await readMaintenance();
  res.set("Cache-Control", "no-store");
  return res.json(pub);
});

// PUT /api/superadmin/maintenance — { enabled, message, estimatedTime }
router.put("/maintenance", requireFirebaseAuth, requireSuperAdmin, async (req: any, res: any) => {
  try {
    const v = await writeMaintenance(req.body, req.user.uid);
    await recordAuditLog(admin.firestore(), {
      userId: req.user.uid, userEmail: req.user.email, action: v.enabled ? "MAINTENANCE_ON" : "MAINTENANCE_OFF",
      target: "system", details: v.message, ip: req.ip,
    });
    return res.json({ success: true, maintenance: v });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: "Не удалось сохранить режим техработ" });
  }
});

// ─────────────────── Администраторы платформы ───────────────────

// GET /api/superadmin/admins
router.get("/admins", requireFirebaseAuth, requireSuperAdmin, async (req: any, res: any) => {
  try {
    const snap = await admin.firestore().collection("superadmins").get();
    const admins = await Promise.all(snap.docs.map(async d => {
      let email = String(d.data()?.email || ""), name = "";
      try { const u = await admin.auth().getUser(d.id); email = u.email || email; name = u.displayName || ""; } catch { /* аккаунта нет */ }
      return { uid: d.id, email, name, self: d.id === req.user.uid };
    }));
    return res.json({ success: true, admins });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: "Не удалось загрузить список" });
  }
});

// DELETE /api/superadmin/admins/:uid — снять права суперадмина (себя — нельзя)
router.delete("/admins/:uid", requireFirebaseAuth, requireSuperAdmin, async (req: any, res: any) => {
  try {
    const target = String(req.params.uid);
    if (target === req.user.uid) return res.status(400).json({ success: false, error: "Нельзя снять права с самого себя" });
    const db = admin.firestore();
    const ref = db.collection("superadmins").doc(target);
    if (!(await ref.get()).exists) return res.status(404).json({ success: false, error: "Не суперадмин" });
    await ref.delete();
    forgetAccount(target);
    try { await syncClaims(db, target); } catch (e: any) { console.error("[admins] claims:", e?.message); }
    await recordAuditLog(db, {
      userId: req.user.uid, userEmail: req.user.email, action: "SUPERADMIN_REVOKE", target, details: "Снят суперадмин", ip: req.ip,
    });
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: "Не удалось снять права" });
  }
});

export default router;
