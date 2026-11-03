import React, { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Loader2, Plus, Shuffle, Trash2, X } from "lucide-react";
import QuestionFactory from "../../../components/tests/QuestionFactory";
import { isAnswerCorrect } from "../../../lib/scoringEngine";
import {
  DIFFICULTY_LABEL, QUESTION_TYPES, TYPE_LABEL, normalizeLevels, validateQuestion,
  type BankQuestion, type Difficulty, type DropdownItem, type QuestionType,
} from "../../../shared/exams";
import { Modal, btn, btnPrimary, input, label } from "../journals/components/ui";
import { clickableToMarkup, inlineToMarkup, markupToClickable, markupToInline, shuffled } from "./markup";

/**
 * Редактор вопроса банка — все типы прежнего вступительного теста.
 *
 * Ключ ответа по возможности не пишется руками, а собирается из отметок:
 * выбрал верный вариант, расставил строки таблицы, выстроил порядок — ключ
 * готов в том же формате, что понимает проверка. Справа — вопрос глазами
 * ученика (тот же компонент, что на экзамене) и проверка: «засчитается ли
 * такой ответ».
 */
export type Draft = Partial<BankQuestion> & { type: QuestionType; disciplineId: string };

const blank = (disciplineId: string, levels: string[] = []): Draft => ({
  disciplineId, type: "multiple_choice", text: "", options: ["", ""], answer: "", levels, topic: "", difficulty: 2, points: 1, active: true,
});

