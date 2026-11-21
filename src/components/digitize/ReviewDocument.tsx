import { useLayoutEffect, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { DigitizedBlock, DigitizedBlockType } from "../../shared/digitize";
import { input } from "../ui";
import type { DocDraft } from "./saveDigitized";

const TYPE_LABEL: Record<DigitizedBlockType, string> = {
  heading: "Заголовок", subheading: "Подзаголовок", paragraph: "Абзац", bullet: "Список", numbered: "Нумерованный", quote: "Цитата",
};

function AutoTextarea({ value, onChange, className }: { value: string; onChange: (v: string) => void; className: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
  }, [value]);
  return <textarea ref={ref} rows={1} value={value} onChange={e => onChange(e.target.value)} className={`${className} resize-none overflow-hidden`} />;
}

export default function ReviewDocument({ draft, onChange }: { draft: DocDraft; onChange: (d: DocDraft) => void }) {
  const setBlock = (i: number, patch: Partial<DigitizedBlock>) =>
    onChange({ ...draft, blocks: draft.blocks.map((b, k) => (k === i ? { ...b, ...patch } : b)) });
  return (
    <div className="space-y-3">
      <input className={`${input} font-semibold`} value={draft.title} placeholder="Название" onChange={e => onChange({ ...draft, title: e.target.value })} />
      {draft.blocks.map((b, i) => {
        const doubt = !!b.doubt?.length;
        return (
          <div key={i} className={`rounded-lg border p-2 space-y-1.5 ${doubt ? "border-amber-400 bg-amber-400/10" : "border-[var(--border-color)] bg-[var(--bg-app)]"}`}>
            <div className="flex items-center gap-2">
              <select className={`${input} !w-auto`} value={b.type} onChange={e => setBlock(i, { type: e.target.value as DigitizedBlockType })}>
                {(Object.keys(TYPE_LABEL) as DigitizedBlockType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
              <button type="button" title="Удалить блок" onClick={() => onChange({ ...draft, blocks: draft.blocks.filter((_, k) => k !== i) })}
                className="ml-auto p-2 rounded text-[var(--text-muted)] hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
            </div>
            <AutoTextarea value={b.text} onChange={v => setBlock(i, { text: v })} className={`${input} ${b.type === "heading" ? "font-bold" : ""}`} />
            {doubt && (
              <div className="flex flex-wrap gap-1">
                {b.doubt!.map((w, k) => <span key={k} className="text-[11px] px-1.5 py-0.5 rounded bg-amber-400/30 text-amber-700 dark:text-amber-300">{w}</span>)}
              </div>
            )}
          </div>
        );
      })}
      <button type="button" onClick={() => onChange({ ...draft, blocks: [...draft.blocks, { type: "paragraph", text: "" }] })}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-dashed border-[var(--border-color)] text-[var(--text-main)]">
        <Plus className="w-4 h-4" /> Абзац
      </button>
    </div>
  );
}
