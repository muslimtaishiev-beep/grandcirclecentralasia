import { Router } from "express";
import admin from "firebase-admin";
import { randomBytes } from "crypto";
import { requireFirebaseAuth } from "./authRoutes.js";
import { hasPerm, optionalAuth, requirePerm, staffCaller, type StaffCaller } from "../server/access.js";
import { checkTenantOpen, requireScreen } from "../server/tenantAccess.js";
import { tenantLogos } from "../shared/legal.js";
import { LEGAL_VERSION } from "../shared/legalDocs.js";
import { DECISION_LABEL, partResults, sanitizeSettings, type Decision, type Exam } from "../shared/examRun.js";
import { DEFAULT_TEMPLATES } from "../shared/admissionTemplates.js";
import {
  gradeOf, missingFor, outcomeOf, sanitizeAnswers, sanitizeTemplate,
  type QAnswers, type QBind, type QTemplate,
} from "../shared/questionnaires.js";
import {
  admittedByStages, examForApplicant, stageOf,
  type Applicant, type ApplicantForm, type LinkPurpose, type StageSummary,
} from "../shared/admissions.js";
import type { PermissionKey } from "../shared/permissions.js";

/**
 * «Поступающие»: карточки, анкеты (родителя и сотрудников), направления на
 * тест по QR, бумажные результаты, решение.
 *
 * Права:
 * - кто видит экран и карточки — admission:manage / psych:conduct / psych:view;
 * - кто заполняет анкету и кто видит её целиком — задаёт сам шаблон
 *   (fillPermission / viewPermission); без права — только итог;
 * - всё режется здесь, на сервере; в браузер чужое содержимое не уходит.
 *
 * QR: у каждой ссылки своя цель — родитель (только его анкета), направление
 * (ученику — только тест), карточка (только сотрудникам). Сотрудник,
 * отсканировавший любую из них, попадает в карточку на свою вкладку.
 */
const router = Router();
const db = () => admin.firestore();
const col = (t: string, name: string) => db().collection("tenants").doc(t).collection(name);
const LINKS = "applicant_links";
const str = (v: unknown, max = 200) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const fail = (res: any, status: number, error: string, extra: object = {}) => res.status(status).json({ success: false, error, ...extra });
const oops = (res: any, e: any) => { console.error("[admissions]", e?.message || e); return fail(res, 500, "Не получилось — попробуйте ещё раз"); };
const newToken = () => randomBytes(24).toString("base64url");
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const deep = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

const ANY: PermissionKey[] = ["admission:manage", "psych:conduct", "psych:view"];
const staff = [requireFirebaseAuth, requireScreen("admissions", (req: any) => req.params.tenantId), requirePerm(db, ...ANY)];
const auth = optionalAuth(t => admin.auth().verifyIdToken(t));

// ── Права на анкеты ─────────────────────────────────────────────────────

/** Заполнять: анкету родителя за него — приёмная и психолог; анкету сотрудника — по праву шаблона. */
const canFill = (c: StaffCaller, t: QTemplate) =>
  t.audience === "parent" ? hasPerm(c, "admission:manage", "psych:conduct") : t.fillPermission ? hasPerm(c, t.fillPermission) : hasPerm(c, "admission:manage");
/** Видеть содержимое целиком. */
const canSee = (c: StaffCaller, t: QTemplate) => !t.sensitive || canFill(c, t) || (!!t.viewPermission && hasPerm(c, t.viewPermission));
/** Править шаблон: владелец, настройки, приёмная — или тот, кто по нему работает (психолог правит нормы). */
const canEditTemplate = (c: StaffCaller, t?: QTemplate) =>
  hasPerm(c, "settings:manage", "admission:manage") || (!!t?.fillPermission && hasPerm(c, t.fillPermission));

// ── Данные ──────────────────────────────────────────────────────────────

/** Анкеты организации; при первом обращении — готовые шаблоны АБЛ. */
async function loadTemplates(t: string): Promise<QTemplate[]> {
  const snap = await col(t, "questionnaire_templates").get();
  if (!snap.empty) return snap.docs.map(d => ({ ...(d.data() as QTemplate), id: d.id }));
  const made = DEFAULT_TEMPLATES.map(x => sanitizeTemplate(deep(x)));
  await Promise.all(made.map(x => col(t, "questionnaire_templates").doc(x.id).create(x).catch((e: any) => { if (e?.code !== 6) throw e; })));
  return made;
}
const byId = (ts: QTemplate[]) => Object.fromEntries(ts.map(x => [x.id, x]));

