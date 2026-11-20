import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, AlertCircle } from "lucide-react";
import { PageHeader, Spinner, card } from "../../../components/ui";
import { apiCall, errText, useAdminCtx } from "./api";

interface Overview {
  tenant: { id: string; name: string };
  staff: { total: number; active: number; invited: number; suspended: number };
  checks: { key: string; label: string; ok: boolean; value?: string }[];
}

/** Куда вести по каждой незакрытой проверке. */
const FIX: Record<string, { to: string; label: string }> = {
  legal: { to: "/settings/workspace", label: "Заполнить" },
  workspace: { to: "/settings/workspace", label: "Настроить" },
  email: { to: "/settings/emails", label: "Настроить" },
  telegram: { to: "/admin/staff", label: "Сотрудники" },
  apiKey: { to: "/admin/integrations", label: "Выпустить" },
  owners: { to: "/admin/staff?tab=owner", label: "Добавить" },
};

export default function OverviewPage() {
  const { tenantId, base } = useAdminCtx();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tenantId) return;
    apiCall<Overview>(`/api/tenants/${tenantId}/overview`).then(setData).catch(e => setError(errText(e)));
  }, [tenantId]);

  if (error) return <div className="text-sm text-rose-600 dark:text-rose-400">{error}</div>;
  if (!data) return <Spinner />;
  const stats: [string, number][] = [["Всего", data.staff.total], ["Активны", data.staff.active], ["Приглашены", data.staff.invited], ["Отключены", data.staff.suspended]];
  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="Обзор" />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([l, n]) => (
          <Link key={l} to={`${base}/admin/staff`} className={`${card} p-4 hover:bg-[var(--bg-surface-hover)]`}>
            <div className="text-2xl font-bold tabular-nums text-[var(--text-main)]">{n}</div>
            <div className="text-xs text-[var(--text-muted)]">{l}</div>
          </Link>
        ))}
      </div>
      <div className={`${card} divide-y divide-[var(--border-color)]`}>
        {data.checks.map(c => (
          <div key={c.key} className="flex items-center gap-3 px-4 py-3">
            {c.ok ? <Check className="h-5 w-5 shrink-0 text-emerald-500" /> : <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />}
            <div className="min-w-0 flex-1 text-sm text-[var(--text-main)]">{c.label}{c.value && <span className="ml-2 text-[var(--text-muted)]">{c.value}</span>}</div>
            {!c.ok && FIX[c.key] && (
              <Link to={`${base}${FIX[c.key].to}`} className="shrink-0 rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--bg-surface-hover)]">{FIX[c.key].label}</Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
