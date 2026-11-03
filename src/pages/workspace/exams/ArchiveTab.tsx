import React, { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Search, ShieldAlert } from "lucide-react";
import DOMPurify from "dompurify";
import ProctoringDossier from "../../../components/ProctoringDossier";
import { isAnswerCorrect } from "../../../lib/scoringEngine";
import { Modal, btn, card, input } from "../journals/components/ui";
import type { Api } from "./examApi";

/**
 * Архив прежнего вступительного теста — только чтение. Работы, баллы,
 * решения, ответы с ключами из банка и досье прокторинга.
 */
const SUBJ: [string, string][] = [["russian", "Русский"], ["math", "Математика"], ["logic", "Логика"], ["english", "Английский"]];

export default function ArchiveTab({ api }: { api: Api }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { api("/archive").then(j => setRows(j.rows)).catch(e => setError(e.message)); }, [api]);

  const grades = useMemo(() => [...new Set((rows || []).map(r => String(r.grade ?? "")).filter(Boolean))].sort((a, b) => Number(a) - Number(b)), [rows]);
  const visible = useMemo(() => (rows || []).filter(r => (!grade || String(r.grade) === grade) && (!q.trim() || `${r.name} ${r.shortId} ${r.phone}`.toLowerCase().includes(q.trim().toLowerCase()))), [rows, q, grade]);

  const excel = async () => {
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Архив");
    ws.addRow(["№", "ФИО", "Телефон", "Почта", "Класс", ...SUBJ.map(s => s[1]), "Итог", "Статус", "Решение", "Комментарий", "Индекс честности", "Дата"]).font = { bold: true };
    for (const r of visible) ws.addRow([r.shortId, r.name, r.phone, r.email, r.grade, ...SUBJ.map(([k]) => r.scores?.[k] ?? ""), r.scores?.total ?? "", r.status, r.finalDecision, r.managerComment, r.proctoring?.honestyIndex ?? "", r.submittedAt ? new Date(r.submittedAt).toLocaleString("ru-RU") : ""]);
    ws.columns.forEach((c: any, i: number) => { c.width = i === 1 ? 30 : 14; });
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([buf])); a.download = "Архив вступительного теста.xlsx"; a.click();
  };

  if (error) return <div className="text-sm text-rose-600">{error}</div>;
  if (!rows) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>;
  if (!rows.length) return <div className={`${card} p-10 text-center text-sm text-[var(--text-muted)]`}>Архива прежнего теста у организации нет.</div>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-muted)]">Работы прежнего вступительного теста ({rows.length}). Только просмотр: новые экзамены проводятся во вкладке «Экзамены», вопросы теста — в банке.</p>
      <div className={`${card} p-3 flex flex-wrap gap-2`}>
        <div className="relative flex-1 min-w-[200px]"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /><input className={`${input} pl-9`} placeholder="ФИО, номер, телефон" value={q} onChange={e => setQ(e.target.value)} /></div>
        <select className={`${input} !w-auto`} value={grade} onChange={e => setGrade(e.target.value)}><option value="">Все классы</option>{grades.map(g => <option key={g} value={g}>{g} класс</option>)}</select>
        <button className={btn} onClick={excel}><Download className="w-4 h-4" /> Excel</button>
      </div>
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-sm min-w-[820px]">
          <thead className="text-[11px] uppercase font-mono text-[var(--text-muted)] bg-[var(--bg-panel)]"><tr><th className="px-3 py-2.5 text-left">Ученик</th><th className="px-3 py-2.5">Класс</th>{SUBJ.map(s => <th key={s[0]} className="px-3 py-2.5 text-right">{s[1]}</th>)}<th className="px-3 py-2.5 text-left">Статус</th><th className="px-3 py-2.5 text-center">Наблюдение</th><th className="px-3 py-2.5 text-left">Дата</th></tr></thead>
          <tbody>
            {visible.map(r => (
              <tr key={r.id} className="border-t border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] cursor-pointer" onClick={() => setOpen(r.id)}>
                <td className="px-3 py-2"><div className="font-medium text-[var(--text-main)]">{r.name}</div><div className="text-[11px] font-mono text-[var(--text-muted)]">№ {r.shortId}</div></td>
                <td className="px-3 py-2 text-center">{r.grade}</td>
                {SUBJ.map(([k]) => <td key={k} className="px-3 py-2 text-right tabular-nums">{r.scores?.[k] ?? "—"}</td>)}
                <td className="px-3 py-2 text-xs">{[r.status, r.finalDecision].filter(Boolean).join(" · ")}</td>
                <td className="px-3 py-2 text-center text-xs">{r.proctoring?.unavailable ? "без камеры" : r.proctoring?.honestyIndex != null ? `${r.proctoring.honestyIndex}/100` : "—"}</td>
                <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString("ru-RU") : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <ArchiveModal id={open} api={api} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ArchiveModal({ id, api, onClose }: { id: string; api: Api; onClose: () => void }) {
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [dossier, setDossier] = useState(false);
  useEffect(() => { api(`/archive/${id}`).then(setD).catch(e => setError(e.message)); }, [api, id]);
  const s = d?.submission;
  return (
    <Modal title={s ? `${s.studentName} · № ${s.studentShortId}` : "Работа"} onClose={onClose} xwide>
      {error && <div className="text-sm text-rose-600">{error}</div>}
      {!d && !error && <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>}
      {d && (
        <div className="space-y-4">
          <div className="text-sm text-[var(--text-muted)]">{[s.grade && `${s.grade} класс`, s.studentPhone, s.studentEmail, s.parentName && `родитель: ${s.parentName}`].filter(Boolean).join(" · ")}</div>
          <div className="flex flex-wrap gap-2">
            {SUBJ.map(([k, l]) => <div key={k} className="rounded-lg border border-[var(--border-color)] px-3 py-2 text-center"><div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">{l}</div><div className="text-lg font-bold">{s.scores?.[k] ?? "—"}</div></div>)}
            {s.proctoring && <button className={btn} onClick={() => setDossier(true)}><ShieldAlert className="w-4 h-4" /> Досье прокторинга</button>}
          </div>
          {(s.finalDecision || s.managerComment) && <div className="text-sm"><b>Решение:</b> {s.finalDecision || "—"}{s.managerComment ? ` · ${s.managerComment}` : ""}</div>}
          <div>
            <h3 className="font-bold text-[var(--text-main)] mb-2">Ответы ({d.items.length})</h3>
            <ol className="space-y-2">
              {d.items.map((it: any) => {
                const ok = it.question ? isAnswerCorrect(it.answer, it.question.answer) : null;
                return (
                  <li key={it.oldId} className={`rounded-lg border border-[var(--border-color)] border-l-4 p-3 ${ok === null ? "" : ok ? "border-l-emerald-500" : "border-l-rose-500"}`}>
                    <div className="text-[11px] font-mono text-[var(--text-muted)]">{it.question?.id || it.oldId}{it.question?.topic ? ` · ${it.question.topic}` : ""}</div>
                    {it.question && (it.question.html ? <div className="text-sm mt-1 [&_img]:max-h-40" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(it.question.html) }} /> : <div className="text-sm mt-1">{it.question.text}</div>)}
                    <div className="grid sm:grid-cols-2 text-sm mt-1"><div><span className="text-[var(--text-muted)]">Ответ: </span><b>{it.answer || "—"}</b></div>{it.question && <div><span className="text-[var(--text-muted)]">Ключ: </span>{it.question.answer}</div>}</div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
      {dossier && s && <ProctoringDossier shortId={s.studentShortId} studentName={s.studentName} grade={String(s.grade || "")} report={s.proctoring} loadSnapshots={async () => d.snapshots} onClose={() => setDossier(false)} />}
    </Modal>
  );
}
