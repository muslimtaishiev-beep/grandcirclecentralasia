import admin from "firebase-admin";
import { sendMail } from "./mail.js";
import { tenantLogos } from "../shared/legal.js";
import { resolveWorkspaceConfig } from "../shared/workspaceConfig.js";
import { renderEmail, sanitizeEmailTemplate, type EmailTemplate } from "../shared/emailTemplate.js";

/**
 * Письма по шаблонам организации — после направления, теста, формы.
 *
 * Каждое событие пишется в email_log/{event}_{refId}: что, кому, ушло или
 * почему нет. Тот же журнал не даёт отправить письмо за одно событие дважды
 * (повторное «Завершить сессию», повторный финиш). Ошибки не бросаются —
 * основное действие (сессия, тест, заявка) не должно ломаться из-за почты.
 */
const db = () => admin.firestore();
const DEFAULT_APP_URL = "https://www.studyfreeforum.com";

let urlCache: { at: number; url: string } | null = null;
/** Адрес сайта для ссылок и картинок в письмах. */
export async function appUrl(): Promise<string> {
  if (urlCache && Date.now() - urlCache.at < 60_000) return urlCache.url;
  const d = (await db().collection("platform_config").doc("mail_m365").get().catch(() => null))?.data();
  const url = String(d?.appUrl || DEFAULT_APP_URL).replace(/\/+$/, "");
  urlCache = { at: Date.now(), url };
  return url;
}

/** Шаблон организации или null (чужой организации — тоже null). */
export async function loadTemplate(tenantId: string, templateId: string): Promise<EmailTemplate | null> {
  if (!tenantId || !/^[A-Za-z0-9_-]{4,64}$/.test(String(templateId || ""))) return null;
  const s = await db().collection("email_templates").doc(templateId).get();
  const d = s.data();
  if (!d || d.tenantId !== tenantId) return null;
  return { ...sanitizeEmailTemplate(d), id: s.id, tenantId };
}

/** Имя, логотип и настройки писем организации. */
export async function orgMail(tenantId: string) {
  const t = (await db().collection("tenants").doc(tenantId).get()).data() || {};
  const email = resolveWorkspaceConfig(t.workspaceConfig).email;
  return {
    org: { name: String(t.name || ""), logoUrl: tenantLogos(t).logoUrl, signature: email.signature || "" },
    fromName: email.fromName || String(t.name || ""),
    replyTo: email.replyTo || "",
  };
}

export interface TemplatedSend {
  tenantId: string;
  templateId: string;
  to: string;
  vars: Record<string, string>;
  event: string;
  refId: string;
  /** Отправить ещё раз, даже если уже уходило (ручная кнопка). */
  force?: boolean;
  by?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendTemplated(p: TemplatedSend): Promise<{ sent: boolean; reason?: string; skipped?: boolean }> {
  const ref = db().collection("email_log").doc(`${p.event}_${p.refId}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 300));
  try {
    // Захват события: второй вызов за то же событие ничего не шлёт.
    const claimed = await db().runTransaction(async tx => {
      const cur = (await tx.get(ref)).data();
      if (cur && !p.force && (cur.status === "sent" || (cur.status === "pending" && Date.now() - (cur.at || 0) < 120_000))) return false;
      tx.set(ref, { tenantId: p.tenantId, templateId: p.templateId, event: p.event, refId: p.refId, to: p.to, status: "pending", at: Date.now(), by: p.by || "" });
      return true;
    });
    if (!claimed) return { sent: false, skipped: true, reason: "Уже отправлено" };
    const done = async (r: { sent: boolean; reason?: string }) => {
      await ref.set({ status: r.sent ? "sent" : "failed", reason: r.reason || "", at: Date.now() }, { merge: true });
      return r;
    };
    const to = String(p.to || "").trim().toLowerCase();
    if (!EMAIL.test(to)) return done({ sent: false, reason: "Нет почты получателя" });
    const tpl = await loadTemplate(p.tenantId, p.templateId);
    if (!tpl) return done({ sent: false, reason: "Шаблон не найден" });
    const [m, base] = await Promise.all([orgMail(p.tenantId), appUrl()]);
    const { subject, html } = renderEmail(tpl, p.vars, m.org, base);
    return done(await sendMail({ to, subject, html, fromName: m.fromName, replyTo: m.replyTo }));
  } catch (e: any) {
    console.error("[email] templated:", e);
    await ref.set({ status: "failed", reason: String(e?.message || e).slice(0, 300), at: Date.now() }, { merge: true }).catch(() => {});
    return { sent: false, reason: "Не удалось отправить" };
  }
}
