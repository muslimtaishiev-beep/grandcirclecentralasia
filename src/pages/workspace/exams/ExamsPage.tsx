import React from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import BankTab from "./BankTab";
import ExamsListTab from "./ExamsListTab";
import ArchiveTab from "./ArchiveTab";
import { useExamApi } from "./examApi";

/**
 * «Экзамены» — единый раздел вместо «Тестов», «Проверки и прокторинга» и
 * «Вступительного среза»: экзамены из конструктора, банк вопросов
 * организации и архив прежнего вступительного теста.
 */
const TABS = [["list", "Экзамены"], ["bank", "Банк вопросов"], ["archive", "Архив прежнего теста"]] as const;

export default function ExamsPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const tenantId = activeTenant?.id || "";
  const bankApi = useExamApi(tenantId, "exam-builder");
  const adminApi = useExamApi(tenantId, "exam-admin");
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find(t => t[0] === params.get("tab"))?.[0] || "list") as (typeof TABS)[number][0];
  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[var(--text-main)]">Экзамены</h1>
        <p className="text-sm text-[var(--text-muted)]">Конструктор экзаменов, банк вопросов, проверка, прокторинг и аналитика</p>
      </div>
      <div className="flex gap-1 border-b border-[var(--border-color)] overflow-x-auto hide-scrollbar">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setParams(k === "list" ? {} : { tab: k }, { replace: true })}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === k ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]"}`}>{l}</button>
        ))}
      </div>
      {tenantId && tab === "list" && <ExamsListTab api={adminApi} tenantId={tenantId} />}
      {tenantId && tab === "bank" && <BankTab api={bankApi} />}
      {tenantId && tab === "archive" && <ArchiveTab api={adminApi} />}
    </div>
  );
}
