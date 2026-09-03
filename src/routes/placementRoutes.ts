import { Router } from "express";
import admin from "firebase-admin";
import { requireFirebaseAuth } from "./authRoutes.js";
import { analyseFile } from "../lib/placementParser.js";
import { hasAnyPermission } from "../server/access.js";
import { checkTenantOpen, requireScreen } from "../server/tenantAccess.js";
import { resolveLegalProfile, publicLegal } from "../shared/legal.js";

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

/**
 * Machine marking for one answer. Text input is compared numerically when both
 * sides look numeric ("0,5", "0.5" and "0.50" are one answer); everything else
 * compares the folded option letter.
 */
function markOf(q: any, given: string): boolean {
  if (!given) return false;
  if (q.type === "text_input") {
    const num = (v: string) => {
      const cleaned = String(v).replace(/\s/g, "").replace(",", ".");
      return /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : null;
    };
    const a = num(given), b = num(String(q.answer));
    return (a !== null && b !== null) ? a === b : foldAnswer(given) === foldAnswer(q.answer);
  }
  return foldAnswer(given) === foldAnswer(q.answer);
}

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
  /**
   * Пороги школьных оценок, в процентах. Успеваемость и качество знаний —
   * показатели из школьной отчётности, и считать их можно только от границ,
   * которые школа признаёт своими: у одной «4» начинается с 65%, у другой с 70.
   * Поэтому пороги живут в настройках экзамена, а не в коде.
   */
  marks?: { pass: number; good: number; excellent: number };
  /**
   * Прокторинг на срезе. Выключен по умолчанию: он требует камеры у каждого
   * ученика, а срез пишут и те, кто пришёл с чужого телефона. Завуч включает
   * его сам, когда уверен в аудитории.
   *
   * Отказ от камеры экзамен НЕ прерывает — работа просто помечается как
   * несопровождённая, и завуч видит это в результатах.
   */
  proctoring?: {
    enabled: boolean;
    detectors?: {
      gazeAway?: boolean; faceCount?: boolean; handTracking?: boolean;
      audioAnalysis?: boolean; phoneDetection?: boolean;
    };
  };
}

const DEFAULT_PROCTORING = {
  enabled: false,
  detectors: {
    gazeAway: true, faceCount: true, handTracking: true,
    audioAnalysis: true, phoneDetection: true,
  },
};

/** Границы по умолчанию — привычные школьные, школа меняет их в кабинете. */
const DEFAULT_MARKS = { pass: 50, good: 65, excellent: 85 };

/** Оценка по проценту: 2 — не сдал, дальше 3/4/5. */
function markFor(percent: number, m = DEFAULT_MARKS): 2 | 3 | 4 | 5 {
  if (percent >= m.excellent) return 5;
  if (percent >= m.good) return 4;
  if (percent >= m.pass) return 3;
  return 2;
}

/**
 * Классы школы и их вместимость — основа автоматического распределения.
 *
 * Семиклассников две возрастные группы («младшие» и «старшие» по новой
 * системе): ученик сначала попадает в свою группу по возрасту, и только
 * внутри неё сортируется по баллу. Смешивать их нельзя — это разные
 * возрасты, а не разные уровни.
 *
 * Буквы идут по алфавиту от сильных к слабым: А — самый сильный класс.
 * Школа меняет структуру в кабинете; здесь только значения по умолчанию.
 */
export interface ClassGroup {
  /** Ключ для распределения: класс + необязательная возрастная группа. */
  key: string;
  grade: number;
  /** Подпись группы, если параллелей несколько («младшие» / «старшие»).
   *  Пустая строка означает «группы нет» — undefined Firestore не принимает. */
  stream?: string;
  /** Сколько классов в этой группе: 2 → А и Б. */
  count: number;
  /** С какой буквы начинается группа: 0 → А, 2 → В. Нужно, когда одну
   *  параллель делят несколько возрастных групп. */
  firstLetter?: number;
}

const DEFAULT_CLASS_STRUCTURE: ClassGroup[] = [
  { key: "5", grade: 5, stream: "", count: 1, firstLetter: 0 },
  { key: "6", grade: 6, stream: "", count: 1, firstLetter: 0 },
  // Две возрастные группы седьмых делят один алфавит: младшие получают
  // 7А-7Б, старшие продолжают с 7В. Иначе в школе оказалось бы два разных
  // «7А», и списки, журналы и сертификаты перестали бы различать их.
  { key: "7-junior", grade: 7, stream: "младшие", count: 2, firstLetter: 0 },
  { key: "7-senior", grade: 7, stream: "старшие", count: 2, firstLetter: 2 },
  { key: "8", grade: 8, stream: "", count: 3, firstLetter: 0 },
  { key: "9", grade: 9, stream: "", count: 3, firstLetter: 0 },
  { key: "10", grade: 10, stream: "", count: 5, firstLetter: 0 },
  { key: "11", grade: 11, stream: "", count: 2, firstLetter: 0 },
];

const CLASS_LETTERS = ["А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "К"];

async function loadClassStructure(tenantId: string): Promise<ClassGroup[]> {
  const snap = await db().collection("exam_blueprints").doc(`classes_${tenantId}`).get();
  const saved = snap.exists ? snap.data()?.groups : null;
  return Array.isArray(saved) && saved.length ? saved : DEFAULT_CLASS_STRUCTURE;
}

/**
 * Предложение системы: разложить учеников по буквам внутри их группы.
 *
 * Rank order, strongest into А — but this is a PROPOSAL, never a decision.
 * The школа confirms it by publishing; until then every assignment can be
 * overridden by hand, and a class with no places left simply overflows into
 * the last letter rather than silently dropping anyone.
 */
export function proposeClassAssignment(
  students: { id: string; grade: number; stream?: string; percent: number }[],
  structure: ClassGroup[],
): Record<string, string> {
  const out: Record<string, string> = {};

  for (const group of structure) {
    if (group.count < 1) continue;
    const inGroup = students
      .filter(s => Number(s.grade) === group.grade &&
        (!group.stream || String(s.stream || "") === String(group.stream)))
      .sort((a, b) => b.percent - a.percent);
    if (!inGroup.length) continue;

    // Равные по размеру классы: остаток распределяется по сильнейшим буквам,
    // чтобы «лишний» ученик не создавал класс из одного человека.
    const per = Math.ceil(inGroup.length / group.count);
    const offset = group.firstLetter || 0;
    inGroup.forEach((st, i) => {
      const letterIdx = offset + Math.min(Math.floor(i / per), group.count - 1);
      out[st.id] = `${group.grade}${CLASS_LETTERS[letterIdx] || "?"}`;
    });
  }
  return out;
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
  marks: { ...DEFAULT_MARKS },
  proctoring: { enabled: false, detectors: { ...DEFAULT_PROCTORING.detectors } },
});

const bpId = (tenantId: string, grade: number) => `bp_${tenantId}_${grade}`;

async function loadBlueprint(tenantId: string, grade: number): Promise<Blueprint> {
  const snap = await db().collection("exam_blueprints").doc(bpId(tenantId, grade)).get();
  return snap.exists ? (snap.data() as Blueprint) : DEFAULT_BLUEPRINT(tenantId, grade);
}

/**
 * Кто управляет срезом — решают ПРАВА: «Вступительный срез», управление или
 * проверка тестов, полный доступ. Раньше проверялась подстрока «завуч» в
 * названии роли — кабинет открывался по слову, а не по выданному доступу.
 */
