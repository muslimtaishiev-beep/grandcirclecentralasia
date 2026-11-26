import { Router } from "express";
import admin from "firebase-admin";
import { randomBytes } from "crypto";
import { requireFirebaseAuth } from "./authRoutes.js";
import { hasPerm, staffCaller } from "../server/access.js";
import { actorOf, writeAudit } from "../server/audit.js";
import { requireScreen } from "../server/tenantAccess.js";
import { bucket, ensureBucketCors } from "../server/storage.js";
import { deliver } from "../server/notify.js";
import { cancelJob, registerJobHandler, scheduleJob } from "../server/scheduler.js";
import { appUrl } from "../server/emailEvents.js";
import { orgTimeZone } from "../server/orgTime.js";
import {
  MAX_RECIPIENTS, STATUS_TEXT, audienceEmpty, audienceMembers, describeAudience, isComplete, itemsFor, requestStats, sanitizeRequestInput, shortName, submitStatus,
  type DocRequest, type Submission,
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
    // Файл по сбору — отметка в сдаче, задача, уведомление завучу.
    const sub = r.file!.requestId ? await afterSubmitChange(x.t, r.file!.requestId, x.c.uid, x.staff) : null;
    return res.json({ success: true, file: fileView(r.file!), ...(sub ? { submission: sub } : {}) });
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
    if (o.f.requestId && o.f.uploadedBy.uid === x.c.uid) {
      const sub = (await reqRef(x.t, o.f.requestId).collection("submissions").doc(x.c.uid).get()).data() as Submission | undefined;
      if (sub?.review?.status === "accepted") return fail(res, 409, "Документы уже приняты — удалить нельзя");
    }
    await col(x.t, "doc_files").doc(o.f.id).update({ deletedAt: Date.now(), deletedBy: { uid: x.c.uid, name: x.c.name } });
    await audit(req, x.t, "docs.file", { kind: "file", id: o.f.id, name: o.f.name }, "В корзину");
    if (o.f.requestId) await afterSubmitChange(x.t, o.f.requestId, o.f.uploadedBy.uid, x.staff);
    return res.json({ success: true });
  } catch (e) { return oops(res, e); }
});


// ── Сборы документов ────────────────────────────────────────────────────