export default function QuestionEditor({ initial, disciplineId, defaultLevels, canEdit, onSave, onClose }: {
  initial: BankQuestion | null;
  disciplineId: string;
  defaultLevels?: string[];
  canEdit: boolean;
  onSave: (d: Draft) => Promise<void>;
  onClose: () => void;
}) {
  const [d, setD] = useState<Draft>(() => (initial ? JSON.parse(JSON.stringify(initial)) : blank(disciplineId, defaultLevels)));
  const [levelsText, setLevelsText] = useState((initial?.levels || defaultLevels || []).join(", "));
  const [inlineMarkup, setInlineMarkup] = useState(() => inlineToMarkup(initial?.inlineSegments, initial?.answer));
  const [clickMarkup, setClickMarkup] = useState(() => clickableToMarkup(initial?.clickableSegments));
  const [order, setOrder] = useState<string[]>(() => {
    const a = (initial?.answer || "").split("||")[0].split(/\s*,\s*/).filter(Boolean);
    return a.length ? a : initial?.dragItems || ["", ""];
  });
  const [showHtml, setShowHtml] = useState(!!initial?.html);
  const [trial, setTrial] = useState<any>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<Draft>) => setD(x => ({ ...x, ...p }));

  // Запасные ключи («||») редактор не показывает — при сохранении их не теряем,
  // если основной ключ не менялся.
  const keepAlts = (main: string) => {
    const orig = initial?.answer || "";
    return orig.includes("||") && orig.split("||")[0].trim() === main.trim() ? orig : main;
  };
  // Перемешанный порядок для ученика — один раз на набор элементов, а не на каждую клавишу.
  const shuffleMemo = useRef<{ key: string; items: string[] } | null>(null);
  const shuffledFor = (items: string[]) => {
    const key = items.slice().sort().join("|");
    if (shuffleMemo.current?.key !== key) shuffleMemo.current = { key, items: shuffled(items) };
    return shuffleMemo.current.items;
  };

  // Итоговый вопрос с ключом, собранным из отметок.
  const built: Draft = useMemo(() => {
    const q: Draft = { ...d, levels: normalizeLevels(levelsText) };
    if (q.type === "inline_inputs") { const r = markupToInline(inlineMarkup); q.inlineSegments = r.segments; q.answer = keepAlts(r.answer); }
    if (q.type === "clickable_text") {
      q.clickableSegments = markupToClickable(clickMarkup);
      q.answer = keepAlts(q.clickableSegments.filter(s => s.id && s.isTarget).map(s => s.id).join(", "));
    }
    if (q.type === "drag_and_drop") {
      const items = order.map(s => s.trim()).filter(Boolean);
      q.answer = keepAlts(items.join(","));
      const same = (q.dragItems || []).slice().sort().join("|") === items.slice().sort().join("|");
      q.dragItems = same && (q.dragItems || []).join("|") !== items.join("|") ? q.dragItems : shuffledFor(items);
    }
    for (const k of ["options", "inlineOptions", "matrixRows", "matrixCols"] as const) if (q[k]) q[k] = (q[k] as string[]).map(s => s.trim()).filter(Boolean);
    if (q.dropdownItems) q.dropdownItems = q.dropdownItems.map(i => ({ label: i.label.trim(), options: i.options.map(o => o.trim()).filter(Boolean) })).filter(i => i.label || i.options.length);
    if (!showHtml) delete q.html;
    return q;
  }, [d, levelsText, inlineMarkup, clickMarkup, order, showHtml]);

  const issues = validateQuestion({ ...built, text: built.text || "", answer: built.answer || "", points: Number(built.points) || 0, difficulty: (built.difficulty || 2) as Difficulty });
  const errors = issues.filter(i => i.level === "error");
  const verdict = String(trial ?? "").trim() ? isAnswerCorrect(trial, built.answer || "") : null;

  const save = async () => {
    setBusy(true); setError(null);
    try { await onSave(built); } catch (e: any) { setError(e.message); setBusy(false); }
  };

  const changeType = (type: QuestionType) => {
    const p: Partial<Draft> = { type, answer: "" };
    if (["multiple_choice", "two_step"].includes(type) && !(d.options || []).length) p.options = ["", ""];
    if (type === "inline_dropdown" && !(d.inlineOptions || []).length) p.inlineOptions = ["", ""];
    if (type === "dropdown_multiple" && !(d.dropdownItems || []).length) p.dropdownItems = [{ label: "", options: ["", ""] }];
    if (type === "logic_matrix") { p.matrixRows = d.matrixRows?.length ? d.matrixRows : ["", ""]; p.matrixCols = d.matrixCols?.length ? d.matrixCols : ["", ""]; }
    set(p); setTrial("");
  };

  return (
    <Modal title={initial ? `Вопрос ${initial.id}` : "Новый вопрос"} onClose={onClose} xwide>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] gap-6">
        <fieldset disabled={!canEdit} className="space-y-4 min-w-0">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <span className={label}>Тип</span>
              <select className={input} value={d.type} onChange={e => changeType(e.target.value as QuestionType)}>
                {QUESTION_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">{QUESTION_TYPES.find(t => t.key === d.type)?.hint}</p>
            </div>
            <div>
              <span className={label}>Классы / уровни</span>
              <input className={input} value={levelsText} onChange={e => setLevelsText(e.target.value)} placeholder="7, 8, 9 — пусто: для всех" />
            </div>
            <div><span className={label}>Тема</span><input className={input} value={d.topic || ""} onChange={e => set({ topic: e.target.value })} placeholder="Например: Дроби" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className={label}>Сложность</span>
                <select className={input} value={d.difficulty || 2} onChange={e => set({ difficulty: Number(e.target.value) as Difficulty })}>
                  {([1, 2, 3] as Difficulty[]).map(x => <option key={x} value={x}>{DIFFICULTY_LABEL[x]}</option>)}
                </select>
              </div>
              <div><span className={label}>Баллы</span><input type="number" min={0.5} step={0.5} className={input} value={d.points ?? 1} onChange={e => set({ points: Number(e.target.value) })} /></div>
            </div>
          </div>

          {d.type === "inline_inputs" ? (
            <div>
              <span className={label}>Текст с пропусками</span>
              <textarea rows={5} className={`${input} font-mono`} value={inlineMarkup} onChange={e => setInlineMarkup(e.target.value)}
                placeholder={"Неслыха[[нн]]ая дерзость.\nЗадача реше[[н]]а."} />
              <p className="text-[11px] text-[var(--text-muted)] mt-1">Правильный ответ пишется в двойных квадратных скобках прямо в тексте: <code>реше[[н]]а</code>. Задание (например «Вставьте пропущенные буквы») — в поле ниже.</p>
            </div>
          ) : null}

          <div>
            <span className={label}>{d.type === "inline_inputs" ? "Задание" : d.type === "inline_dropdown" ? "Предложение (место пропуска — [gap])" : "Текст вопроса"}</span>
            <textarea rows={3} className={input} value={d.text || ""} onChange={e => set({ text: e.target.value })}
              placeholder={d.type === "inline_dropdown" ? "I usually [gap] at 7 a.m." : ""} />
            {!showHtml
              ? <button type="button" className="text-[11px] text-[var(--accent)] hover:underline mt-1" onClick={() => setShowHtml(true)}>+ оформленная версия (HTML: формулы, картинки)</button>
              : (
                <div className="mt-2">
                  <span className={label}>Оформленная версия (HTML) — ученик видит её вместо текста</span>
                  <textarea rows={3} className={`${input} font-mono text-xs`} value={d.html || ""} onChange={e => set({ html: e.target.value })} />
                  <button type="button" className="text-[11px] text-rose-600 hover:underline" onClick={() => { setShowHtml(false); set({ html: "" }); }}>Убрать HTML</button>
                </div>
              )}
          </div>
          <div><span className={label}>Инструкция (необязательно)</span><input className={input} value={d.instruction || ""} onChange={e => set({ instruction: e.target.value })} placeholder="Например: выберите правильный ответ" /></div>

          <TypeFields d={d} set={set} order={order} setOrder={setOrder} clickMarkup={clickMarkup} setClickMarkup={setClickMarkup} />

          {!["multiple_choice", "inline_dropdown", "dropdown_multiple", "logic_matrix", "drag_and_drop", "inline_inputs", "clickable_text"].includes(d.type) && (
            <div>
              <span className={label}>Правильный ответ</span>
              <input className={input} value={d.answer || ""} onChange={e => set({ answer: e.target.value })} placeholder={d.type === "number_input" ? "60" : "ответ"} />
              <p className="text-[11px] text-[var(--text-muted)] mt-1">Несколько допустимых ответов — через <code>||</code>. Регистр, пробелы и ё/е не важны{d.type === "number_input" ? "; «60 мин» засчитается для ключа «60»" : ""}.</p>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-[var(--text-main)]">
            <input type="checkbox" checked={d.active !== false} onChange={e => set({ active: e.target.checked })} /> Активен — попадает в экзамены
          </label>
        </fieldset>

        <div className="space-y-3 min-w-0">
          <div className="text-[11px] uppercase font-mono font-bold text-[var(--text-muted)]">Как увидит ученик</div>
          <div className="text-slate-900 [&_h3]:!text-base [&>div]:!p-4">
            <QuestionFactory question={built} value={trial} onChange={setTrial} />
          </div>
          <div className={`rounded-lg px-3 py-2 text-sm border ${verdict === null ? "border-[var(--border-color)] text-[var(--text-muted)]" : verdict ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" : "border-rose-500/40 bg-rose-500/10 text-rose-700"}`}>
            {verdict === null ? "Ответьте в предпросмотре — покажу, засчитается ли" : verdict ? "✓ Такой ответ засчитается" : "✗ Такой ответ не засчитается"}
            {built.answer && <div className="text-[11px] opacity-80 mt-0.5 break-words">Ключ: {built.answer}</div>}
          </div>
          {issues.length > 0 && (
            <ul className="text-xs space-y-1">
              {issues.map((i, k) => <li key={k} className={i.level === "error" ? "text-rose-600" : "text-amber-600"}>{i.level === "error" ? "Ошибка" : "Проверьте"}: {i.message}</li>)}
            </ul>
          )}
        </div>
      </div>

      {error && <div className="mt-3 text-sm text-rose-600">{error}</div>}
      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[var(--border-color)]">
        <button className={btn} onClick={onClose}>{canEdit ? "Отмена" : "Закрыть"}</button>
        {canEdit && <button className={btnPrimary} disabled={busy || errors.length > 0} onClick={save}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Сохранить</button>}
      </div>
    </Modal>
  );
}

/** Список строк с добавлением, удалением, перестановкой и отметкой верной. */
function ListEditor({ items, onChange, correct, onCorrect, placeholder }: {
  items: string[]; onChange: (v: string[]) => void; correct?: string; onCorrect?: (v: string) => void; placeholder?: string;
}) {
  const upd = (i: number, v: string) => { const n = [...items]; const was = n[i]; n[i] = v; onChange(n); if (onCorrect && correct === was && was) onCorrect(v); };
  const move = (i: number, dir: number) => { const n = [...items]; const j = i + dir; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {onCorrect && (
            <button type="button" title="Правильный" onClick={() => onCorrect(it)}
              className={`w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center ${correct && correct === it && it ? "border-emerald-500 bg-emerald-500 text-white" : "border-[var(--border-color)]"}`}>
              {correct && correct === it && it ? <Check className="w-3.5 h-3.5" /> : null}
            </button>
          )}
          <input className={`${input} flex-1`} value={it} onChange={e => upd(i, e.target.value)} placeholder={placeholder ? `${placeholder} ${i + 1}` : ""} />
          <button type="button" className="p-1.5 text-[var(--text-muted)] disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="w-3.5 h-3.5" /></button>
          <button type="button" className="p-1.5 text-[var(--text-muted)] disabled:opacity-30" disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown className="w-3.5 h-3.5" /></button>
          <button type="button" className="p-1.5 text-[var(--text-muted)] hover:text-rose-600" onClick={() => onChange(items.filter((_, k) => k !== i))}><X className="w-3.5 h-3.5" /></button>
        </div>
      ))}
      <button type="button" className={btn} onClick={() => onChange([...items, ""])}><Plus className="w-3.5 h-3.5" /> Добавить</button>
    </div>
  );
}