async function loadApplicant(t: string, id: string): Promise<Applicant | null> {
  if (!ID.test(id)) return null;
  const s = await col(t, "applicants").doc(id).get();
  return s.exists ? ({ ...(s.data() as any), id: s.id }) : null;
}

async function audit(t: string, applicantId: string, c: StaffCaller | null, action: string, detail = "") {
  await col(t, "applicant_audit").add({ applicantId, action, detail: str(detail, 300), by: c?.uid || "parent", byName: c?.name || "Родитель", at: Date.now() }).catch(() => {});
}

/** Сквозной номер поступающего — счётчик в транзакции, без дублей. */
async function nextRefNo(t: string): Promise<number> {
  const ref = col(t, "admission_meta").doc("counter");
  return db().runTransaction(async tx => {
    const s = await tx.get(ref);
    const n = Number(s.data()?.next) || 1;
    tx.set(ref, { next: n + 1 }, { merge: true });
    return n;
  });
}

async function makeLink(t: string, applicantId: string, purpose: LinkPurpose): Promise<string> {
  const token = newToken();
  await db().collection(LINKS).doc(token).create({ tenantId: t, applicantId, purpose, createdAt: Date.now() });
  return token;
}

/** Ответы, привязанные к карточке, заполняют её пустые поля. */
function bindToCard(a: Applicant, tpl: QTemplate, answers: QAnswers, overwrite: boolean): Partial<Applicant> {
  const patch: any = { child: { ...a.child }, parent: { ...a.parent } };
  const set = (b: QBind, v: string) => {
    const [k, f] = b.split(".") as ["child" | "parent", string];
    if (v && (overwrite || !patch[k][f])) patch[k][f] = v;
  };
  for (const i of tpl.sections.flatMap(s => s.items)) if (i.bind) set(i.bind, str(answers[i.id]?.value, 120));
  return patch;
}

async function tenantExams(t: string): Promise<Exam[]> {
  const snap = await col(t, "exams").get();
  return snap.docs.map(d => ({ ...(d.data() as Exam), id: d.id, settings: sanitizeSettings(d.data().settings) }));
}

/** Токен QR направления — один на ребёнка: напечатанный QR живёт, даже если экзамен сменился. */
async function referralTokenFor(t: string, a: Applicant): Promise<string> {
  if (a.tokens?.referral) return a.tokens.referral;
  const token = await makeLink(t, a.id, "referral");
  await col(t, "applicants").doc(a.id).update({ "tokens.referral": token });
  return token;
}

/**
 * Направление по итогам анкет: есть подходящий экзамен — выдаём (или
 * переводим на него), итог больше не пускает — снимаем автоматическое
 * (ручное, выданное администратором, не трогаем). Если тест уже начат —
 * ничего не меняем.
 */
export async function syncReferral(t: string, a: Applicant, templates?: QTemplate[], exams?: Exam[]): Promise<Applicant["referral"]> {
  const started = await col(t, "exam_attempts").where("applicantId", "==", a.id).limit(1).get();
  if (!started.empty) return a.referral;
  // Направление есть, если итог пускает (или допустила администрация). Какой
  // тест — система подбирает по классу; экзамена ещё нет — направление всё
  // равно выдано, тест подставится, когда его откроют для этого класса.
  const override = !!a.referral?.manual;
  if (!override && !admittedByStages(a)) {
    if (a.referral) await col(t, "applicants").doc(a.id).update({ referral: null, updatedAt: Date.now() });
    return null;
  }
  const exam = examForApplicant(exams || await tenantExams(t), a, byId(templates || await loadTemplates(t)), override);
  const want = { examId: exam?.id || null, examTitle: exam?.title || "", examCode: exam?.code || null };
  if (a.referral && a.referral.examId === want.examId && a.referral.examTitle === want.examTitle) return a.referral;
  await referralTokenFor(t, a);
  const referral = {
    ...want, issuedAt: a.referral?.issuedAt || Date.now(),
    by: a.referral?.by || "auto", byName: a.referral?.byName || "По заключению", manual: override, reason: a.referral?.reason || "",
  };
  await col(t, "applicants").doc(a.id).update({ referral, updatedAt: Date.now() });
  return referral;
}

