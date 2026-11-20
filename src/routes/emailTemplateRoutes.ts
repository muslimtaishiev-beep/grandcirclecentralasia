import { Router } from "express";
import admin from "firebase-admin";
import { randomBytes } from "crypto";
import { requireFirebaseAuth } from "./authRoutes.js";
import { hasPerm, staffCaller } from "../server/access.js";
import { sendMail } from "../server/mail.js";
import { EVENT_PERMS, appUrl, orgMail, resend, type SendResult } from "../server/emailEvents.js";
import { EMAIL_EVENTS, EMAIL_IMG_PREFIX, renderEmail, sampleVars, sanitizeEmailTemplate, varsFor, type EmailCtx, type EmailEvent } from "../shared/emailTemplate.js";
import type { PermissionKey } from "../shared/permissions.js";

/**
 * /api/email-templates — шаблоны писем организации.
 *
 * Документы email_templates пишет только сервер. Картинки (логотип, фото)
 * лежат в закрытом бакете под случайными именами, а письма ссылаются на
 * /api/email-templates/img/… — этот адрес отдаёт файл без входа, иначе
 * картинка в почте не откроется.
 */
const router = Router();
const db = () => admin.firestore();
const BUCKET = process.env.FIREBASE_STORAGE_BUCKET || "study-64ebf.firebasestorage.app";
const bucket = () => admin.storage().bucket(BUCKET);
const TENANT = /^[A-Za-z0-9_-]{2,80}$/;
const ID = /^[A-Za-z0-9_-]{4,64}$/;
const FILE = /^[A-Za-z0-9_-]{20,40}\.jpg$/;
/** Кто собирает и выбирает шаблоны: те, у кого есть что слать. */
const EMAIL_PERMS: PermissionKey[] = ["settings:manage", "team:manage", "admission:manage", "tests:manage", "crm:manage", "certificates:issue"];
const fail = (res: any, status: number, error: string, extra: object = {}) => res.status(status).json({ success: false, error, ...extra });

async function caller(req: any, res: any) {
  const t = String(req.params.t || "");
  if (!TENANT.test(t)) { fail(res, 400, "Неверная организация"); return null; }
  const c = await staffCaller(db(), t, req.user);
  if (!hasPerm(c, ...EMAIL_PERMS)) { fail(res, 403, "Нет доступа"); return null; }
  return { t, c: c! };
}

/** Картинка для письма: публично, по случайному имени. */
router.get("/img/:t/:file", async (req: any, res: any) => {
  const { t, file } = req.params;
  if (!TENANT.test(t) || !FILE.test(file)) return res.status(404).end();
  try {
    const [buf] = await bucket().file(`email_assets/${t}/${file}`).download();
    res.set({ "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" });
    return res.send(buf);
  } catch { return res.status(404).end(); }
});

router.get("/:t", requireFirebaseAuth, async (req: any, res: any) => {
  const a = await caller(req, res); if (!a) return;
  const s = await db().collection("email_templates").where("tenantId", "==", a.t).get();
  const templates = s.docs.map(d => ({ ...sanitizeEmailTemplate(d.data()), id: d.id, updatedAt: d.data().updatedAt || 0 }))
    .sort((x, y) => x.name.localeCompare(y.name, "ru"));
  const m = await orgMail(a.t);
  return res.json({ success: true, templates, org: m.org, fromName: m.fromName });
});

async function save(req: any, res: any, id: string, create: boolean) {
  const a = await caller(req, res); if (!a) return;
  const tpl = sanitizeEmailTemplate(req.body);
  if (!tpl.name) return fail(res, 400, "Назовите шаблон");
  if (!tpl.subject) return fail(res, 400, "Укажите тему письма");
  const ref = db().collection("email_templates").doc(id);
  if (!create) {
    const cur = (await ref.get()).data();
    if (!cur || cur.tenantId !== a.t) return fail(res, 404, "Шаблон не найден");
  }
  await ref.set({ ...tpl, tenantId: a.t, updatedAt: Date.now(), updatedBy: a.c.uid, ...(create ? { createdBy: a.c.uid, createdAt: Date.now() } : {}) });
  return res.json({ success: true, id });
}

