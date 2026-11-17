import React, { useMemo } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { canAdmissions, canExamsAdmin, resolvePermissions, type PermissionKey } from "../../../shared/permissions";
import BankTab from "./BankTab";
import ExamsListTab from "./ExamsListTab";
import ArchiveTab from "./ArchiveTab";
import { useExamApi } from "./examApi";
import AdmissionsPage from "../admissions/AdmissionsPage";

/**
 * «Экзамены»: две стороны. «Админ» — экзамены из конструктора, банк вопросов
 * и архив прежнего теста. «Психолог» — поступающие: карточки, анкеты,
 * диагностика и направления на тест. Кто что видит — по правам: психолог
 * без тестовых прав сразу попадает на свою сторону.
 */
const TABS = [["list", "Экзамены"], ["bank", "Банк вопросов"], ["archive", "Архив прежнего теста"]] as const;

export default function ExamsPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const tenantId = activeTenant?.id || "";
  const bankApi = useExamApi(tenantId, "exam-builder");
  const adminApi = useExamApi(tenantId, "exam-admin");
  const [params, setParams] = useSearchParams();
  const granted = useMemo(() => (Array.isArray(activeTenant?.effectivePermissions)
    ? new Set<PermissionKey>(activeTenant.effectivePermissions)
    : resolvePermissions({ role: activeTenant?.role, permissions: activeTenant?.permissions, customPermissions: activeTenant?.customPermissions, rolePermissions: activeTenant?.customRole?.permissions, disabledModules: activeTenant?.disabledModules })), [activeTenant]);
  const admin = canExamsAdmin(granted), psych = canAdmissions(granted) && (activeTenant?.visibleScreens ? activeTenant.visibleScreens.includes("admissions") : true);
  const side = psych && (params.get("side") === "psych" || !admin) ? "psych" : "admin";
  const tab = (TABS.find(t => t[0] === params.get("tab"))?.[0] || "list") as (typeof TABS)[number][0];
  const sideBtn = (k: "admin" | "psych", l: string) => (
    <button onClick={() => setParams(k === "psych" ? { side: "psych" } : {}, { replace: true })}
      className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${side === k ? "bg-[var(--bg-surface)] text-[var(--accent)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"}`}>{l}</button>
  );
  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-xl md:text-2xl font-bold text-[var(--text-main)]">Экзамены</h1>
        {admin && psych && <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-surface-hover)]">{sideBtn("admin", "Админ")}{sideBtn("psych", "Психолог")}</div>}
      </div>
      {side === "psych" ? <AdmissionsPage embedded /> : (
        <>
          <div className="flex gap-1 border-b border-[var(--border-color)] overflow-x-auto hide-scrollbar">
            {TABS.map(([k, l]) => (
              <button key={k} onClick={() => setParams(k === "list" ? {} : { tab: k }, { replace: true })}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === k ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]"}`}>{l}</button>
            ))}
          </div>
          {tenantId && tab === "list" && <ExamsListTab api={adminApi} tenantId={tenantId} />}
          {tenantId && tab === "bank" && <BankTab api={bankApi} />}
          {tenantId && tab === "archive" && <ArchiveTab api={adminApi} />}
        </>
      )}
    </div>
  );
}
