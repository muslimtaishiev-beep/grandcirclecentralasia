import { useCallback } from "react";
import { auth } from "../../../lib/firebase";
import type { Discipline } from "../../../shared/exams";

/** Запросы к /api/exam-builder/:tenantId… с токеном сотрудника. */
export function useExamApi(tenantId: string) {
  return useCallback(async (path: string, init: RequestInit = {}) => {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
    const res = await fetch(`/api/exam-builder/${tenantId}${path}`, {
      ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.success === false) throw new Error(j.error || `Ошибка ${res.status}`);
    return j;
  }, [tenantId]);
}

export type DisciplineRow = Discipline & { total: number; active: number; levels: string[] };