router.post("/:t", requireFirebaseAuth, (req: any, res: any) => save(req, res, `et_${randomBytes(9).toString("base64url")}`, true).catch(e => { console.error("[email-templates]", e); fail(res, 500, "Не получилось сохранить"); }));
router.put("/:t/:id", requireFirebaseAuth, (req: any, res: any) => {
  if (!ID.test(req.params.id)) return fail(res, 400, "Неверный шаблон");
  return save(req, res, req.params.id, false).catch(e => { console.error("[email-templates]", e); fail(res, 500, "Не получилось сохранить"); });
});

/** Где шаблон выбран: экзамены и формы организации. */
async function usages(t: string, id: string): Promise<string[]> {
  const [exams, forms] = await Promise.all([
    db().collection("tenants").doc(t).collection("exams").get(),
    db().collection("custom_forms").where("tenantId", "==", t).where("emailTemplateId", "==", id).get(),
  ]);
  const out: string[] = [];
  for (const d of exams.docs) {
    const s = d.data().settings || {};
    if (s.admission?.referralEmail === id || s.results?.emailTemplate === id) out.push(`Экзамен «${d.data().title || d.id}»`);
  }
  for (const d of forms.docs) out.push(`Форма «${d.data().title || d.id}»`);
  return out;
}

router.delete("/:t/:id", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const a = await caller(req, res); if (!a) return;
    if (!ID.test(req.params.id)) return fail(res, 400, "Неверный шаблон");
    const ref = db().collection("email_templates").doc(req.params.id);
    if ((await ref.get()).data()?.tenantId !== a.t) return fail(res, 404, "Шаблон не найден");
    const used = await usages(a.t, req.params.id);
    if (used.length && req.query.force !== "1") return fail(res, 409, "Шаблон выбран в настройках", { used });
    await ref.delete();
    return res.json({ success: true });
  } catch (e) { console.error("[email-templates]", e); return fail(res, 500, "Не получилось удалить"); }
});

/** Картинка: JPEG, сжатый в браузере (data URL), до 1.5 МБ. */
router.post("/:t/image", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const a = await caller(req, res); if (!a) return;
    const m = String(req.body?.dataUrl || "").match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return fail(res, 400, "Нужна картинка JPEG");
    const buf = Buffer.from(m[1], "base64");
    if (buf.length > 1_500_000) return fail(res, 413, "Картинка слишком большая");
    if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return fail(res, 400, "Нужна картинка JPEG");
    const name = `${randomBytes(18).toString("base64url")}.jpg`;
    await bucket().file(`email_assets/${a.t}/${name}`).save(buf, { contentType: "image/jpeg", resumable: false, metadata: { cacheControl: "public, max-age=31536000" } });
    return res.json({ success: true, url: `${EMAIL_IMG_PREFIX}${a.t}/${name}` });
  } catch (e) { console.error("[email-templates] image", e); return fail(res, 500, "Не получилось загрузить"); }
});

const lastTest = new Map<string, number>();
/** Пробное письмо себе — с примерами вместо подстановок. Шаблон берётся из формы, ещё не сохранённым. */
router.post("/:t/test", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const a = await caller(req, res); if (!a) return;
    const to = a.c.email;
    if (!to) return fail(res, 400, "У вашего аккаунта нет почты");
    if (Date.now() - (lastTest.get(a.c.uid) || 0) < 15_000) return fail(res, 429, "Подождите немного");
    lastTest.set(a.c.uid, Date.now());
    const tpl = sanitizeEmailTemplate(req.body);
    const [m, base] = await Promise.all([orgMail(a.t), appUrl()]);
    const ok = new Set(varsFor(tpl.kind).map(v => v.key));
    const vars = Object.fromEntries(Object.entries(sampleVars()).filter(([k]) => ok.has(k)));
    const { subject, html } = renderEmail(tpl, { ...vars, организация: m.org.name }, m.org, base);
    const r = await sendMail({ to, subject: `[Проба] ${subject}`, html, fromName: m.fromName, replyTo: m.replyTo });
    if (!r.sent) return fail(res, 502, r.reason || "Не отправилось");
    return res.json({ success: true, to });
  } catch (e) { console.error("[email-templates] test", e); return fail(res, 500, "Не получилось отправить"); }
});

