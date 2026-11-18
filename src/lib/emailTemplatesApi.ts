import { auth } from "./firebase";

/** /api/email-templates/<организация><путь>; ошибка несёт status и тело ответа. */
export async function emailApi(t: string, path = "", init: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(`/api/email-templates/${t}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw Object.assign(new Error(j.error || `Ошибка ${r.status}`), { status: r.status, data: j });
  return j;
}
