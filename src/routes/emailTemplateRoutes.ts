import { Router } from "express";
import admin from "firebase-admin";
import { randomBytes } from "crypto";
import { requireFirebaseAuth } from "./authRoutes.js";
import { hasPerm, staffCaller } from "../server/access.js";
import { sendMail } from "../server/mail.js";
import { appUrl, orgMail } from "../server/emailEvents.js";
import { EMAIL_IMG_PREFIX, renderEmail, sampleVars, sanitizeEmailTemplate } from "../shared/emailTemplate.js";
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
    const { subject, html } = renderEmail(tpl, { ...sampleVars(), организация: m.org.name }, m.org, base);
    const r = await sendMail({ to, subject: `[Проба] ${subject}`, html, fromName: m.fromName, replyTo: m.replyTo });
    if (!r.sent) return fail(res, 502, r.reason || "Не отправилось");
    return res.json({ success: true, to });
  } catch (e) { console.error("[email-templates] test", e); return fail(res, 500, "Не получилось отправить"); }
});

export default router;
