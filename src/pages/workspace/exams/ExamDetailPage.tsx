import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { ArchiveRestore, ArrowLeft, Copy, Download, KeyRound, Loader2, QrCode, Send, Trash2, UserPlus } from "lucide-react";
import { Button, Tabs, confirmDialog, toast, useUrlTab } from "../../../components/ui";
import HistoryTab from "./HistoryTab";
import FancyQr, { QR_THEMES, downloadQr } from "../../../components/forms/FancyQr";
import { tenantLogos } from "../../../shared/legal";
import type { Exam } from "../../../shared/examRun";
import { Modal, btn, btnPrimary, card } from "../journals/components/ui";
import { examLink, useExamApi } from "./examApi";
import AttemptsTab from "./AttemptsTab";
import ExamAnalyticsTab from "./ExamAnalyticsTab";
import ExamSettingsTab from "./ExamSettingsTab";
import AttemptModal from "./AttemptModal";
import NewApplicantModal from "../admissions/NewApplicantModal";
import { useAdmissionApi } from "../admissions/admissionApi";
import { canAdmissions, resolvePermissions, type PermissionKey } from "../../../shared/permissions";
import AdmissionsPage from "../admissions/AdmissionsPage";
import { PublishWhenModal, SkippedModal, SplitPublishButton, outcomeText, type PublishOutcome } from "../admissions/PublishControls";
import { isAdmissionExam } from "../../../shared/admissions";

