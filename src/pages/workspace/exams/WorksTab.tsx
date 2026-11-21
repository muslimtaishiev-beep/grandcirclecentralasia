import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, RefreshCw, Search } from "lucide-react";
import { useLive } from "../../../lib/useLive";
import { Button, EmptyState, Spinner, Table, useUrlTab } from "../../../components/ui";
import { input } from "../../../components/ui";
import type { AttemptRow } from "../../../shared/examRun";
import type { Api, ExamListItem } from "./examApi";
import BulkBar from "./BulkBar";
import AttemptViewer from "./AttemptViewer";

type SortKey = "name" | "exam" | "status" | "percent" | "date";
const STATUSES = [["", "Все"], ["in_progress", "Идут"], ["finished", "Сданы"], ["annulled", "Аннулированы"]] as const;
const statusText = (r: AttemptRow) => r.status === "in_progress" ? "идёт" : r.status === "annulled" ? "аннулирована" : `${r.review?.status === "done" ? "проверена" : "сдана"}${(r.card ? r.card.published : r.published) ? " · опубл." : r.card?.publishAt ? " · запл." : ""}${r.superseded ? " · заменена" : ""}`;

/** Все работы организации в одном списке: поиск, фильтры, сортировка, массовые действия. */
export default function WorksTab({ api, tenant }: { api: Api; tenant: any }) {
  const [rows, setRows] = useState<AttemptRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [perm, setPerm] = useState({ canEdit: false, canReview: false });
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useUrlTab<"" | "in_progress" | "finished" | "annulled">("st", STATUSES.map(s => s[0]) as any, "");
  const [examId, setExamId] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: -1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<AttemptRow | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams(); if (status) qs.set("status", status); if (examId) qs.set("examId", examId); if (q.trim()) qs.set("q", q.trim());
      const j = await api(`/attempts?${qs}`);
      setRows(j.attempts); setTotal(j.total); setPerm({ canEdit: !!j.canEdit, canReview: !!j.canReview }); setError(null);
    } catch (e: any) { setError(e.message); }
  }, [api, status, examId, q]);
  useEffect(() => { const t = setTimeout(() => void load(), 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { api("/exams").then(j => setExams(j.exams)).catch(() => {}); }, [api]);
  useLive(tenant?.id, ["exams"], () => { void load(); });

  const sorted = useMemo(() => {
    const val = (r: AttemptRow) => sort.key === "name" ? (r.student?.name || "").toLowerCase() : sort.key === "exam" ? (r.examTitle || "").toLowerCase() : sort.key === "status" ? statusText(r) : sort.key === "percent" ? (r.result?.percent ?? -1) : r.startedAt;
    return [...(rows || [])].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [rows, sort]);
  const sortBy = (key: SortKey) => setSort(p => ({ key, dir: p.key === key ? (p.dir === 1 ? -1 : 1) : key === "name" || key === "exam" ? 1 : -1 }));
  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th><button className="inline-flex items-center gap-1" onClick={() => sortBy(k)}>{children}{sort.key === k && (sort.dir === 1 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</button></th>
  );
  const allOn = sorted.length > 0 && sorted.every(r => selected.has(r.id));
  const toggle = (id: string) => setSelected(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ids = [...selected].filter(id => (rows || []).some(r => r.id === id));
  const examTitle = (id: string) => exams.find(e => e.id === id)?.title;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input className={`${input} pl-9`} placeholder="ФИО, номер работы, экзамен" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className={`${input} !w-auto`} value={examId} onChange={e => setExamId(e.target.value)}>
          <option value="">Все экзамены</option>
          {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <Button icon={<RefreshCw className="w-4 h-4" />} onClick={load} title="Обновить" aria-label="Обновить" />
      </div>
      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
        {STATUSES.map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${status === k ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]"}`}>{l}</button>
        ))}
      </div>
      {error && <div className="text-sm text-rose-600">{error}</div>}
      <BulkBar tenantId={tenant?.id} hasCards={ids.some(id => !!rows?.find(r => r.id === id)?.card)} names={Object.fromEntries((rows || []).map(r => [r.id, r.student.name]))} readyMail={exams.some(e => e.pageDelivery)} api={api} ids={ids} canReview={perm.canReview} canManage={perm.canEdit} onDone={load} onClear={() => setSelected(new Set())} />
      {!rows && !error && <div className="py-12 flex justify-center"><Spinner /></div>}
      {rows && !rows.length && <EmptyState title="Работ нет" />}
      {rows && rows.length > 0 && (
        <>
          <Table minWidth={760}>
            <thead>
              <tr>
                <th className="w-8"><input type="checkbox" aria-label="Выбрать все" checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(sorted.map(r => r.id)))} /></th>
                <Th k="name">Ученик</Th><Th k="exam">Экзамен</Th><Th k="status">Статус</Th><Th k="percent">Итог</Th><Th k="date">Начата</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.id} className={`cursor-pointer ${r.superseded || r.status === "annulled" ? "opacity-60" : ""}`} onClick={() => setOpen(r)}>
                  <td onClick={e => e.stopPropagation()}><input type="checkbox" aria-label="Выбрать" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                  <td><div className="font-medium">{r.student?.name}</div><div className="text-[11px] font-mono text-[var(--text-muted)]">№ {r.shortId}{r.refNo ? ` · поступ. ${String(r.refNo).padStart(4, "0")}` : ""}</div></td>
                  <td className="text-xs">{examTitle(r.examId) || r.examTitle}</td>
                  <td className="text-xs whitespace-nowrap">{statusText(r)}</td>
                  <td className="tabular-nums font-semibold">{r.result ? `${r.result.percent}%` : "—"}</td>
                  <td className="text-xs text-[var(--text-muted)] whitespace-nowrap">{new Date(r.startedAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          {total > rows.length && <div className="text-xs text-[var(--text-muted)]">Показаны первые {rows.length} из {total} — уточните поиск</div>}
        </>
      )}
      {open && <AttemptViewer tenant={tenant} attemptId={open.id} examId={open.examId} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  );
}
