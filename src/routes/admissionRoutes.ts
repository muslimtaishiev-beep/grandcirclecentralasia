import { bumpLive, liveOnWrite } from "../server/live.js";
import { fmtIn, orgTimeZone } from "../server/orgTime.js";
import { deliver } from "../server/notify.js";
import { Router } from "express";
import admin from "firebase-admin";
import { randomBytes, randomInt } from "crypto";
import { requireFirebaseAuth } from "./authRoutes.js";
import { hasPerm, membersWith, optionalAuth, requirePerm, staffCaller, type StaffCaller } from "../server/access.js";
import { appUrl, registerResender, sendTemplated, type SendResult } from "../server/emailEvents.js";
import { verifySession } from "../server/session.js";
import { checkTenantOpen, requireScreen } from "../server/tenantAccess.js";
import { tenantLogos } from "../shared/legal.js";
import { buildView } from "../server/resultPages.js";
import { resendExamResultsReady } from "../server/examResults.js";
import type { ResultData } from "../shared/resultPages.js";
import { LEGAL_VERSION } from "../shared/legalDocs.js";
import { REG_PRESETS, paperResult, partResults, sanitizeSections, sanitizeSettings, type Exam, type ExamResult } from "../shared/examRun.js";
import { NEUTRAL_CANDIDATE_FORM, sanitizeCandidateForm, type CandidateFormConfig } from "../shared/candidateForm.js";
import {
  answerText, dropHidden, gradeOf, missingFor, outcomeOf, sanitizeAnswers, sanitizeTemplate, visibleItemIds,
  type QAnswers, type QBind, type QTemplate,
} from "../shared/questionnaires.js";
import { applicantAudit, diffRows, STUDENT, SYSTEM, type AuditChange, type AuditWho } from "../server/applicantAudit.js";
import {
  admitted, admittedByStages, isAdmissionExam, applicantPath, candidateOf, examForApplicant, sanitizeCandidate, stageOf, subjectLevel,
  type Applicant, type ApplicantForm, type CandidateInfo, type LinkPurpose, type StageSummary,
} from "../shared/admissions.js";
import { cancelJob, registerJobHandler, scheduleJob } from "../server/scheduler.js";
import { SOURCE_SLOT, answered, cardValue, intakeTemplate, profileAnswers, splitIntake } from "../shared/candidateIntake.js";
import { isPermissionKey, type PermissionKey } from "../shared/permissions.js";

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
// Любое изменение поступающих — открытые списки и карточка обновляются сами.
router.use("/:tenantId/applicants", liveOnWrite(["admissions"], /^\/([^/]+)/));
const col = (t: string, name: string) => db().collection("tenants").doc(t).collection(name);
const LINKS = "applicant_links";
const str = (v: unknown, max = 200) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const fail = (res: any, status: number, error: string, extra: object = {}) => res.status(status).json({ success: false, error, ...extra });
const oops = (res: any, e: any) => { console.error("[admissions]", e?.message || e); return fail(res, 500, "Не получилось — попробуйте ещё раз"); };
const newToken = () => randomBytes(24).toString("base64url");
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const deep = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

const ANY: PermissionKey[] = ["admission:manage", "psych:conduct", "psych:view"];
/** Права, которые анкеты организации дают заполнять или видеть, — с ними тоже пускаем в раздел. */
async function templatePerms(t: string): Promise<PermissionKey[]> {
  const ts = await loadTemplates(t);
  return [...new Set(ts.filter(x => !x.archived).flatMap(x => [x.fillPermission, x.viewPermission]).filter((k): k is PermissionKey => !!k && isPermissionKey(k)))];
}
/** Кто работает с поступающими: права приёма или право из какой-либо анкеты. */
async function admissionPerms(t: string): Promise<PermissionKey[]> { return [...new Set([...ANY, ...(await templatePerms(t))])]; }
const admissionAccess = async (req: any, res: any, next: any) => {
  try {
    const t = String(req.params.tenantId || "");
    const c = await staffCaller(db(), t, req.user);
    if (!c?.member) return fail(res, 403, "Доступно только сотрудникам организации");
    if (!hasPerm(c, ...ANY) && !hasPerm(c, ...(await templatePerms(t)))) return fail(res, 403, "Недостаточно прав");
    req.caller = c; next();
  } catch (e: any) { return oops(res, e); }
};
const staff = [requireFirebaseAuth, requireScreen("admissions", (req: any) => req.params.tenantId), admissionAccess];
const auth = optionalAuth(t => verifySession(t));

// ── Права на анкеты ─────────────────────────────────────────────────────

/** Заполнять: анкету родителя за него — приёмная; анкету сотрудника — по праву шаблона. */
const canFill = (c: StaffCaller, t: QTemplate) =>
  t.audience === "parent" ? hasPerm(c, "admission:manage") : t.fillPermission ? hasPerm(c, t.fillPermission) : hasPerm(c, "admission:manage");
/** Видеть содержимое целиком. */
const canSee = (c: StaffCaller, t: QTemplate) => !t.sensitive || canFill(c, t) || (!!t.viewPermission && hasPerm(c, t.viewPermission));
/** Править шаблон: владелец, настройки, приёмная — или тот, кто по нему работает (специалист правит нормы). */
const canEditTemplate = (c: StaffCaller, t?: QTemplate) =>
  hasPerm(c, "settings:manage", "admission:manage") || (!!t?.fillPermission && hasPerm(c, t.fillPermission));
/** Тест, бумажные результаты и решение — академическая часть: специалистам по анкетам их не отдаём. */
const seesAcademic = (c: StaffCaller) => hasPerm(c, "admission:manage", "tests:manage", "placement:manage", "tests:review");
/**
 * Что можно этому сотруднику: администрация приёма; «проводит анкеты» — по праву
 * «вести сессии» или по праву хотя бы одной анкеты организации; «видит анкеты» — аналогично.
 */
const meOf = (c: StaffCaller, ts: QTemplate[] = []) => {
  const staffTpls = ts.filter(x => !x.archived && x.audience === "staff");
  return {
    admission: hasPerm(c, "admission:manage"),
    conduct: hasPerm(c, "psych:conduct") || staffTpls.some(x => canFill(c, x)),
    viewAll: hasPerm(c, "psych:view") || staffTpls.some(x => canSee(c, x)),
    academic: seesAcademic(c), name: c.name, owner: c.full,
  };
};
/** Доступ к анкете — всегда по действующему шаблону: снимок хранит только вопросы и нормы. */
const withAccess = (snap: QTemplate, cur?: QTemplate): QTemplate => (cur ? { ...snap, fillPermission: cur.fillPermission, viewPermission: cur.viewPermission, sensitive: cur.sensitive } : snap);
const LEVEL_WORD = ["Низкий", "Средний", "Отличный"] as const;

// ── Уведомления администрации ───────────────────────────────────────────

type AdmissionEvent = "new" | "parent" | "session" | "done" | "test_start" | "section" | "tested" | "results" | "decision" | "publish_failed";
type Audience = "admin" | "staff";
/**
 * Кому и с каким заголовком. Администрация (право приёма) — обо всём ходе
 * приёма; специалисты (проводят анкеты) — о новом ученике и о готовой
 * анкете родителя: это их работа на сессию. Что кому приходит на самом
 * деле — по личным настройкам (профиль → «Уведомления»).
 */
const EVENT_PLAN: Record<AdmissionEvent, Partial<Record<Audience, string>>> = {
  new: { admin: "Новый поступающий", staff: "К вам новый ученик" },
  parent: { admin: "Анкета родителя заполнена", staff: "Анкета родителя заполнена" },
  session: { admin: "Начата анкета специалиста" },
  done: { admin: "Сессия завершена — выдайте направление" },
  test_start: { admin: "Начал тест" },
  section: { admin: "Закончил часть теста" },
  tested: { admin: "Тест сдан" },
  results: { admin: "Результаты теста внесены" },
  decision: { admin: "Решение по кандидату" },
  publish_failed: { admin: "Публикация по таймеру не выполнена" },
};
const AUDIENCE_PERMS: Record<Audience, PermissionKey[]> = { admin: ["admission:manage"], staff: ["psych:conduct"] };
/**
 * Ход приёма — в колокольчик и Telegram (кроме автора). Одна запись на
 * ребёнка и адресата: показывает последний шаг, а не копит десяток строк
 * про одного ученика. У кого оба права (или полный доступ) — получает как
 * администрация. Ошибка рассылки не ломает сохранение.
 */
export async function notifyAdmission(t: string, a: Applicant, ev: AdmissionEvent, c: { uid: string; name: string }, o: { tid?: string; outcome?: string; referral?: boolean; summary?: string } = {}) {
  // Шаг пришёл и без сотрудника (анкета родителя, тест) — открытые экраны всё равно обновятся.
  await bumpLive(t, ["admissions"], a.id);
  try {
    const plan = EVENT_PLAN[ev];
    const who = `${a.child.name}, ${a.child.grade} класс`;
    const body = ev === "done" ? [who, o.outcome, o.referral ? "направление готово" : ""].filter(Boolean).join(" · ")
      : ev === "tested" || ev === "results" || ev === "section" || ev === "decision" || ev === "publish_failed" ? [who, o.summary, ev === "results" || ev === "decision" ? c.name : ""].filter(Boolean).join(" · ")
      : [who, c.name].filter(Boolean).join(" · ");
    const adminTab = ev === "new" ? "profile" : ev === "parent" ? "parent" : ["test_start", "section", "tested", "results", "decision", "publish_failed"].includes(ev) ? "test" : o.tid || "own";
    const sent = new Set<string>([c.uid]);
    const adminUrl = plan.admin ? await adminCardUrl(t, a, adminTab) : "";
    for (const aud of ["admin", "staff"] as Audience[]) {
      const title = plan[aud];
      if (!title) continue;
      const url = aud === "admin" ? adminUrl : applicantPath(t, a.id, o.tid || "own", "staff");
      const perms = aud === "staff" ? [...AUDIENCE_PERMS.staff, ...(await loadTemplates(t)).filter(x => x.audience === "staff" && !x.archived && x.fillPermission && isPermissionKey(x.fillPermission)).map(x => x.fillPermission as PermissionKey)] : AUDIENCE_PERMS[aud];
      const uids = (await membersWith(db(), t, [...new Set(perms)])).map(r => r.uid).filter(u => !sent.has(u));
      uids.forEach(u => sent.add(u));
      await deliver({ tenantId: t, event: `adm.${ev}`, uids, title, body, url, type: "admission", docId: u => `adm_${a.id}_${u}`, extra: { applicantId: a.id } });
    }
  } catch (e) { console.error("[admissions] notify:", e); }
}

/** Шаг теста поступающего (начал, закончил часть) — уведомление администрации. */
export async function notifyApplicantStep(t: string, applicantId: string, ev: "test_start" | "section", summary: string) {
  const a = await loadApplicant(t, applicantId).catch(() => null);
  if (!a) return;
  await audit(t, a.id, STUDENT(a.child.name), ev === "test_start" ? "test_started" : "test_section", summary);
  await notifyAdmission(t, a, ev, { uid: "", name: "" }, { summary });
}

/** Адрес карточки у администрации — раздел «Приём»: туда пускает право приёма, а не права на экзамены. */
async function adminCardUrl(t: string, a: Pick<Applicant, "id">, ctab: string) {
  return applicantPath(t, a.id, ctab);
}

/** Итог теста одной строкой — для уведомления. */
const resultSummary = (exam: Pick<Exam, "settings">, r: Pick<ExamResult, "sections" | "percent"> | null | undefined) => {
  if (!r) return "";
  const parts = partResults(r.sections, exam.settings.scoring);
  return parts.length ? parts.map(p => `${p.title}: ${p.value}`).join(" · ") : `${r.percent}%`;
};

type TestedAttempt = { id?: string; applicantId?: string; result?: ExamResult | null; shortId?: string; student?: { name?: string; email?: string } };

/** Ученик сдал тест — сообщить администрации (по направлению) и письмо по шаблону экзамена. */
export async function notifyTested(t: string, x: TestedAttempt, exam: Exam) {
  // Сдал вступительный экзамен без направления — работа сама попадает в «Поступающие».
  if (!x.applicantId && x.id && isAdmissionExam(exam)) {
    const r = await linkAttempt(t, x.id, { uid: "", name: "Система" }).catch(e => { console.warn("[admissions] link", e?.message); return null; });
    if (r && "applicantId" in r) (x as any).applicantId = r.applicantId;
  }
  const a = x.applicantId ? await loadApplicant(t, x.applicantId).catch(() => null) : null;
  if (a) await audit(t, a.id, STUDENT(a.child.name), "tested", [exam.title, resultSummary(exam, x.result)].filter(Boolean).join(" · "));
  await emailTested(t, x, exam, a);
  if (a) await notifyAdmission(t, a, "tested", { uid: "", name: "" }, { summary: resultSummary(exam, x.result) });
}

/**
 * Письмо после теста. Поступающему — на почту родителя со ссылкой
 * направления (результат там откроется после обратной связи), без балла.
 * Остальным — на почту из регистрации; балл — только если результат
 * показывается ученику сразу и без проверки.
 */
