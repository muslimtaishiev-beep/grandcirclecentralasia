/**
 * Экзамен: конструктор, вариант, подсчёт, отметки, аналитика.
 *
 * Всё, что раньше было зашито в «Тесты» и «Вступительный срез» (классы 5–11,
 * два предмета, SAT, отметки 2–5, рекомендация класса, решение о приёме),
 * здесь — настройки конкретного экзамена. Организация собирает экзамен из
 * дисциплин своего банка и включает только то, что ей нужно.
 *
 * Проверка ответа — lib/scoringEngine.isAnswerCorrect, как у прежнего теста.
 * Модуль общий для сервера и браузера.
 */
import { isAnswerCorrect } from "../lib/scoringEngine.js";
import type { BankQuestion, Difficulty, QuestionType } from "./exams.js";

// ── Конструктор ─────────────────────────────────────────────────────────

export interface ExamSection {
  id: string;
  disciplineId: string;
  title: string;
  minutes: number;
  /** all — все активные вопросы дисциплины для уровней по порядку; random — выборка по сложности. */
  mode: "all" | "random";
  /** Какие уровни (классы) брать. Пусто — все вопросы дисциплины. */
  levels: string[];
  counts: Record<Difficulty, number>;
  shuffle: boolean;
}

export interface ScaleBand { minPercent: number; label: string }

export interface ExamSettings {
  registration: { phone: boolean; email: boolean; level: boolean; levelLabel: string; photo: boolean };
  access: {
    pinMode: "hourly" | "fixed" | "none";
    fixedPin: string;
    opensAt: number | null;
    closesAt: number | null;
    /** Сколько раз один человек может сдать без разрешения менеджера. */
    maxAttempts: number;
  };
  proctoring: {
    enabled: boolean;
    detectors: { gazeAway: boolean; faceCount: boolean; handTracking: boolean; audioAnalysis: boolean; phoneDetection: boolean };
    /** Считать нарушением уход со вкладки. */
    tabSwitch: boolean;
  };
  scoring: {
    /** Отметка 2–5 по порогам процента. */
    marks: { enabled: boolean; pass: number; good: number; excellent: number };
    /** Балл 1.0–5.0 с половинками (как band score в IELTS). */
    band: boolean;
    /** Шкала результата: от процента — подпись (уровень, рекомендация). */
    scale: ScaleBand[];
  };
  results: {
    showToStudent: "never" | "after_publish" | "immediately";
    /** Публиковать только проверенные работы. */
    requireReview: boolean;
    certificate: boolean;
    certificateTitle: string;
    /** Решение по работе: принят / резерв / не принят. */
    decisions: boolean;
    /** Распределение по группам (классам): список групп. Пусто — выключено. */
    groups: string[];
  };
}

export type ExamStatus = "draft" | "open" | "closed";

export interface Exam {
  id: string;
  tenantId: string;
  code: string;
  title: string;
  description: string;
  group: string;
  status: ExamStatus;
  sections: ExamSection[];
  settings: ExamSettings;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  archived?: boolean;
}

export const DEFAULT_SETTINGS: ExamSettings = {
  registration: { phone: true, email: false, level: false, levelLabel: "Класс", photo: false },
  access: { pinMode: "hourly", fixedPin: "", opensAt: null, closesAt: null, maxAttempts: 1 },
  proctoring: {
    enabled: false,
    detectors: { gazeAway: true, faceCount: true, handTracking: true, audioAnalysis: true, phoneDetection: true },
    tabSwitch: false,
  },
  scoring: {
    marks: { enabled: false, pass: 50, good: 65, excellent: 85 },
    band: false,
    scale: [],
  },
  results: {
    showToStudent: "after_publish",
    requireReview: false,
    certificate: false,
    certificateTitle: "Сертификат о результатах экзамена",
    decisions: false,
    groups: [],
  },
};

