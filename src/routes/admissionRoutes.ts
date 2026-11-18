import { Router } from "express";
import admin from "firebase-admin";
import { randomBytes, randomInt } from "crypto";
import { requireFirebaseAuth } from "./authRoutes.js";
import { hasPerm, membersWith, optionalAuth, requirePerm, staffCaller, type StaffCaller } from "../server/access.js";
import { checkTenantOpen, requireScreen } from "../server/tenantAccess.js";
import { tenantLogos } from "../shared/legal.js";
import { LEGAL_VERSION } from "../shared/legalDocs.js";
import { DECISION_LABEL, paperResult, partResults, sanitizeSections, sanitizeSettings, type Decision, type Exam, type ExamResult } from "../shared/examRun.js";
import { NEUTRAL_CANDIDATE_FORM, sanitizeCandidateForm, type CandidateFormConfig } from "../shared/candidateForm.js";
import {
  gradeOf, missingFor, outcomeOf, sanitizeAnswers, sanitizeTemplate,
  type QAnswers, type QBind, type QTemplate,
} from "../shared/questionnaires.js";
import {
  admittedByStages, candidateOf, examForApplicant, sanitizeCandidate, stageOf, subjectLevel,
  type Applicant, type ApplicantForm, type CandidateInfo, type LinkPurpose, type StageSummary,
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
  t.audience === "parent" ? hasPerm(c, "admission:manage") : t.fillPermission ? hasPerm(c, t.fillPermission) : hasPerm(c, "admission:manage");
/** Видеть содержимое целиком. */
const canSee = (c: StaffCaller, t: QTemplate) => !t.sensitive || canFill(c, t) || (!!t.viewPermission && hasPerm(c, t.viewPermission));
/** Править шаблон: владелец, настройки, приёмная — или тот, кто по нему работает (психолог правит нормы). */
const canEditTemplate = (c: StaffCaller, t?: QTemplate) =>
  hasPerm(c, "settings:manage", "admission:manage") || (!!t?.fillPermission && hasPerm(c, t.fillPermission));
/** Тест, бумажные результаты и решение — академическая часть: психологу их не отдаём. */
const seesAcademic = (c: StaffCaller) => hasPerm(c, "admission:manage", "tests:manage", "placement:manage", "tests:review");
const meOf = (c: StaffCaller) => ({
  admission: hasPerm(c, "admission:manage"), psych: hasPerm(c, "psych:conduct"), psychView: hasPerm(c, "psych:view"), academic: seesAcademic(c), name: c.name,
});
const LEVEL_WORD = ["Низкий", "Средний", "Отличный"] as const;

// ── Уведомления администрации ───────────────────────────────────────────

type AdmissionEvent = "new" | "parent" | "session" | "done" | "tested" | "results";
type Audience = "admin" | "psych";
/**
 * Кому и с каким заголовком. Администрация (право приёма) — обо всём ходе
 * приёма; психологи (проводят диагностику) — о новом ученике и о готовой
 * анкете родителя: это их работа на сессию.
 */
const EVENT_PLAN: Record<AdmissionEvent, Partial<Record<Audience, string>>> = {
  new: { admin: "Новый поступающий", psych: "К вам новый ученик" },
  parent: { admin: "Анкета родителя заполнена", psych: "Анкета родителя заполнена" },
  session: { admin: "Новая сессия у психолога" },
  done: { admin: "Сессия завершена — выдайте направление" },
  tested: { admin: "Тест сдан" },
  results: { admin: "Результаты теста внесены" },
};
const AUDIENCE_PERMS: Record<Audience, PermissionKey[]> = { admin: ["admission:manage"], psych: ["psych:conduct"] };
/**
 * Ход приёма — в колокольчик (кроме автора). Одна запись на ребёнка и
 * адресата: показывает последний шаг, а не копит десяток строк про одного
 * ученика. У кого оба права (или полный доступ) — получает как администрация.
 * Ошибка рассылки не ломает сохранение.
 */
async function notifyAdmission(t: string, a: Applicant, ev: AdmissionEvent, c: { uid: string; name: string }, o: { tid?: string; outcome?: string; referral?: boolean; summary?: string } = {}) {
  try {
    const plan = EVENT_PLAN[ev];
    const who = `${a.child.name}, ${a.child.grade} класс`;
    const body = ev === "done" ? [who, o.outcome, o.referral ? "направление готово" : ""].filter(Boolean).join(" · ")
      : ev === "tested" || ev === "results" ? [who, o.summary, ev === "results" ? c.name : ""].filter(Boolean).join(" · ")
      : [who, c.name].filter(Boolean).join(" · ");
    const adminTab = ev === "new" ? "profile" : ev === "parent" ? "parent" : ev === "tested" || ev === "results" ? "test" : o.tid || "psych";
    const sent = new Set<string>([c.uid]);
    const adminUrl = plan.admin ? await adminCardUrl(t, a, adminTab) : "";
    const batch = db().batch(); let n = 0;
    for (const aud of ["admin", "psych"] as Audience[]) {
      const title = plan[aud];
      if (!title) continue;
      const url = aud === "admin" ? adminUrl : `/workspace/${t}/exams?side=psych&open=${a.id}&ctab=psych`;
      for (const r of await membersWith(db(), t, AUDIENCE_PERMS[aud])) {
        if (sent.has(r.uid)) continue;
        sent.add(r.uid); n++;
        batch.set(db().collection("notifications").doc(`adm_${a.id}_${r.uid}`), {
          tenantId: t, userId: r.uid, type: "admission", title, body, actionUrl: url, applicantId: a.id, read: false,
          createdAt: admin.firestore.Timestamp.now(),
        });
      }
    }
    if (n) await batch.commit();
  } catch (e) { console.error("[admissions] notify:", e); }
}

/** Адрес ребёнка у администрации — на странице экзамена его класса (иначе — «Поступающие»). */
async function adminCardUrl(t: string, a: Pick<Applicant, "id" | "child" | "referral">, ctab: string, exams?: Exam[]) {
  const g = gradeOf(a.child.grade);
  const list = exams || await tenantExams(t);
  const exam = list.find(e => e.id === a.referral?.examId && !e.archived)
    || list.filter(e => !e.archived && g !== null && (e.settings.admission?.grades || []).includes(g))
      .sort((x, y) => (x.status === "open" ? 0 : 1) - (y.status === "open" ? 0 : 1))[0];
  return exam ? `/workspace/${t}/exams/${exam.id}?open=${a.id}&ctab=${ctab}` : `/workspace/${t}/exams?tab=admissions&open=${a.id}&ctab=${ctab}`;
}

/** Итог теста одной строкой — для уведомления. */
const resultSummary = (exam: Pick<Exam, "settings">, r: Pick<ExamResult, "sections" | "percent"> | null | undefined) => {
  if (!r) return "";
  const parts = partResults(r.sections, exam.settings.scoring);
  return parts.length ? parts.map(p => `${p.title}: ${p.value}`).join(" · ") : `${r.percent}%`;
};

/** Ученик сдал тест по направлению — сообщить администрации. */
export async function notifyTested(t: string, x: { applicantId?: string; result?: ExamResult | null }, exam: Exam) {
  if (!x.applicantId) return;
  const a = await loadApplicant(t, x.applicantId).catch(() => null);
  if (a) await notifyAdmission(t, a, "tested", { uid: "", name: "" }, { summary: resultSummary(exam, x.result) });
}

/** Карточка без академической части: этап — не дальше направления. */
const withoutAcademic = (a: Applicant): Applicant => ({ ...a, decision: null, candidate: null, paperResults: [] });

// ── Данные ──────────────────────────────────────────────────────────────

/** Анкеты организации. Новая организация начинает с пустого списка — свои анкеты создаёт сама. */
async function loadTemplates(t: string): Promise<QTemplate[]> {
  const snap = await col(t, "questionnaire_templates").get();
  return snap.docs.map(d => ({ ...(d.data() as QTemplate), id: d.id }));
}

/** Вид анкеты кандидата организации; не настроен — нейтральный. */
async function loadCandidateForm(t: string): Promise<CandidateFormConfig> {
  const s = await col(t, "admission_meta").doc("candidate_form").get();
  return s.exists ? (s.data() as CandidateFormConfig) : NEUTRAL_CANDIDATE_FORM;
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
    if (b === "child.birthDate" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return; // в карточку — только настоящая дата
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
  const snap = await q.select("applicantId", "examId", "examTitle", "status", "shortId", "startedAt", "finishedAt", "result.sections", "result.percent", "result.topics", "decision", "superseded", "paper", "student.extra").get();
  const exams = new Map((await tenantExams(t)).map(e => [e.id, e]));
  return snap.docs.map(d => {
    const x: any = d.data(); const e = exams.get(x.examId);
    const parts = x.result?.sections && e ? partResults(x.result.sections, e.settings.scoring)
      .map(p => ({ title: p.title, value: p.value, kind: p.kind, sections: e.settings.scoring.parts?.find(q => q.id === p.id)?.sections || [] })) : [];
    return {
      id: d.id, applicantId: x.applicantId, examId: x.examId, examTitle: x.examTitle, status: x.status, shortId: x.shortId,
      startedAt: x.startedAt, finishedAt: x.finishedAt, superseded: !!x.superseded, paper: !!x.paper,
      parts, percent: e && parts.length && e.settings.scoring.hideTotal ? null : x.result?.percent ?? null,
      // Для анкеты кандидата: предметы, разбор по темам и пороги уровней экзамена.
      sections: (x.result?.sections || []).map((s: any) => ({ id: s.id, title: s.title, percent: s.percent, correct: s.correct, total: s.total })),
      topics: (x.result?.topics || []).filter((q: any) => q.topic && q.topic !== "—").map((q: any) => ({ topic: q.topic, percent: q.percent })),
      levels: e?.settings.admission?.levels || { mid: 50, high: 77 },
      studentPhone: x.student?.extra?.studentPhone || "",
      decision: x.decision ? DECISION_LABEL[x.decision.value as Decision] : null,
    };
  });
}

/** Строка списка: без содержимого анкет — только итоги этапов. */
function row(a: Applicant, attempts: any[], academic: boolean) {
  if (!academic) a = withoutAcademic(a);
  const mine = attempts.filter(x => x.applicantId === a.id && !x.superseded).sort((x, y) => (y.startedAt || 0) - (x.startedAt || 0));
  return {
    id: a.id, refNo: a.refNo, child: a.child, parent: a.parent, parentForm: a.parentForm, stages: a.stages,
    referral: a.referral ? { examTitle: a.referral.examTitle, manual: a.referral.manual, issuedAt: a.referral.issuedAt } : null,
    attempt: mine[0] || null, paperResults: a.paperResults.length,
    decision: candidateOf(a)?.decisionLabel || null,
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

/** Вид анкеты кандидата: читают сотрудники приёма, меняют настройки и администрация. */
router.get("/:tenantId/candidate-form", ...staff, async (req: any, res: any) => {
  try {
    return res.json({ success: true, form: await loadCandidateForm(req.params.tenantId), canEdit: hasPerm(req.caller, "settings:manage", "admission:manage") });
  } catch (e: any) { return oops(res, e); }
});
router.put("/:tenantId/candidate-form", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "settings:manage", "admission:manage")) return fail(res, 403, "Менять анкету кандидата может администрация");
    const ref = col(t, "admission_meta").doc("candidate_form");
    const prev = (await ref.get()).data() as CandidateFormConfig | undefined;
    const form: CandidateFormConfig = { ...sanitizeCandidateForm(req.body, prev || null), updatedBy: c.name, updatedAt: Date.now() };
    await ref.set(form);
    return res.json({ success: true, form });
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
    const c: StaffCaller = req.caller;
    // «Кто заполняет / кто видит» — только настройки организации: иначе приёмная
    // могла бы выдать себе просмотр психологии, а психолог — открыть анкету всем.
    let body = hasPerm(c, "settings:manage") ? req.body : { ...req.body, fillPermission: prev.fillPermission, viewPermission: prev.viewPermission, sensitive: prev.sensitive };
    // Какие итоги пускают к тесту — решает администрация, не тот, кто заполняет анкету.
    if (!hasPerm(c, "settings:manage", "admission:manage")) body = { ...body, outcome: prev.outcome };
    const tpl = { ...sanitizeTemplate({ ...body, id: tid, audience: prev.audience }, prev), updatedBy: c.name, updatedAt: Date.now() };
    await ref.set(tpl);
    return res.json({ success: true, template: tpl });
  } catch (e: any) { return oops(res, e); }
});