/** Экзамен сохранили (поменяли классы или этапы) — подставить тест всем, кто его ждёт. */
export async function syncAllReferrals(t: string) {
  const [snap, templates, exams] = await Promise.all([col(t, "applicants").get(), loadTemplates(t), tenantExams(t)]);
  for (const d of snap.docs) {
    const a = { ...(d.data() as Applicant), id: d.id };
    if (a.referral || admittedByStages(a)) await syncReferral(t, a, templates, exams).catch(e => console.warn("[admissions] sync", e?.message));
  }
}

/** Работы поступающих по тесту: статус и итоги частей (без ответов). */
async function attemptsOf(t: string, applicantIds?: string[]) {
  let q: FirebaseFirestore.Query = col(t, "exam_attempts");
  q = applicantIds?.length === 1 ? q.where("applicantId", "==", applicantIds[0]) : q.where("applicantId", "!=", null);
  const snap = await q.select("applicantId", "examId", "examTitle", "status", "shortId", "startedAt", "finishedAt", "result.sections", "result.percent", "decision", "superseded").get();
  const exams = new Map((await tenantExams(t)).map(e => [e.id, e]));
  return snap.docs.map(d => {
    const x: any = d.data(); const e = exams.get(x.examId);
    const parts = x.result?.sections && e ? partResults(x.result.sections, e.settings.scoring).map(p => ({ title: p.title, value: p.value })) : [];
    return {
      id: d.id, applicantId: x.applicantId, examId: x.examId, examTitle: x.examTitle, status: x.status, shortId: x.shortId,
      startedAt: x.startedAt, finishedAt: x.finishedAt, superseded: !!x.superseded,
      parts, percent: e && parts.length && e.settings.scoring.hideTotal ? null : x.result?.percent ?? null,
      decision: x.decision ? DECISION_LABEL[x.decision.value as Decision] : null,
    };
  });
}

/** Строка списка: без содержимого анкет — только итоги этапов. */
function row(a: Applicant, attempts: any[]) {
  const mine = attempts.filter(x => x.applicantId === a.id && !x.superseded).sort((x, y) => (y.startedAt || 0) - (x.startedAt || 0));
  return {
    id: a.id, refNo: a.refNo, child: a.child, parent: a.parent, parentForm: a.parentForm, stages: a.stages,
    referral: a.referral ? { examTitle: a.referral.examTitle, manual: a.referral.manual, issuedAt: a.referral.issuedAt } : null,
    attempt: mine[0] || null, paperResults: a.paperResults.length, decision: a.decision ? DECISION_LABEL[a.decision.value] : null,
    stage: stageOf(a, mine[0] || null), createdAt: a.createdAt, updatedAt: a.updatedAt,
  };
}

const sanitizeChild = (b: any) => ({ name: str(b?.name, 120), birthDate: /^\d{4}-\d{2}-\d{2}$/.test(String(b?.birthDate)) ? String(b.birthDate) : "", grade: str(b?.grade, 20), school: str(b?.school, 160) });
const sanitizeParent = (b: any) => ({ name: str(b?.name, 120), phone: str(b?.phone, 30) });

// ── Шаблоны анкет ───────────────────────────────────────────────────────

router.get("/:tenantId/templates", ...staff, async (req: any, res: any) => {
  try {
    const ts = await loadTemplates(req.params.tenantId);
    const c: StaffCaller = req.caller;
    return res.json({ success: true, templates: ts.filter(x => !x.archived), canEdit: Object.fromEntries(ts.map(x => [x.id, canEditTemplate(c, x)])), canCreate: canEditTemplate(c) });
  } catch (e: any) { return oops(res, e); }
});

router.post("/:tenantId/templates", ...staff, async (req: any, res: any) => {
  try {
    if (!canEditTemplate(req.caller)) return fail(res, 403, "Создавать анкеты может приёмная или администратор");
    const id = `tpl_${randomBytes(5).toString("hex")}`;
    const tpl = sanitizeTemplate({ ...req.body, id });
    await col(req.params.tenantId, "questionnaire_templates").doc(id).create(tpl);
    return res.json({ success: true, template: tpl });
  } catch (e: any) { return oops(res, e); }
});