const num = (v: unknown, min: number, max: number, def: number) => {
  const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const s = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const b = (v: unknown, def: boolean) => (typeof v === "boolean" ? v : def);

export function sanitizeSections(raw: unknown): ExamSection[] {
  const out: ExamSection[] = [];
  const ids = new Set<string>();
  for (const r of (Array.isArray(raw) ? raw : []).slice(0, 20) as any[]) {
    const disciplineId = s(r?.disciplineId, 8).toUpperCase();
    if (!disciplineId) continue;
    let id = s(r?.id, 40);
    if (!/^[\w-]{2,40}$/.test(id) || ids.has(id)) id = `s${Date.now().toString(36)}${out.length}`;
    ids.add(id);
    const c = r?.counts || {};
    out.push({
      id, disciplineId,
      title: s(r?.title, 80) || disciplineId,
      minutes: Math.round(num(r?.minutes, 1, 600, 30)),
      mode: r?.mode === "random" ? "random" : "all",
      levels: (Array.isArray(r?.levels) ? r.levels : []).map((x: unknown) => s(x, 20)).filter(Boolean).slice(0, 30),
      counts: { 1: Math.round(num(c[1], 0, 500, 0)), 2: Math.round(num(c[2], 0, 500, 0)), 3: Math.round(num(c[3], 0, 500, 0)) },
      shuffle: b(r?.shuffle, false),
    });
  }
  return out;
}

export function sanitizeSettings(raw: any): ExamSettings {
  const d = DEFAULT_SETTINGS;
  const r = raw || {};
  const scale = (Array.isArray(r.scoring?.scale) ? r.scoring.scale : [])
    .map((x: any) => ({ minPercent: Math.round(num(x?.minPercent, 0, 100, 0)), label: s(x?.label, 60) }))
    .filter((x: ScaleBand) => x.label).slice(0, 12)
    .sort((a: ScaleBand, c: ScaleBand) => c.minPercent - a.minPercent);
  const m = r.scoring?.marks || {};
  const toTime = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
  return {
    registration: {
      phone: b(r.registration?.phone, d.registration.phone),
      email: b(r.registration?.email, d.registration.email),
      level: b(r.registration?.level, d.registration.level),
      levelLabel: s(r.registration?.levelLabel, 30) || d.registration.levelLabel,
      photo: b(r.registration?.photo, d.registration.photo),
    },
    access: {
      pinMode: ["hourly", "fixed", "none"].includes(r.access?.pinMode) ? r.access.pinMode : d.access.pinMode,
      fixedPin: s(r.access?.fixedPin, 12).replace(/\s/g, ""),
      opensAt: toTime(r.access?.opensAt),
      closesAt: toTime(r.access?.closesAt),
      maxAttempts: Math.round(num(r.access?.maxAttempts, 1, 20, 1)),
    },
    proctoring: {
      enabled: b(r.proctoring?.enabled, d.proctoring.enabled),
      detectors: Object.fromEntries(Object.entries(d.proctoring.detectors).map(([k, v]) => [k, b(r.proctoring?.detectors?.[k], v)])) as ExamSettings["proctoring"]["detectors"],
      tabSwitch: b(r.proctoring?.tabSwitch, d.proctoring.tabSwitch),
    },
    scoring: {
      marks: {
        enabled: b(m.enabled, d.scoring.marks.enabled),
        pass: Math.round(num(m.pass, 0, 100, d.scoring.marks.pass)),
        good: Math.round(num(m.good, 0, 100, d.scoring.marks.good)),
        excellent: Math.round(num(m.excellent, 0, 100, d.scoring.marks.excellent)),
      },
      band: b(r.scoring?.band, d.scoring.band),
      scale,
    },
    results: {
      showToStudent: ["never", "after_publish", "immediately"].includes(r.results?.showToStudent) ? r.results.showToStudent : d.results.showToStudent,
      requireReview: b(r.results?.requireReview, d.results.requireReview),
      certificate: b(r.results?.certificate, d.results.certificate),
      certificateTitle: s(r.results?.certificateTitle, 120) || d.results.certificateTitle,
      decisions: b(r.results?.decisions, d.results.decisions),
      groups: [...new Set<string>((Array.isArray(r.results?.groups) ? r.results.groups : []).map((x: unknown) => s(x, 30)).filter(Boolean))].slice(0, 60),
    },
  };
}

export const isWindowOpen = (e: Pick<Exam, "status" | "settings">, now = Date.now()) =>
  e.status === "open"
  && (!e.settings.access.opensAt || now >= e.settings.access.opensAt)
  && (!e.settings.access.closesAt || now <= e.settings.access.closesAt);

// ── Вариант ─────────────────────────────────────────────────────────────

const levelOk = (q: Pick<BankQuestion, "levels">, levels: string[]) =>
  !levels.length || !q.levels.length || q.levels.some(l => levels.includes(l));

/** Вопросы банка, подходящие разделу, — для конструктора и сборки варианта. */
export function sectionPool(section: ExamSection, bank: BankQuestion[]): BankQuestion[] {
  return bank.filter(q => q.active && q.disciplineId === section.disciplineId && levelOk(q, section.levels))
    .sort((a, c) => (a.order ?? 1e9) - (c.order ?? 1e9) || a.number - c.number);
}

export function sectionPlan(section: ExamSection, bank: BankQuestion[]) {
  const pool = sectionPool(section, bank);
  const have = { 1: 0, 2: 0, 3: 0 } as Record<Difficulty, number>;
  for (const q of pool) have[q.difficulty]++;
  // Сколько ученик получит на деле: заказано больше, чем есть, — дадим сколько есть.
  const want = section.mode === "all" ? pool.length : ([1, 2, 3] as Difficulty[]).reduce((n, d) => n + Math.min(section.counts[d], have[d]), 0);
  const short = section.mode === "random"
    ? ([1, 2, 3] as Difficulty[]).filter(d => section.counts[d] > have[d]).map(d => ({ difficulty: d, need: section.counts[d], have: have[d] }))
    : [];
  return { pool: pool.length, have, want, short };
}

function shuffle<T>(a: T[], rnd: () => number = Math.random): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}

