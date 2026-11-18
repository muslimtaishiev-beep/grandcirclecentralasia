import EmailResend from "../../../components/workspace/EmailResend";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, ClipboardList, Copy, Download, ExternalLink, Loader2, Lock, Pencil, Printer, QrCode, RefreshCw, Trash2 } from "lucide-react";
import FormFiller from "../../../components/admissions/FormFiller";
import { STAGE_LABEL, stageOf, type Applicant, type CandidateInfo, type PaperResult } from "../../../shared/admissions";
import { NEUTRAL_CANDIDATE_FORM, type CandidateFormConfig } from "../../../shared/candidateForm";
import { attachmentsFor, gradeOf, outcomeOf, type QAnswers, type QAttachment, type QTemplate } from "../../../shared/questionnaires";
import { tenantLogos } from "../../../shared/legal";
import { linkUrl, openHtml, parentHTML, referralHTML, sheetHTML, staffBlankHTML, type PrintChild } from "../../../lib/admissionPrint";
import FancyQr from "../../../components/forms/FancyQr";
import { Modal, btn, btnPrimary, input, label } from "../journals/components/ui";
import { TONE, type Api, type Me } from "./admissionApi";
import { saveSessions, sessionsOf } from "./sessionPdf";
import AttemptViewer from "../exams/AttemptViewer";
import { candidateDoc, latestTest, saveCandidate, topicFeedback, type TestSummary } from "./candidateForm";

/**
 * Карточка поступающего. Вкладки — по правам: психолог открывает свою
 * анкету, приёмная — профиль, направление и тест; содержимое анкет с
 * данными о здоровье приходит с сервера только тем, кому разрешено.
 */
interface FormDoc { id: string; templateId: string; status: "draft" | "done"; outcome: string | null; outcomeLabel?: string; full: boolean; template: QTemplate; answers?: QAnswers; grade?: number | null; filledBy?: { kind: string; name: string }; doneAt?: number | null; consent?: unknown }
interface TestExam { id: string; title: string; paper: boolean; sections: { id: string; title: string; tasks: number }[] }
interface Data {
  applicant: Applicant; forms: FormDoc[]; attempts: (TestSummary & { id: string; examId: string; shortId: string; decision: string | null })[]; audit: any[];
  templates: QTemplate[]; canFill: Record<string, boolean>; canSee: Record<string, boolean>; me: Me;
  testExam: TestExam | null;
  candidateForm: CandidateFormConfig | null;
}
const no = (n: number) => `№ ${String(n).padStart(4, "0")}`;
const AUDIT: Record<string, string> = {
  created: "Карточка создана", edited: "Изменена карточка", viewed: "Открыл анкеты с данными о здоровье", form_done: "Анкета завершена", form_reopened: "Анкета открыта для правки",
  parent_form: "Родитель заполнил анкету", referral_manual: "Направление выдано вручную", referral_revoked: "Направление снято", paper_results: "Внесены результаты на бумаге", paper_deleted: "Удалены результаты на бумаге",
  decision: "Решение", feedback: "Обратная связь", relink: "Перевыпущен QR", deleted: "Карточка удалена",
};