// ── Поступающие ─────────────────────────────────────────────────────────

router.get("/:tenantId/applicants", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const c: StaffCaller = req.caller; const academic = seesAcademic(c);
    const [snap, attempts] = await Promise.all([col(t, "applicants").orderBy("createdAt", "desc").limit(3000).get(), academic ? attemptsOf(t) : []]);
    return res.json({
      success: true,
      applicants: snap.docs.map(d => row({ ...(d.data() as Applicant), id: d.id }, attempts, academic)),
      me: meOf(c),
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
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Поступающих заводит администрация");
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
    await notifyAdmission(t, a, "new", c);
    return res.json({ success: true, id: ref.id, refNo });
  } catch (e: any) { return oops(res, e); }
});

router.get("/:tenantId/applicants/:id", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    a.referral = await syncReferral(t, a).catch(() => a.referral);
    const academic = seesAcademic(c);
    const [templates, formsSnap, attempts] = await Promise.all([
      loadTemplates(t), col(t, "applicant_forms").where("applicantId", "==", a.id).get(), academic ? attemptsOf(t, [a.id]) : [],
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
      success: true, applicant: { ...(academic ? { ...a, candidate: candidateOf(a) } : withoutAcademic(a)), tokens: hasPerm(c, "admission:manage") ? a.tokens : { card: a.tokens.card, parent: "" } },
      forms, attempts, audit: auditLog,
      // Тест ребёнка по направлению: если на бумаге — администрация вносит правильные ответы.
      candidateForm: academic ? await loadCandidateForm(t) : null,
      testExam: academic ? await (async () => {
        const e = a.referral?.examId ? (await tenantExams(t)).find(x => x.id === a.referral!.examId) : null;
        return e ? { id: e.id, title: e.title, paper: !!e.settings.paper, sections: e.sections.map(x => ({ id: x.id, title: x.title, tasks: x.tasks || 0 })) } : null;
      })() : null,
      templates: templates.filter(x => !x.archived), canFill: canFillMap, canSee: canSeeMap,
      me: meOf(c),
    });
  } catch (e: any) { return oops(res, e); }
});

