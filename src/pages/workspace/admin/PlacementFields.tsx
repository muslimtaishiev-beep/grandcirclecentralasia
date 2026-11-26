import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button, Modal } from "../../../components/ui";
import {
  EMPTY_PLACEMENT, SCHOOL_LEVELS, STAFF_GRADES, classesText, gradeOfClass, levelsOf, normClass,
  type SchoolLevel, type StaffDirectory, type StaffPlacement,
} from "../../../shared/staffPlacement";

/**
 * «Где работает»: классы, литеры, ступени, предметы, свои группы. Один
 * редактор для карточки сотрудника, приглашения и массовой отметки.
 */
const chip = (on: boolean) => `px-2.5 h-8 min-w-[2rem] rounded-lg text-sm font-medium border transition ${on ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--accent)]"}`;
const lbl = "block text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1.5";

export function PlacementFields({ value, onChange, directory }: { value: StaffPlacement; onChange: (p: StaffPlacement) => void; directory: StaffDirectory }) {
  const [lettersOpen, setLettersOpen] = useState(value.classes.length > 0);
  const set = (p: Partial<StaffPlacement>) => onChange({ ...value, ...p });
  const toggleGrade = (g: number) => value.grades.includes(g)
    ? set({ grades: value.grades.filter(x => x !== g), classes: value.classes.filter(c => gradeOfClass(c) !== g) })
    : set({ grades: [...value.grades, g].sort((a, b) => a - b) });
  const auto = levelsOf({ grades: value.grades, levels: [] });
  const toggleLevel = (l: SchoolLevel) => {
    const cur = value.levels.length ? value.levels : auto;
    set({ levels: cur.includes(l) ? cur.filter(x => x !== l) : [...cur, l] });
  };
  const shownLevels = value.levels.length ? value.levels : auto;
  return (
    <div className="space-y-4">
      <div>
        <span className={lbl}>Классы</span>
        <div className="flex flex-wrap gap-1.5">
          {STAFF_GRADES.map(g => <button key={g} type="button" className={chip(value.grades.includes(g))} onClick={() => toggleGrade(g)}>{g}</button>)}
        </div>
        {!lettersOpen ? (
          <button type="button" className="mt-1.5 text-xs text-[var(--accent)] hover:underline" onClick={() => setLettersOpen(true)}>+ Литеры (5А, 5Б…)</button>
        ) : (
          <TagInput className="mt-2" placeholder="5А, 5Б" values={value.classes} normalize={normClass}
            onChange={classes => set({ classes, grades: [...new Set([...value.grades, ...classes.map(gradeOfClass)])].sort((a, b) => a - b) })} />
        )}
      </div>
      <div>
        <span className={lbl}>Ступень{!value.levels.length && auto.length ? " · по классам" : ""}</span>
        <div className="flex flex-wrap gap-1.5">
          {SCHOOL_LEVELS.map(l => <button key={l.id} type="button" className={chip(shownLevels.includes(l.id))} onClick={() => toggleLevel(l.id)}>{l.label}</button>)}
          {!!value.levels.length && <button type="button" className="text-xs text-[var(--text-muted)] hover:underline px-1" onClick={() => set({ levels: [] })}>по классам</button>}
        </div>
      </div>
      <div>
        <span className={lbl}>Предметы</span>
        <TagInput values={value.subjects} suggest={directory.subjects} placeholder="Математика" onChange={subjects => set({ subjects })} />
      </div>
      <div>
        <span className={lbl}>Группы</span>
        <TagInput values={value.groups} suggest={directory.groups} placeholder="МО начальных классов" onChange={groups => set({ groups })} />
      </div>
    </div>
  );
}

