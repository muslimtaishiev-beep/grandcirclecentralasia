import React, { useMemo, useState } from "react";
import { Navigate, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { PageHeader, Tabs, useUrlTab } from "../../../components/ui";
import { canAdmissions, canExamsAdmin, resolvePermissions, type PermissionKey } from "../../../shared/permissions";
import BankTab from "./BankTab";
import ExamsListTab from "./ExamsListTab";
import ArchiveHub from "./ArchiveHub";
import WorksTab from "./WorksTab";
import LiveTab from "./LiveTab";
import { gradeOf } from "../../../shared/questionnaires";
import type { ExamListItem } from "./examApi";
import { useExamApi } from "./examApi";
import NewApplicantModal from "../admissions/NewApplicantModal";
import { useAdmissionApi } from "../admissions/admissionApi";

/**
 * «Экзамены»: экзамены из конструктора, «Сейчас», банк вопросов, архив
 * прежнего теста. Поступающие — в своём разделе «Приём»; прежние адреса
 * (?tab=admissions, ?side=psych) переводятся туда.
 */
const TABS = [["list", "Экзамены"], ["live", "Сейчас"], ["works", "Работы"], ["bank", "Банк вопросов"], ["archive", "Архив"]] as const;
const TAB_IDS = TABS.map(t => t[0]);

export default function ExamsPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const tenantId = activeTenant?.id || "";
  const bankApi = useExamApi(tenantId, "exam-builder");
  const adminApi = useExamApi(tenantId, "exam-admin");
  const [params, setParams] = useSearchParams();
  const admApi = useAdmissionApi(tenantId);
  const [newApplicant, setNewApplicant] = useState<null | { grade?: number; examId?: string }>(null);
  const navigate = useNavigate();
  /** Заведён — на страницу экзамена его класса, к его карточке, и сразу QR анкеты для родителя. */
  const openNew = async (id: string, grade: string, examId?: string) => {
    let target = examId;
    if (!target) {
      const g = gradeOf(grade);
      const exams: ExamListItem[] = await adminApi("/exams").then(j => j.exams).catch(() => []);
      target = exams.filter(e => g !== null && (e.grades || []).includes(g)).sort((a, b) => (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1))[0]?.id;
    }
    if (target) navigate(`/workspace/${tenantId}/exams/${target}?open=${id}&ctab=profile&qr=parent`);
    else navigate(`/workspace/${tenantId}/admissions?open=${id}&ctab=profile&qr=parent`);
  };
  const granted = useMemo(() => (Array.isArray(activeTenant?.effectivePermissions)
    ? new Set<PermissionKey>(activeTenant.effectivePermissions)
    : resolvePermissions({ role: activeTenant?.role, permissions: activeTenant?.permissions, customPermissions: activeTenant?.customPermissions, rolePermissions: activeTenant?.customRole?.permissions, disabledModules: activeTenant?.disabledModules })), [activeTenant]);
  const admissionsOn = canAdmissions(granted) && (activeTenant?.visibleScreens ? activeTenant.visibleScreens.includes("admissions") : true);
  const tests = canExamsAdmin(granted), reception = admissionsOn && granted.has("admission:manage");
  const tabs = TABS.filter(() => tests);
  const admForLive = reception || granted.has("psych:view") ? admApi : null;
  const [tab, setTab] = useUrlTab<(typeof TABS)[number][0]>("tab", TAB_IDS, "list");
  // Прежние адреса поступающих и те, у кого нет прав на экзамены, — в «Приём».
  if (tenantId && (params.get("tab") === "admissions" || params.get("side") === "psych" || (!tests && admissionsOn))) {
    const q = new URLSearchParams(params); q.delete("tab");
    return <Navigate to={`/workspace/${tenantId}/admissions${q.toString() ? `?${q}` : ""}`} replace />;
  }
  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <PageHeader title="Экзамены" className="!mb-0" tabs={<Tabs value={tab} onChange={t => setTab(t as typeof tab)} tabs={tabs.map(([id, label]) => ({ id, label }))} />} />
      {(
        <>
          {tenantId && tab === "list" && <ExamsListTab api={adminApi} tenantId={tenantId} onNewApplicant={reception ? (grade, examId) => setNewApplicant({ grade, examId }) : undefined} />}
          {tenantId && tab === "live" && <LiveTab api={adminApi} admApi={admissionsOn ? admForLive : null} tenant={activeTenant} />}
          {tenantId && tab === "works" && <WorksTab api={adminApi} tenant={activeTenant} />}
          {tenantId && tab === "bank" && <BankTab api={bankApi} />}
          {tenantId && tab === "archive" && <ArchiveHub api={adminApi} bankApi={bankApi} tenantId={tenantId} />}
        </>
      )}
      {newApplicant && (
        <NewApplicantModal api={admApi} grade={newApplicant.grade ? String(newApplicant.grade) : undefined} onClose={() => setNewApplicant(null)}
          // Заведён — в «Поступающие», на его карточку, и сразу QR анкеты для родителя.
          onDone={(id, grade) => { const examId = newApplicant.examId; setNewApplicant(null); void openNew(id, grade, examId); }} />
      )}
    </div>
  );
}
