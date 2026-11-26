import { Router } from "express";
import admin from "firebase-admin";
import { randomBytes } from "crypto";
import { requireFirebaseAuth } from "./authRoutes.js";
import { hasPerm, staffCaller } from "../server/access.js";
import { actorOf, writeAudit } from "../server/audit.js";
import { requireScreen } from "../server/tenantAccess.js";
import { bucket, ensureBucketCors } from "../server/storage.js";
import {
  CHILD_ACCESS, FILE_TYPES, ROOT_ACCESS, TENANT_QUOTA, cleanFileName, extOf, fileProblem, folderPath, folderRights, fmtSize,
  sanitizeAccess, staffLite, type DocFile, type DocFolder, type FolderRights, type StaffLite,
} from "../shared/schoolDocs.js";

/**
 * /api/school-docs/:t — «Документы школы»: папки, файлы, доступ.
 *
 * Документы пишет только сервер (правила Firestore закрыты). Файлы — в
 * Storage school_docs/{t}/{fileId}: браузер кладёт их по подписанной ссылке
 * на запись, читает по подписанной ссылке на чтение. Кто что видит, решает
 * доступ папки (src/shared/schoolDocs.ts): управляющие видят всё, остальные —
 * папки по доступу, а файлы — все или только свои (ownOnly).
 */
const router = Router();
const db = () => admin.firestore();
const col = (t: string, n: string) => db().collection("tenants").doc(t).collection(n);
const TENANT = /^[A-Za-z0-9_-]{2,80}$/;
const ID = /^[A-Za-z0-9_-]{4,64}$/;
const clip = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const fail = (res: any, status: number, error: string, extra: object = {}) => res.status(status).json({ success: false, error, ...extra });
const oops = (res: any, e: any) => { console.error("[school-docs]", e?.message || e); return fail(res, 500, "Не получилось — попробуйте ещё раз"); };
const newId = (p: string) => `${p}_${randomBytes(9).toString("base64url")}`;
const filePath = (t: string, id: string) => `school_docs/${t}/${id}`;
/** Пока страница открыта — ссылка на чтение живёт час. */
const READ_TTL = 3600_000;
const TRASH_DAYS = 30;

export interface DocsCaller { uid: string; name: string; manageAll: boolean; me: StaffLite }

