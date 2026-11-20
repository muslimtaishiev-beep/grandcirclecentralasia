import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLive } from "../../../lib/useLive";
import { ArrowDown, ArrowUp, Download, Loader2, Radio, RefreshCw, Search, Send, ShieldAlert } from "lucide-react";
import { confirmDialog, toast } from "../../../components/ui";
import BulkBar from "./BulkBar";
import { DECISION_LABEL, partResults, type AttemptRow, type Exam } from "../../../shared/examRun";
import { btn, btnPrimary, card, input } from "../journals/components/ui";
import type { Api } from "./examApi";
import AttemptModal from "./AttemptModal";
import { exportExamXlsx } from "./examExcel";

/**
 * Работы экзамена: кто сдаёт сейчас (раздел и оставшееся время) и кто сдал —
 * с баллами, проверкой, публикацией и прокторингом. Обновляется сама.
 */
export default function AttemptsTab({ exam, api, tenant, canEdit, canReview }: { exam: Exam; api: Api; tenant: any; canEdit: boolean; canReview: boolean }) {
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [skew, setSkew] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "live" | "done" | "unreviewed" | "unpublished" | "flagged" | "annulled">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: "name" | "status" | "percent" | "date"; dir: 1 | -1 }>({ key: "date", dir: -1 });
  const s = exam.settings;
  const parts = s.scoring.parts || [];
  const hideTotal = parts.length > 0 && !!s.scoring.hideTotal;

  const load = useCallback(async () => {
    try { const j = await api(`/exams/${exam.id}/attempts`); setRows(j.attempts); setSkew(j.serverNow - Date.now()); setError(null); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api, exam.id]);
  useEffect(() => { void load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);
  useLive(tenant?.id, ["exams"], () => { void load(); });
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const flagged = (r: AttemptRow) => (r.proctoring?.bySeverity?.HIGH || 0) > 0 || (typeof r.proctoring?.honestyIndex === "number" && r.proctoring.honestyIndex < 60);
  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = rows.filter(r => {
      if (r.superseded && filter !== "all") return false;
      if (filter === "live" && r.status !== "in_progress") return false;
      if (filter === "done" && r.status !== "finished") return false;
      if (filter === "annulled" && r.status !== "annulled") return false;
      if (filter === "unreviewed" && !(r.status === "finished" && r.review?.status !== "done")) return false;
      if (filter === "unpublished" && !(r.status === "finished" && !r.published)) return false;
      if (filter === "flagged" && !flagged(r)) return false;
      if (filter !== "annulled" && filter !== "all" && r.status === "annulled") return false;
      return !t || `${r.student.name} ${r.shortId} ${r.student.phone} ${r.student.level} ${r.group || ""} ${r.refNo ? String(r.refNo).padStart(4, "0") : ""}`.toLowerCase().includes(t);
    });
    const val = (r: AttemptRow) => sort.key === "name" ? r.student.name.toLowerCase() : sort.key === "status" ? `${r.status}${r.review?.status}${r.published}` : sort.key === "percent" ? (r.result?.percent ?? -1) : r.startedAt;
    return [...list].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [rows, q, filter, sort]);
  const sortBy = (key: typeof sort.key) => setSort(p => ({ key, dir: p.key === key ? (p.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1 }));
  const Th = ({ k, children, right }: { k: typeof sort.key; children: React.ReactNode; right?: boolean }) => (
    <th className={`px-3 py-2.5 ${right ? "text-right" : "text-left"}`}><button className="inline-flex items-center gap-1 uppercase" onClick={() => sortBy(k)}>{children}{sort.key === k && (sort.dir === 1 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</button></th>
  );
  const ids = [...selected].filter(id => rows.some(r => r.id === id));
  const allOn = visible.length > 0 && visible.every(r => selected.has(r.id));
  const toggleAll = () => setSelected(allOn ? new Set() : new Set(visible.map(r => r.id)));
  const toggle = (id: string) => setSelected(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const live = rows.filter(r => r.status === "in_progress").length;
  const done = rows.filter(r => r.status === "finished" && !r.superseded).length;
  const left = (deadline: number | null) => {
    if (!deadline) return "";
    const ms = deadline - (now + skew);
    if (ms <= 0) return "время вышло";
    const m = Math.floor(ms / 60000), sec = Math.floor((ms % 60000) / 1000);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const publishAll = async () => {
    setBusy(true);
    try {
      const j = await api(`/exams/${exam.id}/publish-all`, { method: "POST" });
      toast.success(`Опубликовано: ${j.count}${j.waitingReview ? `. Ждут проверки: ${j.waitingReview}` : ""}`);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const recheckAll = async () => {
    if (!(await confirmDialog({ title: "Перепроверить все сданные работы?", message: "Ключи — из банка сейчас, ручные оценки сохранятся", confirmLabel: "Перепроверить" }))) return;
    setBusy(true);
    try {
      const j = await api(`/exams/${exam.id}/recheck-all`, { method: "POST" });
      toast.success(`Перепроверено работ: ${j.total}. Изменился результат: ${j.changed}`);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const excel = async () => {
    setBusy(true);
    try { const j = await api(`/exams/${exam.id}/attempts?full=1`); await exportExamXlsx(exam, j.attempts); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const FILTERS: [typeof filter, string][] = [
    ["all", `Все (${rows.length})`], ["live", `Сдают сейчас (${live})`], ["done", `Сдали (${done})`],
    ["unreviewed", "Не проверены"], ["unpublished", "Не опубликованы"], ...(s.proctoring.enabled ? [["flagged", "Нарушения"] as [typeof filter, string]] : []), ["annulled", "Аннулированы"],
  ];

  return (
    <div className="space-y-3">
      <div className={`${card} p-3 flex flex-wrap items-center gap-2`}>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input className={`${input} pl-9`} placeholder="ФИО, номер работы или поступающего, телефон" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {canReview && s.results.showToStudent === "after_publish" && <button className={btnPrimary} disabled={busy} onClick={publishAll}><Send className="w-4 h-4" /> Опубликовать готовые</button>}
        {canReview && <button className={btn} disabled={busy || !done} onClick={recheckAll}><RefreshCw className="w-4 h-4" /> Перепроверить все</button>}
        <button className={btn} disabled={busy || !rows.length} onClick={excel}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Excel</button>
        <button className={btn} onClick={load} title="Обновить"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${filter === k ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]"}`}>{l}</button>
        ))}
      </div>
      {error && <div className="text-sm text-rose-600">{error}</div>}
      <BulkBar api={api} ids={ids} canReview={canReview} canManage={canEdit} onDone={load} onClear={() => setSelected(new Set())} />

      {/* Пусто — отдельной карточкой: внутри широкой таблицы надпись на телефоне уезжала за край. */}
      {!loading && !visible.length && (
        <div className={`${card} px-4 py-10 text-center text-sm text-[var(--text-muted)]`}>{rows.length ? "Ничего не найдено" : "Работ пока нет"}</div>
      )}
      <div className={`${card} overflow-x-auto ${!loading && !visible.length ? "hidden" : ""}`}>
        <table className="w-full text-sm min-w-[860px]">
          <thead className="text-[11px] uppercase font-mono text-[var(--text-muted)] bg-[var(--bg-panel)]">
            <tr>
              <th className="px-3 py-2.5 w-8"><input type="checkbox" aria-label="Выбрать все" checked={allOn} onChange={toggleAll} /></th>
              <Th k="name">Ученик</Th>
              {s.registration.level && <th className="px-3 py-2.5 text-left">{s.registration.levelLabel}</th>}
              <Th k="status">Статус</Th>
              {parts.map(p => <th key={p.id} className="px-3 py-2.5 text-right whitespace-nowrap">{p.title}</th>)}
              {!hideTotal && <Th k="percent" right>Итог</Th>}
              {exam.sections.map(x => <th key={x.id} className="px-3 py-2.5 text-right whitespace-nowrap">{x.title}</th>)}
              {!hideTotal && (s.scoring.marks.enabled || s.scoring.scale.length > 0) && <th className="px-3 py-2.5 text-left">Оценка</th>}
              {s.proctoring.enabled && <th className="px-3 py-2.5 text-center">Наблюдение</th>}
              {(s.results.decisions || s.results.groups.length > 0) && <th className="px-3 py-2.5 text-left">Решение</th>}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={20} className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin inline text-[var(--text-muted)]" /></td></tr>}
            {visible.map(r => {
              const cur = r.status === "in_progress" ? r.sections[r.current] : null;
              return (
                <tr key={r.id} className={`border-t border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] cursor-pointer ${r.superseded || r.status === "annulled" ? "opacity-50" : ""}`} onClick={() => setOpen(r.id)}>
                  <td className="px-3 py-2 w-8" onClick={e => e.stopPropagation()}><input type="checkbox" aria-label="Выбрать" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                  <td className="px-3 py-2"><div className="font-medium text-[var(--text-main)]">{r.student.name}</div><div className="text-[11px] text-[var(--text-muted)] font-mono">№ {r.shortId}{r.refNo ? ` · поступ. ${String(r.refNo).padStart(4, "0")}` : ""}{r.superseded ? " · заменена" : ""}</div></td>
                  {s.registration.level && <td className="px-3 py-2 text-[var(--text-muted)]">{r.student.level}</td>}
                  <td className="px-3 py-2 whitespace-nowrap">
                    {cur ? <span className="inline-flex items-center gap-1.5 text-emerald-700 text-xs font-medium"><Radio className="w-3.5 h-3.5 animate-pulse" /> {r.current + 1}/{r.sections.length} · {cur.title} · {left(cur.deadline)}<span className="text-[var(--text-muted)] font-normal">· {r.answered}/{r.questionCount}</span></span>
                      : r.status === "annulled" ? <span className="text-xs text-rose-600">аннулирована</span>
                      : <span className="text-xs text-[var(--text-muted)]">{r.review?.status === "done" ? "проверено" : "сдано"}{r.published ? " · опубл." : ""}</span>}
                  </td>
                  {r.result ? partResults(r.result.sections, s.scoring).map(p => <td key={p.id} className="px-3 py-2 text-right tabular-nums font-bold text-[var(--text-main)] whitespace-nowrap">{p.value}</td>) : parts.map(p => <td key={p.id} className="px-3 py-2 text-right">—</td>)}
                  {!hideTotal && <td className="px-3 py-2 text-right tabular-nums font-bold text-[var(--text-main)]">{r.result ? `${r.result.percent}%` : "—"}</td>}
                  {exam.sections.map(x => <td key={x.id} className="px-3 py-2 text-right tabular-nums text-[var(--text-muted)]">{r.result?.sections.find(y => y.id === x.id)?.percent ?? "—"}{r.result ? "%" : ""}</td>)}
                  {!hideTotal && (s.scoring.marks.enabled || s.scoring.scale.length > 0) && <td className="px-3 py-2 text-xs">{[r.result?.mark, r.result?.scaleLabel].filter(x => x != null && x !== "").join(" · ")}</td>}
                  {s.proctoring.enabled && (
                    <td className="px-3 py-2 text-center text-xs">
                      {r.proctoring?.unavailable ? <span className="text-amber-700">без камеры</span>
                        : typeof r.proctoring?.honestyIndex === "number" ? <span className={flagged(r) ? "text-rose-600 font-semibold" : "text-[var(--text-muted)]"}>{flagged(r) && <ShieldAlert className="inline w-3.5 h-3.5 -mt-0.5 mr-0.5" />}{r.proctoring.honestyIndex}/100</span> : "—"}
                    </td>
                  )}
                  {(s.results.decisions || s.results.groups.length > 0) && <td className="px-3 py-2 text-xs">{[r.decision ? DECISION_LABEL[r.decision.value] : "", r.group || ""].filter(Boolean).join(" · ")}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open && <AttemptModal attemptId={open} exam={exam} api={api} tenant={tenant} canEdit={canEdit} onChanged={load} onClose={() => setOpen(null)} />}
    </div>
  );
}
