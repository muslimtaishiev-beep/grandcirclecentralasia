import { apiCall, del, post, put } from "../../../lib/eduApi";
import type { Audience, FolderAccess, FolderRights } from "../../../shared/schoolDocs";
import type { DocsStaff } from "./AudiencePicker";

/** /api/school-docs/<организация> */
export const docsApi = (t: string) => ({
  tree: () => apiCall<{ folders: FolderRow[]; me: { uid: string; name: string; manageAll: boolean }; staff?: DocsStaff[]; positions?: { id: string; name: string }[]; usage?: { used: number; quota: number } }>(`/api/school-docs/${t}`),
  folder: (id: string) => apiCall<{ folder: FolderRow; path: { id: string; name: string }[]; folders: FolderRow[]; files: FileRow[] }>(`/api/school-docs/${t}/folders/${id}`),
  createFolder: (name: string, parentId: string | null) => post<{ id: string }>(`/api/school-docs/${t}/folders`, { name, parentId }),
  updateFolder: (id: string, patch: { name?: string; parentId?: string | null; access?: FolderAccess }) => put(`/api/school-docs/${t}/folders/${id}`, patch),
  deleteFolder: (id: string) => del(`/api/school-docs/${t}/folders/${id}`),
  trash: () => apiCall<{ folders: { id: string; name: string; deletedAt: number; path: string }[]; files: (FileRow & { deletedAt: number; folderName: string })[]; days: number }>(`/api/school-docs/${t}/trash`),
  restore: (kind: "file" | "folder", id: string) => post(`/api/school-docs/${t}/restore`, { kind, id }),
  fileUrl: (id: string, download = false) => apiCall<{ url: string }>(`/api/school-docs/${t}/files/${id}/url${download ? "?download=1" : ""}`),
  updateFile: (id: string, patch: { name?: string; folderId?: string }) => put(`/api/school-docs/${t}/files/${id}`, patch),
  deleteFile: (id: string) => del(`/api/school-docs/${t}/files/${id}`),
  uploadUrl: (body: { folderId?: string; requestId?: string; itemId?: string; name: string; size: number }) => post<{ id: string; uploadUrl: string; contentType: string }>(body.requestId ? `/api/school-docs/${t}/requests/${body.requestId}/upload-url` : `/api/school-docs/${t}/upload-url`, body),
  finalize: (id: string) => post<{ file: FileRow }>(`/api/school-docs/${t}/files/${id}/finalize`),
});
export type DocsApi = ReturnType<typeof docsApi>;

export interface FolderRow { id: string; name: string; parentId: string | null; rights: FolderRights; access?: FolderAccess; updatedAt: number }
export interface FileRow { id: string; folderId: string; name: string; size: number; type: string; uploadedBy: { uid: string; name: string }; at: number; requestId: string | null; itemId: string | null }
export type { Audience };

/** Загрузка в хранилище напрямую по подписанной ссылке, с прогрессом. */
export function putFile(url: string, file: Blob, type: string, onProgress?: (loaded: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    x.setRequestHeader("Content-Type", type);
    x.upload.onprogress = e => onProgress?.(e.loaded);
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error(`Хранилище ответило ${x.status}`)));
    x.onerror = () => reject(new Error("Нет связи с хранилищем — проверьте интернет"));
    x.send(file);
  });
}

/** Файл целиком: ссылка → загрузка → подтверждение. Ошибку — понятным текстом. */
export async function uploadOne(api: DocsApi, file: File, target: { folderId?: string; requestId?: string; itemId?: string }, onProgress?: (loaded: number) => void): Promise<FileRow> {
  const u = await api.uploadUrl({ ...target, name: file.name, size: file.size });
  await putFile(u.uploadUrl, file, u.contentType, onProgress);
  return (await api.finalize(u.id)).file;
}
