import { Router } from "express";
import admin from "firebase-admin";
import { randomBytes } from "crypto";
import { requireFirebaseAuth } from "./authRoutes.js";
import { hasPerm, staffCaller } from "../server/access.js";
import { dropMailCache, effectiveSender, sendMail, sendMailWith, tenantMailDoc } from "../server/mail.js";
import { RAW_LABEL, RAW_PERMS, isRawKind, resendRaw } from "../server/mailLog.js";
import { actorOf, writeAudit } from "../server/audit.js";
import { resolveWorkspaceConfig } from "../shared/workspaceConfig.js";
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

/** Шаблон этого типа правит тот, кто отвечает за его письма (или управляет настройками); «любое» — любой из допущенных. */
const canKind = (c: any, kind: string) => hasPerm(c, "settings:manage") || (kind in EVENT_PERMS ? hasPerm(c, ...EVENT_PERMS[kind as EmailEvent]) : true);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n);

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

// ── Отправитель: имя, ответы, подпись, свой ящик ───────────────────────

async function senderView(t: string) {
  const [tenant, doc, eff] = await Promise.all([db().collection("tenants").doc(t).get(), tenantMailDoc(t), effectiveSender(t)]);
  const email = resolveWorkspaceConfig(tenant.data()?.workspaceConfig).email;
  return {
    orgName: String(tenant.data()?.name || ""),
    fromName: email.fromName || "", replyTo: email.replyTo || "", signature: email.signature || "",
    mode: doc?.mode || "platform",
    custom: { azureTenant: doc?.azureTenant || "", clientId: doc?.clientId || "", sender: doc?.sender || "", hasSecret: !!doc?.clientSecret, verifiedAt: doc?.verifiedAt || 0, active: !!doc?.active },
    effective: eff,
  };
}

router.get("/:t/sender", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const a = await caller(req, res); if (!a) return;
    return res.json({ success: true, ...(await senderView(a.t)), canEdit: hasPerm(a.c, "settings:manage") });
  } catch (e) { console.error("[email-sender]", e); return fail(res, 500, "Не получилось загрузить"); }
});

router.put("/:t/sender", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const a = await caller(req, res); if (!a) return;
    if (!hasPerm(a.c, "settings:manage")) return fail(res, 403, "Нет прав менять отправителя");
    const b = req.body || {};
    const replyTo = clip(b.replyTo, 120);
    if (replyTo && !EMAIL_RE.test(replyTo)) return fail(res, 400, "Неверный адрес для ответов", { field: "replyTo" });
    const before = await senderView(a.t);
    const mode = b.mode === "custom" ? "custom" : "platform";
    const cu = b.custom || {};
    const prev = await tenantMailDoc(a.t);
    const next = {
      azureTenant: clip(cu.azureTenant, 100), clientId: clip(cu.clientId, 100), sender: clip(cu.sender, 120).toLowerCase(),
      clientSecret: cu.clientSecret ? String(cu.clientSecret).trim().slice(0, 300) : prev?.clientSecret || "",
    };
    if (mode === "custom") {
      if (!next.azureTenant || !next.clientId || !next.clientSecret) return fail(res, 400, "Заполните ключи Microsoft 365", { field: "custom" });
      if (!EMAIL_RE.test(next.sender)) return fail(res, 400, "Неверный адрес отправителя", { field: "sender" });
    }
    // Любое изменение ключей или адреса снимает проверку — до новой проверки письма идут с общего ящика.
    const same = !!prev && prev.azureTenant === next.azureTenant && prev.clientId === next.clientId && prev.sender === next.sender && prev.clientSecret === next.clientSecret;
    await db().collection("tenant_mail").doc(a.t).set({
      tenantId: a.t, mode, ...next, active: mode === "custom" && same && prev?.active === true, verifiedAt: same ? prev?.verifiedAt || 0 : 0, updatedAt: Date.now(), updatedBy: a.c.uid,
    });
    await db().collection("tenants").doc(a.t).set({ workspaceConfig: { email: { fromName: clip(b.fromName, 60), replyTo, signature: clip(b.signature, 300) } } }, { merge: true });
    dropMailCache(a.t);
    const after = await senderView(a.t);
    const changes = ([["Имя отправителя", before.fromName, after.fromName], ["Адрес для ответов", before.replyTo, after.replyTo], ["Подпись", before.signature, after.signature], ["Ящик", before.mode === "custom" ? before.custom.sender : "Общий", after.mode === "custom" ? after.custom.sender : "Общий"]] as [string, string, string][])
      .filter(([, x, y]) => x !== y).map(([label, from, to]) => ({ label, from, to }));
    if (changes.length) await writeAudit(db(), a.t, { actor: actorOf(req.user), action: "email.sender", section: "settings", detail: "Отправитель писем", changes });
    return res.json({ success: true, ...after });
  } catch (e) { console.error("[email-sender]", e); return fail(res, 500, "Не получилось сохранить"); }
});

