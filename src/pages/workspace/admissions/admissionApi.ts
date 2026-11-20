import { useCallback } from "react";
import { auth } from "../../../lib/firebase";
import type { Stage, StageSummary } from "../../../shared/admissions";

export type Api = (path: string, init?: RequestInit) => Promise<any>;

/** Запросы к /api/admissions/<организация>. */
export function useAdmissionApi(tenantId: string): Api {
  return useCallback(async (path: string, init: RequestInit = {}) => {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
    const r = await fetch(`/api/admissions/${tenantId}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === false) throw Object.assign(new Error(j.error || `Ошибка ${r.status}`), { missing: j.missing, duplicate: j.duplicate });
    return j;
  }, [tenantId]);
}

export interface Row {
  id: string; refNo: number;
  child: { name: string; birthDate: string; grade: string };
  parent: { name: string; phone: string };
  parentForm: { status: "none" | "done"; at: number | null; by: string | null };
  stages: Record<string, StageSummary>;
  referral: { examTitle: string; manual: boolean; issuedAt: number } | null;
  attempt: { id: string; examId: string; examTitle: string; status: string; shortId: string; parts: { title: string; value: string }[]; percent: number | null; decision: string | null } | null;
  paperResults: number;
  decision: string | null;
  stage: Stage;
  createdAt: number; updatedAt: number;
  archived?: { at: number; byName: string } | null;
  referralBlocked?: boolean;
}
/**
 * admission — администрация приёма; conduct — проводит анкеты (по праву или по праву анкеты);
 * viewAll — видит закрытые анкеты; academic — видит тест, бумажные результаты и решение;
 * owner — полный доступ (окончательное удаление).
 */
export interface Me { admission: boolean; conduct: boolean; viewAll: boolean; academic: boolean; name?: string; owner?: boolean }

export const TONE: Record<string, string> = { good: "text-emerald-700 bg-emerald-500/10", warn: "text-amber-700 bg-amber-500/10", bad: "text-rose-700 bg-rose-500/10" };