async function emailTested(t: string, x: TestedAttempt, exam: Exam, a: Applicant | null, o: { force?: boolean; by?: string } = {}): Promise<SendResult> {
  const settings = sanitizeSettings(exam.settings);
  const templateId = settings.results.emailTemplate || "";
  if (!templateId || !x.id) return { sent: false, reason: "В настройках экзамена не выбран шаблон письма" };
  const base = await appUrl();
  const vars: Record<string, string> = { экзамен: exam.title || "", номер: x.shortId || "" };
  let to = "";
  if (a) {
    to = familyEmails(a);
    Object.assign(vars, { имя: a.parent.name, ребёнок: a.child.name, класс: a.child.grade, ссылка: `${base}/a/${await referralTokenFor(t, a)}` });
  } else {
    to = String(x.student?.email || "");
    // Почту на этом экзамене не спрашивали — писать некуда, и это не ошибка.
    if (!to && !o.force) return { sent: false, skipped: true, reason: "Почту у ученика не спрашивали" };
    Object.assign(vars, { имя: String(x.student?.name || ""), ссылка: exam.code ? `${base}/exam/${exam.code}/result` : "" });
    const open = settings.results.showToStudent === "immediately" && !settings.results.requireReview;
    if (open && x.result) Object.assign(vars, { балл: `${x.result.earned} из ${x.result.max}`, процент: `${x.result.percent}%` });
  }
  const who = a ? `${a.child.name}, ${a.child.grade} класс` : String(x.student?.name || "");
  const r = await sendTemplated({
    tenantId: t, templateId, to, vars, event: "tested", refId: `${t}_${x.id}`, force: o.force, by: o.by,
    ctx: { attemptId: x.id, examId: exam.id, ...(a ? { applicantId: a.id } : {}), label: `${who} · ${exam.title || ""}` },
    actionUrl: a ? await adminCardUrl(t, a, "profile") : `/workspace/${t}/exams/${exam.id}`,
    noRecipient: a ? "Нет почты родителя" : "Нет почты ученика",
    mirror: { ref: col(t, "exam_attempts").doc(x.id), field: "resultEmail" },
  });
  if (a) await auditEmail(t, a.id, "Письмо после теста", r);
  return r;
}

/** Письмо — в историю: ушло (кому) или не ушло (почему). Повтор того же события не пишем. */
async function auditEmail(t: string, applicantId: string, what: string, r: SendResult) {
  if (r.skipped) return;
  await audit(t, applicantId, SYSTEM, r.sent ? "email_sent" : "email_failed", r.sent ? `${what} · ${r.to || ""}` : `${what} · ${r.reason || ""}`);
}
registerResender("tested", async (t, ctx, by) => {
  if (!ctx.attemptId) return { sent: false, reason: "Нет работы" };
  const s = await col(t, "exam_attempts").doc(ctx.attemptId).get();
  const x = s.data();
  if (!x || x.status !== "finished") return { sent: false, reason: "Работа не завершена" };
  const es = await col(t, "exams").doc(String(x.examId)).get();
  if (!es.exists) return { sent: false, reason: "Экзамен удалён" };
  const exam = { ...(es.data() as Exam), id: es.id };
  const a = x.applicantId ? await loadApplicant(t, x.applicantId).catch(() => null) : null;
  return emailTested(t, { ...(x as any), id: s.id }, exam, a, { force: true, by });
});

/** Карточка без академической части: этап — не дальше направления. */
const withoutAcademic = (a: Applicant): Applicant => ({ ...a, decision: null, candidate: null, paperResults: [] });

// ── Данные ──────────────────────────────────────────────────────────────

/** Анкеты организации. Новая организация начинает с пустого списка — свои анкеты создаёт сама. */
async function loadTemplates(t: string): Promise<QTemplate[]> {
  const snap = await col(t, "questionnaire_templates").get();
  return snap.docs.map(d => ({ ...(d.data() as QTemplate), id: d.id }));
}

/** Вид анкеты кандидата организации; не настроен — нейтральный. */
export async function loadCandidateForm(t: string): Promise<CandidateFormConfig> {
  const s = await col(t, "admission_meta").doc("candidate_form").get();
  return s.exists ? (s.data() as CandidateFormConfig) : NEUTRAL_CANDIDATE_FORM;
}
const byId = (ts: QTemplate[]) => Object.fromEntries(ts.map(x => [x.id, x]));
/** Действующая анкета родителя: на её ответы ссылаются условия в анкетах сотрудников. */
const parentTemplate = (ts: QTemplate[]) => ts.find(x => x.audience === "parent" && !x.archived) || null;
/** Ответы родителя по поступающему — для условий в анкетах сотрудников. */
async function parentAnswers(t: string, applicantId: string): Promise<QAnswers | undefined> {
  const snap = await col(t, "applicant_forms").where("applicantId", "==", applicantId).get();
  const f = snap.docs.map(d => d.data() as ApplicantForm).find(x => x.template?.audience === "parent");
  return f?.answers || {};
}

/**
 * Откуда анкета кандидата берёт ответы на вопросы анкеты родителя: только
 * пункты, вынесенные в анкету кандидата и видимые этому ребёнку, с ответами
 * из всех источников. Остальное содержимое анкеты родителя сюда не попадает.
 */
function sheetSource(a: Applicant, form: CandidateFormConfig, tpl: QTemplate | null, parent?: QAnswers | null): { template: Pick<QTemplate, "sections">; answers: QAnswers } | null {
  if (!tpl) return null;
  const all = profileAnswers(a, tpl, parent);
  const shown = visibleItemIds(tpl, gradeOf(a.child.grade), { answers: all });
  const want = new Set(form.fields.filter(f => f.source.startsWith("answer:")).map(f => f.source.slice(7)));
  const items = tpl.sections.flatMap(x => x.items).filter(i => want.has(i.id) && shown.has(i.id)).map(({ when: _w, ...i }) => i);
  // Ни один вопрос не виден — пустой пункт-заглушка, чтобы скрытые условием поля не показались пустыми строками.
  return { template: { sections: [{ id: "sheet", title: "", items: items.length ? items : [{ id: "_", kind: "note", label: "" }] }] }, answers: Object.fromEntries(items.map(i => [i.id, all[i.id]]).filter(([, v]) => v)) };
}

/** Анкета родителя поступающего: её запись (черновик или отправленная) и шаблон. */
async function parentDocOf(t: string, applicantId: string): Promise<ApplicantForm | null> {
  const snap = await col(t, "applicant_forms").where("applicantId", "==", applicantId).get();
  return snap.docs.map(d => d.data() as ApplicantForm).find(f => f.template?.audience === "parent") || null;
}

/**
 * Вопросы ученику перед вступительным тестом — из анкеты кандидата
 * организации. По направлению (a — карточка) — только то, чего ещё нет;
 * без направления — всё, кроме того, что спрашивает сама регистрация.
 */
export async function intakeFor(t: string, exam: Exam, a: Applicant | null): Promise<QTemplate | null> {
  if (!isAdmissionExam(exam)) return null;
  const [form, templates] = await Promise.all([loadCandidateForm(t), loadTemplates(t)]);
  if (a) {
    const pd = await parentDocOf(t, a.id);
    return intakeTemplate({ form, parentTpl: pd?.template || parentTemplate(templates), grade: gradeOf(a.child.grade), card: a, parentAnswers: pd?.answers });
  }
  const reg = exam.settings.registration; const grades = exam.settings.admission?.grades || [];
  const skip: QBind[] = ["child.name", ...(reg.phone ? ["child.phone" as const] : []), ...(reg.email ? ["child.email" as const] : [])];
  return intakeTemplate({ form, parentTpl: parentTemplate(templates), grade: grades.length === 1 ? grades[0] : null, skip });
}

export interface IntakeRead { answers: QAnswers; error: string | null; rows: { label: string; value: string }[]; extra: Record<string, string>; email: string }
const INTAKE_EXTRA: Partial<Record<QBind, string>> = { "child.birthDate": "birthDate", "child.school": "school", "child.phone": "studentPhone", "parent.name": "parentName", "parent.phone": "parentPhone", "parent.email": "parentEmail" };
/** Ответы ученика на вопросы перед тестом: проверка и вид для работы (строки «о себе»). */
export function readIntake(tpl: QTemplate | null, raw: unknown, grade: number | null, legacy?: Record<string, unknown> | null): IntakeRead {
  const out: IntakeRead = { answers: {}, error: null, rows: [], extra: {}, email: "" };
  if (!tpl) return out;
  const items = tpl.sections.flatMap(x => x.items);
  // Страница, открытая до обновления, присылает прежние поля «о себе» — принимаем их как ответы на те же вопросы.
  const old: Record<string, unknown> = {};
  for (const i of items) { const k = i.bind ? INTAKE_EXTRA[i.bind] : undefined; if (k && legacy?.[k]) old[i.id] = { value: legacy[k] }; }
  const answers = dropHidden(tpl, sanitizeAnswers(tpl, { ...old, ...(raw && typeof raw === "object" ? raw : {}) }), grade);
  for (const i of items) {
    const v = String(answers[i.id]?.value ?? "");
    if (!v || Array.isArray(answers[i.id]?.value)) continue;
    if (i.kind === "phone" && v.replace(/\D/g, "").length < 9) delete answers[i.id];
    if (i.kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) delete answers[i.id];
    if ((i.bind === "child.email" || i.bind === "parent.email") && !cleanEmail(v)) { out.error = `Проверьте: ${i.label}`; return out; }
  }
  const miss = missingFor(tpl, answers, grade, null);
  if (miss.length) { out.error = `Заполните: ${miss.slice(0, 4).join(", ")}`; return out; }
  out.answers = answers;
  for (const i of items) {
    if (!answered(answers[i.id])) continue;
    const text = answerText(i, answers[i.id]);
    out.rows.push({ label: i.label, value: i.kind === "date" ? ruDate(text) || text : text });
    if (i.bind === "child.email") out.email = cleanEmail(text);
    const k = i.bind ? INTAKE_EXTRA[i.bind] : undefined;
    if (k) out.extra[k] = text;
  }
  return out;
}

/** Ответы ученика — в карточку: её пустые поля и ответы на вопросы анкеты (то, что уже есть, не трогаем). */
export async function applyIntake(t: string, a: Applicant, tpl: Pick<QTemplate, "sections"> | null, answers: QAnswers): Promise<void> {
  if (!tpl || !Object.keys(answers).length) return;
  const bound = bindToCard(a, tpl, answers, false);
  const { free } = splitIntake(tpl, answers);
  const intake = { ...free, ...Object.fromEntries(Object.entries(a.intake || {}).filter(([, v]) => answered(v))) };
  await col(t, "applicants").doc(a.id).update(deep({ ...bound, intake, updatedAt: Date.now() }));
  const items = tpl.sections.flatMap(x => x.items);
  const changes = diffRows(items.filter(i => answered(answers[i.id])).map(i => [i.label, i.bind ? cardValue(a, i.bind) : answerText(i, a.intake?.[i.id]), i.bind ? cardValue(bound, i.bind) : answerText(i, intake[i.id])] as [string, unknown, unknown]));
  if (changes.length) await audit(t, a.id, STUDENT(a.child.name), "intake", "", changes);
}

async function loadApplicant(t: string, id: string): Promise<Applicant | null> {
  if (!ID.test(id)) return null;
  const s = await col(t, "applicants").doc(id).get();
  return s.exists ? ({ ...(s.data() as any), id: s.id }) : null;
}

/** Событие в историю поступающего (кто: сотрудник; null — родитель; SYSTEM — система). */
async function audit(t: string, applicantId: string, c: AuditWho, action: string, detail = "", changes: AuditChange[] = []) {
  await applicantAudit(t, applicantId, c ? { uid: c.uid, name: c.name } : null, action, detail, changes);
}

/** Какие ответы анкеты поменялись: вопрос — было — стало. */
function answerChanges(tpl: QTemplate, before: QAnswers | undefined, after: QAnswers): AuditChange[] {
  const items = tpl.sections.flatMap(x => x.items);
  return diffRows(items.map(i => [i.label || i.id, answerText(i, before?.[i.id]), answerText(i, after[i.id])] as [string, unknown, unknown]));
}

/** Действия по разделу (анкеты, вид анкеты кандидата, удаления) — в общую историю приёма. */
const SECTION = "_section";
const sectionAudit = (t: string, c: AuditWho, action: string, detail = "", changes: AuditChange[] = [], templateId?: string) =>
  applicantAudit(t, SECTION, c, action, detail, changes, templateId ? { templateId } : {});

/**
 * Страница истории: новые сверху, по 100, с подгрузкой (before) и фильтром
 * по виду события. «Было → стало» по анкете видит только тот, кому эта
 * анкета открыта; у старых записей без метки анкета узнаётся по названию.
 */
