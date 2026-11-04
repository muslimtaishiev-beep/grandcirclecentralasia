import { Router } from "express";
import admin from "firebase-admin";
import { randomBytes } from "crypto";
import { requireFirebaseAuth } from "./authRoutes.js";
import { activeMembership, membershipPermissions } from "../server/access.js";
import { checkTenantOpen, requireScreen } from "../server/tenantAccess.js";
import { hasFullAccess } from "../shared/permissions.js";
import { tenantLogos } from "../shared/legal.js";
import { listEmployees } from "./journalRoutes.js";
import {
  ASSET_ID, ASSET_TYPES, LIMITS, PRESENTATION_CODE, SLIDE_ID,
  blobIdsIn, sanitizeAccess, sanitizeFaces,
  type Presentation, type PresentationAsset,
} from "../shared/presentations.js";

/**
 * Презентации организации.
 *
 * Документ презентации (со слайдами) — подколлекция организации, пишет только
 * сервер. Видео и картинки — в Storage: браузер кладёт их туда сам по
 * подписанным ссылкам на запись (через функцию Vercel файл больше 4,5 МБ не
 * пройдёт), а смотрит по подписанным ссылкам на чтение, которые сервер выдаёт
 * только после проверки доступа. Сам бакет закрыт: прямых публичных адресов
 * у файлов нет.
 *
 * Короткая ссылка /show/<code> ведёт через presentation_links: по ней сервер
 * находит организацию и решает, пускать ли без входа.
 */
const router = Router();
const db = () => admin.firestore();
const col = (t: string) => db().collection("tenants").doc(t).collection("presentations");
const LINKS = "presentation_links";
const BUCKET = process.env.FIREBASE_STORAGE_BUCKET || "study-64ebf.firebasestorage.app";
const bucket = () => admin.storage().bucket(BUCKET);
const filePath = (t: string, id: string, asset: string) => `presentations/${t}/${id}/${asset}`;
const str = (v: unknown, max = 200) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const fail = (res: any, status: number, error: string, extra: object = {}) => res.status(status).json({ success: false, error, ...extra });
const oops = (res: any, e: any) => { console.error("[presentations]", e); return fail(res, 500, "Не получилось — попробуйте ещё раз"); };
const CODE_ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from(randomBytes(8), b => CODE_ABC[b % CODE_ABC.length]).join("");
/** Ссылка на чтение живёт 6 часов — с запасом на урок; страница обновляет их при повторном открытии. */
const READ_TTL = 6 * 3600_000;

// ── Кто вызывает ────────────────────────────────────────────────────────

interface Caller { uid: string; name: string; full: boolean; manageAll: boolean; member: boolean }

async function callerIn(t: string, user: any): Promise<Caller | null> {
  if (!user?.uid) return null;
  const uid = String(user.uid);
  const name = str(user.name || user.email || uid, 120);
  if (user.isSuperadmin === true) return { uid, name, full: true, manageAll: true, member: true };
  const m = await activeMembership(db(), uid, t);
  if (!m) return { uid, name, full: false, manageAll: false, member: false };
  const perms = await membershipPermissions(db(), m);
  const full = hasFullAccess(m.role);
  return { uid, name: str(m.displayName, 120) || name, full, manageAll: full || perms.has("presentations:manage"), member: true };
}

const requireEmployee = async (req: any, res: any, next: any) => {
  try {
    const c = await callerIn(String(req.params.tenantId || ""), req.user);
    if (!c?.member) return fail(res, 403, "Презентации доступны только сотрудникам организации");
    req.caller = c;
    next();
  } catch (e: any) { return oops(res, e); }
};
const guard = [requireFirebaseAuth, requireScreen("presentations", (req: any) => req.params.tenantId), requireEmployee];

export const canManage = (p: Pick<Presentation, "createdBy">, c: Caller | null) => !!c && (c.manageAll || p.createdBy === c.uid);
export function canView(p: Pick<Presentation, "access" | "createdBy">, c: Caller | null): boolean {
  if (p.access.mode === "public") return true;
  if (!c) return false;
  if (canManage(p, c)) return true;
  if (!c.member) return false;
  return p.access.mode === "org" || (p.access.mode === "people" && p.access.people.includes(c.uid));
}

