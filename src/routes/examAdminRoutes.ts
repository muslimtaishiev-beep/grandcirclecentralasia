import { applicantAudit } from "../server/applicantAudit.js";
import { liveOnWrite } from "../server/live.js";
import { isAdmissionExam, notifyTested, syncAllReferrals } from "./admissionRoutes.js";
import { emailExamResultsReady, examSendsOnPublish, examUsesPage } from "../server/examResults.js";
import { registerJobHandler, scheduleJob } from "../server/scheduler.js";
import { Router } from "express";
import admin from "firebase-admin";
import { randomBytes } from "crypto";
import { view, review, edit, examLevel } from "./examRoutes.js";
import { requireFirebaseAuth } from "./authRoutes.js";
import { requireScreen } from "../server/tenantAccess.js";
import { callerPermissions } from "../server/access.js";
import { hourlyPin } from "../shared/pin.js";
import type { BankQuestion } from "../shared/exams.js";
import {
  DEFAULT_SETTINGS, gradeAttempt, sanitizeSections, sanitizeSettings, sectionPlan,
  type Attempt, type AttemptRow, type Decision, type Exam,
} from "../shared/examRun.js";
import { finalizeIfExpired, supersedeOthers } from "./examPublicRoutes.js";

/**
 * «Экзамены»: кабинет менеджера — конструктор, работы, проверка, решения.
 *
 * Работы хранят «замороженные» вопросы с ключами на момент старта: правка
 * банка не меняет баллы уже сданных работ, а перепроверка с ручными
 * оценками считает по тем же ключам, что видел ученик.
 */
const router = Router();
// Изменения экзаменов и работ — открытые экраны (работы, поступающие) обновляются сами.
router.use("/:tenantId/exams", liveOnWrite(["exams", "admissions"]));
router.use("/:tenantId/attempts", liveOnWrite(["exams", "admissions"], /^\/([^/]+)/));
router.use("/:tenantId/attempts-bulk", liveOnWrite(["exams", "admissions"]));
router.use("/:tenantId/attempts-trash", liveOnWrite(["exams", "admissions"]));
// Действия с работой поступающего — в его историю.
const ATTEMPT_ACTION: Record<string, string> = {
  publish: "Результаты опубликованы", unpublish: "Публикация снята", annul: "Работа аннулирована", restore: "Работа восстановлена",
  allow_retake: "Разрешена пересдача", finish: "Работа досдана менеджером", delete: "Работа удалена в корзину", decision: "Решение по работе", group: "Группа",
  extend: "Продлено время", recheck: "Перепроверка", send_ready: "Письмо «Результаты готовы»",
};
router.use("/:tenantId/attempts/:aid", async (req: any, res: any, next: any) => {
  if (req.method !== "POST" || !/^[A-Za-z0-9_-]{2,80}$/.test(req.params.tenantId) || !/^[A-Za-z0-9_-]{4,64}$/.test(req.params.aid)) return next();
  const t = req.params.tenantId;
  const a = (await col(t, "exam_attempts").doc(req.params.aid).get().catch(() => null))?.data();
  if (!a?.applicantId) return next();
  const send = res.json.bind(res);
  res.json = (body: any) => {
    if (res.statusCode >= 400 || body?.success === false) return send(body);
    const sub = String(req.path || "").split("/").pop();
    const act = sub === "review" ? (req.body?.complete ? "Работа проверена" : "Проверка: изменены баллы") : ATTEMPT_ACTION[String(req.body?.action || "")] || String(req.body?.action || "Изменение работы");
    const by = { uid: String(req.user?.uid || ""), name: String(req.user?.name || req.user?.email || "Сотрудник").slice(0, 120) };
    void applicantAudit(t, String(a.applicantId), by, "attempt", [act, String(a.examTitle || "")].filter(Boolean).join(" · ")).finally(() => send(body));
    return res;
  };
  next();
});
const db = () => admin.firestore();
const col = (t: string, name: string) => db().collection("tenants").doc(t).collection(name);
const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const fail = (res: any, status: number, error: string) => res.status(status).json({ success: false, error });
const who = (req: any) => str(req.user?.email || req.user?.uid, 120);

/** Идентификаторы в адресе — только по образцу (иначе «%2F» строит вложенный путь Firestore). */
const SAFE_ID = /^[\w-]{1,64}$/;
const checkIds = (req: any, res: any, next: any) => {
  for (const k of ["id", "aid"]) if (req.params[k] !== undefined && !SAFE_ID.test(String(req.params[k]))) return fail(res, 400, "Неверный идентификатор");
  next();
};
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * История экзамена и его работ: tenants/{t}/exam_history — кто, когда, что.
 * Ошибка записи не ломает действие.
 */
export async function examHistory(t: string, req: any, ev: { examId: string; attemptId?: string; action: string; detail?: string }) {
  try {
    await col(t, "exam_history").add({
      examId: ev.examId, attemptId: ev.attemptId || null, action: str(ev.action, 80), detail: str(ev.detail, 500),
      by: { uid: str(req?.user?.uid, 128), name: str(req?.user?.name || req?.user?.email || "Система", 120) }, at: Date.now(),
    });
  } catch (e: any) { console.warn("[exam-history]", e?.message); }
}

/**
 * Работа поступающего и экзамен приёма открываются и приёмной: она ведёт
 * ребёнка по карточке, а уведомления ведут на страницу работы.
 */
const viewOrApplicant = (kind: "exam" | "attempt") => [requireFirebaseAuth, requireScreen("exams", (req: any) => req.params.tenantId), async (req: any, res: any, next: any) => {
  try {
    const t = String(req.params.tenantId);
    const level = await examLevel(req.user, t);
    if (level) { req.examLevel = level; req.canEdit = level === "edit"; req.canReview = level !== "view"; return next(); }
    const perms = await callerPermissions(db(), req.user?.uid, t, req.user);
    if (perms.has("admission:manage")) {
      const id = String(kind === "exam" ? req.params.id : req.params.aid);
      if (!SAFE_ID.test(id)) return fail(res, 400, "Неверный идентификатор");
      const d = (await col(t, kind === "exam" ? "exams" : "exam_attempts").doc(id).get()).data();
      const ok = kind === "exam" ? !!d?.settings?.admission?.grades?.length : !!d?.applicantId;
      if (ok) { req.examLevel = "view"; req.canEdit = false; req.canReview = false; req.viaAdmission = true; return next(); }
    }
    return fail(res, 403, "Нет доступа к экзаменам");
  } catch (e: any) { return fail(res, 500, e.message); }
}];

