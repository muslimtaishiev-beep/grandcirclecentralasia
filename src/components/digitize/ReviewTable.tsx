import { Plus, Trash2, X } from "lucide-react";
import { input } from "../ui";
import type { TableDraft } from "./saveDigitized";

const cell = "w-full min-w-[110px] px-2 py-1.5 text-sm bg-transparent text-[var(--text-main)] outline-none focus:bg-[var(--bg-surface-hover)]";

export default function ReviewTable({ draft, onChange }: { draft: TableDraft; onChange: (d: TableDraft) => void }) {
  const setHeader = (c: number, v: string) => onChange({ ...draft, headers: draft.headers.map((h, i) => (i === c ? v : h)) });
  const setCell = (r: number, c: number, v: string) =>
    onChange({ ...draft, rows: draft.rows.map((row, ri) => (ri === r ? { cells: row.cells.map((x, ci) => (ci === c ? v : x)), doubt: row.doubt.map((d, ci) => (ci === c ? false : d)) } : row)) });
  const delCol = (c: number) => onChange({
    ...draft, headers: draft.headers.filter((_, i) => i !== c),
    rows: draft.rows.map(r => ({ cells: r.cells.filter((_, i) => i !== c), doubt: r.doubt.filter((_, i) => i !== c) })),
  });
  const addRow = () => onChange({ ...draft, rows: [...draft.rows, { cells: draft.headers.map(() => ""), doubt: draft.headers.map(() => false) }] });
  return (
    <div className="space-y-3">
      <input className={`${input} font-semibold`} value={draft.title} placeholder="Название" onChange={e => onChange({ ...draft, title: e.target.value })} />
      <div className="overflow-x-auto border border-[var(--border-color)] rounded-lg">
        <table className="border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--bg-app)]">
              {draft.headers.map((h, c) => (
                <th key={c} className="border border-[var(--border-color)] p-0 align-top">
                  <div className="flex items-center">
                    <input className={`${cell} font-bold`} value={h} onChange={e => setHeader(c, e.target.value)} />
                    <button type="button" title="Удалить колонку" onClick={() => delCol(c)} className="p-1.5 text-[var(--text-muted)] hover:text-rose-600"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {draft.rows.map((r, ri) => (
              <tr key={ri}>
                {r.cells.map((v, c) => (
                  <td key={c} className={`border border-[var(--border-color)] p-0 ${r.doubt[c] ? "bg-amber-400/25" : ""}`}>
                    <input className={cell} value={v} onChange={e => setCell(ri, c, e.target.value)} />
                  </td>
                ))}
                <td className="border border-[var(--border-color)] p-0 text-center">
                  <button type="button" title="Удалить строку" onClick={() => onChange({ ...draft, rows: draft.rows.filter((_, i) => i !== ri) })} className="p-1.5 text-[var(--text-muted)] hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={addRow} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-dashed border-[var(--border-color)] text-[var(--text-main)]">
        <Plus className="w-4 h-4" /> Строка
      </button>
    </div>
  );
}
