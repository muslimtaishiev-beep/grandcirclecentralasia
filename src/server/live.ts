import admin from "firebase-admin";
import type { LiveTopic } from "../shared/live.js";

/**
 * Лента изменений организации: live/{tenantId} = { admissions: {at, id}, exams: {at, id} }.
 * Открытые страницы слушают этот один документ и сами перезапрашивают
 * свои данные, когда меняется нужная тема. Внутри — только время и id
 * изменённой записи, никаких данных.
 */
const db = () => admin.firestore();
const TENANT = /^[A-Za-z0-9_-]{2,64}$/;
const ID = /^[A-Za-z0-9_-]{1,128}$/;

export async function bumpLive(tenantId: string, topics: LiveTopic[], id = ""): Promise<void> {
  if (!TENANT.test(String(tenantId || "")) || !topics.length) return;
  const at = Date.now();
  const mark = { at, id: ID.test(id) ? id : "" };
  try {
    await db().collection("live").doc(tenantId).set(Object.fromEntries(topics.map(t => [t, mark])), { merge: true });
  } catch (e) { console.error("[live] bump:", e); }
}

/**
 * Для роутеров с путями /:tenantId/…: после успешного изменения (не GET)
 * отметить тему. Отметка пишется до ответа — на Vercel работа после ответа
 * может не выполниться.
 */
export function liveOnWrite(topics: LiveTopic[], idFrom?: RegExp) {
  return (req: any, res: any, next: any) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
    const t = String(req.params?.tenantId || "");
    const send = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 400) return send(body);
      const id = idFrom ? (String(req.path || "").match(idFrom)?.[1] || "") : "";
      void bumpLive(t, topics, id).finally(() => send(body));
      return res;
    };
    next();
  };
}
