import { useCallback } from "react";
import { auth } from "../../../lib/firebase";
import { compressImageToDataUrl } from "../../../lib/compressImage";
import type { JournalRole } from "../../../shared/journals";

/** Запросы к /api/journals/:tenantId… с токеном сотрудника. */
export function useJournalApi(tenantId: string) {
  return useCallback(async (path: string, init: RequestInit = {}) => {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
    const res = await fetch(`/api/journals/${tenantId}${path}`, {
      ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.success === false) throw new Error(j.error || `Ошибка ${res.status}`);
    return j;
  }, [tenantId]);
}

export interface JournalListItem {
  id: string; title: string; description: string; templateKey?: string;
  columnCount: number; updatedAt: number; role: JournalRole;
}

export interface Employee { uid: string; name: string; email: string }

/** Фото с телефона → JPEG, который влезает в запись. */
export async function photoToValue(file: File): Promise<{ value: string } | { error: string }> {
  const r = await compressImageToDataUrl(file, { maxSide: 1024, maxBytes: 240 * 1024 });
  if ("error" in r) return { error: r.error };
  return { value: r.dataUrl };
}
