import { useCallback } from "react";
import { auth } from "../../../lib/firebase";
import type { Discipline, QuestionSet } from "../../../shared/exams";

/** Запросы к /api/exam-builder (банк) или /api/exam-admin (экзамены и работы). */
export function useExamApi(tenantId: string, base: "exam-builder" | "exam-admin" = "exam-builder") {
  return useCallback(async (path: string, init: RequestInit = {}) => {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
    const res = await fetch(`/api/${base}/${tenantId}${path}`, {
      ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.success === false) throw new Error(j.error || `Ошибка ${res.status}`);
    return j;
  }, [tenantId, base]);
}

export type DisciplineRow = Discipline & { total: number; active: number; levels: string[] };
export type SetRow = QuestionSet & { count: number };

export type Api = (path: string, init?: RequestInit) => Promise<any>;

export interface ExamListItem {
  id: string; title: string; group: string; status: "draft" | "open" | "closed"; code: string; sections: number;
  updatedAt: number; opensAt: number | null; closesAt: number | null; total: number; live: number; done: number;
}

export const examLink = (code: string) => `${window.location.origin}/exam/${code}`;