router.put("/:tenantId/templates/:tid", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const tid = String(req.params.tid);
    if (!ID.test(tid)) return fail(res, 400, "Неверная анкета");
    await loadTemplates(t);
    const ref = col(t, "questionnaire_templates").doc(tid);
    const snap = await ref.get();
    if (!snap.exists) return fail(res, 404, "Анкета не найдена");
    const prev = { ...(snap.data() as QTemplate), id: snap.id };
    if (!canEditTemplate(req.caller, prev)) return fail(res, 403, "Нет прав менять эту анкету");
    // Права «кто заполняет / видит» может менять только администрация — иначе психолог мог бы открыть анкету всем.
    const body = hasPerm(req.caller, "settings:manage", "admission:manage") ? req.body : { ...req.body, fillPermission: prev.fillPermission, viewPermission: prev.viewPermission, sensitive: prev.sensitive, audience: prev.audience };
    const tpl = sanitizeTemplate({ ...body, id: tid, audience: prev.audience }, prev);
    await ref.set(tpl);
    return res.json({ success: true, template: tpl });
  } catch (e: any) { return oops(res, e); }
});

// ── Поступающие ─────────────────────────────────────────────────────────

router.get("/:tenantId/applicants", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const [snap, attempts] = await Promise.all([col(t, "applicants").orderBy("createdAt", "desc").limit(3000).get(), attemptsOf(t)]);
    const c: StaffCaller = req.caller;
    return res.json({
      success: true,
      applicants: snap.docs.map(d => row({ ...(d.data() as Applicant), id: d.id }, attempts)),
      me: { admission: hasPerm(c, "admission:manage"), psych: hasPerm(c, "psych:conduct"), psychView: hasPerm(c, "psych:view") },
    });
  } catch (e: any) { return oops(res, e); }
});

/** Экзамены для ручного направления — приёмной не нужен доступ к самим экзаменам. */
router.get("/:tenantId/exams", ...staff, async (req: any, res: any) => {
  try {
    if (!hasPerm(req.caller, "admission:manage")) return fail(res, 403, "Нет прав");
    const exams = (await tenantExams(req.params.tenantId)).filter(e => !e.archived)
      .map(e => ({ id: e.id, title: e.title, status: e.status, grades: e.settings.admission?.grades || [] }));
    return res.json({ success: true, exams });
  } catch (e: any) { return oops(res, e); }
});

router.get("/:tenantId/by-no/:n", ...staff, async (req: any, res: any) => {
  try {
    const n = Number(String(req.params.n).replace(/\D/g, ""));
    if (!n) return fail(res, 400, "Введите номер");
    const s = await col(req.params.tenantId, "applicants").where("refNo", "==", n).limit(1).get();
    if (s.empty) return fail(res, 404, `Поступающего № ${n} нет`);
    return res.json({ success: true, id: s.docs[0].id });
  } catch (e: any) { return oops(res, e); }
});

router.post("/:tenantId/applicants", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage", "psych:conduct")) return fail(res, 403, "Заводить поступающих может приёмная или психолог");
    const child = sanitizeChild(req.body?.child);
    if (child.name.split(/\s+/).filter(Boolean).length < 2) return fail(res, 400, "Укажите фамилию и имя ребёнка");
    if (gradeOf(child.grade) === null) return fail(res, 400, "Укажите класс, в который поступает");
    const ref = col(t, "applicants").doc();
    const [refNo, parentT, cardT] = await Promise.all([nextRefNo(t), makeLink(t, ref.id, "parent"), makeLink(t, ref.id, "card")]);
    const now = Date.now();
    const a: Applicant = {
      id: ref.id, tenantId: t, refNo, child, parent: sanitizeParent(req.body?.parent), note: str(req.body?.note, 1000),
      parentForm: { status: "none", at: null, by: null }, stages: {}, referral: null, paperResults: [], decision: null,
      tokens: { parent: parentT, card: cardT },
      createdAt: now, updatedAt: now, createdBy: c.uid, createdByName: c.name,
    };
    await ref.create(a);
    await audit(t, ref.id, c, "created");
    return res.json({ success: true, id: ref.id, refNo });
  } catch (e: any) { return oops(res, e); }
});

