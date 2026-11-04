import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { BAND_PRESETS, type ExamSection, type GradeKind, type GradePart, type ScaleBand } from "../../../shared/examRun";
import { btn, input, label } from "../journals/components/ui";

/** Части оценки: у каждой свои дисциплины и свой вид итога. */
const KINDS: [GradeKind, string][] = [["points", "Баллы"], ["percent", "%"], ["mark5", "2–5"], ["band", "1,0–5,0"], ["labels", "Свои слова"]];
const chip = (on: boolean) => `px-3 py-1 rounded-full text-xs font-medium border transition ${on ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]"}`;

export default function GradePartsEditor({ parts, sections, onChange }: { parts: GradePart[]; sections: ExamSection[]; onChange: (p: GradePart[]) => void }) {
  const upd = (i: number, p: Partial<GradePart>) => onChange(parts.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const used = new Set(parts.flatMap(p => p.sections));
  const add = () => {
    const free = sections.filter(s => !used.has(s.id)).map(s => s.id);
    onChange([...parts, { id: `p${Date.now().toString(36)}`, title: `Часть ${parts.length + 1}`, sections: free, kind: "points" }]);
  };
  return (
    <div className="space-y-2">
      {parts.map((p, i) => (
        <div key={p.id} className="rounded-xl border border-[var(--border-color)] p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <input className={`${input} flex-1 font-semibold`} value={p.title} onChange={e => upd(i, { title: e.target.value })} />
            <button type="button" className={btn} onClick={() => onChange(parts.filter((_, k) => k !== i))} aria-label="Убрать часть"><Trash2 className="w-4 h-4 text-rose-600" /></button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sections.map(s => {
              const on = p.sections.includes(s.id);
              return <button key={s.id} type="button" className={chip(on)} onClick={() => upd(i, { sections: on ? p.sections.filter(x => x !== s.id) : [...p.sections, s.id] })}>{s.title}</button>;
            })}
          </div>
          <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-[var(--bg-surface-hover)] w-fit">
            {KINDS.map(([k, l]) => (
              <button key={k} type="button" onClick={() => upd(i, { kind: k, ...(k === "labels" && !p.bands?.length ? { bands: BAND_PRESETS[0].bands } : {}) })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${p.kind === k ? "bg-[var(--bg-surface)] text-[var(--accent)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"}`}>{l}</button>
            ))}
          </div>
          {p.kind === "mark5" && (
            <div className="grid grid-cols-3 gap-2 max-w-sm">
              {([["pass", "«3» от, %", 50], ["good", "«4» от, %", 65], ["excellent", "«5» от, %", 85]] as const).map(([k, l, d]) => (
                <div key={k}><span className={label}>{l}</span><input type="number" min={0} max={100} className={input} value={p.marks?.[k] ?? d}
                  onChange={e => upd(i, { marks: { pass: 50, good: 65, excellent: 85, ...p.marks, [k]: Number(e.target.value) || 0 } })} /></div>
              ))}
            </div>
          )}
          {p.kind === "labels" && <Bands bands={p.bands || []} onChange={bands => upd(i, { bands })} />}
        </div>
      ))}
      <button type="button" className={btn} onClick={add} disabled={!sections.length}><Plus className="w-4 h-4" /> Часть оценки</button>
    </div>
  );
}

function Bands({ bands, onChange }: { bands: ScaleBand[]; onChange: (b: ScaleBand[]) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {BAND_PRESETS.map(pr => <button key={pr.label} type="button" className={chip(false)} onClick={() => onChange(pr.bands)}>{pr.label}</button>)}
      </div>
      {bands.map((b, k) => (
        <div key={k} className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">от</span>
          <input type="number" min={0} max={100} className={`${input} !w-20`} value={b.minPercent} onChange={e => onChange(bands.map((x, j) => (j === k ? { ...x, minPercent: Number(e.target.value) || 0 } : x)))} />
          <span className="text-xs text-[var(--text-muted)]">%</span>
          <input className={`${input} flex-1`} value={b.label} onChange={e => onChange(bands.map((x, j) => (j === k ? { ...x, label: e.target.value } : x)))} />
          <button type="button" className={btn} onClick={() => onChange(bands.filter((_, j) => j !== k))} aria-label="Убрать"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <button type="button" className={btn} onClick={() => onChange([...bands, { minPercent: 0, label: "" }])}><Plus className="w-3.5 h-3.5" /> Порог</button>
    </div>
  );
}
