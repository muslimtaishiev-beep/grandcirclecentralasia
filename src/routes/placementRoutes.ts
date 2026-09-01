import { Router } from "express";
import admin from "firebase-admin";
import { requireFirebaseAuth } from "./authRoutes.js";

/**
 * Вступительный срез знаний (placement exam) для распределения по классам 5-11.
 *
 * Three rules everything here serves:
 *  1. The variant is assembled ON THE SERVER and correct answers never leave it
 *     — the student's browser receives question texts and options only.
 *  2. Random selection follows a blueprint (counts per difficulty, minimum
 *     topic spread), so every student gets a different variant with the SAME
 *     difficulty profile. Placement into classes must not be a lottery.
 *  3. A session is fixed at start: refresh, crash or a new device returns the
 *     same questions with the same saved answers. Regenerating a variant by
 *     reloading the page is impossible.
 *
 * The blueprint (how many questions, which difficulty mix, section time) lives
 * in Firestore and is edited by the завуч/administration from their cabinet —
 * changing the exam's shape requires no code change.
 */

const router = Router();
const db = () => admin.firestore();

// ── PIN (same hourly scheme as the entrance tests, same forgiving window) ──
function getHourlyPIN(hourOffset = 0): string {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() + hourOffset);
  const seed = d.getUTCFullYear() * 1000000 + (d.getUTCMonth() + 1) * 10000 + d.getUTCDate() * 100 + d.getUTCHours();
  return Math.abs((seed * 1103515245 + 12345) % 9000 + 1000).toString();
}
function pinAccepted(entered: unknown): boolean {
  const clean = String(entered ?? "")
    .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x06F0))
    .replace(/[０-９]/g, c => String(c.charCodeAt(0) - 0xFF10))
    .replace(/\D/g, "");
  if (!clean) return false;
  const TESTER_PIN = process.env.VITE_TESTER_PIN || process.env.TESTER_PIN;
  if (TESTER_PIN && String(entered) === TESTER_PIN) return true;
  return [-1, 0, 1].some(o => clean === getHourlyPIN(o));
}

// Answer comparison: the UI sends the option letter, but fold the alphabets —
// Cyrillic А and Latin A are different code points that look identical, which
// already cost grade 8 students real marks once in the entrance tests.
const LOOKALIKES: Record<string, string> = { "а": "a", "в": "b", "с": "c", "е": "e", "к": "k", "м": "m", "н": "h", "о": "o", "р": "p", "т": "t", "х": "x", "у": "y" };
const foldAnswer = (s: unknown) =>
  String(s ?? "").trim().toLowerCase().split("").map(ch => LOOKALIKES[ch] ?? ch).join("");

function audit(action: string, tenantId: string, fields: Record<string, unknown> = {}) {
  db().collection("audit_logs").add({
    timestamp: admin.firestore.Timestamp.now(),
    createdAt: new Date().toISOString(),
    action, tenantId, ...fields,
  }).catch(() => {});
}

// ── Blueprint ──────────────────────────────────────────────────────────────

interface BlueprintSection {
  key: "math" | "english";
  title: string;
  minutes: number;
  counts: Record<"1" | "2" | "3", number>; // questions per difficulty
  minTopics: number;
}
interface Blueprint {
  tenantId: string;
  grade: number;
  sections: BlueprintSection[];
  // Sorted by minPercent descending; first band the score reaches wins.
  scale: { minPercent: number; label: string }[];
}

const DEFAULT_BLUEPRINT = (tenantId: string, grade: number): Blueprint => ({
  tenantId, grade,
  sections: [
    { key: "math", title: "Математика", minutes: 40, counts: { "1": 7, "2": 8, "3": 5 }, minTopics: 4 },
    { key: "english", title: "Английский язык", minutes: 35, counts: { "1": 8, "2": 8, "3": 4 }, minTopics: 3 },
  ],
  scale: [
    { minPercent: 80, label: "Сильный класс" },
    { minPercent: 55, label: "Основной класс" },
    { minPercent: 0, label: "Подготовительный класс" },
  ],
});

const bpId = (tenantId: string, grade: number) => `bp_${tenantId}_${grade}`;

async function loadBlueprint(tenantId: string, grade: number): Promise<Blueprint> {
  const snap = await db().collection("exam_blueprints").doc(bpId(tenantId, grade)).get();
  return snap.exists ? (snap.data() as Blueprint) : DEFAULT_BLUEPRINT(tenantId, grade);
}

