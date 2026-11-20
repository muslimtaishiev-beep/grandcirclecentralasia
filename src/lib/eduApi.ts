import { auth } from "./firebase";

/** Запрос к API кабинета с токеном входа; ошибка — текст сервера. */
export async function apiCall<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.success === false) throw new Error(j.error || `Ошибка ${res.status}`);
  return j as T;
}
export const post = <T = any>(path: string, body?: unknown) => apiCall<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });
export const put = <T = any>(path: string, body?: unknown) => apiCall<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) });
export const del = <T = any>(path: string) => apiCall<T>(path, { method: "DELETE" });