router.get("/:tenantId/applicants/:id", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    a.referral = await syncReferral(t, a).catch(() => a.referral);
    const [templates, formsSnap, attempts] = await Promise.all([
      loadTemplates(t), col(t, "applicant_forms").where("applicantId", "==", a.id).get(), attemptsOf(t, [a.id]),
    ]);
    let sensitive = false;
    const forms = formsSnap.docs.map(d => {
      const f = { ...(d.data() as ApplicantForm), id: d.id };
      if (canSee(c, f.template)) { if (f.template.sensitive) sensitive = true; return { ...f, full: true }; }
      // Без права — только итог: статус и заключение, без ответов.
      const o = outcomeOf(f.template, f.outcome);
      return { id: f.id, templateId: f.templateId, status: f.status, outcome: f.outcome, outcomeLabel: o?.label || "", full: false, template: { id: f.template.id, title: f.template.title, audience: f.template.audience } };
    });
    if (sensitive) await audit(t, a.id, c, "viewed", "открыл анкеты с данными о здоровье и развитии");
    const auditLog = hasPerm(c, "admission:manage")
      ? (await col(t, "applicant_audit").where("applicantId", "==", a.id).get()).docs.map(d => d.data()).sort((x: any, y: any) => y.at - x.at).slice(0, 100)
      : [];
    const canFillMap = Object.fromEntries(templates.map(x => [x.id, canFill(c, x)]));
    const canSeeMap = Object.fromEntries(templates.map(x => [x.id, canSee(c, x)]));
    return res.json({
      success: true, applicant: a, forms, attempts, audit: auditLog,
      templates: templates.filter(x => !x.archived), canFill: canFillMap, canSee: canSeeMap,
      me: { admission: hasPerm(c, "admission:manage"), psych: hasPerm(c, "psych:conduct"), psychView: hasPerm(c, "psych:view"), name: c.name },
    });
  } catch (e: any) { return oops(res, e); }
});

router.put("/:tenantId/applicants/:id", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage", "psych:conduct")) return fail(res, 403, "Нет прав менять карточку");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    const patch: Partial<Applicant> = { updatedAt: Date.now() };
    if (req.body?.child) {
      const ch = sanitizeChild({ ...a.child, ...req.body.child });
      if (ch.name.split(/\s+/).filter(Boolean).length < 2) return fail(res, 400, "Укажите фамилию и имя ребёнка");
      if (gradeOf(ch.grade) === null) return fail(res, 400, "Укажите класс");
      patch.child = ch;
    }
    if (req.body?.parent) patch.parent = sanitizeParent({ ...a.parent, ...req.body.parent });
    if (req.body?.note !== undefined) patch.note = str(req.body.note, 1000);
    await col(t, "applicants").doc(a.id).update(patch);
    await audit(t, a.id, c, "edited", "профиль");
    // Сменился класс — может смениться и экзамен.
    if (patch.child && patch.child.grade !== a.child.grade) await syncReferral(t, { ...a, ...patch } as any, await loadTemplates(t));
    return res.json({ success: true });
  } catch (e: any) { return oops(res, e); }
});

router.delete("/:tenantId/applicants/:id", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Удалять карточки может приёмная");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    const forms = await col(t, "applicant_forms").where("applicantId", "==", a.id).get();
    const links = await db().collection(LINKS).where("applicantId", "==", a.id).get();
    const b = db().batch();
    forms.docs.forEach(d => b.delete(d.ref));
    links.docs.forEach(d => { if (d.data().tenantId === t) b.delete(d.ref); });
    b.delete(col(t, "applicants").doc(a.id));
    await b.commit();
    await audit(t, a.id, c, "deleted", `${a.child.name}, № ${a.refNo}`);
    return res.json({ success: true });
  } catch (e: any) { return oops(res, e); }
});

/**
 * Анкета ребёнка: черновик, сдача (done) или снова в работу (reopen).
 * Анкету родителя сюда вносят с бумаги; анкеты сотрудников — по праву шаблона.
 */
