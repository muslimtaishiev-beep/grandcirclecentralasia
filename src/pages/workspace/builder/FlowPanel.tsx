import React from "react";
import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2, X } from "lucide-react";
import { Button } from "../../../components/ui";
import { ConditionsButton } from "../../../components/conditions/ConditionBuilder";
import { afterLabel, flowFields, MAX_MARKS, type FlowStep } from "../../../shared/formFlow";
import { resolveDecisions } from "../../../shared/formDecisions";

const field = "w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)]";
const cap = "block text-xs font-semibold text-[var(--text-muted)] mb-1";

/** Правая панель (на телефоне — шторка снизу) со свойствами выбранного этапа. */
export default function FlowPanel({ tenantId, form, steps, step, descendants, templates, onPatch, onDelete, onClose }: {
  tenantId: string; form: any; steps: FlowStep[]; step: FlowStep | null; descendants: Set<string>;
  templates: { id: string; name: string }[];
  onPatch: (id: string, p: Partial<FlowStep>) => void; onDelete: (id: string) => void; onClose: () => void;
}) {
  const wrap = `${step ? "" : "hidden lg:block"} fixed inset-x-0 bottom-0 z-20 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t shadow-2xl lg:static lg:w-[340px] lg:shrink-0 lg:max-h-none lg:rounded-none lg:border-t-0 lg:border-l lg:shadow-none border-[var(--border-color)] bg-[var(--bg-surface)]`;
  if (!step) return <aside className={wrap}><div className="p-4 text-sm text-[var(--text-muted)]">Выберите этап</div></aside>;

  const patch = (p: Partial<FlowStep>) => onPatch(step.id, p);
  const setMarks = (marks: FlowStep["marks"]) => patch({ marks, minMarks: Math.min(step.minMarks, marks.length) });
  const moveMark = (i: number, dir: -1 | 1) => { const n = [...step.marks]; const j = i + dir; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; setMarks(n); };
  const afterVal = `${step.after.kind}:${step.after.id}`;
  const others = steps.filter(s => s.id !== step.id && !descendants.has(s.id));
  const hasKids = steps.some(s => s.after.kind === "step" && s.after.id === step.id);

  return (
    <aside className={wrap}>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="font-bold flex-1 truncate">{step.title || "Этап"}</div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="p-1.5 rounded hover:bg-[var(--bg-surface-hover)] lg:hidden"><X className="w-4 h-4" /></button>
        </div>
        <div><label className={cap}>Название</label>
          <input value={step.title} maxLength={60} onChange={e => patch({ title: e.target.value })} className={field} /></div>
        <div><label className={cap}>После</label>
          <select value={afterVal} className={field} onChange={e => { const [kind, ...r] = e.target.value.split(":"); patch({ after: { kind: kind as "status" | "step", id: r.join(":") } }); }}>
            {resolveDecisions(form).map(d => <option key={d.id} value={`status:${d.id}`}>{d.label}</option>)}
            {others.map(s => <option key={s.id} value={`step:${s.id}`}>{afterLabel(form, steps, { kind: "step", id: s.id })}</option>)}
          </select></div>
        <div><label className={cap}>Условие</label>
          <ConditionsButton value={step.when} fields={flowFields(form, steps, step.id)} onChange={w => patch({ when: w })} /></div>
        <div>
          <label className={cap}>Отметки организаторов</label>
          <div className="space-y-1.5">
            {step.marks.map((m, i) => (
              <div key={m.id} className="flex items-center gap-1">
                <input value={m.label} maxLength={60} onChange={e => setMarks(step.marks.map(x => (x.id === m.id ? { ...x, label: e.target.value } : x)))} className={field} aria-label="Отметка" />
                <button type="button" aria-label="Выше" disabled={i === 0} onClick={() => moveMark(i, -1)} className="p-1.5 rounded hover:bg-[var(--bg-surface-hover)] disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                <button type="button" aria-label="Ниже" disabled={i === step.marks.length - 1} onClick={() => moveMark(i, 1)} className="p-1.5 rounded hover:bg-[var(--bg-surface-hover)] disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                <button type="button" aria-label="Удалить отметку" onClick={() => setMarks(step.marks.filter(x => x.id !== m.id))} className="p-1.5 rounded hover:bg-[var(--bg-surface-hover)] text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <Button size="sm" variant="secondary" icon={<Plus className="w-4 h-4" />} disabled={step.marks.length >= MAX_MARKS}
              onClick={() => setMarks([...step.marks, { id: `m_${Math.random().toString(36).slice(2, 8)}`, label: "Отметка" }])}>Отметка</Button>
          </div>
        </div>
        <div><label className={cap}>Нужно отметок для публикации</label>
          <input type="number" min={0} max={step.marks.length} value={step.minMarks} className={`${field} w-24`}
            onChange={e => patch({ minMarks: Math.max(0, Math.min(step.marks.length, Math.floor(Number(e.target.value)) || 0)) })} /></div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={step.comment} onChange={e => patch({ comment: e.target.checked })} />Комментарий организаторов
        </label>
        <div><label className={cap}>Письмо при публикации</label>
          <select value={step.emailTemplateId || ""} className={field} onChange={e => patch({ emailTemplateId: e.target.value || undefined })}>
            <option value="">Без письма</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <Button size="sm" variant="ghost" className="mt-1" icon={<ExternalLink className="w-4 h-4" />}
            onClick={() => window.open(`/workspace/${tenantId}/settings/emails?tab=templates`, "_blank", "noopener")}>Шаблоны писем</Button></div>
        <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={() => onDelete(step.id)}>{hasKids ? "Удалить этап…" : "Удалить этап"}</Button>
      </div>
    </aside>
  );
}
