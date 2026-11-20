import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "../../../components/ui";
import type { Block } from "./useDashboard";

export const fmt = (n: number) => n.toLocaleString("ru-RU");

const card = "bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-sm";

/** Карточка с числом-ссылкой. Блок упал — состояние ошибки, а не ноль. */
export function Stat<T>({ title, icon, to, block, pick, sub, onRetry }: {
  title: string; icon: React.ReactNode; to: string; block: Block<T>;
  pick: (b: { ok: true } & T) => React.ReactNode; sub?: (b: { ok: true } & T) => React.ReactNode; onRetry: () => void;
}) {
  return (
    <div className={`${card} p-5 hover:border-[var(--accent)] transition`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[var(--text-muted)] text-xs uppercase font-semibold">{title}</span>
        <span className="p-2 rounded-lg bg-[var(--bg-surface-hover)] text-[var(--accent)]">{icon}</span>
      </div>
      {block.ok ? (
        <Link to={to} className="block group">
          <div className="text-3xl font-extrabold text-[var(--text-main)] tabular-nums">{pick(block)}</div>
          <div className="text-xs text-[var(--text-muted)] mt-2 flex items-center gap-1">{sub ? sub(block) : null}<ArrowRight className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition" /></div>
        </Link>
      ) : (
        <div className="flex items-center gap-2 text-sm text-rose-600">
          <AlertTriangle className="w-4 h-4" /> Не загрузилось
          <Button size="sm" variant="secondary" className="ml-auto" onClick={onRetry}>Повторить</Button>
        </div>
      )}
    </div>
  );
}

export function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={`${card} p-5`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-base font-bold text-[var(--text-main)]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