const lastVerify = new Map<string, number>();
/** «Проверить»: пробное письмо себе через сохранённый ящик организации; удалось — ящик включается. */
router.post("/:t/sender/verify", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const a = await caller(req, res); if (!a) return;
    if (!hasPerm(a.c, "settings:manage")) return fail(res, 403, "Нет прав менять отправителя");
    const to = a.c.email;
    if (!to) return fail(res, 400, "У вашего аккаунта нет почты");
    if (Date.now() - (lastVerify.get(a.c.uid) || 0) < 10_000) return fail(res, 429, "Подождите немного");
    lastVerify.set(a.c.uid, Date.now());
    const d = await tenantMailDoc(a.t);
    if (!d || d.mode !== "custom" || !d.clientSecret) return fail(res, 400, "Сначала сохраните ключи своего ящика");
    const m = await orgMail(a.t);
    const r = await sendMailWith({ tenantId: d.azureTenant, clientId: d.clientId, clientSecret: d.clientSecret, sender: d.sender },
      { to, subject: "[Проверка] Подключение почты", html: `<p>Письма организации «${m.org.name.replace(/[<>&]/g, "")}» будут уходить с адреса ${d.sender.replace(/[<>&]/g, "")}.</p>`, fromName: m.fromName, replyTo: m.replyTo });
    await db().collection("tenant_mail").doc(a.t).set(r.sent ? { active: true, verifiedAt: Date.now() } : { active: false, verifiedAt: 0 }, { merge: true });
    dropMailCache(a.t);
    if (!r.sent) return fail(res, 502, r.reason || "Не отправилось");
    await writeAudit(db(), a.t, { actor: actorOf(req.user), action: "email.sender_verified", section: "integrations", detail: `Свой ящик ${d.sender} подключён` });
    return res.json({ success: true, to, ...(await senderView(a.t)) });
  } catch (e) { console.error("[email-sender] verify", e); return fail(res, 500, "Не получилось проверить"); }
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
  if (!canKind(a.c, tpl.kind)) return fail(res, 403, "Нет прав на шаблоны этого типа");
  const ref = db().collection("email_templates").doc(id);
  let cur: FirebaseFirestore.DocumentData | undefined;
  if (!create) {
    cur = (await ref.get()).data();
    if (!cur || cur.tenantId !== a.t) return fail(res, 404, "Шаблон не найден");
    if (!canKind(a.c, String(cur.kind || "any"))) return fail(res, 403, "Нет прав на шаблоны этого типа");
  }
  await ref.set({ ...tpl, tenantId: a.t, updatedAt: Date.now(), updatedBy: a.c.uid, ...(create ? { createdBy: a.c.uid, createdAt: Date.now() } : { createdBy: cur?.createdBy || "", createdAt: cur?.createdAt || 0 }) });
  await writeAudit(db(), a.t, { actor: actorOf(req.user), action: create ? "email.template_create" : "email.template_update", section: "settings", target: { kind: "email_template", id, name: tpl.name } });
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
    const cur = (await ref.get()).data();
    if (cur?.tenantId !== a.t) return fail(res, 404, "Шаблон не найден");
    if (!canKind(a.c, String(cur.kind || "any"))) return fail(res, 403, "Нет прав на шаблоны этого типа");
    const used = await usages(a.t, req.params.id);
    if (used.length && req.query.force !== "1") return fail(res, 409, "Шаблон выбран в настройках", { used });
    await ref.delete();
    await writeAudit(db(), a.t, { actor: actorOf(req.user), action: "email.template_delete", section: "settings", target: { kind: "email_template", id: req.params.id, name: String(cur.name || "") }, detail: used.length ? `Был выбран: ${used.join(", ")}` : undefined });
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
    const r = await sendMail({ to, subject: `[Проба] ${subject}`, html, fromName: m.fromName, replyTo: m.replyTo, tenantId: a.t });
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

/** Права на запись журнала: шаблонные события — по EVENT_PERMS, прочие — по RAW_PERMS. */
const permsOfRow = (event: string): PermissionKey[] | null =>
  event in EVENT_PERMS ? EVENT_PERMS[event as EmailEvent] : isRawKind(event) ? RAW_PERMS[event] : null;