async function historyPage(t: string, applicantId: string, c: StaffCaller, templates: QTemplate[], o: { before?: number; kind?: string }) {
  let q: FirebaseFirestore.Query = col(t, "applicant_audit").where("applicantId", "==", applicantId);
  const all = (await q.get()).docs.map(d => d.data() as any).sort((x, y) => y.at - x.at);
  const KINDS: Record<string, (a: string) => boolean> = {
    forms: a => a.startsWith("form_") || a.startsWith("parent_form"),
    views: a => a === "viewed",
    referral: a => a.startsWith("referral"),
    test: a => a.startsWith("test") || a === "tested" || a.startsWith("paper") || a === "attempt",
    decision: a => a === "candidate" || a === "decision" || a === "feedback",
    email: a => a.startsWith("email") || a === "referral_emailed",
    card: a => ["created", "edited", "archived", "restored", "deleted", "relink"].includes(a),
  };
  const pick = o.kind && KINDS[o.kind] ? KINDS[o.kind] : () => true;
  const hidden = (x: any) => {
    const tpl = x.templateId ? templates.find(tt => tt.id === x.templateId) : (x.action?.startsWith("form_") ? templates.find(tt => String(x.detail || "").startsWith(tt.title)) : undefined);
    if (x.action?.startsWith("form_") && !tpl) return true; // анкету не узнать — изменения не показываем
    return !!tpl && !canSee(c, tpl);
  };
  const rows = all.filter(x => (!o.before || x.at < o.before) && pick(String(x.action || "")));
  const items = rows.slice(0, 100).map(x => (x.changes && hidden(x) ? { ...x, changes: undefined } : x));
  return { items, more: rows.length > 100 };
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

/**
 * Ответы, привязанные к карточке, заполняют её поля: пустые — всегда;
 * заполненные сами (анкетой или учеником, autoFilled) — только анкета
 * родителя (refine); то, что вписал сотрудник, не трогается.
 */
export function bindToCard(a: Applicant, tpl: Pick<QTemplate, "sections">, answers: QAnswers, refine: boolean): Pick<Applicant, "child" | "parent" | "autoFilled"> {
  const patch: any = { child: { ...a.child }, parent: { ...a.parent } };
  const auto = new Set(a.autoFilled || []);
  const set = (b: QBind, v: string) => {
    const [k, f] = b.split(".") as ["child" | "parent", string];
    if (b === "child.birthDate" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return; // в карточку — только настоящая дата
    if (b === "parent.email" || b === "child.email") v = cleanEmail(v);
    if (!v || patch[k][f] === v) return;
    if (!patch[k][f] || (refine && auto.has(b))) { patch[k][f] = v; auto.add(b); }
  };
  for (const i of tpl.sections.flatMap(s => s.items)) if (i.bind) set(i.bind, str(answers[i.id]?.value, 120));
  patch.autoFilled = [...auto];
  return patch;
}
/** Сотрудник поправил поле карточки — оно больше не «заполнено само»: анкета его не перезапишет. */
function keepAuto(a: Applicant, child: Applicant["child"], parent: Applicant["parent"]): string[] {
  return (a.autoFilled || []).filter(b => cardValue(a, b) === cardValue({ child, parent }, b));
}
/** Почты семьи — письмо о результатах уходит и родителю, и ученику. */
const familyEmails = (a: Applicant) => [...new Set([a.parent?.email, a.child?.email].map(cleanEmail).filter(Boolean))].join(", ");

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
  const allExams = exams || await tenantExams(t);
  const tpls = templates || await loadTemplates(t);
  const g = gradeOf(a.child.grade);
  // Экзамен класса без этапов «до теста» — пускает сразу.
  const noStages = g !== null && allExams.some(e => !e.archived && e.status !== "closed" && (e.settings.admission?.grades || []).includes(g) && !(e.settings.admission?.stages || []).length);
  if (!override && !admitted(a, noStages)) {
    if (a.referral) {
      await col(t, "applicants").doc(a.id).update({ referral: null, updatedAt: Date.now() });
      if (!a.referralBlocked) await audit(t, a.id, SYSTEM, "referral_revoked", "итог не пускает к тесту");
    }
    return null;
  }
  // Допуск только по «экзамену без этапов» — из таких и выбираем.
  const pool = override || admittedByStages(a) ? allExams : allExams.filter(e => !(e.settings.admission?.stages || []).length);
  const exam = examForApplicant(pool, a, byId(tpls), override);
  const want = { examId: exam?.id || null, examTitle: exam?.title || "", examCode: exam?.code || null };
  if (a.referral && a.referral.examId === want.examId && a.referral.examTitle === want.examTitle) return a.referral;
  await referralTokenFor(t, a);
  const referral = {
    ...want, issuedAt: a.referral?.issuedAt || Date.now(),
    by: a.referral?.by || "auto", byName: a.referral?.byName || "По заключению", manual: override, reason: a.referral?.reason || "",
  };
  await col(t, "applicants").doc(a.id).update({ referral, updatedAt: Date.now() });
  await audit(t, a.id, SYSTEM, a.referral?.examId ? "referral_changed" : "referral_issued", want.examTitle || "экзамен для класса ещё не открыт");
  return referral;
}

/**
 * Письмо родителю с направлением — шаблоном, выбранным в настройках
 * экзамена направления. Одно письмо на направление (журнал email_log);
 * force — ручная кнопка «На почту», отправит повторно.
 */
export async function emailReferral(t: string, applicantId: string, o: { force?: boolean; by?: string } = {}): Promise<SendResult> {
  try {
    const a = await loadApplicant(t, applicantId);
    if (!a?.referral?.examId) return { sent: false, reason: "Нет направления на экзамен" };
    const es = await col(t, "exams").doc(a.referral.examId).get();
    const templateId = sanitizeSettings(es.data()?.settings).admission?.referralEmail || "";
    if (!templateId) return { sent: false, reason: "В настройках экзамена не выбран шаблон письма" };
    const token = await referralTokenFor(t, a);
    const r = await sendTemplated({
      tenantId: t, templateId, to: a.parent.email || "", event: "referral", refId: `${t}_${a.id}_${a.referral.examId}`, force: o.force, by: o.by,
      ctx: { applicantId: a.id, examId: a.referral.examId, label: `${a.child.name}, ${a.child.grade} класс` },
      actionUrl: await adminCardUrl(t, a, "profile"), noRecipient: "Нет почты родителя",
      mirror: { ref: col(t, "applicants").doc(a.id), field: "referralEmail" },
      vars: {
        имя: a.parent.name, ребёнок: a.child.name, класс: a.child.grade, экзамен: a.referral.examTitle || String(es.data()?.title || ""),
        код: a.referral.examCode || "", ссылка: `${await appUrl()}/a/${token}`,
      },
    });
    await auditEmail(t, a.id, "Направление", r);
    return r;
  } catch (e) { console.error("[admissions] referral email", e); return { sent: false, reason: "Не удалось отправить" }; }
}
registerResender("referral", (t, ctx, by) => (ctx.applicantId ? emailReferral(t, ctx.applicantId, { force: true, by }) : Promise.resolve({ sent: false, reason: "Нет карточки" })));

async function admissionSettings(t: string): Promise<{ parentFormEmail?: string; decisionEmail?: string }> {
  return (await col(t, "admission_meta").doc("settings").get()).data() || {};
}

/** Анкета родителю на почту — ссылкой; шаблон — в настройках анкет. */
export async function emailParentForm(t: string, a: Applicant, o: { force?: boolean; by?: string } = {}): Promise<SendResult> {
  try {
    const templateId = (await admissionSettings(t)).parentFormEmail || "";
    if (!templateId) return { sent: false, skipped: !o.force, reason: "В настройках анкет не выбрано письмо «Анкета родителю»" };
    if (!a.tokens?.parent) return { sent: false, reason: "Нет ссылки на анкету" };
    const r = await sendTemplated({
      tenantId: t, templateId, to: a.parent.email || "", event: "parent_form", refId: `${t}_${a.id}`, force: o.force, by: o.by,
      ctx: { applicantId: a.id, label: `${a.child.name}, ${a.child.grade} класс` },
      actionUrl: applicantPath(t, a.id, "profile"), noRecipient: "Нет почты родителя",
      mirror: { ref: col(t, "applicants").doc(a.id), field: "parentFormEmail" },
      vars: { имя: a.parent.name, ребёнок: a.child.name, класс: a.child.grade, ссылка: `${await appUrl()}/a/${a.tokens.parent}` },
    });
    await auditEmail(t, a.id, "Анкета родителю", r);
    return r;
  } catch (e) { console.error("[admissions] parent email", e); return { sent: false, reason: "Не удалось отправить" }; }
}
registerResender("parent_form", async (t, ctx, by) => {
  const a = ctx.applicantId ? await loadApplicant(t, ctx.applicantId) : null;
  return a ? emailParentForm(t, a, { force: true, by }) : { sent: false, reason: "Нет карточки" };
});

/** Решение — письмом родителю: одно на каждое окончательное решение. */
export async function emailDecision(t: string, a: Applicant, o: { force?: boolean; by?: string } = {}): Promise<SendResult> {
  try {
    const c = candidateOf(a);
    if (!c?.decision) return { sent: false, reason: "Решения ещё нет" };
    if (!c.published) return { sent: false, reason: "Результаты ещё не опубликованы" };
    const templateId = (await admissionSettings(t)).decisionEmail || "";
    if (!templateId) return { sent: false, skipped: !o.force, reason: "В настройках анкет не выбрано письмо «Решение»" };
    const token = await referralTokenFor(t, a);
    const r = await sendTemplated({
      tenantId: t, templateId, to: familyEmails(a), event: "decision", refId: `${t}_${a.id}_${c.decision}`, force: o.force, by: o.by,
      ctx: { applicantId: a.id, label: `${a.child.name}, ${a.child.grade} класс` },
      actionUrl: applicantPath(t, a.id, "test"), noRecipient: "Нет почты родителя и ученика",
      mirror: { ref: col(t, "applicants").doc(a.id), field: "decisionEmail" },
      vars: {
        имя: a.parent.name, ребёнок: a.child.name, класс: a.child.grade, решение: c.decisionLabel,
        обратная_связь: c.feedbackGiven ? c.feedback : "", ссылка: `${await appUrl()}/a/${token}`,
      },
    });
    await auditEmail(t, a.id, "Решение", r);
    return r;
  } catch (e) { console.error("[admissions] decision email", e); return { sent: false, reason: "Не удалось отправить" }; }
}
registerResender("decision", async (t, ctx, by) => {
  const a = ctx.applicantId ? await loadApplicant(t, ctx.applicantId) : null;
  return a ? emailDecision(t, a, { force: true, by }) : { sent: false, reason: "Нет карточки" };
});

/** Экзамен поступающего: тест, который он сдал (последний), иначе экзамен направления. */
async function examOfApplicant(t: string, a: Applicant, doneExamId?: string): Promise<Exam | null> {
  let examId = doneExamId || "";
  if (!examId) {
    const done = (await attemptsOf(t, [a.id])).filter(x => x.status === "finished" && !x.superseded).sort((x, y) => (y.finishedAt || 0) - (x.finishedAt || 0))[0];
    examId = String(done?.examId || a.referral?.examId || "");
  }
  if (!ID.test(examId)) return null;
  const s = await col(t, "exams").doc(examId).get();
  return s.exists ? { ...(s.data() as Exam), id: s.id } : null;
}

/** Письмо «Результаты готовы» со ссылкой на страницу результатов: после публикации, по настройке экзамена или кнопкой. */
export async function emailResultsReady(t: string, a: Applicant, o: { force?: boolean; by?: string } = {}): Promise<SendResult> {
  try {
    const c = candidateOf(a);
    if (!c?.decision) return { sent: false, reason: "Решения ещё нет" };
    if (!c.published) return { sent: false, reason: "Результаты ещё не опубликованы" };
    const exam = await examOfApplicant(t, a);
    const rs = sanitizeSettings(exam?.settings).results;
    const token = await referralTokenFor(t, a);
    const r = await sendTemplated({
      tenantId: t, templateId: rs.readyEmail || "", to: familyEmails(a), event: "results_ready", refId: `${t}_${a.id}_${c.decision}`, force: o.force, by: o.by,
      ctx: { applicantId: a.id, examId: exam?.id, label: `${a.child.name}, ${a.child.grade} класс` },
      actionUrl: applicantPath(t, a.id, "test"), noRecipient: "Нет почты родителя и ученика",
      mirror: { ref: col(t, "applicants").doc(a.id), field: "resultsEmail" },
      vars: { имя: a.parent.name, ребёнок: a.child.name, класс: a.child.grade, экзамен: exam?.title || "", ссылка: `${await appUrl()}/a/${token}` },
    });
    await auditEmail(t, a.id, "Результаты готовы", r);
    return r;
  } catch (e) { console.error("[admissions] results-ready email", e); return { sent: false, reason: "Не удалось отправить" }; }
}
registerResender("results_ready", async (t, ctx, by) => {
  if (ctx.attemptId && !ctx.applicantId) return resendExamResultsReady(t, ctx.attemptId, by);
  const a = ctx.applicantId ? await loadApplicant(t, ctx.applicantId) : null;
  return a ? emailResultsReady(t, a, { force: true, by }) : { sent: false, reason: "Нет карточки" };
});

const ruDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join(".") : "");

/** Экзамен сохранили (поменяли классы или этапы) — подставить тест всем, кто его ждёт. */
export async function syncAllReferrals(t: string) {
  const [snap, templates, exams] = await Promise.all([col(t, "applicants").get(), loadTemplates(t), tenantExams(t)]);
  for (const d of snap.docs) {
    const a = { ...(d.data() as Applicant), id: d.id };
    if (a.archived) continue;
    await syncReferral(t, a, templates, exams).catch(e => console.warn("[admissions] sync", e?.message));
  }
}