export const examPinKey = (tenantId: string, examId: string) => `${tenantId}:${examId}`;

async function newLinkCode(): Promise<string> {
  const ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 10; i++) {
    const code = Array.from(randomBytes(7)).map(x => ABC[x % ABC.length]).join("");
    if (!(await db().collection("exam_links").doc(code).get()).exists) return code;
  }
  throw new Error("Не удалось выдать ссылку экзамену — попробуйте ещё раз");
}

async function loadExam(t: string, id: string): Promise<Exam | null> {
  const s = await col(t, "exams").doc(id).get();
  return s.exists ? ({ ...(s.data() as Exam), id: s.id }) : null;
}

async function bankFor(t: string, disciplines: string[]): Promise<BankQuestion[]> {
  const ids = [...new Set(disciplines)].filter(Boolean);
  const out: BankQuestion[] = [];
  for (let i = 0; i < ids.length; i += 10) {
    const snap = await col(t, "exam_bank").where("disciplineId", "in", ids.slice(i, i + 10)).get();
    out.push(...snap.docs.map(d => ({ ...(d.data() as BankQuestion), id: d.id })));
  }
  return out;
}

const pinNow = (e: Exam) =>
  e.settings.access.pinMode === "hourly" ? hourlyPin(examPinKey(e.tenantId, e.id))
    : e.settings.access.pinMode === "fixed" ? e.settings.access.fixedPin : "";

/** Работа без тяжёлых полей и секретов — для таблиц. */
export function toRow(a: Attempt & { token?: string; questions?: unknown }): AttemptRow {
  const { answers, result, token: _t, questions: _q, ...rest } = a as any;
  const { items: _i, ...res } = result || {};
  return {
    ...rest, result: result ? res : null,
    answered: Object.values(answers || {}).filter(v => String(v ?? "").trim()).length,
    questionCount: (a.sections || []).reduce((n, s) => n + s.questionIds.length, 0),
  };
}

// ── Экзамены ────────────────────────────────────────────────────────────

router.get("/:tenantId/exams", ...view, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const [es, at] = await Promise.all([col(t, "exams").get(), col(t, "exam_attempts").select("examId", "status", "superseded").get()]);
    const stats = new Map<string, { total: number; live: number; done: number }>();
    for (const d of at.docs) {
      const x = d.data(); const st = stats.get(x.examId) || { total: 0, live: 0, done: 0 };
      if (x.superseded || x.status === "annulled") continue;
      st.total++; if (x.status === "in_progress") st.live++; if (x.status === "finished") st.done++;
      stats.set(x.examId, st);
    }
    const exams = es.docs.map(d => ({ ...(d.data() as Exam), id: d.id }))
      .filter(e => (req.query.archived === "1" ? !!e.archived : !e.archived))
      .map(e => ({ id: e.id, archived: !!e.archived, archivedAt: (e as any).archivedAt || null, title: e.title, group: e.group, status: e.status, code: e.code, sections: e.sections.length, updatedAt: e.updatedAt, opensAt: e.settings.access.opensAt, closesAt: e.settings.access.closesAt, grades: e.settings.admission?.grades || [], paper: !!e.settings.paper, pageDelivery: sanitizeSettings(e.settings).results.delivery === "page", ...(stats.get(e.id) || { total: 0, live: 0, done: 0 }) }))
      .sort((a, b) => a.group.localeCompare(b.group, "ru") || a.title.localeCompare(b.title, "ru", { numeric: true }));
    return res.json({ success: true, exams, canEdit: req.canEdit, canReview: req.canReview });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/** Новый экзамен или копия существующего (copyFrom) — например, на другой класс. */
router.post("/:tenantId/exams", ...edit, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const src = req.body?.copyFrom ? await loadExam(t, str(req.body.copyFrom, 60)) : null;
    const now = Date.now();
    const ref = col(t, "exams").doc();
    const code = await newLinkCode();
    const batch = db().batch();
    const exam: Exam = {
      id: ref.id, tenantId: t, code,
      title: str(req.body?.title, 120) || (src ? `${src.title} (копия)` : "Новый экзамен"),
      description: src?.description || "",
      group: str(req.body?.group, 80) || src?.group || "",
      status: "draft",
      sections: src ? src.sections : [],
      settings: src ? src.settings : DEFAULT_SETTINGS,
      createdAt: now, updatedAt: now, createdBy: who(req),
    };
    // Экзамен и его ссылка — одной пачкой; ссылка через create: чужую не перезапишем.
    batch.create(ref, exam);
    batch.create(db().collection("exam_links").doc(code), { tenantId: t, examId: ref.id, createdAt: now });
    await batch.commit();
    await examHistory(t, req, { examId: ref.id, action: src ? "Создан копией" : "Создан", detail: src ? src.title : exam.title });
    return res.json({ success: true, exam });
  } catch (e: any) { return fail(res, 500, e.message); }
});

