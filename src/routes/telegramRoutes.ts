import { Router } from "express";
import admin from "firebase-admin";
import { randomBytes, timingSafeEqual } from "crypto";
import { requireFirebaseAuth } from "./authRoutes.js";
import { sendTelegram, telegramConfig, tgCall } from "../server/telegram.js";
import { revokeAllSessions } from "../server/session.js";
import { timeText } from "../server/loginAlerts.js";

/**
 * /api/telegram — привязка Telegram сотрудника к его аккаунту и вебхук бота.
 *
 * Привязка: сайт выдаёт одноразовый код (15 минут) и ссылку
 * t.me/<бот>?start=<код>; сотрудник жмёт «Старт», бот получает /start <код>
 * и запоминает его чат. Так чужой человек не привяжет свой Telegram к
 * чужому аккаунту: код знает только тот, кто вошёл на сайт.
 */
const router = Router();
const db = () => admin.firestore();
const CODE = /^[A-Za-z0-9_-]{16,64}$/;

router.get("/status", requireFirebaseAuth, async (req: any, res: any) => {
  const cfg = await telegramConfig();
  const link = (await db().collection("user_telegram").doc(req.user.uid).get()).data();
  return res.json({ success: true, configured: !!cfg, linked: !!link?.chatId, username: link?.username || "" });
});

router.post("/link", requireFirebaseAuth, async (req: any, res: any) => {
  const cfg = await telegramConfig();
  if (!cfg) return res.status(503).json({ success: false, error: "Бот Telegram ещё не подключён" });
  const code = randomBytes(18).toString("base64url");
  await db().collection("telegram_codes").doc(code).set({ uid: req.user.uid, name: String(req.user.name || req.user.email || ""), exp: Date.now() + 15 * 60_000 });
  return res.json({ success: true, url: `https://t.me/${cfg.username}?start=${code}` });
});

router.delete("/link", requireFirebaseAuth, async (req: any, res: any) => {
  const ref = db().collection("user_telegram").doc(req.user.uid);
  const chatId = (await ref.get()).data()?.chatId;
  await ref.delete();
  if (chatId) await sendTelegram(chatId, "Уведомления отключены", "Включить снова можно на сайте: профиль → «Подключить Telegram».").catch(() => {});
  return res.json({ success: true });
});

/** Вебхук: Telegram подписывает запросы секретом, заданным при setWebhook. */
router.post("/webhook", async (req: any, res: any) => {
  const cfg = await telegramConfig();
  const got = Buffer.from(String(req.headers["x-telegram-bot-api-secret-token"] || ""));
  const want = Buffer.from(cfg?.webhookSecret || "");
  if (!cfg || !want.length || got.length !== want.length || !timingSafeEqual(got, want)) return res.status(401).end();
  // Сначала дело, потом ответ: на Vercel функцию могут заморозить сразу после ответа.
  try {
    // Кнопки под сообщениями: «Это я» / «Это не я — выйти везде».
    const cq = req.body?.callback_query;
    if (cq) { await onCallback(cq); return; }
    const msg = req.body?.message;
    const chatId = msg?.chat?.id;
    if (!chatId || msg?.chat?.type !== "private") return;
    const text = String(msg.text || "").trim();
    const username = String(msg.from?.username || "");
    if (text.startsWith("/start")) {
      const code = text.split(/\s+/)[1] || "";
      const ref = CODE.test(code) ? db().collection("telegram_codes").doc(code) : null;
      const c = ref ? (await ref.get()).data() : null;
      if (!c || c.exp < Date.now()) {
        await sendTelegram(chatId, "Ссылка устарела", "Откройте сайт: профиль → «Подключить Telegram» — и нажмите на новую ссылку.");
        return;
      }
      await ref!.delete();
      // Один Telegram — один аккаунт: прежняя привязка этого чата снимается.
      const old = await db().collection("user_telegram").where("chatId", "==", chatId).get();
      await Promise.all(old.docs.filter(d => d.id !== c.uid).map(d => d.ref.delete()));
      await db().collection("user_telegram").doc(c.uid).set({ chatId, username, linkedAt: Date.now() });
      await sendTelegram(chatId, "Готово ✅", `${c.name ? `${c.name}, у` : "У"}ведомления с сайта теперь приходят сюда. Отключить: /stop`);
      return;
    }
    if (text === "/stop") {
      const s = await db().collection("user_telegram").where("chatId", "==", chatId).get();
      await Promise.all(s.docs.map(d => d.ref.delete()));
      await sendTelegram(chatId, "Уведомления отключены", "Включить снова: на сайте профиль → «Подключить Telegram».");
      return;
    }
    await sendTelegram(chatId, "Это бот уведомлений", "Подключение — на сайте: профиль → «Подключить Telegram». Отключить: /stop");
  } catch (e) { console.error("[telegram] webhook:", e); }
  finally { if (!res.headersSent) res.json({ ok: true }); }
});

/** Чей это чат: привязка user_telegram. */
async function uidOfChat(chatId: number): Promise<string | null> {
  const s = await db().collection("user_telegram").where("chatId", "==", chatId).limit(1).get();
  return s.empty ? null : s.docs[0].id;
}

async function onCallback(cq: any) {
  const chatId = cq.message?.chat?.id;
  const data = String(cq.data || "");
  const answer = (text: string) => tgCall("answerCallbackQuery", { callback_query_id: cq.id, text });
  const m = data.match(/^lg:(ok|no):(\d{6,12})$/);
  const uid = chatId ? await uidOfChat(chatId) : null;
  if (!m || !uid) { await answer("Кнопка устарела"); return; }
  const ref = db().collection("login_events").doc(`${uid}_${m[2]}`);
  const ev = (await ref.get()).data();
  if (!ev) { await answer("Вход не найден"); return; }
  // Убираем кнопки у сообщения — ответ дан.
  await tgCall("editMessageReplyMarkup", { chat_id: chatId, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } });
  if (m[1] === "ok") {
    await ref.update({ status: "confirmed" });
    await answer("Хорошо, это вы");
    return;
  }
  await revokeAllSessions(uid);
  await ref.update({ status: "denied", deniedAt: Date.now() });
  await db().collection("audit_logs").add({ timestamp: admin.firestore.Timestamp.now(), action: "LOGIN_DENIED_SIGNOUT_ALL", actorUid: uid, ip: ev.ip, device: ev.device, at: ev.at }).catch(() => {});
  await answer("Все сеансы завершены");
  await sendTelegram(chatId, "Все сеансы завершены 🔒", `Вход ${ev.device} · IP ${ev.ip || "—"} · ${timeText(ev.at)} отклонён. На всех устройствах нужно войти заново. Смените пароль: профиль → «Безопасность».`, "/login");
}

export default router;
