import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Layers, Loader2, Plus, Search, X } from "lucide-react";
import { QUESTION_TYPES, TYPE_LABEL, plainText, type BankQuestion, type QuestionType } from "../../../shared/exams";
import { Modal, btn, btnPrimary, input } from "../journals/components/ui";
import type { Api, SetRow } from "./examApi";
import QuestionEditor, { type Draft } from "./QuestionEditor";

/**
 * Точечный выбор вопросов в раздел экзамена: отметить нужные вопросы
 * дисциплины (с фильтрами по набору, классу, типу) и расставить порядок.
 * Новый вопрос, созданный отсюда, сразу попадает в выбранные.
 */
export default function QuestionPicker({ bankApi, disciplineId, title, sets, initial, canEdit, onApply, onClose }: {
  bankApi: Api; disciplineId: string; title: string; sets: SetRow[]; initial: string[]; canEdit: boolean;
  onApply: (ids: string[]) => void; onClose: () => void;
}) {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>(initial);
  const [search, setSearch] = useState("");
  const [setFilter, setSetFilter] = useState("");
  const [level, setLevel] = useState("");
  const [type, setType] = useState<"" | QuestionType>("");
  const [onlyPicked, setOnlyPicked] = useState(false);
  const [creating, setCreating] = useState(false);
  const [limit, setLimit] = useState(150);

  const load = useCallback(async () => {
    try { const j = await bankApi(`/questions?discipline=${encodeURIComponent(disciplineId)}`); setQuestions(j.questions); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [bankApi, disciplineId]);
  useEffect(() => { void load(); }, [load]);

  const byId = useMemo(() => new Map(questions.map(q => [q.id, q])), [questions]);
  const pickedSet = useMemo(() => new Set(picked), [picked]);
  const levels = useMemo(() => [...new Set(questions.flatMap(q => q.levels))].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b)), [questions]);
  const setName = useMemo(() => new Map(sets.map(x => [x.id, x.name])), [sets]);
  const visible = useMemo(() => {
    const s = search.trim().toLowerCase().replace(/ё/g, "е");
    return questions.filter(q => {
      if (onlyPicked && !pickedSet.has(q.id)) return false;
      if (setFilter && !(q.sets || []).includes(setFilter)) return false;
      if (level && !q.levels.includes(level)) return false;
      if (type && q.type !== type) return false;
      return !s || `${q.id} ${q.topic} ${plainText(q)}`.toLowerCase().replace(/ё/g, "е").includes(s);
    });
  }, [questions, search, setFilter, level, type, onlyPicked, pickedSet]);

  const toggle = (id: string) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  const move = (i: number, d: number) => setPicked(p => { const n = [...p]; const j = i + d; if (j < 0 || j >= n.length) return p; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const allVisible = visible.length > 0 && visible.every(q => pickedSet.has(q.id));
  const addVisible = () => setPicked(p => (allVisible ? p.filter(id => !visible.some(q => q.id === id)) : [...p, ...visible.map(q => q.id).filter(id => !p.includes(id))]));

  const create = async (d: Draft) => {
    const j = await bankApi("/questions", { method: "POST", body: JSON.stringify({ ...d, disciplineId }) });
    setCreating(false);
    await load();
    setPicked(p => [...p, j.question.id]);
  };

  return (
    <Modal title={`Вопросы раздела «${title}»`} onClose={onClose} xwide>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input className={`${input} pl-9`} placeholder="Номер, тема, текст…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {sets.length > 0 && (
              <select className={`${input} !w-auto`} value={setFilter} onChange={e => setSetFilter(e.target.value)}>
                <option value="">Все наборы</option>
                {sets.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            )}
            {levels.length > 0 && (
              <select className={`${input} !w-auto`} value={level} onChange={e => setLevel(e.target.value)}>
                <option value="">Все классы</option>
                {levels.map(l => <option key={l} value={l}>{l} класс</option>)}
              </select>
            )}
            <select className={`${input} !w-auto`} value={type} onChange={e => setType(e.target.value as any)}>
              <option value="">Все типы</option>
              {QUESTION_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={allVisible} onChange={addVisible} disabled={!visible.length} /> Отметить все найденные ({visible.length})</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={onlyPicked} onChange={e => setOnlyPicked(e.target.checked)} /> Только отмеченные</label>
            {canEdit && <button className="ml-auto text-[var(--accent)] hover:underline inline-flex items-center gap-1" onClick={() => setCreating(true)}><Plus className="w-3.5 h-3.5" /> Новый вопрос</button>}
          </div>
          <div className="rounded-xl border border-[var(--border-color)] max-h-[55vh] overflow-y-auto">
            {loading && <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" /></div>}
            {!loading && !visible.length && <div className="py-10 text-center text-sm text-[var(--text-muted)]">{questions.length ? "Ничего не найдено" : "В дисциплине пока нет вопросов"}</div>}
            {visible.slice(0, limit).map(q => {
              const on = pickedSet.has(q.id);
              return (
                <label key={q.id} className={`flex gap-3 px-3 py-2.5 border-t border-[var(--border-color)] first:border-0 cursor-pointer ${on ? "bg-[var(--accent)]/5" : "hover:bg-[var(--bg-surface-hover)]"} ${q.active ? "" : "opacity-60"}`}>
                  <input type="checkbox" className="mt-1" checked={on} onChange={() => toggle(q.id)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="font-mono font-bold text-[var(--text-main)]">{q.id}</span>
                      <span className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-hover)] text-[var(--text-muted)]">{TYPE_LABEL[q.type]}</span>
                      {q.levels.length > 0 && <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-700">кл. {q.levels.join(", ")}</span>}
                      {(q.sets || []).map(id => setName.has(id) && <span key={id} className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-700">{setName.get(id)}</span>)}
                      {!q.active && <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600">выключен — ученик не получит</span>}
                    </div>
                    <div className="text-sm text-[var(--text-main)] mt-0.5 line-clamp-2">{plainText(q) || "—"}</div>
                  </div>
                </label>
              );
            })}
            {visible.length > limit && <button className="w-full py-2.5 text-sm text-[var(--accent)] hover:bg-[var(--bg-surface-hover)] border-t border-[var(--border-color)]" onClick={() => setLimit(l => l + 300)}>Показать ещё ({visible.length - limit})</button>}
          </div>
        </div>

        {/* Отмеченные — в порядке прохождения */}
        <div className="space-y-2 min-w-0">
          <div className="flex items-center justify-between">
            <b className="text-sm text-[var(--text-main)]">Отмечено: {picked.length}</b>
            {picked.length > 1 && (
              <button className="text-xs text-[var(--accent)] hover:underline" title="Расставить как в банке"
                onClick={() => setPicked(p => [...p].sort((a, b) => (byId.get(a)?.number ?? 1e9) - (byId.get(b)?.number ?? 1e9)))}>По номерам</button>
            )}
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">Ученик проходит их в этом порядке (если в разделе не включено «Перемешать»).</p>
          <ol className="rounded-xl border border-[var(--border-color)] max-h-[55vh] overflow-y-auto">
            {!picked.length && <li className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">Отметьте вопросы слева</li>}
            {picked.map((id, i) => {
              const q = byId.get(id);
              return (
                <li key={id} className="flex items-center gap-1.5 px-2 py-1.5 border-t border-[var(--border-color)] first:border-0 text-xs">
                  <span className="w-6 text-right text-[var(--text-muted)] tabular-nums">{i + 1}.</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-mono font-bold text-[var(--text-main)]">{id}</span>
                    <span className={`block truncate ${q ? "text-[var(--text-muted)]" : "text-rose-600"}`}>{q ? plainText(q) : loading ? "…" : "нет в банке — будет пропущен"}</span>
                  </span>
                  <button className="p-1 rounded hover:bg-[var(--bg-surface-hover)] disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="w-3.5 h-3.5" /></button>
                  <button className="p-1 rounded hover:bg-[var(--bg-surface-hover)] disabled:opacity-30" disabled={i === picked.length - 1} onClick={() => move(i, 1)}><ArrowDown className="w-3.5 h-3.5" /></button>
                  <button className="p-1 rounded hover:bg-[var(--bg-surface-hover)] text-rose-600" onClick={() => toggle(id)}><X className="w-3.5 h-3.5" /></button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      {error && <div className="text-sm text-rose-600 mt-2">{error}</div>}
      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[var(--border-color)]">
        <button className={btn} onClick={onClose}>Отмена</button>
        <button className={btnPrimary} onClick={() => onApply(picked)}><Layers className="w-4 h-4" /> Готово ({picked.length})</button>
      </div>
      {creating && (
        <QuestionEditor initial={null} disciplineId={disciplineId} canEdit={canEdit} allSets={sets}
          defaultSets={setFilter ? [setFilter] : []} defaultLevels={level ? [level] : []}
          onSave={create} onClose={() => setCreating(false)} />
      )}
    </Modal>
  );
}
