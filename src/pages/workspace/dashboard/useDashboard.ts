import { useCallback, useEffect, useState } from "react";
import { auth } from "../../../lib/firebase";

export interface BlockFail { ok: false }
export type Block<T> = ({ ok: true } & T) | BlockFail;

export interface DashboardData {
  members?: Block<{ count: number }>;
  tasks?: Block<{ open: number; mineCount: number; overdue: number; mine: { id: string; title: string; status: string; priority: string; dueDate: string | null }[] }>;
  deals?: Block<{ open: number; amount: number }>;
  exams?: Block<{ openExams?: number; totalExams?: number; inProgress?: number; unreviewed?: number }>;
  admissions?: Block<{ total: number; undecided: number }>;
  emails?: Block<{ failed: number }>;
  forms?: Block<{ unanswered: number }>;
  finance?: Block<{ accepted: number; fees: number; monthly: number; contracts: number; cash: number; payroll: number; net: number }>;
}

export type DashboardState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; blocks: DashboardData };

/** Сводка главной с сервера. Ошибка — состояние, а не нули. */
export function useDashboard(orgId: string | undefined): [DashboardState, () => void] {
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce(n => n + 1), []);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setState(s => (s.status === "ready" ? s : { status: "loading" }));
    (async () => {
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
        const res = await fetch(`/api/dashboard/${encodeURIComponent(orgId)}`, { headers: { Authorization: `Bearer ${token}` } });
        const j = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !j?.success) setState({ status: "error", message: String(j?.error || "Не удалось загрузить сводку") });
        else setState({ status: "ready", blocks: (j.blocks || {}) as DashboardData });
      } catch {
        if (!cancelled) setState({ status: "error", message: "Нет связи с сервером" });
      }
    })();
    return () => { cancelled = true; };
  }, [orgId, nonce]);

  return [state, reload];
}
