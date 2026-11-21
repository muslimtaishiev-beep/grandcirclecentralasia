import React, { useContext, useMemo } from "react";
import { ArrowDown, ArrowUp, Film, Plus, Sparkles, Trash2, Mail } from "lucide-react";
import { Button, Tabs, toast } from "../../../components/ui";
import { BLOCK_TYPES, FORM_RESULT_VARS, RESULT_VARS, newBlock, newStep, type Block, type BlockType, type Frame, type LetterStep, type Step, type Theme, type Variant } from "../../../shared/resultPages";
import { FocusCtx, MediaField, Section, TextField, Thumb, Toggle, type OrgInfo } from "./EditorKit";

export type Sel = { t: "step"; id: string } | { t: "block"; id: string } | { t: "theme" };
export type Patch = (fn: (v: Variant) => Variant) => void;

const STEP_LABEL: Record<Step["type"], string> = { splash: "Заставка", video: "Видео", letter: "Письмо" };
const MAX_STEPS = 4;
const row = "flex items-center gap-1 rounded-lg border px-2 py-1.5 text-sm cursor-pointer";
const rowOn = "border-[var(--accent)] bg-[var(--accent)]/10";
const rowOff = "border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]";
const mini = "p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30";

const letterOf = (v: Variant): LetterStep => v.steps[v.steps.length - 1] as LetterStep;
const swap = <T,>(xs: T[], i: number, d: number): T[] => { const j = i + d; if (j < 0 || j >= xs.length) return xs; const n = [...xs]; [n[i], n[j]] = [n[j], n[i]]; return n; };
const blockText = (b: Block) => ("text" in b && b.text) || ("title" in b && b.title) || ("name" in b && b.name) || "";

/** Вставить переменную в последнее выбранное текстовое поле. */
function useInsertVar() {
  const { last } = useContext(FocusCtx);
  return (key: string) => {
    const l = last.current;
    if (!l || !l.el.isConnected) { toast.error("Выберите текстовое поле"); return; }
    const v = l.el.value;
    const s = l.el.selectionStart ?? v.length;
    const e = l.el.selectionEnd ?? s;
    const ins = `{{${key}}}`;
    l.set(v.slice(0, s) + ins + v.slice(e));
    const pos = s + ins.length;
    requestAnimationFrame(() => { if (l.el.isConnected) { l.el.focus(); l.el.setSelectionRange(pos, pos); } });
  };
}