/**
 * Вопросы раздела для одного ученика. В случайном режиме — по сложности,
 * стараясь не брать подряд одну тему: выбираем по кругу из тем.
 */
export function pickSectionQuestions(section: ExamSection, bank: BankQuestion[], rnd: () => number = Math.random): BankQuestion[] {
  const pool = sectionPool(section, bank);
  if (section.mode === "all") return section.shuffle ? shuffle(pool, rnd) : pool;
  const out: BankQuestion[] = [];
  for (const d of [1, 2, 3] as Difficulty[]) {
    const need = section.counts[d];
    if (!need) continue;
    const byTopic = new Map<string, BankQuestion[]>();
    for (const q of shuffle(pool.filter(x => x.difficulty === d), rnd)) {
      const k = q.topic || "—"; byTopic.set(k, [...(byTopic.get(k) || []), q]);
    }
    const topics = shuffle([...byTopic.keys()], rnd);
    while (out.filter(q => q.difficulty === d).length < need && topics.some(t => byTopic.get(t)!.length)) {
      for (const t of topics) {
        const list = byTopic.get(t)!;
        if (list.length && out.filter(q => q.difficulty === d).length < need) out.push(list.shift()!);
      }
    }
  }
  return section.shuffle ? shuffle(out, rnd) : out;
}

// ── Подсчёт ─────────────────────────────────────────────────────────────

/** То, что попадает в работу ученика при старте: вопрос с ключом на тот момент. */
export type FrozenQuestion = Pick<BankQuestion, "id" | "disciplineId" | "type" | "points" | "answer" | "topic" | "difficulty"> & Record<string, any>;