async function canManagePlacement(user: any, tenantId: string): Promise<boolean> {
  if (user?.isSuperadmin) return true;
  return hasAnyPermission(db(), user, tenantId, ["placement:manage", "tests:manage", "tests:review"]);
}

// GET blueprint + how many questions the bank can actually supply, so the
// cabinet can warn when someone asks for more questions than exist.
router.get("/blueprint", requireFirebaseAuth, requireScreen("placement"), async (req: any, res: any) => {
  try {
    const tenantId = String(req.query.tenantId || "");
    const grade = Number(req.query.grade);
    if (!tenantId || !grade) return res.status(400).json({ success: false, error: "Нужны tenantId и grade" });
    if (!(await canManagePlacement(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав на управление срезом" });
    }

    const bp = await loadBlueprint(tenantId, grade);
    const bank = await db().collection("exam_questions")
      .where("tenantId", "==", tenantId)
      .where("active", "==", true)
      .where("grades", "array-contains", grade)
      .get();
    const availability: Record<string, Record<string, number>> = { math: { "1": 0, "2": 0, "3": 0 }, english: { "1": 0, "2": 0, "3": 0 } };
    bank.forEach(d => {
      const q = d.data();
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
router.put("/blueprint", requireFirebaseAuth, requireScreen("placement"), async (req: any, res: any) => {
  try {
    const { tenantId, grade, sections, scale, marks, proctoring } = req.body || {};
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

    // Пороги оценок. Границы обязаны идти по возрастанию: «4» не может
    // начинаться ниже тройки, иначе успеваемость и качество разойдутся с
    // арифметикой и завуч получит качество выше успеваемости.
    const num = (v: any, dflt: number) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= 100 ? n : dflt;
    };
    const cleanMarks = {
      pass: num(marks?.pass, DEFAULT_MARKS.pass),
      good: num(marks?.good, DEFAULT_MARKS.good),
      excellent: num(marks?.excellent, DEFAULT_MARKS.excellent),
    };
    if (!(cleanMarks.pass <= cleanMarks.good && cleanMarks.good <= cleanMarks.excellent)) {
      return res.status(400).json({
        success: false,
        error: "Пороги оценок должны возрастать: проходной ≤ «4» ≤ «5»",
      });
    }

    const bool = (v: any, dflt: boolean) => (typeof v === "boolean" ? v : dflt);
    const cleanProctoring = {
      enabled: bool(proctoring?.enabled, false),
      detectors: {
        gazeAway: bool(proctoring?.detectors?.gazeAway, true),
        faceCount: bool(proctoring?.detectors?.faceCount, true),
        handTracking: bool(proctoring?.detectors?.handTracking, true),
        audioAnalysis: bool(proctoring?.detectors?.audioAnalysis, true),
        phoneDetection: bool(proctoring?.detectors?.phoneDetection, true),
      },
    };

    const bp: Blueprint = {
      tenantId, grade: Number(grade), sections: cleanSections,
      scale: cleanScale, marks: cleanMarks, proctoring: cleanProctoring,
    };
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

/**
 * SAT-эквивалент по математике, шкала 200–800.
 *
 * Weighted by difficulty rather than a flat percentage, because that is what
 * the real SAT does and what the school asked for: a student who answers the
 * hard items is not equivalent to one who answers the same COUNT of easy ones.
 * Weights 1 / 2 / 3 mirror the difficulty labels the bank already uses.
 *
 * The floor is 200 (the real SAT never returns less for a completed section)
 * and the result is rounded to 10, as College Board reports it.
 */
const DIFFICULTY_WEIGHT: Record<string, number> = { "1": 1, "2": 2, "3": 3 };

function satEquivalent(byDifficulty: Record<string, { correct: number; total: number }> | undefined): number | null {
  if (!byDifficulty) return null;
  let earned = 0, possible = 0;
  for (const [d, v] of Object.entries(byDifficulty)) {
    const w = DIFFICULTY_WEIGHT[d] ?? 1;
    earned += (v.correct || 0) * w;
    possible += (v.total || 0) * w;
  }
  if (!possible) return null;
  const raw = 200 + (earned / possible) * 600;
  return Math.round(raw / 10) * 10;
}

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

  // Один и тот же вопрос не должен встретиться дважды даже под разными id.
  // Банк собирают люди и генераторы, и дубликаты в нём — вопрос времени;
  // студент, увидевший задание повторно, справедливо решит, что экзамен
  // сломан. Сравниваем по нормализованному тексту.
  const seenText = new Set<string>();
  const textKey = (q: any) => String(q.text || "").trim().toLowerCase().replace(/\s+/g, " ");

  for (const diff of ["1", "2", "3"] as const) {
    const want = section.counts[diff] || 0;
    if (!want) continue;
    const candidates = shuffle(pool.filter(q =>
      String(q.difficulty) === diff && !chosen.includes(q) && !seenText.has(textKey(q))));
    // Topic spread first: one from each topic until minTopics covered.
    const byTopic = new Map<string, any[]>();
    candidates.forEach(q => {
      const t = q.topic || "—";
      if (!byTopic.has(t)) byTopic.set(t, []);
      byTopic.get(t)!.push(q);
    });
    const picked: any[] = [];
    const take = (q: any) => {
      if (!q || seenText.has(textKey(q))) return false;
      seenText.add(textKey(q));
      picked.push(q);
      return true;
    };
    for (const [, qs] of shuffle([...byTopic.entries()])) {
      if (picked.length >= want) break;
      // Берём первый непросмотренный вопрос темы: shift() может отдать дубль,
      // и тогда тема должна уступить место следующей, а не потерять слот.
      while (qs.length && picked.length < want) {
        if (take(qs.shift())) break;
      }
    }
    for (const q of candidates) {
      if (picked.length >= want) break;
      if (!picked.includes(q)) take(q);
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
    // Настройка прокторинга едет вместе с сессией: ученик анонимен и прочитать
    // её из Firestore не может. Берём из снимка правил, сделанного на старте,
    // — если завуч включит прокторинг посреди экзамена, у тех, кто уже пишет,
    // камера внезапно не запросится.
    proctoring: sess.blueprintSnapshot?.proctoring || { enabled: false },
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
    const gate = await checkTenantOpen(tenantId, "placement");
    if (!gate.ok) return res.status(gate.status).json({ success: false, error: gate.error });
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

    // Фильтруем по классу в ЗАПРОСЕ, а не после него. Читая весь банк и
    // отбрасывая лишнее в памяти, мы платили 232 чтения за каждый старт —
    // при потоке в 200 человек это 46 000 чтений на ровном месте, и первый
    // же экзаменационный день упирался в дневную квоту Firestore.
    const bankSnap = await db().collection("exam_questions")
      .where("tenantId", "==", tenantId)
      .where("active", "==", true)
      .where("grades", "array-contains", g)
      .get();
    const pool = bankSnap.docs.map(d => ({ ...d.data(), docId: d.id }));

    const sections: any[] = [];
    const shortages: string[] = [];
    for (const s of bp.sections) {
      const subjectPool = pool.filter((q: any) => q.subject === s.key);
      const { ids, shortage } = assembleSection(subjectPool, s);
      if (shortage > 0) shortages.push(`${s.title}: не хватило ${shortage} вопр.`);
      if (ids.length === 0) {
        // Банк пуст или не покрывает этот класс. Ученик в этом не виноват и
        // ничего сделать не может, поэтому не показываем ему внутреннюю
        // причину — только что экзамен сейчас недоступен.
        console.error(`[placement] пустая секция «${s.title}» для ${g} класса, тенант ${tenantId}`);
        return res.status(503).json({
          success: false, unavailable: true,
          error: "К сожалению, экзамен сейчас недоступен. Обратитесь к организатору.",
        });
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

    // Фото сделали до старта — переносим в сессию и убираем временную запись.
    const photoRef = db().collection("placement_photos").doc(ref.id);
    const photoSnap = await photoRef.get();
    if (photoSnap.exists) {
      (sess as any).photo = photoSnap.data()!.photo;
      (sess as any).photoTakenAt = photoSnap.data()!.takenAt;
      photoRef.delete().catch(() => {});
    }

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

// POST /api/placement/check-pin — проверка кода до шага фотографии.
// Без неё ученик с неверным PIN фотографировался бы впустую и узнавал об
// отказе только после съёмки. Ответ намеренно скупой — ни кода, ни подсказок.
router.post("/check-pin", async (req: any, res: any) => {
  try {
    const { tenantId, enteredPin, grade } = req.body || {};
    if (!tenantId) return res.status(400).json({ success: false, error: "Bad request" });
    const gate = await checkTenantOpen(tenantId, "placement");
    if (!gate.ok) return res.status(gate.status).json({ success: false, error: gate.error });
    if (!pinAccepted(enteredPin, String(tenantId))) {
      return res.status(403).json({ success: false, error: "Неверный PIN-код. Узнайте актуальный PIN у завуча." });
    }

    // Проверяем банк ЗДЕСЬ, до анкеты и фотографии. Ученик, который заполнил
    // все поля и отснялся, чтобы упереться в «экзамена нет», уйдёт злым — а
    // причина видна ещё на входе. Один count() стоит одно чтение.
    const g = Number(grade);
    if (g >= 5 && g <= 11) {
      const bank = await db().collection("exam_questions")
        .where("tenantId", "==", String(tenantId))
        .where("active", "==", true)
        .where("grades", "array-contains", g)
        .count().get();
      if (bank.data().count === 0) {
        console.error(`[placement] пустой банк для ${g} класса, тенант ${tenantId}`);
        return res.status(503).json({
          success: false, unavailable: true,
          error: "К сожалению, экзамен сейчас недоступен. Обратитесь к организатору.",
        });
      }
    }

    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/placement/photo — фото ученика для сертификата.
//
// Снимается ОДИН раз перед стартом экзамена, по просьбе посмотреть в камеру.
// К прокторингу отношения не имеет: движок в этот момент не запущен, кадр
// никуда не анализируется и нарушением стать не может. Хранится прямо в
// сессии как небольшой JPEG — на сертификате это марка размером с паспортное
// фото, а отдельное хранилище ради 30 КБ заводить незачем.
router.post("/photo", async (req: any, res: any) => {
  try {
    const { tenantId, shortId, photo } = req.body || {};
    if (!tenantId || !shortId || typeof photo !== "string") {
      return res.status(400).json({ success: false, error: "Bad request" });
    }
    if (!photo.startsWith("data:image/")) {
      return res.status(400).json({ success: false, error: "Ожидается изображение" });
    }
    // 400 КБ хватает на 640×480 JPEG; больше — это не фото на документ.
    if (photo.length > 400 * 1024) {
      return res.status(413).json({ success: false, error: "Снимок слишком большой" });
    }

    const ref = db().collection("placement_sessions").doc(sessionId(String(tenantId), String(shortId)));
    const snap = await ref.get();
    if (!snap.exists) {
      // Фото делается до старта: держим его отдельно, пока сессии нет.
      await db().collection("placement_photos").doc(sessionId(String(tenantId), String(shortId))).set({
        tenantId, shortId: String(shortId), photo, takenAt: admin.firestore.Timestamp.now(),
      });
      return res.json({ success: true, stored: "pending" });
    }
    await ref.update({ photo, photoTakenAt: admin.firestore.Timestamp.now() });
    return res.json({ success: true, stored: "session" });
  } catch (e: any) {
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
      const isCorrect = markOf(q, given);
      if (isCorrect) {
        correct++; byTopic[t].correct++; byDifficulty[d].correct++;
      }
    }
    // Per-question record for the teacher's review: what was asked, what the
    // student clicked, what the key says. Without it the завуч sees a number
    // and has nothing to check the draft against.
    const items = cur.questionIds.map((qid: string) => {
      const q = qs.get(qid);
      if (!q) return null;
      const given = String(sess.answers?.[qid] ?? "");
      const auto = markOf(q, given);
      return {
        id: qid, topic: q.topic || "", difficulty: q.difficulty,
        type: q.type || "multiple_choice",
        text: q.text, options: q.options || [],
        given, answer: q.answer,
        autoCorrect: auto,          // как посчитала машина
        mark: auto ? 1 : 0,         // текущий балл: правится учителем
        overridden: false, overrideNote: "",
      };
    }).filter(Boolean);

    cur.finished = true;
    cur.result = { correct, total, percent: total ? Math.round((correct / total) * 100) : 0, byTopic, byDifficulty, items };

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
      const mathSection = sess.sections.find((s: any) => s.key === "math");
      final = {
        correct: allCorrect, total: allTotal, percent,
        recommendation: band?.label || "—",
        satMath: satEquivalent(mathSection?.result?.byDifficulty),
        sections: sess.sections.map((s: any) => ({
          key: s.key, title: s.title, ...s.result,
          sat: s.key === "math" ? satEquivalent(s.result?.byDifficulty) : null,
        })),
      };
      sess.status = "finished";
      sess.finishedAt = admin.firestore.Timestamp.now();
      sess.final = final;

      // Flat результаты для кабинета завуча: без текстов вопросов, читается списком.
      await db().collection("placement_results").doc(sess.id).set({
        tenantId, shortId: sess.shortId, grade: sess.grade,
        studentName: sess.studentName, studentPhone: sess.studentPhone, studentEmail: sess.studentEmail,
        ...final,
        photo: sess.photo || null,
        approved: false, approvedBy: "", finalDecision: "",
        scaleSnapshot: scale,
        // Результаты не видны ученику, пока завуч не опубликует поток.
        published: false, annulled: false,
        // Проверка учителем: работа ждёт, пока её не откроют с черновиком.
        reviewStatus: "pending", reviewedBy: "", reviewedAt: null,
        overrides: 0,
        // Ручная правка балла завучем после проверки черновиков.
        adjustedCorrect: null, adjustedTotal: null, adjustmentNote: "",
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
      // Ученику НЕ отдаём ни баллы, ни разбор: работу ещё сверяют с
      // черновиком, а в items лежат правильные ответы — открыв инструменты
      // разработчика, ученик увидел бы ключи ко всему варианту.
      sectionResult: { done: true },
      nextSection: isLast ? null : { index: sess.currentSection, deadline: sess.sections[sess.currentSection].deadline },
      final: final ? { finished: true } : null,
    });
  } catch (e: any) {
    console.error("[Placement] finish error:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/placement/results — список для кабинета завуча.
router.get("/results", requireFirebaseAuth, requireScreen("placement"), async (req: any, res: any) => {
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

/**
 * Необратимые операции очистки.
 *
 * Отдельная проверка прав, строже обычной: удалять работы и вопросы может
 * только владелец организации или суперадмин. Завуч, который может проверять
 * работы и менять настройки, стереть поток целиком не должен — цена ошибки
 * здесь не «поправим», а «эти дети сдавали зря».
 */
async function canPurge(user: any, tenantId: string): Promise<boolean> {
  if (user?.isSuperadmin) return true;
  if (Array.isArray(user?.tenantAdminIds) && user.tenantAdminIds.includes(tenantId)) return true;
  const ms = await db().collection("memberships")
    .where("userId", "==", user?.uid || "")
    .where("tenantId", "==", tenantId)
    .where("status", "==", "active")
    .get();
  return ms.docs.some(d => /owner|admin|директор/i.test(String(d.data().role || "")));
}

/** Удаляет документы пачками: Firestore не принимает батч больше 500. */
async function deleteAll(query: FirebaseFirestore.Query): Promise<number> {
  let total = 0;
  while (true) {
    const snap = await query.limit(400).get();
    if (snap.empty) break;
    const batch = db().batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < 400) break;
  }
  return total;
}

/**
 * POST /api/placement/purge — очистка результатов или банка вопросов.
 *
 * Требует точного слова-подтверждения в теле запроса: случайный запрос,
 * промах по кнопке или повтор из истории браузера ничего не удалят.
 *
 * Что удаляется, зависит от scope:
 *   results   — работы, сессии, попытки, фото, снимки прокторинга
 *   bank      — вопросы (настройки экзамена и классы остаются)
 *
 * Настройки экзамена, структура классов и пороги оценок не трогаются
 * никогда: их восстанавливать дольше всего, а к «данным потока» они
 * не относятся.
 */
router.post("/purge", requireFirebaseAuth, requireScreen("placement"), async (req: any, res: any) => {
  try {
    const { tenantId, scope, confirm, grade } = req.body || {};
    if (!tenantId) return res.status(400).json({ success: false, error: "Нужен tenantId" });
    if (!(await canPurge(req.user, tenantId))) {
      return res.status(403).json({
        success: false,
        error: "Очистка доступна только администратору организации.",
      });
    }
    if (!["results", "bank"].includes(String(scope))) {
      return res.status(400).json({ success: false, error: "Неизвестная область очистки" });
    }
    // Слово набирается руками — защита от нажатия не туда.
    if (String(confirm).trim().toUpperCase() !== "УДАЛИТЬ") {
      return res.status(400).json({
        success: false,
        error: "Для подтверждения введите слово УДАЛИТЬ",
      });
    }

    const g = grade ? Number(grade) : null;
    const counts: Record<string, number> = {};

    if (scope === "results") {
      const scoped = (col: string) => {
        let q: FirebaseFirestore.Query = db().collection(col).where("tenantId", "==", tenantId);
        if (g) q = q.where("grade", "==", g);
        return q;
      };
      counts.results = await deleteAll(scoped("placement_results"));
      counts.sessions = await deleteAll(scoped("placement_sessions"));
      // Попытки и фото класса не знают — при точечной чистке их не трогаем,
      // иначе удалим чужое.
      if (!g) {
        counts.attempts = await deleteAll(db().collection("placement_attempts").where("tenantId", "==", tenantId));
        counts.photos = await deleteAll(db().collection("placement_photos").where("tenantId", "==", tenantId));
        counts.evidence = await deleteAll(
          db().collection("proctoring_evidence")
            .where("tenantId", "==", tenantId).where("source", "==", "placement"));
      }
    } else {
      let q: FirebaseFirestore.Query = db().collection("exam_questions").where("tenantId", "==", tenantId);
      if (g) q = q.where("grades", "array-contains", g);
      counts.questions = await deleteAll(q);
    }

    audit("PLACEMENT_PURGE", tenantId, {
      actorEmail: req.user?.email || "", scope: String(scope),
      grade: g || "все", counts: JSON.stringify(counts),
    });
    return res.json({ success: true, scope, grade: g, counts });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * DELETE /api/placement/result/:resultId — удалить одну работу.
 *
 * Точечное удаление нужно чаще массового: ученик записался дважды, сдал
 * тестовую работу, попал не в тот класс.
 */
router.post("/delete-result", requireFirebaseAuth, requireScreen("placement"), async (req: any, res: any) => {
  try {
    const { tenantId, resultId } = req.body || {};
    if (!tenantId || !resultId) return res.status(400).json({ success: false, error: "Bad request" });
    if (!(await canPurge(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Удаление доступно только администратору организации." });
    }
    const ref = db().collection("placement_results").doc(String(resultId));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "Работа не найдена" });
    const data = snap.data()!;
    if (data.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: "Работа другой организации" });
    }

    const batch = db().batch();
    batch.delete(ref);
    batch.delete(db().collection("placement_sessions").doc(String(resultId)));
    await batch.commit();

    audit("PLACEMENT_RESULT_DELETED", tenantId, {
      actorEmail: req.user?.email || "",
      studentName: data.studentName || "", shortId: data.shortId || "",
    });
    return res.json({ success: true, studentName: data.studentName || "" });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/placement/proctoring — отчёт прокторинга по сданной работе.
 *
 * Публичный, как и остальной путь ученика: он анонимен. Пишем только в свою
 * же сессию по shortId, и только один раз — повторные отчёты игнорируем,
 * иначе кто угодно перепишет чужой протокол, узнав номер работы.
 *
 * Нарушение прокторинга НЕ влияет на балл: оно ничего не отнимает
 * автоматически. Это материал для завуча, а решение принимает человек.
 */
router.post("/proctoring", async (req: any, res: any) => {
  try {
    const { tenantId, shortId, unavailable, honestyIndex, violations, snapshots, startedAt, endedAt } = req.body || {};
    if (!tenantId || !shortId) return res.status(400).json({ success: false, error: "Bad request" });

    const ref = db().collection("placement_results").doc(sessionId(String(tenantId), String(shortId)));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: "Работа не найдена" });
    // Отчёт пишется один раз: перезапись открыла бы дорогу к подмене протокола.
    if (snap.data()!.proctoring) return res.json({ success: true, alreadyReported: true });

    const list = (Array.isArray(violations) ? violations : []).slice(0, 300).map((v: any) => ({
      type: String(v.type || "").slice(0, 40),
      severity: String(v.severity || "").slice(0, 20),
      description: String(v.description || "").slice(0, 200),
      timestamp: Number(v.timestamp) || 0,
    }));

    await ref.update({
      proctoring: {
        unavailable: Boolean(unavailable),
        honestyIndex: Number.isFinite(Number(honestyIndex)) ? Number(honestyIndex) : null,
        violations: list,
        violationCount: list.length,
        highSeverity: list.filter(v => v.severity === "high").length,
        startedAt: Number(startedAt) || null,
        endedAt: Number(endedAt) || null,
        reportedAt: admin.firestore.Timestamp.now(),
      },
    });

    // Снимки нарушений — отдельными документами: в работе они раздули бы
    // каждый её чтение до мегабайтов, а смотрят их редко и по одному.
    const shots = (Array.isArray(snapshots) ? snapshots : []).slice(0, 40);
    if (shots.length) {
      let batch = db().batch();
      shots.forEach((sh: any, i: number) => {
        batch.set(db().collection("proctoring_evidence").doc(`pl_${shortId}_${i}`), {
          tenantId, shortId, source: "placement",
          type: String(sh.type || "").slice(0, 40),
          timestamp: Number(sh.timestamp) || 0,
          image: String(sh.image || "").slice(0, 400000),
          createdAt: admin.firestore.Timestamp.now(),
        });
      });
      await batch.commit();
    }

    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /api/placement/analytics — аналитика по потоку для завуча.
 *
 * Считается на сервере целиком. Кабинет мог бы посчитать это сам из уже
 * загруженных результатов, но каждая работа тянет за собой полный список
 * заданий с текстами и вариантами: на потоке в 300 человек это мегабайты в
 * браузере ради нескольких процентов. Здесь наружу уходят только агрегаты.
 *
 * Важно: правильные ответы НЕ покидают сервер даже здесь. В позадачном
 * анализе видно, какой вариант выбирали ученики и сколько раз, но пометка
 * «верный» проставлена уже посчитанной — восстановить по ней ключ ко всему
 * банку нельзя, потому что вопросы у каждого свои.
 */
router.get("/analytics", requireFirebaseAuth, requireScreen("placement"), async (req: any, res: any) => {
  try {
    const tenantId = String(req.query.tenantId || "");
    if (!tenantId) return res.status(400).json({ success: false, error: "Нужен tenantId" });
    if (!(await canManagePlacement(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав на просмотр аналитики" });
    }
    const gradeFilter = req.query.grade ? Number(req.query.grade) : null;

    const snap = await db().collection("placement_results").where("tenantId", "==", tenantId).get();
    let rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
      // Аннулированные и пересданные работы в статистику не входят: это не
      // результаты, а следы. Иначе один пересдавший портит средний балл дважды.
      .filter(r => !r.annulled && !r.superseded);
    if (gradeFilter) rows = rows.filter(r => Number(r.grade) === gradeFilter);

    // Пороги берём из настроек того класса, который смотрим; при разборе
    // всех классов сразу — из общих значений, иначе оценки окажутся
    // несопоставимыми между параллелями.
    const bp = gradeFilter ? await loadBlueprint(tenantId, gradeFilter) : null;
    const marks = bp?.marks || DEFAULT_MARKS;

    const pct = (r: any) => Number(r.adjustedPercent ?? r.percent ?? 0);
    const score = (r: any) => Number(r.adjustedCorrect ?? r.correct ?? 0);

    const total = rows.length;
    const empty = {
      success: true, total: 0, marks,
      summary: null, byGrade: [], byClass: [], distribution: [],
      topics: [], thinTopics: [], difficulty: [], questions: [], risk: [], top: [],
      minSamples: { topic: 5, question: 3 },
    };
    if (!total) return res.json(empty);

    // ── Основные показатели ────────────────────────────────────────────────
    const marksOf = rows.map(r => markFor(pct(r), marks));
    const passed = marksOf.filter(m => m >= 3).length;
    const quality = marksOf.filter(m => m >= 4).length;
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
    const r1 = (n: number) => Math.round(n * 10) / 10;

    const percents = rows.map(pct);
    const sorted = [...percents].sort((a, b) => a - b);
    const median = sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

    const summary = {
      total,
      performance: Math.round((passed / total) * 100),   // успеваемость
      quality: Math.round((quality / total) * 100),      // качество знаний
      avgPercent: r1(avg(percents)),
      avgScore: r1(avg(rows.map(score))),
      medianPercent: r1(median),
      avgSat: (() => {
        const sats = rows.map(r => Number(r.satMath)).filter(n => Number.isFinite(n) && n > 0);
        return sats.length ? Math.round(avg(sats)) : null;
      })(),
      reviewed: rows.filter(r => r.reviewStatus === "reviewed").length,
      published: rows.filter(r => r.published).length,
    };

    // Распределение оценок — основа для столбчатой диаграммы.
    const distribution = [5, 4, 3, 2].map(m => ({
      mark: m,
      count: marksOf.filter(x => x === m).length,
      percent: Math.round((marksOf.filter(x => x === m).length / total) * 100),
    }));

    // ── Разрезы: по параллелям и по назначенным классам ────────────────────
    const groupBy = (key: (r: any) => string) => {
      const map = new Map<string, any[]>();
      for (const r of rows) {
        const k = key(r);
        if (!k) continue;
        (map.get(k) || map.set(k, []).get(k)!).push(r);
      }
      return [...map.entries()].map(([name, items]) => {
        const ms = items.map(r => markFor(pct(r), marks));
        return {
          name, total: items.length,
          performance: Math.round((ms.filter(m => m >= 3).length / items.length) * 100),
          quality: Math.round((ms.filter(m => m >= 4).length / items.length) * 100),
          avgPercent: r1(avg(items.map(pct))),
          avgScore: r1(avg(items.map(score))),
        };
      });
    };
    const byGrade = groupBy(r => (r.grade ? `${r.grade} класс` : ""))
      .sort((a, b) => parseInt(a.name) - parseInt(b.name));
    const byClass = groupBy(r => r.assignedClass || "")
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));

    // ── Анализ по элементам содержания ─────────────────────────────────────
    // Собираем все задания всех работ: по темам, по сложности и позадачно.
    const topicAcc = new Map<string, { correct: number; total: number; subject: string }>();
    const diffAcc = new Map<number, { correct: number; total: number }>();
    const qAcc = new Map<string, any>();

    for (const r of rows) {
      for (const sec of r.sections || []) {
        for (const it of sec.items || []) {
          const mark = Number(it.mark ?? (it.autoCorrect ? 1 : 0));

          const tKey = `${sec.title}|${it.topic || "Без темы"}`;
          const t = topicAcc.get(tKey) || { correct: 0, total: 0, subject: sec.title };
          t.correct += mark; t.total += 1; topicAcc.set(tKey, t);

          const d = diffAcc.get(Number(it.difficulty) || 0) || { correct: 0, total: 0 };
          d.correct += mark; d.total += 1; diffAcc.set(Number(it.difficulty) || 0, d);

          const q = qAcc.get(it.id) || {
            id: it.id, text: it.text, topic: it.topic || "Без темы",
            difficulty: Number(it.difficulty) || 0, subject: sec.title,
            correct: 0, total: 0,
            // Что именно выбирали — для разбора типичных ошибок.
            answers: {} as Record<string, { count: number; correct: boolean }>,
          };
          q.correct += mark; q.total += 1;
          const given = String(it.given ?? "").trim() || "—";
          const a = q.answers[given] || { count: 0, correct: false };
          a.count += 1;
          // Верным считаем ровно то, что уже зачтено проверкой.
          if (mark >= 1) a.correct = true;
          q.answers[given] = a;
          qAcc.set(it.id, q);
        }
      }
    }

    const withRate = (o: any) => ({ ...o, rate: o.total ? Math.round((o.correct / o.total) * 100) : 0 });

    // Темы. Тема, встретившаяся один-два раза на весь поток, статистикой не
    // является: «0% усвоения» по одному ученику — это не проблемная тема, а
    // один неудачный ответ. Такие уносим в отдельный список, чтобы завуч видел
    // их отдельно и не принимал по ним решений как по достоверным.
    const TOPIC_MIN = 5;
    const allTopics = [...topicAcc.entries()]
      .map(([k, v]) => withRate({ subject: v.subject, topic: k.split("|")[1], correct: r1(v.correct), total: v.total }))
      .sort((a, b) => a.rate - b.rate);   // худшие первыми: это и есть проблемные темы
    const topics = allTopics.filter(t => t.total >= TOPIC_MIN);
    const thinTopics = allTopics.filter(t => t.total < TOPIC_MIN);

    const difficulty = [1, 2, 3].map(d => {
      const v = diffAcc.get(d) || { correct: 0, total: 0 };
      return withRate({
        difficulty: d,
        label: d === 1 ? "Лёгкие" : d === 2 ? "Средние" : "Сложные",
        correct: r1(v.correct), total: v.total,
      });
    }).filter(d => d.total > 0);

    // Позадачный анализ. Задания, которые встретились единицам, статистикой не
    // являются — порог в 3 работы отсекает шум случайной выборки.
    const questions = [...qAcc.values()]
      .filter(q => q.total >= 3)
      .map(q => withRate({
        ...q, correct: r1(q.correct),
        // Самый частый неверный ответ — это и есть типичная ошибка.
        topWrong: Object.entries(q.answers as Record<string, any>)
          .filter(([, v]) => !v.correct)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 3)
          .map(([opt, v]) => ({ option: opt, count: v.count })),
      }))
      .sort((a, b) => a.rate - b.rate);

    // ── Списки для работы завуча ───────────────────────────────────────────
    const brief = (r: any) => ({
      id: r.id, shortId: r.shortId, studentName: r.studentName, grade: r.grade,
      percent: pct(r), score: score(r), total: r.total,
      mark: markFor(pct(r), marks), assignedClass: r.assignedClass || null,
      satMath: r.satMath ?? null,
    });
    const risk = rows.filter(r => markFor(pct(r), marks) === 2)
      .sort((a, b) => pct(a) - pct(b)).map(brief);
    const top = rows.filter(r => pct(r) >= marks.excellent)
      .sort((a, b) => pct(b) - pct(a)).slice(0, 50).map(brief);

    return res.json({
      success: true, total, marks,
      summary, distribution, byGrade, byClass,
      topics, thinTopics, difficulty, questions, risk, top,
      // Пороги достоверности — кабинет показывает их пользователю, чтобы
      // «мало данных» не выглядело как «нет проблем».
      minSamples: { topic: TOPIC_MIN, question: 3 },
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/placement/decide — завуч утверждает или меняет рекомендацию.
router.post("/decide", requireFirebaseAuth, requireScreen("placement"), async (req: any, res: any) => {
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

// GET /api/placement/review — работа целиком для проверки с черновиком:
// каждый вопрос, что ответил ученик, что говорит ключ, текущий балл.
router.get("/review/:resultId", requireFirebaseAuth, requireScreen("placement"), async (req: any, res: any) => {
  try {
    const tenantId = String(req.query.tenantId || "");
    if (!(await canManagePlacement(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав на проверку работ" });
    }
    const snap = await db().collection("placement_results").doc(String(req.params.resultId)).get();
    if (!snap.exists || snap.data()!.tenantId !== tenantId) {
      return res.status(404).json({ success: false, error: "Работа не найдена" });
    }
    return res.json({ success: true, result: { id: snap.id, ...snap.data() } });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** Пересчёт итога после правок учителя. Возвращает поля для записи. */
function recomputeFromItems(row: any) {
  const sections = (row.sections || []).map((sec: any) => {
    const items = sec.items || [];
    const scored = items.reduce((a: number, i: any) => a + (Number(i.mark) || 0), 0);
    return { ...sec, correct: scored, percent: items.length ? Math.round((scored / items.length) * 100) : 0 };
  });
  const correct = sections.reduce((a: number, s: any) => a + (s.correct || 0), 0);
  const total = sections.reduce((a: number, s: any) => a + (s.total || 0), 0);
  const percent = total ? Math.round((correct / total) * 100) : 0;
  const scale = (row.scaleSnapshot || []).slice().sort((a: any, b: any) => b.minPercent - a.minPercent);
  const band = scale.find((b: any) => percent >= b.minPercent);

  // SAT пересчитывается по фактическим баллам: снять вопрос — значит изменить
  // и взвешенную оценку, иначе цифры в протоколе разойдутся между собой.
  const math = sections.find((s: any) => s.key === "math");
  let satMath = null;
  if (math?.items?.length) {
    let earned = 0, possible = 0;
    for (const it of math.items) {
      const w = DIFFICULTY_WEIGHT[String(it.difficulty)] ?? 1;
      earned += (Number(it.mark) || 0) * w;
      possible += w;
    }
    satMath = possible ? Math.round((200 + (earned / possible) * 600) / 10) * 10 : null;
  }
  return { sections, correct, total, percent, satMath,
    recommendation: band?.label || row.recommendation,
    overrides: sections.reduce((a: number, s: any) =>
      a + (s.items || []).filter((i: any) => i.overridden).length, 0) };
}

// POST /api/placement/review/mark — учитель меняет балл за ОДИН вопрос.
// Half marks exist because a draft often shows correct working with a
// mis-clicked answer; annulling the question (mark 0 for everyone would be
// unfair to those who got it) is a different decision, made per question below.
router.post("/review/mark", requireFirebaseAuth, requireScreen("placement"), async (req: any, res: any) => {
  try {
    const { tenantId, resultId, sectionKey, questionId, mark, note } = req.body || {};
    if (!tenantId || !resultId || !sectionKey || !questionId) {
      return res.status(400).json({ success: false, error: "Bad request" });
    }
    if (!(await canManagePlacement(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }
    const value = Number(mark);
    if (![0, 0.5, 1].includes(value)) {
      return res.status(400).json({ success: false, error: "Балл за вопрос: 0, 0.5 или 1" });
    }

    const ref = db().collection("placement_results").doc(String(resultId));
    const snap = await ref.get();
    if (!snap.exists || snap.data()!.tenantId !== tenantId) {
      return res.status(404).json({ success: false, error: "Работа не найдена" });
    }
    const row = snap.data()!;
    if (row.published) return res.status(409).json({ success: false, error: "Результаты опубликованы — правка закрыта" });

    let found = false;
    const sections = (row.sections || []).map((sec: any) => {
      if (sec.key !== sectionKey) return sec;
      return { ...sec, items: (sec.items || []).map((it: any) => {
        if (it.id !== questionId) return it;
        found = true;
        return { ...it, mark: value,
          overridden: value !== (it.autoCorrect ? 1 : 0),
          overrideNote: String(note || "").slice(0, 200),
          overriddenBy: req.user?.email || "" };
      }) };
    });
    if (!found) return res.status(404).json({ success: false, error: "Вопрос не найден в работе" });

    const recomputed = recomputeFromItems({ ...row, sections });
    await ref.update({
      ...recomputed,
      reviewStatus: "in_progress",
      lastReviewBy: req.user?.email || "",
      lastReviewAt: admin.firestore.Timestamp.now(),
    });
    audit("PLACEMENT_QUESTION_REMARKED", tenantId, {
      studentShortId: row.shortId, studentName: row.studentName, actorEmail: req.user?.email || "",
      detail: `${questionId}: ${value} балла${note ? ` — ${String(note).slice(0, 100)}` : ""}`,
    });
    return res.json({ success: true, ...recomputed });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/placement/review/complete — учитель закончил работу.
router.post("/review/complete", requireFirebaseAuth, requireScreen("placement"), async (req: any, res: any) => {
  try {
    const { tenantId, resultId } = req.body || {};
    if (!(await canManagePlacement(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }
    const ref = db().collection("placement_results").doc(String(resultId));
    const snap = await ref.get();
    if (!snap.exists || snap.data()!.tenantId !== tenantId) {
      return res.status(404).json({ success: false, error: "Работа не найдена" });
    }
    const actor = req.user?.email || req.user?.uid || "";
    await ref.update({
      reviewStatus: "reviewed", reviewedBy: actor, reviewedAt: admin.firestore.Timestamp.now(),
    });
    audit("PLACEMENT_REVIEW_COMPLETED", tenantId, {
      studentShortId: snap.data()!.shortId, studentName: snap.data()!.studentName, actorEmail: actor,
    });
    return res.json({ success: true, reviewedBy: actor });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/placement/annul — аннулирование работы.
router.post("/annul", requireFirebaseAuth, requireScreen("placement"), async (req: any, res: any) => {
  try {
    const { tenantId, resultId, annulled, reason } = req.body || {};
    if (!tenantId || !resultId) return res.status(400).json({ success: false, error: "Bad request" });
    if (!(await canManagePlacement(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }
    const ref = db().collection("placement_results").doc(String(resultId));
    const snap = await ref.get();
    if (!snap.exists || snap.data()!.tenantId !== tenantId) {
      return res.status(404).json({ success: false, error: "Результат не найден" });
    }
    const on = annulled !== false;
    if (on && !String(reason || "").trim()) {
      // An annulled exam without a stated reason cannot be defended to a parent.
      return res.status(400).json({ success: false, error: "Укажите причину аннулирования" });
    }
    await ref.update({
      annulled: on,
      annulReason: on ? String(reason).slice(0, 300) : "",
      annulledBy: on ? (req.user?.email || "") : "",
      annulledAt: on ? admin.firestore.Timestamp.now() : null,
    });
    audit(on ? "PLACEMENT_ANNULLED" : "PLACEMENT_ANNUL_CANCELLED", tenantId, {
      studentShortId: snap.data()!.shortId, studentName: snap.data()!.studentName,
      actorEmail: req.user?.email || "", detail: String(reason || "").slice(0, 200),
    });
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// GET/PUT /api/placement/classes — структура классов школы.
router.get("/classes", requireFirebaseAuth, requireScreen("placement"), async (req: any, res: any) => {
  try {
    const tenantId = String(req.query.tenantId || "");
    if (!(await canManagePlacement(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }
    return res.json({ success: true, groups: await loadClassStructure(tenantId), letters: CLASS_LETTERS });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.put("/classes", requireFirebaseAuth, requireScreen("placement"), async (req: any, res: any) => {
  try {
    const { tenantId, groups } = req.body || {};
    if (!(await canManagePlacement(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }
    if (!Array.isArray(groups) || !groups.length) {
      return res.status(400).json({ success: false, error: "Опишите хотя бы одну параллель" });
    }
    // Пустая строка, а не undefined: Firestore отказывается записывать
    // документ с undefined в поле, и сохранение структуры падало для каждой
    // параллели без возрастной группы — то есть для большинства.
    const clean = groups.map((g: any) => ({
      key: String(g.key || `${g.grade}${g.stream ? "-" + g.stream : ""}`).slice(0, 40),
      grade: Number(g.grade),
      stream: g.stream ? String(g.stream).slice(0, 30) : "",
      count: Math.max(0, Math.min(10, Number(g.count) || 0)),
      firstLetter: Math.max(0, Math.min(9, Number(g.firstLetter) || 0)),
    })).filter((g: any) => Number.isInteger(g.grade) && g.grade >= 5 && g.grade <= 11);
    if (!clean.length) return res.status(400).json({ success: false, error: "Классы должны быть с 5 по 11" });

    await db().collection("exam_blueprints").doc(`classes_${tenantId}`).set({
      tenantId, groups: clean,
      updatedAt: admin.firestore.Timestamp.now(), updatedBy: req.user?.email || "",
    });
    audit("PLACEMENT_CLASSES_UPDATED", tenantId, { actorEmail: req.user?.email || "" });
    return res.json({ success: true, groups: clean });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/placement/propose-classes — предложение системы, БЕЗ записи.
// Deliberately does not save: the школа looks at the proposal, moves whoever
// they disagree with, and only publishing makes it real. A distribution that
// wrote itself into the database would be a decision, not a suggestion.
router.post("/propose-classes", requireFirebaseAuth, requireScreen("placement"), async (req: any, res: any) => {
  try {
    const { tenantId, grade } = req.body || {};
    if (!(await canManagePlacement(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }
    const structure = await loadClassStructure(tenantId);
    let q = db().collection("placement_results").where("tenantId", "==", tenantId);
    if (grade) q = q.where("grade", "==", Number(grade));
    const snap = await q.get();

    const eligible = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter(r => !r.superseded && !r.annulled && !r.published);
    const proposal = proposeClassAssignment(
      eligible.map(r => ({
        id: r.id, grade: Number(r.grade), stream: r.stream,
        percent: Number(r.adjustedPercent ?? r.percent ?? 0),
      })), structure);

    // Считаем наполняемость, чтобы завуч видел перекос до публикации.
    const fill: Record<string, number> = {};
    Object.values(proposal).forEach(cls => { fill[cls] = (fill[cls] || 0) + 1; });

    return res.json({
      success: true, proposal, fill, structure,
      students: eligible.map(r => ({
        id: r.id, shortId: r.shortId, studentName: r.studentName, grade: r.grade,
        stream: r.stream || "", percent: r.adjustedPercent ?? r.percent,
        assignedClass: r.assignedClass || null, proposed: proposal[r.id] || null,
      })).sort((a, b) => Number(a.grade) - Number(b.grade) || b.percent - a.percent),
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/placement/assign-class — завуч правит предложение вручную.
router.post("/assign-class", requireFirebaseAuth, requireScreen("placement"), async (req: any, res: any) => {
  try {
    const { tenantId, resultId, assignedClass } = req.body || {};
    if (!(await canManagePlacement(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав" });
    }
    const ref = db().collection("placement_results").doc(String(resultId));
    const snap = await ref.get();
    if (!snap.exists || snap.data()!.tenantId !== tenantId) {
      return res.status(404).json({ success: false, error: "Результат не найден" });
    }
    if (snap.data()!.published) {
      return res.status(409).json({ success: false, error: "Результаты опубликованы — класс уже объявлен ученику" });
    }
    // Назначение класса И ЕСТЬ решение школы — отдельная кнопка «Утвердить»
    // была лишним шагом, из-за которого распределённые ученики продолжали
    // числиться «ждущими решения». Снятие класса возвращает работу в
    // ожидание, иначе счётчик врал бы в обратную сторону.
    const cls = String(assignedClass || "").slice(0, 10);
    await ref.update({
      assignedClass: cls,
      assignedBy: req.user?.email || "", assignedAt: admin.firestore.Timestamp.now(),
      approved: Boolean(cls),
      approvedBy: cls ? (req.user?.email || "") : "",
      finalDecision: cls || "",
    });
    audit("PLACEMENT_CLASS_ASSIGNED", tenantId, {
      studentShortId: snap.data()!.shortId, studentName: snap.data()!.studentName,
      actorEmail: req.user?.email || "", detail: cls || "класс снят",
    });
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/placement/publish — публикация результатов потока ученикам.
// Until this runs, the student portal returns "результаты ещё не опубликованы"
// — the школа must be able to re-read drafts and adjust before anything is
// visible, and a half-checked stream leaking out is exactly what that protects.
router.post("/publish", requireFirebaseAuth, requireScreen("placement"), async (req: any, res: any) => {
  try {
    const { tenantId, grade, resultIds, force } = req.body || {};
    if (!tenantId) return res.status(400).json({ success: false, error: "Нужен tenantId" });
    if (!(await canManagePlacement(req.user, tenantId))) {
      return res.status(403).json({ success: false, error: "Нет прав на публикацию" });
    }

    let query = db().collection("placement_results").where("tenantId", "==", tenantId);
    if (grade) query = query.where("grade", "==", Number(grade));
    const snap = await query.get();

    const wanted = Array.isArray(resultIds) && resultIds.length ? new Set(resultIds) : null;
    const candidates = snap.docs.filter(d => {
      const r = d.data();
      if (r.superseded) return false;          // архивная попытка не публикуется
      if (r.published) return false;           // уже опубликовано
      return !wanted || wanted.has(d.id);
    });

    // Публиковать непроверенные работы нельзя: смысл статуса «проверен» в том,
    // что кто-то сверил ответы с черновиком и поставил своё имя под этим.
    // Аннулированные проверять не нужно — они и так без балла.
    const unreviewed = candidates.filter(d => {
      const r = d.data();
      return !r.annulled && r.reviewStatus !== "reviewed";
    });
    if (unreviewed.length && !force) {
      return res.status(409).json({
        success: false, needsReview: unreviewed.length,
        error: `Не проверено работ: ${unreviewed.length}. Проверьте их с черновиками или подтвердите публикацию без проверки.`,
        students: unreviewed.slice(0, 10).map(d => ({
          id: d.id, studentName: d.data().studentName, shortId: d.data().shortId, grade: d.data().grade })),
      });
    }

    const targets = candidates;
    if (!targets.length) return res.json({ success: true, published: 0, message: "Нечего публиковать" });

    // Класс зачисления обязателен: сертификат без него бессмыслен, а публикация
    // и есть тот момент, когда предложение системы становится решением школы.
    const structure = await loadClassStructure(tenantId);
    const needClass = targets.filter(d => !d.data().assignedClass && !d.data().annulled);
    if (needClass.length && !force) {
      const proposal = proposeClassAssignment(
        needClass.map(d => ({ id: d.id, grade: Number(d.data().grade),
          stream: d.data().stream, percent: Number(d.data().adjustedPercent ?? d.data().percent ?? 0) })),
        structure);
      return res.status(409).json({
        success: false, needsClasses: needClass.length, proposal,
        error: `Не назначен класс: ${needClass.length}. Подтвердите распределение перед публикацией.`,
      });
    }

    const actor = req.user?.email || req.user?.uid || "";
    let batch = db().batch(), inBatch = 0, published = 0;
    for (const d of targets) {
      batch.update(d.ref, {
        published: true, publishedAt: admin.firestore.Timestamp.now(), publishedBy: actor,
      });
      if (++inBatch === 400) { await batch.commit(); published += inBatch; batch = db().batch(); inBatch = 0; }
    }
    if (inBatch) { await batch.commit(); published += inBatch; }

    audit("PLACEMENT_PUBLISHED", tenantId, {
      actorEmail: actor, grade: Number(grade) || 0,
      detail: `опубликовано результатов: ${published}${grade ? `, ${grade} класс` : ", весь поток"}` +
        (force ? " (без обязательной проверки)" : ""),
    });
    return res.json({ success: true, published });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/placement/my-result — портал ученика. Public: ученик анонимен.
// Требуется И номер, И фамилия: результаты несовершеннолетних — персональные
// данные, а шестизначный номер перебирается автоматом за минуты.
router.post("/my-result", async (req: any, res: any) => {
  try {
    const { tenantId, shortId, lastName } = req.body || {};
    if (!tenantId || !shortId || !lastName) {
      return res.status(400).json({ success: false, error: "Укажите номер работы и имя или фамилию" });
    }
    const gate = await checkTenantOpen(tenantId, "placement");
    if (!gate.ok) return res.status(gate.status).json({ success: false, error: gate.error });
    const snap = await db().collection("placement_results").doc(sessionId(String(tenantId), String(shortId))).get();

    // Same answer whether the id is unknown or the surname is wrong: a
    // different message would confirm which ids exist.
    const notFound = { success: false, error: "Работа не найдена. Проверьте номер и имя." };
    if (!snap.exists) return res.status(404).json(notFound);
    const r = snap.data()!;

    // Принимаем имя ИЛИ фамилию: на записи одни пишут «Иванов Иван», другие
    // «Иван Иванов», и требовать угадать порядок — значит не пустить ученика к
    // собственному результату. Сверяем с любой частью записанного ФИО;
    // отчество тоже подойдёт. Второй фактор от этого не слабеет: номер работы
    // по-прежнему нужно знать, а перебирать приходится по-прежнему их пару.
    const fold = (v: string) => String(v || "").trim().toLowerCase()
      .replace(/ё/g, "е").replace(/\s+/g, "");
    const given = fold(lastName);
    const parts = String(r.studentName || "").split(/\s+/).map(fold).filter(Boolean);
    if (!given || !parts.includes(given)) return res.status(404).json(notFound);

    if (r.superseded) return res.status(404).json(notFound);
    if (!r.published) {
      // Разные стадии — разные сообщения. «Ждите объявления» человеку, чью
      // работу ещё не открывали, звучит так, будто её потеряли.
      const reviewed = r.reviewStatus === "reviewed";
      return res.json({
        success: true, pending: true, reviewed,
        studentName: r.studentName, shortId: r.shortId,
        message: reviewed
          ? "Ваша работа проверена. Результаты будут опубликованы после того, как школа завершит распределение по классам."
          : "Ваша работа принята и ожидает проверки комиссией. Результат появится здесь после публикации.",
      });
    }
    if (r.annulled) {
      return res.json({ success: true, annulled: true, studentName: r.studentName, shortId: r.shortId,
        message: "Работа аннулирована. Обратитесь к завучу." });
    }

    // Only what the student may see: no answer keys, no per-question detail.
    const correct = r.adjustedCorrect ?? r.correct;
    const percent = r.adjustedPercent ?? r.percent;
    return res.json({
      success: true, published: true,
      // Реквизиты — на сертификат ученика: название организации, подпись, печать.
      school: publicLegal(resolveLegalProfile(gate.tenant)),
      studentName: r.studentName, shortId: r.shortId, grade: r.grade,
      correct, total: r.total, percent,
      satMath: r.satMath ?? null,
      decision: r.finalDecision || r.adjustedRecommendation || r.recommendation,
      assignedClass: r.assignedClass || null,
      // Фото и дата нужны сертификату, который ученик открывает отсюда.
      photo: r.photo || null,
      finishedAt: r.finishedAt || null,
      approved: Boolean(r.approved),
      // key обязателен: сертификат ищет разделы по нему, и без него таблица
      // результатов приходила пустой — оставалась одна строка «Общий результат».
      sections: (r.sections || []).map((s: any) => ({
        key: s.key, title: s.title, correct: s.correct, total: s.total,
        percent: s.percent, sat: s.sat ?? null,
      })),
      adjusted: r.adjustedCorrect != null,
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ── Импорт банка вопросов ─────────────────────────────────────────────────

// POST /api/placement/preview — разбор файла БЕЗ записи. The manager sees
// exactly what would be imported, which rows are broken and why, and decides.
// Nothing here touches the database: previewing a file is not importing it.
router.post("/preview", requireFirebaseAuth, requireScreen("placement"), async (req: any, res: any) => {
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
router.post("/import", requireFirebaseAuth, requireScreen("placement"), async (req: any, res: any) => {
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
router.post("/allow-retake", requireFirebaseAuth, requireScreen("placement"), async (req: any, res: any) => {
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
router.get("/questions", requireFirebaseAuth, requireScreen("placement"), async (req: any, res: any) => {
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
router.put("/questions/:id", requireFirebaseAuth, requireScreen("placement"), async (req: any, res: any) => {
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