const canSee = (c: any, event: string) => { const p = permsOfRow(event); return !!p && (hasPerm(c, "settings:manage") || hasPerm(c, ...p)); };

router.get("/:t/log", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const a = await caller(req, res); if (!a) return;
    const s = await db().collection("email_log").where("tenantId", "==", a.t).get();
    const log = s.docs.map(d => ({ d: d.id, x: d.data() })).filter(({ x }) => canSee(a.c, x.event)).map(({ d, x }) => {
      const raw = !!x.raw;
      return { id: d, event: x.event, to: x.to || "", status: x.status, reason: x.reason || "", at: x.at || 0, tries: x.tries || 1, subject: x.subject || "", templateId: x.templateId || "", label: x.ctx?.label || "", canResend: raw ? !!x.html : !!x.ctx && EVENTS.includes(x.event), actionUrl: x.actionUrl || "" };
    }).sort((x, y) => y.at - x.at).slice(0, 500);
    return res.json({ success: true, log, kinds: { ...RAW_LABEL } });
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
    const rawJobs: FirebaseFirestore.DocumentReference[] = [];
    const logIds = (Array.isArray(req.body?.logIds) ? req.body.logIds : req.body?.logId ? [req.body.logId] : []).map(String).filter((x: string) => /^[A-Za-z0-9_-]{1,300}$/.test(x)).slice(0, 100);
    const results: (SendResult & { ctx: EmailCtx })[] = [];
    if (logIds.length) {
      const snaps = await db().getAll(...logIds.map((id: string) => db().collection("email_log").doc(id)));
      for (const d of snaps) {
        const x = d.data();
        if (!x || x.tenantId !== t) continue;
        // Без прав на это письмо — пропускаем только его, остальные уходят.
        if (!canSee(c, x.event)) { results.push({ sent: false, reason: "Нет прав на это письмо", ctx: {} }); continue; }
        if (x.raw) rawJobs.push(d.ref);
        else if (EVENTS.includes(x.event) && x.ctx) jobs.push({ event: x.event, ctx: cleanCtx(x.ctx) });
      }
    } else if (EVENTS.includes(req.body?.event)) {
      const event = req.body.event as EmailEvent;
      if (!hasPerm(c, ...EVENT_PERMS[event])) return fail(res, 403, "Нет прав переотправлять эти письма");
      const ids = Array.isArray(req.body?.submissionIds) ? req.body.submissionIds.map(String).filter((x: string) => SAFE_ID.test(x)).slice(0, 100) : null;
      if (event === "form" && ids) ids.forEach((submissionId: string) => jobs.push({ event, ctx: { submissionId } }));
      else jobs.push({ event, ctx: cleanCtx(req.body.ctx) });
    }
    if (!jobs.length && !rawJobs.length) return results.length ? fail(res, 403, "Нет прав переотправлять эти письма") : fail(res, 400, "Нечего отправлять");
    if (!logIds.length) for (const j of jobs) if (!hasPerm(c, ...EVENT_PERMS[j.event])) return fail(res, 403, "Нет прав переотправлять эти письма");
    for (const j of jobs) {
      const key = `${t}_${j.event}_${j.ctx.applicantId || ""}_${j.ctx.attemptId || ""}_${j.ctx.submissionId || ""}`;
      if (Date.now() - (lastResend.get(key) || 0) < 15_000) { results.push({ sent: false, reason: "Только что отправлялось — подождите", ctx: j.ctx }); continue; }
      lastResend.set(key, Date.now());
      results.push({ ...(await resend(t, j.event, j.ctx, c.uid)), ctx: j.ctx });
    }
    for (const ref of rawJobs) {
      const key = `${t}_raw_${ref.id}`;
      if (Date.now() - (lastResend.get(key) || 0) < 15_000) { results.push({ sent: false, reason: "Только что отправлялось — подождите", ctx: {} }); continue; }
      lastResend.set(key, Date.now());
      results.push({ ...(await resendRaw(ref, t, c.uid)), ctx: {} });
    }
    const sent = results.filter(r => r.sent).length;
    if (results.length === 1 && !sent) return fail(res, 400, results[0].reason || "Не отправилось", { results });
    return res.json({ success: true, sent, failed: results.length - sent, results });
  } catch (e) { console.error("[email-resend]", e); return fail(res, 500, "Не получилось отправить"); }
});

export default router;
