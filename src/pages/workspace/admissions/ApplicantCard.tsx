import EmailResend from "../../../components/workspace/EmailResend";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLive } from "../../../lib/useLive";
import { Archive, ArchiveRestore, Camera, CheckCircle2, ClipboardList, Copy, Download, ExternalLink, History, Loader2, Lock, Pencil, Printer, QrCode, RefreshCw, RotateCcw, ShieldAlert, Trash2, Undo2 } from "lucide-react";
import FormFiller from "../../../components/admissions/FormFiller";
import { STAGE_LABEL, stageOf, type Applicant, type CandidateInfo, type PaperResult } from "../../../shared/admissions";
import { NEUTRAL_CANDIDATE_FORM, type CandidateFormConfig } from "../../../shared/candidateForm";
import { attachmentsFor, gradeOf, outcomeOf, type QAnswers, type QAttachment, type QTemplate } from "../../../shared/questionnaires";
import { tenantLogos } from "../../../shared/legal";
import { linkUrl, openHtml, parentHTML, referralHTML, sheetHTML, staffBlankHTML, type PrintChild } from "../../../lib/admissionPrint";
import FancyQr from "../../../components/forms/FancyQr";
import { Modal, btn, btnPrimary, input, label } from "../journals/components/ui";
import { Button, confirmDialog, toast } from "../../../components/ui";
import { TONE, type Api, type Me } from "./admissionApi";
import { saveSessions, sessionsOf } from "./sessionPdf";
import AttemptViewer from "../exams/AttemptViewer";
import ProctoringDossier from "../../../components/ProctoringDossier";
import { useExamApi } from "../exams/examApi";
import { latestTest, type TestSummary } from "./candidateForm";
import CandidateSheetModal from "./CandidateSheetModal";
import HistoryModal from "./HistoryModal";
import { PublishWhenModal, SplitPublishButton, whenShort } from "./PublishControls";

/**
 * Карточка поступающего. Вкладки — по правам: тот, кто проводит анкеты, открывает
 * свою, приёмная — профиль, направление и тест; содержимое анкет с
 * данными о здоровье приходит с сервера только тем, кому разрешено.
 */
interface FormDoc { id: string; templateId: string; status: "draft" | "done"; outcome: string | null; outcomeLabel?: string; full: boolean; template: QTemplate; answers?: QAnswers; grade?: number | null; filledBy?: { kind: string; name: string }; doneAt?: number | null; consent?: unknown }
/** Работа в карточке: итог — всем, анкета с экзамена и прокторинг — только с правом на экзамены (examAccess). */
interface CardAttempt extends TestSummary {
  id: string; examId: string; shortId: string; startedAt?: number;
  examAccess?: boolean; levelLabel?: string; earned?: number | null; max?: number | null; reviewDone?: boolean; published?: boolean;
  student?: { name: string; level: string; phone: string; email: string };
  extraRows?: { label: string; value: string }[];
  proctoring?: { enabled: boolean; totalViolations: number };
}
interface TestExam { id: string; title: string; paper: boolean; sections: { id: string; title: string; tasks: number }[] }
interface Data {
  applicant: Applicant; forms: FormDoc[]; attempts: CardAttempt[]; audit: any[];
  templates: QTemplate[]; canFill: Record<string, boolean>; canSee: Record<string, boolean>; me: Me;
  testExam: TestExam | null;
  resultDelivery?: { delivery: "email" | "page"; sendOn: "publish" | "manual" } | null;
  candidateForm: CandidateFormConfig | null;
  parentPrefill?: QAnswers | null;
}
const no = (n: number) => `№ ${String(n).padStart(4, "0")}`;

