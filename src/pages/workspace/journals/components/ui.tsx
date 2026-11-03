import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Search, Check } from "lucide-react";
import type { SelectOption } from "../../../../shared/journals";

/** Общие классы журналов — в тон остальному кабинету. */
export const card = "bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-sm";
export const input = "w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)] transition";
export const label = "block text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1";
export const btn = "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] transition disabled:opacity-50 cursor-pointer";
export const btnPrimary = "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition disabled:opacity-50 cursor-pointer";

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 p-3 overflow-y-auto" onMouseDown={onClose}>
      <div className={`${card} w-full ${wide ? "max-w-3xl" : "max-w-lg"} my-6`} onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
          <h3 className="font-bold text-[var(--text-main)]">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)]" title="Закрыть"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/**
 * Выбор из списка с поиском: учеников бывает несколько сотен, и обычный
 * <select> на телефоне превращается в бесконечную прокрутку. Ищет по
 * началу любого слова и по группе («7А» покажет весь класс).
 */
export function OptionPicker({
  options, value, onChange, multiple, values, onChangeMany, placeholder = "Начните вводить…", disabled,
}: {
  options: SelectOption[];
  value?: string | null;
  onChange?: (v: string | null) => void;
  multiple?: boolean;
  values?: string[];
  onChangeMany?: (v: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const chosen = new Set(multiple ? values || [] : value ? [value] : []);
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/ё/g, "е");
    const list = !s ? options : options.filter(o => {
      const hay = `${o.label} ${o.group || ""}`.toLowerCase().replace(/ё/g, "е");
      return hay.split(/\s+/).some(w => w.startsWith(s)) || hay.includes(s);
    });
    return list.slice(0, 80);
  }, [options, q]);

  const pick = (label: string) => {
    if (multiple) {
      const next = chosen.has(label) ? [...chosen].filter(x => x !== label) : [...chosen, label];
      onChangeMany?.(next);
      setQ("");
    } else {
      onChange?.(label);
      setOpen(false); setQ("");
    }
  };

  // Группа целиком — для «опоздал весь 7А».
  const groupHit = multiple && q.trim() ? options.filter(o => (o.group || "").toLowerCase() === q.trim().toLowerCase()) : [];

  return (
    <div ref={box} className="relative">
      {multiple && chosen.size > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {[...chosen].map(c => (
            <span key={c} className="inline-flex items-center gap-1 text-xs bg-[var(--accent)]/10 text-[var(--accent)] rounded-full pl-2 pr-1 py-0.5">
              {c}
              <button type="button" onClick={() => pick(c)} className="hover:bg-[var(--accent)]/20 rounded-full p-0.5"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          className={`${input} pl-8 ${!multiple && value ? "font-medium" : ""}`}
          placeholder={!multiple && value ? value : placeholder}
          value={open ? q : (!multiple && value) || ""}
          onFocus={() => { setOpen(true); setQ(""); }}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          disabled={disabled}
        />
        {!multiple && value && !disabled && (
          <button type="button" onClick={() => onChange?.(null)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-main)]" title="Очистить"><X className="w-3.5 h-3.5" /></button>
        )}
      </div>
      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-lg">
          {groupHit.length > 0 && (
            <button type="button" className="w-full text-left px-3 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--bg-surface-hover)] border-b border-[var(--border-color)]"
              onClick={() => { onChangeMany?.([...new Set([...chosen, ...groupHit.map(o => o.label)])]); setQ(""); }}>
              Добавить всю группу «{groupHit[0].group}» ({groupHit.length})
            </button>
          )}
          {hits.length === 0 && (
            <div className="px-3 py-3 text-sm text-[var(--text-muted)]">
              {options.length ? "Ничего не найдено" : "Список пуст — его заполняет ответственный в настройках журнала"}
            </div>
          )}
          {hits.map(o => (
            <button key={o.label} type="button" onClick={() => pick(o.label)}
              className="w-full flex items-center justify-between gap-2 text-left px-3 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]">
              <span className="flex items-center gap-2 min-w-0">
                {chosen.has(o.label) ? <Check className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" /> : <span className="w-3.5 shrink-0" />}
                <span className="truncate">{o.label}</span>
              </span>
              {o.group && <span className="text-[11px] text-[var(--text-muted)] shrink-0">{o.group}</span>}
            </button>
          ))}
          {options.length > hits.length && hits.length === 80 && (
            <div className="px-3 py-2 text-[11px] text-[var(--text-muted)]">Показаны первые 80 — уточните поиск</div>
          )}
        </div>
      )}
    </div>
  );
}

/** Три состояния: да / нет / не отмечено. */
export function TriToggle({ value, yes, no, onChange, disabled, compact }: {
  value: boolean | null | undefined; yes: string; no: string; onChange: (v: boolean | null) => void; disabled?: boolean; compact?: boolean;
}) {
  const b = (active: boolean, tone: string) =>
    `${compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"} rounded-md font-medium border transition disabled:opacity-50 ${active ? tone : "border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)]"}`;
  return (
    <div className="inline-flex gap-1">
      <button type="button" disabled={disabled} onClick={() => onChange(value === true ? null : true)}
        className={b(value === true, "bg-emerald-500/15 border-emerald-500/40 text-emerald-600")}>{yes}</button>
      <button type="button" disabled={disabled} onClick={() => onChange(value === false ? null : false)}
        className={b(value === false, "bg-rose-500/15 border-rose-500/40 text-rose-600")}>{no}</button>
    </div>
  );
}
