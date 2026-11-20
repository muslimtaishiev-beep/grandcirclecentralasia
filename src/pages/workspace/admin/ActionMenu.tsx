import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

export interface MenuAction { label: string; onClick: () => void; danger?: boolean; hidden?: boolean; disabled?: boolean }

/** Меню «…»: открывается поверх таблицы (fixed), закрывается кликом снаружи и Esc. */
export default function ActionMenu({ actions, label = "Действия" }: { actions: MenuAction[]; label?: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const list = actions.filter(a => !a.hidden);

  useEffect(() => {
    if (!pos) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !btn.current?.contains(t)) setPos(null);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setPos(null); };
    const close = () => setPos(null);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  if (!list.length) return null;
  const open = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const h = list.length * 36 + 8;
    setPos({ x: Math.max(8, Math.min(r.right - 208, window.innerWidth - 216)), y: r.bottom + h > window.innerHeight ? Math.max(8, r.top - h) : r.bottom + 4 });
  };
  return (
    <>
      <button ref={btn} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={!!pos}
        onClick={e => { e.stopPropagation(); pos ? setPos(null) : open(); }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)] cursor-pointer">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {pos && (
        <div ref={box} role="menu" style={{ left: pos.x, top: pos.y }}
          className="fixed z-50 w-52 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-1 shadow-xl">
          {list.map(a => (
            <button key={a.label} role="menuitem" type="button" disabled={a.disabled}
              onClick={e => { e.stopPropagation(); setPos(null); a.onClick(); }}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm cursor-pointer disabled:opacity-50 hover:bg-[var(--bg-surface-hover)] ${a.danger ? "text-rose-600 dark:text-rose-400" : "text-[var(--text-main)]"}`}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