export interface ResultItem {
  qid: string;
  sectionId: string;
  topic: string;
  type: QuestionType;
  difficulty: Difficulty;
  points: number;
  auto: number;
  earned: number;
  correct: boolean;
  answer: string;
  overridden: boolean;
}
export interface SectionResult { id: string; title: string; earned: number; max: number; percent: number; correct: number; total: number }
export interface ExamResult {
  earned: number;
  max: number;
  percent: number;
  correct: number;
  total: number;
  sections: SectionResult[];
  topics: { topic: string; earned: number; max: number; percent: number }[];
  items: ResultItem[];
  mark: number | null;
  band: number | null;
  scaleLabel: string | null;
}

const pct = (a: number, m: number) => (m ? Math.round((a / m) * 1000) / 10 : 0);
const answerText = (v: unknown) => (v === undefined || v === null ? "" : typeof v === "string" ? v : JSON.stringify(v));

export function markOf(percent: number, m: ExamSettings["scoring"]["marks"]): number | null {
  if (!m.enabled) return null;
  return percent >= m.excellent ? 5 : percent >= m.good ? 4 : percent >= m.pass ? 3 : 2;
}
export function bandOf(percent: number): number {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  return Math.max(1, Math.min(5, Math.round((p / 100) * 4 * 2) / 2 + 1));
}
export function scaleOf(percent: number, scale: ScaleBand[]): string | null {
  return [...scale].sort((a, c) => c.minPercent - a.minPercent).find(x => percent >= x.minPercent)?.label || null;
}

/**
 * Работа → результат. overrides — ручная оценка менеджера (баллы за вопрос);
 * она сильнее автоматической.
 */
export function gradeAttempt(
  sections: { id: string; title: string; questionIds: string[] }[],
  questions: Record<string, FrozenQuestion>,
  answers: Record<string, unknown>,
  settings: ExamSettings,
  overrides: Record<string, number> = {},
): ExamResult {
  const items: ResultItem[] = [];
  const secRes: SectionResult[] = [];
  const topics = new Map<string, { earned: number; max: number }>();
  for (const sec of sections) {
    let e = 0, m = 0, c = 0;
    for (const qid of sec.questionIds) {
      const q = questions[qid]; if (!q) continue;
      const a = answerText(answers[qid]);
      const ok = a.trim() ? isAnswerCorrect(a, q.answer) : false;
      const auto = ok ? q.points : 0;
      const ov = overrides[qid];
      const earned = typeof ov === "number" && Number.isFinite(ov) ? Math.max(0, Math.min(q.points, ov)) : auto;
      items.push({ qid, sectionId: sec.id, topic: q.topic || "", type: q.type, difficulty: q.difficulty, points: q.points, auto, earned, correct: earned >= q.points, answer: a, overridden: typeof ov === "number" });
      e += earned; m += q.points; if (earned >= q.points) c++;
      const t = topics.get(q.topic || "—") || { earned: 0, max: 0 };
      t.earned += earned; t.max += q.points; topics.set(q.topic || "—", t);
    }
    secRes.push({ id: sec.id, title: sec.title, earned: e, max: m, percent: pct(e, m), correct: c, total: sec.questionIds.length });
  }
  const earned = secRes.reduce((x, r) => x + r.earned, 0);
  const max = secRes.reduce((x, r) => x + r.max, 0);
  const percent = pct(earned, max);
  return {
    earned, max, percent,
    correct: items.filter(i => i.correct).length, total: items.length,
    sections: secRes,
    topics: [...topics].map(([topic, t]) => ({ topic, ...t, percent: pct(t.earned, t.max) })).sort((a, c) => a.percent - c.percent),
    items,
    mark: markOf(percent, settings.scoring.marks),
    band: settings.scoring.band ? bandOf(percent) : null,
    scaleLabel: scaleOf(percent, settings.scoring.scale),
  };
}

// ── Работа ученика ─────────────────────────────────────────────────────

export interface AttemptSection {
  id: string; title: string; disciplineId: string; minutes: number; questionIds: string[];
  startedAt: number | null; deadline: number | null; finishedAt: number | null;
}
export type Decision = "accepted" | "reserve" | "rejected";
export const DECISION_LABEL: Record<Decision, string> = { accepted: "Принят", reserve: "Резерв", rejected: "Не принят" };