router.put("/:tenantId/applicants/:id/forms/:tid", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller; const tid = String(req.params.tid);
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    if (!ID.test(tid)) return fail(res, 400, "Неверная анкета");
    const templates = await loadTemplates(t);
    const fref = col(t, "applicant_forms").doc(`${a.id}_${tid}`);
    const fsnap = await fref.get();
    const prev = fsnap.exists ? (fsnap.data() as ApplicantForm) : null;
    // Снимок шаблона: у начатой анкеты — тот, по которому её начали.
    const tpl = prev?.template || templates.find(x => x.id === tid);
    if (!tpl) return fail(res, 404, "Анкета не найдена");
    if (!canFill(c, tpl)) return fail(res, 403, "Заполнять эту анкету может только сотрудник с нужным правом");
    const g = gradeOf(a.child.grade);
    const now = Date.now();
    const reopen = req.body?.reopen === true;
    const answers = reopen && prev ? prev.answers : sanitizeAnswers(tpl, req.body?.answers);
    const outcome = reopen && prev ? prev.outcome : (tpl.outcome && outcomeOf(tpl, req.body?.outcome) ? String(req.body.outcome) : null);
    const done = !reopen && req.body?.done === true;
    if (done) {
      const miss = missingFor(tpl, answers, g, outcome);
      if (miss.length) return fail(res, 400, `Не заполнено: ${miss.slice(0, 4).join(", ")}${miss.length > 4 ? ` и ещё ${miss.length - 4}` : ""}`, { missing: miss });
    }
    const status: "draft" | "done" = done ? "done" : reopen ? "draft" : (prev?.status === "done" ? "done" : "draft");
    const form: ApplicantForm = {
      id: fref.id, applicantId: a.id, templateId: tid, template: tpl, grade: g, answers, outcome, status,
      filledBy: { kind: "staff", uid: c.uid, name: c.name },
      // Анкету родителя внесли с бумаги — согласие, подписанное на бумаге, отмечает сотрудник.
      ...(prev?.consent ? { consent: prev.consent } : tpl.audience === "parent" && req.body?.paperConsent === true ? { consent: { at: now, version: LEGAL_VERSION, ip: `бумага, внёс ${c.name}`.slice(0, 64) } } : {}),
      createdAt: prev?.createdAt || now, updatedAt: now, doneAt: done ? now : status === "done" ? prev?.doneAt || now : null,
    };
    await fref.set(deep(form));

    const patch: any = { updatedAt: now };
    if (tpl.audience === "parent") {
      patch.parentForm = { status: status === "done" ? "done" : "none", at: now, by: "staff" };
      Object.assign(patch, bindToCard(a, tpl, answers, false));
    } else {
      const o = outcomeOf(tpl, outcome);
      const summary: StageSummary = { templateId: tid, title: tpl.title, status, outcome, outcomeLabel: o?.label || "", tone: o?.tone || null, allowsTest: !!o?.allowsTest, by: c.uid, byName: c.name, at: now };
      patch[`stages.${tid}`] = summary;
    }
    await col(t, "applicants").doc(a.id).update(patch);
    if (done || reopen) await audit(t, a.id, c, done ? "form_done" : "form_reopened", tpl.title);
    let referral = a.referral;
    if (tpl.audience === "staff" && (done || reopen)) {
      const fresh = await loadApplicant(t, a.id);
      if (fresh) referral = await syncReferral(t, fresh, templates);
    }
    return res.json({ success: true, form, referral });
  } catch (e: any) { return oops(res, e); }
});

/** «Допустить к тесту» вопреки итогу (администрация). Тест — по классу, как у всех. */
router.post("/:tenantId/applicants/:id/referral", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    // Разделение обязанностей: психолог ставит итог, тест по классу выбирает система;
    // выдать направление вопреки итогу или на другой экзамен — только администрация.
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Направление вручную выдаёт администратор");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    const reason = str(req.body?.reason, 500);
    const seed = { examId: null, examTitle: "", examCode: null, issuedAt: Date.now(), by: c.uid, byName: c.name, manual: true, reason };
    await col(t, "applicants").doc(a.id).update({ referral: seed, updatedAt: Date.now() });
    const referral = await syncReferral(t, { ...a, referral: seed });
    await audit(t, a.id, c, "referral_manual", `допущен к тесту${reason ? ` — ${reason}` : ""}`);
    return res.json({ success: true, referral });
  } catch (e: any) { return oops(res, e); }
});

router.delete("/:tenantId/applicants/:id/referral", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Снимать направление может администратор");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    await col(t, "applicants").doc(a.id).update({ referral: null, updatedAt: Date.now() });
    await audit(t, a.id, c, "referral_revoked", a.referral?.examTitle || "");
    return res.json({ success: true });
  } catch (e: any) { return oops(res, e); }
});

/** Результаты теста на бумаге (классы, где теста онлайн ещё нет). */
router.post("/:tenantId/applicants/:id/paper", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Вносить результаты может приёмная");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    const n = (v: unknown) => (v === "" || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.max(0, Number(v)));
    const rows = (Array.isArray(req.body?.rows) ? req.body.rows : []).slice(0, 20)
      .map((r: any) => ({ subject: str(r?.subject, 80), score: n(r?.score), max: n(r?.max) })).filter((r: any) => r.subject);
    if (!rows.length) return fail(res, 400, "Добавьте хотя бы один предмет");
    const pid = String(req.body?.id || "");
    const item = { id: ID.test(pid) ? pid : `p${Date.now().toString(36)}`, title: str(req.body?.title, 120) || "Тест на бумаге", rows, comment: str(req.body?.comment, 1000), at: Date.now(), byName: c.name };
    const paperResults = [...a.paperResults.filter(p => p.id !== item.id), item];
    await col(t, "applicants").doc(a.id).update({ paperResults, updatedAt: Date.now() });
    await audit(t, a.id, c, "paper_results", item.title);
    return res.json({ success: true, paperResults });
  } catch (e: any) { return oops(res, e); }
});

