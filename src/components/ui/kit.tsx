import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { HelpCircle, Loader2 } from "lucide-react";

/**
 * Общий набор интерфейса кабинета: шапка страницы, вкладки в адресе,
 * кнопки, загрузка, пустое состояние, таблица, подсказка «?».
 * Цвета — только из CSS-переменных темы.
 */

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

// ── Кнопка ───────────────────────────────────────────────────────────────
export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";
const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white border border-transparent font-semibold",
  secondary: "border border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] font-medium",
  danger: "bg-rose-600 hover:bg-rose-700 text-white border border-transparent font-semibold",
  ghost: "text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] border border-transparent font-medium",
};
const SIZE: Record<ButtonSize, string> = { sm: "h-8 px-2.5 text-xs gap-1", md: "h-9 px-3 text-sm gap-1.5" };

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, className, children, disabled, type = "button", ...rest }, ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} {...rest}
      className={cx("inline-flex items-center justify-center rounded-lg transition whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]", VARIANT[variant], SIZE[size], className)}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

// ── Загрузка ─────────────────────────────────────────────────────────────
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <div role="status" className={cx("flex items-center justify-center gap-2 py-10 text-sm text-[var(--text-muted)]", className)}>
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className={label ? "" : "sr-only"}>{label || "Загрузка…"}</span>
    </div>
  );
}

// ── Пустое состояние ─────────────────────────────────────────────────────
export function EmptyState({ icon, title, action, className }: { icon?: React.ReactNode; title: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col items-center justify-center gap-3 py-14 px-4 text-center", className)}>
      {icon && <div className="text-[var(--text-muted)] [&>svg]:w-8 [&>svg]:h-8">{icon}</div>}
      <div className="text-sm font-medium text-[var(--text-main)]">{title}</div>
      {action}
    </div>
  );
}

// ── Таблица ──────────────────────────────────────────────────────────────
/** Обёртка: на телефоне таблица прокручивается сама, страница — нет. */
export function Table({ children, className, minWidth = 640 }: { children: React.ReactNode; className?: string; minWidth?: number }) {
  return (
    <div className={cx("overflow-x-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)]", className)}>
      <table className="w-full text-sm text-[var(--text-main)] [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-[var(--text-muted)] [&_td]:px-3 [&_td]:py-2.5 [&_tr]:border-b [&_tr]:border-[var(--border-color)] [&_tbody_tr:last-child]:border-0 [&_tbody_tr:hover]:bg-[var(--bg-surface-hover)]" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

// ── Вкладки ──────────────────────────────────────────────────────────────
export interface TabItem { id: string; label: string; icon?: React.ReactNode; count?: number; hidden?: boolean }

/** Активная вкладка живёт в адресе (?tab=…): переживает перезагрузку и ссылку. */
export function useUrlTab<T extends string>(key: string, tabs: readonly T[] | readonly { id: T }[], def: T): [T, (t: T) => void] {
  const [params, setParams] = useSearchParams();
  const ids = (tabs as readonly (T | { id: T })[]).map(t => (typeof t === "string" ? t : t.id));
  const raw = params.get(key) as T | null;
  const cur = raw && ids.includes(raw) ? raw : def;
  const set = useCallback((t: T) => {
    setParams(p => {
      const n = new URLSearchParams(p);
      if (t === def) n.delete(key); else n.set(key, t);
      return n;
    }, { replace: true });
  }, [key, def, setParams]);
  return [cur, set];
}

export function Tabs({ tabs, value, onChange, className }: { tabs: TabItem[]; value: string; onChange: (id: string) => void; className?: string }) {
  return (
    <div role="tablist" className={cx("flex gap-1 overflow-x-auto border-b border-[var(--border-color)] -mb-px", className)}>
      {tabs.filter(t => !t.hidden).map(t => {
        const on = t.id === value;
        return (
          <button key={t.id} role="tab" aria-selected={on} type="button" onClick={() => onChange(t.id)}
            className={cx("inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm border-b-2 transition", on ? "border-[var(--accent)] text-[var(--accent)] font-semibold" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]")}>
            {t.icon}
            {t.label}
            {typeof t.count === "number" && <span className="ml-0.5 rounded-full bg-[var(--bg-surface-hover)] px-1.5 text-[11px] tabular-nums text-[var(--text-muted)]">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Шапка страницы ───────────────────────────────────────────────────────
export function PageHeader({ title, actions, tabs, className }: { title: React.ReactNode; actions?: React.ReactNode; tabs?: React.ReactNode; className?: string }) {
  return (
    <header className={cx("mb-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] min-w-0 truncate">{title}</h1>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs}
    </header>
  );
}

// ── Подсказка «?» ────────────────────────────────────────────────────────
/** Для редких мест, где без пояснения нельзя: текст — только по нажатию. */
export function InfoHint({ children, className }: { children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("pointerdown", h);
    document.addEventListener("keydown", k, true);
    return () => { document.removeEventListener("pointerdown", h); document.removeEventListener("keydown", k, true); };
  }, [open]);
  return (
    <span ref={box} className={cx("relative inline-flex align-middle", className)}>
      <button type="button" aria-label="Подсказка" aria-expanded={open} onClick={() => setOpen(o => !o)}
        className="p-0.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-main)]">
        <HelpCircle className="w-4 h-4" />
      </button>
      {open && (
        <span role="tooltip" className="absolute z-40 top-full left-1/2 -translate-x-1/2 mt-1.5 w-64 max-w-[80vw] rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 text-xs leading-relaxed text-[var(--text-main)] shadow-lg">
          {children}
        </span>
      )}
    </span>
  );
}
