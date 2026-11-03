import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import {
  DIFFICULTY_LABEL, QUESTION_TYPES, TYPE_LABEL, plainText,
  type BankQuestion, type Difficulty, type QuestionType,
} from "../../../shared/exams";
import { Modal, btn, btnPrimary, card, input, label } from "../journals/components/ui";
import type { DisciplineRow } from "./examApi";
import QuestionEditor, { type Draft } from "./QuestionEditor";
import ImportModal from "./ImportModal";
import { exportBankXlsx } from "./bankSheets";

type Api = (path: string, init?: RequestInit) => Promise<any>;

/**
 * Банк вопросов: дисциплины слева, вопросы справа.
 *
 * Дисциплина — код и название; у каждого вопроса номер «КОД-0001». Фильтры
 * по классу, типу, сложности и активности, массовые действия, импорт и
 * выгрузка в Excel.
 */
export default function BankTab({ api }: { api: Api }) {
  const [disciplines, setDisciplines] = useState<DisciplineRow[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [code, setCode] = useState<string>("");
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingQ, setLoadingQ] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("");
  const [type, setType] = useState<"" | QuestionType>("");
  const [diff, setDiff] = useState<"" | "1" | "2" | "3">("");
  const [state, setState] = useState<"active" | "inactive" | "all">("active");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(100);

  const [editing, setEditing] = useState<BankQuestion | "new" | null>(null);
  const [discModal, setDiscModal] = useState<DisciplineRow | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [bulkLevels, setBulkLevels] = useState<string | null>(null);

  const loadDisciplines = useCallback(async () => {
    const j = await api("/disciplines");
    setDisciplines(j.disciplines); setCanEdit(!!j.canEdit);
    setCode(c => c || j.disciplines[0]?.code || "");
    return j.disciplines as DisciplineRow[];
  }, [api]);

  useEffect(() => {
    setLoading(true);
    loadDisciplines().catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [loadDisciplines]);

  const loadQuestions = useCallback(async () => {
    if (!code) { setQuestions([]); return; }
    setLoadingQ(true);
    try { const j = await api(`/questions?discipline=${encodeURIComponent(code)}`); setQuestions(j.questions); }
    catch (e: any) { setError(e.message); }
    finally { setLoadingQ(false); }
  }, [api, code]);
  useEffect(() => { setSelected(new Set()); setLimit(100); setLevel(""); void loadQuestions(); }, [loadQuestions]);

  const disc = disciplines.find(d => d.code === code);
  const levels = useMemo(() => [...new Set(questions.flatMap(q => q.levels))].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b)), [questions]);
  const visible = useMemo(() => {
    const s = search.trim().toLowerCase().replace(/ё/g, "е");
    return questions.filter(q => {
      if (state === "active" && !q.active) return false;
      if (state === "inactive" && q.active) return false;
      if (level === "—" ? q.levels.length > 0 : level && !q.levels.includes(level)) return false;
      if (type && q.type !== type) return false;
      if (diff && String(q.difficulty) !== diff) return false;
      if (s && !`${q.id} ${q.topic} ${plainText(q)} ${q.answer}`.toLowerCase().replace(/ё/g, "е").includes(s)) return false;
      return true;
    });
  }, [questions, search, level, type, diff, state]);

  const refreshAll = async () => { await Promise.all([loadDisciplines(), loadQuestions()]); };

  const saveQuestion = async (d: Draft) => {
    const body = JSON.stringify(d);
    if (editing && editing !== "new") await api(`/questions/${editing.id}`, { method: "PUT", body });
    else await api("/questions", { method: "POST", body: JSON.stringify({ ...d, disciplineId: code }) });
    setEditing(null);
    await refreshAll();
  };

  const bulk = async (action: string, extra: Record<string, unknown> = {}) => {
    if (action === "delete" && !confirm(`Удалить ${selected.size} вопросов насовсем? Вернуть их можно будет только из бэкапа.`)) return;
    try {
      await api("/questions/bulk", { method: "POST", body: JSON.stringify({ ids: [...selected], action, ...extra }) });
      setSelected(new Set()); await refreshAll();
    } catch (e: any) { alert(e.message); }
  };

  if (loading) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>;

  const allChecked = visible.length > 0 && visible.slice(0, limit).every(q => selected.has(q.id));

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-4 items-start">
      {/* Дисциплины */}
      <aside className={`${card} p-2`}>
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-[11px] uppercase font-mono font-bold text-[var(--text-muted)]">Дисциплины</span>
          {canEdit && <button className="p-1 rounded hover:bg-[var(--bg-surface-hover)] text-[var(--accent)]" title="Новая дисциплина" onClick={() => setDiscModal("new")}><Plus className="w-4 h-4" /></button>}
        </div>
        <div className="flex lg:flex-col gap-1 overflow-x-auto hide-scrollbar">
          {disciplines.map(d => (
            <button key={d.code} onClick={() => setCode(d.code)}
              className={`shrink-0 text-left rounded-xl px-3 py-2 transition ${d.code === code ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--bg-surface-hover)] text-[var(--text-main)]"}`}>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${d.code === code ? "bg-white/20" : "bg-[var(--bg-surface-hover)] text-[var(--text-muted)]"}`}>{d.code}</span>
                <span className="font-medium text-sm truncate">{d.name}</span>
              </div>
              <div className={`text-[11px] mt-0.5 ${d.code === code ? "text-white/80" : "text-[var(--text-muted)]"}`}>
                {d.active} акт.{d.total > d.active ? ` · ${d.total - d.active} выкл.` : ""}{d.levels.length ? ` · кл. ${d.levels.join(", ")}` : ""}
              </div>
            </button>
          ))}
          {!disciplines.length && <p className="text-sm text-[var(--text-muted)] px-2 py-3">Дисциплин пока нет. {canEdit ? "Создайте первую или загрузите таблицу." : ""}</p>}
        </div>
        <div className="flex flex-wrap gap-1.5 p-2 border-t border-[var(--border-color)] mt-2">
          {canEdit && <button className={btn} onClick={() => setImporting(true)}><Upload className="w-4 h-4" /> Загрузить таблицу</button>}
          <button className={btn} onClick={async () => { const j = await api("/questions"); await exportBankXlsx(j.questions, "Банк вопросов"); }}><FileSpreadsheet className="w-4 h-4" /> Весь банк в Excel</button>
        </div>
      </aside>

      {/* Вопросы */}
      <section className="space-y-3 min-w-0">
        {error && <div className="text-sm text-rose-600">{error}</div>}
        {disc && (
          <div className={`${card} p-4 flex flex-wrap items-center gap-3`}>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)]">{disc.code}</span>
                <h2 className="text-lg font-bold text-[var(--text-main)]">{disc.name}</h2>
                {canEdit && <button className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)]" onClick={() => setDiscModal(disc)} title="Переименовать"><Pencil className="w-3.5 h-3.5" /></button>}
              </div>
              {disc.description && <p className="text-xs text-[var(--text-muted)] mt-0.5">{disc.description}</p>}
            </div>
            <button className={btn} onClick={() => exportBankXlsx(questions, `Банк ${disc.code} ${disc.name}`)}><Download className="w-4 h-4" /> Excel</button>
            {canEdit && <button className={btnPrimary} onClick={() => setEditing("new")}><Plus className="w-4 h-4" /> Вопрос</button>}
          </div>
        )}

        {disc && (
          <div className={`${card} p-3 space-y-2`}>
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input className={`${input} pl-9`} placeholder="Номер, тема, текст, ответ…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className={`${input} !w-auto`} value={type} onChange={e => setType(e.target.value as any)}>
                <option value="">Все типы</option>
                {QUESTION_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <select className={`${input} !w-auto`} value={diff} onChange={e => setDiff(e.target.value as any)}>
                <option value="">Любая сложность</option>
                {([1, 2, 3] as Difficulty[]).map(x => <option key={x} value={x}>{DIFFICULTY_LABEL[x]}</option>)}
              </select>
              <select className={`${input} !w-auto`} value={state} onChange={e => setState(e.target.value as any)}>
                <option value="active">Активные</option>
                <option value="inactive">Выключенные</option>
                <option value="all">Все</option>
              </select>
            </div>
            {levels.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
                {["", ...levels, ...(questions.some(q => !q.levels.length) ? ["—"] : [])].map(l => (
                  <button key={l || "all"} onClick={() => setLevel(l)}
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border ${level === l ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]"}`}>
                    {l === "" ? "Все классы" : l === "—" ? "Без класса" : `${l} класс`}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {selected.size > 0 && canEdit && (
          <div className={`${card} p-3 flex flex-wrap items-center gap-2 border-[var(--accent)] sticky top-0 z-20`}>
            <b className="text-sm text-[var(--text-main)]">Выбрано: {selected.size}</b>
            <button className={btn} onClick={() => bulk("activate")}>Включить</button>
            <button className={btn} onClick={() => bulk("deactivate")}>Выключить</button>
            <button className={btn} onClick={() => setBulkLevels("")}>Классы…</button>
            <select className={`${input} !w-auto`} value="" onChange={e => e.target.value && bulk("difficulty", { difficulty: Number(e.target.value) })}>
              <option value="">Сложность…</option>
              {([1, 2, 3] as Difficulty[]).map(x => <option key={x} value={x}>{DIFFICULTY_LABEL[x]}</option>)}
            </select>
            <button className={`${btn} text-rose-600`} onClick={() => bulk("delete")}><Trash2 className="w-4 h-4" /> Удалить</button>
            <button className={btn} onClick={() => setSelected(new Set())}><X className="w-4 h-4" /></button>
          </div>
        )}

        {disc && (
          <div className={`${card} overflow-hidden`}>
            <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border-color)] text-xs text-[var(--text-muted)]">
              {canEdit && <input type="checkbox" checked={allChecked} onChange={e => setSelected(e.target.checked ? new Set(visible.slice(0, limit).map(q => q.id)) : new Set())} />}
              <span>{loadingQ ? "Загрузка…" : visible.length === questions.length ? `${questions.length} вопросов` : `${visible.length} из ${questions.length}`}</span>
            </div>
            {!loadingQ && visible.length === 0 && <div className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">{questions.length ? "Ничего не найдено" : "В дисциплине пока нет вопросов"}</div>}
            <ul>
              {visible.slice(0, limit).map(q => (
                <li key={q.id} className={`flex gap-3 px-4 py-3 border-t border-[var(--border-color)] first:border-0 hover:bg-[var(--bg-surface-hover)] cursor-pointer ${q.active ? "" : "opacity-60"}`} onClick={() => setEditing(q)}>
                  {canEdit && <input type="checkbox" className="mt-1" checked={selected.has(q.id)} onClick={e => e.stopPropagation()} onChange={e => setSelected(p => { const n = new Set(p); if (e.target.checked) n.add(q.id); else n.delete(q.id); return n; })} />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="font-mono font-bold text-[var(--text-main)]">{q.id}</span>
                      <span className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-hover)] text-[var(--text-muted)]">{TYPE_LABEL[q.type]}</span>
                      {q.levels.length > 0 && <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-700">кл. {q.levels.join(", ")}</span>}
                      <span className="text-[var(--text-muted)]">{"●".repeat(q.difficulty)}{"○".repeat(3 - q.difficulty)}</span>
                      {q.topic && <span className="text-[var(--text-muted)] truncate max-w-[220px]">{q.topic}</span>}
                      {!q.active && <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600">выключен</span>}
                    </div>
                    <div className="text-sm text-[var(--text-main)] mt-1 line-clamp-2">{plainText(q) || "—"}</div>
                    <div className="text-xs text-emerald-700 mt-0.5 truncate">Ответ: {q.answer}</div>
                  </div>
                </li>
              ))}
            </ul>
            {visible.length > limit && <button className="w-full py-3 text-sm text-[var(--accent)] hover:bg-[var(--bg-surface-hover)] border-t border-[var(--border-color)]" onClick={() => setLimit(l => l + 200)}>Показать ещё ({visible.length - limit})</button>}
          </div>
        )}
      </section>

      {editing && (
        <QuestionEditor initial={editing === "new" ? null : editing} disciplineId={code} canEdit={canEdit}
          defaultLevels={level && level !== "—" ? [level] : []}
          onSave={saveQuestion} onClose={() => setEditing(null)} />
      )}
      {discModal && (
        <DisciplineModal initial={discModal === "new" ? null : discModal} api={api}
          onDone={async (c) => { setDiscModal(null); await loadDisciplines(); if (c) setCode(c); }}
          onClose={() => setDiscModal(null)} />
      )}
      {importing && <ImportModal api={api} disciplines={disciplines} onClose={() => setImporting(false)} onDone={async () => { setImporting(false); await refreshAll(); }} />}
      {bulkLevels !== null && (
        <Modal title={`Классы для ${selected.size} вопросов`} onClose={() => setBulkLevels(null)}>
          <span className={label}>Классы через запятую (пусто — для всех)</span>
          <input className={input} value={bulkLevels} onChange={e => setBulkLevels(e.target.value)} placeholder="7, 8" autoFocus />
          <div className="flex justify-end gap-2 mt-4">
            <button className={btn} onClick={() => setBulkLevels(null)}>Отмена</button>
            <button className={btnPrimary} onClick={async () => { await bulk("levels", { levels: bulkLevels }); setBulkLevels(null); }}>Применить</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DisciplineModal({ initial, api, onDone, onClose }: {
  initial: DisciplineRow | null; api: Api; onDone: (code?: string) => void; onClose: () => void;
}) {
  const [code, setCode] = useState(initial?.code || "");
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setError(null);
    try {
      if (initial) await api(`/disciplines/${initial.code}`, { method: "PUT", body: JSON.stringify({ name, description }) });
      else await api("/disciplines", { method: "POST", body: JSON.stringify({ code, name, description }) });
      onDone(initial ? undefined : code.toUpperCase());
    } catch (e: any) { setError(e.message); setBusy(false); }
  };
  const remove = async () => {
    if (!initial || !confirm(`Удалить дисциплину ${initial.code}?`)) return;
    try { await api(`/disciplines/${initial.code}`, { method: "DELETE" }); onDone(); } catch (e: any) { setError(e.message); }
  };
  return (
    <Modal title={initial ? `Дисциплина ${initial.code}` : "Новая дисциплина"} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <span className={label}>Код (ID)</span>
          <input className={`${input} font-mono uppercase`} value={code} disabled={!!initial} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="MAT" maxLength={8} />
          <p className="text-[11px] text-[var(--text-muted)] mt-1">Латиница и цифры, 2–8 знаков. По коду вопросы загружаются в нужную дисциплину и получают номера «{code || "MAT"}-0001». Код потом не меняется.</p>
        </div>
        <div><span className={label}>Название</span><input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="Математика" /></div>
        <div><span className={label}>Описание</span><input className={input} value={description} onChange={e => setDescription(e.target.value)} placeholder="Необязательно" /></div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-between gap-2">
          {initial ? <button className={`${btn} text-rose-600`} onClick={remove} disabled={initial.total > 0} title={initial.total ? "Сначала удалите вопросы" : ""}><Trash2 className="w-4 h-4" /> Удалить</button> : <span />}
          <div className="flex gap-2">
            <button className={btn} onClick={onClose}>Отмена</button>
            <button className={btnPrimary} onClick={save} disabled={busy || !name.trim() || (!initial && code.length < 2)}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Сохранить</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