router.delete("/:tenantId/applicants/:id/paper/:pid", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Нет прав");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    const paperResults = a.paperResults.filter(p => p.id !== String(req.params.pid));
    await col(t, "applicants").doc(a.id).update({ paperResults, updatedAt: Date.now() });
    return res.json({ success: true, paperResults });
  } catch (e: any) { return oops(res, e); }
});

router.post("/:tenantId/applicants/:id/decision", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Решение принимает приёмная или администрация");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    const v = req.body?.value as Decision | null;
    if (v !== null && !["accepted", "reserve", "rejected"].includes(v)) return fail(res, 400, "Неизвестное решение");
    const decision = v ? { value: v, comment: str(req.body?.comment, 1000), by: c.name, at: Date.now() } : null;
    await col(t, "applicants").doc(a.id).update({ decision, updatedAt: Date.now() });
    await audit(t, a.id, c, "decision", v ? DECISION_LABEL[v] : "снято");
    return res.json({ success: true, decision });
  } catch (e: any) { return oops(res, e); }
});

/** Новая ссылка (старую QR перестанут принимать) — если бумага потерялась или попала не туда. */
router.post("/:tenantId/applicants/:id/relink", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage", "psych:conduct")) return fail(res, 403, "Нет прав");
    const purpose = String(req.body?.purpose) as LinkPurpose;
    if (!["parent", "referral", "card"].includes(purpose)) return fail(res, 400, "Неизвестная ссылка");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    const old = a.tokens?.[purpose];
    if (old) await db().collection(LINKS).doc(old).delete().catch(() => {});
    const token = await makeLink(t, a.id, purpose);
    await col(t, "applicants").doc(a.id).update({ [`tokens.${purpose}`]: token, updatedAt: Date.now() });
    await audit(t, a.id, c, "relink", purpose);
    return res.json({ success: true, token });
  } catch (e: any) { return oops(res, e); }
});

// ── QR: кто сканирует ───────────────────────────────────────────────────

async function resolveLink(token: string) {
  if (!/^[\w-]{20,60}$/.test(token)) return null;
  const s = await db().collection(LINKS).doc(token).get();
  if (!s.exists) return null;
  const l = s.data() as { tenantId: string; applicantId: string; purpose: LinkPurpose };
  const a = await loadApplicant(l.tenantId, l.applicantId);
  // Ссылку перевыпустили — старая больше не действует.
  if (!a || a.tokens?.[l.purpose] !== token) return null;
  return { ...l, applicant: a };
}


/**
 * Скан QR. Сотрудник этой организации с правами поступающих — в карточку на
 * свою вкладку (психолог — диагностика, приёмная/администрация — академическая
 * часть). Все остальные — то, что положено цели ссылки.
 */
