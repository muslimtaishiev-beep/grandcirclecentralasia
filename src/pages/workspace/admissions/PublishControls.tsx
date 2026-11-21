import React, { useEffect, useRef, useState } from "react";
import { CalendarClock, ChevronDown, Send } from "lucide-react";
import { Button } from "../../../components/ui";
import { Modal, btn, input, label } from "../journals/components/ui";

/** Дата и время для поля datetime-local (местное время). */
const local = (ms: number) => {
  const d = new Date(ms); const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
/** «21.11 18:00» */
export const whenShort = (ms: number) => new Date(ms).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", "");

const quick = () => {
  const now = Date.now();
  const at = (d: Date, h: number) => { d.setHours(h, 0, 0, 0); return d.getTime(); };
  const tomorrow = new Date(now + 86_400_000);
  return [
    { label: "Через 1 час", at: now + 3_600_000 },
    { label: "Сегодня 18:00", at: at(new Date(now), 18) },
    { label: "Завтра 9:00", at: at(tomorrow, 9) },
  ].filter(q => q.at >= now + 120_000);
};

/** Окно выбора времени публикации. onPick получает момент в мс. */
export function PublishWhenModal({ title = "Запланировать публикацию", onClose, onPick }: { title?: string; onClose: () => void; onPick: (at: number) => Promise<void> | void }) {
  const [value, setValue] = useState(() => local(quick()[0]?.at ?? Date.now() + 3_600_000));
  const [busy, setBusy] = useState(false);
  const at = new Date(value).getTime();
  const ok = Number.isFinite(at) && at >= Date.now() + 60_000;
  const go = async () => { setBusy(true); try { await onPick(at); } finally { setBusy(false); } };
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {quick().map(q => <button key={q.label} type="button" className={btn} onClick={() => setValue(local(q.at))}>{q.label}</button>)}
        </div>
        <div><span className={label}>Дата и время</span><input type="datetime-local" className={input} value={value} onChange={e => setValue(e.target.value)} /></div>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" loading={busy} disabled={!ok} icon={<CalendarClock className="w-4 h-4" />} onClick={go}>Запланировать</Button>
        </div>
      </div>
    </Modal>
  );
}

/** Сплит-кнопка: «Опубликовать» сейчас или меню «Запланировать…». */
export function SplitPublishButton({ text = "Опубликовать результаты", size = "sm", loading, disabled, onNow, onSchedule, className = "" }: {
  text?: string; size?: "sm" | "md"; loading?: boolean; disabled?: boolean; onNow: () => void; onSchedule: () => void; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div ref={box} className={`relative inline-flex ${className}`}>
      <Button size={size} variant="primary" loading={loading} disabled={disabled} className="rounded-r-none" icon={<Send className="w-4 h-4" />} onClick={onNow}>{text}</Button>
      <Button size={size} variant="primary" disabled={disabled || loading} className="rounded-l-none border-l border-white/30 !px-2" aria-label="Выбрать время публикации" aria-expanded={open} onClick={() => setOpen(o => !o)}><ChevronDown className="w-4 h-4" /></Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 min-w-[190px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-lg p-1">
          <button type="button" className="w-full text-left px-3 py-2 text-sm rounded-lg text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]" onClick={() => { setOpen(false); onNow(); }}>Сейчас</button>
          <button type="button" className="w-full text-left px-3 py-2 text-sm rounded-lg text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]" onClick={() => { setOpen(false); onSchedule(); }}>Запланировать…</button>
        </div>
      )}
    </div>
  );
}

export interface PublishOutcome { done: number; scheduled: number; skipped: { id: string; reason: string }[]; noDecision?: number }

/** Итог одной строкой для тоста. */
export const outcomeText = (j: PublishOutcome) => {
  const skipped = j.skipped.length + (j.noDecision || 0);
  return [j.done ? `опубликовано ${j.done}` : "", j.scheduled ? `запланировано ${j.scheduled}` : "", skipped ? `пропущено ${skipped}` : ""].filter(Boolean).join(", ") || "Ничего не сделано";
};

/** Окно с причинами пропусков. names — id → ФИО. */
export function SkippedModal({ outcome, names, onClose }: { outcome: PublishOutcome; names: Record<string, string>; onClose: () => void }) {
  return (
    <Modal title={outcomeText(outcome)} onClose={onClose}>
      <ul className="space-y-1 text-sm max-h-80 overflow-y-auto">
        {outcome.skipped.map(s => <li key={s.id} className="flex justify-between gap-3"><span className="text-[var(--text-main)]">{names[s.id] || s.id}</span><span className="text-[var(--text-muted)] text-right">{s.reason}</span></li>)}
        {!!outcome.noDecision && <li className="flex justify-between gap-3"><span className="text-[var(--text-main)]">Без окончательного решения</span><span className="text-[var(--text-muted)]">{outcome.noDecision}</span></li>}
      </ul>
      <div className="flex justify-end pt-3"><Button onClick={onClose}>Закрыть</Button></div>
    </Modal>
  );
}