router.put("/:tenantId/applicants/:id", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Карточку меняет администрация");
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
    if (tpl.audience === "parent" && done && prev?.status !== "done") await notifyAdmission(t, a, "parent", c);
    if (tpl.audience === "staff" && done) await notifyAdmission(t, a, "done", c, { tid, outcome: outcomeOf(tpl, outcome)?.label, referral: !!referral });
    else if (tpl.audience === "staff" && !prev) await notifyAdmission(t, a, "session", c, { tid });
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
    const gone = a.paperResults.find(p => p.id === String(req.params.pid));
    const paperResults = a.paperResults.filter(p => p.id !== String(req.params.pid));
    await col(t, "applicants").doc(a.id).update({ paperResults, updatedAt: Date.now() });
    if (gone) await audit(t, a.id, c, "paper_deleted", gone.title);
    return res.json({ success: true, paperResults });
  } catch (e: any) { return oops(res, e); }
});

/** Фото ребёнка для анкеты кандидата — с последней его работы, где оно есть. */
router.get("/:tenantId/applicants/:id/photo", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!seesAcademic(c)) return fail(res, 403, "Нет прав");
    const id = String(req.params.id);
    if (!ID.test(id)) return fail(res, 400, "Неверный поступающий");
    const snap = await col(t, "exam_attempts").where("applicantId", "==", id).get();
    const best = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(x => x.hasPhoto && x.status !== "annulled")
      .sort((x, y) => (y.finishedAt || y.startedAt || 0) - (x.finishedAt || x.startedAt || 0))[0];
    const photo = best ? (await col(t, "exam_photos").doc(best.id).get()).data()?.photo || null : null;
    return res.json({ success: true, photo });
  } catch (e: any) { return oops(res, e); }
});

