import { Router } from "express";
import admin from "firebase-admin";
import { requireFirebaseAuth } from "./authRoutes.js";
import { revokeAllSessions } from "../server/session.js";
import { telegramConfig } from "../server/telegram.js";

/**
 * /api/profile — профиль сотрудника: имя, телефон, оповещения о входе,
 * журнал последних входов, «выйти на всех устройствах».
 */
const router = Router();
const db = () => admin.firestore();
const str = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

router.get("/", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const uid = req.user.uid;
    const [u, tg, ev, cfg] = await Promise.all([
      db().collection("users").doc(uid).get(),
      db().collection("user_telegram").doc(uid).get(),
      db().collection("login_events").where("uid", "==", uid).get(),
      telegramConfig(),
    ]);
    const d = u.data() || {};
    const current = Number(req.user.auth_time) || 0;
    const logins = ev.docs.map(x => x.data())
      .sort((a: any, b: any) => b.at - a.at).slice(0, 10)
      .map((x: any) => ({ at: x.at, device: x.device, ip: x.ip, status: x.status, current: x.authTime === current }));
    return res.json({
      success: true,
      profile: {
        email: req.user.email || d.email || "", displayName: d.displayName || "", phone: d.phone || "",
        avatarUrl: d.avatarUrl || null, loginAlerts: d.loginAlerts !== false,
        provider: String(req.user.firebase?.sign_in_provider || ""),
      },
      telegram: { configured: !!cfg, bot: cfg?.username || "", linked: !!tg.data()?.chatId, username: tg.data()?.username || "" },
      logins,
    });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

router.put("/", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const patch: Record<string, unknown> = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (req.body?.displayName !== undefined) {
      const n = str(req.body.displayName, 80);
      if (n.length < 2) return res.status(400).json({ success: false, error: "Укажите имя" });
      patch.displayName = n;
    }
    if (req.body?.phone !== undefined) patch.phone = str(req.body.phone, 30);
    if (typeof req.body?.loginAlerts === "boolean") patch.loginAlerts = req.body.loginAlerts;
    await db().collection("users").doc(req.user.uid).set(patch, { merge: true });
    // Имя видят коллеги — обновляем его и в членствах (там его читают списки сотрудников).
    if (patch.displayName) {
      const ms = await db().collection("memberships").where("userId", "==", req.user.uid).get();
      await Promise.all(ms.docs.map(m => m.ref.update({ displayName: patch.displayName })));
    }
    return res.json({ success: true });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

/** Завершить все сеансы, в том числе этот: везде придётся войти заново. */
router.post("/signout-all", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    await revokeAllSessions(req.user.uid);
    await db().collection("audit_logs").add({ timestamp: admin.firestore.Timestamp.now(), action: "SIGNOUT_ALL", actorUid: req.user.uid, actorEmail: req.user.email || "" }).catch(() => {});
    return res.json({ success: true });
  } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
});

export default router;
