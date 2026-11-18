import admin from "firebase-admin";

/**
 * Уведомления сотрудникам в Telegram — дублируют колокольчик на сайте.
 *
 * Бот и его токен — в platform_config/telegram (только сервер; правила
 * Firestore эту коллекцию не открывают). Привязка сотрудника — в
 * user_telegram/{uid}: chatId, к которому бот пишет. Нет токена или
 * привязки — ничего не отправляется, сайт работает как раньше.
 */
const db = () => admin.firestore();

export interface TelegramConfig { token: string; username: string; webhookSecret: string; appUrl: string }
let cache: { at: number; cfg: TelegramConfig | null } | null = null;

export async function telegramConfig(): Promise<TelegramConfig | null> {
  if (cache && Date.now() - cache.at < 60_000) return cache.cfg;
  const d = (await db().collection("platform_config").doc("telegram").get().catch(() => null))?.data();
  const cfg = d?.token && d?.username ? {
    token: String(d.token), username: String(d.username), webhookSecret: String(d.webhookSecret || ""),
    appUrl: String(d.appUrl || "https://www.studyfreeforum.com").replace(/\/+$/, ""),
  } : null;
  cache = { at: Date.now(), cfg };
  return cfg;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function tgCall(method: string, body: Record<string, unknown>): Promise<any> {
  const cfg = await telegramConfig();
  if (!cfg) return null;
  const r = await fetch(`https://api.telegram.org/bot${cfg.token}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return r.json().catch(() => null);
}

/** Сообщение в чат: заголовок жирным, текст и кнопка «Открыть» (ссылка на сайт). */
export async function sendTelegram(chatId: number | string, title: string, body: string, path?: string) {
  const cfg = await telegramConfig();
  if (!cfg) return;
  const url = path ? (/^https?:\/\//.test(path) ? path : `${cfg.appUrl}${path.startsWith("/") ? "" : "/"}${path}`) : null;
  const j = await tgCall("sendMessage", {
    chat_id: chatId,
    text: `<b>${esc(title)}</b>${body ? `\n${esc(body)}` : ""}`,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(url ? { reply_markup: { inline_keyboard: [[{ text: "Открыть", url }]] } } : {}),
  });
  // Бота заблокировали или удалили чат — привязка больше не работает.
  if (j && j.ok === false && (j.error_code === 403 || /chat not found/i.test(String(j.description)))) {
    const s = await db().collection("user_telegram").where("chatId", "==", chatId).get();
    await Promise.all(s.docs.map(d => d.ref.delete()));
  }
}

/** Тем из uids, кто привязал Telegram, — то же, что пришло в колокольчик. Ошибки не ломают основное действие. */
export async function notifyTelegram(uids: string[], title: string, body: string, path?: string) {
  try {
    if (!uids.length || !(await telegramConfig())) return;
    const refs = [...new Set(uids)].map(u => db().collection("user_telegram").doc(u));
    const snaps = await db().getAll(...refs);
    await Promise.all(snaps.filter(s => s.exists && s.data()?.chatId).map(s => sendTelegram(s.data()!.chatId, title, body, path).catch(() => {})));
  } catch (e) { console.error("[telegram] notify:", e); }
}