/** Сотрудники организации (для адресатов и прав): активные членства + названия должностей. */
export async function loadStaff(t: string): Promise<StaffLite[]> {
  const ms = (await db().collection("memberships").where("tenantId", "==", t).get()).docs.map(d => d.data() as any).filter(m => m.userId && m.status === "active");
  const roleIds = [...new Set(ms.map(m => m.customRoleId).filter(Boolean).map(String))];
  const roles = new Map<string, string>();
  for (const id of roleIds) { const r = await db().collection("custom_roles").doc(id).get(); if (r.exists && r.data()?.tenantId === t) roles.set(id, String(r.data()?.name || "")); }
  const byUid = new Map<string, StaffLite>();
  for (const m of ms) { const s = staffLite(m, m.customRoleId ? roles.get(String(m.customRoleId)) || "" : ""); if (!byUid.has(s.uid) || s.full) byUid.set(s.uid, s); }
  return [...byUid.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

async function callerOf(req: any, res: any): Promise<{ t: string; c: DocsCaller; staff: StaffLite[] } | null> {
  const t = String(req.params.t || "");
  if (!TENANT.test(t)) { fail(res, 400, "Неверная организация"); return null; }
  const sc = await staffCaller(db(), t, req.user);
  if (!sc?.member) { fail(res, 403, "Документы доступны только сотрудникам организации"); return null; }
  const staff = await loadStaff(t);
  const me = staff.find(s => s.uid === sc.uid) || { uid: sc.uid, name: sc.name, positionId: null, positionName: "", placement: { grades: [], classes: [], levels: [], subjects: [], groups: [] }, full: sc.full };
  return { t, staff, c: { uid: sc.uid, name: sc.name, manageAll: hasPerm(sc, "files:manage"), me: { ...me, full: me.full || sc.full } } };
}

export async function loadFolders(t: string): Promise<Map<string, DocFolder>> {
  const s = await col(t, "doc_folders").get();
  return new Map(s.docs.map(d => [d.id, { ...(d.data() as DocFolder), id: d.id }]));
}
/** Папка в корзине — сама или любая выше. */
const inTrash = (f: DocFolder, byId: Map<string, DocFolder>) => folderPath(f, byId).some(x => x.deletedAt);
export const rightsIn = (f: DocFolder, byId: Map<string, DocFolder>, c: DocsCaller): FolderRights => folderRights(f, byId, c.me, c.manageAll);

/** Файл виден: папка видна целиком — да; иначе только свой. */
const fileVisible = (file: DocFile, r: FolderRights, c: DocsCaller) => r.seeAll || (r.see && file.uploadedBy.uid === c.uid) || (r.upload && file.uploadedBy.uid === c.uid);

const folderView = (f: DocFolder, r: FolderRights) => ({ id: f.id, name: f.name, parentId: f.parentId, rights: r, ...(r.manage ? { access: f.access } : {}), updatedAt: f.updatedAt });
const fileView = (f: DocFile) => ({ id: f.id, folderId: f.folderId, name: f.name, size: f.size, type: f.type, uploadedBy: f.uploadedBy, at: f.at, requestId: f.requestId || null, itemId: f.itemId || null });

/** Сколько места занято файлами организации. */
async function usedBytes(t: string): Promise<number> {
  const s = await col(t, "doc_files").get();
  return s.docs.reduce((n, d) => n + (d.data().status === "ready" ? Number(d.data().size) || 0 : 0), 0);
}
const quotaOf = async (t: string) => Number((await db().collection("tenants").doc(t).get()).data()?.docsQuota) || TENANT_QUOTA;

const audit = (req: any, t: string, action: string, target: { kind: string; id: string; name: string }, detail = "") =>
  writeAudit(db(), t, { actor: actorOf(req.user), action, section: "data", target, ...(detail ? { detail } : {}) }).catch(() => {});

const guard = [requireFirebaseAuth, requireScreen("schoolDocs", (req: any) => req.params.t)];

// ── Папки ───────────────────────────────────────────────────────────────

/** Дерево папок, видимых вызывающему; люди и должности — для выбора доступа и адресатов. */
router.get("/:t", ...guard, async (req: any, res: any) => {
  try {
    const x = await callerOf(req, res); if (!x) return;
    const byId = await loadFolders(x.t);
    const folders = [...byId.values()].filter(f => !inTrash(f, byId)).map(f => ({ f, r: rightsIn(f, byId, x.c) })).filter(o => o.r.see);
    // Видимая папка внутри невидимой — показывается от ближайшей видимой (путь не раскрывается).
    const visible = new Set(folders.map(o => o.f.id));
    const out = folders.map(({ f, r }) => {
      let parent = f.parentId;
      while (parent && !visible.has(parent)) parent = byId.get(parent)?.parentId ?? null;
      return { ...folderView(f, r), parentId: parent };
    }).sort((a, b) => a.name.localeCompare(b.name, "ru"));
    const anyManage = x.c.manageAll || folders.some(o => o.r.manage);
    const positions = anyManage ? (await db().collection("custom_roles").where("tenantId", "==", x.t).get()).docs.map(d => ({ id: d.id, name: String(d.data().name || "") })).sort((a, b) => a.name.localeCompare(b.name, "ru")) : [];
    return res.json({
      success: true, folders: out,
      me: { uid: x.c.uid, name: x.c.name, manageAll: x.c.manageAll },
      // Сотрудники и должности — тем, кто настраивает доступ и собирает документы.
      ...(anyManage ? { staff: x.staff.map(s => ({ uid: s.uid, name: s.name, positionId: s.positionId, positionName: s.positionName, placement: s.placement })), positions } : {}),
      ...(x.c.manageAll ? { usage: { used: await usedBytes(x.t), quota: await quotaOf(x.t) } } : {}),
    });
  } catch (e) { return oops(res, e); }
});

/** Содержимое папки: подпапки и файлы, которые видит вызывающий. */
router.get("/:t/folders/:id", ...guard, async (req: any, res: any) => {
  try {
    const x = await callerOf(req, res); if (!x) return;
    const byId = await loadFolders(x.t);
    const f = byId.get(String(req.params.id));
    if (!f || inTrash(f, byId)) return fail(res, 404, "Папка не найдена");
    const r = rightsIn(f, byId, x.c);
    if (!r.see) return fail(res, 403, "Нет доступа к папке");
    const files = (await col(x.t, "doc_files").where("folderId", "==", f.id).get()).docs.map(d => ({ ...(d.data() as DocFile), id: d.id }))
      .filter(file => file.status === "ready" && !file.deletedAt && fileVisible(file, r, x.c)).sort((a, b) => b.at - a.at);
    const children = [...byId.values()].filter(c => c.parentId === f.id && !c.deletedAt).map(c => ({ c, cr: rightsIn(c, byId, x.c) })).filter(o => o.cr.see).map(o => folderView(o.c, o.cr)).sort((a, b) => a.name.localeCompare(b.name, "ru"));
    return res.json({ success: true, folder: folderView(f, r), path: folderPath(f, byId).map(p => ({ id: p.id, name: p.name })), folders: children, files: files.map(fileView) });
  } catch (e) { return oops(res, e); }
});

router.post("/:t/folders", ...guard, async (req: any, res: any) => {
  try {
    const x = await callerOf(req, res); if (!x) return;
    const name = clip(req.body?.name, 80);
    if (!name) return fail(res, 400, "Назовите папку");
    const parentId = req.body?.parentId ? String(req.body.parentId) : null;
    const byId = await loadFolders(x.t);
    if (parentId) {
      const p = byId.get(parentId);
      if (!p || inTrash(p, byId)) return fail(res, 404, "Папка не найдена");
      if (!rightsIn(p, byId, x.c).manage) return fail(res, 403, "Создавать папки здесь может тот, кто ею управляет");
    } else if (!x.c.manageAll && !x.c.me.full) return fail(res, 403, "Папки верхнего уровня создаёт тот, у кого есть право «Управление документами школы»");
    const id = newId("df"); const now = Date.now();
    const folder: DocFolder = { id, name, parentId, access: parentId ? CHILD_ACCESS : ROOT_ACCESS, createdBy: { uid: x.c.uid, name: x.c.name }, createdAt: now, updatedAt: now };
    await col(x.t, "doc_folders").doc(id).set(JSON.parse(JSON.stringify(folder)));
    await audit(req, x.t, "docs.folder", { kind: "folder", id, name }, "Создана папка");
    return res.json({ success: true, id });
  } catch (e) { return oops(res, e); }
});

/** Переименовать, перенести, настроить доступ. */
router.put("/:t/folders/:id", ...guard, async (req: any, res: any) => {
  try {
    const x = await callerOf(req, res); if (!x) return;
    const byId = await loadFolders(x.t);
    const f = byId.get(String(req.params.id));
    if (!f || inTrash(f, byId)) return fail(res, 404, "Папка не найдена");
    if (!rightsIn(f, byId, x.c).manage) return fail(res, 403, "Папкой управляет завуч или назначенный ответственный");
    const patch: Partial<DocFolder> = { updatedAt: Date.now() };
    if (req.body?.name !== undefined) { const n = clip(req.body.name, 80); if (!n) return fail(res, 400, "Назовите папку"); patch.name = n; }
    if (req.body?.parentId !== undefined) {
      const to = req.body.parentId ? String(req.body.parentId) : null;
      if (to) {
        const p = byId.get(to);
        if (!p || inTrash(p, byId)) return fail(res, 404, "Папка назначения не найдена");
        if (folderPath(p, byId).some(a => a.id === f.id)) return fail(res, 400, "Нельзя перенести папку в саму себя");
        if (!rightsIn(p, byId, x.c).manage) return fail(res, 403, "Нет прав на папку назначения");
      } else if (!x.c.manageAll && !x.c.me.full) return fail(res, 403, "В корень переносит тот, у кого есть право «Управление документами школы»");
      patch.parentId = to;
    }
    if (req.body?.access !== undefined) patch.access = sanitizeAccess(req.body.access, (patch.parentId !== undefined ? patch.parentId : f.parentId) === null);
    else if (patch.parentId === null && f.access.inherit) patch.access = { ...f.access, inherit: false };
    await col(x.t, "doc_folders").doc(f.id).update(JSON.parse(JSON.stringify(patch)));
    await audit(req, x.t, "docs.folder", { kind: "folder", id: f.id, name: patch.name || f.name }, [patch.name && patch.name !== f.name ? `переименована из «${f.name}»` : "", patch.parentId !== undefined ? "перенесена" : "", patch.access ? "изменён доступ" : ""].filter(Boolean).join(", ") || "изменена");
    return res.json({ success: true });
  } catch (e) { return oops(res, e); }
});

/** В корзину (вместе со всем внутри); вернуть можно 30 дней. */
router.delete("/:t/folders/:id", ...guard, async (req: any, res: any) => {
  try {
    const x = await callerOf(req, res); if (!x) return;
    const byId = await loadFolders(x.t);
    const f = byId.get(String(req.params.id));
    if (!f || f.deletedAt) return fail(res, 404, "Папка не найдена");
    if (!rightsIn(f, byId, x.c).manage) return fail(res, 403, "Удалить папку может тот, кто ею управляет");
    const open = (await col(x.t, "doc_requests").where("folderId", "==", f.id).get()).docs.filter(d => d.data().status === "open").length;
    if (open) return fail(res, 409, `В папке идёт сбор документов (${open}) — сначала закройте его`);
    await col(x.t, "doc_folders").doc(f.id).update({ deletedAt: Date.now(), deletedBy: { uid: x.c.uid, name: x.c.name } });
    await audit(req, x.t, "docs.folder", { kind: "folder", id: f.id, name: f.name }, "В корзину");
    return res.json({ success: true });
  } catch (e) { return oops(res, e); }
});

/** Корзина: удалённые папки и файлы (видит тот, кто управляет документами). */
router.get("/:t/trash", ...guard, async (req: any, res: any) => {
  try {
    const x = await callerOf(req, res); if (!x) return;
    if (!x.c.manageAll && !x.c.me.full) return fail(res, 403, "Корзину видит тот, кто управляет документами");
    const byId = await loadFolders(x.t);
    const cutoff = Date.now() - TRASH_DAYS * 86400_000;
    const folders = [...byId.values()].filter(f => f.deletedAt && f.deletedAt > cutoff).map(f => ({ id: f.id, name: f.name, deletedAt: f.deletedAt, path: folderPath(f, byId).slice(0, -1).map(p => p.name).join(" / ") }));
    const files = (await col(x.t, "doc_files").get()).docs.map(d => ({ ...(d.data() as DocFile), id: d.id })).filter(f => f.deletedAt && f.deletedAt > cutoff)
      .map(f => ({ ...fileView(f), deletedAt: f.deletedAt, folderName: byId.get(f.folderId)?.name || "" }));
    return res.json({ success: true, folders, files, days: TRASH_DAYS });
  } catch (e) { return oops(res, e); }
});

router.post("/:t/restore", ...guard, async (req: any, res: any) => {
  try {
    const x = await callerOf(req, res); if (!x) return;
    if (!x.c.manageAll && !x.c.me.full) return fail(res, 403, "Возвращает из корзины тот, кто управляет документами");
    const kind = req.body?.kind === "file" ? "doc_files" : "doc_folders"; const id = String(req.body?.id || "");
    if (!ID.test(id)) return fail(res, 400, "Неверный объект");
    const ref = col(x.t, kind).doc(id); const s = await ref.get();
    if (!s.exists || !s.data()?.deletedAt) return fail(res, 404, "В корзине этого нет");
    await ref.update({ deletedAt: null, deletedBy: null });
    await audit(req, x.t, "docs.restore", { kind: kind === "doc_files" ? "file" : "folder", id, name: String(s.data()?.name || "") }, "Возвращено из корзины");
    return res.json({ success: true });
  } catch (e) { return oops(res, e); }
});

// ── Файлы ───────────────────────────────────────────────────────────────

/**
 * Ссылка на загрузку файла в папку. Проверка: доступ «загружать» (или сбор,
 * в котором вызывающий — адресат), тип, размер, место организации.
 */
export async function startUpload(t: string, c: DocsCaller, folder: DocFolder, raw: { name: unknown; size: unknown }, extra: { requestId?: string; itemId?: string } = {}) {
  const name = cleanFileName(raw.name); const size = Number(raw.size);
  const problem = fileProblem(name, size);
  if (problem) return { error: problem };
  if ((await usedBytes(t)) + size > (await quotaOf(t))) return { error: `Место на диске организации закончилось (${fmtSize(await quotaOf(t))}). Удалите ненужное или попросите увеличить` };
  await ensureBucketCors();
  const id = newId("dfl"); const type = FILE_TYPES[extOf(name)];
  const file: DocFile = { id, folderId: folder.id, name, size, type, path: filePath(t, id), uploadedBy: { uid: c.uid, name: c.name }, at: Date.now(), status: "uploading", requestId: extra.requestId || null, itemId: extra.itemId || null };
  await col(t, "doc_files").doc(id).set(file);
  const [uploadUrl] = await bucket().file(file.path).getSignedUrl({ version: "v4", action: "write", expires: Date.now() + 30 * 60_000, contentType: type });
  return { id, uploadUrl, contentType: type };
}

/** Файл дошёл: размер совпал — файл появляется в папке. */
export async function finishUpload(t: string, c: DocsCaller, id: string): Promise<{ error?: string; status?: number; file?: DocFile }> {
  const ref = col(t, "doc_files").doc(id); const s = await ref.get();
  const f = s.exists ? ({ ...(s.data() as DocFile), id: s.id }) : null;
  if (!f || f.uploadedBy.uid !== c.uid) return { error: "Файл не найден", status: 404 };
  if (f.status === "ready") return { file: f };
  const obj = bucket().file(f.path);
  const [ok] = await obj.exists();
  if (!ok) return { error: "Файл не дошёл до хранилища — загрузите ещё раз", status: 409 };
  const [meta] = await obj.getMetadata();
  if (Number(meta.size) !== f.size) { await obj.delete().catch(() => {}); await ref.delete(); return { error: "Файл загрузился не полностью — попробуйте ещё раз", status: 409 }; }
  await ref.update({ status: "ready", at: Date.now() });
  return { file: { ...f, status: "ready" } };
}

router.post("/:t/upload-url", ...guard, async (req: any, res: any) => {
  try {
    const x = await callerOf(req, res); if (!x) return;
    const byId = await loadFolders(x.t);
    const f = byId.get(String(req.body?.folderId || ""));
    if (!f || inTrash(f, byId)) return fail(res, 404, "Папка не найдена");
    if (!rightsIn(f, byId, x.c).upload) return fail(res, 403, "Загружать в эту папку нельзя");
    const r = await startUpload(x.t, x.c, f, req.body || {});
    if ("error" in r) return fail(res, 400, r.error!);
    return res.json({ success: true, ...r });
  } catch (e) { return oops(res, e); }
});

router.post("/:t/files/:id/finalize", ...guard, async (req: any, res: any) => {
  try {
    const x = await callerOf(req, res); if (!x) return;
    const r = await finishUpload(x.t, x.c, String(req.params.id));
    if (r.error) return fail(res, r.status || 400, r.error);
    await audit(req, x.t, "docs.upload", { kind: "file", id: r.file!.id, name: r.file!.name }, fmtSize(r.file!.size));
    return res.json({ success: true, file: fileView(r.file!) });
  } catch (e) { return oops(res, e); }
});

/** Файл и права на него: видит / меняет (свой или управляющий папкой). */
async function fileFor(x: { t: string; c: DocsCaller }, id: string) {
  if (!ID.test(id)) return null;
  const s = await col(x.t, "doc_files").doc(id).get();
  if (!s.exists) return null;
  const f = { ...(s.data() as DocFile), id: s.id };
  const byId = await loadFolders(x.t);
  const folder = byId.get(f.folderId);
  if (!folder) return null;
  const r = rightsIn(folder, byId, x.c);
  const own = f.uploadedBy.uid === x.c.uid;
  // Свой файл по сбору видит и тот, у кого нет доступа к самой папке.
  return { f, folder, byId, see: f.status === "ready" && (fileVisible(f, r, x.c) || own), edit: r.manage || own };
}

/** Ссылка на чтение: открыть (inline) или скачать. */
router.get("/:t/files/:id/url", ...guard, async (req: any, res: any) => {
  try {
    const x = await callerOf(req, res); if (!x) return;
    const o = await fileFor(x, String(req.params.id));
    if (!o || !o.see || o.f.deletedAt) return fail(res, 404, "Файл не найден");
    const disp = `${req.query.download === "1" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(o.f.name)}`;
    const [url] = await bucket().file(o.f.path).getSignedUrl({ version: "v4", action: "read", expires: Date.now() + READ_TTL, responseDisposition: disp, responseType: o.f.type });
    return res.json({ success: true, url });
  } catch (e) { return oops(res, e); }
});

/** Переименовать или перенести файл. */
router.put("/:t/files/:id", ...guard, async (req: any, res: any) => {
  try {
    const x = await callerOf(req, res); if (!x) return;
    const o = await fileFor(x, String(req.params.id));
    if (!o || !o.see || o.f.deletedAt) return fail(res, 404, "Файл не найден");
    if (!o.edit) return fail(res, 403, "Менять можно свои файлы");
    const patch: Record<string, unknown> = {};
    if (req.body?.name !== undefined) {
      const n = cleanFileName(req.body.name);
      patch.name = extOf(n) === extOf(o.f.name) ? n : `${n}.${extOf(o.f.name)}`;
    }
    if (req.body?.folderId !== undefined) {
      const to = o.byId.get(String(req.body.folderId));
      if (!to || inTrash(to, o.byId)) return fail(res, 404, "Папка назначения не найдена");
      if (!rightsIn(to, o.byId, x.c).upload) return fail(res, 403, "В эту папку загружать нельзя");
      if (o.f.requestId) return fail(res, 409, "Файл сдан по сбору — он остаётся в папке сбора");
      patch.folderId = to.id;
    }
    if (!Object.keys(patch).length) return res.json({ success: true });
    await col(x.t, "doc_files").doc(o.f.id).update(patch);
    await audit(req, x.t, "docs.file", { kind: "file", id: o.f.id, name: String(patch.name || o.f.name) }, patch.folderId ? "перенесён" : "переименован");
    return res.json({ success: true });
  } catch (e) { return oops(res, e); }
});

router.delete("/:t/files/:id", ...guard, async (req: any, res: any) => {
  try {
    const x = await callerOf(req, res); if (!x) return;
    const o = await fileFor(x, String(req.params.id));
    if (!o || !o.see || o.f.deletedAt) return fail(res, 404, "Файл не найден");
    if (!o.edit) return fail(res, 403, "Удалять можно свои файлы");
    await col(x.t, "doc_files").doc(o.f.id).update({ deletedAt: Date.now(), deletedBy: { uid: x.c.uid, name: x.c.name } });
    await audit(req, x.t, "docs.file", { kind: "file", id: o.f.id, name: o.f.name }, "В корзину");
    return res.json({ success: true });
  } catch (e) { return oops(res, e); }
});

export default router;
export { callerOf, inTrash, fileView };
