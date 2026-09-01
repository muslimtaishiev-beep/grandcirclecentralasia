import { Router } from "express";
import admin from "firebase-admin";
import { requireFirebaseAuth } from "./authRoutes.js";
import { analyseFile } from "../lib/placementParser.js";

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
function getHourlyPIN(hourOffset = 0, tenantId = ""): string {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() + hourOffset);
  // Salted by tenant: the entrance tests use one global hourly PIN, but a
  // placement PIN announced by one school's завуч must not open sessions in
  // another school's tenant. The завуч cabinet reads the current value from
  // GET /blueprint, so both sides always agree.
  let salt = 0;
  for (const ch of tenantId) salt = (salt * 31 + ch.charCodeAt(0)) % 100000;
  const seed = d.getUTCFullYear() * 1000000 + (d.getUTCMonth() + 1) * 10000 + d.getUTCDate() * 100 + d.getUTCHours() + salt;
  return Math.abs((seed * 1103515245 + 12345) % 9000 + 1000).toString();
}
function pinAccepted(entered: unknown, tenantId: string): boolean {
  const clean = String(entered ?? "")
    .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x06F0))
    .replace(/[０-９]/g, c => String(c.charCodeAt(0) - 0xFF10))
    .replace(/\D/g, "");
  if (!clean) return false;
  const TESTER_PIN = process.env.VITE_TESTER_PIN || process.env.TESTER_PIN;
  if (TESTER_PIN && String(entered) === TESTER_PIN) return true;
  return [-1, 0, 1].some(o => clean === getHourlyPIN(o, tenantId));
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
    return res.json({
      success: true, blueprint: bp, availability,
      // Current PIN for THIS tenant — the завуч announces it to the room.
      pin: getHourlyPIN(0, tenantId),
      pinMinutesLeft: 60 - new Date().getUTCMinutes(),
    });
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
  difficulty: q.difficulty, type: q.type || "multiple_choice",
  text: q.text, options: q.options || [], points: q.points || 1,
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
    // The tenant must exist before anything else: a mistyped or guessed id
    // must not mint sessions against an organisation that isn't there.
    const tenantDoc = await db().collection("tenants").doc(String(tenantId)).get();
    if (!tenantDoc.exists) return res.status(404).json({ success: false, error: "Организация не найдена" });
    if (!pinAccepted(enteredPin, String(tenantId))) return res.status(403).json({ success: false, error: "Неверный PIN-код. Узнайте актуальный PIN у завуча." });

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
      attempt: 1 + (await db().collection("placement_attempts")
        .where("shortId", "==", sid).where("tenantId", "==", tenantId).get()).size,
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
      const given = String(sess.answers?.[qid] ?? "");
      // Text-input answers are compared as numbers when both sides look
      // numeric ("0,5" and "0.5" and "0.50" are the same answer), otherwise
      // as folded text. Multiple choice compares the option letter.
      let isCorrect = false;
      if (given !== "") {
        if (q.type === "text_input") {
          const num = (v: string) => {
            const cleaned = v.replace(/\s/g, "").replace(",", ".");
            return /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : null;
          };
          const a = num(given), b = num(String(q.answer));
          isCorrect = (a !== null && b !== null) ? a === b : foldAnswer(given) === foldAnswer(q.answer);
        } else {
          isCorrect = foldAnswer(given) === foldAnswer(q.answer);
        }
      }
      if (isCorrect) {
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

// ── Импорт банка вопросов ─────────────────────────────────────────────────

// POST /api/placement/preview — разбор файла БЕЗ записи. The manager sees
// exactly what would be imported, which rows are broken and why, and decides.
// Nothing here touches the database: previewing a file is not importing it.
router.post("/preview", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const { tenantId, csv } = req.body || {};
    if (!tenantId || typeof csv !== "string") return res.status(400).json({ success: false, error: "Нужны tenantId и содержимое файла" });
    if (!(await canManagePlacement(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав на загрузку вопросов" });
    }
    if (csv.length > 4 * 1024 * 1024) return res.status(413).json({ success: false, error: "Файл больше 4 МБ — разделите на части" });

    const existing = new Set<string>();
    (await db().collection("exam_questions").where("tenantId", "==", tenantId).get())
      .forEach(d => existing.add(d.id));

    const report = analyseFile(csv, existing);
    return res.json({ success: true, ...report });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/placement/import — записывает то, что менеджер подтвердил.
// Re-analyses server-side rather than trusting the preview the browser sends
// back: a client could otherwise post questions that never passed validation.
router.post("/import", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const { tenantId, csv, includeWarnings } = req.body || {};
    if (!tenantId || typeof csv !== "string") return res.status(400).json({ success: false, error: "Нужны tenantId и содержимое файла" });
    if (!(await canManagePlacement(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав на загрузку вопросов" });
    }

    const existing = new Set<string>();
    (await db().collection("exam_questions").where("tenantId", "==", tenantId).get())
      .forEach(d => existing.add(d.id));
    const report = analyseFile(csv, existing);
    if (report.fatal.length) return res.status(400).json({ success: false, error: report.fatal.join(" ") });

    // Broken rows are never written — they would become questions no student
    // can answer correctly. Warnings are written only if explicitly accepted.
    const toWrite = report.questions.filter(q =>
      q.status === "ok" || (q.status === "warning" && includeWarnings));
    if (!toWrite.length) return res.status(400).json({ success: false, error: "Нечего импортировать — все строки с ошибками" });

    let batch = db().batch(), inBatch = 0, written = 0;
    for (const q of toWrite) {
      batch.set(db().collection("exam_questions").doc(q.id), {
        id: q.id, tenantId, subject: q.subject, grades: q.grades, topic: q.topic,
        difficulty: q.difficulty, type: q.type, text: q.text, options: q.options,
        answer: q.answer, points: 1, active: true,
        needsReview: q.status === "warning",
        importIssues: q.issues.slice(0, 5),
        importedAt: admin.firestore.Timestamp.now(),
        importedBy: req.user?.email || req.user?.uid || "",
      });
      if (++inBatch === 400) { await batch.commit(); written += inBatch; batch = db().batch(); inBatch = 0; }
    }
    if (inBatch) { await batch.commit(); written += inBatch; }

    audit("PLACEMENT_QUESTIONS_IMPORTED", tenantId, {
      actorEmail: req.user?.email || "",
      detail: `записано ${written}, пропущено с ошибками ${report.errors}${includeWarnings ? ", замечания приняты" : ""}`,
    });
    return res.json({ success: true, written, skipped: report.errors, needsReview: toWrite.filter(q => q.status === "warning").length });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/placement/allow-retake — завуч разрешает вторую попытку.
// A finished exam refuses a restart by design; without this a student whose
// connection died or who fell ill mid-exam is simply stuck, and nobody can
// help them. The previous attempt is archived rather than deleted: the school
// must be able to see that a retake happened and what the first result was.
router.post("/allow-retake", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const { tenantId, shortId, reason } = req.body || {};
    if (!tenantId || !shortId) return res.status(400).json({ success: false, error: "Нужны tenantId и shortId" });
    if (!(await canManagePlacement(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав на разрешение пересдачи" });
    }

    const sid = sessionId(tenantId, String(shortId));
    const sessRef = db().collection("placement_sessions").doc(sid);
    const sessSnap = await sessRef.get();
    if (!sessSnap.exists) return res.status(404).json({ success: false, error: "Сессия не найдена" });

    const sess: any = sessSnap.data();
    const attempt = Number(sess.attempt || 1);
    const actor = req.user?.email || req.user?.uid || "";

    // Archive the attempt before clearing it — a retake must never quietly
    // erase what the student did the first time.
    await db().collection("placement_attempts").doc(`${sid}_a${attempt}`).set({
      ...sess, archivedAt: admin.firestore.Timestamp.now(),
      archivedBy: actor, retakeReason: String(reason || "").slice(0, 300),
    });

    await sessRef.delete();
    // The result row is kept but marked superseded, so the cabinet shows the
    // history instead of a gap.
    const resRef = db().collection("placement_results").doc(sid);
    if ((await resRef.get()).exists) {
      await resRef.update({
        superseded: true, supersededAt: admin.firestore.Timestamp.now(),
        supersededBy: actor, retakeReason: String(reason || "").slice(0, 300),
      });
    }

    audit("PLACEMENT_RETAKE_ALLOWED", tenantId, {
      studentShortId: String(shortId), studentName: sess.studentName || "",
      grade: sess.grade || 0, actorEmail: actor,
      detail: `попытка ${attempt} заархивирована; причина: ${String(reason || "не указана").slice(0, 120)}`,
    });
    return res.json({ success: true, attempt: attempt + 1 });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/placement/questions — банк для кабинета (без правильных ответов
// в списке: их видно только при открытии конкретного вопроса на правку).
router.get("/questions", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const tenantId = String(req.query.tenantId || "");
    if (!(await canManagePlacement(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }
    const snap = await db().collection("exam_questions").where("tenantId", "==", tenantId).get();
    const questions = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => Number(b.needsReview) - Number(a.needsReview) || a.id.localeCompare(b.id));
    return res.json({ success: true, questions, total: questions.length,
      needsReview: questions.filter((q: any) => q.needsReview).length });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/placement/questions/:id — правка вопроса после импорта.
router.put("/questions/:id", requireFirebaseAuth, async (req: any, res: any) => {
  try {
    const { tenantId, text, options, answer, topic, difficulty, grades, type, active } = req.body || {};
    if (!(await canManagePlacement(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }
    const ref = db().collection("exam_questions").doc(String(req.params.id));
    const snap = await ref.get();
    if (!snap.exists || snap.data()!.tenantId !== tenantId) {
      return res.status(404).json({ success: false, error: "Вопрос не найден" });
    }

    const patch: Record<string, unknown> = { needsReview: false, importIssues: [] };
    if (typeof text === "string" && text.trim()) patch.text = text.trim();
    if (typeof topic === "string" && topic.trim()) patch.topic = topic.trim();
    if ([1, 2, 3].includes(Number(difficulty))) patch.difficulty = Number(difficulty);
    if (Array.isArray(grades) && grades.length) patch.grades = grades.map(Number).filter((g: number) => g >= 5 && g <= 11);
    if (["multiple_choice", "text_input"].includes(type)) patch.type = type;
    if (Array.isArray(options)) patch.options = options.map(String).slice(0, 6);
    if (typeof answer === "string" && answer.trim()) patch.answer = answer.trim();
    if (typeof active === "boolean") patch.active = active;

    // The answer must still name an existing option, or we have re-created the
    // exact defect the preview exists to catch.
    const finalType = (patch.type as string) || snap.data()!.type;
    const finalOptions = (patch.options as string[]) || snap.data()!.options || [];
    const finalAnswer = String(patch.answer ?? snap.data()!.answer ?? "");
    if (finalType === "multiple_choice") {
      const letters = ["А", "Б", "В", "Г", "Д", "Е"];
      const idx = letters.indexOf(finalAnswer.toUpperCase());
      if (idx === -1 || idx >= finalOptions.length) {
        return res.status(400).json({ success: false, error: `Правильный ответ «${finalAnswer}» не соответствует ни одному варианту` });
      }
    } else if (!finalAnswer) {
      return res.status(400).json({ success: false, error: "Для вопроса с вводом нужен правильный ответ" });
    }

    await ref.update({ ...patch, updatedAt: admin.firestore.Timestamp.now(), updatedBy: req.user?.email || "" });
    audit("PLACEMENT_QUESTION_EDITED", tenantId, { actorEmail: req.user?.email || "", detail: String(req.params.id) });
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
