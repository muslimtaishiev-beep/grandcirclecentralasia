import admin from "firebase-admin";

/**
 * Письма — через Microsoft 365 (Graph API).
 *
 * Отправитель выбирается по организации: если она подключила свой ящик и
 * проверила его (tenant_mail/{tenantId}, active), письма уходят с него;
 * иначе — с общего ящика платформы (platform_config/mail_m365). Ключи лежат
 * только на сервере (правила базы эти коллекции не открывают) и клиенту не
 * возвращаются. Приложению в Exchange разрешено слать только с ящиков,
 * на которые выдан доступ (ApplicationAccessPolicy).
 */
export interface MailConfig { tenantId: string; clientId: string; clientSecret: string; sender: string }
/** Источник отправителя: общий ящик платформы или свой ящик организации. */
export type MailSource = "platform" | "tenant";

const db = () => admin.firestore();
let cfgCache: { at: number; cfg: MailConfig | null } | null = null;
const tenantCache = new Map<string, { at: number; cfg: MailConfig | null }>();
const tokenCache = new Map<string, { token: string; exp: number }>();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function platformConfig(): Promise<MailConfig | null> {
  if (cfgCache && Date.now() - cfgCache.at < 60_000) return cfgCache.cfg;
  const d = (await db().collection("platform_config").doc("mail_m365").get().catch(() => null))?.data();
  const cfg = d?.tenantId && d?.clientId && d?.clientSecret && d?.sender ? { tenantId: d.tenantId, clientId: d.clientId, clientSecret: d.clientSecret, sender: d.sender } : null;
  cfgCache = { at: Date.now(), cfg };
  return cfg;
}

/** Документ настроек своего ящика организации (с секретом — только для сервера). */
export async function tenantMailDoc(tenantId: string) {
  const d = (await db().collection("tenant_mail").doc(tenantId).get().catch(() => null))?.data();
  return d ? {
    mode: d.mode === "custom" ? "custom" as const : "platform" as const,
    active: d.active === true,
    azureTenant: String(d.azureTenant || ""), clientId: String(d.clientId || ""), clientSecret: String(d.clientSecret || ""), sender: String(d.sender || ""),
    verifiedAt: Number(d.verifiedAt) || 0,
  } : null;
}

/** Свой ящик организации — только если выбран и проверен; иначе null (запасной — общий). */
async function tenantConfig(tenantId: string): Promise<MailConfig | null> {
  const hit = tenantCache.get(tenantId);
  if (hit && Date.now() - hit.at < 30_000) return hit.cfg;
  const d = await tenantMailDoc(tenantId);
  const cfg = d && d.mode === "custom" && d.active && d.azureTenant && d.clientId && d.clientSecret && EMAIL.test(d.sender)
    ? { tenantId: d.azureTenant, clientId: d.clientId, clientSecret: d.clientSecret, sender: d.sender } : null;
  tenantCache.set(tenantId, { at: Date.now(), cfg });
  return cfg;
}
/** Сбросить кэш после смены настроек ящика. */
export function dropMailCache(tenantId?: string) { if (tenantId) tenantCache.delete(tenantId); else tenantCache.clear(); cfgCache = null; }

async function graphToken(c: MailConfig): Promise<string> {
  const key = `${c.tenantId}:${c.clientId}`;
  const hit = tokenCache.get(key);
  if (hit && Date.now() < hit.exp - 60_000) return hit.token;
  const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(c.tenantId)}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error(`Microsoft 365: ${j.error_description?.split("\n")[0] || j.error || "нет токена"}`);
  tokenCache.set(key, { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 });
  return j.access_token;
}

export interface MailMessage {
  to: string | string[]; subject: string; html: string; fromName?: string; replyTo?: string;
  /** Организация-отправитель: если у неё подключён и проверен свой ящик — письмо уйдёт с него. */
  tenantId?: string;
}

async function deliverVia(c: MailConfig, m: MailMessage): Promise<{ sent: boolean; reason?: string }> {
  const to = (Array.isArray(m.to) ? m.to : [m.to]).map(s => String(s).trim()).filter(s => EMAIL.test(s)).slice(0, 50);
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
        ...(m.replyTo && EMAIL.test(m.replyTo) ? { replyTo: [{ emailAddress: { address: m.replyTo } }] } : {}),
      },
      saveToSentItems: false,
    }),
  });
  if (r.status === 202) return { sent: true };
  if (r.status === 401) tokenCache.delete(`${c.tenantId}:${c.clientId}`);
  const e: any = await r.json().catch(() => ({}));
  return { sent: false, reason: `Microsoft 365: ${e.error?.message || r.status}` };
}

/** Какой ящик сейчас будет использован для организации и его адрес (для экрана настроек). */
export async function effectiveSender(tenantId?: string): Promise<{ source: MailSource; address: string } | null> {
  const t = tenantId ? await tenantConfig(tenantId) : null;
  if (t) return { source: "tenant", address: t.sender };
  const p = await platformConfig();
  return p ? { source: "platform", address: p.sender } : null;
}

/** Отправить письмо. Не настроено или ошибка — { sent: false, reason }, без исключения. */
export async function sendMail(m: MailMessage): Promise<{ sent: boolean; reason?: string }> {
  try {
    const c = (m.tenantId ? await tenantConfig(m.tenantId) : null) || await platformConfig();
    if (!c) return { sent: false, reason: "Почта Microsoft 365 не настроена" };
    return await deliverVia(c, m);
  } catch (e: any) { return { sent: false, reason: e?.message || "Ошибка отправки" }; }
}

/** Проверка подключения: пробное письмо через указанные ключи (даже если ящик ещё не включён). */
export async function sendMailWith(c: MailConfig, m: MailMessage): Promise<{ sent: boolean; reason?: string }> {
  try { return await deliverVia(c, m); } catch (e: any) { return { sent: false, reason: e?.message || "Ошибка отправки" }; }
}