const reqRef = (t: string, id: string) => col(t, "doc_requests").doc(id);
const reqUrl = async (t: string, id: string) => `/workspace/${t}/files?tab=requests&r=${encodeURIComponent(id)}`;
async function loadRequest(t: string, id: string): Promise<DocRequest | null> {
  if (!ID.test(id)) return null;
  const s = await reqRef(t, id).get();
  return s.exists ? ({ ...(s.data() as DocRequest), id: s.id }) : null;
}
async function loadSubs(t: string, id: string): Promise<Record<string, Submission>> {
  const s = await reqRef(t, id).collection("submissions").get();
  return Object.fromEntries(s.docs.map(d => [d.id, d.data() as Submission]));
}
/** Управляет сбором: автор, право «Управление документами» или управляющий папкой. */
async function canManageRequest(t: string, r: DocRequest, c: DocsCaller): Promise<boolean> {
  if (c.manageAll || c.me.full || r.createdBy.uid === c.uid) return true;
  const byId = await loadFolders(t);
  const f = byId.get(r.folderId);
  return !!f && rightsIn(f, byId, c).manage;
}
const dueText = async (t: string, ms: number) => new Intl.DateTimeFormat("ru-RU", { timeZone: await orgTimeZone(t), day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
const dueDay = async (t: string, ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: await orgTimeZone(t), year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));

/** Задача в трекере каждому адресату — от сервера, со ссылкой на сбор. */
async function createTask(t: string, r: DocRequest, uid: string): Promise<string> {
  const ref = col(t, "workspace_tasks").doc(`docreq_${r.id}_${uid}`.slice(0, 1400));
  const now = Date.now();
  await ref.set({
    id: ref.id, tenantId: t, title: `Сдать: ${r.title}`, description: [r.note, `Загрузить документы: ${await appUrl()}${await reqUrl(t, r.id)}`].filter(Boolean).join("\n\n"),
    status: "todo", priority: "medium", creatorStaffId: r.createdBy.uid, assigneeStaffIds: [uid], subtasks: [], commentsCount: 0,
    dueDate: await dueDay(t, r.dueAt), tags: ["doc-request"], requestId: r.id, createdAt: now, updatedAt: now,
  });
  return ref.id;
}
const taskStatus = (t: string, taskId: string | null | undefined, status: string) => taskId ? col(t, "workspace_tasks").doc(taskId).update({ status, updatedAt: Date.now() }).catch(() => {}) : Promise.resolve();

/** Напоминания и срок — задачи будильника; продление срока их переставляет. */
async function scheduleRequestJobs(t: string, r: DocRequest, by: { uid: string; name: string }) {
  const now = Date.now();
  for (const h of [0, 1, 2, 3, 6, 12, 24, 48, 72, 96, 120, 168, 336]) await cancelJob(t, `docreq:${r.id}:remind:${h}`).catch(() => false);
  if (r.status !== "open") { await cancelJob(t, `docreq:${r.id}:due`).catch(() => false); return; }
  for (const h of r.remind) {
    const at = r.dueAt - h * 3600_000 - (h === 0 ? 3 * 3600_000 : 0); // «в день срока» — за 3 часа
    if (at > now + 60_000) await scheduleJob({ tenantId: t, kind: "docs_remind", key: `docreq:${r.id}:remind:${h}`, runAt: at, payload: { requestId: r.id }, by });
  }
  if (r.dueAt > now) await scheduleJob({ tenantId: t, kind: "docs_due", key: `docreq:${r.id}:due`, runAt: r.dueAt, payload: { requestId: r.id }, by });
}

/** Новые адресаты: сдача-заготовка, задача, уведомление. */
async function addRecipients(t: string, r: DocRequest, people: { uid: string; name: string }[], fromName: string) {
  for (const p of people) {
    const ref = reqRef(t, r.id).collection("submissions").doc(p.uid);
    if ((await ref.get()).exists) continue;
    const taskId = await createTask(t, r, p.uid).catch(() => null);
    const sub: Submission = { uid: p.uid, name: p.name, files: [], complete: false, at: null, late: false, review: null, taskId };
    await ref.set(sub);
  }
  if (people.length) await deliver({
    tenantId: t, event: "docs.request", uids: people.map(p => p.uid), type: "docs",
    title: `${fromName} просит сдать: ${r.title}`, body: `Срок — ${await dueText(t, r.dueAt)}`,
    url: await reqUrl(t, r.id), docId: u => `docreq_${r.id}_${u}`,
  }).catch(e => console.warn("[docs] notify", e?.message));
}

/**
 * Сдача изменилась (файл загружен или удалён): пересчитать «сдано», отметку
 * опоздания, задачу в трекере; завучу — уведомление по его настройке.
 */
async function afterSubmitChange(t: string, requestId: string, uid: string, staff: StaffLite[]): Promise<Submission | null> {
  const r = await loadRequest(t, requestId);
  if (!r) return null;
  const ref = reqRef(t, r.id).collection("submissions").doc(uid);
  const prev = (await ref.get()).data() as Submission | undefined;
  if (!prev) return null;
  const files = (await col(t, "doc_files").where("requestId", "==", r.id).get()).docs.map(d => ({ ...(d.data() as DocFile), id: d.id }))
    .filter(f => f.uploadedBy.uid === uid && f.status === "ready" && !f.deletedAt).sort((a, b) => a.at - b.at)
    .map(f => ({ id: f.id, name: f.name, itemId: f.itemId || null, at: f.at, size: f.size }));
  const me = staff.find(s => s.uid === uid) || null;
  const complete = isComplete(r.items, itemsFor(r.items, me?.placement || null), files);
  const at = complete ? (prev.complete && prev.at ? prev.at : Date.now()) : null;
  // Проверка: принятое не трогаем; сдал полностью (впервые или после доработки) — ждёт проверки.
  let review: Submission["review"] = null;
  if (r.review) {
    if (prev.review?.status === "accepted") review = prev.review;
    else if (complete && !prev.complete) review = { status: "pending", comment: prev.review?.comment || "", by: "", at: Date.now() };
    else if (complete) review = prev.review;
    else review = prev.review?.status === "returned" ? prev.review : null;
  }
  const next: Submission = { ...prev, files, complete, at, late: !!at && at > r.dueAt, review };
  await ref.set(JSON.parse(JSON.stringify(next)));
  await taskStatus(t, prev.taskId, complete ? (r.review && review?.status !== "accepted" ? "review" : "done") : files.length ? "in_progress" : "todo");
  if (complete && !prev.complete) {
    if (r.notifyMode === "each") await deliver({
      tenantId: t, event: "docs.submitted", uids: [r.createdBy.uid], type: "docs",
      title: `${prev.name} сдал(а): ${r.title}`, body: `${files.length} ${files.length === 1 ? "файл" : "файлов"}${next.late ? " · с опозданием" : ""}`,
      url: await reqUrl(t, r.id), docId: u => `docsub_${r.id}_${uid}_${u}`,
    }).catch(() => {});
    else if (r.notifyMode === "digest") await scheduleJob({ tenantId: t, kind: "docs_digest", key: `docreq:${r.id}:digest`, runAt: Math.max(Date.now() + 60_000, (r.lastDigestAt || 0) + 3600_000), payload: { requestId: r.id }, by: r.createdBy }).catch(() => {});
  }
  return next;
}

// Будильник: напоминания не сдавшим, итог по сроку, сводка сдач завучу.
registerJobHandler("docs_remind", async job => {
  const t = job.tenantId; const r = await loadRequest(t, String(job.payload?.requestId || ""));
  if (!r || r.status !== "open") return "Сбор закрыт";
  const subs = await loadSubs(t, r.id);
  const left = r.recipients.filter(x => !subs[x.uid]?.complete).map(x => x.uid);
  if (!left.length) return "Все сдали";
  await deliver({ tenantId: t, event: "docs.remind", uids: left, type: "docs", title: `Напоминание: ${r.title}`, body: `Срок — ${await dueText(t, r.dueAt)}`, url: await reqUrl(t, r.id), docId: u => `docreq_${r.id}_${u}` });
  return `Напомнили: ${left.length}`;
});
registerJobHandler("docs_due", async job => {
  const t = job.tenantId; const r = await loadRequest(t, String(job.payload?.requestId || ""));
  if (!r || r.status !== "open") return "Сбор закрыт";
  const subs = await loadSubs(t, r.id);
  const left = r.recipients.filter(x => !subs[x.uid]?.complete);
  await deliver({
    tenantId: t, event: "docs.due", uids: [r.createdBy.uid], type: "docs",
    title: `Срок прошёл: ${r.title}`, body: left.length ? `Не сдали ${left.length} из ${r.recipients.length}: ${left.slice(0, 8).map(x => x.name).join(", ")}${left.length > 8 ? "…" : ""}` : `Сдали все ${r.recipients.length}`,
    url: await reqUrl(t, r.id), docId: u => `docdue_${r.id}_${u}`,
  });
  return `Не сдали: ${left.length}`;
});
registerJobHandler("docs_digest", async job => {
  const t = job.tenantId; const r = await loadRequest(t, String(job.payload?.requestId || ""));
  if (!r) return "Нет сбора";
  const subs = await loadSubs(t, r.id);
  const fresh = Object.values(subs).filter(s => s.complete && s.at && s.at > (r.lastDigestAt || 0));
  await reqRef(t, r.id).update({ lastDigestAt: Date.now() });
  if (!fresh.length) return "Новых сдач нет";
  const done = Object.values(subs).filter(s => s.complete).length;
  await deliver({
    tenantId: t, event: "docs.submitted", uids: [r.createdBy.uid], type: "docs",
    title: `Сдали: ${r.title} — ${done} из ${r.recipients.length}`, body: fresh.map(s => s.name).slice(0, 10).join(", ") + (fresh.length > 10 ? "…" : ""),
    url: await reqUrl(t, r.id), docId: u => `docsub_${r.id}_${u}`,
  });
  return `Сводка: ${fresh.length}`;
});

const requestView = (r: DocRequest) => ({ id: r.id, folderId: r.folderId, title: r.title, note: r.note, dueAt: r.dueAt, status: r.status, items: r.items, lateOk: r.lateOk, review: r.review, notifyMode: r.notifyMode, remind: r.remind, audience: r.audience, createdBy: r.createdBy, createdAt: r.createdAt, sampleFileIds: r.sampleFileIds, recipients: r.recipients.length });

/** Сборы: которыми управляю (со сводкой) и где я адресат (мой статус). */
router.get("/:t/requests", ...guard, async (req: any, res: any) => {
  try {
    const x = await callerOf(req, res); if (!x) return;
    const all = (await col(x.t, "doc_requests").get()).docs.map(d => ({ ...(d.data() as DocRequest), id: d.id })).sort((a, b) => b.createdAt - a.createdAt);
    const manage: any[] = []; const mine: any[] = [];
    for (const r of all) {
      if (await canManageRequest(x.t, r, x.c)) {
        const subs = await loadSubs(x.t, r.id);
        const st = requestStats(r, subs, x.staff);
        manage.push({ ...requestView(r), stats: { total: st.total, done: st.done + st.late + st.accepted, late: st.late, partial: st.partial, none: st.none, returned: st.returned } });
      }
      if (r.recipients.some(p => p.uid === x.c.uid)) {
        const s = (await reqRef(x.t, r.id).collection("submissions").doc(x.c.uid).get()).data() as Submission | undefined;
        mine.push({ ...requestView(r), my: { status: submitStatus(r, s), files: s?.files.length || 0, review: s?.review || null } });
      }
    }
    return res.json({ success: true, manage, mine });
  } catch (e) { return oops(res, e); }
});

/** Объявить сбор: адресаты по признакам, задача каждому, уведомления, будильник. */
router.post("/:t/requests", ...guard, async (req: any, res: any) => {
  try {
    const x = await callerOf(req, res); if (!x) return;
    const byId = await loadFolders(x.t);
    const folder = byId.get(String(req.body?.folderId || ""));
    if (!folder || inTrash(folder, byId)) return fail(res, 404, "Папка не найдена");
    if (!rightsIn(folder, byId, x.c).manage) return fail(res, 403, "Собирать документы в эту папку может тот, кто ею управляет");
    const inp = sanitizeRequestInput(req.body);
    if (!inp.title) return fail(res, 400, "Напишите, что сдать");
    if (!inp.dueAt || inp.dueAt < Date.now() + 10 * 60_000) return fail(res, 400, "Укажите срок в будущем");
    if (audienceEmpty(inp.audience)) return fail(res, 400, "Выберите, кому сдавать");
    const people = audienceMembers(inp.audience, x.staff).filter(s => s.uid !== x.c.uid).map(s => ({ uid: s.uid, name: s.name }));
    if (!people.length) return fail(res, 400, "Под выбранные признаки никто не подходит");
    if (people.length > MAX_RECIPIENTS) return fail(res, 400, `Слишком много адресатов (${people.length}) — не больше ${MAX_RECIPIENTS}`);
    const files = inp.sampleFileIds.length ? (await Promise.all(inp.sampleFileIds.map(id => col(x.t, "doc_files").doc(id).get()))).filter(s => s.exists && s.data()?.folderId === folder.id).map(s => s.id) : [];
    const id = newId("dr"); const now = Date.now();
    const r: DocRequest = { id, folderId: folder.id, ...inp, sampleFileIds: files, recipients: people, status: "open", createdBy: { uid: x.c.uid, name: x.c.name }, createdAt: now, updatedAt: now };
    await reqRef(x.t, id).set(JSON.parse(JSON.stringify(r)));
    await addRecipients(x.t, r, people, x.c.name);
    await scheduleRequestJobs(x.t, r, { uid: x.c.uid, name: x.c.name });
    await audit(req, x.t, "docs.request", { kind: "request", id, name: r.title }, `Адресатов: ${people.length}, срок ${await dueText(x.t, r.dueAt)}`);
    return res.json({ success: true, id, recipients: people.length });
  } catch (e) { return oops(res, e); }
});

/** Сбор: управляющему — все адресаты и сводка; адресату — его пункты, файлы и образцы. */
router.get("/:t/requests/:id", ...guard, async (req: any, res: any) => {
  try {
    const x = await callerOf(req, res); if (!x) return;
    const r = await loadRequest(x.t, String(req.params.id));
    if (!r) return fail(res, 404, "Сбор не найден");
    const manage = await canManageRequest(x.t, r, x.c);
    const isRecipient = r.recipients.some(p => p.uid === x.c.uid);
    if (!manage && !isRecipient) return fail(res, 403, "Этот сбор не для вас");
    const samples = r.sampleFileIds.length ? (await Promise.all(r.sampleFileIds.map(id => col(x.t, "doc_files").doc(id).get()))).filter(s => s.exists && !s.data()?.deletedAt).map(s => fileView({ ...(s.data() as DocFile), id: s.id })) : [];
    const folderName = (await col(x.t, "doc_folders").doc(r.folderId).get()).data()?.name || "";
    const base = { request: { ...requestView(r), folderName }, samples, manage };
    const mineItems = itemsFor(r.items, x.c.me.placement);
    const mySub = isRecipient ? ((await reqRef(x.t, r.id).collection("submissions").doc(x.c.uid).get()).data() as Submission | undefined) || null : null;
    const my = isRecipient ? { items: mineItems, submission: mySub, status: submitStatus(r, mySub), canUpload: r.status === "open" && (r.lateOk || Date.now() <= r.dueAt) && mySub?.review?.status !== "accepted" } : null;
    if (!manage) return res.json({ success: true, ...base, my });
    const subs = await loadSubs(x.t, r.id);
    const byUid = new Map(x.staff.map(s => [s.uid, s]));
    const positions = Object.fromEntries((await db().collection("custom_roles").where("tenantId", "==", x.t).get()).docs.map(d => [d.id, String(d.data().name || "")]));
    const rows = r.recipients.map(p => {
      const s = subs[p.uid] || null; const st = byUid.get(p.uid);
      return { uid: p.uid, name: p.name, positionName: st?.positionName || "", placement: st?.placement || null, active: !!st, status: submitStatus(r, s), statusText: STATUS_TEXT[submitStatus(r, s)], files: s?.files || [], at: s?.at || null, late: !!s?.late, review: s?.review || null, items: itemsFor(r.items, st?.placement || null) };
    });
    return res.json({ success: true, ...base, my, rows, stats: requestStats(r, subs, x.staff, positions), audienceText: describeAudience(r.audience, { positions, people: Object.fromEntries(x.staff.map(s => [s.uid, s.name])) }) });
  } catch (e) { return oops(res, e); }
});

/** Изменить сбор: срок, текст, добавить людей; закрыть или открыть снова; пересобрать адресатов. */
router.put("/:t/requests/:id", ...guard, async (req: any, res: any) => {
  try {
    const x = await callerOf(req, res); if (!x) return;
    const r = await loadRequest(x.t, String(req.params.id));
    if (!r) return fail(res, 404, "Сбор не найден");
    if (!(await canManageRequest(x.t, r, x.c))) return fail(res, 403, "Сбором управляет его автор или завуч");
    const b = req.body || {};
    const patch: Partial<DocRequest> = { updatedAt: Date.now() };
    const changes: string[] = [];
    if (b.title !== undefined) { const v = String(b.title).trim().slice(0, 120); if (!v) return fail(res, 400, "Напишите, что сдать"); patch.title = v; }
    if (b.note !== undefined) patch.note = String(b.note).replace(/\r/g, "").trim().slice(0, 2000);
    if (b.dueAt !== undefined) {
      const d = Math.floor(Number(b.dueAt));
      if (!Number.isFinite(d) || d < Date.now()) return fail(res, 400, "Новый срок — в будущем");
      patch.dueAt = d; changes.push(`срок → ${await dueText(x.t, d)}`);
    }
    if (b.status === "closed" || b.status === "open") { patch.status = b.status; changes.push(b.status === "closed" ? "закрыт" : "открыт снова"); }
    let added: { uid: string; name: string }[] = []; let dropped = 0;
    if (b.add || b.rebuild) {
      const want = b.rebuild ? audienceMembers(r.audience, x.staff).filter(s => s.uid !== r.createdBy.uid) : x.staff.filter(s => (Array.isArray(b.add) ? b.add.map(String) : []).includes(s.uid));
      added = want.filter(s => !r.recipients.some(p => p.uid === s.uid)).map(s => ({ uid: s.uid, name: s.name }));
      let recipients = [...r.recipients, ...added];
      if (b.rebuild) {
        // Ушедшие из организации и не сдававшие — выпадают; сдавшие остаются в отчёте.
        const subs = await loadSubs(x.t, r.id);
        const live = new Set(x.staff.map(s => s.uid));
        const keep = recipients.filter(p => live.has(p.uid) || (subs[p.uid]?.files.length || 0) > 0);
        dropped = recipients.length - keep.length; recipients = keep;
      }
      if (recipients.length > MAX_RECIPIENTS) return fail(res, 400, `Не больше ${MAX_RECIPIENTS} адресатов`);
      patch.recipients = recipients;
      if (added.length) changes.push(`добавлено ${added.length}`); if (dropped) changes.push(`убрано ${dropped}`);
    }
    await reqRef(x.t, r.id).update(JSON.parse(JSON.stringify(patch)));
    const next = { ...r, ...patch } as DocRequest;
    if (added.length) await addRecipients(x.t, next, added, x.c.name);
    if (patch.dueAt !== undefined || patch.status !== undefined) {
      await scheduleRequestJobs(x.t, next, { uid: x.c.uid, name: x.c.name });
      if (patch.dueAt !== undefined) { const day = await dueDay(x.t, next.dueAt); const subs = await loadSubs(x.t, r.id); await Promise.all(Object.values(subs).map(s => s.taskId ? col(x.t, "workspace_tasks").doc(s.taskId).update({ dueDate: day }).catch(() => {}) : null)); }
    }
    if (changes.length || patch.title) await audit(req, x.t, "docs.request", { kind: "request", id: r.id, name: next.title }, changes.join(", ") || "изменён");
    return res.json({ success: true, added: added.length, dropped });
  } catch (e) { return oops(res, e); }
});

/** Напомнить вручную всем, кто ещё не сдал. */
router.post("/:t/requests/:id/remind", ...guard, async (req: any, res: any) => {
  try {
    const x = await callerOf(req, res); if (!x) return;
    const r = await loadRequest(x.t, String(req.params.id));
    if (!r) return fail(res, 404, "Сбор не найден");
    if (!(await canManageRequest(x.t, r, x.c))) return fail(res, 403, "Нет прав");
    const subs = await loadSubs(x.t, r.id);
    const left = r.recipients.filter(p => !subs[p.uid]?.complete || subs[p.uid]?.review?.status === "returned").map(p => p.uid);
    if (!left.length) return res.json({ success: true, sent: 0 });
    const sent = await deliver({ tenantId: x.t, event: "docs.remind", uids: left, type: "docs", title: `Напоминание от ${x.c.name}: ${r.title}`, body: `Срок — ${await dueText(x.t, r.dueAt)}`, url: await reqUrl(x.t, r.id), docId: u => `docreq_${r.id}_${u}` });
    return res.json({ success: true, sent: sent.length, left: left.length });
  } catch (e) { return oops(res, e); }
});

/** Проверка: «Принято» или «На доработку» с комментарием. */
router.post("/:t/requests/:id/review", ...guard, async (req: any, res: any) => {
  try {
    const x = await callerOf(req, res); if (!x) return;
    const r = await loadRequest(x.t, String(req.params.id));
    if (!r) return fail(res, 404, "Сбор не найден");
    if (!(await canManageRequest(x.t, r, x.c))) return fail(res, 403, "Проверяет автор сбора или завуч");
    const uid = String(req.body?.uid || ""); const status = req.body?.status === "returned" ? "returned" : req.body?.status === "accepted" ? "accepted" : null;
    if (!status) return fail(res, 400, "Неизвестное решение");
    const ref = reqRef(x.t, r.id).collection("submissions").doc(uid);
    const s = (await ref.get()).data() as Submission | undefined;
    if (!s || !s.files.length) return fail(res, 409, "Этот сотрудник ещё ничего не сдал");
    const comment = String(req.body?.comment ?? "").trim().slice(0, 1000);
    const review = { status, comment, by: x.c.name, at: Date.now() } as Submission["review"];
    // Вернули — снова не сдано, пока не загрузит исправленное.
    await ref.update({ review, ...(status === "returned" ? { complete: false, at: null } : {}) });
    await taskStatus(x.t, s.taskId, status === "accepted" ? "done" : "in_progress");
    await deliver({
      tenantId: x.t, event: "docs.review", uids: [uid], type: "docs",
      title: status === "accepted" ? `Приняли: ${r.title}` : `Вернули на доработку: ${r.title}`, body: comment || (status === "accepted" ? "Документы приняты" : "Исправьте и загрузите заново"),
      url: await reqUrl(x.t, r.id), docId: u => `docrev_${r.id}_${u}`,
    }).catch(() => {});
    await audit(req, x.t, "docs.review", { kind: "request", id: r.id, name: r.title }, `${s.name}: ${status === "accepted" ? "принято" : "на доработку"}${comment ? ` — ${comment}` : ""}`);
    return res.json({ success: true });
  } catch (e) { return oops(res, e); }
});

/**
 * Ссылка на загрузку по сбору: адресат кладёт файл прямо в папку сбора, даже
 * без доступа к самой папке. Имя — с фамилией и пунктом.
 */
router.post("/:t/requests/:id/upload-url", ...guard, async (req: any, res: any) => {
  try {
    const x = await callerOf(req, res); if (!x) return;
    const r = await loadRequest(x.t, String(req.params.id));
    if (!r) return fail(res, 404, "Сбор не найден");
    const sub = (await reqRef(x.t, r.id).collection("submissions").doc(x.c.uid).get()).data() as Submission | undefined;
    if (!sub) return fail(res, 403, "Этот сбор не для вас");
    if (r.status !== "open") return fail(res, 409, "Сбор закрыт");
    if (!r.lateOk && Date.now() > r.dueAt) return fail(res, 409, "Срок прошёл — после срока этот сбор не принимает");
    if (sub.review?.status === "accepted") return fail(res, 409, "Документы уже приняты");
    const byId = await loadFolders(x.t);
    const folder = byId.get(r.folderId);
    if (!folder || inTrash(folder, byId)) return fail(res, 409, "Папку сбора удалили — напишите завучу");
    const items = itemsFor(r.items, x.c.me.placement);
    const itemId = req.body?.itemId ? String(req.body.itemId) : "";
    if (items.length && !items.some(i => i.id === itemId)) return fail(res, 400, "Выберите, к какому пункту файл");
    const item = items.find(i => i.id === itemId);
    const original = cleanFileName(req.body?.name);
    const name = `${shortName(x.c.name)} — ${item ? `${item.label} — ` : ""}${original}`.slice(0, 180);
    const out = await startUpload(x.t, x.c, folder, { name, size: req.body?.size }, { requestId: r.id, itemId: item?.id });
    if ("error" in out) return fail(res, 400, out.error!);
    return res.json({ success: true, ...out });
  } catch (e) { return oops(res, e); }
});

export default router;
export { callerOf, inTrash, fileView };