/** Работы поступающих по тесту: статус и итоги частей (без ответов). */
async function attemptsOf(t: string, applicantIds?: string[], detail?: { exams: boolean }) {
  let q: FirebaseFirestore.Query = col(t, "exam_attempts");
  q = applicantIds?.length === 1 ? q.where("applicantId", "==", applicantIds[0]) : q.where("applicantId", "!=", null);
  const snap = await q.select("applicantId", "examId", "examTitle", "status", "shortId", "startedAt", "finishedAt", "result.sections", "result.percent", "result.topics", "decision", "superseded", "paper", "identity", "intake.rows", "student.extra", "student.phone",
    ...(detail ? ["student.name", "student.level", "student.email", "proctoring.enabled", "proctoring.totalViolations", "review.status", "published", "result.earned", "result.max"] : [])).get();
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
      // По направлению в работе записан телефон родителя — телефоном ученика считается только указанный им самим.
      studentPhone: x.student?.extra?.studentPhone || (String(x.identity || "").startsWith("a:") ? "" : x.student?.phone) || "",
      // Всё, что видно в экзамене: анкета при входе, итог, проверка, прокторинг — анкета и прокторинг только с правом на экзамены.
      ...(detail ? {
        examAccess: detail.exams,
        levelLabel: e?.settings.registration.levelLabel || "Класс",
        earned: x.result?.earned ?? null, max: x.result?.max ?? null,
        reviewDone: x.review?.status === "done", published: !!x.published,
        ...(detail.exams ? {
          student: { name: x.student?.name || "", level: x.student?.level || "", phone: x.student?.phone || "", email: x.student?.email || "" },
          // Что ученик ответил перед тестом: вопросы анкеты кандидата (intake) или прежние поля «о себе».
          extraRows: Array.isArray(x.intake?.rows) && x.intake.rows.length ? x.intake.rows.map((r: any) => ({ label: String(r.label || ""), value: String(r.value || "") }))
            : Object.entries((x.student?.extra || {}) as Record<string, string>).filter(([, v]) => String(v || "").trim()).map(([id, value]) => ({
              label: (e?.settings.registration.extra || []).find(f => f.id === id)?.label || REG_PRESETS.find(f => f.id === id)?.label || id,
              value: id === "birthDate" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value).toLocaleDateString("ru-RU") : String(value),
            })),
          proctoring: { enabled: !!x.proctoring?.enabled, totalViolations: Number(x.proctoring?.totalViolations) || 0 },
        } : {}),
      } : {}),
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
    published: !!candidateOf(a)?.published, scheduled: candidateOf(a)?.publishAt || null,
    stage: stageOf(a, mine[0] || null), createdAt: a.createdAt, updatedAt: a.updatedAt,
  };
}

const sanitizeChild = (b: any) => ({
  name: str(b?.name, 120), birthDate: /^\d{4}-\d{2}-\d{2}$/.test(String(b?.birthDate)) ? String(b.birthDate) : "", grade: str(b?.grade, 20), school: str(b?.school, 160),
  phone: str(b?.phone, 30), email: cleanEmail(b?.email),
});
function cleanEmail(v: unknown) { const e = str(v, 120).toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : ""; }
const sanitizeParent = (b: any) => ({ name: str(b?.name, 120), phone: str(b?.phone, 30), email: cleanEmail(b?.email) });

// ── Шаблоны анкет ───────────────────────────────────────────────────────

router.get("/:tenantId/templates", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const ts = await loadTemplates(t);
    const c: StaffCaller = req.caller;
    const used = new Set((await col(t, "applicant_forms").select("templateId").get()).docs.map(d => String(d.data().templateId)));
    const settings = (await col(t, "admission_meta").doc("settings").get()).data() || {};
    return res.json({
      success: true, templates: ts.filter(x => !x.archived), archived: ts.filter(x => x.archived),
      used: Object.fromEntries(ts.map(x => [x.id, used.has(x.id)])),
      canEdit: Object.fromEntries(ts.map(x => [x.id, canEditTemplate(c, x)])), canCreate: canEditTemplate(c),
      canAccess: hasPerm(c, "settings:manage"),
      emails: { parentForm: String(settings.parentFormEmail || ""), decision: String(settings.decisionEmail || "") },
    });
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
    await sectionAudit(t, c, "candidate_form_edited", "вид анкеты кандидата");
    return res.json({ success: true, form });
  } catch (e: any) { return oops(res, e); }
});

router.post("/:tenantId/templates", ...staff, async (req: any, res: any) => {
  try {
    if (!canEditTemplate(req.caller)) return fail(res, 403, "Создавать анкеты может приёмная или администратор");
    const id = `tpl_${randomBytes(5).toString("hex")}`;
    const tpl = sanitizeTemplate({ ...req.body, id }, undefined, parentTemplate(await loadTemplates(req.params.tenantId)));
    await col(req.params.tenantId, "questionnaire_templates").doc(id).create(tpl);
    await sectionAudit(req.params.tenantId, req.caller, "template_created", tpl.title, [], id);
    return res.json({ success: true, template: tpl });
  } catch (e: any) { return oops(res, e); }
});

router.put("/:tenantId/templates/:tid", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const tid = String(req.params.tid);
    if (!ID.test(tid)) return fail(res, 400, "Неверная анкета");
    const all = await loadTemplates(t);
    const ref = col(t, "questionnaire_templates").doc(tid);
    const snap = await ref.get();
    if (!snap.exists) return fail(res, 404, "Анкета не найдена");
    const prev = { ...(snap.data() as QTemplate), id: snap.id };
    if (!canEditTemplate(req.caller, prev)) return fail(res, 403, "Нет прав менять эту анкету");
    const c: StaffCaller = req.caller;
    // «Кто заполняет / кто видит» — только настройки организации: иначе приёмная
    // могла бы выдать себе просмотр закрытых анкет, а тот, кто по ним работает, — открыть их всем.
    let body = hasPerm(c, "settings:manage") ? req.body : { ...req.body, fillPermission: prev.fillPermission, viewPermission: prev.viewPermission, sensitive: prev.sensitive };
    // Какие итоги пускают к тесту — решает администрация, не тот, кто заполняет анкету.
    if (!hasPerm(c, "settings:manage", "admission:manage")) body = { ...body, outcome: prev.outcome };
    const tpl = { ...sanitizeTemplate({ ...body, id: tid, audience: prev.audience }, prev, parentTemplate(all)), updatedBy: c.name, updatedAt: Date.now() };
    await ref.set(tpl);
    const accessText = (x: QTemplate) => [x.fillPermission || "", x.viewPermission || "", x.sensitive ? "здоровье" : ""].join(" / ");
    const count = (x: QTemplate) => x.sections.reduce((n, sec) => n + sec.items.length, 0);
    await sectionAudit(t, c, "template_edited", tpl.title, diffRows([
      ["Название", prev.title, tpl.title], ["Блоков", prev.sections.length, tpl.sections.length], ["Вопросов", count(prev), count(tpl)],
      ["Доступ", accessText(prev), accessText(tpl)],
    ]), tid);
    return res.json({ success: true, template: tpl });
  } catch (e: any) { return oops(res, e); }
});

/** Копия анкеты — правится отдельно. Копия анкеты родителя ложится в архив: действующая одна. */
router.post("/:tenantId/templates/:tid/copy", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller; const tid = String(req.params.tid);
    if (!ID.test(tid) || !canEditTemplate(c)) return fail(res, 403, "Нет прав");
    const all = await loadTemplates(t);
    const src = all.find(x => x.id === tid);
    if (!src) return fail(res, 404, "Анкета не найдена");
    const id = `tpl_${randomBytes(5).toString("hex")}`;
    const tpl = { ...sanitizeTemplate({ ...deep(src), id, title: `${src.title} (копия)`.slice(0, 120) }, undefined, parentTemplate(all)), ...(src.audience === "parent" ? { archived: true } : {}), updatedBy: c.name, updatedAt: Date.now() };
    await col(t, "questionnaire_templates").doc(id).create(deep(tpl));
    await sectionAudit(t, c, "template_copied", `${src.title} → ${tpl.title}`, [], id);
    return res.json({ success: true, template: tpl });
  } catch (e: any) { return oops(res, e); }
});

/** В архив / вернуть. Вернуть анкету родителя можно, только если другой действующей нет. */
router.post("/:tenantId/templates/:tid/archive", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller; const tid = String(req.params.tid);
    if (!ID.test(tid)) return fail(res, 400, "Неверная анкета");
    const all = await loadTemplates(t);
    const tpl = all.find(x => x.id === tid);
    if (!tpl) return fail(res, 404, "Анкета не найдена");
    if (!hasPerm(c, "settings:manage", "admission:manage")) return fail(res, 403, "Убирать анкеты может приёмная или администратор");
    const archived = req.body?.archived !== false;
    if (!archived && tpl.audience === "parent" && all.some(x => x.audience === "parent" && !x.archived && x.id !== tid)) return fail(res, 409, "Действующая анкета родителя уже есть — сначала уберите её в архив");
    await col(t, "questionnaire_templates").doc(tid).update({ archived, updatedBy: c.name, updatedAt: Date.now() });
    await sectionAudit(t, c, archived ? "template_archived" : "template_restored", tpl.title, [], tid);
    if (tpl.audience === "staff") await syncAllReferrals(t).catch(() => {});
    return res.json({ success: true });
  } catch (e: any) { return oops(res, e); }
});

/** Удалить — только анкету без ответов; с ответами — в архив. */
router.delete("/:tenantId/templates/:tid", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller; const tid = String(req.params.tid);
    if (!ID.test(tid)) return fail(res, 400, "Неверная анкета");
    if (!hasPerm(c, "settings:manage", "admission:manage")) return fail(res, 403, "Нет прав");
    const ref = col(t, "questionnaire_templates").doc(tid);
    const tpl = (await ref.get()).data() as QTemplate | undefined;
    if (!tpl) return fail(res, 404, "Анкета не найдена");
    if (!(await col(t, "applicant_forms").where("templateId", "==", tid).limit(1).get()).empty) return fail(res, 409, "По анкете уже есть ответы — уберите её в архив");
    await ref.delete();
    await sectionAudit(t, c, "template_deleted", tpl.title, [], tid);
    return res.json({ success: true });
  } catch (e: any) { return oops(res, e); }
});

/** Письма родителю: анкета и решение — какой шаблон (пусто — без письма). */
router.put("/:tenantId/settings", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "settings:manage", "admission:manage")) return fail(res, 403, "Нет прав");
    const id = (v: unknown) => (/^[A-Za-z0-9_-]{4,64}$/.test(String(v || "")) ? String(v) : "");
    const next = { parentFormEmail: id(req.body?.parentForm), decisionEmail: id(req.body?.decision), updatedAt: Date.now(), updatedBy: c.name };
    await col(t, "admission_meta").doc("settings").set(next, { merge: true });
    await sectionAudit(t, c, "settings_edited", "письма родителю");
    return res.json({ success: true });
  } catch (e: any) { return oops(res, e); }
});

// ── Поступающие ─────────────────────────────────────────────────────────

