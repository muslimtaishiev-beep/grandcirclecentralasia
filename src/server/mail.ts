import admin from "firebase-admin";

/**
 * Письма платформы — через Microsoft 365 (Graph API) с общего ящика
 * организации-оператора (no-reply@flacademy.edu.kg). Ключи приложения —
 * в platform_config/mail_m365 (только сервер). Приложению в Exchange
 * разрешено слать только с этого ящика (ApplicationAccessPolicy).
 */
interface MailConfig { tenantId: string; clientId: string; clientSecret: string; sender: string }
let cfgCache: { at: number; cfg: MailConfig | null } | null = null;
let tokenCache: { token: string; exp: number } | null = null;

async function mailConfig(): Promise<MailConfig | null> {
  if (cfgCache && Date.now() - cfgCache.at < 60_000) return cfgCache.cfg;
  const d = (await admin.firestore().collection("platform_config").doc("mail_m365").get().catch(() => null))?.data();
  const cfg = d?.tenantId && d?.clientId && d?.clientSecret && d?.sender ? { tenantId: d.tenantId, clientId: d.clientId, clientSecret: d.clientSecret, sender: d.sender } : null;
  cfgCache = { at: Date.now(), cfg };
  return cfg;
}

async function graphToken(c: MailConfig): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.exp - 60_000) return tokenCache.token;
  const r = await fetch(`https://login.microsoftonline.com/${c.tenantId}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error(`Microsoft 365: ${j.error_description?.split("\n")[0] || j.error || "нет токена"}`);
  tokenCache = { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return j.access_token;
}

export interface MailMessage { to: string | string[]; subject: string; html: string; fromName?: string; replyTo?: string }

/** Отправить письмо. Не настроено или ошибка — { sent: false, reason }, без исключения. */
export async function sendMail(m: MailMessage): Promise<{ sent: boolean; reason?: string }> {
  try {
    const c = await mailConfig();
    if (!c) return { sent: false, reason: "Почта Microsoft 365 не настроена" };
    const to = (Array.isArray(m.to) ? m.to : [m.to]).map(s => String(s).trim()).filter(s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)).slice(0, 50);
    if (!to.length) return { sent: false, reason: "Нет адреса получателя" };
    const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(c.sender)}/sendMail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await graphToken(c)}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: String(m.subject).slice(0, 250),
          body: { contentType: "HTML", content: m.html },
          from: { emailAddress: { address: c.sender, ...(m.fromName ? { name: String(m.fromName).slice(0, 120) } : {}) } },
          toRecipients: to.map(address => ({ emailAddress: { address } })),
          ...(m.replyTo && /@/.test(m.replyTo) ? { replyTo: [{ emailAddress: { address: m.replyTo } }] } : {}),
        },
        saveToSentItems: false,
      }),
    });
    if (r.status === 202) return { sent: true };
    if (r.status === 401) tokenCache = null;
    const e: any = await r.json().catch(() => ({}));
    return { sent: false, reason: `Microsoft 365: ${e.error?.message || r.status}` };
  } catch (e: any) { return { sent: false, reason: e?.message || "Ошибка отправки" }; }
}
