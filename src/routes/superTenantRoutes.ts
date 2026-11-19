import { Router } from "express";
import admin from "firebase-admin";
import { requireFirebaseAuth } from "./authRoutes.js";
import { requireSuperAdmin, recordAuditLog } from "./superAdminRoutes.js";
import { provisionTenant, ProvisionError } from "../server/provisionTenant.js";

/** Создание организации суперадмином — только сервером, с проверкой субдомена. */
const router = Router();

// POST /api/superadmin/tenants — { name, subdomain, ownerEmail, tierId }
router.post("/tenants", requireFirebaseAuth, requireSuperAdmin, async (req: any, res: any) => {
  const db = admin.firestore();
  try {
    const b = req.body || {};
    const r = await provisionTenant(db, {
      name: b.name, subdomain: b.subdomain, ownerEmail: b.ownerEmail, tierId: b.tierId, phone: b.phone,
      actorUid: req.user.uid,
    });
    await recordAuditLog(db, {
      userId: req.user.uid, userEmail: req.user.email, action: "TENANT_CREATE", target: r.tenantId,
      details: `Создана организация «${String(b.name || "").slice(0, 120)}», владелец ${r.ownerEmail}`, ip: req.ip,
    });
    return res.json({
      success: true, ...r,
      urls: { site: `https://${r.subdomain}.studyfreeforum.com`, workspace: `/workspace/${r.tenantId}` },
    });
  } catch (e: any) {
    if (e instanceof ProvisionError) return res.status(e.status).json({ success: false, error: e.message });
    console.error("[superadmin/tenants] create:", e?.message);
    return res.status(500).json({ success: false, error: "Не удалось создать организацию" });
  }
});

export default router;
