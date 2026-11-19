import admin from "firebase-admin";
import { membersWith } from "./access.js";
import { notifyTelegram } from "./telegram.js";
import { sanitizePrefs, wantsEvent, type NotifyPrefs } from "../shared/notifyEvents.js";
import type { PermissionKey } from "../shared/permissions.js";

/**
 * Доставка уведомлений: колокольчик на сайте и Telegram — с учётом личных
 * настроек (notify_prefs/{tenantId}_{uid}). Ошибки не бросаются: основное
 * действие (тест, анкета, заявка) не должно ломаться из-за уведомления.
 */
const db = () => admin.firestore();
export const PREFS = "notify_prefs";
export const prefsId = (tenantId: string, uid: string) => `${tenantId}_${uid}`.slice(0, 1400);

export async function loadPrefs(tenantId: string, uids: string[]): Promise<Map<string, NotifyPrefs>> {
  const out = new Map<string, NotifyPrefs>();
  const list = [...new Set(uids)].filter(Boolean);
  if (!list.length) return out;
  const snaps = await db().getAll(...list.map(u => db().collection(PREFS).doc(prefsId(tenantId, u))));
  snaps.forEach((s, i) => out.set(list[i], sanitizePrefs(s.data()?.prefs)));
  return out;
}

export interface Delivery {
  tenantId: string;
  /** Ключ действия из NOTIFY_EVENTS. */
  event: string;
  uids: string[];
  title: string;
  body: string;
  url: string;
  /** Id записи в колокольчике для адресата: одна запись на ребёнка/работу — последний шаг. */
  docId: (uid: string) => string;
  type?: string;
  extra?: Record<string, unknown>;
  /** Не писать в Telegram тем, у кого это уведомление уже висит непрочитанным. */
  quietIfUnread?: boolean;
  /** false — Telegram отправит вызывающий сам (со своими кнопками). */
  telegram?: boolean;
}

/** Кому из uids это действие нужно — колокольчик и Telegram. Возвращает тех, кому ушло. */
export async function deliver(d: Delivery): Promise<string[]> {
  try {
    const uids = [...new Set(d.uids)].filter(Boolean);
    if (!uids.length) return [];
    const prefs = await loadPrefs(d.tenantId, uids);
    const to = uids.filter(u => wantsEvent(prefs.get(u), d.event));
    if (!to.length) return [];
    const refs = to.map(u => db().collection("notifications").doc(d.docId(u).slice(0, 1400)));
    const prev = d.quietIfUnread ? await db().getAll(...refs) : [];
    const batch = db().batch();
    refs.forEach((ref, i) => batch.set(ref, {
      tenantId: d.tenantId, userId: to[i], type: d.type || d.event.split(".")[0], event: d.event,
      title: d.title, body: d.body, actionUrl: d.url, read: false, createdAt: admin.firestore.Timestamp.now(), ...(d.extra || {}),
    }));
    await batch.commit();
    const tg = d.quietIfUnread ? to.filter((_, i) => !(prev[i]?.exists && prev[i].data()?.read === false)) : to;
    if (tg.length && d.telegram !== false) await notifyTelegram(tg, d.title, d.body, d.url);
    return to;
  } catch (e) { console.error("[notify]", d.event, e); return []; }
}

/** То же, адресаты — все действующие сотрудники с одним из прав (кроме exclude). */
export async function notifyEvent(d: Omit<Delivery, "uids"> & { perms: PermissionKey[]; exclude?: string[] }): Promise<string[]> {
  try {
    const skip = new Set(d.exclude || []);
    const people = (await membersWith(db(), d.tenantId, d.perms)).map(p => p.uid).filter(u => !skip.has(u));
    return await deliver({ ...d, uids: people });
  } catch (e) { console.error("[notify]", d.event, e); return []; }
}