// ── Журнал отправок и переотправка ─────────────────────────────────────

const EVENTS: EmailEvent[] = EMAIL_EVENTS;
const SAFE_ID = /^[A-Za-z0-9_-]{1,120}$/;
const cleanCtx = (raw: any): EmailCtx => {
  const out: EmailCtx = {};
  for (const k of ["applicantId", "attemptId", "examId", "submissionId", "formId"] as const) if (SAFE_ID.test(String(raw?.[k] || ""))) out[k] = String(raw[k]);
  return out;
};

router.get("/:t/log", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const a = await caller(req, res); if (!a) return;
    const s = await db().collection("email_log").where("tenantId", "==", a.t).get();
    const log = s.docs.map(d => {
      const x = d.data();
      return { id: d.id, event: x.event, to: x.to || "", status: x.status, reason: x.reason || "", at: x.at || 0, tries: x.tries || 1, subject: x.subject || "", templateId: x.templateId || "", label: x.ctx?.label || "", canResend: !!x.ctx && EVENTS.includes(x.event), actionUrl: x.actionUrl || "" };
    }).sort((x, y) => y.at - x.at).slice(0, 500);
    return res.json({ success: true, log });
  } catch (e) { console.error("[email-log]", e); return fail(res, 500, "Не получилось загрузить журнал"); }
});

const lastResend = new Map<string, number>();
/**
 * Переотправить: по записям журнала (logIds), по событию (event + ctx) или
 * пачкой заявок формы (event: "form", submissionIds). Письмо собирается
 * заново из свежих данных — исправленная почта подхватится.
 */
router.post("/:t/resend", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const t = String(req.params.t || "");
    if (!TENANT.test(t)) return fail(res, 400, "Неверная организация");
    const c = await staffCaller(db(), t, req.user);
    if (!c?.member) return fail(res, 403, "Нет доступа");
    const jobs: { event: EmailEvent; ctx: EmailCtx }[] = [];
    const logIds = (Array.isArray(req.body?.logIds) ? req.body.logIds : req.body?.logId ? [req.body.logId] : []).map(String).filter((x: string) => /^[A-Za-z0-9_-]{1,300}$/.test(x)).slice(0, 100);
    if (logIds.length) {
      const snaps = await db().getAll(...logIds.map((id: string) => db().collection("email_log").doc(id)));
      for (const d of snaps) { const x = d.data(); if (x && x.tenantId === t && EVENTS.includes(x.event) && x.ctx) jobs.push({ event: x.event, ctx: cleanCtx(x.ctx) }); }
    } else if (EVENTS.includes(req.body?.event)) {
      const event = req.body.event as EmailEvent;
      const ids = Array.isArray(req.body?.submissionIds) ? req.body.submissionIds.map(String).filter((x: string) => SAFE_ID.test(x)).slice(0, 100) : null;
      if (event === "form" && ids) ids.forEach((submissionId: string) => jobs.push({ event, ctx: { submissionId } }));
      else jobs.push({ event, ctx: cleanCtx(req.body.ctx) });
    }
    if (!jobs.length) return fail(res, 400, "Нечего отправлять");
    for (const j of jobs) if (!hasPerm(c, ...EVENT_PERMS[j.event])) return fail(res, 403, "Нет прав переотправлять эти письма");
    const results: (SendResult & { ctx: EmailCtx })[] = [];
    for (const j of jobs) {
      const key = `${t}_${j.event}_${j.ctx.applicantId || ""}_${j.ctx.attemptId || ""}_${j.ctx.submissionId || ""}`;
      if (Date.now() - (lastResend.get(key) || 0) < 15_000) { results.push({ sent: false, reason: "Только что отправлялось — подождите", ctx: j.ctx }); continue; }
      lastResend.set(key, Date.now());
      results.push({ ...(await resend(t, j.event, j.ctx, c.uid)), ctx: j.ctx });
    }
    const sent = results.filter(r => r.sent).length;
    if (jobs.length === 1 && !sent) return fail(res, 400, results[0].reason || "Не отправилось", { results });
    return res.json({ success: true, sent, failed: results.length - sent, results });
  } catch (e) { console.error("[email-resend]", e); return fail(res, 500, "Не получилось отправить"); }
});

export default router;