export default function ApplicantCard({ id, api, tenant, initialTab, section, autoQr, staffMode, onClose, onChanged }: {
  id: string; api: Api; tenant: any; initialTab?: string; section?: string;
  /** «Мои анкеты»: только свои анкеты, даже у того, у кого есть и права приёма. */
  staffMode?: boolean;
  /** Сразу показать QR (после «Завести» — анкета для родителя). */
  autoQr?: "parent";
  onClose: () => void; onChanged: () => void;
}) {
  const [qr, setQr] = useState<null | "referral" | "parent">(null);
  const [sheet, setSheet] = useState<null | { edit?: boolean }>(null);
  const [history, setHistory] = useState(false);
  const autoShown = useRef(false);
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<string>(section && section !== "parent" ? section : section === "parent" ? "parent" : initialTab || "profile");

  const load = useCallback(async () => {
    try {
      const j = await api(`/applicants/${id}`);
      if (staffMode) j.me = { ...j.me, admission: false, academic: false };
      setD(j); setError(null);
    } catch (e: any) { setError(e.message); }
  }, [api, id, staffMode]);
  useEffect(() => { void load(); }, [load]);
  // Изменения этого ребёнка (кто угодно, тест, родитель) — карточка обновляется сама.
  // Черновики анкет не сбиваются: у вкладок свои состояния.
  useLive(tenant?.id, ["admissions"], m => { if (!m || !m.id || m.id === id) void load(); });
  // Пришло уведомление про этого ребёнка — карточка обновляется сама.
  useEffect(() => {
    const on = (e: Event) => { if ((e as CustomEvent).detail?.applicantId === id) void load(); };
    window.addEventListener("sf:notification", on);
    return () => window.removeEventListener("sf:notification", on);
  }, [id, load]);
  const [saving, setSaving] = useState(false);
  const profileDirty = useRef(false); // до раннего return — порядок хуков не меняется

  const staffTemplates = useMemo(() => (d?.templates || []).filter(t => t.audience === "staff" && (d!.canFill[t.id] || d!.canSee[t.id] || d!.forms.some(f => f.templateId === t.id))), [d]);
  const parentTpl = d?.templates.find(t => t.audience === "parent");
  const parentForm = d?.forms.find(f => f.template.audience === "parent");
  // Вкладка из QR (?ctab=own; прежнее psych) — первая анкета, которую этот сотрудник заполняет.
  useEffect(() => {
    if (!d) return;
    const own = staffTemplates.find(t => d.canFill[t.id])?.id || staffTemplates[0]?.id || "profile";
    // Исполнителю анкет — только его анкеты: профиль, анкету родителя и историю ведёт администрация.
    if (tab === "own" || tab === "psych" || (!d.me.admission && ["profile", "parent", "history"].includes(tab))) setTab(own);
    else if (tab === "test" && !d.me.academic) setTab(d.me.admission ? "profile" : own);
    if (autoQr === "parent" && !autoShown.current && d.me.admission && d.applicant.tokens.parent) { autoShown.current = true; setQr("parent"); }
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (section) setTimeout(() => document.getElementById(`sec-${section}`)?.scrollIntoView({ behavior: "smooth" }), 400); }, [section, d]);

  if (!d) return <Modal title="Поступающий" onClose={onClose} xwide>{error ? <div className="text-sm text-rose-600">{error}</div> : <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>}</Modal>;

  const a = d.applicant;
  const grade = gradeOf(a.child.grade);
  const org = { name: String(tenant?.name || ""), logoUrl: tenantLogos(tenant).logoUrl };
  const child: PrintChild = { refNo: a.refNo, name: a.child.name, grade: a.child.grade, birthDate: a.child.birthDate };
  const print = async (make: () => Promise<string>) => { const html = await make(); if (!openHtml(html)) toast.error("Разрешите всплывающие окна для печати"); };
  const material = (t: QTemplate) => (m: QAttachment) => m.kind === "show" ? window.open(m.url, "_blank") : print(() => sheetHTML(org, child, { cardToken: a.tokens.card, attachment: m, templateId: t.id }));
  const mainStage = Object.values(a.stages).find(s => s.status === "done");
  const printReferral = a.referral && a.tokens.referral
    ? () => print(() => referralHTML(org, child, { token: a.tokens.referral!, examTitle: a.referral!.examTitle, specialistName: mainStage?.byName || "", outcome: mainStage?.outcomeLabel || "" }))
    : undefined;
  const tabs: [string, string][] = [
    ...(d.me.admission ? [["profile", "Профиль"] as [string, string]] : []),
    ...(parentTpl && d.me.admission ? [["parent", "Анкета родителя"] as [string, string]] : []),
    ...staffTemplates.map(t => [t.id, t.title] as [string, string]),
    ...(d.me.academic ? [["test", "Тест и решение"] as [string, string]] : []),
  ];
  const mark = tenantLogos(tenant).markUrl;
  const printParent = () => print(() => parentHTML(org, child, { parentToken: a.tokens.parent, cardToken: a.tokens.card, template: parentForm?.template || parentTpl! }));
  const changed = async () => { await load(); onChanged(); };
  const sessions = sessionsOf(d.forms);
  const downloadSession = async () => {
    setSaving(true);
    try { await saveSessions(org, a, sessions); } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  // Несохранённая правка профиля: закрыть окно — только после вопроса. Черновики анкет сохраняются сами.
  const guardedClose = async () => {
    if (profileDirty.current && !(await confirmDialog({ title: "Закрыть без сохранения?", message: "Правки профиля не сохранены.", confirmLabel: "Закрыть", danger: true }))) return;
    onClose();
  };

  return (
    <Modal title={`${a.child.name} · ${no(a.refNo)}`} onClose={guardedClose} xwide>
      <div className="space-y-4">
        {a.archived && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm flex flex-wrap items-center gap-2 text-[var(--text-main)]">
            <Archive className="w-4 h-4 text-amber-600" /> В архиве{a.archived.byName ? ` · ${a.archived.byName}` : ""}, {new Date(a.archived.at).toLocaleDateString("ru-RU")}
            {d.me.admission && <Button className="ml-auto" size="sm" icon={<ArchiveRestore className="w-3.5 h-3.5" />} onClick={async () => { try { await api(`/applicants/${a.id}/restore`, { method: "POST" }); toast.success("Карточка возвращена"); await changed(); } catch (e: any) { toast.error(e.message); } }}>Вернуть</Button>}
            {d.me.owner && <Button size="sm" variant="danger" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={async () => {
              if (!(await confirmDialog({ title: `Удалить навсегда: ${a.child.name}`, message: "Анкеты, ссылки, работы и история будут стёрты.", confirmLabel: "Удалить навсегда", danger: true }))) return;
              try { await api(`/applicants/${a.id}?purge=1`, { method: "DELETE" }); toast.success("Удалено"); onChanged(); onClose(); } catch (e: any) { toast.error(e.message); }
            }}>Удалить навсегда</Button>}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="px-2 py-0.5 rounded bg-[var(--bg-surface-hover)] text-[var(--text-main)]">{a.child.grade} класс</span>
          <span className="text-[var(--text-muted)]">{STAGE_LABEL[stageOf(a, d.attempts[0] || null)]}</span>
          {mainStage && <span className={`px-2 py-0.5 rounded text-xs font-medium ${mainStage.tone ? TONE[mainStage.tone] : ""}`}>{mainStage.outcomeLabel}</span>}
          <div className="ml-auto flex flex-wrap gap-1.5">
            {d.me.academic && <button className={btn} onClick={() => setSheet({})}><ClipboardList className="w-4 h-4" /> Анкета кандидата</button>}
            {d.me.admission && <button className={btn} onClick={() => setHistory(true)}><History className="w-4 h-4" /> История</button>}
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
            email={d.me.admission ? <EmailResend tenantId={a.tenantId} event={qr === "referral" ? "referral" : "parent_form"} ctx={{ applicantId: a.id }} state={qr === "referral" ? (a as any).referralEmail : (a as any).parentFormEmail} onDone={changed} /> : null} />
        )}
        {tab === "profile" && <ProfileTab a={a} api={api} me={d.me} dirtyRef={profileDirty} onSaved={changed} onArchived={() => { onChanged(); onClose(); }} />}
        {tab === "parent" && parentTpl && (
          <FormTab key="parent" api={api} a={a} tpl={parentForm?.template || parentTpl} form={parentForm} prefill={d.parentPrefill} canFill={!!d.canFill[parentTpl.id]} canSee={!!d.canSee[parentTpl.id] || !!parentForm?.full}
            grade={grade} onSaved={changed} onMaterial={material(parentTpl)}
            note={parentForm?.status === "done" ? (parentForm.filledBy?.kind === "parent" ? "Заполнил родитель по ссылке" : `Внесено с бумаги: ${parentForm.filledBy?.name || ""}`) : "Родитель ещё не заполнил. Анкету с QR можно распечатать кнопкой «Анкета родителю»."} />
        )}
        {tab === "parent" && parentTpl && parentForm && d.me.admission && !a.archived && (
          <div className="flex justify-end border-t border-[var(--border-color)] pt-3">
            <Button variant="danger" size="sm" icon={<RotateCcw className="w-3.5 h-3.5" />} onClick={async () => {
              if (!(await confirmDialog({ title: "Очистить анкету родителя и выдать заново?", message: "Ответы уйдут в архив, ссылка родителя откроет пустую анкету.", confirmLabel: "Очистить и выдать", danger: true }))) return;
              try { await api(`/applicants/${a.id}/parent-form/reset`, { method: "POST", body: JSON.stringify({}) }); toast.success("Анкета очищена — отправьте ссылку родителю"); await changed(); setQr("parent"); }
              catch (e: any) { toast.error(e.message); }
            }}>Очистить и выдать заново</Button>
          </div>
        )}
        {staffTemplates.map(t => tab === t.id && (
          <FormTab key={t.id} api={api} a={a} tpl={d.forms.find(f => f.templateId === t.id)?.template || t} form={d.forms.find(f => f.templateId === t.id)}
            canFill={!!d.canFill[t.id]} canSee={!!d.canSee[t.id]} grade={grade} onSaved={changed} onMaterial={material(t)} staff
            referral={d.me.admission && t.outcome && a.referral ? { title: a.referral.examTitle, print: printReferral && (() => setQr("referral")) } : null}
            parent={parentForm?.full && parentForm.answers ? { template: parentForm.template, answers: parentForm.answers } : null}
            onPrintBlank={() => print(() => staffBlankHTML(org, child, { cardToken: a.tokens.card, template: t, grade }))}
            onPrintSheets={() => attachmentsFor(t, grade).filter(m => m.kind === "sheet").forEach(m => void print(() => sheetHTML(org, child, { cardToken: a.tokens.card, attachment: m, templateId: t.id })))} />
        ))}
        {tab === "test" && d.me.academic && <TestTab a={a} d={d} api={api} tenant={tenant} onSaved={changed} onOpenSheet={() => setSheet({ edit: d.me.admission })} />}
      </div>
      {sheet && <CandidateSheetModal applicantId={a.id} api={api} tenant={tenant} startEditing={sheet.edit} onClose={() => setSheet(null)} onChanged={changed} />}
      {history && <HistoryModal api={api} applicantId={a.id} onClose={() => setHistory(false)} />}
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

function ProfileTab({ a, api, me, dirtyRef, onSaved, onArchived }: { a: Applicant; api: Api; me: Me; dirtyRef: React.MutableRefObject<boolean>; onSaved: () => void; onArchived: () => void }) {
  const [f, setF] = useState({ name: a.child.name, birthDate: a.child.birthDate, grade: a.child.grade, school: a.child.school || "", childPhone: a.child.phone || "", childEmail: a.child.email || "", parentName: a.parent.name, phone: a.parent.phone, email: a.parent.email || "", note: a.note });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const canEdit = me.admission && !a.archived;
  const dirty = f.name !== a.child.name || f.birthDate !== a.child.birthDate || f.grade !== a.child.grade || f.school !== (a.child.school || "") || f.childPhone !== (a.child.phone || "") || f.childEmail !== (a.child.email || "") || f.parentName !== a.parent.name || f.phone !== a.parent.phone || f.email !== (a.parent.email || "") || f.note !== a.note;
  dirtyRef.current = canEdit && dirty;
  useEffect(() => () => { dirtyRef.current = false; }, [dirtyRef]);
  const save = async () => {
    setBusy(true); setMsg(null);
    try { await api(`/applicants/${a.id}`, { method: "PUT", body: JSON.stringify({ child: { name: f.name, birthDate: f.birthDate, grade: f.grade, school: f.school, phone: f.childPhone, email: f.childEmail }, parent: { name: f.parentName, phone: f.phone, email: f.email }, note: f.note }) }); toast.success("Сохранено"); onSaved(); }
    catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const archive = async () => {
    if (!(await confirmDialog({ title: `Убрать в архив: ${a.child.name}`, message: "Карточку можно вернуть из архива.", confirmLabel: "В архив" }))) return;
    try { await api(`/applicants/${a.id}`, { method: "DELETE" }); toast.success("Убрано в архив"); onArchived(); } catch (e: any) { toast.error(e.message); }
  };
  const relink = async (purpose: string) => {
    if (!(await confirmDialog({ title: "Выпустить новый QR?", message: "Старый, на уже напечатанных бумагах, перестанет работать.", confirmLabel: "Выпустить" }))) return;
    try { await api(`/applicants/${a.id}/relink`, { method: "POST", body: JSON.stringify({ purpose }) }); onSaved(); } catch (e: any) { toast.error(e.message); }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <fieldset disabled={!canEdit} className="grid sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2"><span className={label}>ФИО ребёнка</span><input className={input} value={f.name} onChange={set("name")} /></div>
      <div><span className={label}>Поступает в класс</span><input className={input} value={f.grade} onChange={set("grade")} /></div>
      <div><span className={label}>Дата рождения</span><input type="date" className={input} value={f.birthDate} onChange={set("birthDate")} /></div>
      <div className="sm:col-span-2"><span className={label}>Школа, из которой переходит</span><input className={input} value={f.school} onChange={set("school")} /></div>
      <div><span className={label}>Телефон ученика</span><input className={input} value={f.childPhone} onChange={set("childPhone")} /></div>
      <div><span className={label}>Почта ученика</span><input className={input} type="email" value={f.childEmail} onChange={set("childEmail")} /></div>
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
        {canEdit && <button className={btn} onClick={archive}><Archive className="w-4 h-4" /> В архив</button>}
      </div>
    </fieldset>
  );
}

/** Анкета ребёнка: автосохранение черновика, «Завершить», «Изменить». */
function FormTab({ api, a, tpl, form, prefill, canFill, canSee, grade, onSaved, onMaterial, staff, parent, note, onPrintBlank, onPrintSheets, referral }: {
  api: Api; a: Applicant; tpl: QTemplate; form?: FormDoc; /** Что уже известно, пока анкету не начинали. */ prefill?: QAnswers | null; canFill: boolean; canSee: boolean; grade: number | null; onSaved: () => void;
  onMaterial: (m: QAttachment) => void; staff?: boolean; parent?: { template: QTemplate; answers: QAnswers } | null; note?: string;
  onPrintBlank?: () => void; onPrintSheets?: () => void;
  /** Направление после заключения — печать прямо под бланком, без прокрутки наверх. */
  referral?: { title: string; print?: () => void } | null;
}) {
  const [answers, setAnswers] = useState<QAnswers>(form?.answers || prefill || {});
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

  // Есть правка, которая ещё не ушла на сервер.
  const pending = useRef(false);
  const save = useCallback(async (extra: Record<string, unknown> = {}) => {
    setState("saving");
    pending.current = false;
    try {
      const j = await api(`/applicants/${a.id}/forms/${tpl.id}`, { method: "PUT", body: JSON.stringify({ answers: latest.current.answers, outcome: latest.current.outcome, ...(tpl.audience === "parent" ? { paperConsent: latestConsent.current } : {}), ...extra }) });
      setState("saved"); return j;
    } catch (e: any) { pending.current = true; setState("error"); throw e; }
  }, [api, a.id, tpl.id]);
  const saveRef = useRef(save);
  saveRef.current = save;
  // Черновик сохраняется сам через 1,5 с после правки; сданная анкета — по «Сохранить»
  // (а при уходе со вкладки, закрытии окна и страницы — как есть, статус не меняется).
  const touch = (next: { answers?: QAnswers; outcome?: string | null }) => {
    if (next.answers) setAnswers(next.answers);
    if (next.outcome !== undefined) setOutcome(next.outcome);
    pending.current = true;
    if (done) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void save().catch(() => {}); }, 1500);
  };
  // Смена вкладки, закрытие окна, уход со страницы или из приложения — правка не теряется.
  useEffect(() => {
    const flush = () => { if (timer.current) clearTimeout(timer.current); if (pending.current) void saveRef.current().catch(() => {}); };
    const leave = (e: BeforeUnloadEvent) => { if (pending.current) { flush(); e.preventDefault(); e.returnValue = ""; } };
    const hide = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("beforeunload", leave); document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("beforeunload", leave); document.removeEventListener("visibilitychange", hide); flush(); };
  }, []);

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

function TestTab({ a, d, api, tenant, onSaved, onOpenSheet }: { a: Applicant; d: Data; api: Api; tenant: any; onSaved: () => void; onOpenSheet: () => void }) {
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<{ id: string; examId: string } | null>(null);
  const [paper, setPaper] = useState<PaperResult | null>(null);
  const canManage = d.me.admission;
  /** Вручную направляет только администрация: специалист ставит итог, тест по классу выбирает система. */
  const canRefer = d.me.admission;
  const t = a.tenantId;
  const test = latestTest(d.attempts);
  const act = async (fn: () => Promise<unknown>) => { try { await fn(); onSaved(); } catch (e: any) { toast.error(e.message); } };
  const [revoke, setRevoke] = useState(false);
  const blocked = a.referralBlocked;
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="font-bold text-[var(--text-main)]">Направление</h3>
        {a.referral ? (
          <div className="rounded-xl border border-[var(--border-color)] p-3 text-sm flex flex-wrap items-center gap-2">
            <span>{a.referral.examTitle ? <>Тест: <b>{a.referral.examTitle}</b></> : <>Тест для {a.child.grade} класса ещё не открыт — QR заработает сам, когда экзамен включат</>} · {a.referral.manual ? `допущен: ${a.referral.byName}${a.referral.reason ? ` (${a.referral.reason})` : ""}` : "по заключению"}</span>
            {canRefer && !a.archived && <button className={`${btn} ml-auto`} onClick={() => setRevoke(true)}>Снять</button>}
          </div>
        ) : blocked ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm flex flex-wrap items-center gap-2 text-[var(--text-main)]">
            <span>Направление снято: {blocked.byName}{blocked.reason ? ` (${blocked.reason})` : ""}, {new Date(blocked.at).toLocaleDateString("ru-RU")}</span>
            {canRefer && !a.archived && <Button className="ml-auto" size="sm" icon={<Undo2 className="w-3.5 h-3.5" />} onClick={() => act(async () => { await api(`/applicants/${a.id}/referral/restore`, { method: "POST" }); toast.success("Направление возвращено"); })}>Вернуть</Button>}
          </div>
        ) : <span className="text-sm text-[var(--text-muted)]">{Object.values(a.stages).some(s => s.status === "done") ? "Не выдано: заключение не пускает к тесту" : "Не выдано"}</span>}
        {revoke && <RevokeModal onClose={() => setRevoke(false)} onSave={async reason => { await api(`/applicants/${a.id}/referral`, { method: "DELETE", body: JSON.stringify({ reason }) }); toast.success("Направление снято"); setRevoke(false); onSaved(); }} />}
        {canRefer && !a.referral && !a.archived && Object.values(a.stages).some(s => s.status === "done") && (
          <div className="flex flex-wrap gap-2">
            <input className={`${input} flex-1 min-w-[200px]`} placeholder="Причина (видна в истории)" value={reason} onChange={e => setReason(e.target.value)} />
            <button className={btn} onClick={() => act(() => api(`/applicants/${a.id}/referral`, { method: "POST", body: JSON.stringify({ reason }) }))}>Допустить к тесту</button>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-[var(--text-main)]">Тест</h3>
        {d.attempts.length ? d.attempts.map(x => <AttemptBlock key={x.id} x={x} tenantId={t} onOpen={() => setResult({ id: x.id, examId: x.examId })} />) : <p className="text-sm text-[var(--text-muted)]">{d.testExam?.paper ? "Тест пишут на бумаге в школе — внесите результаты ниже." : "Онлайн-теста ещё не было."}</p>}
        {d.testExam?.paper && canManage && <PaperTestForm key={d.testExam.id + (test?.finishedAt || 0)} exam={d.testExam} prev={d.attempts.find(x => x.paper && x.examId === d.testExam!.id) || null}
          onSave={(rows, photo) => act(() => api(`/applicants/${a.id}/paper-test`, { method: "POST", body: JSON.stringify({ examId: d.testExam!.id, rows, ...(photo ? { photo } : {}) }) }))} />}
        {a.paperResults.map(p => (
          <div key={p.id} className="rounded-xl border border-[var(--border-color)] p-3 text-sm">
            <div className="flex items-center gap-2"><b>{p.title}</b><span className="text-xs text-[var(--text-muted)]">на бумаге · {p.byName} · {new Date(p.at).toLocaleDateString("ru-RU")}</span>
              {canManage && <><button className="ml-auto text-xs text-[var(--accent)]" onClick={() => setPaper(p)}>Изменить</button><button className="text-xs text-rose-600" onClick={async () => { if (await confirmDialog({ title: "Удалить результаты?", confirmLabel: "Удалить", danger: true })) await act(() => api(`/applicants/${a.id}/paper/${p.id}`, { method: "DELETE" })); }}>Удалить</button></>}
            </div>
            <div className="mt-1 text-[var(--text-main)]">{p.rows.map(r => `${r.subject}: ${r.score ?? "—"}${r.max != null ? ` / ${r.max}` : ""}`).join(" · ")}</div>
            {p.comment && <div className="text-xs text-[var(--text-muted)] mt-0.5">{p.comment}</div>}
          </div>
        ))}
        {canManage && !d.testExam && <button className={btn} onClick={() => setPaper({ id: "", title: "Тест на бумаге", rows: [{ subject: "", score: null, max: null }], comment: "", at: 0, byName: "" })}>Внести результаты на бумаге</button>}
      </section>

      <CandidateSummary a={a} cfg={d.candidateForm || NEUTRAL_CANDIDATE_FORM} canManage={canManage} onOpen={onOpenSheet} api={api} onChanged={onSaved} resultDelivery={d.resultDelivery || null} />

      {result && <AttemptViewer tenant={tenant} attemptId={result.id} examId={result.examId} onClose={() => setResult(null)} onChanged={onSaved} />}
      {paper && <PaperModal p={paper} onClose={() => setPaper(null)} onSave={async x => { await api(`/applicants/${a.id}/paper`, { method: "POST", body: JSON.stringify(x) }); setPaper(null); onSaved(); }} />}
    </div>
  );
}

const fmtDate = (ms?: number | null) => (ms ? new Date(ms).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const fmtN = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

/** Работа экзамена в карточке: то же, что в самом экзамене — анкета при входе, результаты, проверка, досье прокторинга. */
function AttemptBlock({ x, tenantId, onOpen }: { x: CardAttempt; tenantId: string; onOpen: () => void }) {
  const examApi = useExamApi(tenantId, "exam-admin");
  const [dossier, setDossier] = useState<{ report: any } | null>(null);
  const [loading, setLoading] = useState(false);
  const openDossier = async () => {
    setLoading(true);
    try { const j = await examApi(`/attempts/${x.id}`); setDossier({ report: { ...(j.attempt.proctoring || {}), violations: j.attempt.proctoring?.violations || [] } }); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  const state = x.status === "in_progress" ? "пишет сейчас" : x.status === "annulled" ? "аннулирована" : x.superseded ? "заменена пересдачей" : "";
  const info = x.student ? [x.student.name, x.student.level && `${x.levelLabel || "Класс"}: ${x.student.level}`, x.student.phone, x.student.email].filter(Boolean) : [];
  return (
    <div className="rounded-xl border border-[var(--border-color)] p-3 text-sm space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <b>{x.examTitle}</b>
        <span className="text-[var(--text-muted)]">{x.paper ? "на бумаге" : `№ работы ${x.shortId}`}</span>
        <span className="text-xs text-[var(--text-muted)]">{fmtDate(x.finishedAt || x.startedAt)}</span>
        {state && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/10 text-[var(--text-muted)]">{state}</span>}
        {x.reviewDone && <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-700">Проверено</span>}
        {x.published && <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-700">Опубликовано</span>}
      </div>
      {x.examAccess && (info.length > 0 || (x.extraRows?.length || 0) > 0) && (
        <div className="rounded-lg bg-[var(--bg-surface-hover)] p-2.5 space-y-1">
          <div className="text-xs font-medium text-[var(--text-muted)]">Анкета с экзамена</div>
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
            {x.student?.name && <div><span className="text-[var(--text-muted)]">ФИО: </span>{x.student.name}</div>}
            {x.student?.level && <div><span className="text-[var(--text-muted)]">{x.levelLabel || "Класс"}: </span>{x.student.level}</div>}
            {x.student?.phone && <div><span className="text-[var(--text-muted)]">Телефон: </span>{x.student.phone}</div>}
            {x.student?.email && <div><span className="text-[var(--text-muted)]">Почта: </span>{x.student.email}</div>}
            {(x.extraRows || []).map(r => <div key={r.label}><span className="text-[var(--text-muted)]">{r.label}: </span>{r.value}</div>)}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {x.status === "finished" && x.percent != null && <span className="px-2 py-0.5 rounded bg-[var(--bg-surface-hover)] font-bold">Итог: {fmtN(x.percent)}%{x.earned != null && x.max ? <span className="font-normal text-xs text-[var(--text-muted)]"> {fmtN(x.earned)} / {fmtN(x.max)}</span> : null}</span>}
        {x.status === "finished" && x.sections.map(p => <span key={p.id} className="text-xs px-2 py-0.5 rounded bg-[var(--bg-surface-hover)]">{p.title}: {p.percent}%</span>)}
        {x.parts.filter(p => p.kind === "labels" || p.kind === "band").map(p => <span key={p.title} className="text-xs px-2 py-0.5 rounded bg-[var(--bg-surface-hover)]">{p.title}: {p.value}</span>)}
        {x.status === "finished" && x.percent == null && x.sections.length === 0 && <span>сдан</span>}
      </div>
      {x.examAccess && (
        <div className="flex flex-wrap items-center gap-2">
          {x.proctoring?.enabled && <Button size="sm" variant="secondary" loading={loading} icon={<ShieldAlert className="w-3.5 h-3.5" />} onClick={openDossier}>Досье прокторинга{x.proctoring.totalViolations ? ` · ${x.proctoring.totalViolations}` : ""}</Button>}
          <Button size="sm" variant="secondary" icon={<ExternalLink className="w-3.5 h-3.5" />} onClick={onOpen}>Ответы и проверка</Button>
        </div>
      )}
      {dossier && x.student && <ProctoringDossier shortId={x.shortId} studentName={x.student.name} grade={x.student.level} report={dossier.report} loadSnapshots={async () => (await examApi(`/attempts/${x.id}/evidence`)).snapshots} onClose={() => setDossier(null)} />}
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

/** Анкета кандидата — коротко: решение, заключение, обратная связь. Правка — в окне листа. */
function CandidateSummary({ a, cfg, canManage, onOpen, api, onChanged, resultDelivery }: { a: Applicant; cfg: CandidateFormConfig; canManage: boolean; onOpen: () => void; api: Api; onChanged: () => void; resultDelivery: { delivery: "email" | "page"; sendOn: "publish" | "manual" } | null }) {
  const c = a.candidate;
  const decision = cfg.decisions.find(x => x.id === c?.decision)?.label || c?.decisionLabel || "";
  const final = !!c?.decision && (cfg.decisions.find(x => x.id === c.decision)?.final ?? !!c.decisionFinal);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const publish = async (at?: number) => {
    if (!at && !(await confirmDialog({ title: `Опубликовать результаты: ${decision}`, message: "Результаты откроются по QR направления, родителю уйдёт письмо с решением.", confirmLabel: "Опубликовать" }))) return;
    setBusy(true);
    try {
      const j = await api(`/applicants/${a.id}/publish`, { method: "POST", body: JSON.stringify(at ? { at } : {}) });
      if (j.scheduled) toast.success(`Публикация запланирована на ${whenShort(j.scheduled)}`);
      else toast.success(j.email?.sent ? "Опубликовано, письмо отправлено" : `Опубликовано${j.email?.reason ? ` · письмо: ${j.email.reason}` : ""}`);
      setPicking(false); onChanged();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const cancelSchedule = async () => {
    setBusy(true);
    try { await api(`/applicants/${a.id}/publish/cancel`, { method: "POST" }); toast.success("Публикация отменена"); onChanged(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const sendReady = async () => {
    setBusy(true);
    try { const j = await api(`/applicants/${a.id}/results-email`, { method: "POST" }); toast.success(`Письмо отправлено${j.to ? `: ${j.to}` : ""}`); onChanged(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const unpublish = async () => {
    if (!(await confirmDialog({ title: "Снять публикацию?", message: "Результаты по QR закроются. Отправленное письмо не отзывается.", confirmLabel: "Снять", danger: true }))) return;
    setBusy(true);
    try { await api(`/applicants/${a.id}/unpublish`, { method: "POST" }); toast.success("Публикация снята"); onChanged(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold text-[var(--text-main)]">Анкета кандидата</h3>
        <button className={`${canManage ? btnPrimary : btn} ml-auto`} onClick={onOpen}><ClipboardList className="w-4 h-4" /> {canManage ? "Открыть и редактировать" : "Открыть"}</button>
      </div>
      <dl className="grid sm:grid-cols-3 gap-2 text-sm">
        <div className="rounded-xl border border-[var(--border-color)] p-2.5"><dt className="text-[11px] text-[var(--text-muted)]">Решение</dt><dd className="font-semibold text-[var(--text-main)]">{decision || "—"}</dd></div>
        <div className="rounded-xl border border-[var(--border-color)] p-2.5"><dt className="text-[11px] text-[var(--text-muted)]">Заключение</dt><dd className="text-[var(--text-main)] truncate">{c?.conclusion || "—"}</dd></div>
        <div className="rounded-xl border border-[var(--border-color)] p-2.5"><dt className="text-[11px] text-[var(--text-muted)]">Обратная связь</dt><dd className="text-[var(--text-main)]">{c?.feedbackGiven ? "дана" : "не дана"}</dd></div>
      </dl>
      {c?.at ? <div className="text-xs text-[var(--text-muted)]">{c.by} · {new Date(c.at).toLocaleString("ru-RU")}</div> : null}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border-color)] p-2.5">
        {c?.published
          ? <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Результаты опубликованы · {c.published.byName}, {new Date(c.published.at).toLocaleString("ru-RU")}</span>
          : c?.publishAt ? <span className="text-sm text-sky-700 dark:text-sky-400 font-medium">Публикация · {whenShort(c.publishAt)}</span>
          : <span className="text-sm text-[var(--text-muted)]">{final ? "Результаты не опубликованы" : "Результаты закрыты до окончательного решения"}</span>}
        {canManage && !a.archived && (c?.published
          ? <Button className="ml-auto" size="sm" variant="secondary" loading={busy} onClick={unpublish}>Снять публикацию</Button>
          : <span className="ml-auto inline-flex items-center gap-2">
              {c?.publishAt && <Button size="sm" variant="secondary" loading={busy} onClick={cancelSchedule}>Отменить</Button>}
              <SplitPublishButton loading={busy} disabled={!final} onNow={() => void publish()} onSchedule={() => setPicking(true)} />
            </span>)}
        {picking && <PublishWhenModal onClose={() => setPicking(false)} onPick={at => publish(at)} />}
      </div>
      {canManage && c?.published && resultDelivery?.delivery === "page"
        ? (
          <div className="flex flex-wrap items-center gap-2">
            {!(a as any).resultsEmail && <Button size="sm" variant="secondary" loading={busy} onClick={sendReady}>Отправить «Результаты готовы»</Button>}
            <EmailResend tenantId={a.tenantId} event="results_ready" ctx={{ applicantId: a.id }} state={(a as any).resultsEmail} onDone={onChanged} />
          </div>
        )
        : canManage && c?.published && <EmailResend tenantId={a.tenantId} event="decision" ctx={{ applicantId: a.id }} state={(a as any).decisionEmail} />}
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
          <button className={btnPrimary} disabled={busy || !x.rows.some(r => r.subject.trim())} onClick={async () => { setBusy(true); try { await onSave(x); } catch (e: any) { toast.error(e.message); setBusy(false); } }}>Сохранить</button>
        </div>
      </div>
    </Modal>
  );
}

/** «Снять направление»: причина видна в истории; пока направление не вернут, система его не выдаёт. */
function RevokeModal({ onClose, onSave }: { onClose: () => void; onSave: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Снять направление" onClose={onClose}>
      <div className="space-y-3">
        <div><span className={label}>Причина</span><input className={input} value={reason} onChange={e => setReason(e.target.value)} autoFocus /></div>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="danger" loading={busy} onClick={async () => { setBusy(true); try { await onSave(reason); } catch (e: any) { toast.error(e.message); setBusy(false); } }}>Снять</Button>
        </div>
      </div>
    </Modal>
  );
}