router.get("/link/:token", auth, async (req: any, res: any) => {
  try {
    const l = await resolveLink(String(req.params.token));
    if (!l) return fail(res, 404, "Ссылка не найдена или уже заменена новой");
    const gate = await checkTenantOpen(l.tenantId, "admissions");
    if (!gate.ok) return fail(res, gate.status || 403, gate.error || "Недоступно");
    const org = { id: l.tenantId, name: str(gate.tenant?.name, 120), ...tenantLogos(gate.tenant) };
    const a = l.applicant;
    const c = await staffCaller(db(), l.tenantId, req.user);
    if (c?.member && hasPerm(c, ...ANY)) {
      const tab = l.purpose === "parent" ? "parent" : hasPerm(c, "admission:manage") ? "test" : hasPerm(c, "psych:conduct") ? "psych" : "profile";
      return res.json({ success: true, mode: "staff", org, who: c.name, url: `/workspace/${l.tenantId}/exams?side=psych&open=${a.id}&ctab=${tab}${req.query.s ? `&s=${encodeURIComponent(String(req.query.s).slice(0, 40))}` : ""}`, child: a.child.name, refNo: a.refNo });
    }
    const signedIn = !!c;
    if (l.purpose === "card") return res.json({ success: true, mode: "staff_only", org, signedIn });
    if (l.purpose === "referral") {
      const r = await syncReferral(l.tenantId, a).catch(() => a.referral);
      // Согласие дано родителем в анкете — на странице теста его не спрашиваем (сервер проверяет то же).
      const consented = (await col(l.tenantId, "applicant_forms").where("applicantId", "==", a.id).get()).docs.some(d => !!d.data().consent);
      return res.json({
        success: true, mode: "student", org, signedIn,
        child: { name: a.child.name, grade: a.child.grade },
        exam: r?.examCode ? { code: r.examCode, title: r.examTitle } : null,
        referred: !!r,
        // Поля «о себе» на странице теста — из карточки, ученику остаётся проверить.
        prefill: { birthDate: a.child.birthDate || "", school: a.child.school || "", parentName: a.parent.name || "", parentPhone: a.parent.phone || "" },
        consented,
      });
    }
    // Анкета родителя: шаблон и сохранённые ответы (их же родитель и вводил).
    const templates = await loadTemplates(l.tenantId);
    const fsnap = await col(l.tenantId, "applicant_forms").where("applicantId", "==", a.id).get();
    const prev = fsnap.docs.map(d => d.data() as ApplicantForm).find(f => f.template.audience === "parent");
    const tpl = prev?.template || templates.find(x => x.audience === "parent" && !x.archived);
    if (!tpl) return fail(res, 404, "Анкета для родителей не настроена");
    const locked = Object.values(a.stages).some(s => s.status === "done");
    const prefill: QAnswers = {};
    for (const i of tpl.sections.flatMap(s => s.items)) {
      if (!i.bind) continue;
      const [k, f] = i.bind.split(".") as ["child" | "parent", string];
      const v = (a as any)[k]?.[f]; if (v) prefill[i.id] = { value: String(v) };
    }
    return res.json({
      success: true, mode: "parent", org, signedIn, locked, template: tpl,
      answers: { ...prefill, ...(prev?.answers || {}) }, done: prev?.status === "done", grade: a.child.grade,
    });
  } catch (e: any) { return oops(res, e); }
});

/** Родитель заполнил анкету по своей ссылке. Править можно, пока психолог не завершил диагностику. */
router.post("/link/:token/parent", async (req: any, res: any) => {
  try {
    const l = await resolveLink(String(req.params.token));
    if (!l || l.purpose !== "parent") return fail(res, 404, "Ссылка не найдена или уже заменена новой");
    const gate = await checkTenantOpen(l.tenantId, "admissions");
    if (!gate.ok) return fail(res, gate.status || 403, gate.error || "Недоступно");
    const a = l.applicant; const t = l.tenantId;
    if (Object.values(a.stages).some(s => s.status === "done")) return fail(res, 409, "Психолог уже провёл встречу — изменить ответы можно через него");
    if (req.body?.consent !== true) return fail(res, 400, "Нужно согласие на обработку данных");
    const templates = await loadTemplates(t);
    const fref = col(t, "applicant_forms").doc(`${a.id}_${(templates.find(x => x.audience === "parent" && !x.archived) || { id: "" }).id}`);
    const fsnap = await fref.get();
    const prev = fsnap.exists ? (fsnap.data() as ApplicantForm) : null;
    const tpl = prev?.template || templates.find(x => x.audience === "parent" && !x.archived);
    if (!tpl) return fail(res, 404, "Анкета для родителей не настроена");
    const answers = sanitizeAnswers(tpl, req.body?.answers);
    const miss = missingFor(tpl, answers, gradeOf(a.child.grade), null);
    if (miss.length) return fail(res, 400, `Заполните: ${miss.slice(0, 4).join(", ")}`, { missing: miss });
    const now = Date.now();
    const ip = str(String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0], 64);
    const form: ApplicantForm = {
      id: fref.id, applicantId: a.id, templateId: tpl.id, template: tpl, grade: gradeOf(a.child.grade), answers, outcome: null, status: "done",
      filledBy: { kind: "parent", name: str(answers[tpl.sections.flatMap(s => s.items).find(i => i.bind === "parent.name")?.id || ""]?.value, 120) || "Родитель" },
      consent: { at: now, version: LEGAL_VERSION, ip },
      createdAt: prev?.createdAt || now, updatedAt: now, doneAt: now,
    };
    await fref.set(deep(form));
    await col(t, "applicants").doc(a.id).update({ parentForm: { status: "done", at: now, by: "parent" }, updatedAt: now, ...bindToCard(a, tpl, answers, false) });
    await audit(t, a.id, null, "parent_form", "родитель заполнил анкету");
    return res.json({ success: true });
  } catch (e: any) { return oops(res, e); }
});

export default router;
