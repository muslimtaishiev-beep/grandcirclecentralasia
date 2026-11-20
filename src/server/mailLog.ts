import admin from "firebase-admin";
import { sendMail, type MailMessage } from "./mail.js";
import type { PermissionKey } from "../shared/permissions.js";

/**
 * Письма, которые уходят не по шаблонам организации (приглашение, билет,
 * результат, служебные), — тоже в журнал email_log: кому, ушло ли, почему
 * нет. Текст письма хранится, чтобы неудачное можно было отправить ещё раз.
 */
export type RawMailKind = "invite" | "ticket" | "result" | "service";
export const RAW_KINDS: RawMailKind[] = ["invite", "ticket", "result", "service"];
export const RAW_LABEL: Record<RawMailKind, string> = { invite: "Приглашение", ticket: "Билет", result: "Результаты", service: "Служебное" };
/** Кто видит такие письма в журнале и может отправить заново. */
export const RAW_PERMS: Record<RawMailKind, PermissionKey[]> = {
  invite: ["team:manage"],
  ticket: ["team:manage", "certificates:issue", "crm:manage"],
  result: ["tests:manage", "admission:manage"],
  service: ["settings:manage"],
};
const MAX_HTML = 200_000;

export function isRawKind(v: unknown): v is RawMailKind { return RAW_KINDS.includes(v as RawMailKind); }

export interface LoggedMail extends MailMessage { kind: RawMailKind; label?: string }

/** Отправить и записать в журнал организации. Без tenantId — просто отправка. */
export async function sendLogged(p: LoggedMail): Promise<{ sent: boolean; reason?: string }> {
  const r = await sendMail(p);
  if (!p.tenantId) return r;
  try {
    const to = (Array.isArray(p.to) ? p.to : [p.to]).map(s => String(s).trim().toLowerCase()).join(", ").slice(0, 300);
    await admin.firestore().collection("email_log").add({
      tenantId: p.tenantId, event: p.kind, raw: true, to, status: r.sent ? "sent" : "failed", reason: r.reason || "",
      at: Date.now(), firstAt: Date.now(), tries: 1, subject: String(p.subject).slice(0, 250), templateId: "", actionUrl: "",
      ctx: { label: String(p.label || "").slice(0, 160) },
      html: p.kind !== "invite" && p.html.length <= MAX_HTML ? p.html : "", // в приглашении — одноразовая ссылка, не храним fromName: String(p.fromName || "").slice(0, 120), replyTo: String(p.replyTo || "").slice(0, 200),
    });
  } catch (e) { console.error("[mail-log]", e); }
  return r;
}

/** Повторная отправка записи журнала с сохранённым текстом. */
export async function resendRaw(ref: FirebaseFirestore.DocumentReference, tenantId: string, by: string): Promise<{ sent: boolean; reason?: string }> {
  const x = (await ref.get()).data();
  if (!x || x.tenantId !== tenantId || !x.raw || !isRawKind(x.event)) return { sent: false, reason: "Письмо не найдено" };
  if (!x.html) return { sent: false, reason: "Текст письма не сохранён" };
  const r = await sendMail({ to: String(x.to).split(", "), subject: x.subject, html: x.html, fromName: x.fromName, replyTo: x.replyTo, tenantId });
  await ref.set({ status: r.sent ? "sent" : "failed", reason: r.reason || "", at: Date.now(), tries: (x.tries || 1) + 1, by }, { merge: true });
  return r;
}
