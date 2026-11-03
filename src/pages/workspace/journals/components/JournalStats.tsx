import React, { useMemo, useState } from "react";
import { Download, Loader2, Trophy } from "lucide-react";
import { computeStats, leaderboard, noShowLabel, type Journal, type JournalEntry, type LeaderRow, type StatRow } from "../../../../shared/journals";
import { exportStatsXlsx } from "../journalExcel";
import { btnPrimary, card, input, label } from "./ui";

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
  const board = useMemo(() => leaderboard(journal, scoped).filter(r => r.unfinished > 0 || r.noShow > 0), [journal, scoped]);
  const [exporting, setExporting] = useState(false);
  const download = async () => {
    setExporting(true);
    try { await exportStatsXlsx(journal, scoped, { from, to }); }
    catch (e: any) { alert(`Не удалось выгрузить: ${e.message}`); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-4">
      <div className={`${card} p-4 flex flex-wrap items-end gap-3`}>
        {dateCol && (
          <>
            <div className="flex-1 min-w-[140px] sm:flex-none"><span className={label}>{dateCol.label}: с</span><input type="date" className={input} value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div className="flex-1 min-w-[140px] sm:flex-none"><span className={label}>по</span><input type="date" className={input} value={to} onChange={e => setTo(e.target.value)} /></div>
            {(from || to) && <button className="text-sm text-[var(--accent)] hover:underline pb-2" onClick={() => { setFrom(""); setTo(""); }}>За всё время</button>}
          </>
        )}
        <button className={`${btnPrimary} w-full sm:w-auto sm:ml-auto justify-center`} onClick={download} disabled={exporting || !scoped.length}
          title="Сводка, лидерборд, список не отработавших и все разбивки — каждый срез на своём листе">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Скачать статистику (Excel)
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile title="Всего записей" value={s.total} />
        {hasDone && <Tile title="Закрыто" value={s.done} sub={s.total ? `${Math.round(s.done / s.total * 100)}%` : ""} tone="text-emerald-600" />}
        {hasDone && <Tile title="Открыто" value={s.open} tone="text-amber-600" />}
        {journal.settings.deadlineColumnId && <Tile title="Просрочено" value={s.overdue} tone="text-rose-600" />}
      </div>

      {s.total === 0 && <div className={`${card} p-8 text-center text-sm text-[var(--text-muted)]`}>За выбранный период записей нет</div>}

      {board.length > 0 && person && (
        <Leaderboard rows={board} who={person.label} noShow={journal.columns.some(c => c.type === "checkbox") ? noShowLabel(journal) : null} />
      )}

      <div className="grid lg:grid-cols-2 gap-4">
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

/** Лидерборд не отработанных: кто больше всех не закрыл записей. */
function Leaderboard({ rows, who, noShow }: { rows: LeaderRow[]; who: string; noShow: string | null }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, 15);
  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1));
  return (
    <div className={`${card} p-4`}>
      <h4 className="font-semibold text-sm text-[var(--text-main)] mb-1 flex items-center gap-1.5"><Trophy className="w-4 h-4 text-amber-500" /> Лидерборд не отработанных</h4>
      <p className="text-xs text-[var(--text-muted)] mb-3">Больше всего незакрытых записей, затем просроченных{noShow ? ` и «${noShow.toLowerCase()}»` : ""}. Всего: {rows.length}.</p>
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-sm min-w-[520px]">
          <thead className="text-[11px] uppercase font-mono text-[var(--text-muted)]">
            <tr>
              <th className="py-2 pr-2 text-left w-10">#</th>
              <th className="py-2 pr-2 text-left">{who}</th>
              <th className="py-2 pr-2 text-left">Класс</th>
              <th className="py-2 px-2 text-right">Не отработано</th>
              <th className="py-2 px-2 text-right">Просрочено</th>
              {noShow && <th className="py-2 px-2 text-right">{noShow}</th>}
              <th className="py-2 pl-2 text-right">Всего</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.person} className="border-t border-[var(--border-color)]">
                <td className="py-2 pr-2 tabular-nums text-[var(--text-muted)]">{medal(i)}</td>
                <td className="py-2 pr-2 font-medium text-[var(--text-main)]">{r.person}</td>
                <td className="py-2 pr-2 text-[var(--text-muted)]">{r.group || "—"}</td>
                <td className="py-2 px-2 text-right tabular-nums font-bold text-[var(--text-main)]">{r.unfinished}</td>
                <td className={`py-2 px-2 text-right tabular-nums ${r.overdue ? "text-rose-600 font-medium" : "text-[var(--text-muted)]"}`}>{r.overdue}</td>
                {noShow && <td className={`py-2 px-2 text-right tabular-nums ${r.noShow ? "text-amber-600 font-medium" : "text-[var(--text-muted)]"}`}>{r.noShow}</td>}
                <td className="py-2 pl-2 text-right tabular-nums text-[var(--text-muted)]">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 15 && (
        <button className="mt-3 text-xs text-[var(--accent)] hover:underline" onClick={() => setAll(v => !v)}>{all ? "Свернуть" : `Показать всех (${rows.length})`}</button>
      )}
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
