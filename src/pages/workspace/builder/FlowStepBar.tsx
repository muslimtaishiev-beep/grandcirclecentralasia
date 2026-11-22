import React, { useEffect, useState } from "react";
import { Lock, MessageSquare } from "lucide-react";
import { auth } from "../../../lib/firebase";
import { confirmDialog, toast } from "../../../components/ui";
import EmailResend from "../../../components/workspace/EmailResend";
import { PublishWhenModal, SplitPublishButton, whenShort } from "../admissions/PublishControls";
import { activeSteps, canPublish, markLabels, resolveFlow, type FlowStep, type StepState } from "../../../shared/formFlow";

/**
 * Этапы заявки в строке списка: кнопки-отметки, комментарий, «Опубликовать».
 * Видны только этапы, которые сейчас открыты у этой заявки (состояние,
 * условие, опубликованный родитель). Опубликованное закрыто до «Снять».
 */
async function flowCall(body: object) {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch("/api/forms/flow-step", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.success) throw new Error(j.error || `Ошибка ${r.status}`);
  return j;
}

export default function FlowStepBar({ tenantId, form, sub, templateName }: { tenantId: string; form: any; sub: any; templateName: (id?: string) => string }) {
  const flow = resolveFlow(form);
  if (!flow.steps.length || sub.deleted) return null;
  const steps = activeSteps(form, sub, flow);
  if (!steps.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {steps.map(s => <StepRow key={s.id} tenantId={tenantId} sub={sub} step={s} state={sub.flow?.[s.id] || null} templateName={templateName} />)}
    </div>
  );
}

const chip = (on: boolean, locked: boolean) =>
  `px-2 py-0.5 rounded-full text-[11px] font-semibold border transition disabled:cursor-not-allowed ${on ? "bg-emerald-600 border-emerald-600 text-white" : "border-[var(--border-color)] text-[var(--text-main)] hover:border-emerald-500"} ${locked && !on ? "opacity-50" : ""}`;

function StepRow({ tenantId, sub, step, state, templateName }: { tenantId: string; sub: any; step: FlowStep; state: StepState | null; templateName: (id?: string) => string }) {
  // Правка видна сразу; подписка на заявки потом пришлёт то же самое.
  const [local, setLocal] = useState<StepState | null>(state);
  useEffect(() => setLocal(state), [state]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const st = local;
  const locked = !!st?.published;
  const marks = st?.marks || [];
  const call = async (body: object) => {
    setBusy(true);
    try { const j = await flowCall({ tenantId, submissionId: sub.id, stepId: step.id, ...body }); if (j.state) setLocal(j.state); return j; }
    catch (e: any) { toast.error(e.message); return null; }
    finally { setBusy(false); }
  };
  const toggle = (id: string) => void call({ action: "save", marks: marks.includes(id) ? marks.filter(x => x !== id) : [...marks, id] });
  const saveNote = async () => { if (note === null) return; const j = await call({ action: "save", comment: note }); if (j) setNote(null); };
  const to = String(sub.applicantEmail || "");
  const publish = async (at?: number) => {
    if (!at) {
      const letter = step.emailTemplateId ? `Письмо «${templateName(step.emailTemplateId)}» уйдёт ${to.includes("@") ? `на ${to}` : "— но в заявке нет почты"}.` : "Письма у этапа нет.";
      const what = markLabels(step, st).join(", ");
      if (!(await confirmDialog({ title: `Опубликовать: ${step.title}`, message: `${what ? `${what}. ` : ""}${letter}`, confirmLabel: "Опубликовать" }))) return;
    }
    const j = await call({ action: "publish", ...(at ? { at } : {}) });
    if (!j) return;
    setPicking(false);
    if (j.scheduled) toast.success(`Запланировано на ${whenShort(j.scheduled)}`);
    else toast.success(j.email?.sent ? `Опубликовано, письмо: ${j.email.to}` : `Опубликовано${j.email?.reason && !j.email.skipped ? ` · письмо: ${j.email.reason}` : ""}`);
  };
  const unpublish = async () => {
    if (!(await confirmDialog({ title: `Снять публикацию: ${step.title}?`, message: "Отметки снова можно будет менять. Отправленное письмо не отзывается.", confirmLabel: "Снять", danger: true }))) return;
    await call({ action: "unpublish" });
  };

  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] px-2 py-1.5 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
        {locked && <Lock className="w-3 h-3" />}<span className="truncate">{step.title}</span>
      </div>
      {step.marks.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {step.marks.map(m => {
            const on = marks.includes(m.id);
            return <button key={m.id} type="button" role="checkbox" aria-checked={on} disabled={busy || locked} title={locked ? "Сначала снимите публикацию" : undefined} className={chip(on, locked)} onClick={() => toggle(m.id)}>{on ? "☑" : "☐"} {m.label}</button>;
          })}
        </div>
      )}
      {step.comment && (note !== null ? (
        <div className="space-y-1">
          <textarea autoFocus rows={2} maxLength={2000} className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-md px-2 py-1 text-[11px] text-[var(--text-main)] outline-none focus:border-emerald-500" value={note} onChange={e => setNote(e.target.value)} placeholder="Комментарий для письма" />
          <div className="flex gap-1.5">
            <button type="button" disabled={busy} className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[11px] font-semibold disabled:opacity-50" onClick={() => void saveNote()}>Сохранить</button>
            <button type="button" disabled={busy} className="px-2 py-0.5 rounded-md border border-[var(--border-color)] text-[11px]" onClick={() => setNote(null)}>Отмена</button>
          </div>
        </div>
      ) : (
        <button type="button" disabled={locked} title={locked ? "Сначала снимите публикацию" : "Комментарий организаторов"} onClick={() => setNote(st?.comment || "")}
          className="flex items-start gap-1 text-left text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:cursor-not-allowed max-w-[260px]">
          <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span className="line-clamp-2">{st?.comment || "Комментарий"}</span>
        </button>
      ))}
      <div className="flex flex-wrap items-center gap-1.5">
        {locked ? (
          <>
            <span className="text-[11px] text-emerald-600 font-semibold">Опубликовано · {whenShort(st!.published!.at)}</span>
            {step.emailTemplateId && st?.email && <EmailResend tenantId={tenantId} event="form" ctx={{ submissionId: sub.id, stepId: step.id }} state={st.email as any} compact />}
            <button type="button" disabled={busy} className="text-[11px] text-[var(--text-muted)] hover:text-rose-600 underline" onClick={() => void unpublish()}>Снять</button>
          </>
        ) : st?.publishAt ? (
          <>
            <span className="text-[11px] text-sky-600 font-semibold">Публикация · {whenShort(st.publishAt)}</span>
            <button type="button" disabled={busy} className="text-[11px] text-[var(--text-muted)] hover:text-rose-600 underline" onClick={() => void call({ action: "cancel" })}>Отменить</button>
          </>
        ) : canPublish(step, st) && (
          <SplitPublishButton text="Опубликовать" loading={busy} onNow={() => void publish()} onSchedule={() => setPicking(true)} />
        )}
      </div>
      {picking && <PublishWhenModal onClose={() => setPicking(false)} onPick={at => publish(at)} />}
    </div>
  );
}