router.get("/:tenantId/exams/:id", ...viewOrApplicant("exam"), checkIds, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const exam = await loadExam(t, req.params.id);
    if (!exam) return fail(res, 404, "Экзамен не найден");
    const bank = await bankFor(t, exam.sections.map(s => s.disciplineId));
    const plans = Object.fromEntries(exam.sections.map(s => [s.id, sectionPlan(s, bank)]));
    return res.json({ success: true, exam, plans, pin: req.viaAdmission ? "" : pinNow(exam), canEdit: req.canEdit && !exam.archived, canReview: req.canReview, canManage: !!req.canEdit, archived: !!exam.archived });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/** Сколько вопросов найдётся под раздел — живой подсчёт для конструктора. */
router.post("/:tenantId/exams/:id/plan", ...view, checkIds, async (req: any, res: any) => {
  try {
    const sections = sanitizeSections(req.body?.sections);
    const bank = await bankFor(req.params.tenantId, sections.map(s => s.disciplineId));
    return res.json({ success: true, plans: Object.fromEntries(sections.map(s => [s.id, sectionPlan(s, bank)])) });
  } catch (e: any) { return fail(res, 500, e.message); }
});

router.put("/:tenantId/exams/:id", ...edit, checkIds, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const exam = await loadExam(t, req.params.id);
    if (!exam) return fail(res, 404, "Экзамен не найден");
    if (exam.archived) return fail(res, 409, "Экзамен в архиве — сначала верните его");
    const b = req.body || {};
    const patch: Partial<Exam> = { updatedAt: Date.now() };
    if (b.title !== undefined) patch.title = str(b.title, 120) || exam.title;
    if (b.description !== undefined) patch.description = str(b.description, 1000);
    if (b.group !== undefined) patch.group = str(b.group, 80);
    if (b.sections !== undefined) patch.sections = sanitizeSections(b.sections);
    if (b.settings !== undefined) patch.settings = sanitizeSettings(b.settings);
    if (b.status !== undefined) {
      if (!["draft", "open", "closed"].includes(b.status)) return fail(res, 400, "Неизвестный статус");
      const sections = patch.sections || exam.sections;
      if (b.status === "open") {
        if (!sections.length) return fail(res, 400, "Добавьте хотя бы одну дисциплину");
        const settings = patch.settings || exam.settings;
        // Тест на бумаге без вопросов: ответы вносит администрация.
        if (!settings.paper) {
          const bank = await bankFor(t, sections.map(s => s.disciplineId));
          const empty = sections.filter(s => !sectionPlan(s, bank).pool);
          if (empty.length) return fail(res, 400, `Нет активных вопросов для: ${empty.map(s => s.title).join(", ")}`);
        }
        if (settings.access.pinMode === "fixed" && !settings.access.fixedPin) return fail(res, 400, "Задайте постоянный PIN или выберите другой режим");
      }
      patch.status = b.status;
    }
    await col(t, "exams").doc(exam.id).update(JSON.parse(JSON.stringify(patch)));
    const next = { ...exam, ...patch };
    const STATUS_WORD: Record<string, string> = { draft: "Черновик", open: "Открыт", closed: "Закрыт" };
    const changed: string[] = [];
    if (patch.title !== undefined && patch.title !== exam.title) changed.push(`название: «${exam.title}» → «${patch.title}»`);
    if (patch.group !== undefined && patch.group !== exam.group) changed.push(`группа: ${exam.group || "—"} → ${patch.group || "—"}`);
    if (patch.description !== undefined && patch.description !== exam.description) changed.push("описание");
    if (patch.sections && JSON.stringify(patch.sections) !== JSON.stringify(exam.sections)) changed.push(`разделы (${exam.sections.length} → ${patch.sections.length})`);
    if (patch.settings) {
      const a = exam.settings as any, z = patch.settings as any;
      const keys = [...new Set([...Object.keys(a || {}), ...Object.keys(z || {})])].filter(k => JSON.stringify(a?.[k]) !== JSON.stringify(z?.[k]));
      const SETTING_WORD: Record<string, string> = { access: "допуск и PIN", results: "результаты", scoring: "оценивание", proctoring: "прокторинг", admission: "приём", paper: "бумажный тест" };
      if (keys.length) changed.push(`настройки: ${keys.map(k => SETTING_WORD[k] || k).join(", ")}`);
    }
    if (patch.status && patch.status !== exam.status) changed.unshift(`статус: ${STATUS_WORD[exam.status] || exam.status} → ${STATUS_WORD[patch.status] || patch.status}`);
    if (changed.length) await examHistory(t, req, { examId: exam.id, action: patch.status && patch.status !== exam.status ? "Статус" : "Изменён", detail: changed.join("; ") });
    // Классы, этапы или статус экзамена поменялись — поступающие, которые ждут
    // тест своего класса, получают его сами (уже напечатанный QR начинает работать).
    if ((next as Exam).settings?.admission?.grades?.length || exam.settings?.admission?.grades?.length) {
      await syncAllReferrals(t).catch(e => console.warn("[exam-admin] referrals", e?.message));
    }
    return res.json({ success: true, exam: next, pin: pinNow(next as Exam) });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/** Без работ — удаляется; с работами — уходит в архив вместе с ними. */
router.delete("/:tenantId/exams/:id", ...edit, checkIds, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const exam = await loadExam(t, req.params.id);
    if (!exam) return fail(res, 404, "Экзамен не найден");
    // Проверка и удаление — в одной транзакции: работа, начатая между ними,
    // не должна остаться без экзамена.
    const archived = await db().runTransaction(async tx => {
      const has = await tx.get(col(t, "exam_attempts").where("examId", "==", exam.id).limit(1));
      if (has.empty) {
        tx.delete(col(t, "exams").doc(exam.id));
        tx.delete(db().collection("exam_links").doc(exam.code));
        return false;
      }
      tx.update(col(t, "exams").doc(exam.id), { archived: true, status: "closed", archivedAt: Date.now(), archivedBy: who(req), updatedAt: Date.now() });
      return true;
    });
    await examHistory(t, req, { examId: exam.id, action: archived ? "В архиве" : "Удалён", detail: exam.title });
    return res.json({ success: true, archived });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/** Вернуть экзамен из архива — закрытым: открыть его снова решает менеджер. */
router.post("/:tenantId/exams/:id/restore", ...edit, checkIds, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const exam = await loadExam(t, req.params.id);
    if (!exam) return fail(res, 404, "Экзамен не найден");
    if (!exam.archived) return fail(res, 409, "Экзамен не в архиве");
    await col(t, "exams").doc(exam.id).update({ archived: false, status: "closed", archivedAt: admin.firestore.FieldValue.delete(), archivedBy: admin.firestore.FieldValue.delete(), updatedAt: Date.now() });
    await examHistory(t, req, { examId: exam.id, action: "Возвращён из архива", detail: exam.title });
    return res.json({ success: true });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/** История экзамена и его работ — новые сверху. */
router.get("/:tenantId/exams/:id/history", ...view, checkIds, async (req: any, res: any) => {
  try {
    const snap = await col(req.params.tenantId, "exam_history").where("examId", "==", String(req.params.id)).get();
    const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).sort((a, b) => b.at - a.at).slice(0, 500);
    return res.json({ success: true, rows });
  } catch (e: any) { return fail(res, 500, e.message); }
});

// ── Работы ──────────────────────────────────────────────────────────────

async function examAttempts(t: string, examId: string, exam: Exam): Promise<(Attempt & { questions?: any })[]> {
  const snap = await col(t, "exam_attempts").where("examId", "==", examId).get();
  const out: (Attempt & { questions?: any })[] = [];
  for (const d of snap.docs) {
    let a = { ...(d.data() as Attempt), id: d.id } as Attempt & { questions?: any };
    // Время вышло, а ученик закрыл вкладку — работа досдаётся сама.
    if (a.status === "in_progress") a = (await finalizeIfExpired(t, exam, a)) as any;
    out.push(a);
  }
  return out.sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * «Сейчас сдают»: все идущие работы организации — кто, какой экзамен и раздел,
 * сколько осталось, сколько нарушений. Для страницы «Сейчас».
 */
router.get("/:tenantId/live", ...view, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const snap = await col(t, "exam_attempts").where("status", "==", "in_progress")
      .select("examId", "examTitle", "shortId", "student.name", "student.level", "startedAt", "current", "sections", "applicantId", "refNo", "proctoring.totalViolations", "proctoring.bySeverity", "proctoring.recent").get();
    const now = Date.now();
    // Брошенные работы с вышедшим временем досдаются сразу: у них появляется
    // результат, приёмная получает уведомление, а в «Сейчас» они не висят.
    const expired = snap.docs.filter(d => { const x: any = d.data(); const dl = x.sections?.[x.current]?.deadline; return dl && dl + 60_000 < now; });
    if (expired.length) {
      const exams = new Map<string, Exam | null>();
      for (const d of expired.slice(0, 50)) {
        const x: any = d.data();
        if (!exams.has(x.examId)) exams.set(x.examId, await loadExam(t, x.examId));
        const ex = exams.get(x.examId);
        if (!ex) continue;
        const full = await col(t, "exam_attempts").doc(d.id).get();
        await finalizeIfExpired(t, ex, { ...(full.data() as Attempt), id: d.id }).catch(e => console.warn("[exam-admin] finalize", e?.message));
      }
    }
    const done = new Set(expired.slice(0, 50).map(d => d.id));
    const live = snap.docs.filter(d => !done.has(d.id)).map(d => {
      const x: any = d.data(); const cur = x.sections?.[x.current];
      return {
        id: d.id, examId: x.examId, examTitle: x.examTitle, shortId: x.shortId, name: x.student?.name || "", level: x.student?.level || "",
        startedAt: x.startedAt, section: cur?.title || "", sectionNo: (x.current || 0) + 1, sectionCount: (x.sections || []).length,
        deadline: cur?.deadline || null, waitingStart: !!cur && !cur.deadline,
        applicantId: x.applicantId || null, refNo: x.refNo || null, violations: x.proctoring?.totalViolations || 0, highViolations: x.proctoring?.bySeverity?.HIGH || 0,
        lastViolation: (x.proctoring?.recent || []).slice(-1)[0]?.description || "",
      };
    })
      // Брошенные давно (время вышло больше часа назад) — не «сейчас»: их досдаст открытие списка работ.
      .filter(r => !r.deadline || r.deadline > now - 60 * 60_000)
      .sort((a, b) => (a.deadline || Infinity) - (b.deadline || Infinity));
    return res.json({ success: true, live, now, canReview: !!req.canReview });
  } catch (e: any) { return fail(res, 500, e.message); }
});

router.get("/:tenantId/exams/:id/attempts", ...view, checkIds, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const exam = await loadExam(t, req.params.id);
    if (!exam) return fail(res, 404, "Экзамен не найден");
    const list = await examAttempts(t, exam.id, exam);
    const full = req.query.full === "1";
    return res.json({ success: true, serverNow: Date.now(), attempts: list.map(a => (full ? (({ token: _t, questions: _q, ...rest }: any) => rest)(a) : toRow(a))) });
  } catch (e: any) { return fail(res, 500, e.message); }
});