router.get("/:tenantId/applicants", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const c: StaffCaller = req.caller; const academic = seesAcademic(c);
    const archived = req.query.archived === "1" && hasPerm(c, "admission:manage");
    const [snap, attempts, tpls] = await Promise.all([col(t, "applicants").orderBy("createdAt", "desc").limit(3000).get(), academic ? attemptsOf(t) : [], loadTemplates(t)]);
    const list = snap.docs.map(d => ({ ...(d.data() as Applicant), id: d.id })).filter(a => !!a.archived === archived);
    return res.json({
      success: true,
      applicants: list.map(a => ({ ...row(a, attempts, academic), ...(a.archived ? { archived: a.archived } : {}), referralBlocked: !!a.referralBlocked })),
      me: meOf(c, tpls),
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

// ── Работа экзамена ↔ карточка поступающего ─────────────────────────────

/** ФИО для сравнения: без регистра, «ё» = «е», без знаков, слова по алфавиту (порядок не важен). */
const nameKey = (v: unknown) => String(v || "").toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9\s]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");
const phoneKey = (v: unknown) => { const d = String(v || "").replace(/\D/g, ""); return d.length >= 7 ? d.slice(-9) : ""; };

export { isAdmissionExam };

export type LinkResult = { applicantId: string; refNo: number; created: boolean; linked: boolean } | { ambiguous: number } | null;

/**
 * Привязать работу экзамена к карточке: найти ту же карточку (ФИО + дата
 * рождения, иначе ФИО + телефон; одна карточка с таким ФИО без
 * противоречий — она) или создать из данных работы. Несколько карточек с
 * тем же ФИО и без различий — ничего не делаем (не плодим дубль).
 * Прошлые данные карточки остаются. Повторный вызов ничего не меняет.
 */
export async function linkAttempt(t: string, attemptId: string, c: { uid: string; name: string }, o: { create?: boolean } = {}): Promise<LinkResult> {
  const aref = col(t, "exam_attempts").doc(attemptId);
  const x: any = (await aref.get()).data();
  if (!x) return null;
  if (x.applicantId && !o.create) {
    const cur = await loadApplicant(t, String(x.applicantId));
    if (cur) return { applicantId: cur.id, refNo: cur.refNo, created: false, linked: false };
  }
  const examTitle = str(x.examTitle, 200);
  const extra: Record<string, string> = x.student?.extra || {};
  // Класс: из регистрации, иначе — единственный класс вступительного экзамена.
  const examGrades: number[] = x.student?.level ? [] : ((await col(t, "exams").doc(String(x.examId || "_")).get()).data()?.settings?.admission?.grades || []);
  const fromAttempt = {
    child: sanitizeChild({ name: x.student?.name, birthDate: extra.birthDate, grade: x.student?.level || (examGrades.length === 1 ? String(examGrades[0]) : ""), school: extra.school, phone: extra.studentPhone || x.student?.phone, email: x.student?.email }),
    parent: sanitizeParent({ name: extra.parentName, phone: extra.parentPhone, email: extra.parentEmail }),
  };
  const intake: QAnswers = x.intake?.free && typeof x.intake.free === "object" ? x.intake.free : {};
  const birth = /^\d{4}-\d{2}-\d{2}$/.test(String(extra.birthDate || "")) ? String(extra.birthDate) : "";
  const key = nameKey(x.student?.name);
  if (!key) return null;
  const phones = [extra.parentPhone, extra.studentPhone, x.student?.phone].map(phoneKey).filter(Boolean);
  const all = (await col(t, "applicants").get()).docs.map(d => ({ ...(d.data() as Applicant), id: d.id })).filter(a => !a.archived && nameKey(a.child?.name) === key);
  // «Это другой ребёнок» — отдельная карточка, без поиска совпадений.
  if (o.create) all.length = 0;
  const byBirth = birth ? all.filter(a => a.child.birthDate === birth) : [];
  const byPhone = phones.length ? all.filter(a => { const p = phoneKey(a.parent?.phone); return !!p && phones.includes(p); }) : [];
  const noConflict = (a: Applicant) => (!birth || !a.child.birthDate || a.child.birthDate === birth);
  const found = byBirth.length === 1 ? byBirth[0] : byPhone.length === 1 ? byPhone[0]
    : all.length === 1 && noConflict(all[0]) ? all[0] : undefined;
  if (!found && all.length > 1) return { ambiguous: all.length };
  let id: string; let refNo: number; let created = false;
  if (found) {
    id = found.id; refNo = found.refNo;
    // Та же карточка: пустые поля заполняются из работы, заполненные не трогаются.
    const child: any = { ...found.child }; const parent: any = { ...found.parent }; const auto = new Set(found.autoFilled || []);
    for (const [k, src, dst] of [["child", fromAttempt.child, child], ["parent", fromAttempt.parent, parent]] as const) {
      for (const [f, v] of Object.entries(src)) if (v && !dst[f] && f !== "name") { dst[f] = v; auto.add(`${k}.${f}`); }
    }
    await col(t, "applicants").doc(id).update(deep({
      child, parent, autoFilled: [...auto], updatedAt: Date.now(),
      intake: { ...intake, ...Object.fromEntries(Object.entries(found.intake || {}).filter(([, v]) => answered(v))) },
    }));
  } else {
    const ref = col(t, "applicants").doc(); id = ref.id;
    const [n, parentT, cardT] = await Promise.all([nextRefNo(t), makeLink(t, id, "parent"), makeLink(t, id, "card")]);
    refNo = n; created = true;
    const now = Date.now();
    const a: Applicant = {
      id, tenantId: t, refNo, child: fromAttempt.child, parent: fromAttempt.parent, note: "",
      ...(Object.keys(intake).length ? { intake } : {}),
      autoFilled: [...Object.entries(fromAttempt.child).filter(([f, v]) => v && f !== "name").map(([f]) => `child.${f}`), ...Object.entries(fromAttempt.parent).filter(([, v]) => v).map(([f]) => `parent.${f}`)],
      parentForm: { status: "none", at: null, by: null }, stages: {}, referral: null, paperResults: [], decision: null,
      tokens: { parent: parentT, card: cardT }, createdAt: now, updatedAt: now, createdBy: c.uid, createdByName: c.name,
    };
    await ref.create(deep(a));
  }
  await aref.update({ applicantId: id, refNo });
  const what = `${examTitle ? `«${examTitle}» ` : ""}№ ${str(x.shortId, 20)}`;
  await audit(t, id, c as any, "attempt", `${created ? "Создана из работы экзамена" : "Привязана работа экзамена"} ${what}`);
  return { applicantId: id, refNo, created, linked: true };
}

router.post("/:tenantId/applicants/from-attempt", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const t = String(req.params.tenantId || ""); const examId = String(req.body?.examId || ""); const attemptId = String(req.body?.attemptId || "");
    if (!ID.test(t) || !ID.test(examId) || !ID.test(attemptId)) return fail(res, 400, "Неверный адрес работы");
    const c = await staffCaller(db(), t, req.user);
    if (!c?.member) return fail(res, 403, "Доступно только сотрудникам организации");
    if (!hasPerm(c, "admission:manage", "tests:review", "tests:manage")) return fail(res, 403, "Недостаточно прав");
    const x: any = (await col(t, "exam_attempts").doc(attemptId).get()).data();
    if (!x || x.examId !== examId) return fail(res, 404, "Работа не найдена");
    if (!nameKey(x.student?.name)) return fail(res, 400, "В работе нет имени ученика");
    const r = await linkAttempt(t, attemptId, c);
    if (!r) return fail(res, 404, "Работа не найдена");
    if ("ambiguous" in r) return fail(res, 409, `В «Поступающих» ${r.ambiguous} карточки с таким ФИО — откройте нужную и привяжите вручную`);
    return res.json({ success: true, ...r });
  } catch (e: any) { return oops(res, e); }
});

router.post("/:tenantId/applicants", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Поступающих заводит администрация");
    const child = sanitizeChild(req.body?.child);
    if (child.name.split(/\s+/).filter(Boolean).length < 2) return fail(res, 400, "Укажите фамилию и имя ребёнка");
    if (gradeOf(child.grade) === null) return fail(res, 400, "Укажите класс, в который поступает");
    // Тот же ребёнок уже есть (ФИО + дата рождения, либо ФИО без даты) — не плодим дубль без явного «создать всё равно».
    if (req.body?.force !== true) {
      const k = nameKey(child.name);
      const same = (await col(t, "applicants").get()).docs.map(d => ({ ...(d.data() as Applicant), id: d.id }))
        .find(a => !a.archived && nameKey(a.child?.name) === k && (!child.birthDate || !a.child?.birthDate || a.child.birthDate === child.birthDate));
      if (same) return res.status(409).json({ success: false, error: `Такой поступающий уже есть: № ${String(same.refNo).padStart(4, "0")}`, duplicate: { id: same.id, refNo: same.refNo } });
    }
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
    await syncReferral(t, a).catch(e => console.warn("[admissions] sync", e?.message));
    await notifyAdmission(t, a, "new", c);
    // Есть почта родителя и выбрано письмо — ссылка на анкету уходит сразу (одно письмо на карточку).
    if (a.parent.email) await emailParentForm(t, a, { by: c.uid });
    return res.json({ success: true, id: ref.id, refNo });
  } catch (e: any) { return oops(res, e); }
});

router.get("/:tenantId/applicants/:id", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    const a = await loadApplicant(t, String(req.params.id));
    if (!a || (a.archived && !hasPerm(c, "admission:manage"))) return fail(res, 404, "Поступающий не найден");
    if (!a.archived) a.referral = await syncReferral(t, a).catch(() => a.referral);
    const academic = seesAcademic(c);
    const [templates, formsSnap, attempts] = await Promise.all([
      loadTemplates(t), col(t, "applicant_forms").where("applicantId", "==", a.id).get(), academic ? attemptsOf(t, [a.id], { exams: hasPerm(c, "tests:read", "tests:review", "tests:manage", "placement:manage") }) : [],
    ]);
    let sensitive = false;
    const cur = byId(templates);
    const forms = formsSnap.docs.map(d => {
      const raw = { ...(d.data() as ApplicantForm), id: d.id };
      const f = { ...raw, template: withAccess(raw.template, cur[raw.templateId]) };
      if (canSee(c, f.template)) { if (f.template.sensitive) sensitive = true; return { ...f, full: true }; }
      // Без права — только итог: статус и заключение, без ответов.
      const o = outcomeOf(f.template, f.outcome);
      return { id: f.id, templateId: f.templateId, status: f.status, outcome: f.outcome, outcomeLabel: o?.label || "", full: false, template: { id: f.template.id, title: f.template.title, audience: f.template.audience } };
    });
    // Просмотр — одна запись в час на сотрудника, а не на каждое автообновление.
    if (sensitive) await applicantAudit(t, a.id, c, "viewed", "открыл анкеты с данными о здоровье и развитии", [], { key: `view_${a.id}_${c.uid}_${Math.floor(Date.now() / 3_600_000)}` });
    const auditLog = hasPerm(c, "admission:manage") ? (await historyPage(t, a.id, c, templates, {})).items : [];
    const canFillMap = Object.fromEntries(templates.map(x => [x.id, canFill(c, x)]));
    const canSeeMap = Object.fromEntries(templates.map(x => [x.id, canSee(c, x)]));
    const parentDoc = formsSnap.docs.map(d => d.data() as ApplicantForm).find(f => f.template?.audience === "parent") || null;
    const candidateForm = academic ? await loadCandidateForm(t) : null;
    return res.json({
      success: true, applicant: { ...(academic ? { ...a, candidate: candidateOf(a) } : withoutAcademic(a)), tokens: hasPerm(c, "admission:manage") ? a.tokens : { card: a.tokens.card, parent: "" } },
      forms, attempts, audit: auditLog,
      // Тест ребёнка по направлению: если на бумаге — администрация вносит правильные ответы.
      candidateForm,
      // «Сведения об ученике» анкеты кандидата — из всех источников сразу (родитель, ученик перед тестом, карточка).
      sheet: candidateForm ? sheetSource(a, candidateForm, parentDoc?.template || parentTemplate(templates), parentDoc?.answers) : null,
      // Анкету родителя ещё не начинали — сотруднику она открывается с тем, что уже известно (карточка, ответы ученика).
      parentPrefill: !parentDoc && parentTemplate(templates) && (canFillMap[parentTemplate(templates)!.id] || canSeeMap[parentTemplate(templates)!.id]) ? profileAnswers(a, parentTemplate(templates), null) : null,
      testExam: academic ? await (async () => {
        const e = a.referral?.examId ? (await tenantExams(t)).find(x => x.id === a.referral!.examId) : null;
        return e ? { id: e.id, title: e.title, paper: !!e.settings.paper, sections: e.sections.map(x => ({ id: x.id, title: x.title, tasks: x.tasks || 0 })) } : null;
      })() : null,
      resultDelivery: academic ? await (async () => {
        const rs = sanitizeSettings((await examOfApplicant(t, a))?.settings).results;
        return { delivery: rs.delivery, sendOn: rs.sendOn };
      })().catch(() => null) : null,
      templates: templates.filter(x => !x.archived), canFill: canFillMap, canSee: canSeeMap,
      me: meOf(c, templates),
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
    const ch = patch.child || a.child; const pa = patch.parent || a.parent;
    if (a.autoFilled?.length) patch.autoFilled = keepAuto(a, ch, pa);
    await col(t, "applicants").doc(a.id).update(patch);
    const changes = diffRows([
      ["ФИО ученика", a.child.name, ch.name], ["Дата рождения", a.child.birthDate, ch.birthDate], ["Класс", a.child.grade, ch.grade], ["Школа", a.child.school, ch.school],
      ["Телефон ученика", a.child.phone, ch.phone], ["Почта ученика", a.child.email, ch.email],
      ["ФИО родителя", a.parent.name, pa.name], ["Телефон родителя", a.parent.phone, pa.phone], ["Почта родителя", a.parent.email, pa.email],
      ["Заметка", a.note, patch.note ?? a.note],
    ]);
    if (changes.length) await audit(t, a.id, c, "edited", "профиль", changes);
    // Сменился класс — может смениться и экзамен.
    if (patch.child && patch.child.grade !== a.child.grade) await syncReferral(t, { ...a, ...patch } as any, await loadTemplates(t));
    return res.json({ success: true });
  } catch (e: any) { return oops(res, e); }
});

/**
 * «Удалить» — в архив: из списка уходит, данные целы, «Вернуть» — обратно.
 * Окончательно (?purge=1) — только из архива и только полный доступ
 * (владелец, администратор): вместе с анкетами, ссылками, работами и фото.
 */
router.delete("/:tenantId/applicants/:id", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Убирать карточки может приёмная");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    if (req.query.purge === "1") {
      if (!c.full) return fail(res, 403, "Удалить навсегда может владелец или администратор");
      if (!a.archived) return fail(res, 409, "Сначала уберите карточку в архив");
      await purgeApplicant(t, a);
      await sectionAudit(t, c, "deleted", `${a.child.name}, № ${a.refNo}`);
      return res.json({ success: true, purged: true });
    }
    await archiveApplicant(t, a, c);
    return res.json({ success: true });
  } catch (e: any) { return oops(res, e); }
});

async function archiveApplicant(t: string, a: Applicant, c: StaffCaller) {
  if (a.archived) return;
  await col(t, "applicants").doc(a.id).update({ archived: { at: Date.now(), by: c.uid, byName: c.name }, updatedAt: Date.now() });
  await audit(t, a.id, c, "archived");
}
async function restoreApplicant(t: string, a: Applicant, c: StaffCaller) {
  if (!a.archived) return;
  await col(t, "applicants").doc(a.id).update({ archived: null, updatedAt: Date.now() });
  await audit(t, a.id, c, "restored");
}
async function purgeApplicant(t: string, a: Applicant) {
  const [forms, links, attempts, hist] = await Promise.all([
    col(t, "applicant_forms").where("applicantId", "==", a.id).get(),
    db().collection(LINKS).where("applicantId", "==", a.id).get(),
    col(t, "exam_attempts").where("applicantId", "==", a.id).get(),
    col(t, "applicant_audit").where("applicantId", "==", a.id).get(),
  ]);
  const refs = [
    ...forms.docs.map(d => d.ref), ...links.docs.filter(d => d.data().tenantId === t).map(d => d.ref),
    ...attempts.docs.flatMap(d => [d.ref, col(t, "exam_photos").doc(d.id)]), ...hist.docs.map(d => d.ref),
    col(t, "applicants").doc(a.id),
  ];
  for (let i = 0; i < refs.length; i += 400) { const b = db().batch(); refs.slice(i, i + 400).forEach(r => b.delete(r)); await b.commit(); }
}

router.post("/:tenantId/applicants/:id/restore", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Нет прав");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    await restoreApplicant(t, a, c);
    return res.json({ success: true });
  } catch (e: any) { return oops(res, e); }
});

