import React, { useState } from "react";
import { ChevronDown, FileImage, Lightbulb, Printer, Wand2 } from "lucide-react";
import {
  SCALES, answerText, normText, promptsFor, suggestRating, visibleSections,
  type Level, type QAnswer, type QAnswers, type QAttachment, type QItem, type QTemplate,
} from "../../shared/questionnaires";

/**
 * Заполнение анкеты по шаблону — и сотрудником в карточке, и родителем по
 * ссылке. Показывает только пункты для класса ребёнка, вопросы методики под
 * этот класс, по введённым цифрам подсказывает оценку по нормам; рядом с
 * пунктами «опроса родителей» — ответы родителя из его анкеты.
 */
const LEVEL_STYLE: Record<Level, string> = {
  norm: "bg-emerald-600 border-emerald-600 text-white",
  mild: "bg-amber-500 border-amber-500 text-white",
  severe: "bg-rose-600 border-rose-600 text-white",
  na: "bg-slate-500 border-slate-500 text-white",
};
const field = "w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[15px] text-[var(--text-main)] outline-none focus:border-[var(--accent)] transition disabled:opacity-70";
const chip = (on: boolean) => `px-3 py-1.5 rounded-full text-sm font-medium border transition ${on ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]"}`;

export default function FormFiller({ template, grade, answers, onChange, outcome, onOutcome, readOnly, parent, onMaterial, staff }: {
  template: QTemplate;
  grade: number | null;
  answers: QAnswers;
  onChange: (a: QAnswers) => void;
  outcome?: string | null;
  onOutcome?: (id: string) => void;
  readOnly?: boolean;
  /** Анкета родителя — для пунктов с showParent. */
  parent?: { template: QTemplate; answers: QAnswers } | null;
  /** Открыть или напечатать материал методики. */
  onMaterial?: (a: QAttachment) => void;
  /** Сотрудник: показывать вопросы методики и подсказки по нормам. */
  staff?: boolean;
}) {
  // Условия «показывать, если…» пересчитываются на каждый ответ.
  const sections = visibleSections(template, grade, { answers, parent: parent?.answers });
  const set = (id: string, p: Partial<QAnswer>) => onChange({ ...answers, [id]: { ...answers[id], ...p } });
  const parentItems = new Map((parent?.template.sections || []).flatMap(s => s.items).map(i => [i.id, i]));
  const mats = new Map(template.attachments.map(a => [a.id, a]));

  return (
    <div className="space-y-5">
      {sections.map(s => (
        <section key={s.id} id={`sec-${s.id}`} className="scroll-mt-24 space-y-3">
          <div>
            <h3 className="text-base font-bold text-[var(--text-main)]">{s.title}</h3>
            {s.hint && <p className="text-xs text-[var(--text-muted)] mt-0.5">{s.hint}</p>}
          </div>
          {s.items.map(i => (
            <Item key={i.id} i={i} a={answers[i.id]} grade={grade} set={p => set(i.id, p)} readOnly={readOnly} staff={staff}
              parentLines={(i.showParent || []).map(pid => { const pi = parentItems.get(pid); return pi ? [pi.label, answerText(pi, parent?.answers[pid]) + (parent?.answers[pid]?.comment ? ` (${parent.answers[pid].comment})` : "")] as [string, string] : null; }).filter(Boolean) as [string, string][]}
              materials={(i.materials || []).map(m => mats.get(m)).filter((m): m is QAttachment => !!m && (!m.grades?.length || grade === null || m.grades.includes(grade)))}
              onMaterial={onMaterial} hasParent={!!parent} />
          ))}
        </section>
      ))}

      {template.outcome && onOutcome && (
        <section id="sec-outcome" className="space-y-2 scroll-mt-24">
          <h3 className="text-base font-bold text-[var(--text-main)]">{template.outcome.label}</h3>
          <div className="grid sm:grid-cols-3 gap-2">
            {template.outcome.options.map(o => {
              const on = outcome === o.id;
              const tone = o.tone === "good" ? "border-emerald-500 bg-emerald-500/10" : o.tone === "bad" ? "border-rose-500 bg-rose-500/10" : "border-amber-500 bg-amber-500/10";
              return (
                <button key={o.id} type="button" disabled={readOnly} onClick={() => onOutcome(o.id)}
                  className={`text-left rounded-xl border-2 p-3 transition disabled:cursor-default ${on ? tone : "border-[var(--border-color)] hover:border-[var(--text-muted)]"}`}>
                  <div className="font-semibold text-sm text-[var(--text-main)]">{on ? "☑ " : "☐ "}{o.label}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1 leading-snug">{o.description}</div>
                  <div className={`text-[11px] mt-1.5 font-semibold ${o.allowsTest ? "text-emerald-700" : "text-rose-700"}`}>{o.allowsTest ? "→ направление на тест" : "→ без теста"}</div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Item({ i, a, grade, set, readOnly, staff, parentLines, materials, onMaterial, hasParent }: {
  i: QItem; a: QAnswer | undefined; grade: number | null; set: (p: Partial<QAnswer>) => void; readOnly?: boolean; staff?: boolean;
  parentLines: [string, string][]; materials: QAttachment[]; onMaterial?: (a: QAttachment) => void; hasParent: boolean;
}) {
  const prompts = staff ? promptsFor(i, grade) : [];
  const [open, setOpen] = useState(true);
  const sug = i.kind === "rating" ? suggestRating(i, grade, a?.measures) : null;
  const scale = i.kind === "rating" ? SCALES[i.scale || "norm4"] : [];

  if (i.kind === "note") return <p className="text-sm text-[var(--text-muted)]">{i.label}</p>;
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 sm:p-4 space-y-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[15px] text-[var(--text-main)] leading-snug">{i.label}{i.required && <span className="text-rose-600"> *</span>}</div>
          {i.hint && <div className="text-xs text-[var(--text-muted)] mt-0.5">{i.hint}</div>}
        </div>
        {materials.map(m => (
          <button key={m.id} type="button" onClick={() => onMaterial?.(m)} title={m.name}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--border-color)] text-xs text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]">
            {m.kind === "sheet" ? <Printer className="w-3.5 h-3.5" /> : <FileImage className="w-3.5 h-3.5" />}<span className="hidden sm:inline">{m.name}</span>
          </button>
        ))}
      </div>

      {prompts.length > 0 && (
        <div className="rounded-lg bg-sky-500/5 border border-sky-500/20">
          <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-700">
            <Lightbulb className="w-3.5 h-3.5" /> Вопросы{grade !== null ? ` для ${grade} класса` : ""}<ChevronDown className={`w-3.5 h-3.5 ml-auto transition ${open ? "rotate-180" : ""}`} />
          </button>
          {open && <div className="px-3 pb-2.5 text-[13px] leading-relaxed text-[var(--text-main)] whitespace-pre-line">{prompts.map(p => p.text).join("\n\n")}</div>}
        </div>
      )}

      {parentLines.length > 0 && (
        <div className="rounded-lg bg-violet-500/5 border border-violet-500/20 px-3 py-2 text-[13px] space-y-0.5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-violet-700">Из анкеты родителя</div>
          {parentLines.map(([l, v]) => <div key={l}><span className="text-[var(--text-muted)]">{l}:</span> <span className="text-[var(--text-main)]">{v || "—"}</span></div>)}
        </div>
      )}
      {!hasParent && i.showParent?.length ? <div className="text-xs text-[var(--text-muted)]">Анкета родителя ещё не заполнена.</div> : null}

      {(i.kind === "text" || i.kind === "phone") && <input className={field} disabled={readOnly} inputMode={i.kind === "phone" ? "tel" : undefined} value={String(a?.value ?? "")} onChange={e => set({ value: e.target.value })} />}
      {i.kind === "number" && <input className={`${field} max-w-[180px]`} type="number" disabled={readOnly} value={String(a?.value ?? "")} onChange={e => set({ value: e.target.value })} />}
      {i.kind === "date" && <input className={`${field} max-w-[220px]`} type="date" disabled={readOnly} value={String(a?.value ?? "")} onChange={e => set({ value: e.target.value })} />}
      {i.kind === "longtext" && <textarea rows={3} className={field} disabled={readOnly} value={String(a?.value ?? "")} onChange={e => set({ value: e.target.value })} />}
      {i.kind === "choice" && (
        <div className="flex flex-wrap gap-1.5">
          {(i.options || []).map(o => <button key={o.id} type="button" disabled={readOnly} className={chip(a?.value === o.id)} onClick={() => set({ value: a?.value === o.id ? "" : o.id })}>{o.label}</button>)}
        </div>
      )}
      {i.kind === "multi" && (
        <div className="flex flex-wrap gap-1.5">
          {(i.options || []).map(o => {
            const cur = Array.isArray(a?.value) ? a!.value as string[] : [];
            const on = cur.includes(o.id);
            return <button key={o.id} type="button" disabled={readOnly} className={chip(on)} onClick={() => set({ value: on ? cur.filter(x => x !== o.id) : [...cur, o.id] })}>{on ? "✓ " : ""}{o.label}</button>;
          })}
        </div>
      )}

      {i.kind === "rating" && (
        <>
          {!!i.measures?.length && (
            <div className="flex flex-wrap items-end gap-2">
              {i.measures.map(m => (
                <label key={m.id} className="flex flex-col">
                  <span className="text-[11px] text-[var(--text-muted)] mb-0.5">{m.label}{m.suffix ? `, ${m.suffix}` : ""}</span>
                  <input type="number" min={0} disabled={readOnly} className={`${field} !w-28`} value={a?.measures?.[m.id] ?? ""}
                    onChange={e => set({ measures: { ...(a?.measures || {}), [m.id]: e.target.value === "" ? null : Number(e.target.value) } })} />
                </label>
              ))}
              {sug && (
                <button type="button" disabled={readOnly} onClick={() => set({ rating: sug.level })}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border ${a?.rating === sug.level ? "border-[var(--border-color)] text-[var(--text-muted)]" : "border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10"}`}>
                  <Wand2 className="w-3.5 h-3.5" /> По нормам: {scale.find(x => x.id === sug.level)?.short} ({sug.value}, {normText(sug.norm)})
                </button>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {scale.map(x => (
              <button key={x.id} type="button" disabled={readOnly} onClick={() => set({ rating: a?.rating === x.id ? undefined : x.id })}
                className={`px-2 py-2 rounded-lg text-xs sm:text-sm font-semibold border-2 transition ${a?.rating === x.id ? LEVEL_STYLE[x.id] : "border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--text-muted)]"}`}>
                {x.short}
              </button>
            ))}
          </div>
        </>
      )}
      {(i.kind === "rating" ? i.comment !== false : i.comment) && (
        <textarea rows={i.kind === "rating" ? 2 : 1} className={field} disabled={readOnly}
          placeholder={i.kind === "rating" ? (i.scale === "emo4" ? "Наблюдения, ответы ребёнка" : "Результат, характер трудностей и необходимая помощь") : "Комментарий"}
          value={a?.comment || ""} onChange={e => set({ comment: e.target.value })} />
      )}
    </div>
  );
}
