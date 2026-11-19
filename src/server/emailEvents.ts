import admin from "firebase-admin";
import { sendMail } from "./mail.js";
import { notifyEvent } from "./notify.js";
import { tenantLogos } from "../shared/legal.js";
import { resolveWorkspaceConfig } from "../shared/workspaceConfig.js";
import { emailLogId, renderEmail, sanitizeEmailTemplate, type EmailCtx, type EmailEvent, type EmailTemplate } from "../shared/emailTemplate.js";
import type { PermissionKey } from "../shared/permissions.js";

/**
 * Письма по шаблонам организации — после направления, теста, формы.
 *
 * Каждое событие пишется в email_log/{event}_{refId}: что, кому, о ком,
 * ушло или почему нет. Тот же журнал не даёт отправить письмо за одно
 * событие дважды. Письмо не ушло — уведомление тем, кто за это отвечает,
 * с кнопкой «Переотправить». Ошибки не бросаются: основное действие
 * (сессия, тест, заявка) не должно ломаться из-за почты.
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

/** Кто отвечает за письма события — им уведомление, если письмо не ушло; они же переотправляют. */
export const EVENT_PERMS: Record<EmailEvent, PermissionKey[]> = {
  referral: ["admission:manage"],
  tested: ["admission:manage", "tests:manage"],
  form: ["team:manage", "certificates:issue", "crm:manage"],
};
const EVENT_TITLE: Record<EmailEvent, string> = { referral: "Направление", tested: "Письмо после теста", form: "Письмо по заявке" };

export interface TemplatedSend {
  tenantId: string;
  templateId: string;
  to: string;
  vars: Record<string, string>;
  event: EmailEvent;
  refId: string;
  /** Что это было: по этим полям письмо переотправляют. */
  ctx: EmailCtx;
  /** Отправить ещё раз, даже если уже уходило (ручная кнопка). */
  force?: boolean;
  by?: string;
  /** Куда ведёт уведомление «не ушло» (карточка, где поправить почту). */
  actionUrl?: string;
  /** Документ, в котором показать статус письма (заявка, работа, карточка). */
  mirror?: { ref: FirebaseFirestore.DocumentReference; field: string };
  /** Текст причины, когда нет адреса («Нет почты родителя»). */
  noRecipient?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export type SendResult = { sent: boolean; reason?: string; skipped?: boolean; to?: string };

export async function sendTemplated(p: TemplatedSend): Promise<SendResult> {
  const logId = emailLogId(p.event, p.refId);
  const ref = db().collection("email_log").doc(logId);
  const to = String(p.to || "").trim().toLowerCase();
  try {
    // Захват события: второй вызов за то же событие ничего не шлёт.
    const claimed = await db().runTransaction(async tx => {
      const cur = (await tx.get(ref)).data();
      if (cur && !p.force && (cur.status === "sent" || (cur.status === "pending" && Date.now() - (cur.at || 0) < 120_000))) return false;
      tx.set(ref, {
        tenantId: p.tenantId, templateId: p.templateId, event: p.event, refId: p.refId, ctx: p.ctx, to, status: "pending",
        at: Date.now(), by: p.by || "", actionUrl: p.actionUrl || "", tries: (cur?.tries || 0) + 1, firstAt: cur?.firstAt || Date.now(),
      });
      return true;
    });
    if (!claimed) return { sent: false, skipped: true, reason: "Уже отправлено" };
    let r: SendResult;
    if (!EMAIL.test(to)) r = { sent: false, reason: p.noRecipient || "Нет почты получателя" };
    else {
      const tpl = await loadTemplate(p.tenantId, p.templateId);
      if (!tpl) r = { sent: false, reason: "Шаблон не найден" };
      else {
        const [m, base] = await Promise.all([orgMail(p.tenantId), appUrl()]);
        const { subject, html } = renderEmail(tpl, p.vars, m.org, base);
        r = await sendMail({ to, subject, html, fromName: m.fromName, replyTo: m.replyTo });
        await ref.set({ subject }, { merge: true });
      }
    }
    await finish(p, logId, r, to);
    return { ...r, to };
  } catch (e: any) {
    console.error("[email] templated:", e);
    const r = { sent: false, reason: "Не удалось отправить" };
    await finish(p, logId, r, to).catch(() => {});
    return r;
  }
}

async function finish(p: TemplatedSend, logId: string, r: SendResult, to: string) {
  const status = r.sent ? "sent" : "failed";
  await db().collection("email_log").doc(logId).set({ status, reason: r.reason || "", at: Date.now() }, { merge: true });
  if (p.mirror) await p.mirror.ref.set({ [p.mirror.field]: { status, reason: r.reason || "", at: Date.now(), to, logId } }, { merge: true }).catch(() => {});
  if (r.sent) await clearFailNotices(logId);
  else await notifyFailed(p, logId, r.reason || "");
}

/** Письмо не ушло — колокольчик и Telegram тем, кто отвечает за событие (если не отключили в профиле). */
async function notifyFailed(p: TemplatedSend, logId: string, reason: string) {
  const title = `${EVENT_TITLE[p.event]} не ушло`;
  const body = [p.ctx.label, p.to ? `на ${p.to}` : "", reason].filter(Boolean).join(" · ");
  const url = p.actionUrl || `/workspace/${p.tenantId}/settings/emails?tab=log`;
  // Уже есть непрочитанное «не ушло» по этому письму — в Telegram второй раз не пишем.
  await notifyEvent({
    tenantId: p.tenantId, event: "email.failed", perms: EVENT_PERMS[p.event], title, body, url, type: "email",
    docId: u => `email_${logId}_${u}`, quietIfUnread: true,
    extra: { emailLogId: logId, ...(p.ctx.applicantId ? { applicantId: p.ctx.applicantId } : {}) },
  });
}

/** Ушло после переотправки — уведомления «не ушло» больше не нужны. */
async function clearFailNotices(logId: string) {
  const s = await db().collection("notifications").where("emailLogId", "==", logId).get().catch(() => null);
  if (s && !s.empty) await Promise.all(s.docs.map(d => d.ref.delete()));
}

// ── Переотправка ────────────────────────────────────────────────────────

type Resender = (tenantId: string, ctx: EmailCtx, by: string) => Promise<SendResult>;
const resenders = new Map<EmailEvent, Resender>();
/** Маршруты регистрируют, как заново собрать письмо своего события (свежие данные: исправленная почта и т.п.). */
export function registerResender(event: EmailEvent, fn: Resender) { resenders.set(event, fn); }

export async function resend(tenantId: string, event: EmailEvent, ctx: EmailCtx, by: string): Promise<SendResult> {
  const fn = resenders.get(event);
  if (!fn) return { sent: false, reason: "Это письмо нельзя переотправить" };
  return fn(tenantId, ctx, by);
}