/** Сразу по нескольким: в архив, вернуть, анкету родителю на почту. */
router.post("/:tenantId/applicants-bulk", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Нет прав");
    const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(String).filter((x: string) => ID.test(x)))].slice(0, 200) as string[];
    const action = String(req.body?.action || "");
    if (!ids.length || !["archive", "restore", "parent_email"].includes(action)) return fail(res, 400, "Выберите карточки и действие");
    let ok = 0; const failed: string[] = [];
    for (const id of ids) {
      const a = await loadApplicant(t, id);
      if (!a) continue;
      try {
        if (action === "archive") await archiveApplicant(t, a, c);
        else if (action === "restore") await restoreApplicant(t, a, c);
        else { const r = await emailParentForm(t, a, { force: true, by: c.uid }); if (!r.sent) throw new Error(r.reason || "не ушло"); }
        ok++;
      } catch (e: any) { failed.push(`${a.child.name}: ${e?.message || "ошибка"}`); }
    }
    return res.json({ success: true, ok, failed });
  } catch (e: any) { return oops(res, e); }
});

/** История карточки: по 100, «Ещё» — before, фильтр по виду. */
router.get("/:tenantId/applicants/:id/history", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Историю видит приёмная");
    const id = String(req.params.id);
    if (!ID.test(id)) return fail(res, 400, "Неверный поступающий");
    const page = await historyPage(t, id, c, await loadTemplates(t), { before: Number(req.query.before) || undefined, kind: str(req.query.kind, 20) });
    return res.json({ success: true, ...page });
  } catch (e: any) { return oops(res, e); }
});

/** История раздела: правки анкет и вида анкеты кандидата, удаления карточек. */
router.get("/:tenantId/history", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage", "settings:manage")) return fail(res, 403, "Нет прав");
    const page = await historyPage(t, SECTION, c, await loadTemplates(t), { before: Number(req.query.before) || undefined });
    return res.json({ success: true, ...page });
  } catch (e: any) { return oops(res, e); }
});

/** «Сбросить анкету» ребёнка: начатую по ошибке — убрать, этап снять. */
router.delete("/:tenantId/applicants/:id/forms/:tid", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller; const tid = String(req.params.tid);
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Сбрасывает анкету приёмная");
    if (!ID.test(tid)) return fail(res, 400, "Неверная анкета");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    const fref = col(t, "applicant_forms").doc(`${a.id}_${tid}`);
    const f = (await fref.get()).data() as ApplicantForm | undefined;
    if (!f) return fail(res, 404, "Анкета не начата");
    await fref.delete();
    const patch: any = { updatedAt: Date.now() };
    if (f.template.audience === "parent") patch.parentForm = { status: "none", at: null, by: null };
    else patch[`stages.${tid}`] = admin.firestore.FieldValue.delete();
    await col(t, "applicants").doc(a.id).update(patch);
    await applicantAudit(t, a.id, c, "form_reset", f.template.title, [], { templateId: tid });
    const fresh = await loadApplicant(t, a.id);
    const referral = fresh ? await syncReferral(t, fresh) : null;
    return res.json({ success: true, referral });
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
    const snapTpl = prev?.template || templates.find(x => x.id === tid);
    if (!snapTpl) return fail(res, 404, "Анкета не найдена");
    const tpl = withAccess(snapTpl, templates.find(x => x.id === tid));
    if (!canFill(c, tpl)) return fail(res, 403, "Заполнять эту анкету может только сотрудник с нужным правом");
    if (a.archived) return fail(res, 409, "Карточка в архиве — сначала верните её");
    const g = gradeOf(a.child.grade);
    const now = Date.now();
    const reopen = req.body?.reopen === true;
    const outcome = reopen && prev ? prev.outcome : (tpl.outcome && outcomeOf(tpl, req.body?.outcome) ? String(req.body.outcome) : null);
    const done = !reopen && req.body?.done === true;
    const pAns = tpl.audience === "staff" ? await parentAnswers(t, a.id) : undefined;
    // Черновик хранит всё (переключил ответ туда-обратно — не потерял); сданная — только видимое.
    const raw = reopen && prev ? prev.answers : sanitizeAnswers(tpl, req.body?.answers);
    const final = done || (!reopen && prev?.status === "done");
    const answers = final ? dropHidden(tpl, raw, g, pAns) : raw;
    if (done) {
      const miss = missingFor(tpl, answers, g, outcome, pAns);
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
      Object.assign(patch, bindToCard(a, tpl, answers, true));
    } else {
      const o = outcomeOf(tpl, outcome);
      const summary: StageSummary = { templateId: tid, title: tpl.title, status, outcome, outcomeLabel: o?.label || "", tone: o?.tone || null, allowsTest: !!o?.allowsTest, by: c.uid, byName: c.name, at: now };
      patch[`stages.${tid}`] = summary;
    }
    await col(t, "applicants").doc(a.id).update(patch);
    const oLabel = outcomeOf(tpl, outcome)?.label;
    const tag = { templateId: tid };
    if (done) await applicantAudit(t, a.id, c, "form_done", [tpl.title, oLabel].filter(Boolean).join(" · "), prev?.status === "done" ? answerChanges(tpl, prev.answers, answers) : [], tag);
    else if (reopen) await applicantAudit(t, a.id, c, "form_reopened", tpl.title, [], tag);
    else if (!prev) await applicantAudit(t, a.id, c, tpl.audience === "parent" ? "parent_form_started" : "form_started", tpl.title, [], tag);
    else if (prev.status === "done") {
      // Сданную анкету поправили — что именно.
      const changes = answerChanges(tpl, prev.answers, answers);
      if ((prev.outcome || null) !== (outcome || null)) changes.unshift({ label: "Итог", from: outcomeOf(tpl, prev.outcome)?.label || "", to: oLabel || "" });
      if (changes.length) await applicantAudit(t, a.id, c, "form_edited", tpl.title, changes, tag);
    }
    let referral = a.referral;
    if (tpl.audience === "staff" && (done || reopen)) {
      const fresh = await loadApplicant(t, a.id);
      if (fresh) referral = await syncReferral(t, fresh, templates);
    }
    if (tpl.audience === "parent" && done && prev?.status !== "done") await notifyAdmission(t, a, "parent", c);
    if (tpl.audience === "staff" && done) await notifyAdmission(t, a, "done", c, { tid, outcome: outcomeOf(tpl, outcome)?.label, referral: !!referral });
    if (tpl.audience === "staff" && done && referral?.examId) await emailReferral(t, a.id, { by: c.uid });
    else if (tpl.audience === "staff" && !prev) await notifyAdmission(t, a, "session", c, { tid });
    return res.json({ success: true, form, referral });
  } catch (e: any) { return oops(res, e); }
});

/** «Допустить к тесту» вопреки итогу (администрация). Тест — по классу, как у всех. */
router.post("/:tenantId/applicants/:id/referral", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    // Разделение обязанностей: специалист ставит итог, тест по классу выбирает система;
    // выдать направление вопреки итогу или на другой экзамен — только администрация.
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Направление вручную выдаёт администратор");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    const reason = str(req.body?.reason, 500);
    const seed = { examId: null, examTitle: "", examCode: null, issuedAt: Date.now(), by: c.uid, byName: c.name, manual: true, reason };
    await col(t, "applicants").doc(a.id).update({ referral: seed, referralBlocked: null, updatedAt: Date.now() });
    const referral = await syncReferral(t, { ...a, referral: seed, referralBlocked: null });
    await audit(t, a.id, c, "referral_manual", `допущен к тесту${reason ? ` — ${reason}` : ""}`);
    if (referral?.examId) await emailReferral(t, a.id, { by: c.uid });
    return res.json({ success: true, referral });
  } catch (e: any) { return oops(res, e); }
});

/** «На почту»: направление родителю письмом (повторно — тоже). */
const lastReferralMail = new Map<string, number>();
router.post("/:tenantId/applicants/:id/referral-email", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Отправлять направление может администратор");
    const key = `${t}_${req.params.id}`;
    if (Date.now() - (lastReferralMail.get(key) || 0) < 60_000) return fail(res, 429, "Письмо только что ушло — подождите минуту");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    const r = await emailReferral(t, a.id, { force: true, by: c.uid });
    if (!r.sent) return fail(res, 400, r.reason || "Не отправилось");
    lastReferralMail.set(key, Date.now());
    await audit(t, a.id, c, "referral_emailed", a.parent.email || "");
    return res.json({ success: true, to: a.parent.email });
  } catch (e: any) { return oops(res, e); }
});

/** «На почту»: ссылка на анкету родителю. */
router.post("/:tenantId/applicants/:id/parent-email", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Нет прав");
    const key = `p_${t}_${req.params.id}`;
    if (Date.now() - (lastReferralMail.get(key) || 0) < 60_000) return fail(res, 429, "Письмо только что ушло — подождите минуту");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    const r = await emailParentForm(t, a, { force: true, by: c.uid });
    if (!r.sent) return fail(res, 400, r.reason || "Не отправилось");
    lastReferralMail.set(key, Date.now());
    return res.json({ success: true, to: a.parent.email });
  } catch (e: any) { return oops(res, e); }
});

/**
 * Анкета родителя заполнена неверно — очистить и выдать заново. Прежние ответы
 * не пропадают: копия — в applicant_forms_archive, отметка — в истории.
 * Ссылка родителя снова открывает пустую анкету; данные карточки не трогаем.
 */
router.post("/:tenantId/applicants/:id/parent-form/reset", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Нет прав");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    if (a.archived) return fail(res, 409, "Карточка в архиве");
    const snap = (await col(t, "applicant_forms").where("applicantId", "==", a.id).get()).docs
      .find(d => (d.data() as ApplicantForm).template?.audience === "parent");
    if (!snap) return fail(res, 409, "Анкета родителя ещё не заполнялась");
    const now = Date.now();
    await col(t, "applicant_forms_archive").doc(`${snap.id}_${now}`).set(deep({ ...snap.data(), resetAt: now, resetBy: c.uid, resetByName: c.name, reason: str(req.body?.reason, 300) }));
    await snap.ref.delete();
    await col(t, "applicants").doc(a.id).update({ parentForm: { status: "none", at: null, by: null }, updatedAt: now });
    await audit(t, a.id, c, "parent_form_reset", str(req.body?.reason, 300));
    await bumpLive(t, ["admissions"], a.id).catch(() => {});
    return res.json({ success: true });
  } catch (e: any) { return oops(res, e); }
});

const pubKey = (id: string) => `publish:${id}`;
const whenText = async (t: string, at: number) => fmtIn(await orgTimeZone(t), at, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
/** Минимальный запас, с которого публикация считается запланированной; ближе — публикуем сразу. */
const MIN_AHEAD = 60_000;
/** at из тела: число в будущем (≥ now+60 с) → запланировать; иначе null — публиковать сразу. */
const futureAt = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) && n >= Date.now() + MIN_AHEAD ? Math.floor(n) : null; };

/** Почему карточку нельзя опубликовать сейчас; null — можно. */
function publishBlock(a: Applicant): { code: "archived" | "no_decision" | "published"; reason: string } | null {
  if (a.archived) return { code: "archived", reason: "Карточка в архиве" };
  const cand = candidateOf(a);
  if (!cand?.decision || !cand.decisionFinal) return { code: "no_decision", reason: "Нет окончательного решения" };
  if (cand.published) return { code: "published", reason: "Уже опубликовано" };
  return null;
}

/**
 * Опубликовать результаты (проверки — в publishBlock): открывает результаты
 * по QR и отправляет письмо — «Результаты готовы» или с решением, по настройке экзамена.
 */
async function publishApplicant(t: string, a: Applicant, c: { uid: string; name: string }) {
  const cand = candidateOf(a)!;
  const published = { at: Date.now(), by: c.uid, byName: c.name };
  const { publishAt: _drop, ...rest } = cand;
  const candidate: CandidateInfo = { ...rest, published, publishAt: null };
  await col(t, "applicants").doc(a.id).update({ candidate: deep(candidate), updatedAt: Date.now() });
  await cancelJob(t, pubKey(a.id)).catch(() => false);
  await audit(t, a.id, c, "published", cand.decisionLabel);
  // Экзамен отдаёт результаты страницей — письмо «Результаты готовы» (при публикации или позже кнопкой); иначе — прежнее письмо с решением.
  const rs = sanitizeSettings((await examOfApplicant(t, a))?.settings).results;
  const mail = rs.delivery === "page"
    ? (rs.sendOn === "publish" ? await emailResultsReady(t, { ...a, candidate }, { by: c.uid }) : { sent: false, skipped: true, reason: "Письмо отправляется кнопкой" } as SendResult)
    : await emailDecision(t, { ...a, candidate }, { by: c.uid });
  await bumpLive(t, ["admissions"], a.id).catch(() => {});
  return { published, email: mail };
}

/** Запланировать публикацию на момент at (заменяет прежнюю). */
async function schedulePublish(t: string, a: Applicant, c: { uid: string; name: string }, at: number) {
  await scheduleJob({ tenantId: t, kind: "admission_publish", key: pubKey(a.id), runAt: at, payload: { applicantId: a.id }, by: { uid: c.uid, name: c.name } });
  const candidate: CandidateInfo = { ...candidateOf(a)!, publishAt: at };
  await col(t, "applicants").doc(a.id).update({ candidate: deep(candidate), updatedAt: Date.now() });
  await audit(t, a.id, c, "publish_scheduled", `на ${await whenText(t, at)}`);
  await bumpLive(t, ["admissions"], a.id).catch(() => {});
}

