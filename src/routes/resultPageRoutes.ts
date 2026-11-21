import { Router } from "express";
import admin from "firebase-admin";
import { randomBytes } from "crypto";
import { requireFirebaseAuth } from "./authRoutes.js";
import { hasPerm, staffCaller } from "../server/access.js";
import { actorOf, writeAudit } from "../server/audit.js";
import { appUrl } from "../server/emailEvents.js";
import { loadCandidateForm } from "./admissionRoutes.js";
import { loadPage, pageDoc, readUrl, resultBucket, signVariant } from "../server/resultPages.js";
import { resolveDecisions } from "../shared/formDecisions.js";
import { MEDIA_UPLOAD, presetVariant, blankVariant, sanitizeResultPage, DEFAULT_VARIANT_KEY, PRESETS } from "../shared/resultPages.js";

/**
 * /api/result-pages — страницы результатов организации (tenants/{t}/result_pages).
 * Документы пишет только сервер. Видео и картинки идут в бакет напрямую по
 * подписанной ссылке (у сервера лимит тела запроса — 4,5 МБ).
 *
 * Права: admission:manage, tests:manage или settings:manage. Каждое действие — в журнал.
 */
const router = Router();
const db = () => admin.firestore();
const TENANT = /^[A-Za-z0-9_-]{2,80}$/;
const ID = /^[A-Za-z0-9_-]{4,64}$/;
const PERMS = ["admission:manage", "tests:manage", "settings:manage"] as const;
const fail = (res: any, status: number, error: string, extra: object = {}) => res.status(status).json({ success: false, error, ...extra });
const oops = (res: any, e: any) => { console.error("[result-pages]", e?.message || e); return fail(res, 500, "Не получилось — попробуйте ещё раз"); };

async function caller(req: any, res: any) {
  const t = String(req.params.t || "");
  if (!TENANT.test(t)) { fail(res, 400, "Неверная организация"); return null; }
  const c = await staffCaller(db(), t, req.user);
  if (!c || !hasPerm(c, ...PERMS)) { fail(res, 403, "Нет доступа"); return null; }
  return { t, c };
}

/** Исходы страницы: решения анкеты кандидата и состояния форм заявок организации. */
const outcomeIds = async (t: string) => {
  const forms = await db().collection("custom_forms").where("tenantId", "==", t).get();
  const formIds = forms.docs.flatMap(d => resolveDecisions(d.data()).map(x => x.id));
  return [...new Set([...(await loadCandidateForm(t)).decisions.map(d => d.id), ...formIds])];
};

/** Экзамены организации, где страница выбрана. */
async function usages(t: string, id: string): Promise<string[]> {
  const exams = await db().collection("tenants").doc(t).collection("exams").get();
  const forms = await db().collection("custom_forms").where("tenantId", "==", t).get();
  return [
    ...exams.docs.filter(d => d.data().settings?.results?.pageId === id).map(d => `Экзамен «${d.data().title || d.id}»`),
    ...forms.docs.filter(d => resolveDecisions(d.data()).some(x => x.notify.pageId === id)).map(d => `Форма «${d.data().title || d.id}»`),
  ];
}

/** Исходы организации — решения анкеты кандидата, для вкладок редактора. */
router.get("/:t/outcomes", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const a = await caller(req, res); if (!a) return;
    const f = await loadCandidateForm(a.t);
    return res.json({ success: true, outcomes: f.decisions.map(d => ({ id: d.id, label: d.label, final: d.final, trial: !!d.trial })) });
  } catch (e) { return oops(res, e); }
});

/** Список страниц (без содержимого) и готовые шаблоны (id и названия). */
router.get("/:t", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const a = await caller(req, res); if (!a) return;
    const s = await db().collection("tenants").doc(a.t).collection("result_pages").get();
    const pages = s.docs.map(d => ({ id: d.id, name: String(d.data().name || ""), updatedAt: Number(d.data().updatedAt || 0), outcomes: Object.keys(d.data().variants || {}) }))
      .sort((x, y) => x.name.localeCompare(y.name, "ru"));
    return res.json({ success: true, pages, presets: PRESETS.map(p => ({ id: p.id, name: p.name })) });
  } catch (e) { return oops(res, e); }
});

/** Страница целиком: загруженные файлы — с подписанными ссылками на чтение. */
router.get("/:t/:id", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const a = await caller(req, res); if (!a) return;
    const p = await loadPage(a.t, req.params.id);
    if (!p) return fail(res, 404, "Страница не найдена");
    const variants = Object.fromEntries(await Promise.all(Object.entries(p.variants).map(async ([k, v]) => [k, await signVariant(v)] as const)));
    return res.json({ success: true, page: { ...p, variants } });
  } catch (e) { return oops(res, e); }
});

/** Создать: из готового шаблона (presetId), из присланного содержимого или пустую. */
router.post("/:t", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const a = await caller(req, res); if (!a) return;
    const b = req.body || {};
    const preset = b.presetId ? PRESETS.find(p => p.id === b.presetId) : null;
    if (b.presetId && !preset) return fail(res, 400, "Нет такого шаблона");
    const outcomes = await outcomeIds(a.t);
    const base = preset ? { name: preset.name, variants: { [DEFAULT_VARIANT_KEY]: presetVariant(preset.id)! } } : b.variants ? b : { name: "", variants: { [DEFAULT_VARIANT_KEY]: blankVariant() } };
    const clean = sanitizeResultPage({ ...base, name: b.name || base.name }, outcomes, a.t);
    if (!clean.name) return fail(res, 400, "Назовите страницу");
    const id = `rp_${randomBytes(9).toString("base64url")}`;
    const now = Date.now();
    await pageDoc(a.t, id).set({ ...clean, id, createdAt: now, createdBy: a.c.uid, updatedAt: now, updatedBy: a.c.uid });
    await writeAudit(db(), a.t, { actor: actorOf(req.user), action: "result_page.create", section: "settings", target: { kind: "result_page", id, name: clean.name }, detail: preset ? `Из шаблона «${preset.name}»` : undefined });
    return res.json({ success: true, id });
  } catch (e) { return oops(res, e); }
});

