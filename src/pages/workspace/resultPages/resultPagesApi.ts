import { auth } from "../../../lib/firebase";
import { MEDIA_UPLOAD, type MediaRef } from "../../../shared/resultPages";

/** /api/result-pages/<организация><путь>; ошибка несёт status и тело ответа. */
export async function rpApi(t: string, path = "", init: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(`/api/result-pages/${t}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw Object.assign(new Error(j.error || `Ошибка ${r.status}`), { status: r.status, data: j });
  return j;
}

export interface PageRow { id: string; name: string; updatedAt: number; outcomes: string[] }
export interface OutcomeRow { id: string; label: string; final: boolean; trial: boolean }

/** Загрузка файла в хранилище по подписанной ссылке (без прохода через сервер) с ходом в процентах. */
export async function uploadMedia(t: string, file: File, onProgress: (pct: number) => void): Promise<MediaRef> {
  if (!(MEDIA_UPLOAD.types as readonly string[]).includes(file.type)) throw new Error("Нужен файл MP4, WebM, JPEG или PNG");
  if (file.size > MEDIA_UPLOAD.maxBytes) throw new Error("Файл больше 100 МБ");
  const j = await rpApi(t, "/upload-url", { method: "POST", body: JSON.stringify({ contentType: file.type, size: file.size }) });
  await new Promise<void>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", j.uploadUrl);
    Object.entries((j.headers || {}) as Record<string, string>).forEach(([k, v]) => x.setRequestHeader(k, v));
    x.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error(`Не удалось загрузить файл (${x.status})`)));
    x.onerror = () => reject(new Error("Не удалось загрузить файл"));
    x.send(file);
  });
  return { source: "upload", path: j.path, url: j.readUrl || "", name: file.name.slice(0, 120) };
}