/** Один экзамен: работы, аналитика, конструктор; сверху — ссылка, QR и PIN. */
export default function ExamDetailPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const tenantId: string = activeTenant?.id || "";
  const { examId = "" } = useParams();
  const navigate = useNavigate();
  const api = useExamApi(tenantId, "exam-admin");
  const bankApi = useExamApi(tenantId, "exam-builder");
  const [exam, setExam] = useState<Exam | null>(null);
  const [pin, setPin] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const [canReview, setCanReview] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [archived, setArchived] = useState(false);
  /** Правки конструктора, ещё не сохранённые, и способ их сохранить. */
  const dirtyRef = React.useRef<{ dirty: boolean; save: () => Promise<boolean> }>({ dirty: false, save: async () => true });
  const onDirty = useCallback((dirty: boolean, save: () => Promise<boolean>) => { dirtyRef.current = { dirty, save }; }, []);
  const [qr, setQr] = useState(false);
    const [busy, setBusy] = useState(false);
  const [openAttempt, setOpenAttempt] = useState<string | null>(null);
  const [newApplicant, setNewApplicant] = useState(false);
  const [pubPick, setPubPick] = useState(false);
  const [pubOut, setPubOut] = useState<PublishOutcome | null>(null);
  const admApi = useAdmissionApi(tenantId);
  const granted = useMemo(() => (Array.isArray(activeTenant?.effectivePermissions)
    ? new Set<PermissionKey>(activeTenant.effectivePermissions)
    : resolvePermissions({ role: activeTenant?.role, permissions: activeTenant?.permissions, customPermissions: activeTenant?.customPermissions, rolePermissions: activeTenant?.customRole?.permissions, disabledModules: activeTenant?.disabledModules })), [activeTenant]);
  const reception = granted.has("admission:manage");
  /** Вступительный тест класса и права на поступающих — вкладка «Ученики класса». */
  const classGrades = exam?.settings.admission?.grades || [];
  const students = classGrades.length > 0 && canAdmissions(granted);
  // Несохранённые правки конструктора: браузер спросит при закрытии и обновлении вкладки.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirtyRef.current.dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);
  // Ученик из уведомления или QR (?open=) — сразу во вкладке учеников класса.
  const defTab = students || params.get("open") ? "students" : exam && !exam.sections.length && canEdit ? "settings" : "attempts";
  const tabItems = [...(students ? [{ id: "students", label: "Ученики класса" }] : []), { id: "attempts", label: "Работы" }, { id: "analytics", label: "Аналитика" }, { id: "settings", label: "Конструктор" }, { id: "history", label: "История" }];
  const [tab, setTab] = useUrlTab<"students" | "attempts" | "analytics" | "settings" | "history">("tab", tabItems.map(t => t.id) as any, defTab as any);

  const load = useCallback(async () => {
    try { const j = await api(`/exams/${examId}`); setExam(j.exam); setPin(j.pin); setCanEdit(j.canEdit); setCanReview(!!j.canReview); setCanManage(!!j.canManage); setArchived(!!j.archived); }
    catch (e: any) { setError(e.message); }
  }, [api, examId]);
  useEffect(() => { if (tenantId) void load(); }, [load, tenantId]);
  // Часовой PIN меняется — подтягиваем раз в минуту.
  useEffect(() => {
    if (exam?.settings.access.pinMode !== "hourly") return;
    const t = setInterval(() => api(`/exams/${examId}`).then(j => setPin(j.pin)).catch(() => {}), 60000);
    return () => clearInterval(t);
  }, [api, examId, exam?.settings.access.pinMode]);

  const setStatus = async (status: Exam["status"]) => {
    // «Открыт» проверяет сохранённые настройки — несохранённые правки сначала сохраняем.
    if (dirtyRef.current.dirty) {
      if (!(await confirmDialog({ title: "Есть несохранённые правки конструктора", message: "Сохранить их и сменить статус?", confirmLabel: "Сохранить и продолжить" }))) return;
      if (!(await dirtyRef.current.save())) return;
    }
    setBusy(true); setError(null);
    try { const j = await api(`/exams/${examId}`, { method: "PUT", body: JSON.stringify({ status }) }); setExam(j.exam); setPin(j.pin); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!exam || !(await confirmDialog({ title: `Удалить экзамен «${exam.title}»?`, message: "С работами — уйдёт в архив", confirmLabel: "Удалить", danger: true }))) return;
    try {
      const j = await api(`/exams/${examId}`, { method: "DELETE" });
      dirtyRef.current = { dirty: false, save: async () => true };
      if (j.archived) toast.success("Экзамен в архиве");
      navigate(`/workspace/${tenantId}/exams${j.archived ? "?tab=archive" : ""}`);
    } catch (e: any) { setError(e.message); }
  };
  const restore = async () => {
    try { await api(`/exams/${examId}/restore`, { method: "POST" }); toast.success("Экзамен возвращён (закрыт)"); await load(); }
    catch (e: any) { toast.error(e.message); }
  };
  /** Уходим со страницы — спросить, если в конструкторе есть несохранённое. */
  const leave = async (e: React.MouseEvent) => {
    if (!dirtyRef.current.dirty) return;
    e.preventDefault();
    if (await confirmDialog({ title: "Несохранённые правки будут потеряны", confirmLabel: "Уйти без сохранения", danger: true })) { dirtyRef.current = { dirty: false, save: async () => true }; navigate(`/workspace/${tenantId}/exams`); }
  };

  const publishAll = async (at?: number) => {
    if (!exam) return;
    setBusy(true);
    try {
      const d = await admApi(`/exams/${exam.id}/publish-all`, { method: "POST", body: JSON.stringify({ dry: true }) });
      setBusy(false);
      if (!d.count) { toast.error(d.noDecision ? `Нет окончательных решений (без решения: ${d.noDecision})` : "Некого публиковать"); return; }
      if (!(await confirmDialog({ title: `${at ? "Запланировать публикацию" : "Опубликовать результаты"}: ${d.count}`, message: d.noDecision ? `Без окончательного решения пропустим: ${d.noDecision}` : undefined, confirmLabel: at ? "Запланировать" : "Опубликовать" }))) return;
    } catch (e: any) { setBusy(false); toast.error(e.message); return; }
    setBusy(true);
    try {
      const j: PublishOutcome = await admApi(`/exams/${exam.id}/publish-all`, { method: "POST", body: JSON.stringify(at ? { at } : {}) });
      toast.success(outcomeText(j));
      if (j.skipped.length || j.noDecision) setPubOut(j);
      setPubPick(false);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  if (error && !exam) return <div className="p-6 text-center space-y-3"><p className="text-rose-600">{error}</p><Link className={btn} to={`/workspace/${tenantId}/exams`}><ArrowLeft className="w-4 h-4" /> К экзаменам</Link></div>;
  if (!exam) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>;

  const link = examLink(exam.code);
  const mark = tenantLogos(activeTenant).markUrl;

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <Link to={`/workspace/${tenantId}/exams${archived ? "?tab=archive" : ""}`} onClick={leave} className="p-2 -ml-2 rounded-lg hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)]"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1 min-w-[60%] sm:min-w-0">
          {exam.group && <div className="text-[11px] uppercase font-mono font-bold text-[var(--text-muted)]">{exam.group}</div>}
          <h1 className="text-lg md:text-2xl font-bold text-[var(--text-main)] truncate">{exam.title}</h1>
        </div>
        {archived && <span className="text-xs px-2 py-1 rounded-full bg-slate-500/10 text-[var(--text-muted)] ml-auto">В архиве</span>}
        {archived && canManage && <Button variant="primary" icon={<ArchiveRestore className="w-4 h-4" />} onClick={restore}>Вернуть</Button>}
        {canEdit && (
          <div className="flex rounded-lg border border-[var(--border-color)] overflow-hidden ml-auto">
            {([["draft", "Черновик"], ["open", "Открыт"], ["closed", "Закрыт"]] as const).map(([k, l]) => (
              <button key={k} disabled={busy} onClick={() => exam.status !== k && setStatus(k)}
                className={`px-3 py-1.5 text-sm font-medium ${exam.status === k ? (k === "open" ? "bg-emerald-600 text-white" : k === "closed" ? "bg-rose-600 text-white" : "bg-slate-600 text-white") : "text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]"}`}>{l}</button>
            ))}
          </div>
        )}
        {!archived && reception && !!exam.settings.admission?.grades?.length && (
          <button className={btnPrimary} onClick={() => setNewApplicant(true)}><UserPlus className="w-4 h-4" /> Поступающий{exam.settings.admission.grades.length === 1 ? ` в ${exam.settings.admission.grades[0]} класс` : ""}</button>
        )}
        {!archived && reception && isAdmissionExam(exam) && (
          <SplitPublishButton text="Опубликовать результаты всех" size="md" loading={busy} onNow={() => void publishAll()} onSchedule={() => setPubPick(true)} />
        )}
        {canEdit && !archived && <button className={btn} onClick={remove} title="Удалить"><Trash2 className="w-4 h-4" /></button>}
      </div>
      {error && <div className="text-sm text-rose-600">{error}</div>}

      {!exam.settings.paper && (
      <div className={`${card} p-4 flex flex-wrap items-center gap-4`}>
        <div className="flex-1 min-w-[240px]">
          <div className="text-[11px] uppercase font-mono font-bold text-[var(--text-muted)]">Ссылка для учеников</div>
          <div className="font-mono text-sm text-[var(--text-main)] break-all">{link}</div>
          <div className="flex gap-2 mt-2">
            <button className={btn} onClick={() => { navigator.clipboard?.writeText(link); toast.success("Ссылка скопирована"); }}><Copy className="w-4 h-4" /> Копировать</button>
            <button className={btn} onClick={() => setQr(true)}><QrCode className="w-4 h-4" /> QR</button>
          </div>
        </div>
        {exam.settings.access.pinMode !== "none" && (
          <div className="text-center px-4">
            <div className="text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] flex items-center gap-1 justify-center"><KeyRound className="w-3.5 h-3.5" /> PIN {exam.settings.access.pinMode === "hourly" ? "этого часа" : ""}</div>
            <div className="text-4xl font-black tracking-[0.2em] tabular-nums text-[var(--text-main)]">{pin || "—"}</div>
          </div>
        )}
      </div>
      )}

      <Tabs tabs={tabItems} value={tab} onChange={t => setTab(t as typeof tab)} />

      {tab === "students" && students && <AdmissionsPage embedded mode="admin" classGrades={classGrades} />}
      {tab === "attempts" && <AttemptsTab exam={exam} api={api} tenant={activeTenant} canEdit={canManage} canReview={canReview} />}
      {tab === "analytics" && <ExamAnalyticsTab exam={exam} api={api} onOpen={setOpenAttempt} />}
      {tab === "history" && <HistoryTab api={api} examId={exam.id} />}
      <div className={tab === "settings" ? "" : "hidden"}>
        <ExamSettingsTab exam={exam} api={api} bankApi={bankApi} canEdit={canEdit} onSaved={e => { setExam(e); void load(); }} onDirty={onDirty} />
      </div>

      {newApplicant && (
        <NewApplicantModal api={admApi} grade={exam.settings.admission?.grades?.length === 1 ? String(exam.settings.admission.grades[0]) : undefined}
          onClose={() => setNewApplicant(false)}
          onDone={id => { setNewApplicant(false); setParams({ open: id, ctab: "profile", qr: "parent" }, { replace: true }); }} />
      )}
      {pubPick && <PublishWhenModal title="Запланировать публикацию всем" onClose={() => setPubPick(false)} onPick={at => publishAll(at)} />}
      {pubOut && <SkippedModal outcome={pubOut} names={{}} onClose={() => setPubOut(null)} />}
      {openAttempt && <AttemptModal attemptId={openAttempt} exam={exam} api={api} tenant={activeTenant} canEdit={canManage} onChanged={() => {}} onClose={() => setOpenAttempt(null)} />}
      {qr && (
        <Modal title={exam.title} onClose={() => setQr(false)}>
          <div className="flex flex-col items-center gap-3">
            <div className="bg-white rounded-2xl p-3"><FancyQr value={link} size={260} logo={mark} /></div>
            <button className={btnPrimary} onClick={() => downloadQr(link, QR_THEMES[0], `QR — ${exam.title}.png`, 1024, mark)}><Download className="w-4 h-4" /> Скачать для печати</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
