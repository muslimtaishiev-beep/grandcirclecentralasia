import admin from "firebase-admin";

/**
 * История поступающего: tenants/{t}/applicant_audit. Каждое событие — кто,
 * когда, что; правки — построчно «было → стало». Видит только администрация
 * приёма (по кнопке «История» в карточке).
 */
export interface AuditChange { label: string; from: string; to: string }
/** Кто сделал: сотрудник; null — родитель по ссылке; SYSTEM — система/ученик. */
export type AuditWho = { uid: string; name: string } | null;
export const SYSTEM: AuditWho = { uid: "system", name: "Система" };
export const STUDENT = (name: string): AuditWho => ({ uid: "student", name: name ? `Ученик · ${name}` : "Ученик" });

const clip = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim().slice(0, max);

/**
 * o.templateId — событие по анкете: её «было → стало» видит только тот, кому
 * эта анкета открыта. o.key — одна запись на ключ (просмотр: раз в час на
 * человека), повтор молча пропускается.
 */
export async function applicantAudit(t: string, applicantId: string, who: AuditWho, action: string, detail = "", changes: AuditChange[] = [], o: { templateId?: string; key?: string } = {}) {
  if (!t || !applicantId) return;
  const list = changes.slice(0, 40).map(c => ({ label: clip(c.label, 120), from: clip(c.from, 500), to: clip(c.to, 500) }));
  const doc = {
    applicantId, action, detail: clip(detail, 300), by: who?.uid || "parent", byName: who?.name || "Родитель", at: Date.now(),
    ...(list.length ? { changes: list } : {}), ...(o.templateId ? { templateId: o.templateId } : {}),
  };
  const col = admin.firestore().collection("tenants").doc(t).collection("applicant_audit");
  await (o.key ? col.doc(o.key).create(doc) : col.add(doc)).catch(e => { if (e?.code !== 6 && !/already exists/i.test(String(e?.message))) console.error("[audit]", e); });
}

/** Что изменилось: пары [подпись, было, стало] → только отличающиеся. */
export function diffRows(rows: [string, unknown, unknown][]): AuditChange[] {
  const show = (v: unknown) => (v === true ? "да" : v === false ? "нет" : v == null ? "" : Array.isArray(v) ? v.join(", ") : String(v));
  return rows.map(([label, a, b]) => ({ label, from: show(a), to: show(b) })).filter(c => c.from.trim() !== c.to.trim());
}