/** Метки: ввод с подсказками из справочника, Enter или запятая — добавить. */
function TagInput({ values, onChange, suggest = [], placeholder, normalize, className = "" }: {
  values: string[]; onChange: (v: string[]) => void; suggest?: string[]; placeholder?: string; normalize?: (v: string) => string; className?: string;
}) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const parts = raw.split(/[,;\n]/).map(x => (normalize ? normalize(x) : x.replace(/\s+/g, " ").trim())).filter(Boolean);
    const next = [...values];
    for (const p of parts) if (!next.some(x => x.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next); setText("");
  };
  const rest = suggest.filter(s => !values.some(v => v.toLowerCase() === s.toLowerCase()));
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] px-2 py-1.5">
        {values.map(v => (
          <span key={v} className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)]/10 px-2 py-0.5 text-sm text-[var(--accent)]">
            {v}<button type="button" aria-label={`Убрать ${v}`} onClick={() => onChange(values.filter(x => x !== v))}><X className="h-3 w-3" /></button>
          </span>
        ))}
        <input value={text} onChange={e => setText(e.target.value)} placeholder={values.length ? "" : placeholder}
          onKeyDown={e => { if ((e.key === "Enter" || e.key === ",") && text.trim()) { e.preventDefault(); add(text); } if (e.key === "Backspace" && !text && values.length) onChange(values.slice(0, -1)); }}
          onBlur={() => text.trim() && add(text)}
          className="min-w-[8rem] flex-1 bg-transparent text-sm text-[var(--text-main)] outline-none" />
      </div>
      {rest.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {rest.slice(0, 24).map(s => (
            <button key={s} type="button" onClick={() => add(s)} className="inline-flex items-center gap-0.5 rounded-md border border-dashed border-[var(--border-color)] px-1.5 py-0.5 text-xs text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]">
              <Plus className="h-3 w-3" />{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Окно правки места работы одного сотрудника. */
export function PlacementModal({ title, value, directory, onClose, onSave }: {
  title: string; value: StaffPlacement; directory: StaffDirectory; onClose: () => void; onSave: (p: StaffPlacement) => Promise<void>;
}) {
  const [draft, setDraft] = useState<StaffPlacement>(value);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={() => !busy && onClose()} wide>
      <PlacementFields value={draft} onChange={setDraft} directory={directory} />
      <div className="mt-5 flex justify-end gap-2 border-t border-[var(--border-color)] pt-3">
        <Button onClick={onClose} disabled={busy}>Отмена</Button>
        <Button variant="primary" loading={busy} onClick={async () => { setBusy(true); try { await onSave(draft); } finally { setBusy(false); } }}>Сохранить</Button>
      </div>
    </Modal>
  );
}

/** Массовая отметка: добавить или снять у выбранных. */
export function BulkPlacementModal({ count, directory, onClose, onSave }: {
  count: number; directory: StaffDirectory; onClose: () => void; onSave: (mode: "add" | "remove", p: StaffPlacement) => Promise<void>;
}) {
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [draft, setDraft] = useState<StaffPlacement>(EMPTY_PLACEMENT);
  const [busy, setBusy] = useState(false);
  const empty = !draft.grades.length && !draft.classes.length && !draft.levels.length && !draft.subjects.length && !draft.groups.length;
  return (
    <Modal title={`Отметить у выбранных: ${count}`} onClose={() => !busy && onClose()} wide>
      <div className="mb-4 inline-flex rounded-lg border border-[var(--border-color)] p-0.5 text-sm">
        {(["add", "remove"] as const).map(m => <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-md px-3 py-1 ${mode === m ? "bg-[var(--accent)] text-white" : "text-[var(--text-main)]"}`}>{m === "add" ? "Добавить" : "Убрать"}</button>)}
      </div>
      <PlacementFields value={draft} onChange={setDraft} directory={directory} />
      <div className="mt-5 flex justify-end gap-2 border-t border-[var(--border-color)] pt-3">
        <Button onClick={onClose} disabled={busy}>Отмена</Button>
        <Button variant={mode === "remove" ? "danger" : "primary"} loading={busy} disabled={empty} onClick={async () => { setBusy(true); try { await onSave(mode, draft); } finally { setBusy(false); } }}>
          {mode === "add" ? "Добавить" : "Убрать"}
        </Button>
      </div>
    </Modal>
  );
}

/** Одной строкой: «5А, 5Б · Средняя · Математика · МО». */
export function placementLine(p: StaffPlacement): string {
  return [classesText(p), levelsOf(p).map(l => SCHOOL_LEVELS.find(x => x.id === l)!.label.replace(" школа", "")).join(", "), p.subjects.join(", "), p.groups.join(", ")].filter(Boolean).join(" · ");
}
