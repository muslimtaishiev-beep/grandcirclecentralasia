import React, { useState } from "react";
import { Filter, Plus, Trash2 } from "lucide-react";
import {
  LIST_VALUE, NO_VALUE, OPS, SCHOOL_GRADES, OP_LABEL, countConds, describeWhen, isGroup, sanitizeWhen,
  type Cond, type CondField, type CondGroup, type CondNode, type When,
} from "../../shared/conditions";
import { Modal, btn, btnPrimary, input } from "../../pages/workspace/journals/components/ui";

/**
 * Конструктор условий «показывать, если…». Один на весь продукт: место, где
 * живёт условие, отдаёт свои поля (CondField[]), окно собирает дерево
 * «все (И) / любое (ИЛИ)» из строк и одной вложенной группы.
 */

const GRADES = SCHOOL_GRADES.map(String);
const chip = (on: boolean) => `px-2.5 h-8 rounded-lg text-sm transition ${on ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-surface-hover)] text-[var(--text-main)] hover:opacity-80"}`;

/** Кнопка «Условия · N» — окно открывается только по ней. */
export function ConditionsButton({ value, fields, onChange, className = "" }: { value?: When; fields: CondField[]; onChange: (w: When | undefined) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const n = countConds(value);
  return (
    <>
      <button type="button" className={`${btn} whitespace-nowrap ${n ? "!border-[var(--accent)] !text-[var(--accent)]" : ""} ${className}`} onClick={() => setOpen(true)} title={n ? describeWhen(value, fields) : undefined}>
        <Filter className="w-4 h-4" /> {n ? `Условия · ${n}` : "Условия"}
      </button>
      {open && <ConditionsModal value={value} fields={fields} onClose={() => setOpen(false)} onSave={w => { onChange(w); setOpen(false); }} />}
    </>
  );
}

const newCond = (fields: CondField[]): Cond => {
  const f = fields.find(x => x.kind !== "grade") || fields[0];
  return { field: f?.id || "", op: OPS[f?.kind || "text"][0], ...(f?.kind === "grade" ? { value: [] } : {}) };
};

export function ConditionsModal({ value, fields, onSave, onClose }: { value?: When; fields: CondField[]; onSave: (w: When | undefined) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<CondGroup>(() => (value?.items.length ? JSON.parse(JSON.stringify(value)) : { mode: "all", items: [newCond(fields)] }));
  const clean = sanitizeWhen(draft, fields);
  const text = describeWhen(clean, fields);
  return (
    <Modal title="Показывать, если" onClose={onClose} wide>
      <div className="space-y-4">
        <GroupEditor g={draft} fields={fields} depth={0} onChange={setDraft} />
        {text && <div className="rounded-lg bg-[var(--bg-surface-hover)] px-3 py-2 text-sm text-[var(--text-main)]">{text}</div>}
        <div className="flex flex-wrap gap-2 justify-end">
          {!!value && <button type="button" className={`${btn} mr-auto text-rose-600`} onClick={() => onSave(undefined)}><Trash2 className="w-4 h-4" /> Без условий</button>}
          <button type="button" className={btn} onClick={onClose}>Отмена</button>
          <button type="button" className={btnPrimary} onClick={() => onSave(clean)}>Готово</button>
        </div>
      </div>
    </Modal>
  );
}

function GroupEditor({ g, fields, depth, onChange, onRemove }: { g: CondGroup; fields: CondField[]; depth: number; onChange: (g: CondGroup) => void; onRemove?: () => void }) {
  const setItem = (k: number, n: CondNode) => onChange({ ...g, items: g.items.map((x, j) => (j === k ? n : x)) });
  const drop = (k: number) => onChange({ ...g, items: g.items.filter((_, j) => j !== k) });
  const joint = g.mode === "any" ? "или" : "и";
  return (
    <div className={depth ? "rounded-xl border border-[var(--border-color)] p-2.5 space-y-2" : "space-y-2"}>
      {(g.items.length > 1 || depth > 0) && (
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-[var(--border-color)] p-0.5">
            {(["all", "any"] as const).map(m => (
              <button key={m} type="button" onClick={() => onChange({ ...g, mode: m })}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${g.mode === m ? "bg-[var(--accent)] text-white" : "text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]"}`}>
                {m === "all" ? "Все (И)" : "Любое (ИЛИ)"}
              </button>
            ))}
          </div>
          {onRemove && <button type="button" className={`${btn} ml-auto !px-2`} onClick={onRemove} title="Убрать группу"><Trash2 className="w-4 h-4 text-rose-600" /></button>}
        </div>
      )}
      {g.items.map((n, k) => (
        <React.Fragment key={k}>
          {k > 0 && <div className="text-xs font-semibold uppercase text-[var(--text-muted)] pl-1">{joint}</div>}
          {isGroup(n)
            ? <GroupEditor g={n} fields={fields} depth={depth + 1} onChange={x => setItem(k, x)} onRemove={() => drop(k)} />
            : <CondRow c={n} fields={fields} onChange={x => setItem(k, x)} onRemove={() => drop(k)} />}
        </React.Fragment>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={() => onChange({ ...g, items: [...g.items, newCond(fields)] })}><Plus className="w-4 h-4" /> Условие</button>
        {depth === 0 && <button type="button" className={btn} onClick={() => onChange({ ...g, items: [...g.items, { mode: g.mode === "all" ? "any" : "all", items: [newCond(fields), newCond(fields)] }] })}><Plus className="w-4 h-4" /> Группа</button>}
      </div>
    </div>
  );
}

function CondRow({ c, fields, onChange, onRemove }: { c: Cond; fields: CondField[]; onChange: (c: Cond) => void; onRemove: () => void }) {
  const f = fields.find(x => x.id === c.field);
  const groups = [...new Set(fields.map(x => x.group || ""))];
  const pickField = (id: string) => {
    const nf = fields.find(x => x.id === id);
    if (!nf) return;
    onChange({ field: id, op: OPS[nf.kind][0], ...(nf.kind === "grade" ? { value: [] } : {}) });
  };
  const pickOp = (op: Cond["op"]) => {
    const was = c.value;
    const list = Array.isArray(was) ? was : was ? [was] : [];
    onChange({ field: c.field, op, ...(NO_VALUE(op) ? {} : LIST_VALUE(op) ? { value: list } : { value: list[0] || "" }) });
  };
  const vals = Array.isArray(c.value) ? c.value : c.value ? [c.value] : [];
  const toggle = (id: string) => onChange({ ...c, value: LIST_VALUE(c.op) ? (vals.includes(id) ? vals.filter(x => x !== id) : [...vals, id]) : id });
  return (
    <div className="rounded-xl border border-[var(--border-color)] p-2.5 space-y-2">
      <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_10rem_auto] gap-2">
        <select className={input} value={c.field} onChange={e => pickField(e.target.value)}>
          {!f && <option value="">—</option>}
          {groups.map(gname => {
            const opts = fields.filter(x => (x.group || "") === gname).map(x => <option key={x.id} value={x.id}>{x.label}</option>);
            return gname ? <optgroup key={gname} label={gname}>{opts}</optgroup> : opts;
          })}
        </select>
        <button type="button" className={`${btn} !px-2 sm:order-3`} onClick={onRemove} title="Убрать"><Trash2 className="w-4 h-4 text-rose-600" /></button>
        {f && (
          <select className={`${input} col-span-2 sm:col-span-1 sm:order-2`} value={c.op} onChange={e => pickOp(e.target.value as Cond["op"])}>
            {OPS[f.kind].map(op => <option key={op} value={op}>{OP_LABEL[op]}</option>)}
          </select>
        )}
      </div>
      {f && !NO_VALUE(c.op) && (
        f.kind === "grade" ? (
          <div className="flex flex-wrap gap-1">{GRADES.map(n => <button key={n} type="button" className={`${chip(vals.includes(n))} tabular-nums min-w-9`} onClick={() => toggle(n)}>{n}</button>)}</div>
        ) : f.options ? (
          <div className="flex flex-wrap gap-1">{f.options.map(o => <button key={o.id} type="button" className={chip(vals.includes(o.id))} onClick={() => toggle(o.id)}>{o.label}</button>)}</div>
        ) : (
          <input className={input} type={f.kind === "number" ? "number" : f.kind === "date" ? "date" : "text"} value={vals[0] || ""} onChange={e => onChange({ ...c, value: e.target.value })} placeholder={f.kind === "text" ? "Текст" : ""} />
        )
      )}
    </div>
  );
}
