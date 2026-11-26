import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { SCHOOL_LEVELS, STAFF_GRADES } from "../../../shared/staffPlacement";
import { audienceMembers, type Audience, type StaffLite } from "../../../shared/schoolDocs";

/**
 * Кому: вся школа / должности / классы / ступени / предметы / группы +
 * поимённо добавить или убрать. Сразу видно, сколько человек получится.
 * Один выбор для доступа к папке и для сбора документов.
 */
export interface DocsStaff { uid: string; name: string; positionId: string | null; positionName: string; placement: StaffLite["placement"] }

const chip = (on: boolean) => `px-2.5 h-8 rounded-lg text-sm font-medium border transition ${on ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--accent)]"}`;
const lbl = "block text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1.5";

export const asLite = (s: DocsStaff): StaffLite => ({ ...s, full: false });

export default function AudiencePicker({ value, onChange, staff, positions, allLabel = "Все сотрудники", hideList, peopleOnly }: {
  value: Audience; onChange: (a: Audience) => void; staff: DocsStaff[]; positions: { id: string; name: string }[]; allLabel?: string; hideList?: boolean;
  /** Только поимённо (например, кто ещё управляет папкой). */
  peopleOnly?: boolean;
}) {
  const set = (p: Partial<Audience>) => onChange({ ...value, ...p });
  const tog = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter(y => y !== x) : [...xs, x]);
  const subjects = useMemo(() => [...new Set(staff.flatMap(s => s.placement.subjects))].sort((a, b) => a.localeCompare(b, "ru")), [staff]);
  const groups = useMemo(() => [...new Set(staff.flatMap(s => s.placement.groups))].sort((a, b) => a.localeCompare(b, "ru")), [staff]);
  const usedPositions = positions.filter(p => staff.some(s => s.positionId === p.id));
  const members = useMemo(() => audienceMembers(value, staff.map(asLite)), [value, staff]);
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const found = q.trim() ? staff.filter(s => s.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : [];
  const name = (uid: string) => staff.find(s => s.uid === uid)?.name || "сотрудник";
  // Учителя нужной должности без отмеченных классов — их фильтр по классам не найдёт.
  const noGrades = value.grades.length ? staff.filter(s => (!value.positions.length || (s.positionId && value.positions.includes(s.positionId))) && !s.placement.grades.length && s.positionId) : [];

  return (
    <div className="space-y-4">
      {!peopleOnly && (
        <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-main)]">
          <input type="checkbox" checked={value.all} onChange={e => set({ all: e.target.checked })} /> {allLabel}
        </label>
      )}
      {!value.all && !peopleOnly && (
        <>
          {usedPositions.length > 0 && (
            <div><span className={lbl}>Должности</span>
              <div className="flex flex-wrap gap-1.5">{usedPositions.map(p => <button key={p.id} type="button" className={chip(value.positions.includes(p.id))} onClick={() => set({ positions: tog(value.positions, p.id) })}>{p.name}</button>)}</div>
            </div>
          )}
          <div><span className={lbl}>Классы</span>
            <div className="flex flex-wrap gap-1.5">{STAFF_GRADES.map(g => <button key={g} type="button" className={`${chip(value.grades.includes(g))} min-w-[2rem]`} onClick={() => set({ grades: tog(value.grades, g).sort((a, b) => a - b) })}>{g}</button>)}</div>
          </div>
          <div><span className={lbl}>Ступени</span>
            <div className="flex flex-wrap gap-1.5">{SCHOOL_LEVELS.map(l => <button key={l.id} type="button" className={chip(value.levels.includes(l.id))} onClick={() => set({ levels: tog(value.levels, l.id) })}>{l.label}</button>)}</div>
          </div>
          {subjects.length > 0 && (
            <div><span className={lbl}>Предметы</span>
              <div className="flex flex-wrap gap-1.5">{subjects.map(x => <button key={x} type="button" className={chip(value.subjects.includes(x))} onClick={() => set({ subjects: tog(value.subjects, x) })}>{x}</button>)}</div>
            </div>
          )}
          {groups.length > 0 && (
            <div><span className={lbl}>Группы</span>
              <div className="flex flex-wrap gap-1.5">{groups.map(x => <button key={x} type="button" className={chip(value.groups.includes(x))} onClick={() => set({ groups: tog(value.groups, x) })}>{x}</button>)}</div>
            </div>
          )}
        </>
      )}
      <div>
        {!peopleOnly && <span className={lbl}>Поимённо</span>}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Найти сотрудника" className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] py-2 pl-8 pr-3 text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)]" />
          {found.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-1 shadow-lg">
              {found.map(s => {
                const inc = value.include.includes(s.uid), exc = value.exclude.includes(s.uid);
                return (
                  <div key={s.uid} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm">
                    <span className="flex-1 truncate text-[var(--text-main)]">{s.name}<span className="ml-1 text-xs text-[var(--text-muted)]">{s.positionName}</span></span>
                    <button type="button" className={`rounded px-2 py-0.5 text-xs ${inc ? "bg-emerald-600 text-white" : "border border-[var(--border-color)]"}`} onClick={() => { set({ include: tog(value.include, s.uid), exclude: value.exclude.filter(x => x !== s.uid) }); setQ(""); }}>+ добавить</button>
                    {!peopleOnly && <button type="button" className={`rounded px-2 py-0.5 text-xs ${exc ? "bg-rose-600 text-white" : "border border-[var(--border-color)]"}`} onClick={() => { set({ exclude: tog(value.exclude, s.uid), include: value.include.filter(x => x !== s.uid) }); setQ(""); }}>− убрать</button>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {(value.include.length > 0 || value.exclude.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {value.include.map(u => <span key={u} className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">+ {name(u)}<button type="button" aria-label="Убрать" onClick={() => set({ include: value.include.filter(x => x !== u) })}><X className="h-3 w-3" /></button></span>)}
            {value.exclude.map(u => <span key={u} className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-xs text-rose-700 dark:text-rose-400">− {name(u)}<button type="button" aria-label="Вернуть" onClick={() => set({ exclude: value.exclude.filter(x => x !== u) })}><X className="h-3 w-3" /></button></span>)}
          </div>
        )}
      </div>
      {!hideList && (
        <div className="rounded-xl border border-[var(--border-color)] p-3 text-sm">
          <div className="flex items-center gap-2">
            <b className="text-[var(--text-main)]">Получится: {members.length}</b>
            {members.length > 0 && <button type="button" className="text-xs text-[var(--accent)] hover:underline" onClick={() => setShowAll(v => !v)}>{showAll ? "скрыть" : "кто"}</button>}
          </div>
          {showAll && <div className="mt-1.5 text-xs text-[var(--text-muted)] leading-relaxed">{members.map(m => m.name).join(", ")}</div>}
          {noGrades.length > 0 && <div className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">Без отмеченных классов: {noGrades.length} — их не найдёт фильтр по классам ({noGrades.slice(0, 5).map(s => s.name).join(", ")}{noGrades.length > 5 ? "…" : ""})</div>}
        </div>
      )}
    </div>
  );
}
