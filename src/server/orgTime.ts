import admin from "firebase-admin";
import { validTimezone } from "../shared/edu.js";

/**
 * Часовой пояс организации — из её настроек (tenants/{t}/edu_settings/directory.timezone,
 * задаётся в «Расписание → Часовой пояс»). Не задан — UTC. Ничего не зашиваем под одну страну.
 */
const cache = new Map<string, { at: number; tz: string }>();
export async function orgTimeZone(tenantId: string): Promise<string> {
  const c = cache.get(tenantId);
  if (c && Date.now() - c.at < 5 * 60_000) return c.tz;
  let tz = "UTC";
  try { tz = validTimezone((await admin.firestore().doc(`tenants/${tenantId}/edu_settings/directory`).get()).data()?.timezone); } catch { /* UTC */ }
  cache.set(tenantId, { at: Date.now(), tz });
  return tz;
}

/** Часовой пояс человека — его первой действующей организации (для писем о входе). */
export async function userTimeZone(uid: string): Promise<string> {
  try {
    const m = await admin.firestore().collection("memberships").where("userId", "==", uid).where("status", "==", "active").limit(1).get();
    const t = m.docs[0]?.data()?.tenantId;
    return t ? orgTimeZone(String(t)) : "UTC";
  } catch { return "UTC"; }
}

export const fmtIn = (tz: string, ms: number, o: Intl.DateTimeFormatOptions) => new Date(ms).toLocaleString("ru-RU", { ...o, timeZone: validTimezone(tz) });