router.put("/:t/:id", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const a = await caller(req, res); if (!a) return;
    if (!ID.test(req.params.id)) return fail(res, 400, "Неверная страница");
    const ref = pageDoc(a.t, req.params.id);
    const cur = (await ref.get()).data();
    if (!cur) return fail(res, 404, "Страница не найдена");
    const clean = sanitizeResultPage(req.body, await outcomeIds(a.t), a.t);
    if (!clean.name) return fail(res, 400, "Назовите страницу");
    await ref.set({ ...clean, id: req.params.id, createdAt: cur.createdAt || 0, createdBy: cur.createdBy || "", updatedAt: Date.now(), updatedBy: a.c.uid });
    await writeAudit(db(), a.t, { actor: actorOf(req.user), action: "result_page.update", section: "settings", target: { kind: "result_page", id: req.params.id, name: clean.name }, ...(cur.name !== clean.name ? { changes: [{ label: "Название", from: String(cur.name || ""), to: clean.name }] } : {}) });
    return res.json({ success: true, id: req.params.id });
  } catch (e) { return oops(res, e); }
});

router.delete("/:t/:id", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const a = await caller(req, res); if (!a) return;
    if (!ID.test(req.params.id)) return fail(res, 400, "Неверная страница");
    const ref = pageDoc(a.t, req.params.id);
    const cur = (await ref.get()).data();
    if (!cur) return fail(res, 404, "Страница не найдена");
    const used = await usages(a.t, req.params.id);
    if (used.length) return fail(res, 409, "Страница выбрана в настройках", { used });
    await ref.delete();
    await writeAudit(db(), a.t, { actor: actorOf(req.user), action: "result_page.delete", section: "settings", target: { kind: "result_page", id: req.params.id, name: String(cur.name || "") } });
    return res.json({ success: true });
  } catch (e) { return oops(res, e); }
});

// ── Загрузка видео и картинок ───────────────────────────────────────────

let corsReady: Promise<void> | null = null;
/** Один раз: бакет принимает PUT с домена сайта (дописывается к существующим правилам, лишнее не трогаем). */
function ensureBucketCors(): Promise<void> {
  if (corsReady) return corsReady;
  corsReady = (async () => {
    const bucket = resultBucket();
    const [meta] = await bucket.getMetadata();
    const cors: any[] = Array.isArray(meta?.cors) ? meta.cors : [];
    const MARK = "x-goog-content-length-range";
    if (cors.some(r => (r.responseHeader || []).includes(MARK))) return;
    const origin = [...new Set([await appUrl(), "http://localhost:5173", "http://localhost:3000"])];
    // Хранилище берёт первое подходящее правило — заголовок нужен и в уже существующих.
    const patched = cors.map(r => ({ ...r, responseHeader: [...new Set([...(r.responseHeader || []), "Content-Type", MARK])] }));
    await bucket.setCorsConfiguration([...patched, { origin, method: ["PUT", "GET", "HEAD"], responseHeader: ["Content-Type", MARK], maxAgeSeconds: 3600 }]);
  })().catch(e => { console.error("[result-pages] cors:", e?.message || e); corsReady = null; });
  return corsReady;
}

/**
 * Подписанная ссылка на загрузку файла прямо в бакет. Клиент делает PUT на
 * uploadUrl с заголовками headers (Content-Type и ограничение размера), затем
 * кладёт path в MediaRef {source:"upload", path}. readUrl — ссылка для предпросмотра.
 */
router.post("/:t/upload-url", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const a = await caller(req, res); if (!a) return;
    const type = String(req.body?.contentType || "");
    const size = Number(req.body?.size);
    if (!(MEDIA_UPLOAD.types as readonly string[]).includes(type)) return fail(res, 400, "Нужен файл MP4, WebM, JPEG или PNG");
    if (!Number.isFinite(size) || size <= 0) return fail(res, 400, "Неверный размер файла");
    if (size > MEDIA_UPLOAD.maxBytes) return fail(res, 413, "Файл больше 100 МБ");
    await ensureBucketCors();
    const path = `result_media/${a.t}/${randomBytes(18).toString("base64url")}.${MEDIA_UPLOAD.ext[type]}`;
    const range = `0,${MEDIA_UPLOAD.maxBytes}`;
    const [uploadUrl] = await resultBucket().file(path).getSignedUrl({
      version: "v4", action: "write", expires: Date.now() + 15 * 60 * 1000, contentType: type, extensionHeaders: { "x-goog-content-length-range": range },
    });
    await writeAudit(db(), a.t, { actor: actorOf(req.user), action: "result_page.upload", section: "settings", target: { kind: "result_media", id: path }, detail: `${type}, ${Math.round(size / 1024)} КБ` });
    return res.json({ success: true, uploadUrl, path, headers: { "Content-Type": type, "x-goog-content-length-range": range }, readUrl: await readUrl(path) });
  } catch (e) { return oops(res, e); }
});

export default router;
