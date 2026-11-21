import admin from "firebase-admin";
import { appUrl, sendTemplated, type SendResult } from "./emailEvents.js";
import { cancelJob, registerJobHandler, scheduleJob } from "./scheduler.js";
import { loadTenant } from "./tenantAccess.js";
import { buildView } from "./resultPages.js";
import { decisionOf, notifyJobKey, notifyRunAt, resolveDecisions, type Decision } from "../shared/formDecisions.js";
import type { ResultData, ResultPageView } from "../shared/resultPages.js";

/**
 * Письма и страницы по состояниям заявки. Устроено как письмо о результатах
 * поступления: шаблон (или встроенный), ссылка на страницу, запись в email_log.
 *
 * Смена состояния отменяет прежнюю отложенную отправку и ставит новую по
 * настройке состояния: «через N минут», «в заданное время»; «вручную» —
 * сервер лишь сообщает, что нужно подтверждение; «не отправлять» — ничего.
 */
const db = () => admin.firestore();
const SUBS = "form_submissions";
const FORMS = "custom_forms";
const subRef = (id: string) => db().collection(SUBS).doc(id);

export interface Pending { runAt: number; statusId: string; label: string }

const nameOf = (s: any) => String(s?.applicantName || "").trim();
const dateRu = (ms = Date.now()) => new Date(ms).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

/** Ссылка заявителю: страница отслеживания. Нет кода — пусто. */
async function trackUrl(sub: any, form: any, d: Decision): Promise<string> {
  const token = String(sub.qrToken || "");
  if (!token) return "";
  if (form.qrTrackingEnabled === false && !d.notify.pageId) return "";
  return `${await appUrl()}/track/${encodeURIComponent(token)}`;
}

/** Письмо о состоянии заявки. force — ручная отправка и переотправка. */
export async function sendDecisionEmail(p: { sub: any & { id: string }; form: any; decision: Decision; by?: string; force?: boolean }): Promise<SendResult> {
  const { sub, form, decision } = p;
  const t = String(form.tenantId || "");
  const org = await loadTenant(t);
  return sendTemplated({
    tenantId: t, templateId: decision.notify.emailTemplateId || "", to: String(sub.applicantEmail || ""), event: "form",
    refId: `${sub.id}__${decision.id}`, force: p.force, by: p.by,
    ctx: { submissionId: sub.id, formId: String(sub.formId || form.id || ""), statusId: decision.id, label: `${nameOf(sub) || "Без имени"} · ${decision.label}` },
    actionUrl: `/workspace/${t}/builder/forms`, noRecipient: "В заявке нет почты",
    mirror: { ref: subRef(sub.id), field: "notifyEmail" },
    vars: {
      имя: nameOf(sub), форма: String(form.title || ""), статус: decision.label,
      организация: String(org?.name || ""), ссылка: await trackUrl(sub, form, decision),
    },
  });
}

async function setPending(subId: string, v: Pending | null) {
  await subRef(subId).update({ pendingNotify: v ? v : admin.firestore.FieldValue.delete() }).catch(() => {});
}

export interface NotifyPlan { mode: string; runAt?: number; needConfirm?: boolean; label?: string }

/**
 * После смены состояния: прежняя отправка отменяется, новая ставится по
 * настройке. allowManual — вызывающий умеет спросить подтверждение.
 */
export async function afterStatusChange(p: { tenantId: string; submissionId: string; form: any; statusId: string; by: { uid: string; name: string } }): Promise<NotifyPlan> {
  const d = decisionOf(resolveDecisions(p.form), p.statusId);
  await cancelJob(p.tenantId, notifyJobKey(p.submissionId)).catch(() => false);
  const runAt = notifyRunAt(d.notify, Date.now());
  if (runAt) {
    await scheduleJob({ tenantId: p.tenantId, kind: "form_notify", key: notifyJobKey(p.submissionId), runAt, payload: { submissionId: p.submissionId, statusId: d.id }, by: p.by });
    await setPending(p.submissionId, { runAt, statusId: d.id, label: d.label });
    return { mode: d.notify.mode, runAt, label: d.label };
  }
  await setPending(p.submissionId, null);
  return d.notify.mode === "manual" ? { mode: "manual", needConfirm: true, label: d.label } : { mode: d.notify.mode, label: d.label };
}

/** Отменить отложенную отправку заявки. true — была. */
export async function cancelPending(tenantId: string, submissionId: string): Promise<boolean> {
  const was = await cancelJob(tenantId, notifyJobKey(submissionId)).catch(() => false);
  await setPending(submissionId, null);
  return was;
}

registerJobHandler("form_notify", async job => {
  const { submissionId, statusId } = (job.payload || {}) as { submissionId?: string; statusId?: string };
  if (!submissionId) return "Нет заявки";
  const s = await subRef(submissionId).get();
  const sub: any = s.data();
  if (!sub || sub.tenantId !== job.tenantId || sub.deleted) return "Заявка не найдена";
  if (String(sub.status || "new") !== statusId) return "Состояние сменилось — не отправлено";
  const f = await db().collection(FORMS).doc(String(sub.formId || "")).get();
  const form: any = f.data();
  if (!form || form.tenantId !== job.tenantId) return "Форма не найдена";
  const decision = decisionOf(resolveDecisions(form), statusId);
  const r = await sendDecisionEmail({ sub: { ...sub, id: submissionId }, form: { ...form, id: f.id }, decision, by: "scheduler", force: true });
  await setPending(submissionId, null);
  return r.sent ? `Отправлено: ${r.to || ""}` : `Не отправлено: ${r.reason || ""}`;
});

/** Страница отслеживания для состояния заявки (вариант под это состояние) или null. */
export async function trackPage(tenantId: string, form: any, sub: any, d: Decision, orgName: string): Promise<ResultPageView | null> {
  const pageId = d.notify.pageId;
  if (!pageId) return null;
  const notes = (Array.isArray(sub.history) ? sub.history : []).filter((h: any) => String(h?.note || "").trim());
  const note = notes.length ? String(notes[notes.length - 1].note) : "";
  const title = String(form.title || sub.formTitle || "");
  const vars: Record<string, string> = {
    имя: nameOf(sub), ребёнок: nameOf(sub), форма: title, статус: d.label, решение: d.label, организация: orgName, дата: dateRu(),
    обратная_связь: note, класс: "", класс_зачисления: "", пробный_с: "", пробный_по: "",
  };
  const data: ResultData = { child: nameOf(sub), examTitle: title, subjects: [], feedback: note, trial: null };
  try { return await buildView(tenantId, pageId, d.id, vars, data); } catch (e: any) { console.error("[track] page:", e?.message || e); return null; }
}
