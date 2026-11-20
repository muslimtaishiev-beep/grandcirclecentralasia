import { Router } from "express";
import admin from "firebase-admin";
import { requireFirebaseAuth } from "./authRoutes.js";
import { hasPerm, staffCaller, type StaffCaller } from "../server/access.js";
import { deliver, PREFS, prefsId } from "../server/notify.js";
import { NOTIFY_EVENTS, NOTIFY_SECTIONS, sanitizePrefs, wantsEvent } from "../shared/notifyEvents.js";

/**
 * /api/notify/:t — личные настройки уведомлений сотрудника в организации.
 * GET /prefs — какие действия ему доступны (по правам) и что включено;
 * PUT /prefs — сохранить; POST /test — проверочное уведомление себе.
 */
const router = Router();
const db = () => admin.firestore();
const TENANT = /^[A-Za-z0-9_-]{2,80}$/;
const fail = (res: any, status: number, error: string) => res.status(status).json({ success: false, error });

async function me(req: any, res: any): Promise<{ t: string; c: StaffCaller } | null> {
  const t = String(req.params.t || "");
  if (!TENANT.test(t)) { fail(res, 400, "Неверная организация"); return null; }
  const c = await staffCaller(db(), t, req.user);
  if (!c?.member) { fail(res, 403, "Нет доступа"); return null; }
  return { t, c };
}

/** Действия, которые этому сотруднику вообще могут приходить. */
const available = (c: StaffCaller) => NOTIFY_EVENTS.filter(e => e.live !== false && (!e.for.length || hasPerm(c, ...e.for)));

router.get("/:t/prefs", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const x = await me(req, res); if (!x) return;
    const [p, tg] = await Promise.all([
      db().collection(PREFS).doc(prefsId(x.t, x.c.uid)).get(),
      db().collection("user_telegram").doc(x.c.uid).get(),
    ]);
    const prefs = sanitizePrefs(p.data()?.prefs);
    const events = available(x.c);
    return res.json({
      success: true,
      sections: NOTIFY_SECTIONS.filter(s => events.some(e => e.section === s.id)),
      events: events.map(e => ({ key: e.key, section: e.section, label: e.label, on: wantsEvent(prefs, e.key) })),
      telegram: !!tg.data()?.chatId,
    });
  } catch (e) { console.error("[notify] prefs:", e); return fail(res, 500, "Не удалось загрузить настройки"); }
});

router.put("/:t/prefs", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const x = await me(req, res); if (!x) return;
    const keys = new Set(available(x.c).map(e => e.key));
    const raw = sanitizePrefs(req.body?.prefs);
    // Храним только отличия от умолчаний и только доступные этому сотруднику действия.
    const prefs = Object.fromEntries(Object.entries(raw).filter(([k, v]) => keys.has(k) && v !== wantsEvent(null, k)));
    await db().collection(PREFS).doc(prefsId(x.t, x.c.uid)).set({ tenantId: x.t, uid: x.c.uid, prefs, updatedAt: Date.now() });
    return res.json({ success: true });
  } catch (e) { console.error("[notify] save prefs:", e); return fail(res, 500, "Не удалось сохранить"); }
});

const lastTest = new Map<string, number>();
router.post("/:t/test", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const x = await me(req, res); if (!x) return;
    const key = `${x.t}:${x.c.uid}`;
    if (Date.now() - (lastTest.get(key) || 0) < 15_000) return fail(res, 429, "Подождите несколько секунд");
    lastTest.set(key, Date.now());
    const to = await deliver({
      tenantId: x.t, event: "system.test", uids: [x.c.uid], type: "system",
      title: "Проверка уведомлений", body: `Всё работает · ${new Date().toLocaleTimeString("ru-RU", { timeZone: "Asia/Bishkek", hour: "2-digit", minute: "2-digit", second: "2-digit" })}`,
      url: `/workspace/${x.t}/profile`, docId: u => `test_${u}`,
    });
    const tg = (await db().collection("user_telegram").doc(x.c.uid).get()).data()?.chatId;
    return res.json({ success: true, site: to.length > 0, telegram: !!tg });
  } catch (e) { console.error("[notify] test:", e); return fail(res, 500, "Не удалось отправить"); }
});

export default router;
