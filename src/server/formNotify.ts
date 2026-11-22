import admin from "firebase-admin";
import { appUrl, sendTemplated, type SendResult } from "./emailEvents.js";
import { cancelJob, registerJobHandler, scheduleJob } from "./scheduler.js";
import { loadTenant } from "./tenantAccess.js";
import { buildView } from "./resultPages.js";
import { decisionOf, notifyJobKey, notifyRunAt, resolveDecisions, type Decision } from "../shared/formDecisions.js";
import type { ResultData, ResultPageView } from "../shared/resultPages.js";
import { canPublish, flowJobKey, markLabels, resolveFlow, stepActive, type FlowStep, type StepState } from "../shared/formFlow.js";

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

// ── Этапы заявки ────────────────────────────────────────────────────────

/** Письмо этапа: отметки и комментарий организаторов. Каждая публикация — своё письмо. */
export async function sendFlowEmail(p: { sub: any & { id: string }; form: any; step: FlowStep; st: StepState; by?: string; force?: boolean }): Promise<SendResult> {
  const { sub, form, step, st } = p;
  const t = String(form.tenantId || "");
  if (!step.emailTemplateId) return { sent: false, skipped: true, reason: "У этапа не выбрано письмо" };
  const org = await loadTenant(t);
  const r = await sendTemplated({
    tenantId: t, templateId: step.emailTemplateId, to: String(sub.applicantEmail || ""), event: "form",
    refId: `${sub.id}__step_${step.id}_${st.published?.at || 0}`, force: p.force, by: p.by,
    ctx: { submissionId: sub.id, formId: String(sub.formId || form.id || ""), stepId: step.id, label: `${nameOf(sub) || "Без имени"} · ${step.title}` },
    actionUrl: `/workspace/${t}/builder/forms`, noRecipient: "В заявке нет почты",
    vars: {
      имя: nameOf(sub), форма: String(form.title || ""), организация: String(org?.name || ""),
      этап: step.title, отметки: markLabels(step, st).join(", "), комментарий: String(st.comment || "").trim(),
      статус: decisionOf(resolveDecisions(form), sub.status).label,
    },
  });
  await subRef(sub.id).update({ [`flow.${step.id}.email`]: { status: r.sent ? "sent" : r.skipped ? "skipped" : "failed", reason: r.reason || "", at: Date.now(), to: r.to || "" } }).catch(() => {});
  return r;
}

/**
 * Опубликовать этап заявки: отметка «опубликовано», запись в историю и
 * письмо. Проверки — у вызывающего (этап виден, отметок хватает).
 */
export async function publishStep(p: { sub: any & { id: string }; form: any; step: FlowStep; by: { uid: string; name: string } }): Promise<{ st: StepState; email: SendResult }> {
  const { sub, form, step } = p;
  const now = Date.now();
  const prev: StepState = sub.flow?.[step.id] || { marks: [], comment: "", published: null, by: "", byName: "", at: 0 };
  const st: StepState = { ...prev, published: { at: now, by: p.by.uid, byName: p.by.name }, publishAt: null };
  await subRef(sub.id).update({
    [`flow.${step.id}`]: JSON.parse(JSON.stringify(st)), updatedAt: admin.firestore.Timestamp.now(),
    history: admin.firestore.FieldValue.arrayUnion({ status: String(sub.status || "new"), at: admin.firestore.Timestamp.now(), by: p.by.name, note: `Этап «${step.title}» опубликован${markLabels(step, st).length ? `: ${markLabels(step, st).join(", ")}` : ""}` }),
  });
  await cancelJob(String(form.tenantId), flowJobKey(sub.id, step.id)).catch(() => false);
  const email = await sendFlowEmail({ sub, form, step, st, by: p.by.uid });
  return { st, email };
}

/** Публикация этапа по таймеру. */
registerJobHandler("form_flow_publish", async job => {
  const { submissionId, stepId } = (job.payload || {}) as { submissionId?: string; stepId?: string };
  if (!submissionId || !stepId) return "Нет заявки";
  const s = await subRef(submissionId).get();
  const sub: any = s.data();
  if (!sub || sub.tenantId !== job.tenantId || sub.deleted) return "Заявка не найдена";
  const f = await db().collection(FORMS).doc(String(sub.formId || "")).get();
  const form: any = f.data();
  if (!form || form.tenantId !== job.tenantId) return "Форма не найдена";
  const flow = resolveFlow(form);
  const step = flow.steps.find(x => x.id === stepId);
  const st: StepState | undefined = sub.flow?.[stepId];
  const clear = () => subRef(submissionId).update({ [`flow.${stepId}.publishAt`]: null }).catch(() => {});
  if (!step || !stepActive(form, sub, flow.steps, step)) { await clear(); return "Этап у заявки больше не виден — не опубликовано"; }
  if (st?.published) { await clear(); return "Уже опубликовано"; }
  if (!canPublish(step, st)) { await clear(); return "Не хватает отметок — не опубликовано"; }
  const r = await publishStep({ sub: { ...sub, id: submissionId }, form: { ...form, id: f.id }, step, by: job.createdBy });
  return r.email.sent ? `Опубликовано, письмо: ${r.email.to || ""}` : `Опубликовано${r.email.reason ? ` · письмо: ${r.email.reason}` : ""}`;
});

/** Запланировать публикацию этапа (заменяет прежнюю). */
export async function scheduleStep(tenantId: string, submissionId: string, stepId: string, at: number, by: { uid: string; name: string }) {
  await scheduleJob({ tenantId, kind: "form_flow_publish", key: flowJobKey(submissionId, stepId), runAt: at, payload: { submissionId, stepId }, by });
  await subRef(submissionId).update({ [`flow.${stepId}.publishAt`]: at });
}
export async function cancelStepSchedule(tenantId: string, submissionId: string, stepId: string) {
  await cancelJob(tenantId, flowJobKey(submissionId, stepId)).catch(() => false);
  await subRef(submissionId).update({ [`flow.${stepId}.publishAt`]: null }).catch(() => {});
}
