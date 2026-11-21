import { Trash2 } from "lucide-react";
import { input } from "../ui";
import { toIsoDate } from "../../shared/digitize";
import type { JournalColumn } from "../../shared/journals";
import { FILL_TYPE_LABEL, checkCell, convertRaw, countJournalErrors, type FillType, type JournalRowDraft, type NewColumnDraft } from "./saveDigitized";

const cellCls = "w-full min-w-[110px] px-2 py-1.5 text-sm bg-transparent text-[var(--text-main)] outline-none focus:bg-[var(--bg-surface-hover)]";
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function Editor({ col, raw, onChange }: { col: JournalColumn; raw: string; onChange: (v: string) => void }) {
  if (col.type === "select") {
    const hit = (col.options || []).find(o => o.label.toLowerCase() === raw.trim().toLowerCase());
    return (
      <select className={cellCls} value={hit?.label ?? ""} onChange={e => onChange(e.target.value)}>
        <option value="">{raw.trim() && !hit ? `«${raw}»?` : "—"}</option>
        {(col.options || []).map(o => <option key={o.label} value={o.label}>{o.label}</option>)}
      </select>
    );
  }
  if (col.type === "checkbox") {
    const v = convertRaw(col, raw);
    return (
      <div className="flex items-center gap-2 px-2 py-1.5">
        <input type="checkbox" className="w-5 h-5" checked={v === true} onChange={e => onChange(e.target.checked ? "true" : "false")} />
        {raw.trim() && v === null && <span className="text-xs text-rose-600">{raw}</span>}
      </div>
    );
  }
  if (col.type === "date") {
    const iso = toIsoDate(raw);
    if (!raw.trim() || ISO.test(iso)) return <input type="date" className={cellCls} value={raw.trim() ? iso : ""} onChange={e => onChange(e.target.value)} />;
  }
  return <input className={cellCls} inputMode={col.type === "number" ? "decimal" : undefined} value={raw} onChange={e => onChange(e.target.value)} />;
}

export default function ReviewJournal({ columns, rows, onChange }: { columns: JournalColumn[]; rows: JournalRowDraft[]; onChange: (r: JournalRowDraft[]) => void }) {
  const bad = countJournalErrors(columns, rows);
  const setVal = (ri: number, id: string, v: string) =>
    onChange(rows.map((r, i) => (i === ri ? { values: { ...r.values, [id]: v }, doubt: r.doubt.filter(d => d !== id) } : r)));
  return (
    <div className="space-y-2">
      <div className="text-sm text-[var(--text-muted)]">Строк: {rows.length}, с ошибками: <span className={bad ? "text-rose-600 font-semibold" : ""}>{bad}</span></div>
      <div className="overflow-x-auto border border-[var(--border-color)] rounded-lg">
        <table className="border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--bg-app)]">
              {columns.map(c => <th key={c.id} className="border border-[var(--border-color)] px-2 py-1.5 text-left font-semibold text-[var(--text-main)] whitespace-nowrap">{c.label}</th>)}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {columns.map(c => {
                  const raw = r.values[c.id] ?? "";
                  const err = checkCell(c, raw);
                  const bg = err ? "bg-rose-500/20" : r.doubt.includes(c.id) ? "bg-amber-400/25" : "";
                  return (
                    <td key={c.id} title={err || undefined} className={`border border-[var(--border-color)] p-0 ${bg}`}>
                      <Editor col={c} raw={raw} onChange={v => setVal(ri, c.id, v)} />
                    </td>
                  );
                })}
                <td className="border border-[var(--border-color)] p-0 text-center">
                  <button type="button" title="Удалить строку" onClick={() => onChange(rows.filter((_, i) => i !== ri))} className="p-1.5 text-[var(--text-muted)] hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Настройка колонок нового журнала: название, тип, не переносить. */
export function NewJournalColumns({ title, onTitle, cols, onCols }: { title: string; onTitle: (v: string) => void; cols: NewColumnDraft[]; onCols: (c: NewColumnDraft[]) => void }) {
  const set = (i: number, patch: Partial<NewColumnDraft>) => onCols(cols.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  return (
    <div className="space-y-2">
      <input className={`${input} font-semibold`} value={title} placeholder="Название журнала" onChange={e => onTitle(e.target.value)} />
      {cols.map((c, i) => (
        <div key={c.id} className={`flex flex-wrap items-center gap-2 p-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] ${c.skip ? "opacity-50" : ""}`}>
          <input className={`${input} flex-1 min-w-[140px]`} value={c.label} onChange={e => set(i, { label: e.target.value })} />
          <select className={`${input} !w-auto`} value={c.type} onChange={e => set(i, { type: e.target.value as FillType })}>
            {(Object.keys(FILL_TYPE_LABEL) as FillType[]).map(t => <option key={t} value={t}>{FILL_TYPE_LABEL[t]}</option>)}
          </select>
          <label className="inline-flex items-center gap-1.5 text-sm text-[var(--text-main)]">
            <input type="checkbox" checked={c.skip} onChange={e => set(i, { skip: e.target.checked })} /> Не переносить
          </label>
        </div>
      ))}
    </div>
  );
}