/** Список без тяжёлых слайдов. */
const summary = (p: Presentation, c: Caller) => ({
  id: p.id, title: p.title, description: p.description, kind: p.kind, code: p.code, status: p.status,
  access: p.access, slideCount: (p.slides || []).length, cover: p.slides?.[0] || null, faces: p.faces,
  createdByName: p.createdByName, createdAt: p.createdAt, updatedAt: p.updatedAt,
  size: Object.values(p.assets || {}).reduce((n, a) => n + (a.size || 0), 0),
  canManage: canManage(p, c),
});

async function signedAssets(t: string, p: Presentation): Promise<Record<string, string>> {
  const expires = Date.now() + READ_TTL;
  const ids = Object.keys(p.assets || {});
  const urls = await Promise.all(ids.map(id => bucket().file(filePath(t, p.id, id)).getSignedUrl({ version: "v4", action: "read", expires }).then(([u]) => u)));
  return Object.fromEntries(ids.map((id, i) => [id, urls[i]]));
}

// ── Кабинет ─────────────────────────────────────────────────────────────

router.get("/:tenantId", ...guard, async (req: any, res: any) => {
  try {
    const snap = await col(req.params.tenantId).orderBy("updatedAt", "desc").get();
    const c: Caller = req.caller;
    // Обложка для карточки — только первый слайд, а файлы к нему подписываем
    // только когда в нём есть картинки (у большинства обложек их нет).
    const items = snap.docs.map(d => ({ ...(d.data() as Presentation), id: d.id }))
      .filter(p => canView(p, c) && (p.status === "ready" || canManage(p, c)))
      .map(p => summary(p, c));
    return res.json({ success: true, presentations: items, canCreate: c.manageAll });
  } catch (e: any) { return oops(res, e); }
});

router.get("/:tenantId/employees", ...guard, async (req: any, res: any) => {
  try { return res.json({ success: true, employees: await listEmployees(req.params.tenantId) }); }
  catch (e: any) { return oops(res, e); }
});

/**
 * Новая презентация: { title, description?, kind, slides: [{id, html}], faces,
 * assets: { <id>: { type, size } }, source? }. В ответ — ссылки на запись
 * каждого файла; после загрузки браузер вызывает /finalize.
 */
