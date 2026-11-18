import { Router } from "express";
import admin from "firebase-admin";
import { requireFirebaseAuth } from "./authRoutes.js";
import { activeMembership, hasPerm, staffCaller } from "../server/access.js";
import { telegramConfig } from "../server/telegram.js";
import { WATCHERS, newWatchId, sendInvite, watchersOf, type Watcher } from "../server/formWatch.js";

/**
 * /api/form-notify/:t/:formId — кто получает заявки формы в Telegram.
 *
 * Себя подключает тот, кто работает с формами (или её автор), если у него
 * привязан Telegram. Других — только с правом «Уведомления по заявкам»:
 * человеку приходит приглашение, и он сам принимает или отклоняет.
 */
const router = Router();
const db = () => admin.firestore();
const TENANT = /^[A-Za-z0-9_-]{2,80}$/;
const FORM = /^[A-Za-z0-9_-]{2,80}$/;
const fail = (res: any, status: number, error: string) => res.status(status).json({ success: false, error });

async function ctx(req: any, res: any) {
  const { t, formId } = req.params;
  if (!TENANT.test(t) || !FORM.test(formId)) { fail(res, 400, "Неверная форма"); return null; }
  const c = await staffCaller(db(), t, req.user);
  if (!c?.member) { fail(res, 403, "Нет доступа"); return null; }
  const form = (await db().collection("custom_forms").doc(formId).get()).data();
  if (!form || form.tenantId !== t) { fail(res, 404, "Форма не найдена"); return null; }
  const canAssign = hasPerm(c, "forms:notify");
  const canSelf = canAssign || form.createdBy === c.uid || hasPerm(c, "team:manage", "certificates:issue", "crm:manage");
  if (!canSelf) { fail(res, 403, "Нет доступа к уведомлениям этой формы"); return null; }
  return { t, formId, c, form, canAssign };
}

/** Сотрудники организации: имя и есть ли у них Telegram. */
async function staffWithTelegram(t: string) {
  const ms = await db().collection("memberships").where("tenantId", "==", t).where("status", "==", "active").get();
  const people = ms.docs.map(d => d.data()).filter(m => m.userId).map(m => ({ uid: String(m.userId), name: String(m.displayName || m.email || m.userId) }));
  const uniq = [...new Map(people.map(p => [p.uid, p])).values()];
  const tg = uniq.length ? await db().getAll(...uniq.map(p => db().collection("user_telegram").doc(p.uid))) : [];
  const linked = new Set(tg.filter(s => s.data()?.chatId).map(s => s.id));
  return uniq.map(p => ({ ...p, telegram: linked.has(p.uid) })).sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

router.get("/:t/:formId", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const x = await ctx(req, res); if (!x) return;
    const [list, staff, cfg] = await Promise.all([watchersOf(x.formId), staffWithTelegram(x.t), telegramConfig()]);
    const name = new Map(staff.map(s => [s.uid, s.name]));
    const watchers = list.filter(w => w.tenantId === x.t).map(w => ({ uid: w.uid, name: name.get(w.uid) || "Сотрудник", status: w.status, byName: w.byName }));
    return res.json({
      success: true, bot: cfg?.username || "", canAssign: x.canAssign,
      me: { uid: x.c.uid, telegram: staff.find(s => s.uid === x.c.uid)?.telegram || false },
      watchers,
      // Список для выбора — только тем, кто может подключать других.
      staff: x.canAssign ? staff.filter(s => s.telegram && !list.some(w => w.uid === s.uid)) : [],
    });
  } catch (e) { console.error("[form-notify]", e); return fail(res, 500, "Не получилось загрузить"); }
});

router.post("/:t/:formId", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const x = await ctx(req, res); if (!x) return;
    const uid = String(req.body?.uid || x.c.uid);
    const self = uid === x.c.uid;
    if (!self && !x.canAssign) return fail(res, 403, "Подключать других может сотрудник с правом «Уведомления по заявкам»");
    if (!self && !(await activeMembership(db(), uid, x.t))) return fail(res, 404, "Сотрудник не найден");
    const tg = (await db().collection("user_telegram").doc(uid).get()).data();
    if (!tg?.chatId) return fail(res, 400, self ? "Сначала подключите Telegram в профиле" : "У сотрудника не подключён Telegram");
    const existing = (await watchersOf(x.formId)).find(w => w.uid === uid && w.tenantId === x.t);
    if (existing?.status === "active") return res.json({ success: true, status: "active" });
    const w: Watcher = existing || { id: newWatchId(), tenantId: x.t, formId: x.formId, uid, status: self ? "active" : "pending", by: x.c.uid, byName: x.c.name, at: Date.now() };
    if (self) w.status = "active";
    const { id, ...doc } = w;
    await db().collection(WATCHERS).doc(id).set(doc);
    if (!self && !(await sendInvite(w, String(x.form.title || "Форма")))) return fail(res, 400, "Не удалось отправить приглашение в Telegram");
    return res.json({ success: true, status: w.status });
  } catch (e) { console.error("[form-notify]", e); return fail(res, 500, "Не получилось подключить"); }
});

router.delete("/:t/:formId/:uid", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const x = await ctx(req, res); if (!x) return;
    const uid = String(req.params.uid);
    if (uid !== x.c.uid && !x.canAssign) return fail(res, 403, "Отключать других может сотрудник с правом «Уведомления по заявкам»");
    const list = (await watchersOf(x.formId)).filter(w => w.uid === uid && w.tenantId === x.t);
    await Promise.all(list.map(w => db().collection(WATCHERS).doc(w.id).delete()));
    return res.json({ success: true });
  } catch (e) { console.error("[form-notify]", e); return fail(res, 500, "Не получилось отключить"); }
});

export default router;
