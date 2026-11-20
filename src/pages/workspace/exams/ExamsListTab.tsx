import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLive } from "../../../lib/useLive";
import { Link, useNavigate } from "react-router-dom";
import { Copy, Loader2, Plus, Radio, Search, UserPlus } from "lucide-react";
import { Button, EmptyState } from "../../../components/ui";
import { Modal, btn, btnPrimary, card, input, label } from "../journals/components/ui";
import type { Api, ExamListItem } from "./examApi";

const STATUS = {
  draft: { label: "Черновик", tone: "bg-slate-500/10 text-[var(--text-muted)]" },
  open: { label: "Открыт", tone: "bg-emerald-500/10 text-emerald-700" },
  closed: { label: "Закрыт", tone: "bg-rose-500/10 text-rose-600" },
} as const;

/** Экзамены организации, сгруппированные по папкам («Вступительные 2027»…). */
/** onNewApplicant — у кого право приёма: «+ Поступающий» рядом с «+ Экзамен» и у каждого вступительного теста (класс подставится). */
export default function ExamsListTab({ api, tenantId, onNewApplicant }: { api: Api; tenantId: string; onNewApplicant?: (grade?: number, examId?: string) => void }) {
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | ExamListItem["status"]>("");
  const [creating, setCreating] = useState<null | { copyFrom?: string }>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try { const j = await api("/exams"); setExams(j.exams); setCanEdit(j.canEdit); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);
  useEffect(() => { void load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);
  useLive(tenantId, ["exams"], () => { void load(); });

  const groups = useMemo(() => {
    const m = new Map<string, ExamListItem[]>();
    const t = q.trim().toLowerCase();
    for (const e of exams.filter(x => (!status || x.status === status) && (!t || `${x.title} ${x.group}`.toLowerCase().includes(t)))) m.set(e.group || "", [...(m.get(e.group || "") || []), e]);
    return [...m];
  }, [exams, q, status]);

  if (loading) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>;

  return (
    <div className="space-y-4">
      {error && <div className="text-sm text-rose-600">{error}</div>}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input className={`${input} pl-9`} placeholder="Название или папка" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {([["", "Все"], ["open", "Открыты"], ["draft", "Черновики"], ["closed", "Закрыты"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setStatus(k)} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${status === k ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]"}`}>{l}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0 ml-auto">
          {onNewApplicant && <Button variant="primary" icon={<UserPlus className="w-4 h-4" />} onClick={() => onNewApplicant()}>Поступающий</Button>}
          {canEdit && <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreating({})}>Экзамен</Button>}
        </div>
      </div>
      {!groups.length && <EmptyState title={exams.length ? "Ничего не найдено" : "Экзаменов пока нет"} action={canEdit && !exams.length ? <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreating({})}>Экзамен</Button> : undefined} />}
      {groups.map(([group, list]) => (
        <section key={group} className="space-y-2">
          {group && <h3 className="text-[11px] uppercase font-mono font-bold text-[var(--text-muted)]">{group}</h3>}
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {list.map(e => (
              <div key={e.id} className={`${card} p-4 hover:border-[var(--accent)] transition`}>
                <Link to={`/workspace/${tenantId}/exams/${e.id}`} className="block">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-[var(--text-main)]">{e.title}</div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS[e.status].tone}`}>{STATUS[e.status].label}</span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">{e.sections} дисц. · сдали {e.done}</div>
                  {e.live > 0 && <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700"><Radio className="w-3.5 h-3.5 animate-pulse" /> Сейчас сдают: {e.live}</div>}
                </Link>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {onNewApplicant && !!e.grades?.length && <button className="text-xs font-medium text-[var(--accent)] hover:underline inline-flex items-center gap-1" onClick={() => onNewApplicant(e.grades!.length === 1 ? e.grades![0] : undefined, e.id)}><UserPlus className="w-3.5 h-3.5" /> Поступающий{e.grades!.length === 1 ? ` в ${e.grades![0]} класс` : ""}</button>}
                  {canEdit && <button className="text-xs text-[var(--accent)] hover:underline inline-flex items-center gap-1" onClick={() => setCreating({ copyFrom: e.id })}><Copy className="w-3 h-3" /> Копия</button>}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      {creating && (
        <CreateExam api={api} copyFrom={creating.copyFrom ? exams.find(x => x.id === creating.copyFrom) : undefined}
          groups={[...new Set(exams.map(e => e.group).filter(Boolean))]}
          onClose={() => setCreating(null)} onDone={id => navigate(`/workspace/${tenantId}/exams/${id}`)} />
      )}
    </div>
  );
}

function CreateExam({ api, copyFrom, groups, onClose, onDone }: { api: Api; copyFrom?: ExamListItem; groups: string[]; onClose: () => void; onDone: (id: string) => void }) {
  const [title, setTitle] = useState(copyFrom ? `${copyFrom.title} (копия)` : "");
  const [group, setGroup] = useState(copyFrom?.group || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal title={copyFrom ? `Копия: ${copyFrom.title}` : "Новый экзамен"} onClose={onClose}>
      <div className="space-y-3">
        <div><span className={label}>Название</span><input className={input} value={title} onChange={e => setTitle(e.target.value)} placeholder="Вступительный, 7 класс" autoFocus /></div>
        <div>
          <span className={label}>Папка (необязательно)</span>
          <input className={input} value={group} onChange={e => setGroup(e.target.value)} list="exam-groups" placeholder="Вступительные 2027" />
          <datalist id="exam-groups">{groups.map(g => <option key={g} value={g} />)}</datalist>
        </div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-end gap-2">
          <button className={btn} onClick={onClose}>Отмена</button>
          <button className={btnPrimary} disabled={busy} onClick={async () => {
            setBusy(true); setError(null);
            try { const j = await api("/exams", { method: "POST", body: JSON.stringify({ title, group, copyFrom: copyFrom?.id }) }); onDone(j.exam.id); }
            catch (e: any) { setError(e.message); setBusy(false); }
          }}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Создать</button>
        </div>
      </div>
    </Modal>
  );
}