router.post("/:tenantId", ...guard, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: Caller = req.caller;
    if (!c.manageAll) return fail(res, 403, "Загружать презентации может сотрудник с правом «Управление презентациями»");
    const b = req.body || {};
    const title = str(b.title, LIMITS.title);
    if (!title) return fail(res, 400, "Укажите название");
    const kind = b.kind === "html" ? "html" : "slides";

    const slides = (Array.isArray(b.slides) ? b.slides : []).slice(0, LIMITS.slides + 1)
      .map((s: any) => ({ id: String(s?.id || ""), html: String(s?.html || "") }));
    if (kind === "slides") {
      if (!slides.length) return fail(res, 400, "В колоде нет слайдов");
      if (slides.length > LIMITS.slides) return fail(res, 400, `Слайдов больше ${LIMITS.slides}`);
      const ids = new Set<string>();
      for (const s of slides) {
        if (!SLIDE_ID.test(s.id) || ids.has(s.id)) return fail(res, 400, `Неверный id слайда «${s.id.slice(0, 40)}»`);
        ids.add(s.id);
        if (Buffer.byteLength(s.html, "utf8") > LIMITS.slideBytes) return fail(res, 400, `Слайд «${s.id}» больше ${LIMITS.slideBytes / 1000} КБ`);
      }
      if (Buffer.byteLength(JSON.stringify(slides), "utf8") > LIMITS.slidesBytes) return fail(res, 400, "Слайды вместе больше 800 КБ — разделите презентацию");
    }

    const assets: Record<string, PresentationAsset> = {};
    for (const [id, a] of Object.entries(b.assets && typeof b.assets === "object" ? b.assets : {}).slice(0, LIMITS.assets + 1)) {
      const type = String((a as any)?.type || "").toLowerCase(); const size = Number((a as any)?.size);
      const okId = kind === "html" ? id === "index" : ASSET_ID.test(id);
      if (!okId) return fail(res, 400, `Неверное имя файла «${id.slice(0, 40)}»`);
      if (!ASSET_TYPES.test(type)) return fail(res, 400, `Файл ${id}: тип ${type || "неизвестен"} не поддерживается`);
      if (!Number.isFinite(size) || size <= 0 || size > LIMITS.assetBytes) return fail(res, 400, `Файл ${id}: размер больше 200 МБ или не указан`);
      assets[id] = { type, size };
    }
    if (Object.keys(assets).length > LIMITS.assets) return fail(res, 400, `Файлов больше ${LIMITS.assets}`);
    if (kind === "html" && !assets.index) return fail(res, 400, "Нет файла страницы");
    const missing = kind === "slides" ? [...new Set<string>(slides.flatMap((s: { html: string }) => blobIdsIn(s.html)))].filter(id => !assets[id]) : [];
    if (missing.length) return fail(res, 400, `В архиве нет файлов, на которые ссылаются слайды: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}`);

    const ref = col(t).doc();
    const now = Date.now();
    let code = newCode();
    for (let i = 0; i < 5; i++) {
      try { await db().collection(LINKS).doc(code).create({ tenantId: t, presentationId: ref.id, createdAt: now }); break; }
      catch (e: any) { if (e?.code !== 6 || i === 4) throw e; code = newCode(); }
    }
    const p: Presentation = {
      id: ref.id, tenantId: t, title, description: str(b.description, LIMITS.description), kind,
      slides: kind === "slides" ? slides : [], faces: sanitizeFaces(b.faces), assets,
      access: sanitizeAccess(b.access), code, status: Object.keys(assets).length ? "uploading" : "ready",
      ...(b.source?.kind ? { source: { kind: str(b.source.kind, 40), ref: str(b.source.ref, 300) } } : {}),
      createdBy: c.uid, createdByName: c.name, createdAt: now, updatedAt: now,
    };
    await ref.create(p);
    const expires = now + 30 * 60_000;
    const uploads: Record<string, string> = {};
    for (const [id, a] of Object.entries(assets)) {
      [uploads[id]] = await bucket().file(filePath(t, ref.id, id)).getSignedUrl({ version: "v4", action: "write", expires, contentType: a.type });
    }
    return res.json({ success: true, id: ref.id, code, uploads });
  } catch (e: any) { return oops(res, e); }
});

/** Все файлы на месте — презентацию можно показывать. */
router.post("/:tenantId/:id/finalize", ...guard, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const ref = col(t).doc(String(req.params.id));
    const snap = await ref.get();
    if (!snap.exists) return fail(res, 404, "Презентация не найдена");
    const p = { ...(snap.data() as Presentation), id: snap.id };
    if (!canManage(p, req.caller)) return fail(res, 403, "Нет прав на эту презентацию");
    const lost: string[] = [];
    await Promise.all(Object.entries(p.assets).map(async ([id, a]) => {
      const f = bucket().file(filePath(t, p.id, id));
      const [ok] = await f.exists();
      if (!ok) { lost.push(id); return; }
      const [meta] = await f.getMetadata();
      // Размер — тот, что объявлен при создании: подменить файл на другой нельзя.
      if (Number(meta.size) !== a.size) lost.push(id);
    }));
    if (lost.length) return fail(res, 409, `Не загрузились файлы: ${lost.length}. Попробуйте загрузить ещё раз`, { lost });
    await ref.update({ status: "ready", updatedAt: Date.now() });
    return res.json({ success: true });
  } catch (e: any) { return oops(res, e); }
});