export default function ApplicantCard({ id, api, tenant, initialTab, section, autoQr, psychMode, onClose, onChanged }: {
  id: string; api: Api; tenant: any; initialTab?: string; section?: string;
  /** Психологическая часть «Экзаменов»: только сессия, даже у того, у кого есть и права приёма. */
  psychMode?: boolean;
  /** Сразу показать QR (после «Завести» — анкета для родителя). */
  autoQr?: "parent";
  onClose: () => void; onChanged: () => void;
}) {
  const [qr, setQr] = useState<null | "referral" | "parent">(null);
  const autoShown = useRef(false);
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<string>(section && section !== "parent" ? section : section === "parent" ? "parent" : initialTab || "profile");

  const load = useCallback(async () => {
    try {
      const j = await api(`/applicants/${id}`);
      if (psychMode) j.me = { ...j.me, admission: false, academic: false };
      setD(j); setError(null);
    } catch (e: any) { setError(e.message); }
  }, [api, id, psychMode]);
  useEffect(() => { void load(); }, [load]);
  // Пришло уведомление про этого ребёнка — карточка обновляется сама.
  useEffect(() => {
    const on = (e: Event) => { if ((e as CustomEvent).detail?.applicantId === id) void load(); };
    window.addEventListener("sf:notification", on);
    return () => window.removeEventListener("sf:notification", on);
  }, [id, load]);
  const [saving, setSaving] = useState(false);

  const staffTemplates = useMemo(() => (d?.templates || []).filter(t => t.audience === "staff" && (d!.canFill[t.id] || d!.canSee[t.id] || d!.forms.some(f => f.templateId === t.id))), [d]);
  const parentTpl = d?.templates.find(t => t.audience === "parent");
  const parentForm = d?.forms.find(f => f.template.audience === "parent");
  // Вкладка из QR (?tab=psych) — первая анкета, которую этот сотрудник заполняет.
  useEffect(() => {
    if (!d) return;
    const own = staffTemplates.find(t => d.canFill[t.id])?.id || staffTemplates[0]?.id || "profile";
    // Психологу — только его сессия: профиль, анкету родителя и историю ведёт администрация.
    if (tab === "psych" || (!d.me.admission && ["profile", "parent", "history"].includes(tab))) setTab(own);
    else if (tab === "test" && !d.me.academic) setTab(d.me.admission ? "profile" : own);
    if (autoQr === "parent" && !autoShown.current && d.me.admission && d.applicant.tokens.parent) { autoShown.current = true; setQr("parent"); }
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (section) setTimeout(() => document.getElementById(`sec-${section}`)?.scrollIntoView({ behavior: "smooth" }), 400); }, [section, d]);

  if (!d) return <Modal title="Поступающий" onClose={onClose} xwide>{error ? <div className="text-sm text-rose-600">{error}</div> : <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>}</Modal>;

  const a = d.applicant;
  const grade = gradeOf(a.child.grade);
  const org = { name: String(tenant?.name || ""), logoUrl: tenantLogos(tenant).logoUrl };
  const child: PrintChild = { refNo: a.refNo, name: a.child.name, grade: a.child.grade, birthDate: a.child.birthDate };
  const print = async (make: () => Promise<string>) => { const html = await make(); if (!openHtml(html)) alert("Разрешите всплывающие окна для печати"); };
  const material = (t: QTemplate) => (m: QAttachment) => m.kind === "show" ? window.open(m.url, "_blank") : print(() => sheetHTML(org, child, { cardToken: a.tokens.card, attachment: m, templateId: t.id }));
  const mainStage = Object.values(a.stages).find(s => s.status === "done");
  const printReferral = a.referral && a.tokens.referral
    ? () => print(() => referralHTML(org, child, { token: a.tokens.referral!, examTitle: a.referral!.examTitle, psychName: mainStage?.byName || "", outcome: mainStage?.outcomeLabel || "" }))
    : undefined;
  const tabs: [string, string][] = [
    ...(d.me.admission ? [["profile", "Профиль"] as [string, string]] : []),
    ...(parentTpl && d.me.admission ? [["parent", "Анкета родителя"] as [string, string]] : []),
    ...staffTemplates.map(t => [t.id, t.title] as [string, string]),
    ...(d.me.academic ? [["test", "Тест и решение"] as [string, string]] : []),
    ...(d.me.admission ? [["history", "История"] as [string, string]] : []),
  ];
  const mark = tenantLogos(tenant).markUrl;
  const printParent = () => print(() => parentHTML(org, child, { parentToken: a.tokens.parent, cardToken: a.tokens.card, template: parentForm?.template || parentTpl! }));
  const changed = async () => { await load(); onChanged(); };
  const sessions = sessionsOf(d.forms);
  const downloadCandidate = async () => {
    setSaving(true);
    try {
      const form = d.candidateForm || NEUTRAL_CANDIDATE_FORM;
      const photo = form.showPhoto !== false ? await api(`/applicants/${a.id}/photo`).then(j => j.photo as string | null).catch(() => null) : null;
      await saveCandidate(org, candidateDoc({ form, orgName: org.name, applicant: a, parentForm: parentForm?.full ? parentForm : null, test: latestTest(d.attempts), photo }), a.child.name);
    }
    catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };
  const downloadSession = async () => {
    setSaving(true);
    try { await saveSessions(org, a, sessions); } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  return (
    <Modal title={`${a.child.name} · ${no(a.refNo)}`} onClose={onClose} xwide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="px-2 py-0.5 rounded bg-[var(--bg-surface-hover)] text-[var(--text-main)]">{a.child.grade} класс</span>
          <span className="text-[var(--text-muted)]">{STAGE_LABEL[stageOf(a, d.attempts[0] || null)]}</span>
          {mainStage && <span className={`px-2 py-0.5 rounded text-xs font-medium ${mainStage.tone ? TONE[mainStage.tone] : ""}`}>{mainStage.outcomeLabel}</span>}
          <div className="ml-auto flex flex-wrap gap-1.5">
            {d.me.academic && <button className={btn} disabled={saving} onClick={downloadCandidate}><ClipboardList className="w-4 h-4" /> Анкета кандидата</button>}
            {sessions.length > 0 && <button className={btn} disabled={saving} onClick={downloadSession}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Бланк сессии</button>}
            {d.me.admission && printReferral && <button className={btnPrimary} onClick={() => setQr("referral")}><QrCode className="w-4 h-4" /> Направление</button>}
            {d.me.admission && parentTpl && a.tokens.parent && <button className={btn} onClick={() => setQr("parent")}><QrCode className="w-4 h-4" /> Анкета родителю</button>}
          </div>
        </div>

        <div className="flex gap-1 border-b border-[var(--border-color)] overflow-x-auto hide-scrollbar">
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === k ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]"}`}>{l}</button>
          ))}
        </div>

        {qr && (
          <QrModal mark={mark} onClose={() => setQr(null)}
            title={qr === "referral" ? "Направление на тест" : "Анкета для родителя"}
            sub={`${a.child.name} · ${no(a.refNo)}${qr === "referral" && a.referral?.examTitle ? ` · ${a.referral.examTitle}` : ""}`}
            url={linkUrl(qr === "referral" ? a.tokens.referral! : a.tokens.parent)}
            onPrint={qr === "referral" ? printReferral! : printParent}
            email={qr === "referral" && d.me.admission ? <EmailResend tenantId={a.tenantId} event="referral" ctx={{ applicantId: a.id }} state={(a as any).referralEmail} onDone={changed} /> : null} />
        )}
        {tab === "profile" && <ProfileTab a={a} api={api} me={d.me} onSaved={changed} onDeleted={() => { onChanged(); onClose(); }} />}
        {tab === "parent" && parentTpl && (
          <FormTab key="parent" api={api} a={a} tpl={parentForm?.template || parentTpl} form={parentForm} canFill={!!d.canFill[parentTpl.id]} canSee={!!d.canSee[parentTpl.id] || !!parentForm?.full}
            grade={grade} onSaved={changed} onMaterial={material(parentTpl)}
            note={parentForm?.status === "done" ? (parentForm.filledBy?.kind === "parent" ? "Заполнил родитель по ссылке" : `Внесено с бумаги: ${parentForm.filledBy?.name || ""}`) : "Родитель ещё не заполнил. Анкету с QR можно распечатать кнопкой «Анкета родителю»."} />
        )}
        {staffTemplates.map(t => tab === t.id && (
          <FormTab key={t.id} api={api} a={a} tpl={d.forms.find(f => f.templateId === t.id)?.template || t} form={d.forms.find(f => f.templateId === t.id)}
            canFill={!!d.canFill[t.id]} canSee={!!d.canSee[t.id]} grade={grade} onSaved={changed} onMaterial={material(t)} staff
            referral={d.me.admission && t.outcome && a.referral ? { title: a.referral.examTitle, print: printReferral && (() => setQr("referral")) } : null}
            parent={parentForm?.full && parentForm.answers ? { template: parentForm.template, answers: parentForm.answers } : null}
            onPrintBlank={() => print(() => staffBlankHTML(org, child, { cardToken: a.tokens.card, template: t, grade }))}
            onPrintSheets={() => attachmentsFor(t, grade).filter(m => m.kind === "sheet").forEach(m => void print(() => sheetHTML(org, child, { cardToken: a.tokens.card, attachment: m, templateId: t.id })))} />
        ))}
        {tab === "test" && d.me.academic && <TestTab a={a} d={d} api={api} tenant={tenant} onSaved={changed} onDownload={downloadCandidate} />}
        {tab === "history" && (
          <ul className="text-sm divide-y divide-[var(--border-color)]">
            {d.audit.map((x: any, k: number) => <li key={k} className="py-2 flex gap-3"><span className="text-[var(--text-muted)] tabular-nums whitespace-nowrap">{new Date(x.at).toLocaleString("ru-RU")}</span><span className="flex-1"><b className="font-medium">{x.byName}</b> — {AUDIT[x.action] || x.action}{x.detail ? `: ${x.detail}` : ""}</span></li>)}
            {!d.audit.length && <li className="py-4 text-[var(--text-muted)]">Пока пусто</li>}
          </ul>
        )}
      </div>
    </Modal>
  );
}

