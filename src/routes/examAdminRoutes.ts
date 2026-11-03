import { Router } from "express";
import admin from "firebase-admin";
import { randomBytes } from "crypto";
import { view, edit } from "./examRoutes.js";
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
      .filter(e => !e.archived)
      .map(e => ({ id: e.id, title: e.title, group: e.group, status: e.status, code: e.code, sections: e.sections.length, updatedAt: e.updatedAt, opensAt: e.settings.access.opensAt, closesAt: e.settings.access.closesAt, ...(stats.get(e.id) || { total: 0, live: 0, done: 0 }) }))
      .sort((a, b) => a.group.localeCompare(b.group, "ru") || a.title.localeCompare(b.title, "ru", { numeric: true }));
    return res.json({ success: true, exams, canEdit: req.canEdit });
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
    return res.json({ success: true, exam });
  } catch (e: any) { return fail(res, 500, e.message); }
});

router.get("/:tenantId/exams/:id", ...view, checkIds, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const exam = await loadExam(t, req.params.id);
    if (!exam || exam.archived) return fail(res, 404, "Экзамен не найден");
    const bank = await bankFor(t, exam.sections.map(s => s.disciplineId));
    const plans = Object.fromEntries(exam.sections.map(s => [s.id, sectionPlan(s, bank)]));
    return res.json({ success: true, exam, plans, pin: pinNow(exam), canEdit: req.canEdit });
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
    if (!exam || exam.archived) return fail(res, 404, "Экзамен не найден");
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
        const bank = await bankFor(t, sections.map(s => s.disciplineId));
        const empty = sections.filter(s => !sectionPlan(s, bank).pool);
        if (empty.length) return fail(res, 400, `Нет активных вопросов для: ${empty.map(s => s.title).join(", ")}`);
        const settings = patch.settings || exam.settings;
        if (settings.access.pinMode === "fixed" && !settings.access.fixedPin) return fail(res, 400, "Задайте постоянный PIN или выберите другой режим");
      }
      patch.status = b.status;
    }
    await col(t, "exams").doc(exam.id).update(JSON.parse(JSON.stringify(patch)));
    const next = { ...exam, ...patch };
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
      tx.update(col(t, "exams").doc(exam.id), { archived: true, status: "closed", updatedAt: Date.now() });
      return true;
    });
    return res.json({ success: true, archived });
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

router.get("/:tenantId/attempts/:aid", ...view, checkIds, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const a = await loadAttempt(t, req.params.aid);
    if (!a) return fail(res, 404, "Работа не найдена");
    const { token: _t, ...rest } = a;
    return res.json({ success: true, attempt: rest });
  } catch (e: any) { return fail(res, 500, e.message); }
});

router.get("/:tenantId/attempts/:aid/evidence", ...view, checkIds, async (req: any, res: any) => {
  try {
    const s = await col(req.params.tenantId, "exam_evidence").doc(String(req.params.aid)).get();
    return res.json({ success: true, snapshots: s.exists ? s.data()?.snapshots || [] : [] });
  } catch (e: any) { return fail(res, 500, e.message); }
});

router.get("/:tenantId/attempts/:aid/photo", ...view, checkIds, async (req: any, res: any) => {
  try {
    const s = await col(req.params.tenantId, "exam_photos").doc(String(req.params.aid)).get();
    return res.json({ success: true, photo: s.exists ? s.data()?.photo || null : null });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/** Ручная проверка: баллы за вопросы и заметки; complete — проверка завершена. */
router.post("/:tenantId/attempts/:aid/review", ...edit, checkIds, async (req: any, res: any) => {
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
    return res.json({ success: true, result, review });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/**
 * Действия над работой: publish / unpublish / annul / restore / allow_retake /
 * finish (досдать сейчас) / delete / decision / group.
 */
router.post("/:tenantId/attempts/:aid/action", ...edit, checkIds, async (req: any, res: any) => {
  try {
    const t = req.params.tenantId;
    const a = await loadAttempt(t, req.params.aid);
    if (!a) return fail(res, 404, "Работа не найдена");
    const exam = await loadExam(t, a.examId);
    const ref = col(t, "exam_attempts").doc(a.id);
    const action = String(req.body?.action || "");
    const now = Date.now();
    switch (action) {
      case "publish":
        if (a.status !== "finished") return fail(res, 409, "Опубликовать можно только сданную работу");
        if (exam?.settings.results.requireReview && a.review?.status !== "done") return fail(res, 409, "Сначала завершите проверку работы");
        await ref.update({ published: true, publishedAt: now }); break;
      case "unpublish": await ref.update({ published: false, publishedAt: null }); break;
      case "annul": {
        await ref.update({ status: "annulled", published: false, annulledAt: now, annulledBy: who(req), annulReason: str(req.body?.reason, 300) });
        // Аннулировали пересдачу — в зачёт возвращается работа, которую она заменила.
        const replaced = await col(t, "exam_attempts").where("examId", "==", a.examId).where("supersededBy", "==", a.id).get();
        for (const d of replaced.docs) await d.ref.update({ superseded: false, supersededBy: admin.firestore.FieldValue.delete() });
        break;
      }
      case "restore":
        if (a.status !== "annulled") return fail(res, 409, "Работа не аннулирована");
        await ref.update({ status: a.result ? "finished" : "in_progress" });
        if (a.result) await supersedeOthers(t, { ...(a as any), status: "finished" });
        break;
      case "allow_retake": await ref.update({ retakeAllowed: true }); break;
      case "finish": {
        if (a.status !== "in_progress" || !exam) return fail(res, 409, "Работа уже не идёт");
        const result = gradeAttempt(a.sections, a.questions, a.answers, exam.settings, a.review?.overrides || {});
        const sections = a.sections.map(s => ({ ...s, finishedAt: s.finishedAt || now }));
        await ref.update({ status: "finished", finishedAt: now, sections, result, finishedBy: who(req) });
        await supersedeOthers(t, { ...(a as any), status: "finished" });
        break;
      }
      case "decision": {
        const v = req.body?.value as Decision | null;
        if (v !== null && !["accepted", "reserve", "rejected"].includes(v)) return fail(res, 400, "Неизвестное решение");
        await ref.update({ decision: v ? { value: v, comment: str(req.body?.comment, 1000), by: who(req), at: now } : null }); break;
      }
      case "group": await ref.update({ group: str(req.body?.value, 30) || null }); break;
      case "delete":
        await ref.delete();
        await col(t, "exam_evidence").doc(a.id).delete().catch(() => {});
        await col(t, "exam_photos").doc(a.id).delete().catch(() => {});
        return res.json({ success: true, deleted: true });
      default: return fail(res, 400, "Неизвестное действие");
    }
    const fresh = await loadAttempt(t, a.id);
    return res.json({ success: true, attempt: fresh ? toRow(fresh) : null });
  } catch (e: any) { return fail(res, 500, e.message); }
});

/** Опубликовать все сданные (и, если требуется, проверенные) работы экзамена. */
router.post("/:tenantId/exams/:id/publish-all", ...edit, checkIds, async (req: any, res: any) => {
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
    return res.json({ success: true, count: ready.length, waitingReview: snap.docs.filter(d => !d.data().published && exam.settings.results.requireReview && d.data().review?.status !== "done").length });
  } catch (e: any) { return fail(res, 500, e.message); }
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