/** Может ли пользователь управлять срезом: админ тенанта, суперадмин или роль «завуч». */
async function canManagePlacement(user: any, tenantId: string): Promise<boolean> {
  if (user?.isSuperadmin) return true;
  if (Array.isArray(user?.tenantAdminIds) && user.tenantAdminIds.includes(tenantId)) return true;
  const ms = await db().collection("memberships")
    .where("userId", "==", user?.uid || "")
    .where("tenantId", "==", tenantId)
    .where("status", "==", "active")
    .get();
  return ms.docs.some(d => /завуч/i.test(String(d.data().role || "")));
}

// GET blueprint + how many questions the bank can actually supply, so the
// cabinet can warn when someone asks for more questions than exist.
router.get("/blueprint", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const tenantId = String(req.query.tenantId || "");
    const grade = Number(req.query.grade);
    if (!tenantId || !grade) return res.status(400).json({ success: false, error: "Нужны tenantId и grade" });
    if (!(await canManagePlacement(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав на управление срезом" });
    }

    const bp = await loadBlueprint(tenantId, grade);
    const bank = await db().collection("exam_questions")
      .where("tenantId", "==", tenantId).where("active", "==", true).get();
    const availability: Record<string, Record<string, number>> = { math: { "1": 0, "2": 0, "3": 0 }, english: { "1": 0, "2": 0, "3": 0 } };
    bank.forEach(d => {
      const q = d.data();
      if (!Array.isArray(q.grades) || !q.grades.includes(grade)) return;
      const s = availability[q.subject]; if (!s) return;
      s[String(q.difficulty)] = (s[String(q.difficulty)] || 0) + 1;
    });
    return res.json({ success: true, blueprint: bp, availability });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// PUT blueprint — завуч/администрация задают количество вопросов, время и шкалу.
router.put("/blueprint", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const { tenantId, grade, sections, scale } = req.body || {};
    if (!tenantId || !grade || !Array.isArray(sections)) {
      return res.status(400).json({ success: false, error: "Нужны tenantId, grade и sections" });
    }
    if (!(await canManagePlacement(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав на управление срезом" });
    }

    // Validate the shape hard: this document drives a live exam.
    const cleanSections: BlueprintSection[] = [];
    for (const s of sections) {
      if (!["math", "english"].includes(s.key)) return res.status(400).json({ success: false, error: `Неизвестная секция: ${s.key}` });
      const minutes = Number(s.minutes);
      if (!(minutes >= 5 && minutes <= 180)) return res.status(400).json({ success: false, error: "Время секции: от 5 до 180 минут" });
      const counts: any = {};
      let total = 0;
      for (const k of ["1", "2", "3"]) {
        const n = Number(s.counts?.[k] ?? 0);
        if (!(Number.isInteger(n) && n >= 0 && n <= 60)) return res.status(400).json({ success: false, error: "Количество вопросов: целое от 0 до 60" });
        counts[k] = n; total += n;
      }
      if (total === 0) return res.status(400).json({ success: false, error: `Секция «${s.title || s.key}» пуста — хотя бы один вопрос` });
      cleanSections.push({
        key: s.key,
        title: String(s.title || (s.key === "math" ? "Математика" : "Английский язык")).slice(0, 60),
        minutes, counts, minTopics: Math.max(1, Math.min(10, Number(s.minTopics) || 1)),
      });
    }

    const cleanScale = (Array.isArray(scale) && scale.length ? scale : DEFAULT_BLUEPRINT(tenantId, grade).scale)
      .map((b: any) => ({ minPercent: Math.max(0, Math.min(100, Number(b.minPercent) || 0)), label: String(b.label || "").slice(0, 60) }))
      .sort((a: any, b: any) => b.minPercent - a.minPercent);

    const bp: Blueprint = { tenantId, grade: Number(grade), sections: cleanSections, scale: cleanScale };
    await db().collection("exam_blueprints").doc(bpId(tenantId, Number(grade))).set({
      ...bp,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: req.user?.email || req.user?.uid || "",
    });
    audit("PLACEMENT_BLUEPRINT_UPDATED", tenantId, { grade: Number(grade), actorEmail: req.user?.email || "" });
    return res.json({ success: true, blueprint: bp });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ── Variant assembly ───────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Picks `counts` questions per difficulty, trying to spread across at least
 * `minTopics` topics. If the bank is short, takes everything available and
 * reports the shortage rather than failing the student at the door.
 */
function assembleSection(pool: any[], section: BlueprintSection): { ids: string[]; shortage: number } {
  const chosen: any[] = [];
  let shortage = 0;
  for (const diff of ["1", "2", "3"] as const) {
    const want = section.counts[diff] || 0;
    if (!want) continue;
    const candidates = shuffle(pool.filter(q => String(q.difficulty) === diff && !chosen.includes(q)));
    // Topic spread first: one from each topic until minTopics covered.
    const byTopic = new Map<string, any[]>();
    candidates.forEach(q => {
      const t = q.topic || "—";
      if (!byTopic.has(t)) byTopic.set(t, []);
      byTopic.get(t)!.push(q);
    });
    const picked: any[] = [];
    for (const [, qs] of shuffle([...byTopic.entries()])) {
      if (picked.length >= want) break;
      picked.push(qs.shift());
    }
    for (const q of candidates) {
      if (picked.length >= want) break;
      if (!picked.includes(q)) picked.push(q);
    }
    shortage += Math.max(0, want - picked.length);
    chosen.push(...picked);
  }
  return { ids: shuffle(chosen).map(q => q.docId), shortage };
}

const sessionId = (tenantId: string, shortId: string) => `pl_${tenantId}_${shortId}`;

/** Question payload for the student: everything EXCEPT the answer. */
const publicQuestion = (q: any) => ({
  id: q.docId, subject: q.subject, topic: q.topic || "",
  difficulty: q.difficulty, text: q.text, options: q.options, points: q.points || 1,
});

async function sessionPayload(sess: any, questionsById: Map<string, any>) {
  const sections = sess.sections.map((s: any) => ({
    key: s.key, title: s.title, minutes: s.minutes,
    deadline: s.deadline || null, finished: Boolean(s.finished),
    questions: s.questionIds.map((id: string) => publicQuestion(questionsById.get(id))).filter((q: any) => q.text),
  }));
  return {
    sessionId: sess.id, shortId: sess.shortId, grade: sess.grade,
    status: sess.status, currentSection: sess.currentSection,
    sections, answers: sess.answers || {},
  };
}

async function loadQuestions(tenantId: string, ids: string[]): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  // Firestore getAll caps at manageable batches; chunk by 100.
  for (let i = 0; i < ids.length; i += 100) {
    const refs = ids.slice(i, i + 100).map(id => db().collection("exam_questions").doc(id));
    const snaps = await db().getAll(...refs);
    snaps.forEach(s => { if (s.exists) map.set(s.id, { ...s.data(), docId: s.id }); });
  }
  return map;
}

// POST /api/placement/start — вход ученика. Public: the student is anonymous.
router.post("/start", async (req: any, res: any) => {
  try {
    const { tenantId, grade, shortId, studentName, studentPhone, studentEmail, enteredPin } = req.body || {};
    const g = Number(grade);
    if (!tenantId || !g || !studentName) return res.status(400).json({ success: false, error: "Заполните имя и класс" });
    if (!(g >= 5 && g <= 11)) return res.status(400).json({ success: false, error: "Срез проводится для 5–11 классов" });
    if (!pinAccepted(enteredPin)) return res.status(403).json({ success: false, error: "Неверный PIN-код. Узнайте актуальный PIN у завуча." });

    const sid = String(shortId || Math.floor(100000 + Math.random() * 900000));
    const ref = db().collection("placement_sessions").doc(sessionId(tenantId, sid));
    const existing = await ref.get();

    // Rule 3: an existing session is RESUMED, never regenerated.
    if (existing.exists) {
      const sess: any = { ...existing.data(), id: existing.id };
      if (sess.status === "finished") {
        return res.status(409).json({ success: false, error: "Экзамен уже сдан. Пересдача — только по решению завуча." });
      }
      const qs = await loadQuestions(tenantId, sess.sections.flatMap((s: any) => s.questionIds));
      return res.json({ success: true, resumed: true, session: await sessionPayload(sess, qs) });
    }

    const bp = await loadBlueprint(tenantId, g);
    const bankSnap = await db().collection("exam_questions")
      .where("tenantId", "==", tenantId).where("active", "==", true).get();
    const pool = bankSnap.docs
      .map(d => ({ ...d.data(), docId: d.id }))
      .filter((q: any) => Array.isArray(q.grades) && q.grades.includes(g));

    const sections: any[] = [];
    const shortages: string[] = [];
    for (const s of bp.sections) {
      const subjectPool = pool.filter((q: any) => q.subject === s.key);
      const { ids, shortage } = assembleSection(subjectPool, s);
      if (shortage > 0) shortages.push(`${s.title}: не хватило ${shortage} вопр.`);
      if (ids.length === 0) {
        return res.status(503).json({ success: false, error: `В банке нет вопросов для секции «${s.title}» (${g} класс). Обратитесь к завучу.` });
      }
      sections.push({ key: s.key, title: s.title, minutes: s.minutes, questionIds: ids, deadline: null, finished: false });
    }
    // First section's clock starts now.
    sections[0].deadline = Date.now() + sections[0].minutes * 60000;

    const sess = {
      id: ref.id, tenantId, shortId: sid, grade: g,
      studentName: String(studentName).slice(0, 120),
      studentPhone: String(studentPhone || "").slice(0, 40),
      studentEmail: String(studentEmail || "").slice(0, 120),
      status: "active", currentSection: 0,
      sections, answers: {},
      blueprintSnapshot: bp, // score against the rules that applied at start
      startedAt: admin.firestore.Timestamp.now(),
    };
    await ref.set(sess);
    audit("PLACEMENT_STARTED", tenantId, {
      studentShortId: sid, studentName: sess.studentName, grade: g,
      detail: shortages.length ? `банк неполон: ${shortages.join("; ")}` : "",
    });

    const qs = await loadQuestions(tenantId, sections.flatMap(s => s.questionIds));
    return res.json({ success: true, resumed: false, session: await sessionPayload(sess, qs) });
  } catch (e: any) {
    console.error("[Placement] start error:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/placement/answer — ответы сохраняются по мере ввода.
router.post("/answer", async (req: any, res: any) => {
  try {
    const { tenantId, shortId, answers } = req.body || {};
    if (!tenantId || !shortId || typeof answers !== "object") return res.status(400).json({ success: false, error: "Bad request" });
    const ref = db().collection("placement_sessions").doc(sessionId(tenantId, String(shortId)));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "Сессия не найдена" });
    const sess: any = snap.data();
    if (sess.status !== "active") return res.status(409).json({ success: false, error: "Экзамен завершён" });

    const cur = sess.sections[sess.currentSection];
    // 45s grace beyond the deadline: a submit racing the clock must not lose work.
    if (cur.deadline && Date.now() > cur.deadline + 45000) {
      return res.status(409).json({ success: false, error: "Время секции вышло", expired: true });
    }
    const allowed = new Set(cur.questionIds);
    const merged: Record<string, string> = { ...(sess.answers || {}) };
    let accepted = 0;
    for (const [qid, val] of Object.entries(answers)) {
      if (!allowed.has(qid)) continue; // only the CURRENT section is writable
      merged[qid] = String(val).slice(0, 200);
      accepted++;
    }
    await ref.update({ answers: merged, lastAnswerAt: admin.firestore.Timestamp.now() });
    return res.json({ success: true, accepted });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/placement/finish-section — scores the current section server-side,
// opens the next one, and on the last produces the final result + recommendation.
router.post("/finish-section", async (req: any, res: any) => {
  try {
    const { tenantId, shortId } = req.body || {};
    if (!tenantId || !shortId) return res.status(400).json({ success: false, error: "Bad request" });
    const ref = db().collection("placement_sessions").doc(sessionId(tenantId, String(shortId)));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "Сессия не найдена" });
    const sess: any = { ...snap.data(), id: snap.id };
    if (sess.status !== "active") return res.status(409).json({ success: false, error: "Экзамен уже завершён" });

    const idx = sess.currentSection;
    const cur = sess.sections[idx];
    const qs = await loadQuestions(tenantId, cur.questionIds);

    let correct = 0, total = 0;
    const byTopic: Record<string, { correct: number; total: number }> = {};
    const byDifficulty: Record<string, { correct: number; total: number }> = {};
    for (const qid of cur.questionIds) {
      const q = qs.get(qid); if (!q) continue;
      total++;
      const t = q.topic || "—";
      byTopic[t] = byTopic[t] || { correct: 0, total: 0 }; byTopic[t].total++;
      const d = String(q.difficulty);
      byDifficulty[d] = byDifficulty[d] || { correct: 0, total: 0 }; byDifficulty[d].total++;
      if (foldAnswer(sess.answers?.[qid]) === foldAnswer(q.answer) && String(sess.answers?.[qid] ?? "") !== "") {
        correct++; byTopic[t].correct++; byDifficulty[d].correct++;
      }
    }
    cur.finished = true;
    cur.result = { correct, total, percent: total ? Math.round((correct / total) * 100) : 0, byTopic, byDifficulty };

    const isLast = idx >= sess.sections.length - 1;
    let final: any = null;
    if (!isLast) {
      sess.currentSection = idx + 1;
      sess.sections[idx + 1].deadline = Date.now() + sess.sections[idx + 1].minutes * 60000;
    } else {
      const allCorrect = sess.sections.reduce((a: number, s: any) => a + (s.result?.correct || 0), 0);
      const allTotal = sess.sections.reduce((a: number, s: any) => a + (s.result?.total || 0), 0);
      const percent = allTotal ? Math.round((allCorrect / allTotal) * 100) : 0;
      const scale = (sess.blueprintSnapshot?.scale || []).sort((a: any, b: any) => b.minPercent - a.minPercent);
      const band = scale.find((b: any) => percent >= b.minPercent);
      final = {
        correct: allCorrect, total: allTotal, percent,
        recommendation: band?.label || "—",
        sections: sess.sections.map((s: any) => ({ key: s.key, title: s.title, ...s.result })),
      };
      sess.status = "finished";
      sess.finishedAt = admin.firestore.Timestamp.now();
      sess.final = final;

      // Flat результаты для кабинета завуча: без текстов вопросов, читается списком.
      await db().collection("placement_results").doc(sess.id).set({
        tenantId, shortId: sess.shortId, grade: sess.grade,
        studentName: sess.studentName, studentPhone: sess.studentPhone, studentEmail: sess.studentEmail,
        ...final,
        approved: false, approvedBy: "", finalDecision: "",
        startedAt: sess.startedAt, finishedAt: sess.finishedAt,
      });
      audit("PLACEMENT_FINISHED", tenantId, {
        studentShortId: sess.shortId, studentName: sess.studentName, grade: sess.grade,
        scores: { percent, correct: allCorrect, total: allTotal }, detail: final.recommendation,
      });
    }

    await ref.set(sess);
    return res.json({
      success: true,
      sectionResult: { correct, total, percent: cur.result.percent },
      nextSection: isLast ? null : { index: sess.currentSection, deadline: sess.sections[sess.currentSection].deadline },
      final,
    });
  } catch (e: any) {
    console.error("[Placement] finish error:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/placement/results — список для кабинета завуча.
router.get("/results", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const tenantId = String(req.query.tenantId || "");
    if (!tenantId) return res.status(400).json({ success: false, error: "Нужен tenantId" });
    if (!(await canManagePlacement(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав на просмотр результатов среза" });
    }
    const snap = await db().collection("placement_results").where("tenantId", "==", tenantId).get();
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.finishedAt?.toMillis?.() || 0) - (a.finishedAt?.toMillis?.() || 0));
    return res.json({ success: true, results });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/placement/decide — завуч утверждает или меняет рекомендацию.
router.post("/decide", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const { tenantId, resultId, finalDecision } = req.body || {};
    if (!tenantId || !resultId) return res.status(400).json({ success: false, error: "Bad request" });
    if (!(await canManagePlacement(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }
    const ref = db().collection("placement_results").doc(String(resultId));
    const snap = await ref.get();
    if (!snap.exists || snap.data()!.tenantId !== tenantId) return res.status(404).json({ success: false, error: "Результат не найден" });
    await ref.update({
      approved: true,
      approvedBy: req.user?.email || req.user?.uid || "",
      finalDecision: String(finalDecision || snap.data()!.recommendation).slice(0, 80),
      approvedAt: admin.firestore.Timestamp.now(),
    });
    audit("PLACEMENT_DECISION", tenantId, {
      studentShortId: snap.data()!.shortId, actorEmail: req.user?.email || "",
      detail: String(finalDecision || "").slice(0, 80),
    });
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