async function loadAttempt(t: string, id: string) {
  const s = await col(t, "exam_attempts").doc(id).get();
  return s.exists ? ({ ...(s.data() as any), id: s.id } as Attempt & { questions: Record<string, any>; token: string }) : null;
}

router.get("/:tenantId/attempts/:aid", ...viewOrApplicant("attempt"), checkIds, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const a = await loadAttempt(t, req.params.aid);
    if (!a) return fail(res, 404, "Работа не найдена");
    const { token: _t, ...rest } = a;
    // Ключи ответов — только проверяющим и выше.
    if (!req.canReview && rest.questions) rest.questions = Object.fromEntries(Object.entries(rest.questions).map(([k, q]: any) => [k, { ...q, answer: "" }]));
    return res.json({ success: true, attempt: rest, canReview: req.canReview, canEdit: req.canEdit });
  } catch (e: any) { return fail(res, 500, e.message); }
});

router.get("/:tenantId/attempts/:aid/evidence", ...viewOrApplicant("attempt"), checkIds, async (req: any, res: any) => {
  try {
    const s = await col(req.params.tenantId, "exam_evidence").doc(String(req.params.aid)).get();
    return res.json({ success: true, snapshots: s.exists ? s.data()?.snapshots || [] : [] });
  } catch (e: any) { return fail(res, 500, e.message); }
});