export interface ProctoringSummary {
  enabled: boolean;
  unavailable?: boolean;
  honestyIndex?: number | null;
  totalViolations?: number;
  bySeverity?: Record<string, number>;
  violations?: { type: string; severity: string; description: string; atMs: number }[];
  snapshotCount?: number;
  startedAt?: number | null;
  endedAt?: number | null;
}

export interface Attempt {
  id: string;
  tenantId: string;
  examId: string;
  examTitle: string;
  shortId: string;
  student: { name: string; phone: string; email: string; level: string };
  status: "in_progress" | "finished" | "annulled";
  startedAt: number;
  finishedAt: number | null;
  current: number;
  sections: AttemptSection[];
  answers: Record<string, string>;
  result: ExamResult | null;
  review: { status: "none" | "done"; overrides: Record<string, number>; notes: Record<string, string>; by?: string; at?: number };
  proctoring: ProctoringSummary;
  published: boolean;
  publishedAt?: number | null;
  decision?: { value: Decision; comment: string; by: string; at: number } | null;
  group?: string | null;
  retakeAllowed?: boolean;
  superseded?: boolean;
  hasPhoto?: boolean;
  meta?: { ip: string; userAgent: string };
}

/** Список работ без тяжёлых полей — для таблиц. */
export type AttemptRow = Omit<Attempt, "answers" | "result"> & {
  result: Omit<ExamResult, "items"> | null;
  answered: number; questionCount: number;
};

// ── Аналитика ───────────────────────────────────────────────────────────

export interface QuestionStat { qid: string; sectionId: string; topic: string; asked: number; correct: number; percent: number; wrong: { answer: string; count: number }[] }
export interface ExamAnalytics {
  finished: number;
  inProgress: number;
  avgPercent: number;
  medianPercent: number;
  passRate: number | null;
  qualityRate: number | null;
  histogram: { from: number; to: number; count: number }[];
  marks: { mark: number; count: number }[];
  sections: { id: string; title: string; avgPercent: number }[];
  levels: { level: string; count: number; avgPercent: number }[];
  topics: { topic: string; avgPercent: number; asked: number }[];
  questions: QuestionStat[];
  scale: { label: string; count: number }[];
  groups: { group: string; count: number }[];
  decisions: { decision: string; count: number }[];
  honesty: { avg: number | null; flagged: number; noCamera: number };
  top: { id: string; name: string; percent: number }[];
  risk: { id: string; name: string; percent: number; reason: string }[];
}