/** QR на экране — родитель или ученик сканирует сразу; бумага — только если нужна. */
function QrModal({ title, sub, url, mark, onPrint, email, onClose }: { title: string; sub: string; url: string; mark?: string | null; onPrint: () => void; email?: React.ReactNode; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="text-sm text-[var(--text-main)]">{sub}</div>
        <div className="bg-white rounded-2xl p-3"><FancyQr value={url} size={280} logo={mark || undefined} /></div>
        <div className="text-xs text-[var(--text-muted)]">Наведите камеру телефона</div>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <button className={btn} onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}><Copy className="w-4 h-4" /> {copied ? "Скопировано" : "Ссылка"}</button>
          <button className={btn} onClick={onPrint}><Printer className="w-4 h-4" /> Печать</button>
        </div>
        {email && <div className="pt-1">{email}</div>}
      </div>
    </Modal>
  );
}

function ProfileTab({ a, api, me, onSaved, onDeleted }: { a: Applicant; api: Api; me: Me; onSaved: () => void; onDeleted: () => void }) {
  const [f, setF] = useState({ name: a.child.name, birthDate: a.child.birthDate, grade: a.child.grade, school: a.child.school || "", parentName: a.parent.name, phone: a.parent.phone, email: a.parent.email || "", note: a.note });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const canEdit = me.admission;
  const dirty = f.name !== a.child.name || f.birthDate !== a.child.birthDate || f.grade !== a.child.grade || f.school !== (a.child.school || "") || f.parentName !== a.parent.name || f.phone !== a.parent.phone || f.email !== (a.parent.email || "") || f.note !== a.note;
  const save = async () => {
    setBusy(true); setMsg(null);
    try { await api(`/applicants/${a.id}`, { method: "PUT", body: JSON.stringify({ child: { name: f.name, birthDate: f.birthDate, grade: f.grade, school: f.school }, parent: { name: f.parentName, phone: f.phone, email: f.email }, note: f.note }) }); setMsg("Сохранено"); onSaved(); }
    catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const del = async () => {
    if (!confirm(`Удалить карточку ${a.child.name} вместе с анкетами? Работы по тесту останутся в экзамене.`)) return;
    try { await api(`/applicants/${a.id}`, { method: "DELETE" }); onDeleted(); } catch (e: any) { alert(e.message); }
  };
  const relink = async (purpose: string) => {
    if (!confirm("Выпустить новый QR? Старый (на уже напечатанных бумагах) перестанет работать.")) return;
    try { await api(`/applicants/${a.id}/relink`, { method: "POST", body: JSON.stringify({ purpose }) }); onSaved(); } catch (e: any) { alert(e.message); }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <fieldset disabled={!canEdit} className="grid sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2"><span className={label}>ФИО ребёнка</span><input className={input} value={f.name} onChange={set("name")} /></div>
      <div><span className={label}>Поступает в класс</span><input className={input} value={f.grade} onChange={set("grade")} /></div>
      <div><span className={label}>Дата рождения</span><input type="date" className={input} value={f.birthDate} onChange={set("birthDate")} /></div>
      <div className="sm:col-span-2"><span className={label}>Школа, из которой переходит</span><input className={input} value={f.school} onChange={set("school")} /></div>
      <div><span className={label}>ФИО родителя</span><input className={input} value={f.parentName} onChange={set("parentName")} /></div>
      <div><span className={label}>Телефон родителя</span><input className={input} value={f.phone} onChange={set("phone")} /></div>
      <div><span className={label}>Почта родителя</span><input className={input} type="email" value={f.email} onChange={set("email")} /></div>
      <div className="sm:col-span-2"><span className={label}>Заметка</span><textarea rows={2} className={input} value={f.note} onChange={set("note")} /></div>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
        {canEdit && <button className={btnPrimary} disabled={busy || !dirty} onClick={save}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Сохранить</button>}
        {msg && <span className="text-sm text-[var(--text-muted)]">{msg}</span>}
        <span className="ml-auto" />
        {canEdit && <button className={btn} onClick={() => relink("parent")} title="Если анкету родителю отдали не тому"><RefreshCw className="w-4 h-4" /> Новый QR родителю</button>}
        {me.admission && a.tokens.referral && <button className={btn} onClick={() => relink("referral")} title="Если направление потеряли"><RefreshCw className="w-4 h-4" /> Новый QR направления</button>}
        {me.admission && <button className={`${btn} text-rose-600`} onClick={del}><Trash2 className="w-4 h-4" /> Удалить</button>}
      </div>
    </fieldset>
  );
}

/** Анкета ребёнка: автосохранение черновика, «Завершить», «Изменить». */
function FormTab({ api, a, tpl, form, canFill, canSee, grade, onSaved, onMaterial, staff, parent, note, onPrintBlank, onPrintSheets, referral }: {
  api: Api; a: Applicant; tpl: QTemplate; form?: FormDoc; canFill: boolean; canSee: boolean; grade: number | null; onSaved: () => void;
  onMaterial: (m: QAttachment) => void; staff?: boolean; parent?: { template: QTemplate; answers: QAnswers } | null; note?: string;
  onPrintBlank?: () => void; onPrintSheets?: () => void;
  /** Направление после заключения — печать прямо под бланком, без прокрутки наверх. */
  referral?: { title: string; print?: () => void } | null;
}) {
  const [answers, setAnswers] = useState<QAnswers>(form?.answers || {});
  const [outcome, setOutcome] = useState<string | null>(form?.outcome || null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paperConsent, setPaperConsent] = useState(!!form?.consent);
  const done = form?.status === "done";
  const [editing, setEditing] = useState(!done);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ answers, outcome });
  latest.current = { answers, outcome };
  const latestConsent = useRef(paperConsent);
  latestConsent.current = paperConsent;

  const save = useCallback(async (extra: Record<string, unknown> = {}) => {
    setState("saving");
    try {
      const j = await api(`/applicants/${a.id}/forms/${tpl.id}`, { method: "PUT", body: JSON.stringify({ answers: latest.current.answers, outcome: latest.current.outcome, ...(tpl.audience === "parent" ? { paperConsent: latestConsent.current } : {}), ...extra }) });
      setState("saved"); return j;
    } catch (e: any) { setState("error"); throw e; }
  }, [api, a.id, tpl.id]);
  // Черновик сохраняется сам через 1,5 с после правки; сданная анкета — только по «Сохранить».
  const touch = (next: { answers?: QAnswers; outcome?: string | null }) => {
    if (next.answers) setAnswers(next.answers);
    if (next.outcome !== undefined) setOutcome(next.outcome);
    if (done) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void save().catch(() => {}); }, 1500);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const finish = async () => {
    if (timer.current) clearTimeout(timer.current);
    setBusy(true); setError(null);
    try {
      await save({ done: true });
      setEditing(false); onSaved();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const reopen = async () => {
    setBusy(true); setError(null);
    try { await save({ reopen: true }); setEditing(true); onSaved(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  if (!canSee && !canFill) {
    const o = outcomeOf(tpl, form?.outcome);
    return (
      <div className="rounded-xl border border-[var(--border-color)] p-5 text-sm space-y-2">
        <div className="flex items-center gap-2 text-[var(--text-muted)]"><Lock className="w-4 h-4" /> Содержимое видят специалисты и администрация с правом просмотра.</div>
        <div>Статус: <b>{form?.status === "done" ? "завершена" : form ? "заполняется" : "не начата"}</b>{o && <> · Итог: <span className={`px-2 py-0.5 rounded text-xs font-medium ${TONE[o.tone]}`}>{o.label}</span></>}</div>
      </div>
    );
  }
  const readOnly = !canFill || (done && !editing);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {note && <span className="text-[var(--text-muted)]">{note}</span>}
        {done && <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-4 h-4" /> Завершена{form?.filledBy?.name ? ` · ${form.filledBy.name}` : ""}</span>}
        {!done && state !== "idle" && <span className="text-xs text-[var(--text-muted)]">{state === "saving" ? "Сохраняем…" : state === "saved" ? "Черновик сохранён" : "Не сохранилось — проверьте связь"}</span>}
        <span className="ml-auto" />
        {onPrintBlank && <button className={btn} onClick={onPrintBlank}><Printer className="w-4 h-4" /> Бланк</button>}
        {onPrintSheets && attachmentsFor(tpl, grade).some(m => m.kind === "sheet") && <button className={btn} onClick={onPrintSheets}><Printer className="w-4 h-4" /> Листы ребёнка</button>}
        {canFill && done && !editing && <button className={btn} disabled={busy} onClick={reopen}><Pencil className="w-4 h-4" /> Изменить</button>}
      </div>
      {grade === null && <div className="text-sm text-amber-700">В карточке не указан класс — вопросы и нормы по классу не подставятся.</div>}
      <FormFiller template={tpl} grade={grade} answers={answers} onChange={x => touch({ answers: x })} outcome={outcome} onOutcome={tpl.outcome ? o => touch({ outcome: o }) : undefined}
        readOnly={readOnly} parent={parent} onMaterial={onMaterial} staff={staff} />
      {tpl.audience === "parent" && canFill && (form?.filledBy?.kind !== "parent") && (
        <label className="flex items-center gap-2 text-sm text-[var(--text-main)]">
          <input type="checkbox" checked={paperConsent} disabled={readOnly || !!form?.consent} onChange={e => setPaperConsent(e.target.checked)} />
          Родитель подписал согласие на бумаге{form?.consent ? " (отмечено)" : ""}
        </label>
      )}
      {error && <div className="text-sm text-rose-600">{error}</div>}
      {canFill && (!readOnly || (done && tpl.outcome)) && (
        <div className="sticky bottom-0 bg-[var(--bg-surface)] border-t border-[var(--border-color)] -mx-4 sm:-mx-5 px-4 sm:px-5 py-3 flex flex-wrap items-center justify-end gap-2">
          {done && referral && <span className="mr-auto text-sm text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Направление выдано{referral.title ? `: ${referral.title}` : ""}</span>}
          {readOnly ? <button className={btn} disabled={busy} onClick={reopen}><Pencil className="w-4 h-4" /> Изменить</button>
            : <button className={done ? btn : btnPrimary} disabled={busy} onClick={finish}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} {done ? "Сохранить" : tpl.outcome ? "Завершить сессию" : "Сохранить анкету"}</button>}
          {done && referral?.print && <button className={btnPrimary} onClick={referral.print}><Printer className="w-4 h-4" /> Печать направления</button>}
        </div>
      )}
    </div>
  );
}

function TestTab({ a, d, api, tenant, onSaved, onDownload }: { a: Applicant; d: Data; api: Api; tenant: any; onSaved: () => void; onDownload: () => void }) {
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<{ id: string; examId: string } | null>(null);
  const [paper, setPaper] = useState<PaperResult | null>(null);
  const canManage = d.me.admission;
  /** Вручную направляет только администрация: психолог ставит итог, тест по классу выбирает система. */
  const canRefer = d.me.admission;
  const t = a.tenantId;
  const test = latestTest(d.attempts);
  const act = async (fn: () => Promise<unknown>) => { try { await fn(); onSaved(); } catch (e: any) { alert(e.message); } };
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="font-bold text-[var(--text-main)]">Направление</h3>
        {a.referral ? (
          <div className="rounded-xl border border-[var(--border-color)] p-3 text-sm flex flex-wrap items-center gap-2">
            <span>{a.referral.examTitle ? <>Тест: <b>{a.referral.examTitle}</b></> : <>Тест для {a.child.grade} класса ещё не открыт — QR заработает сам, когда экзамен включат</>} · {a.referral.manual ? `допущен: ${a.referral.byName}${a.referral.reason ? ` (${a.referral.reason})` : ""}` : "по заключению"}</span>
            {canRefer && <button className={`${btn} ml-auto`} onClick={() => confirm("Снять направление? QR перестанет открывать тест.") && act(() => api(`/applicants/${a.id}/referral`, { method: "DELETE" }))}>Снять</button>}
          </div>
        ) : <p className="text-sm text-[var(--text-muted)]">{Object.values(a.stages).some(s => s.status === "done") ? "Не выдано: заключение не пускает к тесту." : "Выдаётся само, когда специалист завершит диагностику. Тест подбирается по классу."}</p>}
        {canRefer && !a.referral && Object.values(a.stages).some(s => s.status === "done") && (
          <div className="flex flex-wrap gap-2">
            <input className={`${input} flex-1 min-w-[200px]`} placeholder="Причина (видна в истории)" value={reason} onChange={e => setReason(e.target.value)} />
            <button className={btn} onClick={() => act(() => api(`/applicants/${a.id}/referral`, { method: "POST", body: JSON.stringify({ reason }) }))}>Допустить к тесту</button>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-[var(--text-main)]">Тест</h3>
        {d.attempts.length ? d.attempts.map(x => (
          <div key={x.id} className="rounded-xl border border-[var(--border-color)] p-3 text-sm flex flex-wrap items-center gap-2">
            <b>{x.examTitle}</b><span className="text-[var(--text-muted)]">{x.paper ? "на бумаге" : `№ работы ${x.shortId}`}</span>
            <span>{x.status === "in_progress" ? "пишет сейчас" : x.status === "annulled" ? "аннулирована" : x.sections.map(p => `${p.title}: ${p.percent}%`).join(" · ") || (x.percent != null ? `${x.percent}%` : "сдан")}</span>
            {x.parts.filter(p => p.kind === "labels" || p.kind === "band").map(p => <span key={p.title} className="text-xs px-2 py-0.5 rounded bg-[var(--bg-surface-hover)]">{p.title}: {p.value}</span>)}
            <button className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20" onClick={() => setResult({ id: x.id, examId: x.examId })}>Результаты</button>
            <a className="text-[var(--accent)] text-xs inline-flex items-center gap-1 hover:underline" href={`/workspace/${t}/exams/${x.examId}`}><ExternalLink className="w-3.5 h-3.5" /> Экзамен</a>
          </div>
        )) : <p className="text-sm text-[var(--text-muted)]">{d.testExam?.paper ? "Тест пишут на бумаге в школе — внесите результаты ниже." : "Онлайн-теста ещё не было."}</p>}
        {d.testExam?.paper && canManage && <PaperTestForm key={d.testExam.id + (test?.finishedAt || 0)} exam={d.testExam} prev={d.attempts.find(x => x.paper && x.examId === d.testExam!.id) || null}
          onSave={(rows, photo) => act(() => api(`/applicants/${a.id}/paper-test`, { method: "POST", body: JSON.stringify({ examId: d.testExam!.id, rows, ...(photo ? { photo } : {}) }) }))} />}
        {a.paperResults.map(p => (
          <div key={p.id} className="rounded-xl border border-[var(--border-color)] p-3 text-sm">
            <div className="flex items-center gap-2"><b>{p.title}</b><span className="text-xs text-[var(--text-muted)]">на бумаге · {p.byName} · {new Date(p.at).toLocaleDateString("ru-RU")}</span>
              {canManage && <><button className="ml-auto text-xs text-[var(--accent)]" onClick={() => setPaper(p)}>Изменить</button><button className="text-xs text-rose-600" onClick={() => confirm("Удалить результаты?") && act(() => api(`/applicants/${a.id}/paper/${p.id}`, { method: "DELETE" }))}>Удалить</button></>}
            </div>
            <div className="mt-1 text-[var(--text-main)]">{p.rows.map(r => `${r.subject}: ${r.score ?? "—"}${r.max != null ? ` / ${r.max}` : ""}`).join(" · ")}</div>
            {p.comment && <div className="text-xs text-[var(--text-muted)] mt-0.5">{p.comment}</div>}
          </div>
        ))}
        {canManage && !d.testExam && <button className={btn} onClick={() => setPaper({ id: "", title: "Тест на бумаге", rows: [{ subject: "", score: null, max: null }], comment: "", at: 0, byName: "" })}>Внести результаты на бумаге</button>}
      </section>

      <CandidateEditor a={a} me={d.me} test={test} cfg={d.candidateForm || NEUTRAL_CANDIDATE_FORM} canManage={canManage} onDownload={onDownload}
        onSave={c => act(() => api(`/applicants/${a.id}/candidate`, { method: "PUT", body: JSON.stringify(c) }))} />

      {result && <AttemptViewer tenant={tenant} attemptId={result.id} examId={result.examId} onClose={() => setResult(null)} onChanged={onSaved} />}
      {paper && <PaperModal p={paper} onClose={() => setPaper(null)} onSave={async x => { await api(`/applicants/${a.id}/paper`, { method: "POST", body: JSON.stringify(x) }); setPaper(null); onSaved(); }} />}
    </div>
  );
}

/**
 * Тест на бумаге: правильные ответы по предметам. «Из скольки» вводится один
 * раз на предмет и класс — дальше система помнит его в экзамене.
 */
/** Снимок с камеры или из файла → JPEG до 480 px (на сервер — до 300 КБ). */
async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const k = Math.min(1, 480 / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  } finally { URL.revokeObjectURL(url); }
}

function PaperTestForm({ exam, prev, onSave }: { exam: TestExam; prev: TestSummary | null; onSave: (rows: { sectionId: string; correct: number; tasks: number }[], photo: string | null) => Promise<void> }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [rows, setRows] = useState(() => exam.sections.map(s => ({
    sectionId: s.id, title: s.title, tasks: s.tasks ? String(s.tasks) : "", editTasks: !s.tasks,
    correct: String(prev?.sections.find(x => x.id === s.id)?.correct ?? ""),
  })));
  const [busy, setBusy] = useState(false);
  const set = (i: number, p: Partial<(typeof rows)[number]>) => setRows(xs => xs.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const ready = rows.every(r => r.correct !== "" && Number(r.tasks) > 0);
  return (
    <div className="rounded-xl border border-[var(--border-color)] p-3 space-y-2">
      <div className="text-sm font-semibold text-[var(--text-main)]">{exam.title} · правильных ответов</div>
      {rows.map((r, i) => (
        <div key={r.sectionId} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-40 text-[var(--text-main)]">{r.title}</span>
          <input type="number" min={0} max={Number(r.tasks) || undefined} inputMode="numeric" className={`${input} !w-20`} value={r.correct} onChange={e => set(i, { correct: e.target.value })} aria-label={`${r.title}: правильных`} />
          <span className="text-[var(--text-muted)]">из</span>
          {r.editTasks
            ? <input type="number" min={1} inputMode="numeric" className={`${input} !w-20`} value={r.tasks} placeholder="N" onChange={e => set(i, { tasks: e.target.value })} aria-label={`${r.title}: заданий`} />
            : <button type="button" className="inline-flex items-center gap-1 text-[var(--text-main)] hover:text-[var(--accent)]" onClick={() => set(i, { editTasks: true })} title="Изменить число заданий">{r.tasks} <Pencil className="w-3 h-3" /></button>}
          {Number(r.tasks) > 0 && r.correct !== "" && <span className="text-xs text-[var(--text-muted)]">{String(Math.round((Number(r.correct) / Number(r.tasks)) * 1000) / 10).replace(".", ",")}%</span>}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${btn} cursor-pointer`}>
          <Camera className="w-4 h-4" /> {photo ? "Другое фото" : "Фото ученика"}
          <input type="file" accept="image/*" capture="user" className="hidden" onChange={async e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setPhoto(await shrinkPhoto(f).catch(() => null)); }} />
        </label>
        {photo && <img src={photo} alt="" className="w-10 h-12 object-cover rounded border border-[var(--border-color)]" />}
        <button className={btnPrimary} disabled={busy || !ready} onClick={async () => { setBusy(true); try { await onSave(rows.map(r => ({ sectionId: r.sectionId, correct: Number(r.correct), tasks: Number(r.tasks) })), photo); } finally { setBusy(false); } }}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {prev ? "Сохранить изменения" : "Сохранить результаты"}
        </button>
      </div>
    </div>
  );
}

type CandidateDraft = Omit<CandidateInfo, "by" | "at" | "decisionLabel" | "decisionFinal">;
/** Заключение, обратная связь, решение и условия — поля и варианты из анкеты кандидата организации. */
function CandidateEditor({ a, me, test, cfg, canManage, onSave, onDownload }: {
  a: Applicant; me: Me; test: TestSummary | null; cfg: CandidateFormConfig; canManage: boolean;
  onSave: (c: CandidateDraft) => Promise<void>; onDownload: () => void;
}) {
  const c = a.candidate;
  const [f, setF] = useState<CandidateDraft>(() => ({
    responsible: c?.responsible || me.name || "", conclusion: c?.conclusion || "", feedback: c?.feedback || "", feedbackGiven: !!c?.feedbackGiven,
    decision: c?.decision || null, trialFrom: c?.trialFrom || "", trialTo: c?.trialTo || "", klass: c?.klass || a.child.grade || "",
    reviewDate: c?.reviewDate || "", parentNotified: c?.parentNotified ?? null, nextContact: c?.nextContact || "",
  }));
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof f>) => setF(x => ({ ...x, ...p }));
  const auto = test ? topicFeedback(test.topics, cfg.topics) : "";
  const trial = !!cfg.decisions.find(x => x.id === f.decision)?.trial;
  const chip = (on: boolean) => `px-3 py-1.5 rounded-full text-sm font-medium border ${on ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border-color)] text-[var(--text-main)]"}`;
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold text-[var(--text-main)]">Анкета кандидата</h3>
        <button className={`${btn} ml-auto`} onClick={onDownload}><Download className="w-4 h-4" /> PDF</button>
      </div>
      <fieldset disabled={!canManage} className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><span className={label}>Ответственный</span><input className={input} value={f.responsible} onChange={e => set({ responsible: e.target.value })} /></div>
          <div><span className={label}>Общий результат / заключение</span><input className={input} value={f.conclusion} onChange={e => set({ conclusion: e.target.value })} placeholder={test ? test.parts.map(p => `${p.title}: ${p.value}`).join(", ") || `${test.percent ?? ""}%` : ""} /></div>
        </div>
        <div>
          <div className="flex items-end justify-between gap-2">
            <span className={label}>Обратная связь родителю / подробное примечание</span>
            {auto && <button type="button" className="text-xs text-[var(--accent)] hover:underline mb-1" onClick={() => set({ feedback: f.feedback ? `${f.feedback}\n${auto}` : auto })}>Из разбора по темам</button>}
          </div>
          <textarea rows={4} className={input} value={f.feedback} onChange={e => set({ feedback: e.target.value })} placeholder={auto || cfg.feedbackHint} />
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--text-main)]"><input type="checkbox" checked={f.feedbackGiven} onChange={e => set({ feedbackGiven: e.target.checked })} /> Обратная связь дана — ученик видит результаты по QR</label>
        <div>
          <span className={label}>Решение по кандидату</span>
          <div className="flex flex-wrap gap-1.5">{cfg.decisions.map(v => <button key={v.id} type="button" className={chip(f.decision === v.id)} onClick={() => set({ decision: f.decision === v.id ? null : v.id })}>{v.label}</button>)}</div>
        </div>
        <div className="grid sm:grid-cols-4 gap-3">
          {trial && <>
            <div><span className={label}>Пробный период с</span><input type="date" className={input} value={f.trialFrom} onChange={e => set({ trialFrom: e.target.value })} /></div>
            <div><span className={label}>по</span><input type="date" className={input} value={f.trialTo} onChange={e => set({ trialTo: e.target.value })} /></div>
          </>}
          {cfg.extras.klass && <div><span className={label}>Класс</span><input className={input} value={f.klass} onChange={e => set({ klass: e.target.value })} /></div>}
          {cfg.extras.reviewDate && <div><span className={label}>Повторное рассмотрение</span><input type="date" className={input} value={f.reviewDate} onChange={e => set({ reviewDate: e.target.value })} /></div>}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {cfg.extras.parentNotified && <div>
            <span className={label}>Родитель уведомлён об условиях</span>
            <div className="flex gap-1.5">{([[true, "Да"], [false, "Нет"]] as const).map(([v, l]) => <button key={l} type="button" className={chip(f.parentNotified === v)} onClick={() => set({ parentNotified: f.parentNotified === v ? null : v })}>{l}</button>)}</div>
          </div>}
          {cfg.extras.nextContact && <div><span className={label}>Следующий контакт</span><input className={input} value={f.nextContact} onChange={e => set({ nextContact: e.target.value })} /></div>}
        </div>
        {canManage && <button className={btnPrimary} disabled={busy} onClick={async () => { setBusy(true); try { await onSave(f); } finally { setBusy(false); } }}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Сохранить анкету</button>}
        {c?.at ? <span className="ml-3 text-xs text-[var(--text-muted)]">{c.by} · {new Date(c.at).toLocaleString("ru-RU")}</span> : null}
      </fieldset>
    </section>
  );
}

function PaperModal({ p, onClose, onSave }: { p: PaperResult; onClose: () => void; onSave: (p: PaperResult) => Promise<void> }) {
  const [x, setX] = useState<PaperResult>(p);
  const [busy, setBusy] = useState(false);
  const row = (k: number, patch: Partial<PaperResult["rows"][number]>) => setX({ ...x, rows: x.rows.map((r, j) => (j === k ? { ...r, ...patch } : r)) });
  const num = (v: string) => (v === "" ? null : Number(v));
  return (
    <Modal title="Результаты теста на бумаге" onClose={onClose}>
      <div className="space-y-3">
        <div><span className={label}>Название</span><input className={input} value={x.title} onChange={e => setX({ ...x, title: e.target.value })} /></div>
        <div className="space-y-1.5">
          <span className={label}>Предметы</span>
          {x.rows.map((r, k) => (
            <div key={k} className="flex gap-1.5">
              <input className={`${input} flex-1`} placeholder="Предмет" value={r.subject} onChange={e => row(k, { subject: e.target.value })} />
              <input className={`${input} !w-20`} type="number" placeholder="Балл" value={r.score ?? ""} onChange={e => row(k, { score: num(e.target.value) })} />
              <input className={`${input} !w-20`} type="number" placeholder="Из" value={r.max ?? ""} onChange={e => row(k, { max: num(e.target.value) })} />
              <button className={btn} onClick={() => setX({ ...x, rows: x.rows.filter((_, j) => j !== k) })}><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button className={btn} onClick={() => setX({ ...x, rows: [...x.rows, { subject: "", score: null, max: null }] })}>+ Предмет</button>
        </div>
        <div><span className={label}>Комментарий</span><textarea rows={2} className={input} value={x.comment} onChange={e => setX({ ...x, comment: e.target.value })} /></div>
        <div className="flex justify-end gap-2">
          <button className={btn} onClick={onClose}>Отмена</button>
          <button className={btnPrimary} disabled={busy || !x.rows.some(r => r.subject.trim())} onClick={async () => { setBusy(true); try { await onSave(x); } catch (e: any) { alert(e.message); setBusy(false); } }}>Сохранить</button>
        </div>
      </div>
    </Modal>
  );
}
