import React, { useMemo, useState } from "react";
import { computeStats, type Journal, type JournalEntry, type StatRow } from "../../../../shared/journals";
import { card, input, label } from "./ui";

/**
 * Статистика журнала. Считается в браузере по тем же записям, что и
 * таблица, — правила статуса общие с сервером (shared/journals).
 */
const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const monthLabel = (ym: string) => { const [y, m] = ym.split("-"); return `${MONTHS[Number(m) - 1] || m} ${y}`; };

export default function JournalStats({ journal, entries }: { journal: Journal; entries: JournalEntry[] }) {
  const dateCol = journal.columns.find(c => c.id === journal.settings.dateColumnId);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const scoped = useMemo(() => entries.filter(e => {
    if (!dateCol) return true;
    const d = e.values?.[dateCol.id];
    if (from && (!d || d < from)) return false;
    if (to && (!d || d > to)) return false;
    return true;
  }), [entries, dateCol, from, to]);
  const s = useMemo(() => computeStats(journal, scoped), [journal, scoped]);
  const person = journal.columns.find(c => c.id === journal.settings.personColumnId);
  const hasDone = journal.settings.doneColumnIds.length > 0;
  const debtors = s.people.filter(p => p.open + p.overdue > 0).sort((a, b) => (b.open + b.overdue) - (a.open + a.overdue) || b.overdue - a.overdue);

  return (
    <div className="space-y-4">
      {dateCol && (
        <div className={`${card} p-4 flex flex-wrap items-end gap-3`}>
          <div><span className={label}>{dateCol.label}: с</span><input type="date" className={input} value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><span className={label}>по</span><input type="date" className={input} value={to} onChange={e => setTo(e.target.value)} /></div>
          {(from || to) && <button className="text-sm text-[var(--accent)] hover:underline pb-2" onClick={() => { setFrom(""); setTo(""); }}>За всё время</button>}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile title="Всего записей" value={s.total} />
        {hasDone && <Tile title="Закрыто" value={s.done} sub={s.total ? `${Math.round(s.done / s.total * 100)}%` : ""} tone="text-emerald-600" />}
        {hasDone && <Tile title="Открыто" value={s.open} tone="text-amber-600" />}
        {journal.settings.deadlineColumnId && <Tile title="Просрочено" value={s.overdue} tone="text-rose-600" />}
      </div>

      {s.total === 0 && <div className={`${card} p-8 text-center text-sm text-[var(--text-muted)]`}>За выбранный период записей нет</div>}

      <div className="grid lg:grid-cols-2 gap-4">
        {hasDone && person && debtors.length > 0 && (
          <Breakdown title={`Долги: ${person.label.toLowerCase()} с незакрытыми записями`} rows={debtors} metric={r => r.open + r.overdue} showStatus />
        )}
        {person && s.people.length > 0 && <Breakdown title={`Чаще всего: ${person.label.toLowerCase()}`} rows={s.people} metric={r => r.total} showStatus={hasDone} />}
        {s.byGroup.length > 0 && <Breakdown title="По группам" rows={s.byGroup} metric={r => r.total} showStatus={hasDone} />}
        {s.byColumn.map(b => b.rows.length > 0 && (
          <Breakdown key={b.column.id} title={b.column.label} rows={b.rows} metric={r => r.total} showStatus={hasDone}
            footer={b.empty ? `Не заполнено: ${b.empty}` : undefined} />
        ))}
        {s.signers.length > 0 && <Breakdown title="Кто подписывал" rows={s.signers} metric={r => r.total} />}
        {s.byMonth.length > 1 && (
          <Breakdown title="По месяцам" rows={s.byMonth.map(r => ({ ...r, label: monthLabel(r.label) }))} metric={r => r.total} showStatus={hasDone} keepOrder />
        )}
        {s.signatures.length > 0 && (
          <div className={`${card} p-4`}>
            <h4 className="font-semibold text-sm text-[var(--text-main)] mb-3">Подписи</h4>
            <table className="w-full text-sm">
              <tbody>
                {s.signatures.map(x => (
                  <tr key={x.column.id} className="border-t border-[var(--border-color)] first:border-0">
                    <td className="py-2 text-[var(--text-main)]">{x.column.label}</td>
                    <td className="py-2 text-right tabular-nums text-emerald-600">подписано {x.signed}</td>
                    <td className="py-2 text-right tabular-nums text-[var(--text-muted)]">нет {x.unsigned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ title, value, sub, tone }: { title: string; value: number; sub?: string; tone?: string }) {
  return (
    <div className={`${card} p-4`}>
      <div className="text-[11px] uppercase font-bold text-[var(--text-muted)] tracking-wider">{title}</div>
      <div className={`text-3xl font-bold tabular-nums mt-1 ${tone || "text-[var(--text-main)]"}`}>{value}</div>
      {sub && <div className="text-xs text-[var(--text-muted)]">{sub}</div>}
    </div>
  );
}

/** Горизонтальные полосы одного цвета; числа подписаны, статусы — текстом. */
function Breakdown({ title, rows, metric, showStatus, footer, keepOrder }: {
  title: string; rows: StatRow[]; metric: (r: StatRow) => number; showStatus?: boolean; footer?: string; keepOrder?: boolean;
}) {
  const [all, setAll] = useState(false);
  const list = keepOrder ? rows : [...rows].sort((a, b) => metric(b) - metric(a));
  const shown = all ? list : list.slice(0, 10);
  const max = Math.max(1, ...list.map(metric));
  return (
    <div className={`${card} p-4`}>
      <h4 className="font-semibold text-sm text-[var(--text-main)] mb-3">{title}</h4>
      <div className="space-y-2">
        {shown.map(r => (
          <div key={r.label} title={`${r.label}: всего ${r.total}, закрыто ${r.done}, открыто ${r.open}, просрочено ${r.overdue}`}>
            <div className="flex justify-between gap-3 text-sm">
              <span className="truncate text-[var(--text-main)]">{r.label}</span>
              <span className="shrink-0 tabular-nums text-[var(--text-main)] font-medium">
                {metric(r)}
                {showStatus && (r.overdue > 0 || r.open > 0) && (
                  <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
                    {r.open > 0 && `открыто ${r.open}`}{r.open > 0 && r.overdue > 0 && " · "}{r.overdue > 0 && <span className="text-rose-600">просрочено {r.overdue}</span>}
                  </span>
                )}
              </span>
            </div>
            <div className="h-1.5 mt-1 rounded-full bg-[var(--bg-surface-hover)]">
              <div className="h-1.5 rounded-full bg-[var(--accent)]" style={{ width: `${(metric(r) / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      {list.length > 10 && (
        <button className="mt-3 text-xs text-[var(--accent)] hover:underline" onClick={() => setAll(v => !v)}>{all ? "Свернуть" : `Показать все (${list.length})`}</button>
      )}
      {footer && <div className="mt-2 text-xs text-[var(--text-muted)]">{footer}</div>}
    </div>
  );
}
