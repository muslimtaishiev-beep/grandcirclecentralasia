import React, { useCallback, useEffect, useState } from "react";
import { useLive } from "../../../lib/useLive";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, Loader2, Radio, Square } from "lucide-react";
import { Button, confirmDialog, toast } from "../../../components/ui";
import { gradeOf } from "../../../shared/questionnaires";
import { card } from "../journals/components/ui";
import type { Api, ExamListItem } from "./examApi";
import type { Row } from "../admissions/admissionApi";
import AttemptViewer from "./AttemptViewer";

/**
 * «Сейчас»: кто пишет тест прямо сейчас (раздел, сколько осталось, нарушения)
 * и кто сейчас на сессии у психолога. Обновляется сама.
 */
interface LiveRow {
  id: string; examId: string; examTitle: string; shortId: string; name: string; level: string; startedAt: number;
  section: string; sectionNo: number; sectionCount: number; deadline: number | null; waitingStart: boolean;
  applicantId: string | null; refNo: number | null; violations: number; highViolations?: number; lastViolation?: string;
}
const no = (n: number) => `№ ${String(n).padStart(4, "0")}`;
const left = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

export default function LiveTab({ api, admApi, tenant }: { api: Api; admApi: Api | null; tenant: any }) {
  const tenantId = String(tenant?.id || "");
  const navigate = useNavigate();
  const [live, setLive] = useState<LiveRow[] | null>(null);
  const [skew, setSkew] = useState(0);
  const [psych, setPsych] = useState<Row[]>([]);
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState<LiveRow | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [j, e] = await Promise.all([api("/live"), api("/exams")]);
      setLive(j.live); setCanReview(!!j.canReview); setSkew(j.now - Date.now()); setExams(e.exams); setError(null);
    } catch (err: any) { setError(err.message); }
    if (admApi) admApi("/applicants").then(j => setPsych((j.applicants as Row[]).filter(r => Object.values(r.stages).some(s => s.status === "draft")))).catch(() => {});
  }, [api, admApi]);
  useEffect(() => { void load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  useLive(tenant?.id, ["exams"], () => { void load(); });
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  /** Продлить время одной работе или всем идущим экзамена. */
  const extend = async (r: LiveRow, minutes: number) => {
    setBusy(r.id);
    try { await api(`/attempts/${r.id}/action`, { method: "POST", body: JSON.stringify({ action: "extend", minutes }) }); toast.success(`+${minutes} мин: ${r.name}`); await load(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };
  const examWide = async (examId: string, action: "extend" | "finish", minutes?: number) => {
    if (action === "finish" && !(await confirmDialog({ title: "Досдать все идущие работы экзамена?", message: "Результат посчитается по текущим ответам", confirmLabel: "Досдать всех", danger: true }))) return;
    setBusy(examId);
    try { const j = await api(`/exams/${examId}/live`, { method: "POST", body: JSON.stringify({ action, minutes }) }); toast.success(action === "extend" ? `+${minutes} мин: работ ${j.ok}` : `Досдано: ${j.ok}`); await load(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };
  const liveExams = live ? [...new Map(live.map(r => [r.examId, r.examTitle])).entries()] : [];

  /** Ученик — на странице экзамена его класса. */
  const openApplicant = (id: string, grade: string, examId?: string) => {
    const g = gradeOf(grade);
    const exam = exams.find(e => e.id === examId) || exams.find(e => g !== null && (e.grades || []).includes(g));
    navigate(exam ? `/workspace/${tenantId}/exams/${exam.id}?open=${id}` : `/workspace/${tenantId}/exams?tab=admissions&open=${id}`);
  };

  if (!live) return error ? <div className="text-sm text-rose-600">{error}</div> : <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>;
  const t = now + skew;
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2"><Radio className="w-4 h-4 text-emerald-600 animate-pulse" /> Пишут тест · {live.length}</h3>
        {canReview && liveExams.map(([id, title]) => (
          <div key={id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-[var(--text-main)]">{title}</span>
            <Button size="sm" disabled={busy === id} icon={<Clock className="w-3.5 h-3.5" />} onClick={() => examWide(id, "extend", 5)}>Всем +5 мин</Button>
            <Button size="sm" disabled={busy === id} icon={<Clock className="w-3.5 h-3.5" />} onClick={() => examWide(id, "extend", 10)}>Всем +10 мин</Button>
            <Button size="sm" variant="danger" disabled={busy === id} icon={<Square className="w-3.5 h-3.5" />} onClick={() => examWide(id, "finish")}>Досдать всех</Button>
          </div>
        ))}
        {!live.length ? <div className={`${card} p-6 text-sm text-[var(--text-muted)] text-center`}>Сейчас никто не пишет тест</div> : (
          <div className={`${card} overflow-x-auto`}>
            <table className="w-full text-sm min-w-[720px]">
              <thead className="text-[11px] uppercase font-mono text-[var(--text-muted)] bg-[var(--bg-panel)]">
                <tr>{["Ученик", "Экзамен", "Раздел", "Осталось", "Нарушения", "Начал", ...(canReview ? [""] : [])].map(h => <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody>
                {live.map(r => {
                  const rest = r.deadline ? r.deadline - t : null;
                  return (
                    <tr key={r.id} className="border-t border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] cursor-pointer" onClick={() => setOpen(r)}>
                      <td className="px-3 py-2"><div className="font-medium text-[var(--text-main)]">{r.name}</div><div className="text-[11px] text-[var(--text-muted)]">{r.refNo ? no(r.refNo) : `работа ${r.shortId}`}{r.level ? ` · ${r.level}` : ""}</div></td>
                      <td className="px-3 py-2 text-xs">{r.examTitle}</td>
                      <td className="px-3 py-2 text-xs">{r.waitingStart ? "фото перед тестом" : `${r.sectionNo}/${r.sectionCount} · ${r.section}`}</td>
                      <td className={`px-3 py-2 text-xs tabular-nums font-semibold ${rest !== null && rest < 5 * 60_000 ? "text-rose-600" : "text-[var(--text-main)]"}`}>{rest === null ? "—" : rest <= 0 ? "время вышло" : left(rest)}</td>
                      <td className="px-3 py-2 text-xs">{r.violations ? <span title={r.lastViolation} className={`inline-flex items-center gap-1 ${r.highViolations ? "text-rose-600 font-semibold" : "text-amber-700"}`}><AlertTriangle className="w-3.5 h-3.5" /> {r.violations}{r.highViolations ? ` · серьёзных ${r.highViolations}` : ""}</span> : <span className="text-[var(--text-muted)]">—</span>}</td>
                      <td className="px-3 py-2 text-xs text-[var(--text-muted)] whitespace-nowrap">{new Date(r.startedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</td>
                      {canReview && <td className="px-3 py-2 whitespace-nowrap" onClick={e => e.stopPropagation()}>{r.deadline && [5, 10].map(m => <Button key={m} size="sm" variant="ghost" disabled={busy === r.id} onClick={() => extend(r, m)}>+{m}</Button>)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {admApi && (
        <section className="space-y-2">
          <h3 className="font-bold text-[var(--text-main)]">На сессии · {psych.length}</h3>
          {!psych.length ? <div className={`${card} p-6 text-sm text-[var(--text-muted)] text-center`}>Сейчас сессий нет</div> : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {psych.map(r => {
                const s = Object.values(r.stages).find(x => x.status === "draft")!;
                return (
                  <button key={r.id} className={`${card} p-3 text-left hover:border-[var(--accent)] transition`} onClick={() => openApplicant(r.id, r.child.grade)}>
                    <div className="font-medium text-[var(--text-main)]">{r.child.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{no(r.refNo)} · {r.child.grade} класс · {s.byName} · {new Date(s.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {open && <AttemptViewer tenant={tenant} attemptId={open.id} examId={open.examId} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  );
}