function TypeFields({ d, set, order, setOrder, clickMarkup, setClickMarkup }: {
  d: Draft; set: (p: Partial<Draft>) => void; order: string[]; setOrder: (v: string[]) => void;
  clickMarkup: string; setClickMarkup: (v: string) => void;
}) {
  const answerParts = (d.answer || "").split("||")[0].split(/\s*,\s*/);
  switch (d.type) {
    case "multiple_choice":
      return (
        <div>
          <span className={label}>Варианты — отметьте правильный</span>
          <ListEditor items={d.options || []} onChange={options => set({ options })} correct={d.answer} onCorrect={answer => set({ answer })} placeholder="Вариант" />
        </div>
      );
    case "two_step":
      return (
        <div className="space-y-3">
          <div><span className={label}>Предложения, среди которых искать ошибку</span><ListEditor items={d.options || []} onChange={options => set({ options })} placeholder="Предложение" /></div>
          <div><span className={label}>Второй шаг (что вписать)</span><input className={input} value={d.step2Text || ""} onChange={e => set({ step2Text: e.target.value })} placeholder="Запишите подобранное слово в поле ниже." /></div>
        </div>
      );
    case "inline_dropdown":
      return (
        <div>
          <span className={label}>Варианты для пропуска — отметьте правильный</span>
          <ListEditor items={d.inlineOptions || []} onChange={inlineOptions => set({ inlineOptions })} correct={d.answer} onCorrect={answer => set({ answer })} placeholder="Вариант" />
        </div>
      );
    case "dropdown_multiple": {
      const items = d.dropdownItems || [];
      const setItem = (i: number, p: Partial<DropdownItem>) => set({ dropdownItems: items.map((x, k) => (k === i ? { ...x, ...p } : x)) });
      const setAns = (i: number, v: string) => { const a = items.map((_, k) => answerParts[k] || ""); a[i] = v; set({ answer: a.join(",") }); };
      return (
        <div className="space-y-2">
          <span className={label}>Списки — у каждого свой правильный вариант</span>
          {items.map((it, i) => (
            <div key={i} className="rounded-lg border border-[var(--border-color)] p-3 space-y-2">
              <div className="flex gap-2">
                <input className={`${input} flex-1`} value={it.label} onChange={e => setItem(i, { label: e.target.value })} placeholder={`Пункт ${i + 1}, например «Ящик 1»`} />
                <button type="button" className={btn} onClick={() => set({ dropdownItems: items.filter((_, k) => k !== i), answer: answerParts.filter((_, k) => k !== i).join(",") })}><Trash2 className="w-4 h-4" /></button>
              </div>
              <ListEditor items={it.options} onChange={options => setItem(i, { options })} correct={answerParts[i]} onCorrect={v => setAns(i, v)} placeholder="Вариант" />
            </div>
          ))}
          <button type="button" className={btn} onClick={() => set({ dropdownItems: [...items, { label: "", options: ["", ""] }] })}><Plus className="w-3.5 h-3.5" /> Ещё список</button>
        </div>
      );
    }
    case "logic_matrix": {
      const rows = d.matrixRows || []; const cols = d.matrixCols || [];
      // Строку ищем по известным названиям строк: в «Санкт-Петербург-Север» первый дефис — часть названия.
      const map = new Map((d.answer || "").split("||")[0].split(",").map(p => {
        const pair = p.trim();
        const row = [...rows].sort((x, y) => y.length - x.length).find(r => r && pair.startsWith(`${r}-`));
        if (row) return [row, pair.slice(row.length + 1).trim()] as [string, string];
        const i = pair.indexOf("-"); return [pair.slice(0, i).trim(), pair.slice(i + 1).trim()] as [string, string];
      }));
      const pick = (r: string, c: string) => { map.set(r, c); set({ answer: rows.filter(x => map.get(x)).map(x => `${x}-${map.get(x)}`).join(",") }); };
      // В старых ключах столбец записан коротко («Чёрная» для «Чёрная рубашка») —
      // показываем столбец, с которого ключ начинается, как это делает проверка.
      const shown = (r: string) => { const v = map.get(r) || ""; return v ? cols.find(c => c === v || c.startsWith(v) || v.startsWith(c)) || "" : ""; };
      return (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div><span className={label}>Строки</span><ListEditor items={rows} onChange={matrixRows => set({ matrixRows })} placeholder="Строка" /></div>
            <div><span className={label}>Столбцы</span><ListEditor items={cols} onChange={matrixCols => set({ matrixCols })} placeholder="Столбец" /></div>
          </div>
          <div>
            <span className={label}>Правильное сопоставление</span>
            {rows.filter(Boolean).map(r => (
              <div key={r} className="flex items-center gap-2 mb-1">
                <span className="text-sm w-32 truncate text-[var(--text-main)]">{r}</span>
                <select className={`${input} flex-1`} value={shown(r)} onChange={e => pick(r, e.target.value)}>
                  <option value="">—</option>
                  {cols.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "drag_and_drop":
      return (
        <div>
          <span className={label}>Элементы в правильном порядке</span>
          <ListEditor items={order} onChange={setOrder} placeholder="Элемент" />
          <p className="text-[11px] text-[var(--text-muted)] mt-1 flex items-center gap-1"><Shuffle className="w-3 h-3" /> Ученику они покажутся перемешанными.</p>
        </div>
      );
    case "clickable_text":
      return (
        <div>
          <span className={label}>Текст с местами для знаков</span>
          <textarea rows={3} className={`${input} font-mono`} value={clickMarkup} onChange={e => setClickMarkup(e.target.value)} placeholder="Ветер [*] дующий [ ] с моря [*] принёс прохладу." />
          <p className="text-[11px] text-[var(--text-muted)] mt-1"><code>[*]</code> — здесь нужна запятая, <code>[ ]</code> — место, где её ставить не надо (ловушка).</p>
        </div>
      );
    default:
      return null;
  }
}

export const typeLabel = (t: QuestionType) => TYPE_LABEL[t];