router.get("/:tenantId/attempts/:aid/photo", ...viewOrApplicant("attempt"), checkIds, async (req: any, res: any) => {
  try {
    const s = await col(req.params.tenantId, "exam_photos").doc(String(req.params.aid)).get();
    return res.json({ success: true, photo: s.exists ? s.data()?.photo || null : null });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/**
 * Перепроверка: ключи и баллы вопросов — из банка сейчас (если ключ
 * исправили после экзамена), ответы ученика и ручные оценки — прежние.
 * Вопрос, которого в банке уже нет, проверяется по старому ключу.
 */
type WithQuestions = Attempt & { questions: Record<string, any> };
async function recheck(t: string, a: WithQuestions, settings: any, bank?: Map<string, any>) {
  const ids = Object.keys(a.questions || {});
  if (!bank) {
    bank = new Map();
    for (let i = 0; i < ids.length; i += 300) {
      const snaps = await db().getAll(...ids.slice(i, i + 300).map(id => col(t, "exam_bank").doc(id)));
      for (const sn of snaps) if (sn.exists) bank.set(sn.id, sn.data());
    }
  }
  let keys = 0;
  const questions: Record<string, any> = {};
  for (const [id, q] of Object.entries(a.questions)) {
    const b = bank.get(id);
    const next: any = b ? { ...(q as any), answer: String(b.answer ?? q.answer), points: Number(b.points) > 0 ? Number(b.points) : q.points } : q;
    if (next.answer !== q.answer || next.points !== q.points) keys++;
    questions[id] = next;
  }
  const result = gradeAttempt(a.sections, questions, a.answers, settings, a.review?.overrides || {});
  return { questions, result, keys, before: a.result?.percent ?? 0, after: result.percent };
}

/** Ручная проверка: баллы за вопросы и заметки; complete — проверка завершена. */
router.post("/:tenantId/attempts/:aid/review", ...review, checkIds, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const a = await loadAttempt(t, req.params.aid);
    if (!a) return fail(res, 404, "Работа не найдена");
    if (a.status !== "finished") return fail(res, 409, "Проверять можно только сданную работу");
    const exam = await loadExam(t, a.examId);
    const settings = exam?.settings || DEFAULT_SETTINGS;
    const overrides: Record<string, number> = { ...(a.review?.overrides || {}) };
    const notes: Record<string, string> = { ...(a.review?.notes || {}) };
    for (const [qid, v] of Object.entries(req.body?.overrides || {})) {
      if (!own(a.questions, qid)) continue;
      if (v === null) delete overrides[qid];
      else { const n = Number(v); if (Number.isFinite(n)) overrides[qid] = Math.max(0, Math.min(a.questions[qid].points, n)); }
    }
    for (const [qid, v] of Object.entries(req.body?.notes || {})) {
      if (!own(a.questions, qid)) continue;
      const n = str(v, 500); if (n) notes[qid] = n; else delete notes[qid];
    }
    const result = gradeAttempt(a.sections, a.questions, a.answers, settings, overrides);
    const review = { status: req.body?.complete ? "done" : (a.review?.status || "none"), overrides, notes, by: who(req), at: Date.now() };
    await col(t, "exam_attempts").doc(a.id).update({ result, review });
    await examHistory(t, req, { examId: a.examId, attemptId: a.id, action: req.body?.complete ? "Работа проверена" : "Изменены баллы", detail: `${a.student?.name || ""} · ${result.percent}%` });
    return res.json({ success: true, result, review });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/** Что может проверяющий; остальное — только тот, кто управляет экзаменами. */
const REVIEW_ACTIONS = new Set(["publish", "unpublish", "finish", "recheck", "extend", "group", "send_ready"]);

/** Аннулировали или удалили пересдачу — в зачёт возвращается работа, которую она заменила. */
async function unsupersede(t: string, a: Attempt) {
  const replaced = await col(t, "exam_attempts").where("examId", "==", a.examId).where("supersededBy", "==", a.id).get();
  for (const d of replaced.docs) await d.ref.update({ superseded: false, supersededBy: admin.firestore.FieldValue.delete() });
}

/**
 * Действие над одной работой: publish / unpublish / annul / restore /
 * allow_retake / finish / delete / decision / group / recheck / extend.
 * Возвращает ошибку, флаг удаления или итог перепроверки.
 */
/** Письмо «Результаты готовы» обычной работе: страница результатов выбрана, экзамен не вступительный. */
const readyMailApplies = (exam: Exam | null, a: Attempt): exam is Exam => !!exam && !a.applicantId && !isAdmissionExam(exam) && examUsesPage(exam);

async function applyAction(t: string, req: any, a: Attempt & { questions: Record<string, any>; token: string }, exam: Exam | null, action: string, body: any): Promise<{ error?: [number, string]; deleted?: boolean; recheck?: any; email?: { sent: boolean; reason?: string; skipped?: boolean } }> {
  if (!REVIEW_ACTIONS.has(action) && !req.canEdit) return { error: [403, "Это действие доступно тому, кто управляет экзаменами"] };
  const ref = col(t, "exam_attempts").doc(a.id);
  const now = Date.now();
  let detail = "";
  switch (action) {
    case "publish":
      if (a.status !== "finished") return { error: [409, "Опубликовать можно только сданную работу"] };
      if (exam?.settings.results.requireReview && a.review?.status !== "done") return { error: [409, "Сначала завершите проверку работы"] };
      await ref.update({ published: true, publishedAt: now, publishAt: null });
      // Результаты отдаёт страница — письмо со ссылкой уходит при публикации (или позже кнопкой).
      if (readyMailApplies(exam, a) && examSendsOnPublish(exam)) {
        const email = await emailExamResultsReady(t, exam, { ...a, published: true, publishedAt: now }, { by: who(req) });
        await examHistory(t, req, { examId: a.examId, attemptId: a.id, action: ATTEMPT_ACTION.publish, detail: [a.student?.name || "", email.sent ? `письмо: ${email.to || "ушло"}` : ""].filter(Boolean).join(" · ") });
        return { email };
      }
      break;
    case "send_ready": {
      if (!readyMailApplies(exam, a)) return { error: [409, "У экзамена результаты не страницей по ссылке"] };
      if (!a.published && sanitizeSettings(exam.settings).results.showToStudent !== "immediately") return { error: [409, "Сначала опубликуйте результаты"] };
      const email = await emailExamResultsReady(t, exam, a, { force: true, by: who(req) });
      if (!email.sent) return { error: [409, email.reason || "Письмо не отправлено"], email };
      detail = email.to || "";
      break;
    }
    case "unpublish": await ref.update({ published: false, publishedAt: null }); break;
    case "annul":
      await ref.update({ status: "annulled", published: false, annulledAt: now, annulledBy: who(req), annulReason: str(body?.reason, 300) });
      await unsupersede(t, a);
      detail = str(body?.reason, 300);
      break;
    case "restore":
      if (a.status !== "annulled") return { error: [409, "Работа не аннулирована"] };
      await ref.update({ status: a.result ? "finished" : "in_progress" });
      if (a.result) await supersedeOthers(t, { ...(a as any), status: "finished" });
      break;
    case "allow_retake": await ref.update({ retakeAllowed: true }); break;
    case "finish": {
      if (a.status !== "in_progress" || !exam) return { error: [409, "Работа уже не идёт"] };
      const result = gradeAttempt(a.sections, a.questions, a.answers, exam.settings, a.review?.overrides || {});
      const sections = a.sections.map(s => ({ ...s, finishedAt: s.finishedAt || now }));
      await ref.update({ status: "finished", finishedAt: now, sections, result, finishedBy: who(req) });
      await supersedeOthers(t, { ...(a as any), status: "finished" });
      await notifyTested(t, { ...(a as any), result }, exam);
      break;
    }
    case "extend": {
      const min = Math.round(Number(body?.minutes));
      if (!Number.isFinite(min) || min === 0 || Math.abs(min) > 240) return { error: [400, "Укажите минуты: от −240 до 240"] };
      if (a.status !== "in_progress") return { error: [409, "Работа уже не идёт"] };
      const cur = a.sections[a.current];
      if (!cur?.deadline) return { error: [409, "Раздел ещё не начат"] };
      const sections = a.sections.map((s, k) => (k === a.current ? { ...s, deadline: Math.max(now, (s.deadline || now) + min * 60_000), minutes: Math.max(1, s.minutes + min) } : s));
      await ref.update({ sections });
      detail = `${min > 0 ? "+" : ""}${min} мин · ${cur.title}`;
      break;
    }
    case "decision": {
      const v = body?.value as Decision | null;
      if (v !== null && !["accepted", "reserve", "rejected"].includes(v)) return { error: [400, "Неизвестное решение"] };
      await ref.update({ decision: v ? { value: v, comment: str(body?.comment, 1000), by: who(req), at: now } : null });
      detail = v || "снято";
      break;
    }
    case "group": await ref.update({ group: str(body?.value, 30) || null }); detail = str(body?.value, 30); break;
    case "recheck": {
      if (a.status !== "finished") return { error: [409, "Перепроверить можно только сданную работу"] };
      if ((a as any).paper) return { error: [409, "Тест на бумаге: результаты меняют в карточке поступающего"] };
      const r = await recheck(t, a, exam?.settings || DEFAULT_SETTINGS);
      await ref.update({ questions: r.questions, result: r.result, recheckedAt: now, recheckedBy: who(req) });
      await examHistory(t, req, { examId: a.examId, attemptId: a.id, action: "Перепроверка", detail: `${a.student?.name || ""} · ${r.before}% → ${r.after}%` });
      return { recheck: { keys: r.keys, before: r.before, after: r.after } };
    }
    case "delete": {
      // В корзину: работа уходит из итогов, но её можно вернуть. Ссылка
      // ученика (token) не переносится — по ней работа больше не открывается.
      const { token: _t, ...keep } = a as any;
      await col(t, "exam_attempts_trash").doc(a.id).set({ ...keep, deletedAt: now, deletedBy: who(req) });
      await ref.delete();
      await unsupersede(t, a);
      await examHistory(t, req, { examId: a.examId, attemptId: a.id, action: "Работа удалена в корзину", detail: a.student?.name || "" });
      return { deleted: true };
    }
    default: return { error: [400, "Неизвестное действие"] };
  }
  await examHistory(t, req, { examId: a.examId, attemptId: a.id, action: ATTEMPT_ACTION[action] || action, detail: [a.student?.name || "", detail].filter(Boolean).join(" · ") });
  return {};
}

router.post("/:tenantId/attempts/:aid/action", ...review, checkIds, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const a = await loadAttempt(t, req.params.aid);
    if (!a) return fail(res, 404, "Работа не найдена");
    const exam = await loadExam(t, a.examId);
    const out = await applyAction(t, req, a, exam, String(req.body?.action || ""), req.body);
    if (out.error) return fail(res, out.error[0], out.error[1]);
    if (out.deleted) return res.json({ success: true, deleted: true });
    const fresh = await loadAttempt(t, a.id);
    return res.json({ success: true, attempt: fresh ? toRow(fresh) : null, ...(out.recheck ? { recheck: out.recheck } : {}) });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/** Массово: { ids, action, value?, reason?, minutes? } — по одной работе, итог по каждой. */
router.post("/:tenantId/attempts-bulk", ...review, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(String).filter((x: string) => SAFE_ID.test(x)))].slice(0, 500) as string[];
    const action = String(req.body?.action || "");
    if (!ids.length) return fail(res, 400, "Не выбраны работы");
    if (!REVIEW_ACTIONS.has(action) && !req.canEdit) return fail(res, 403, "Это действие доступно тому, кто управляет экзаменами");
    // Публикация позже: одна задача на выбранные работы; в каждой — отметка «запланировано».
    const at = Number(req.body?.at);
    if (action === "publish" && Number.isFinite(at) && at >= Date.now() + 60_000) {
      const key = `exam_pub:${randomBytes(8).toString("hex")}`;
      const by = { uid: str(req.user?.uid, 128), name: str(req.user?.name || req.user?.email || "Сотрудник", 120) };
      await scheduleJob({ tenantId: t, kind: "exam_publish", key, runAt: at, payload: { ids }, by });
      let marked = 0; const errors: { id: string; error: string }[] = [];
      for (const id of ids) {
        const a = await loadAttempt(t, id);
        if (!a || a.status !== "finished" || a.published) { errors.push({ id, error: !a ? "Работа не найдена" : a.published ? "Уже опубликовано" : "Работа не сдана" }); continue; }
        await col(t, "exam_attempts").doc(id).update({ publishAt: Math.floor(at) }); marked++;
      }
      return res.json({ success: true, ok: marked, errors, scheduled: Math.floor(at) });
    }
    const exams = new Map<string, Exam | null>();
    let ok = 0; const errors: { id: string; error: string }[] = [];
    for (const id of ids) {
      const a = await loadAttempt(t, id);
      if (!a) { errors.push({ id, error: "Работа не найдена" }); continue; }
      if (!exams.has(a.examId)) exams.set(a.examId, await loadExam(t, a.examId));
      const out = await applyAction(t, req, a, exams.get(a.examId) || null, action, req.body);
      if (out.error) errors.push({ id, error: out.error[1] }); else ok++;
    }
    return res.json({ success: true, ok, errors });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/** Во время экзамена — всем идущим работам: продлить время или досдать. { action: "extend" | "finish", minutes? } */
router.post("/:tenantId/exams/:id/live", ...review, checkIds, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const exam = await loadExam(t, req.params.id);
    if (!exam) return fail(res, 404, "Экзамен не найден");
    const action = String(req.body?.action || "");
    if (!["extend", "finish"].includes(action)) return fail(res, 400, "Неизвестное действие");
    const snap = await col(t, "exam_attempts").where("examId", "==", exam.id).where("status", "==", "in_progress").get();
    let ok = 0; const errors: { id: string; error: string }[] = [];
    for (const d of snap.docs) {
      const a = { ...(d.data() as any), id: d.id };
      if (action === "extend" && !a.sections?.[a.current]?.deadline) continue;
      const out = await applyAction(t, req, a, exam, action, req.body);
      if (out.error) errors.push({ id: d.id, error: out.error[1] }); else ok++;
    }
    await examHistory(t, req, { examId: exam.id, action: action === "finish" ? "Досданы все идущие работы" : "Продлено время всем", detail: action === "extend" ? `${req.body?.minutes} мин · работ: ${ok}` : `работ: ${ok}` });
    return res.json({ success: true, ok, errors });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/** Все работы организации — общий список «Работы». ?status=&examId=&q= */
router.get("/:tenantId/attempts", ...view, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    let q: FirebaseFirestore.Query = col(t, "exam_attempts");
    const status = str(req.query.status, 20);
    if (["in_progress", "finished", "annulled"].includes(status)) q = q.where("status", "==", status);
    const examId = str(req.query.examId, 64);
    if (examId && SAFE_ID.test(examId)) q = q.where("examId", "==", examId);
    const snap = await q.select("examId", "examTitle", "shortId", "student", "status", "startedAt", "finishedAt", "result", "review", "published", "superseded", "group", "decision", "applicantId", "refNo", "proctoring", "sections", "answers", "current").get();
    const needle = str(req.query.q, 80).toLowerCase();
    const rows = snap.docs.map(d => toRow({ ...(d.data() as any), id: d.id }))
      .filter(r => !needle || `${r.student?.name || ""} ${r.shortId || ""} ${r.examTitle || ""}`.toLowerCase().includes(needle))
      .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
    return res.json({ success: true, attempts: rows.slice(0, 1000), total: rows.length, canEdit: req.canEdit, canReview: req.canReview });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/** Корзина работ. ?examId= */
router.get("/:tenantId/attempts-trash", ...view, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    let q: FirebaseFirestore.Query = col(t, "exam_attempts_trash");
    const examId = str(req.query.examId, 64);
    if (examId && SAFE_ID.test(examId)) q = q.where("examId", "==", examId);
    const snap = await q.get();
    const rows = snap.docs.map(d => ({ ...toRow({ ...(d.data() as any), id: d.id }), deletedAt: d.data().deletedAt, deletedBy: d.data().deletedBy }))
      .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
    return res.json({ success: true, attempts: rows });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/** { ids, action: "restore" | "purge" } — вернуть из корзины или стереть насовсем (со снимками и фото). */
router.post("/:tenantId/attempts-trash", ...edit, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(String).filter((x: string) => SAFE_ID.test(x)))].slice(0, 500) as string[];
    const action = String(req.body?.action || "");
    if (!ids.length) return fail(res, 400, "Не выбраны работы");
    if (!["restore", "purge"].includes(action)) return fail(res, 400, "Неизвестное действие");
    let n = 0;
    for (const id of ids) {
      const sn = await col(t, "exam_attempts_trash").doc(id).get();
      if (!sn.exists) continue;
      const a: any = { ...sn.data(), id };
      if (action === "restore") {
        const { deletedAt: _d, deletedBy: _b, ...keep } = a;
        // Ссылка ученика выдаётся заново: прежняя ушла вместе с удалением.
        await col(t, "exam_attempts").doc(id).set({ ...keep, token: randomBytes(24).toString("base64url") });
        if (keep.status === "finished" && !keep.superseded) await supersedeOthers(t, keep);
        await examHistory(t, req, { examId: a.examId, attemptId: id, action: "Работа возвращена из корзины", detail: a.student?.name || "" });
      } else {
        await col(t, "exam_evidence").doc(id).delete().catch(() => {});
        await col(t, "exam_photos").doc(id).delete().catch(() => {});
        await examHistory(t, req, { examId: a.examId, attemptId: id, action: "Работа удалена насовсем", detail: a.student?.name || "" });
      }
      await sn.ref.delete(); n++;
    }
    return res.json({ success: true, count: n });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/** Перепроверить все сданные работы экзамена по текущим ключам банка. */
router.post("/:tenantId/exams/:id/recheck-all", ...review, checkIds, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const exam = await loadExam(t, req.params.id);
    if (!exam) return fail(res, 404, "Экзамен не найден");
    const snap = await col(t, "exam_attempts").where("examId", "==", exam.id).where("status", "==", "finished").get();
    // Бумажные работы без вопросов — перепроверять нечего.
    const all = snap.docs.map(d => ({ ...(d.data() as WithQuestions), id: d.id })).filter(a => !(a as any).paper);
    const ids = [...new Set(all.flatMap(a => Object.keys(a.questions || {})))];
    const bank = new Map<string, any>();
    for (let i = 0; i < ids.length; i += 300) {
      const snaps = await db().getAll(...ids.slice(i, i + 300).map(id => col(t, "exam_bank").doc(id)));
      for (const sn of snaps) if (sn.exists) bank.set(sn.id, sn.data());
    }
    let changed = 0, keys = 0;
    const now = Date.now();
    for (let i = 0; i < all.length; i += 200) {
      const b = db().batch();
      for (const a of all.slice(i, i + 200)) {
        const r = await recheck(t, a, exam.settings, bank);
        if (r.keys) keys++;
        if (r.after !== r.before) changed++;
        b.update(col(t, "exam_attempts").doc(a.id), { questions: r.questions, result: r.result, recheckedAt: now, recheckedBy: who(req) });
      }
      await b.commit();
    }
    return res.json({ success: true, total: all.length, changed, withNewKeys: keys });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/** Опубликовать все сданные (и, если требуется, проверенные) работы экзамена. */
router.post("/:tenantId/exams/:id/publish-all", ...review, checkIds, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const exam = await loadExam(t, req.params.id);
    if (!exam) return fail(res, 404, "Экзамен не найден");
    const snap = await col(t, "exam_attempts").where("examId", "==", exam.id).where("status", "==", "finished").get();
    const ready = snap.docs.filter(d => !d.data().published && !d.data().superseded && (!exam.settings.results.requireReview || d.data().review?.status === "done"));
    for (let i = 0; i < ready.length; i += 400) {
      const b = db().batch();
      for (const d of ready.slice(i, i + 400)) b.update(d.ref, { published: true, publishedAt: Date.now() });
      await b.commit();
    }
    if (ready.length) await examHistory(t, req, { examId: exam.id, action: "Опубликованы результаты", detail: `работ: ${ready.length}` });
    if (ready.length && examSendsOnPublish(exam) && !isAdmissionExam(exam) && examUsesPage(exam)) {
      for (const d of ready) {
        const x = { ...(d.data() as Attempt), id: d.id, published: true };
        if (!x.applicantId) await emailExamResultsReady(t, exam, x, { by: who(req) });
      }
    }
    return res.json({ success: true, count: ready.length, waitingReview: snap.docs.filter(d => !d.data().published && exam.settings.results.requireReview && d.data().review?.status !== "done").length });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/** Публикация по таймеру: те же правила, что у кнопки (сданная, проверенная, не опубликованная). */
registerJobHandler("exam_publish", async job => {
  const t = job.tenantId;
  const ids: string[] = (Array.isArray(job.payload?.ids) ? job.payload.ids : []).map(String).filter((x: string) => SAFE_ID.test(x));
  const req = { user: { uid: job.createdBy?.uid || "", name: job.createdBy?.name || "Планировщик" }, canEdit: true };
  const exams = new Map<string, Exam | null>();
  let ok = 0; let skipped = 0;
  for (const id of ids) {
    const a = await loadAttempt(t, id);
    if (!a || a.published) { skipped++; continue; }
    if (!exams.has(a.examId)) exams.set(a.examId, await loadExam(t, a.examId));
    const out = await applyAction(t, req, a, exams.get(a.examId) || null, "publish", {});
    if (out.error) { skipped++; await col(t, "exam_attempts").doc(id).update({ publishAt: null }).catch(() => {}); } else ok++;
  }
  return `Опубликовано ${ok}${skipped ? `, пропущено ${skipped}` : ""}`;
});

// ── Архив прежнего вступительного теста ─────────────────────────────────

/**
 * Работы старого теста (коллекция submissions) — только чтение. Ответы
 * сопоставляются с вопросами банка по ссылке «класс:старый id», которую
 * оставил перенос, поэтому видно и вопрос, и ключ.
 */
router.get("/:tenantId/archive", ...view, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const snap = await db().collection("submissions").where("tenantId", "==", t).get();
    const rows = snap.docs.map(d => {
      const x = d.data();
      return {
        id: d.id, shortId: x.studentShortId || "", name: x.studentName || "", phone: x.studentPhone || "", email: x.studentEmail || "",
        grade: x.grade ?? null, scores: x.scores || {}, maxScore: x.maxScoreSnapshot ?? null, status: x.status || "", finalDecision: x.finalDecision || "",
        managerComment: x.managerComment || "", cheated: !!x.cheated, submittedAt: x.submittedAt?.toMillis?.() ?? x.submittedAt?._seconds * 1000 ?? null,
        proctoring: x.proctoring || null,
      };
    }).sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
    return res.json({ success: true, rows });
  } catch (e: any) { return fail(res, 500, e.message); }
});

router.get("/:tenantId/archive/:id", ...view, checkIds, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const s = await db().collection("submissions").doc(String(req.params.id)).get();
    const x = s.data();
    if (!x || x.tenantId !== t) return fail(res, 404, "Работа не найдена");
    let answers: Record<string, any> = {};
    try { answers = typeof x.answersJson === "string" ? JSON.parse(x.answersJson) : x.answersJson || {}; } catch { /* битые ответы — покажем без них */ }
    const bank = await col(t, "exam_bank").where("source.kind", "==", "admission_test").get();
    const byRef = new Map<string, BankQuestion>();
    for (const d of bank.docs) { const q = { ...(d.data() as BankQuestion), id: d.id }; for (const r of String(q.source?.ref || "").split(" ")) byRef.set(r, q); }
    const items = Object.entries(answers).map(([oldId, a]) => {
      const q = byRef.get(`${x.grade}:${oldId}`);
      return { oldId, answer: String(a ?? ""), question: q ? { id: q.id, disciplineId: q.disciplineId, text: q.text, html: q.html, type: q.type, answer: q.answer, topic: q.topic, points: q.points } : null };
    });
    // Коллекция снимков общая, ключ — шестизначный номер: при совпадении
    // номеров у двух организаций без этой проверки показались бы чужие кадры.
    const ev = await db().collection("proctoring_evidence").doc(`ev_${x.studentShortId}`).get();
    const evOk = ev.exists && ev.data()?.tenantId === t;
    return res.json({ success: true, submission: { id: s.id, ...x, answersJson: undefined }, items, snapshots: evOk ? ev.data()?.snapshots || [] : [] });
  } catch (e: any) { return fail(res, 500, e.message); }
});

export default router;