/** Снять запланированную публикацию: задача отменена, отметка в карточке снята. */
async function clearScheduled(t: string, a: Applicant, c: { uid: string; name: string } | null, why = "") {
  const cand = candidateOf(a);
  await cancelJob(t, pubKey(a.id)).catch(() => false);
  if (!cand?.publishAt) return false;
  await col(t, "applicants").doc(a.id).update({ candidate: deep({ ...cand, publishAt: null }), updatedAt: Date.now() });
  await audit(t, a.id, c || SYSTEM, "publish_cancelled", why);
  await bumpLive(t, ["admissions"], a.id).catch(() => {});
  return true;
}

type PublishSkip = { id: string; reason: string };
/** Одну карточку — опубликовать или запланировать (at — уже проверенное будущее время или null). */
async function publishOrSchedule(t: string, a: Applicant, c: { uid: string; name: string }, at: number | null): Promise<"done" | "scheduled" | PublishSkip & { code: string }> {
  const b = publishBlock(a);
  if (b) return { id: a.id, reason: b.reason, code: b.code };
  if (at) { await schedulePublish(t, a, c, at); return "scheduled"; }
  await publishApplicant(t, a, c);
  return "done";
}

registerJobHandler("admission_publish", async job => {
  const t = job.tenantId; const id = String(job.payload?.applicantId || "");
  const a = await loadApplicant(t, id);
  const fail_ = async (reason: string) => {
    if (a) {
      await clearScheduled(t, a, SYSTEM, `не выполнена: ${reason}`).catch(() => {});
      await notifyAdmission(t, a, "publish_failed", { uid: "", name: "" }, { summary: reason });
    }
    throw new Error(reason);
  };
  if (!a) throw new Error("Карточки нет");
  const b = publishBlock(a);
  if (b) return fail_(b.code === "published" ? "Результаты уже опубликованы" : b.reason);
  const r = await publishApplicant(t, a, { uid: job.createdBy?.uid || "", name: job.createdBy?.name || "Планировщик" });
  return `Опубликовано${r.email?.sent ? ", письмо отправлено" : ""}`;
});

router.post("/:tenantId/applicants/:id/publish", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Нет прав");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    const b = publishBlock(a);
    if (b?.code === "published") return res.json({ success: true, published: candidateOf(a)!.published });
    if (b) return fail(res, 409, b.code === "no_decision" ? "Сначала вынесите окончательное решение в анкете кандидата" : b.reason);
    const at = futureAt(req.body?.at);
    if (at) { await schedulePublish(t, a, c, at); return res.json({ success: true, scheduled: at }); }
    const r = await publishApplicant(t, a, c);
    return res.json({ success: true, published: r.published, email: r.email });
  } catch (e: any) { return oops(res, e); }
});

/** Отменить запланированную публикацию. */
router.post("/:tenantId/applicants/:id/publish/cancel", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Нет прав");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    await clearScheduled(t, a, c);
    return res.json({ success: true });
  } catch (e: any) { return oops(res, e); }
});

/** Применить публикацию/планирование к набору карточек; итог — по каждой. */
async function publishMany(t: string, c: StaffCaller, list: Applicant[], at: number | null) {
  const out = { done: 0, scheduled: 0, skipped: [] as PublishSkip[] };
  for (const a of list) {
    try {
      const r = await publishOrSchedule(t, a, c, at);
      if (r === "done") out.done++; else if (r === "scheduled") out.scheduled++; else out.skipped.push({ id: r.id, reason: r.reason });
    } catch (e: any) { console.error("[admissions] publish", e?.message || e); out.skipped.push({ id: a.id, reason: "Не получилось" }); }
  }
  return out;
}

/** Карточка поступающего для действий из «Экзаменов» (null — карточки нет). */
export const applicantById = (t: string, id: string) => loadApplicant(t, id);

/**
 * Решение — только в анкете кандидата: меняет одно поле (прочее сохраняется),
 * снимает публикацию и таймер при смене, пишет историю и уведомляет.
 * Общий путь для карточки и для «Экзаменов».
 */
/** Опубликованное заморожено: менять решение и то, что видит семья, можно только после «Снять публикацию». */
export const PUBLISHED_LOCK = "Результаты опубликованы — сначала снимите публикацию";
export async function setCandidateDecision(t: string, a: Applicant, c: { uid: string; name: string }, decisionId: string | null): Promise<{ error?: [number, string]; candidate?: CandidateInfo }> {
  const form = await loadCandidateForm(t);
  if (decisionId !== null && !form.decisions.some(x => x.id === decisionId)) return { error: [400, "Такого решения нет в анкете кандидата"] };
  const prev = candidateOf(a);
  const pick = sanitizeCandidate({ decision: decisionId }, form.decisions);
  if ((prev?.decision || null) === pick.decision && a.candidate) return { candidate: prev! };
  if (prev?.published) return { error: [409, PUBLISHED_LOCK] };
  const same = (prev?.decision || null) === pick.decision;
  const blank = sanitizeCandidate({}, form.decisions);
  const base = prev || { ...blank, by: "", at: 0 };
  const keepPublished = prev?.published && same ? prev.published : null;
  const keepSchedule = prev?.publishAt && !keepPublished && same && pick.decisionFinal ? prev.publishAt : null;
  const candidate: CandidateInfo = { ...base, decision: pick.decision, decisionLabel: pick.decisionLabel, decisionFinal: pick.decisionFinal, published: keepPublished, publishAt: keepSchedule, by: c.name, at: Date.now() };
  await col(t, "applicants").doc(a.id).update({ candidate: deep(candidate), decision: null, updatedAt: Date.now() });
  if (!same) {
    const old = form.decisions.find(x => x.id === prev?.decision)?.label || prev?.decisionLabel || "";
    await audit(t, a.id, c, "candidate", "анкета кандидата", diffRows([["Решение", old, candidate.decisionLabel]]));
    await audit(t, a.id, c, "decision", candidate.decision ? candidate.decisionLabel : "снято");
    if (candidate.decision) await notifyAdmission(t, a, "decision", c, { summary: candidate.decisionLabel });
    if (prev?.published) await audit(t, a.id, c, "unpublished", "решение изменено — опубликуйте заново");
  }
  if (prev?.publishAt && !keepSchedule) {
    await cancelJob(t, pubKey(a.id)).catch(() => false);
    await audit(t, a.id, c, "publish_cancelled", "решение изменено");
  }
  await bumpLive(t, ["admissions"], a.id).catch(() => {});
  return { candidate };
}

/** Снять публикацию карточки (результаты по QR закрыты, письмо не отзывается). */
export async function unpublishCard(t: string, a: Applicant, c: { uid: string; name: string }) {
  const cand = candidateOf(a);
  if (!cand?.published) return;
  await col(t, "applicants").doc(a.id).update({ candidate: deep({ ...cand, published: null }), updatedAt: Date.now() });
  await audit(t, a.id, c, "unpublished", "");
  await bumpLive(t, ["admissions"], a.id).catch(() => {});
}

/** Публикация карточек по их id из «Экзаменов»: те же правила, что у кнопки в карточке. */
export async function publishCards(t: string, c: { uid: string; name: string }, ids: string[], at: number | null) {
  const out = { done: 0, scheduled: 0, skipped: [] as (PublishSkip & { code?: string })[] };
  for (const id of ids) {
    const a = await loadApplicant(t, id);
    if (!a) { out.skipped.push({ id, reason: "Карточки нет", code: "missing" }); continue; }
    try {
      const r = await publishOrSchedule(t, a, c, at);
      if (r === "done") out.done++; else if (r === "scheduled") out.scheduled++; else out.skipped.push(r);
    } catch (e: any) { console.error("[admissions] publish", e?.message || e); out.skipped.push({ id, reason: "Не получилось" }); }
  }
  return out;
}

/** Решение по поступающему — только в анкете кандидата. { decision: id | null } */
router.post("/:tenantId/applicants/:id/decision", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Решение выносит администрация приёма");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    const raw = req.body?.decision;
    const r = await setCandidateDecision(t, a, c, raw === null || raw === "" || raw === undefined ? null : String(raw));
    if (r.error) return fail(res, r.error[0], r.error[1]);
    return res.json({ success: true, candidate: r.candidate });
  } catch (e: any) { return oops(res, e); }
});

/** Выделенные карточки — опубликовать или запланировать. */
router.post("/:tenantId/applicants/publish-bulk", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Нет прав");
    const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(String).filter((x: string) => ID.test(x)))].slice(0, 300) as string[];
    if (!ids.length) return fail(res, 400, "Выберите поступающих");
    const found = await Promise.all(ids.map(id => loadApplicant(t, id)));
    const list = found.filter((x): x is Applicant => !!x);
    const out = await publishMany(t, c, list, futureAt(req.body?.at));
    for (const id of ids) if (!list.some(x => x.id === id)) out.skipped.push({ id, reason: "Карточки нет" });
    return res.json({ success: true, ...out });
  } catch (e: any) { return oops(res, e); }
});

/** Весь экзамен: все не опубликованные карточки с окончательным решением. */
router.post("/:tenantId/exams/:examId/publish-all", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Нет прав");
    const examId = String(req.params.examId);
    if (!ID.test(examId)) return fail(res, 400, "Неверный экзамен");
    const [snap, attempts] = await Promise.all([col(t, "applicants").get(), attemptsOf(t)]);
    const list: Applicant[] = []; let noDecision = 0;
    for (const d of snap.docs) {
      const a = { ...(d.data() as Applicant), id: d.id };
      if (a.archived) continue;
      const done = attempts.filter(x => x.applicantId === a.id && x.status === "finished" && !x.superseded).sort((x, y) => (y.finishedAt || 0) - (x.finishedAt || 0))[0];
      if (String(done?.examId || a.referral?.examId || "") !== examId) continue;
      const b = publishBlock(a);
      if (b?.code === "published") continue;
      if (b?.code === "no_decision") { noDecision++; continue; }
      list.push(a);
    }
    if (req.body?.dry) return res.json({ success: true, count: list.length, noDecision });
    const out = await publishMany(t, c, list, futureAt(req.body?.at));
    return res.json({ success: true, ...out, noDecision });
  } catch (e: any) { return oops(res, e); }
});

/** Снять публикацию: результаты по QR снова закрыты (отправленное письмо не отзывается). */
router.post("/:tenantId/applicants/:id/unpublish", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Нет прав");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    const cand = candidateOf(a);
    if (!cand?.published) return res.json({ success: true });
    await col(t, "applicants").doc(a.id).update({ candidate: deep({ ...cand, published: null }), updatedAt: Date.now() });
    await audit(t, a.id, c, "unpublished", "");
    await bumpLive(t, ["admissions"], a.id).catch(() => {});
    return res.json({ success: true });
  } catch (e: any) { return oops(res, e); }
});

/** Письмо с решением — повторно, вручную. */
router.post("/:tenantId/applicants/:id/decision-email", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Нет прав");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    const r = await emailDecision(t, a, { force: true, by: c.uid });
    if (!r.sent) return fail(res, 400, r.reason || "Не отправилось");
    return res.json({ success: true, to: r.to || familyEmails(a) });
  } catch (e: any) { return oops(res, e); }
});

router.delete("/:tenantId/applicants/:id/referral", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Снимать направление может администратор");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    const reason = str(req.body?.reason ?? req.query?.reason, 300);
    // Отметка «снято администрацией»: автоматическая выдача её уважает, пока направление не вернут.
    await col(t, "applicants").doc(a.id).update({ referral: null, referralBlocked: { by: c.uid, byName: c.name, at: Date.now(), reason }, updatedAt: Date.now() });
    await audit(t, a.id, c, "referral_revoked", [a.referral?.examTitle, reason].filter(Boolean).join(" · "));
    return res.json({ success: true });
  } catch (e: any) { return oops(res, e); }
});

/** «Вернуть»: снять отметку — направление снова выдаётся по итогам. */
router.post("/:tenantId/applicants/:id/referral/restore", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Возвращать направление может администратор");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    await col(t, "applicants").doc(a.id).update({ referralBlocked: null, updatedAt: Date.now() });
    await audit(t, a.id, c, "referral_restored");
    const referral = await syncReferral(t, { ...a, referralBlocked: null });
    if (referral?.examId) await emailReferral(t, a.id, { by: c.uid });
    return res.json({ success: true, referral });
  } catch (e: any) { return oops(res, e); }
});