/**
 * Анкета кандидата: заключение, обратная связь родителю, решение и условия
 * (пункты 3–5 бланка). «Обратная связь: да» открывает ученику результаты по QR.
 */
router.put("/:tenantId/applicants/:id/candidate", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Анкету кандидата заполняет администрация");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    const prev = candidateOf(a);
    const form = await loadCandidateForm(t);
    const candidate: CandidateInfo = { ...sanitizeCandidate(req.body, form.decisions), by: c.name, at: Date.now() };
    await col(t, "applicants").doc(a.id).update({ candidate, decision: null, updatedAt: Date.now() });
    if ((prev?.decision || null) !== candidate.decision) await audit(t, a.id, c, "decision", candidate.decision ? candidate.decisionLabel : "снято");
    if (!!prev?.feedbackGiven !== candidate.feedbackGiven) await audit(t, a.id, c, "feedback", candidate.feedbackGiven ? "дана — ученик видит результаты по QR" : "снята");
    return res.json({ success: true, candidate });
  } catch (e: any) { return oops(res, e); }
});

/**
 * Тест на бумаге (1–6 классы): администрация вносит правильные ответы по
 * предметам. «Из скольки» запоминается в экзамене — вводится один раз на
 * предмет и класс. Работа сохраняется как обычная сданная: с процентами,
 * в списке работ экзамена и в анкете кандидата.
 */
