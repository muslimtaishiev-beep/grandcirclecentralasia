import React, { useMemo } from "react";
import { Navigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { resolvePermissions, type PermissionKey } from "../../../shared/permissions";
import AdmissionsPage from "./AdmissionsPage";
import { PageHeader } from "../../../components/ui";

/**
 * Раздел «Приём»: приёмная (поступающие, анкеты) и «Мои анкеты» — сторона
 * тех, кто проводит анкеты. Сторона — в адресе (?side=staff), чтобы ссылки из
 * уведомлений вели сразу туда. Сотрудника, у которого есть только право из
 * анкеты организации, пускает сервер: у него одна сторона — «Мои анкеты».
 * Прежнее значение ?side=psych читается как «Мои анкеты».
 */
export default function AdmissionsScreen() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const { orgId } = useParams();
  const [params, setParams] = useSearchParams();
  const granted = useMemo(() => (Array.isArray(activeTenant?.effectivePermissions)
    ? new Set<PermissionKey>(activeTenant.effectivePermissions)
    : resolvePermissions({ role: activeTenant?.role, permissions: activeTenant?.permissions, customPermissions: activeTenant?.customPermissions, rolePermissions: activeTenant?.customRole?.permissions, disabledModules: activeTenant?.disabledModules })), [activeTenant]);

  // Прежний адрес /admissions?tab=… — вкладка карточки.
  if (params.has("tab")) {
    const q = new URLSearchParams(params);
    if (!q.has("ctab")) q.set("ctab", q.get("tab")!);
    q.delete("tab");
    return <Navigate to={`/workspace/${orgId}/admissions?${q.toString()}`} replace />;
  }

  const reception = granted.has("admission:manage");
  const specialist = granted.has("psych:conduct") || granted.has("psych:view");
  const wantsStaff = params.get("side") === "staff" || params.get("side") === "psych";
  const side: "admin" | "staff" = !reception || (specialist && wantsStaff) ? "staff" : "admin";
  const sideBtn = (k: "admin" | "staff", l: string) => (
    <button onClick={() => { const p = new URLSearchParams(params); p.delete("open"); p.delete("ctab"); p.delete("view"); if (k === "staff") p.set("side", "staff"); else p.delete("side"); setParams(p, { replace: true }); }} aria-pressed={side === k}
      className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${side === k ? "bg-[var(--bg-surface)] text-[var(--accent)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"}`}>{l}</button>
  );
  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <PageHeader className="!mb-0" title="Приём"
        actions={reception && specialist ? <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-surface-hover)]">{sideBtn("admin", "Приёмная")}{sideBtn("staff", "Мои анкеты")}</div> : undefined} />
      <AdmissionsPage key={side} embedded mode={side} />
    </div>
  );
}