router.put("/:tenantId/:id", ...guard, async (req: any, res: any) => {
  try {
    const ref = col(req.params.tenantId).doc(String(req.params.id));
    const snap = await ref.get();
    if (!snap.exists) return fail(res, 404, "Презентация не найдена");
    const p = { ...(snap.data() as Presentation), id: snap.id };
    if (!canManage(p, req.caller)) return fail(res, 403, "Менять доступ может тот, кто загрузил презентацию, или управляющий");
    const b = req.body || {};
    const patch: Partial<Presentation> = { updatedAt: Date.now() };
    if (b.title !== undefined) { const v = str(b.title, LIMITS.title); if (!v) return fail(res, 400, "Название не может быть пустым"); patch.title = v; }
    if (b.description !== undefined) patch.description = str(b.description, LIMITS.description);
    if (b.access !== undefined) {
      const access = sanitizeAccess(b.access);
      // Отмечать можно только сотрудников этой организации.
      if (access.people.length) {
        const staff = new Set((await listEmployees(req.params.tenantId)).map(e => e.uid));
        access.people = access.people.filter(u => staff.has(u));
      }
      patch.access = access;
    }
    await ref.update(patch);
    return res.json({ success: true, presentation: summary({ ...p, ...patch } as Presentation, req.caller) });
  } catch (e: any) { return oops(res, e); }
});

router.delete("/:tenantId/:id", ...guard, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const ref = col(t).doc(String(req.params.id));
    const snap = await ref.get();
    if (!snap.exists) return fail(res, 404, "Презентация не найдена");
    const p = { ...(snap.data() as Presentation), id: snap.id };
    if (!canManage(p, req.caller)) return fail(res, 403, "Удалить может тот, кто загрузил презентацию, или управляющий");
    await bucket().deleteFiles({ prefix: `presentations/${t}/${p.id}/` }).catch((e: any) => console.warn("[presentations] files", e?.message));
    await db().collection(LINKS).doc(p.code).delete();
    await ref.delete();
    return res.json({ success: true });
  } catch (e: any) { return oops(res, e); }
});

// ── Просмотр по ссылке ──────────────────────────────────────────────────

/** Вход не обязателен: токен проверяем, только если он прислан. */
const optionalAuth = async (req: any, _res: any, next: any) => {
  const token = String(req.headers.authorization || "").replace("Bearer ", "").trim();
  if (token) { try { req.user = await admin.auth().verifyIdToken(token); } catch { /* как без входа */ } }
  next();
};

router.get("/show/:code", optionalAuth, async (req: any, res: any) => {
  try {
    const code = String(req.params.code || "").toUpperCase();
    if (!PRESENTATION_CODE.test(code)) return fail(res, 404, "Презентация не найдена");
    const link = await db().collection(LINKS).doc(code).get();
    if (!link.exists) return fail(res, 404, "Презентация не найдена или удалена");
    const { tenantId: t, presentationId } = link.data() as { tenantId: string; presentationId: string };
    const gate = await checkTenantOpen(t, "presentations");
    if (!gate.ok && req.user?.isSuperadmin !== true) return fail(res, gate.status || 403, gate.error || "Недоступно");
    const snap = await col(t).doc(presentationId).get();
    if (!snap.exists) return fail(res, 404, "Презентация не найдена или удалена");
    const p = { ...(snap.data() as Presentation), id: snap.id };
    const c = await callerIn(t, req.user);
    const org = { name: str(gate.tenant?.name, 120), ...tenantLogos(gate.tenant) };
    if (!canView(p, c)) {
      // Без входа — просим войти; вошёл, но не пускаем — так и говорим.
      return c ? fail(res, 403, "У вас нет доступа к этой презентации. Попросите того, кто её загрузил, открыть доступ.", { org })
        : fail(res, 401, "Войдите, чтобы открыть презентацию", { needLogin: true, org });
    }
    if (p.status !== "ready") return fail(res, 409, "Презентация ещё загружается");
    res.set("Cache-Control", "private, no-store");
    return res.json({
      success: true, org,
      presentation: { title: p.title, description: p.description, kind: p.kind, slides: p.slides, faces: p.faces, code: p.code, accessMode: p.access.mode, tenantId: t },
      assets: await signedAssets(t, p),
      canManage: canManage(p, c),
    });
  } catch (e: any) { return oops(res, e); }
});

export default router;
