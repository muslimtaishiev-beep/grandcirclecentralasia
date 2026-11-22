import React, { useMemo } from "react";
import { Mail, MessageSquare, Plus } from "lucide-react";
import { flowFields, type FlowStep } from "../../../shared/formFlow";
import { describeWhen } from "../../../shared/conditions";
import { resolveDecisions } from "../../../shared/formDecisions";

const STATE_W = 200, STATE_H = 56, CARD_W = 240, CARD_H = 112, GAP = 90, ROW = 136, PAD = 32;

interface Box { x: number; y: number; w: number; h: number }
interface Edge { from: Box; to: Box; label: string }

/** Раскладка без измерений DOM: колонка = глубина, строки — обход дерева, лист занимает следующую строку. */
function layout(form: any, steps: FlowStep[]) {
  const states = resolveDecisions(form);
  const kids = (kind: "status" | "step", id: string) => steps.filter(s => s.after.kind === kind && s.after.id === id);
  const stateBox = new Map<string, Box>();
  const stepBox = new Map<string, Box>();
  let next = 0;
  const place = (s: FlowStep, depth: number): number => {
    const ch = kids("step", s.id);
    const rows = ch.map(c => place(c, depth + 1));
    const row = rows.length ? rows[0] : next++;
    stepBox.set(s.id, { x: PAD + STATE_W + GAP + (depth - 1) * (CARD_W + GAP), y: PAD + row * ROW, w: CARD_W, h: CARD_H });
    return row;
  };
  for (const d of states) {
    const ch = kids("status", d.id);
    const rows = ch.map(c => place(c, 1));
    const row = rows.length ? rows[0] : next++;
    stateBox.set(d.id, { x: PAD, y: PAD + row * ROW + (CARD_H - STATE_H) / 2, w: STATE_W, h: STATE_H });
  }
  let maxX = PAD + STATE_W, maxY = PAD;
  for (const b of [...stateBox.values(), ...stepBox.values()]) { maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h); }
  return { states, stateBox, stepBox, width: maxX + PAD, height: maxY + PAD };
}

export default function FlowCanvas({ form, steps, selectedId, templateName, onSelect, onAddToState, onAddToStep }: {
  form: any; steps: FlowStep[]; selectedId: string | null; templateName: (id?: string) => string;
  onSelect: (id: string) => void; onAddToState: (id: string) => void; onAddToStep: (id: string) => void;
}) {
  const L = useMemo(() => layout(form, steps), [form, steps]);
  const edges = useMemo<Edge[]>(() => {
    const out: Edge[] = [];
    for (const s of steps) {
      const to = L.stepBox.get(s.id);
      const from = s.after.kind === "status" ? L.stateBox.get(s.after.id) : L.stepBox.get(s.after.id);
      if (!to || !from) continue;
      out.push({ from, to, label: s.when ? describeWhen(s.when, flowFields(form, steps, s.id)) : "всегда" });
    }
    return out;
  }, [L, steps, form]);

  return (
    <div className="flex-1 min-w-0 overflow-auto touch-pan-x touch-pan-y relative">
      <div className="relative" style={{ width: L.width, height: L.height }}>
        <svg className="absolute inset-0 pointer-events-none" width={L.width} height={L.height}>
          <defs>
            <marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="var(--text-muted)" />
            </marker>
          </defs>
          {edges.map((e, i) => {
            const x1 = e.from.x + e.from.w, y1 = e.from.y + e.from.h / 2, x2 = e.to.x, y2 = e.to.y + e.to.h / 2, dx = (x2 - x1) / 2;
            return <path key={i} d={`M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`} fill="none" stroke="var(--text-muted)" strokeWidth={1.5} markerEnd="url(#flow-arrow)" />;
          })}
        </svg>
        {edges.map((e, i) => {
          const mx = (e.from.x + e.from.w + e.to.x) / 2, my = ((e.from.y + e.from.h / 2) + (e.to.y + e.to.h / 2)) / 2;
          return (
            <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2 max-w-[120px] truncate px-2 py-0.5 rounded-full text-[11px] border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-muted)]"
              style={{ left: mx, top: my }} title={e.label}>{e.label}</div>
          );
        })}
        {L.states.map(d => {
          const b = L.stateBox.get(d.id)!;
          return (
            <div key={d.id} className="absolute flex items-center gap-2 px-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)]" style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="flex-1 min-w-0 truncate text-sm font-semibold">{d.label}</span>
              <button type="button" aria-label="Добавить этап" title="Добавить этап" onClick={() => onAddToState(d.id)}
                className="w-7 h-7 shrink-0 grid place-items-center rounded-full bg-[var(--accent)] text-white hover:opacity-90"><Plus className="w-4 h-4" /></button>
            </div>
          );
        })}
        {steps.map(s => {
          const b = L.stepBox.get(s.id);
          if (!b) return null;
          const on = s.id === selectedId;
          return (
            <div key={s.id} role="button" tabIndex={0} onClick={() => onSelect(s.id)} onKeyDown={e => (e.key === "Enter" || e.key === " ") && onSelect(s.id)}
              className={`absolute rounded-xl border bg-[var(--bg-surface)] p-3 cursor-pointer flex flex-col gap-2 ${on ? "border-[var(--accent)] ring-2 ring-[var(--accent)]" : "border-[var(--border-color)] hover:border-[var(--accent)]"}`}
              style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>
              <div className="font-semibold text-sm truncate pr-8">{s.title}</div>
              <div className="flex flex-wrap gap-1 overflow-hidden max-h-[26px]">
                {s.marks.slice(0, 3).map(m => <span key={m.id} className="px-2 py-0.5 rounded-full text-[11px] bg-[var(--bg-surface-hover)] max-w-[90px] truncate">{m.label}</span>)}
                {s.marks.length > 3 && <span className="px-2 py-0.5 rounded-full text-[11px] bg-[var(--bg-surface-hover)]">+{s.marks.length - 3}</span>}
              </div>
              <div className="mt-auto flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                <Mail className="w-3.5 h-3.5 shrink-0" /><span className="truncate flex-1">{s.emailTemplateId ? templateName(s.emailTemplateId) : "без письма"}</span>
                {s.comment && <MessageSquare className="w-3.5 h-3.5 shrink-0" aria-label="Комментарий" />}
              </div>
              <button type="button" aria-label="Добавить следующий этап" title="Добавить следующий этап" onClick={e => { e.stopPropagation(); onAddToStep(s.id); }}
                className="absolute top-2 right-2 w-6 h-6 grid place-items-center rounded-full bg-[var(--accent)] text-white hover:opacity-90"><Plus className="w-3.5 h-3.5" /></button>
            </div>
          );
        })}
        {steps.length === 0 && (
          <div className="absolute text-sm text-[var(--text-muted)]" style={{ left: PAD + STATE_W + GAP, top: PAD + 40 }}>Нажмите + у состояния, чтобы добавить этап</div>
        )}
      </div>
    </div>
  );
}