export function LeftPanel({ variant, sel, onSelect, patch, pageKind }: { variant: Variant; sel: Sel; onSelect: (s: Sel) => void; patch: Patch; pageKind?: "form" }) {
  const insertVar = useInsertVar();
  const letter = letterOf(variant);
  const free = variant.steps.length < MAX_STEPS;
  const addStep = (type: "splash" | "video") => {
    const s = newStep(type);
    patch(v => ({ ...v, steps: [...v.steps.slice(0, -1), s, v.steps[v.steps.length - 1]] }));
    onSelect({ t: "step", id: s.id });
  };
  const moveStep = (i: number, d: number) => patch(v => ({ ...v, steps: [...swap(v.steps.slice(0, -1), i, d), v.steps[v.steps.length - 1]] }));
  const delStep = (id: string) => { patch(v => ({ ...v, steps: v.steps.filter(s => s.id !== id) })); onSelect({ t: "step", id: letter.id }); };
  const addBlock = (type: BlockType) => {
    const b = newBlock(type);
    patch(v => ({ ...v, steps: v.steps.map(s => (s.type === "letter" ? { ...s, blocks: [...s.blocks, b] } : s)) }));
    onSelect({ t: "block", id: b.id });
  };
  const moveBlock = (i: number, d: number) => patch(v => ({ ...v, steps: v.steps.map(s => (s.type === "letter" ? { ...s, blocks: swap(s.blocks, i, d) } : s)) }));
  const delBlock = (id: string) => { patch(v => ({ ...v, steps: v.steps.map(s => (s.type === "letter" ? { ...s, blocks: s.blocks.filter(b => b.id !== id) } : s)) })); onSelect({ t: "step", id: letter.id }); };
  const pre = variant.steps.slice(0, -1);

  return (
    <div className="p-3 space-y-5">
      <Section title="Шаги" right={
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" disabled={!free} icon={<Plus className="w-3.5 h-3.5" />} onClick={() => addStep("splash")}>Заставка</Button>
          <Button size="sm" variant="ghost" disabled={!free} icon={<Plus className="w-3.5 h-3.5" />} onClick={() => addStep("video")}>Видео</Button>
        </div>}>
        <div className="space-y-1">
          {pre.map((s, i) => (
            <div key={s.id} className={`${row} ${sel.t === "step" && sel.id === s.id ? rowOn : rowOff}`} onClick={() => onSelect({ t: "step", id: s.id })}>
              {s.type === "video" ? <Film className="w-4 h-4 shrink-0 text-[var(--text-muted)]" /> : <Sparkles className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />}
              <span className="flex-1 truncate">{i + 1}. {STEP_LABEL[s.type]}</span>
              <button className={mini} title="Выше" disabled={i === 0} onClick={e => { e.stopPropagation(); moveStep(i, -1); }}><ArrowUp className="w-3.5 h-3.5" /></button>
              <button className={mini} title="Ниже" disabled={i === pre.length - 1} onClick={e => { e.stopPropagation(); moveStep(i, 1); }}><ArrowDown className="w-3.5 h-3.5" /></button>
              <button className={mini} title="Удалить" onClick={e => { e.stopPropagation(); delStep(s.id); }}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <div className={`${row} ${sel.t === "step" && sel.id === letter.id ? rowOn : rowOff}`} onClick={() => onSelect({ t: "step", id: letter.id })}>
            <Mail className="w-4 h-4 shrink-0 text-[var(--text-muted)]" /><span className="flex-1">{pre.length + 1}. Письмо</span>
          </div>
        </div>
      </Section>

      <Section title="Добавить в письмо">
        <div className="grid grid-cols-2 gap-1.5">
          {BLOCK_TYPES.map(b => (
            <button key={b.type} className="text-left text-xs rounded-lg border border-[var(--border-color)] px-2 py-1.5 text-[var(--text-main)] hover:border-[var(--accent)] hover:text-[var(--accent)] flex items-center gap-1" onClick={() => addBlock(b.type)}>
              <Plus className="w-3 h-3 shrink-0" /> <span className="truncate">{b.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Блоки письма">
        <div className="space-y-1">
          {letter.blocks.map((b, i) => (
            <div key={b.id} className={`${row} ${sel.t === "block" && sel.id === b.id ? rowOn : rowOff}`} onClick={() => onSelect({ t: "block", id: b.id })}>
              <span className="flex-1 min-w-0 truncate"><span className="text-[var(--text-muted)] text-xs">{BLOCK_TYPES.find(x => x.type === b.type)?.label}</span>{blockText(b) ? ` · ${blockText(b).slice(0, 40)}` : ""}</span>
              <button className={mini} title="Выше" disabled={i === 0} onClick={e => { e.stopPropagation(); moveBlock(i, -1); }}><ArrowUp className="w-3.5 h-3.5" /></button>
              <button className={mini} title="Ниже" disabled={i === letter.blocks.length - 1} onClick={e => { e.stopPropagation(); moveBlock(i, 1); }}><ArrowDown className="w-3.5 h-3.5" /></button>
              <button className={mini} title="Удалить" onClick={e => { e.stopPropagation(); delBlock(b.id); }}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {!letter.blocks.length && <div className="text-xs text-[var(--text-muted)] px-1">Пусто</div>}
        </div>
      </Section>

      <Section title="Переменные">
        <div className="flex flex-wrap gap-1.5">
          {(pageKind === "form" ? FORM_RESULT_VARS : RESULT_VARS).map(v => (
            <button key={v.key} title={`{{${v.key}}}`} onMouseDown={e => e.preventDefault()} onClick={() => insertVar(v.key)}
              className="text-xs rounded-full border border-[var(--border-color)] px-2 py-1 text-[var(--text-main)] hover:border-[var(--accent)] hover:text-[var(--accent)]">{v.label}</button>
          ))}
        </div>
      </Section>
    </div>
  );
}

const FRAMES: { id: Frame; label: string }[] = [
  { id: "card", label: "Бумага с краями" }, { id: "full", label: "Без краёв" }, { id: "vintage", label: "Старинная бумага" },
];

function ThemePanel({ variant, org, patch }: { variant: Variant; org: OrgInfo; patch: Patch }) {
  const th = variant.theme;
  const set = (p: Partial<Theme>) => patch(v => ({ ...v, theme: { ...v.theme, ...p } }));
  const letterId = letterOf(variant).id;
  const thumbs = useMemo(() => FRAMES.map(f => ({ ...f, v: { ...variant, theme: { ...variant.theme, frame: f.id } } })), [variant]);
  return (
    <div className="p-3 space-y-5">
      <Section title="Стиль письма">
        <div className="grid grid-cols-3 gap-2">
          {thumbs.map(f => (
            <div key={f.id} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") set({ frame: f.id }); }} onClick={() => set({ frame: f.id })} className={`cursor-pointer rounded-lg border p-1 text-center ${th.frame === f.id ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30" : "border-[var(--border-color)] hover:border-[var(--accent)]"}`}>
              <Thumb variant={f.v} org={org} width={78} stepId={letterId} />
              <div className="text-[11px] mt-1 leading-tight text-[var(--text-main)]">{f.label}</div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Оформление">
        <Toggle checked={th.confetti} onChange={confetti => set({ confetti })}>Конфетти</Toggle>
        <Toggle checked={th.seal} onChange={seal => set({ seal })}>Печать с логотипом</Toggle>
        <div className="grid grid-cols-2 gap-2">
          {([["accent", "Акцентный цвет"], ["background", "Фон"]] as const).map(([k, l]) => (
            <label key={k} className="block space-y-1">
              <span className="text-xs text-[var(--text-muted)]">{l}</span>
              <span className="flex items-center gap-2"><input type="color" className="w-9 h-8 rounded border border-[var(--border-color)] bg-transparent p-0.5" value={th[k]} onChange={e => set({ [k]: e.target.value } as Partial<Theme>)} /><span className="text-xs font-mono text-[var(--text-muted)]">{th[k]}</span></span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          {([["serif", "С засечками"], ["sans", "Без засечек"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => set({ font: k })} style={{ fontFamily: k === "serif" ? "Georgia, serif" : "system-ui, sans-serif" }}
              className={`flex-1 rounded-lg border px-2 py-2 text-sm text-[var(--text-main)] ${th.font === k ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]"}`}>{l}</button>
          ))}
        </div>
        <TextField label="Шапка письма" value={th.header} onChange={header => set({ header })} placeholder="Приёмная комиссия" max={120} />
      </Section>
    </div>
  );
}

function ItemPanel({ tenantId, variant, sel, patch }: { tenantId: string; variant: Variant; sel: Sel; patch: Patch }) {
  const step = sel.t === "step" ? variant.steps.find(s => s.id === sel.id) : undefined;
  const block = sel.t === "block" ? letterOf(variant).blocks.find(b => b.id === sel.id) : undefined;
  const updStep = (id: string, p: Record<string, unknown>) => patch(v => ({ ...v, steps: v.steps.map(s => (s.id === id ? ({ ...s, ...p } as Step) : s)) }));
  const updBlock = (id: string, p: Record<string, unknown>) => patch(v => ({ ...v, steps: v.steps.map(s => (s.type === "letter" ? { ...s, blocks: s.blocks.map(b => (b.id === id ? ({ ...b, ...p } as Block) : b)) } : s)) }));

  if (step?.type === "splash") return (
    <div className="p-3 space-y-3">
      <Section title="Заставка" children={<></>} />
      <TextField label="Заголовок" value={step.title} onChange={title => updStep(step.id, { title })} />
      <TextField label="Подзаголовок" value={step.subtitle} onChange={subtitle => updStep(step.id, { subtitle })} />
      <TextField label="Кнопка" value={step.buttonText} onChange={buttonText => updStep(step.id, { buttonText })} max={40} />
    </div>
  );
  if (step?.type === "video") return (
    <div className="p-3 space-y-3">
      <Section title="Видео" children={<></>} />
      <MediaField tenantId={tenantId} accept="video" label="Видео (MP4, WebM до 100 МБ)" value={step.media} onChange={m => updStep(step.id, { media: m || { source: "url", url: "" } })} />
      <Toggle checked={step.skippable} onChange={skippable => updStep(step.id, { skippable })}>Можно пропустить</Toggle>
      <TextField label="Подпись" value={step.caption} onChange={caption => updStep(step.id, { caption })} />
    </div>
  );
  if (step?.type === "letter") return <div className="p-3 text-sm text-[var(--text-muted)]">Письмо: выберите блок слева или в предпросмотре</div>;
  if (!block) return <div className="p-3 text-sm text-[var(--text-muted)]">Ничего не выбрано</div>;
  const title = BLOCK_TYPES.find(x => x.type === block.type)?.label || "";
  return (
    <div className="p-3 space-y-3">
      <Section title={title} children={<></>} />
      {block.type === "heading" && <TextField label="Текст" value={block.text} onChange={text => updBlock(block.id, { text })} />}
      {block.type === "text" && <TextField label="Текст" multiline max={5000} value={block.text} onChange={text => updBlock(block.id, { text })} />}
      {(block.type === "results" || block.type === "feedback" || block.type === "trial") && <TextField label="Заголовок" value={block.title} onChange={t => updBlock(block.id, { title: t })} max={80} />}
      {block.type === "signature" && (<>
        <TextField label="Имя" value={block.name} onChange={name => updBlock(block.id, { name })} />
        <TextField label="Должность" value={block.role} onChange={role => updBlock(block.id, { role })} />
        <MediaField tenantId={tenantId} accept="image" label="Картинка подписи" value={block.image} onChange={image => updBlock(block.id, { image })} />
      </>)}
      {block.type === "image" && (<>
        <MediaField tenantId={tenantId} accept="image" label="Картинка (JPEG, PNG)" value={block.media} onChange={m => updBlock(block.id, { media: m || { source: "url", url: "" } })} />
        <TextField label="Описание" value={block.alt} onChange={alt => updBlock(block.id, { alt })} />
      </>)}
      {block.type === "button" && (<>
        <TextField label="Текст кнопки" value={block.text} onChange={text => updBlock(block.id, { text })} max={60} />
        <TextField label="Ссылка" value={block.url} placeholder="https://…" max={600} onChange={url => updBlock(block.id, { url })} />
      </>)}
      {block.type === "divider" && <div className="text-sm text-[var(--text-muted)]">Без настроек</div>}
    </div>
  );
}

export function RightPanel({ tenantId, variant, sel, onSelect, patch, org }: { tenantId: string; variant: Variant; sel: Sel; onSelect: (s: Sel | "item") => void; patch: Patch; org: OrgInfo }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3"><Tabs value={sel.t === "theme" ? "theme" : "item"} onChange={id => onSelect(id === "theme" ? { t: "theme" } : "item")} tabs={[{ id: "item", label: "Выбранное" }, { id: "theme", label: "Оформление" }]} /></div>
      <div className="flex-1 overflow-y-auto">
        {sel.t === "theme" ? <ThemePanel variant={variant} org={org} patch={patch} /> : <ItemPanel tenantId={tenantId} variant={variant} sel={sel} patch={patch} />}
      </div>
    </div>
  );
}
