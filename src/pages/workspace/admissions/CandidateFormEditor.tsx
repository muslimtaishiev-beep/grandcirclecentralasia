import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { CARD_SOURCES, type CandidateField, type CandidateFormConfig } from "../../../shared/candidateForm";
import type { QTemplate } from "../../../shared/questionnaires";
import { Modal, btn, btnPrimary, card, input, label } from "../journals/components/ui";
import type { Api } from "./admissionApi";

/**
 * Вид «Анкеты кандидата» организации: заголовок, поля «Сведения об ученике»
 * (из карточки или из ответов анкеты родителя), слова уровней, варианты
 * решения и дополнительные поля. Хранится в базе организации.
 */
export function CandidateFormCard({ api, parent }: { api: Api; parent?: QTemplate }) {
  const [form, setForm] = useState<CandidateFormConfig | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [editing, setEditing] = useState(false);
  const load = () => api("/candidate-form").then(j => { setForm(j.form); setCanEdit(j.canEdit); }).catch(() => {});
  useEffect(() => { void load(); }, [api]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!form) return null;
  return (
    <div className={`${card} p-4 space-y-2`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[var(--text-main)]">{form.title}</div>
          <div className="text-xs text-[var(--text-muted)]">Вместо сертификата у экзаменов с этой отметкой · {form.version ? `версия ${form.version}` : "не настроена"}</div>
        </div>
        {canEdit && <button className={btn} onClick={() => setEditing(true)}><Pencil className="w-4 h-4" /> Изменить</button>}
      </div>
      <div className="text-xs text-[var(--text-muted)]">{form.fields.length} полей · решение: {form.decisions.map(d => d.label).join(" / ")}</div>
      {editing && <FormEditor initial={form} parent={parent} api={api} onClose={() => setEditing(false)} onSaved={f => { setForm(f); setEditing(false); }} />}
    </div>
  );
}

function FormEditor({ initial, parent, api, onClose, onSaved }: { initial: CandidateFormConfig; parent?: QTemplate; api: Api; onClose: () => void; onSaved: (f: CandidateFormConfig) => void }) {
  const [f, setF] = useState<CandidateFormConfig>(() => JSON.parse(JSON.stringify(initial)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<CandidateFormConfig>) => setF(x => ({ ...x, ...p }));
  const setField = (i: number, p: Partial<CandidateField>) => set({ fields: f.fields.map((x, k) => (k === i ? { ...x, ...p } : x)) });
  const move = <T,>(a: T[], i: number, d: number) => { const n = [...a]; const j = i + d; if (j < 0 || j >= n.length) return a; [n[i], n[j]] = [n[j], n[i]]; return n; };
  const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 99)}`;
  const answers = (parent?.sections || []).flatMap(s => s.items).filter(i => i.kind !== "note");
  const save = async () => {
    setBusy(true); setError(null);
    try { const j = await api("/candidate-form", { method: "PUT", body: JSON.stringify(f) }); onSaved(j.form); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal title="Анкета кандидата" onClose={onClose} xwide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><span className={label}>Заголовок</span><input className={input} value={f.title} onChange={e => set({ title: e.target.value })} /></div>
          <div><span className={label}>Строка над заголовком</span><input className={input} value={f.orgLine} onChange={e => set({ orgLine: e.target.value })} placeholder="Название организации" /></div>
        </div>

        <div className="space-y-2">
          <span className={label}>Сведения об ученике</span>
          {f.fields.map((x, i) => (
            <div key={x.id} className="flex flex-wrap items-center gap-2">
              <input className={`${input} flex-1 min-w-[160px]`} value={x.label} onChange={e => setField(i, { label: e.target.value })} />
              <select className={`${input} !w-auto max-w-[280px]`} value={x.source} onChange={e => setField(i, { source: e.target.value as CandidateField["source"] })}>
                <optgroup label="Карточка">{CARD_SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</optgroup>
                {answers.length > 0 && <optgroup label="Анкета родителя">{answers.map(q => <option key={q.id} value={`answer:${q.id}`}>{q.label}</option>)}</optgroup>}
                {x.source.startsWith("answer:") && !answers.some(q => `answer:${q.id}` === x.source) && <option value={x.source}>Вопрос удалён из анкеты</option>}
              </select>
              <input className={`${input} !w-24`} value={(x.grades || []).join(", ")} placeholder="классы" title="Только для классов, например 7"
                onChange={e => setField(i, { grades: e.target.value.split(/[,\s]+/).map(Number).filter(n => Number.isInteger(n) && n > 0 && n <= 12) })} />
              <label className="flex items-center gap-1 text-xs text-[var(--text-main)]"><input type="checkbox" checked={!!x.half} onChange={e => setField(i, { half: e.target.checked })} /> ½</label>
              <button type="button" className={btn} onClick={() => set({ fields: move(f.fields, i, -1) })} disabled={i === 0}><ArrowUp className="w-4 h-4" /></button>
              <button type="button" className={btn} onClick={() => set({ fields: move(f.fields, i, 1) })} disabled={i === f.fields.length - 1}><ArrowDown className="w-4 h-4" /></button>
              <button type="button" className={btn} onClick={() => set({ fields: f.fields.filter((_, k) => k !== i) })}><Trash2 className="w-4 h-4 text-rose-600" /></button>
            </div>
          ))}
          <button type="button" className={btn} onClick={() => set({ fields: [...f.fields, { id: uid("f"), label: "Новое поле", source: "child.name" }] })}><Plus className="w-4 h-4" /> Поле</button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <span className={label}>Уровень по предмету</span>
            <div className="flex gap-2">{f.levels.map((l, i) => <input key={i} className={input} value={l} onChange={e => set({ levels: f.levels.map((x, k) => (k === i ? e.target.value : x)) as CandidateFormConfig["levels"] })} />)}</div>
          </div>
          <div>
            <span className={label}>Разбор по темам: сильные от % / зона роста ниже %</span>
            <div className="flex gap-2">
              <input type="number" min={0} max={100} className={input} value={f.topics.strong} onChange={e => set({ topics: { ...f.topics, strong: Number(e.target.value) || 0 } })} />
              <input type="number" min={0} max={100} className={input} value={f.topics.weak} onChange={e => set({ topics: { ...f.topics, weak: Number(e.target.value) || 0 } })} />
            </div>
          </div>
        </div>
        <div><span className={label}>Подсказка к обратной связи</span><input className={input} value={f.feedbackHint} onChange={e => set({ feedbackHint: e.target.value })} /></div>

        <div className="space-y-2">
          <span className={label}>Решение по кандидату</span>
          {f.decisions.map((d, i) => (
            <div key={d.id} className="flex flex-wrap items-center gap-2">
              <input className={`${input} flex-1 min-w-[160px]`} value={d.label} onChange={e => set({ decisions: f.decisions.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} />
              <label className="flex items-center gap-1 text-xs text-[var(--text-main)]"><input type="checkbox" checked={d.final} onChange={e => set({ decisions: f.decisions.map((x, k) => (k === i ? { ...x, final: e.target.checked } : x)) })} /> решение принято</label>
              <label className="flex items-center gap-1 text-xs text-[var(--text-main)]"><input type="checkbox" checked={!!d.trial} onChange={e => set({ decisions: f.decisions.map((x, k) => (k === i ? { ...x, trial: e.target.checked } : x)) })} /> даты пробного периода</label>
              <button type="button" className={btn} onClick={() => set({ decisions: f.decisions.filter((_, k) => k !== i) })} disabled={f.decisions.length < 2}><Trash2 className="w-4 h-4 text-rose-600" /></button>
            </div>
          ))}
          <button type="button" className={btn} onClick={() => set({ decisions: [...f.decisions, { id: uid("d"), label: "Новое решение", final: true }] })}><Plus className="w-4 h-4" /> Вариант</button>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-[var(--text-main)]">
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.showStages} onChange={e => set({ showStages: e.target.checked })} /> Этапы поступления</label>
          {([["klass", "Класс"], ["reviewDate", "Дата повторного рассмотрения"], ["parentNotified", "Родитель уведомлён"], ["nextContact", "Следующий контакт"]] as const).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={f.extras[k]} onChange={e => set({ extras: { ...f.extras, [k]: e.target.checked } })} /> {l}</label>
          ))}
        </div>
        <div><span className={label}>Примечание внизу</span><input className={input} value={f.note} onChange={e => set({ note: e.target.value })} /></div>

        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-end gap-2">
          <button className={btn} onClick={onClose}>Отмена</button>
          <button className={btnPrimary} disabled={busy} onClick={save}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Сохранить</button>
        </div>
      </div>
    </Modal>
  );
}
