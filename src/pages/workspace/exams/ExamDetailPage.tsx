import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Download, KeyRound, Loader2, QrCode, Trash2 } from "lucide-react";
import FancyQr, { QR_THEMES, downloadQr } from "../../../components/forms/FancyQr";
import { tenantLogos } from "../../../shared/legal";
import type { Exam } from "../../../shared/examRun";
import { Modal, btn, btnPrimary, card } from "../journals/components/ui";
import { examLink, useExamApi } from "./examApi";
import AttemptsTab from "./AttemptsTab";
import ExamAnalyticsTab from "./ExamAnalyticsTab";
import ExamSettingsTab from "./ExamSettingsTab";
import AttemptModal from "./AttemptModal";

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
  const [tab, setTab] = useState<"attempts" | "analytics" | "settings">("attempts");
  const [qr, setQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openAttempt, setOpenAttempt] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const j = await api(`/exams/${examId}`); setExam(j.exam); setPin(j.pin); setCanEdit(j.canEdit); if (!j.exam.sections.length) setTab(t => (t === "attempts" ? "settings" : t)); }
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
    setBusy(true); setError(null);
    try { const j = await api(`/exams/${examId}`, { method: "PUT", body: JSON.stringify({ status }) }); setExam(j.exam); setPin(j.pin); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!exam || !confirm(`Удалить экзамен «${exam.title}»? Если по нему уже есть работы, он уйдёт в архив вместе с ними.`)) return;
    try { await api(`/exams/${examId}`, { method: "DELETE" }); navigate(`/workspace/${tenantId}/exams`); }
    catch (e: any) { setError(e.message); }
  };

  if (error && !exam) return <div className="p-6 text-center space-y-3"><p className="text-rose-600">{error}</p><Link className={btn} to={`/workspace/${tenantId}/exams`}><ArrowLeft className="w-4 h-4" /> К экзаменам</Link></div>;
  if (!exam) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>;

  const link = examLink(exam.code);
  const mark = tenantLogos(activeTenant).markUrl;

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <Link to={`/workspace/${tenantId}/exams`} className="p-2 -ml-2 rounded-lg hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)]"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1 min-w-[60%] sm:min-w-0">
          {exam.group && <div className="text-[11px] uppercase font-mono font-bold text-[var(--text-muted)]">{exam.group}</div>}
          <h1 className="text-lg md:text-2xl font-bold text-[var(--text-main)] truncate">{exam.title}</h1>
        </div>
        {canEdit && (
          <div className="flex rounded-lg border border-[var(--border-color)] overflow-hidden ml-auto">
            {([["draft", "Черновик"], ["open", "Открыт"], ["closed", "Закрыт"]] as const).map(([k, l]) => (
              <button key={k} disabled={busy} onClick={() => exam.status !== k && setStatus(k)}
                className={`px-3 py-1.5 text-sm font-medium ${exam.status === k ? (k === "open" ? "bg-emerald-600 text-white" : k === "closed" ? "bg-rose-600 text-white" : "bg-slate-600 text-white") : "text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]"}`}>{l}</button>
            ))}
          </div>
        )}
        {canEdit && <button className={btn} onClick={remove} title="Удалить"><Trash2 className="w-4 h-4" /></button>}
      </div>
      {error && <div className="text-sm text-rose-600">{error}</div>}

      <div className={`${card} p-4 flex flex-wrap items-center gap-4`}>
        <div className="flex-1 min-w-[240px]">
          <div className="text-[11px] uppercase font-mono font-bold text-[var(--text-muted)]">Ссылка для учеников</div>
          <div className="font-mono text-sm text-[var(--text-main)] break-all">{link}</div>
          <div className="flex gap-2 mt-2">
            <button className={btn} onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}><Copy className="w-4 h-4" /> {copied ? "Скопировано" : "Копировать"}</button>
            <button className={btn} onClick={() => setQr(true)}><QrCode className="w-4 h-4" /> QR</button>
          </div>
        </div>
        {exam.settings.access.pinMode !== "none" && (
          <div className="text-center px-4">
            <div className="text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] flex items-center gap-1 justify-center"><KeyRound className="w-3.5 h-3.5" /> PIN {exam.settings.access.pinMode === "hourly" ? "этого часа" : ""}</div>
            <div className="text-4xl font-black tracking-[0.2em] tabular-nums text-[var(--text-main)]">{pin || "—"}</div>
            {exam.settings.access.pinMode === "hourly" && <div className="text-[11px] text-[var(--text-muted)]">меняется в начале каждого часа</div>}
          </div>
        )}
        {exam.status !== "open" && <div className="w-full text-xs text-amber-700">Экзамен {exam.status === "draft" ? "в черновике" : "закрыт"} — ученики не смогут начать. {canEdit ? "Нажмите «Открыт», когда всё готово." : ""}</div>}
      </div>

      <div className="flex gap-1 border-b border-[var(--border-color)] overflow-x-auto hide-scrollbar">
        {([["attempts", "Работы"], ["analytics", "Аналитика"], ["settings", "Конструктор"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === k ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]"}`}>{l}</button>
        ))}
      </div>

      {tab === "attempts" && <AttemptsTab exam={exam} api={api} tenant={activeTenant} canEdit={canEdit} />}
      {tab === "analytics" && <ExamAnalyticsTab exam={exam} api={api} onOpen={setOpenAttempt} />}
      <div className={tab === "settings" ? "" : "hidden"}>
        <ExamSettingsTab exam={exam} api={api} bankApi={bankApi} canEdit={canEdit} onSaved={e => { setExam(e); void load(); }} />
      </div>

      {openAttempt && <AttemptModal attemptId={openAttempt} exam={exam} api={api} tenant={activeTenant} canEdit={canEdit} onChanged={() => {}} onClose={() => setOpenAttempt(null)} />}
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
