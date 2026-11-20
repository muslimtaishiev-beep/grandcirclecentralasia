import { useCallback } from "react";
import { auth } from "../../../lib/firebase";

/** Запросы к /api/digitize/:tenantId… с токеном сотрудника. */
export function useDigitizeApi(tenantId: string) {
  return useCallback(async (path: string, init: RequestInit = {}) => {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
    const res = await fetch(`/api/digitize/${tenantId}${path}`, {
      ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.success === false) throw new Error(j.error || `Ошибка ${res.status}`);
    return j;
  }, [tenantId]);
}

export type DigitizeApi = ReturnType<typeof useDigitizeApi>;