/** Результаты теста на бумаге (классы, где теста онлайн ещё нет). */
router.post("/:tenantId/applicants/:id/paper", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Вносить результаты может приёмная");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    if (candidateOf(a)?.published) return fail(res, 409, PUBLISHED_LOCK);
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
    if (candidateOf(a)?.published) return fail(res, 409, PUBLISHED_LOCK);
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
    const base = sanitizeCandidate(req.body, form.decisions);
    // Опубликовано — то, что видит семья (решение, заключение, обратная связь, пробный период, класс), не меняется.
    if (prev?.published) {
      if ((["decision", "conclusion", "feedback", "feedbackGiven", "trialFrom", "trialTo"] as const).some(k => (prev[k] ?? "") !== (base[k] ?? ""))) return fail(res, 409, PUBLISHED_LOCK);
      // Класс в окне по умолчанию подставляется из карточки — это не правка.
      if (base.klass !== (prev.klass || "") && base.klass !== (a.child.grade || "")) return fail(res, 409, PUBLISHED_LOCK);
      base.klass = prev.klass || "";
    }

    // «Сведения об ученике»: поля карточки — прямо в карточку, остальное — правкой поверх анкеты.
    const overrides: Record<string, string | string[]> = { ...(prev?.overrides || {}) };
    const child = { ...a.child }; const parent = { ...a.parent };
    const fieldChanges: AuditChange[] = [];
    const raw = req.body?.fields && typeof req.body.fields === "object" ? req.body.fields as Record<string, unknown> : {};
    const parentTpl = Object.keys(raw).some(k => form.fields.find(f => f.id === k)?.source.startsWith("answer:"))
      ? (await loadTemplates(t)).find(x => x.audience === "parent") : undefined;
    for (const [fid, v] of Object.entries(raw).slice(0, 40)) {
      const f = form.fields.find(x => x.id === fid);
      if (!f) continue;
      const slot = SOURCE_SLOT[f.source];
      if (slot) { ((slot[0] === "child" ? child : parent) as any)[slot[1]] = str(v, 200); continue; }
      const before = overrides[fid];
      if (v === null) delete overrides[fid];
      else if (Array.isArray(v)) {
        const item = f.source.startsWith("answer:") ? parentTpl?.sections.flatMap(x => x.items).find(i => i.id === f.source.slice(7)) : undefined;
        const ok = new Set((item?.options || []).map(o => o.id));
        overrides[fid] = [...new Set(v.map(String).filter(x => ok.has(x)))].slice(0, 20);
      } else overrides[fid] = str(v, 300);
      const show = (x: unknown) => Array.isArray(x)
        ? x.map(id => parentTpl?.sections.flatMap(s2 => s2.items).flatMap(i => i.options || []).find(o => o.id === id)?.label || id).join(", ")
        : String(x ?? "");
      if (show(before) !== show(overrides[fid])) fieldChanges.push({ label: f.label, from: before === undefined ? "из анкеты" : show(before), to: overrides[fid] === undefined ? "из анкеты" : show(overrides[fid]) });
    }
    const patch: Record<string, unknown> = {};
    const profileChanges = diffRows([
      ["ФИО ученика", a.child.name, child.name], ["Дата рождения", a.child.birthDate, child.birthDate], ["Класс", a.child.grade, child.grade], ["Школа", a.child.school, child.school],
      ["Телефон ученика", a.child.phone, child.phone], ["Почта ученика", a.child.email, child.email],
      ["ФИО родителя", a.parent.name, parent.name], ["Телефон родителя", a.parent.phone, parent.phone],
    ]);
    if (profileChanges.length) {
      const ch = sanitizeChild(child);
      if (ch.name.split(/\s+/).filter(Boolean).length < 2) return fail(res, 400, "Укажите фамилию и имя ребёнка");
      if (gradeOf(ch.grade) === null) return fail(res, 400, "Укажите класс");
      patch.child = ch; patch.parent = sanitizeParent(parent);
      if (a.autoFilled?.length) patch.autoFilled = keepAuto(a, ch, patch.parent as Applicant["parent"]);
    }

    // Публикация — только кнопкой; другое решение — публикация снимается.
    const keepPublished = prev?.published && (prev.decision || null) === base.decision ? prev.published : null;
    // Запланированная публикация живёт, пока решение то же и окончательное.
    const keepSchedule = prev?.publishAt && !keepPublished && (prev.decision || null) === base.decision && base.decisionFinal ? prev.publishAt : null;
    const candidate: CandidateInfo = { ...base, ...(Object.keys(overrides).length ? { overrides } : {}), published: keepPublished, publishAt: keepSchedule, by: c.name, at: Date.now() };
    await col(t, "applicants").doc(a.id).update({ ...patch, candidate, decision: null, updatedAt: Date.now() });
    const label = (d: string | null | undefined) => form.decisions.find(x => x.id === d)?.label || "";
    const changes = [...profileChanges, ...fieldChanges, ...diffRows([
      ["Ответственный", prev?.responsible, candidate.responsible], ["Заключение", prev?.conclusion, candidate.conclusion],
      ["Обратная связь", prev?.feedback, candidate.feedback], ["Обратная связь дана", !!prev?.feedbackGiven, candidate.feedbackGiven],
      ["Решение", label(prev?.decision) || prev?.decisionLabel, candidate.decisionLabel],
      ["Пробный период с", prev?.trialFrom, candidate.trialFrom], ["Пробный период по", prev?.trialTo, candidate.trialTo],
      ["Класс (решение)", prev?.klass, candidate.klass], ["Повторное рассмотрение", prev?.reviewDate, candidate.reviewDate],
      ["Родитель уведомлён", prev?.parentNotified ?? "", candidate.parentNotified ?? ""], ["Следующий контакт", prev?.nextContact, candidate.nextContact],
    ])];
    if (changes.length) await audit(t, a.id, c, "candidate", "анкета кандидата", changes);
    if ((prev?.decision || null) !== candidate.decision) {
      await audit(t, a.id, c, "decision", candidate.decision ? candidate.decisionLabel : "снято");
      if (candidate.decision) await notifyAdmission(t, a, "decision", c, { summary: candidate.decisionLabel });
      if (prev?.published) await audit(t, a.id, c, "unpublished", "решение изменено — опубликуйте заново");
    }
    if (prev?.publishAt && !keepSchedule) {
      await cancelJob(t, pubKey(a.id)).catch(() => false);
      await audit(t, a.id, c, "publish_cancelled", "решение изменено");
    }
    if (!!prev?.feedbackGiven !== candidate.feedbackGiven) await audit(t, a.id, c, "feedback", candidate.feedbackGiven ? "дана" : "снята");
    if (patch.child && (patch.child as any).grade !== a.child.grade) await syncReferral(t, { ...a, ...patch } as any, await loadTemplates(t));
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
    if (candidateOf(a)?.published) return fail(res, 409, PUBLISHED_LOCK);
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


/** «Результаты готовы» — вручную (экзамен с отправкой «вручную» или повторно); только опубликованным. */
router.post("/:tenantId/applicants/:id/results-email", ...staff, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId; const c: StaffCaller = req.caller;
    if (!hasPerm(c, "admission:manage")) return fail(res, 403, "Нет прав");
    const a = await loadApplicant(t, String(req.params.id));
    if (!a) return fail(res, 404, "Поступающий не найден");
    if (!candidateOf(a)?.published) return fail(res, 409, "Сначала опубликуйте результаты");
    const r = await emailResultsReady(t, a, { force: true, by: c.uid });
    if (!r.sent) return fail(res, 400, r.reason || "Не отправилось");
    return res.json({ success: true, to: r.to || familyEmails(a) });
  } catch (e: any) { return oops(res, e); }
});

/**
 * Скан QR. Сотрудник этой организации с правами поступающих — в карточку на
 * свою вкладку (специалист — своя анкета, приёмная/администрация — академическая
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
    if (c?.member && hasPerm(c, ...(await admissionPerms(l.tenantId)))) {
      // Всегда в раздел «Приём»: туда пускает право приёма или право из анкеты, а не права на экзамены.
      const reception = hasPerm(c, "admission:manage");
      const tab = reception ? (l.purpose === "parent" ? "parent" : "test") : "own";
      const sec = req.query.s ? `&s=${encodeURIComponent(String(req.query.s).slice(0, 40))}` : "";
      const url = applicantPath(l.tenantId, a.id, tab, reception ? undefined : "staff");
      return res.json({ success: true, mode: "staff", org, who: c.name, url: `${url}${sec}`, child: a.child.name, refNo: a.refNo });
    }
    // Карточка в архиве — ссылки родителя и ученика не работают, пока её не вернут.
    if (a.archived) return fail(res, 404, "Ссылка не найдена или уже заменена новой");
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
      // Результаты — только после решения и публикации менеджером.
      const cand = candidateOf(a);
      const open = !!done && !!cand?.decision && !!cand.decisionFinal && !!cand.published;
      // Экзамен отдаёт результаты страницей — и она уже опубликована: вариант по решению, переменные подставлены.
      let resultPage = null;
      if (open && cand) {
        const rs = sanitizeSettings((await examOfApplicant(l.tenantId, a, String(done.examId || "")))?.settings).results;
        if (rs.delivery === "page" && rs.pageId) {
          const subjects = done.sections.map((x: any) => { const lv = subjectLevel(x, done.parts, done.levels); return { title: x.title, percent: x.percent, level: lv.own || LEVEL_WORD[lv.band] }; });
          const trial = cand.trialFrom || cand.trialTo ? { from: ruDate(cand.trialFrom), to: ruDate(cand.trialTo), klass: cand.klass || a.child.grade } : null;
          const data: ResultData = { child: a.child.name, examTitle: String(done.examTitle || ""), subjects, feedback: cand.feedbackGiven ? cand.feedback : "", trial };
          const vars: Record<string, string> = {
            ребёнок: a.child.name, класс: a.child.grade, решение: cand.decisionLabel, организация: org.name,
            дата: new Date(cand.published?.at || Date.now()).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }),
            обратная_связь: data.feedback, пробный_с: trial?.from || "", пробный_по: trial?.to || "", класс_зачисления: cand.klass || a.child.grade,
          };
          resultPage = await buildView(l.tenantId, rs.pageId, cand.decision!, vars, data).catch(() => null);
        }
      }
      return res.json({
        success: true, mode: "student", org, signedIn, resultPage,
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
    // Закрыта только отправленная анкета: до отправки родитель доделывает её в любое время — и после встречи, и после теста.
    const locked = prev?.status === "done";
    // Что уже известно (карточка, ответы ученика перед тестом) — подставлено, родитель проверяет и дополняет.
    const prefill = profileAnswers(a, tpl, null);
    // Отправленные ответы по ссылке (её могли переслать или сфотографировать) не показываем — только статус.
    return res.json({
      success: true, mode: "parent", org, signedIn, locked, template: locked ? { ...tpl, sections: [] } : tpl,
      answers: locked ? {} : { ...prefill, ...Object.fromEntries(Object.entries(prev?.answers || {}).filter(([, v]) => answered(v) || v?.rating || v?.comment)) }, done: prev?.status === "done", grade: a.child.grade,
    });
  } catch (e: any) { return oops(res, e); }
});

/** Анкета родителя по ссылке: найти её запись и шаблон; отправленная — закрыта. */
async function parentFormFor(token: string, res: any) {
  const l = await resolveLink(token);
  if (!l || l.purpose !== "parent") { fail(res, 404, "Ссылка не найдена или уже заменена новой"); return null; }
  const gate = await checkTenantOpen(l.tenantId, "admissions");
  if (!gate.ok) { fail(res, gate.status || 403, gate.error || "Недоступно"); return null; }
  const a = l.applicant; const t = l.tenantId;
  if (a.archived) { fail(res, 404, "Ссылка не найдена или уже заменена новой"); return null; }
  const templates = await loadTemplates(t);
  const existing = (await col(t, "applicant_forms").where("applicantId", "==", a.id).get()).docs
    .map(d => ({ ref: d.ref, data: d.data() as ApplicantForm })).find(f => f.data.template?.audience === "parent");
  const fref = existing?.ref || col(t, "applicant_forms").doc(`${a.id}_${(templates.find(x => x.audience === "parent" && !x.archived) || { id: "" }).id}`);
  const prev = existing?.data || null;
  const tpl = prev?.template || templates.find(x => x.audience === "parent" && !x.archived);
  if (!tpl) { fail(res, 404, "Анкета для родителей не настроена"); return null; }
  if (prev?.status === "done") { fail(res, 409, "Анкета уже отправлена — изменить ответы можно через приёмную"); return null; }
  return { a, t, fref, prev, tpl };
}

/** Черновик анкеты родителя: сохраняется по ходу заполнения (после согласия), без проверки обязательных полей. */
router.post("/link/:token/parent/draft", async (req: any, res: any) => {
  try {
    if (req.body?.consent !== true) return fail(res, 400, "Нужно согласие на обработку данных");
    const p = await parentFormFor(String(req.params.token), res);
    if (!p) return;
    const { a, fref, prev, tpl } = p;
    const now = Date.now();
    const answers = sanitizeAnswers(tpl, req.body?.answers);
    await fref.set(deep({
      id: fref.id, applicantId: a.id, templateId: tpl.id, template: tpl, grade: gradeOf(a.child.grade), answers, outcome: null, status: "draft",
      filledBy: { kind: "parent", name: "Родитель" }, createdAt: prev?.createdAt || now, updatedAt: now,
    }), { merge: true });
    // Черновик уже виден в карточке и анкете кандидата: поля карточки заполняются сразу, родитель их ещё уточнит.
    await col(p.t, "applicants").doc(a.id).update({ updatedAt: now, ...bindToCard(a, tpl, dropHidden(tpl, answers, gradeOf(a.child.grade)), true) });
    await bumpLive(p.t, ["admissions"], a.id).catch(() => {});
    return res.json({ success: true, savedAt: now });
  } catch (e: any) { return oops(res, e); }
});

/** Родитель отправил анкету по своей ссылке. Отправить можно, пока анкета не отправлена — и после встречи, и после теста. */
router.post("/link/:token/parent", async (req: any, res: any) => {
  try {
    if (req.body?.consent !== true) return fail(res, 400, "Нужно согласие на обработку данных");
    const p = await parentFormFor(String(req.params.token), res);
    if (!p) return;
    const { a, t, fref, prev, tpl } = p;
    // Ответы скрытых условием пунктов не хранятся и не попадают в карточку.
    const answers = dropHidden(tpl, sanitizeAnswers(tpl, req.body?.answers), gradeOf(a.child.grade));
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
    await col(t, "applicants").doc(a.id).update({ parentForm: { status: "done", at: now, by: "parent" }, updatedAt: now, ...bindToCard(a, tpl, answers, true) });
    await audit(t, a.id, null, "parent_form", "родитель заполнил анкету");
    await notifyAdmission(t, a, "parent", { uid: "", name: "заполнил родитель" });
    return res.json({ success: true });
  } catch (e: any) { return oops(res, e); }
});

export default router;

/** Запись в историю карточки — для разовых правок данных и других модулей. */
export { audit as writeApplicantHistory };
