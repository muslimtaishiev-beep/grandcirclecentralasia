import admin from "firebase-admin";
import { chatOf, sendTelegram } from "./telegram.js";
import { sendMail } from "./mail.js";

/**
 * Журнал входов и оповещение «Вход в аккаунт» в Telegram.
 *
 * Новый вход — новый auth_time в токене: каждый ввод пароля или вход через
 * Google даёт новый, обновление токена — нет. Под сообщением — «Это я» и
 * «Это не я — выйти везде» (обработка — в вебхуке бота).
 */
const db = () => admin.firestore();

/** «Chrome · Windows», «Safari · iPhone» — из строки браузера. */
export function deviceOf(ua: string): string {
  const s = String(ua || "");
  const os = /iPhone/.test(s) ? "iPhone" : /iPad/.test(s) ? "iPad" : /Android/.test(s) ? "Android"
    : /Windows/.test(s) ? "Windows" : /Mac OS X|Macintosh/.test(s) ? "Mac" : /Linux/.test(s) ? "Linux" : "";
  const br = /Edg\//.test(s) ? "Edge" : /OPR\/|Opera/.test(s) ? "Opera" : /YaBrowser/.test(s) ? "Яндекс Браузер"
    : /Firefox\//.test(s) ? "Firefox" : /Chrome\//.test(s) ? "Chrome" : /Safari\//.test(s) ? "Safari" : "";
  return [br, os].filter(Boolean).join(" · ") || "Неизвестное устройство";
}

export const ipOf = (req: any) => String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim() || String(req.ip || "");
export const timeText = (ms: number) => new Date(ms).toLocaleString("ru-RU", { timeZone: "Asia/Bishkek", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export async function recordLogin(req: any, uid: string, user: { loginAlerts?: boolean }) {
  const authTime = Number(req.user?.auth_time) || 0;
  if (!authTime) return;
  const id = `${uid}_${authTime}`;
  const ref = db().collection("login_events").doc(id);
  if ((await ref.get()).exists) return; // этот вход уже записан — обновление токена или открытие страницы
  const ua = String(req.headers?.["user-agent"] || "").slice(0, 300);
  const ev = { uid, authTime, at: authTime * 1000, ip: ipOf(req).slice(0, 64), ua, device: deviceOf(ua), provider: String(req.user?.firebase?.sign_in_provider || ""), status: "new" };
  await ref.set(ev);
  if (user.loginAlerts === false) return;
  const chat = await chatOf(uid);
  if (!chat) {
    // Нет Telegram — письмо, но только при входе с нового устройства или IP: иначе почта засорится.
    const email = String(req.user?.email || "");
    if (!email) return;
    const prev = (await db().collection("login_events").where("uid", "==", uid).get()).docs.map(d => d.data()).filter(x => x.authTime !== authTime);
    if (prev.some(x => x.device === ev.device && x.ip === ev.ip)) return;
    const esc = (v: string) => v.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
    await sendMail({
      to: email, fromName: "StudyFree", subject: "Вход в ваш аккаунт с нового устройства",
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111"><p>В ваш аккаунт StudyFree вошли:</p><p><b>${esc(ev.device)}</b><br>IP ${esc(ev.ip || "—")} · ${esc(timeText(ev.at))}</p><p>Если это были не вы — откройте сайт, профиль → «Выйти на всех устройствах» и смените пароль.</p></div>`,
    });
    return;
  }
  await sendTelegram(chat, "Вход в аккаунт", `${ev.device}\nIP ${ev.ip || "—"} · ${timeText(ev.at)}`, undefined, [[
    { text: "Это я", data: `lg:ok:${authTime}` },
    { text: "Это не я — выйти везде", data: `lg:no:${authTime}` },
  ]]);
}