router.post("/:tenantId/applicants/:id/paper-test", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Результаты вносит администрация");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    const examId = str(req.body?.examId, 60) || a.referral?.examId || "";
    const exam = (await tenantExams(t)).find(e => e.id === examId);
    if (!exam || !exam.settings.paper) return fail(res, 400, "Это не тест на бумаге");
    const g = gradeOf(a.child.grade);
    if (a.referral?.examId !== exam.id && !(g !== null && (exam.settings.admission?.grades || []).includes(g))) return fail(res, 400, "Этот тест не для класса поступающего");
    const rows: any[] = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 20) : [];
    const rowOf = (id: string) => rows.find(x => x?.sectionId === id);
    let remember = false;
    const sections = exam.sections.map(x => {
      const n = Math.round(Number(rowOf(x.id)?.tasks));
      if (Number.isFinite(n) && n > 0 && n <= 500 && n !== x.tasks) { remember = true; return { ...x, tasks: n }; }
      return x;
    });
    const noTasks = sections.filter(x => !(Number(x.tasks) > 0));
    if (noTasks.length) return fail(res, 400, `Укажите, сколько заданий: ${noTasks.map(x => x.title).join(", ")}`);
    const correct: Record<string, number> = {};
    for (const x of sections) {
      const v = Number(rowOf(x.id)?.correct);
      if (!Number.isInteger(v) || v < 0 || v > (x.tasks || 0)) return fail(res, 400, `${x.title}: правильных — от 0 до ${x.tasks}`);
      correct[x.id] = v;
    }
    // Фото ребёнка — по желанию: снимает администратор при вводе (на онлайн-тесте его делает сам ученик).
    const photo = typeof req.body?.photo === "string" ? req.body.photo : "";
    if (photo && (!/^data:image\/jpeg;base64,/.test(photo) || photo.length > 400_000)) return fail(res, 400, "Фото не подходит — нужен снимок JPEG до 300 КБ");
    const now = Date.now();
    if (remember) await col(t, "exams").doc(exam.id).update({ sections: sanitizeSections(sections), updatedAt: now });
    const ex = { ...exam, sections };
    const result = paperResult(ex, correct);
    const ref = col(t, "exam_attempts").doc(`paper_${a.id}_${exam.id}`);
    const prev: any = (await ref.get()).data() || null;
    let shortId = prev?.shortId || "";
    for (let k = 0; k < 8 && !shortId; k++) {
      const n = String(randomInt(100000, 1000000));
      if ((await col(t, "exam_attempts").where("examId", "==", exam.id).where("shortId", "==", n).limit(1).get()).empty) shortId = n;
    }
    await ref.set(deep({
      id: ref.id, tenantId: t, examId: exam.id, examTitle: exam.title, shortId, identity: `a:${a.id}`,
      student: { name: a.child.name, phone: "", email: "", level: a.child.grade, extra: { birthDate: a.child.birthDate || "", school: a.child.school || "", parentName: a.parent.name || "", parentPhone: a.parent.phone || "" } },
      status: "finished", startedAt: prev?.startedAt || now, finishedAt: now, current: 0, sections: [], questions: {}, answers: {},
      result, review: { status: "done", overrides: {}, notes: {} }, proctoring: { enabled: false },
      published: false, decision: null, group: null, retakeAllowed: false, superseded: false, hasPhoto: !!photo || !!prev?.hasPhoto,
      applicantId: a.id, refNo: a.refNo, paper: true, enteredBy: c.name, enteredAt: now,
    }));
    if (photo) await col(t, "exam_photos").doc(ref.id).set({ photo, at: now });
    await audit(t, a.id, c, "paper_results", `${exam.title}: ${result.sections.map(x => `${x.title} ${x.correct}/${x.total}`).join(", ")}`);
    await notifyAdmission(t, a, "results", c, { summary: resultSummary(ex, result) });
    return res.json({ success: true, attemptId: ref.id, result });
  } catch (e: any) { return oops(res, e); }
});

