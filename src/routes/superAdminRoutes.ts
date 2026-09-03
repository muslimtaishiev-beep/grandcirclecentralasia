import { Router } from "express";
import admin from "firebase-admin";
import { requireFirebaseAuth } from "./authRoutes.js";
import { WORKSPACE_SCREENS, NON_HIDEABLE_SCREENS, normalizeTenantStatus } from "../shared/permissions.js";
import { invalidateTenant } from "../server/tenantAccess.js";

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
      // Субдомен задаёт суперадмин при одобрении; без него — из названия.
      //
      // Раньше id был случайным (org_a7f3k2m9), писалось поле slug, которое
      // никто в коде не читает, и НЕ писался subdomain — а резолвер доменов
      // ищет именно по subdomain. Организация создавалась, но ни её адрес
      // <sub>.studyfreeforum.com, ни директория /org_.../ не работали никогда.
      const rawSub = String(req.body?.subdomain || requestData.organizationName || "")
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/(^-|-$)+/g, "")
        .slice(0, 40);
      if (!rawSub || rawSub.length < 3) {
        return res.status(400).json({
          success: false,
          error: "Субдомен должен быть от 3 символов: латиница, цифры, дефис",
        });
      }
      const RESERVED = new Set(["www", "app", "admin", "api", "mail", "staging", "dev", "studyfreeforum"]);
      if (RESERVED.has(rawSub)) {
        return res.status(400).json({ success: false, error: `Субдомен «${rawSub}» зарезервирован` });
      }

      // Читаемый id из субдомена: /org_oxford_school/placement вместо
      // /org_a7f3k2m9/... — эти адреса печатают на афишах и диктуют по телефону.
      const tenantId = `org_${rawSub.replace(/-/g, "_")}`;

      // Занятость — и по id, и по субдомену: у старых организаций id и
      // subdomain могут не совпадать.
      const [idTaken, subTaken] = await Promise.all([
        db.collection("tenants").doc(tenantId).get(),
        db.collection("tenants").where("subdomain", "==", rawSub).limit(1).get(),
      ]);
      if (idTaken.exists || !subTaken.empty) {
        return res.status(409).json({ success: false, error: `Субдомен «${rawSub}» уже занят` });
      }

      const newTenant = {
        id: tenantId,
        // Формат документа — тот же, что у TenantProvisioningService: два пути
        // создания обязаны давать совместимые организации, иначе у половины
        // тенантов не работают модули и биллинг.
        slug: rawSub,
        subdomain: rawSub,
        name: requestData.organizationName,
        tierId: "starter",
        // Разделы регулируются platformDisabledScreens (суперадмин) и
        // disabledScreens/disabledModules (организация); список enabledModules
        // никто не читает и больше не пишется.
        platformDisabledScreens: [],
        ownerEmail: requestData.contactEmail || "",
        // Новой организации при первом входе владельца показывается быстрая
        // настройка: вид деятельности, терминология, поля расписания.
        // Существующих организаций флаг не касается — у них его просто нет.
        needsWorkspaceSetup: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "active",
        branding: {
          logoUrl: null,
          primaryColor: "#000000",
          loginMessage: null
        },
        settings: {
          maxStudents: 50,
          allowedDomains: [],
          proctoringEnabled: false,
          storageProvider: "firebase_storage",
          gasUrl: null,
          gasApiKey: null
        },
        contacts: {
          // Пустые строки, не undefined: Firestore отказывается писать
          // документ с undefined, а телефон в заявке необязателен.
          email: requestData.contactEmail || "",
          phone: requestData.contactPhone || ""
        }
      };

      await db.collection("tenants").doc(tenantId).set(newTenant);

      // Биллинг-поддокумент: TierLimitEnforcer без него откатывается на
      // дефолты и лимиты считаются неверно (зеркало TenantProvisioningService).
      await db.collection("tenants").doc(tenantId)
        .collection("billing").doc("subscription").set({
          tierId: "starter", status: "active",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      // Аккаунт владельца и письмо-приглашение.
      //
      // Firebase сам писем не шлёт: создание пользователя через Admin SDK —
      // тихая операция, а generatePasswordResetLink только возвращает ссылку.
      // Раньше заявку часто подавали без регистрации, requestedByUserId был
      // пуст, членство записывалось с userId: undefined — и владелец
      // одобренной организации не мог войти вообще: ни аккаунта, ни письма.
      let ownerUid = requestData.requestedByUserId || "";
      let inviteEmailSent = false;
      const ownerEmail = String(requestData.contactEmail || "").trim().toLowerCase();
      if (ownerEmail) {
        try {
          let ownerUser;
          try {
            ownerUser = await admin.auth().getUserByEmail(ownerEmail);
          } catch {
            ownerUser = await admin.auth().createUser({ email: ownerEmail, emailVerified: false });
          }
          ownerUid = ownerUser.uid;

          // Письмо «установите пароль» — через REST sendOobCode: только этот
          // путь реально отправляет почту силами Firebase. Для уже
          // существующего аккаунта это обычный сброс пароля — тоже уместно.
          const apiKey = process.env.VITE_FIREBASE_API_KEY || "AIzaSyBefuNSd2j9CJJ92EWcg0am9s3zBSSHS4Y";
          const oob = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestType: "PASSWORD_RESET", email: ownerEmail }),
          });
          inviteEmailSent = oob.ok;
        } catch (e: any) {
          // Организация важнее письма: если почтовый шаг упал, одобрение всё
          // равно проходит, а суперадмин видит в ответе, что письмо не ушло.
          console.error("[approve] не удалось создать владельца/отправить письмо:", e?.message);
        }
      }

      if (ownerUid) {
        const membershipId = `mem_${ownerUid}_${tenantId}`;
        await db.collection("memberships").doc(membershipId).set({
          id: membershipId,
          userId: ownerUid,
          tenantId: tenantId,
          role: "org:owner",
          status: "active",
          invitedBy: uid,
          joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      await requestRef.update({
        status: "approved",
        reviewedBy: uid,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Record Audit Log
      await recordAuditLog(db, {
        userId: uid,
        userEmail: req.user.email,
        action: "TENANT_APPROVE",
        target: tenantId,
        details: `Approved organization: ${requestData.organizationName}`,
        ip: req.ip
      });

      return res.json({
        success: true, message: "Tenant approved and created", tenantId,
        subdomain: rawSub,
        inviteEmailSent,
        ownerEmail,
        urls: {
          site: `https://${rawSub}.studyfreeforum.com`,
          directory: `/${tenantId}/admission`,
          workspace: `/workspace/${tenantId}`,
        },
      });
    } else {
      await requestRef.update({
        status: "rejected",
        rejectReason: rejectReason || "No reason provided",
        reviewedBy: uid,
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

export default router;