export function examAnalytics(attempts: Attempt[], settings: ExamSettings, sectionTitles: Record<string, string>): ExamAnalytics {
  const done = attempts.filter(a => a.status === "finished" && a.result && !a.superseded);
  const ps = done.map(a => a.result!.percent).sort((a, c) => a - c);
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((x, y) => x + y, 0) / xs.length) * 10) / 10 : 0);
  const marks = settings.scoring.marks;
  const hist = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: i === 9 ? 100 : i * 10 + 9.9, count: 0 }));
  for (const p of ps) hist[Math.min(9, Math.floor(p / 10))].count++;
  const count = <K extends string>(xs: K[]) => { const m = new Map<K, number>(); for (const x of xs) m.set(x, (m.get(x) || 0) + 1); return m; };

  const secAgg = new Map<string, number[]>();
  const topicAgg = new Map<string, { e: number; m: number; n: number }>();
  const qAgg = new Map<string, QuestionStat & { wrongMap: Map<string, number> }>();
  for (const a of done) {
    for (const sr of a.result!.sections) secAgg.set(sr.id, [...(secAgg.get(sr.id) || []), sr.percent]);
    for (const it of a.result!.items) {
      const t = topicAgg.get(it.topic || "—") || { e: 0, m: 0, n: 0 };
      t.e += it.earned; t.m += it.points; t.n++; topicAgg.set(it.topic || "—", t);
      const q = qAgg.get(it.qid) || { qid: it.qid, sectionId: it.sectionId, topic: it.topic, asked: 0, correct: 0, percent: 0, wrong: [], wrongMap: new Map() };
      q.asked++; if (it.correct) q.correct++;
      else { const k = it.answer.trim() || "(нет ответа)"; q.wrongMap.set(k, (q.wrongMap.get(k) || 0) + 1); }
      qAgg.set(it.qid, q);
    }
  }
  const lv = new Map<string, number[]>();
  for (const a of done) { const l = a.student.level || "—"; lv.set(l, [...(lv.get(l) || []), a.result!.percent]); }
  const honest = done.map(a => a.proctoring?.honestyIndex).filter((x): x is number => typeof x === "number");

  return {
    finished: done.length,
    inProgress: attempts.filter(a => a.status === "in_progress").length,
    avgPercent: avg(ps),
    medianPercent: ps.length ? ps[Math.floor(ps.length / 2)] : 0,
    passRate: marks.enabled && done.length ? Math.round(done.filter(a => (a.result!.mark || 0) >= 3).length / done.length * 1000) / 10 : null,
    qualityRate: marks.enabled && done.length ? Math.round(done.filter(a => (a.result!.mark || 0) >= 4).length / done.length * 1000) / 10 : null,
    histogram: hist,
    marks: marks.enabled ? [5, 4, 3, 2].map(m => ({ mark: m, count: done.filter(a => a.result!.mark === m).length })) : [],
    sections: [...secAgg].map(([id, xs]) => ({ id, title: sectionTitles[id] || id, avgPercent: avg(xs) })),
    levels: [...lv].map(([level, xs]) => ({ level, count: xs.length, avgPercent: avg(xs) })).sort((a, c) => a.level.localeCompare(c.level, "ru", { numeric: true })),
    topics: [...topicAgg].map(([topic, t]) => ({ topic, avgPercent: pct(t.e, t.m), asked: t.n })).sort((a, c) => a.avgPercent - c.avgPercent),
    questions: [...qAgg.values()].map(({ wrongMap, ...q }) => ({ ...q, percent: pct(q.correct, q.asked), wrong: [...wrongMap].map(([answer, c]) => ({ answer, count: c })).sort((a, c) => c.count - a.count).slice(0, 3) }))
      .sort((a, c) => a.percent - c.percent),
    scale: [...count(done.map(a => a.result!.scaleLabel || "—"))].map(([label, c]) => ({ label, count: c })),
    groups: [...count(done.map(a => a.group || "не распределён"))].map(([group, c]) => ({ group, count: c })),
    decisions: [...count(done.map(a => (a.decision ? DECISION_LABEL[a.decision.value] : "без решения")))].map(([decision, c]) => ({ decision, count: c })),
    honesty: {
      avg: honest.length ? Math.round(avg(honest)) : null,
      flagged: done.filter(a => (a.proctoring?.bySeverity?.HIGH || 0) > 0 || (typeof a.proctoring?.honestyIndex === "number" && a.proctoring.honestyIndex < 60)).length,
      noCamera: done.filter(a => a.proctoring?.enabled && a.proctoring?.unavailable).length,
    },
    top: [...done].sort((a, c) => c.result!.percent - a.result!.percent).slice(0, 10).map(a => ({ id: a.id, name: a.student.name, percent: a.result!.percent })),
    risk: done.filter(a => a.result!.percent < (marks.enabled ? marks.pass : 40) || (a.proctoring?.bySeverity?.HIGH || 0) > 0)
      .sort((a, c) => a.result!.percent - c.result!.percent).slice(0, 20)
      .map(a => ({ id: a.id, name: a.student.name, percent: a.result!.percent, reason: (a.proctoring?.bySeverity?.HIGH || 0) > 0 ? "грубые нарушения прокторинга" : "низкий результат" })),
  };
}