/** Новая ссылка (старую QR перестанут принимать) — если бумага потерялась или попала не туда. */
router.post("/:tenantId/applicants/:id/relink", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "QR перевыпускает администрация");
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
      const tab = hasPerm(c, "admission:manage") ? (l.purpose === "parent" ? "parent" : "test") : hasPerm(c, "psych:conduct") ? "psych" : "profile";
      const sec = req.query.s ? `&s=${encodeURIComponent(String(req.query.s).slice(0, 40))}` : "";
      const url = hasPerm(c, "admission:manage") ? await adminCardUrl(l.tenantId, a, tab) : `/workspace/${l.tenantId}/exams?side=psych&open=${a.id}&ctab=${tab}`;
      return res.json({ success: true, mode: "staff", org, who: c.name, url: `${url}${sec}`, child: a.child.name, refNo: a.refNo });
    }
    const signedIn = !!c;
    if (l.purpose === "card") return res.json({ success: true, mode: "staff_only", org, signedIn });
    if (l.purpose === "referral") {
      const r = await syncReferral(l.tenantId, a).catch(() => a.referral);
      // Согласие дано родителем в анкете — на странице теста его не спрашиваем (сервер проверяет то же).
      const consented = (await col(l.tenantId, "applicant_forms").where("applicantId", "==", a.id).get()).docs.some(d => !!d.data().consent);
      const exam = r?.examId ? (await tenantExams(l.tenantId)).find(e => e.id === r.examId) : null;
      // Сдал — по этому же QR смотрит результаты, но только после обратной связи администрации.
      const done = (await attemptsOf(l.tenantId, [a.id])).filter(x => x.status === "finished" && !x.superseded)
        .sort((x, y) => (y.finishedAt || 0) - (x.finishedAt || 0))[0];
      const open = !!done && !!candidateOf(a)?.feedbackGiven;
      return res.json({
        success: true, mode: "student", org, signedIn,
        child: { name: a.child.name, grade: a.child.grade },
        exam: r?.examCode && !exam?.settings.paper ? { code: r.examCode, title: r.examTitle } : null,
        paper: !!exam?.settings.paper,
        tested: !!done,
        results: open ? {
          examTitle: done.examTitle,
          subjects: done.sections.map((x: any) => { const lv = subjectLevel(x, done.parts, done.levels); return { title: x.title, percent: x.percent, level: lv.own || LEVEL_WORD[lv.band] }; }),
        } : null,
        referred: !!r,
        // Поля «о себе» на странице теста — из карточки, ученику остаётся проверить.
        // Для подстановки на странице теста — пока тест не сдан; потом по QR видны только результаты.
        prefill: done ? {} : { birthDate: a.child.birthDate || "", school: a.child.school || "", parentName: a.parent.name || "", parentPhone: a.parent.phone || "" },
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
    // После встречи с психологом ответы зафиксированы — по ссылке (её могли
    // переслать или сфотографировать) их больше не показываем, только статус.
    return res.json({
      success: true, mode: "parent", org, signedIn, locked, template: locked ? { ...tpl, sections: [] } : tpl,
      answers: locked ? {} : { ...prefill, ...(prev?.answers || {}) }, done: prev?.status === "done", grade: a.child.grade,
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
    await notifyAdmission(t, a, "parent", { uid: "", name: "заполнил родитель" });
    return res.json({ success: true });
  } catch (e: any) { return oops(res, e); }
});

export default router;
