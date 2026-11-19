import admin from "firebase-admin";
import { deliver } from "./notify.js";
import { randomBytes } from "crypto";
import { activeMembership } from "./access.js";
import { chatOf, sendTelegram, tgCall } from "./telegram.js";

/**
 * Уведомления о новых заявках формы в Telegram.
 *
 * form_watchers/{id}: { tenantId, formId, uid, status: "pending" | "active",
 * by, byName, at }. Пишет только сервер. Себя сотрудник подключает сразу;
 * другого — только с правом «Уведомления по заявкам», и тот подтверждает
 * в Telegram кнопками «Принять» / «Отклонить».
 */
const db = () => admin.firestore();
export const WATCHERS = "form_watchers";
export const newWatchId = () => `fw_${randomBytes(8).toString("base64url")}`;

export interface Watcher { id: string; tenantId: string; formId: string; uid: string; status: "pending" | "active"; by: string; byName: string; at: number; formTitle?: string }

export async function watchersOf(formId: string): Promise<Watcher[]> {
  const s = await db().collection(WATCHERS).where("formId", "==", formId).get();
  return s.docs.map(d => ({ ...(d.data() as Watcher), id: d.id }));
}

/** Приглашение в Telegram: «X подключает вас к уведомлениям формы» — принять или отклонить. */
export async function sendInvite(w: Watcher, formTitle: string): Promise<boolean> {
  const chat = await chatOf(w.uid);
  if (!chat) return false;
  await sendTelegram(chat, "Уведомления по заявкам",
    `${w.byName || "Администратор"} хочет присылать вам уведомления о новых заявках формы «${formTitle}». Принять?`,
    undefined, [[{ text: "✅ Принять", data: `fw:ok:${w.id}` }, { text: "Отклонить", data: `fw:no:${w.id}` }]]);
  return true;
}

/** Новая заявка — тем, кто подписан и всё ещё работает в организации: колокольчик и Telegram (если подключён). */
export async function notifyFormWatchers(form: { tenantId?: string; title?: string }, formId: string, sub: { name: string; contact: string }, subId = "") {
  try {
    const t = String(form.tenantId || "");
    const list = (await watchersOf(formId)).filter(w => w.status === "active" && w.tenantId === t);
    const active: Watcher[] = [];
    for (const w of list) if (await activeMembership(db(), w.uid, t)) active.push(w);
    if (!active.length) return;
    const title = `📝 Новая заявка · ${form.title || "Форма"}`;
    const body = [sub.name || "Без имени", sub.contact].filter(Boolean).join(" · ");
    const url = `/workspace/${t}/builder/forms?form=${encodeURIComponent(formId)}${subId ? `&sub=${encodeURIComponent(subId)}` : ""}`;
    const to = new Set(await deliver({
      tenantId: t, event: "form.submission", uids: active.map(w => w.uid), title, body, url, type: "form", telegram: false,
      docId: u => `form_${subId || formId}_${u}`, extra: { formId },
    }));
    // Telegram — со своей кнопкой «Отключить уведомления» этой формы.
    for (const w of active) {
      if (!to.has(w.uid)) continue;
      const chat = await chatOf(w.uid);
      if (!chat) continue;
      await sendTelegram(chat, title, body, url, [[{ text: "Отключить уведомления", data: `fw:off:${w.id}` }]]).catch(() => {});
    }
  } catch (e) { console.error("[form-watch] notify:", e); }
}

/**
 * Кнопки в Telegram: fw:ok / fw:no — ответ на приглашение, fw:off — отписка.
 * Нажать может только тот, кого подключают (его чат). true — кнопка наша.
 */
export async function onWatchCallback(data: string, uid: string | null, cq: any): Promise<boolean> {
  const m = data.match(/^fw:(ok|no|off):(fw_[A-Za-z0-9_-]{6,20})$/);
  if (!m) return false;
  const answer = (text: string) => tgCall("answerCallbackQuery", { callback_query_id: cq.id, text });
  const chatId = cq.message?.chat?.id;
  const ref = db().collection(WATCHERS).doc(m[2]);
  const w = (await ref.get()).data() as Watcher | undefined;
  if (!w || !uid || w.uid !== uid) { await answer("Кнопка устарела"); return true; }
  await tgCall("editMessageReplyMarkup", { chat_id: chatId, message_id: cq.message?.message_id, reply_markup: { inline_keyboard: [] } });
  const title = String((await db().collection("custom_forms").doc(w.formId).get()).data()?.title || "форма");
  const inviter = w.by && w.by !== uid ? await chatOf(w.by) : null;
  if (m[1] === "ok") {
    if (w.status !== "pending") { await answer("Уже подключено"); return true; }
    await ref.update({ status: "active", acceptedAt: Date.now() });
    await answer("Подключено");
    await sendTelegram(chatId, "Подключено ✅", `Новые заявки формы «${title}» будут приходить сюда.`);
    if (inviter) await sendTelegram(inviter, "Приглашение принято", `Уведомления формы «${title}» подключены.`).catch(() => {});
    return true;
  }
  await ref.delete();
  if (m[1] === "no") {
    await answer("Отклонено");
    if (inviter) await sendTelegram(inviter, "Приглашение отклонено", `Сотрудник не стал подключать уведомления формы «${title}».`).catch(() => {});
  } else {
    await answer("Уведомления отключены");
    await sendTelegram(chatId, "Отключено", `Заявки формы «${title}» больше не приходят.`);
  }
  return true;
}
