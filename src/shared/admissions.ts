import type { Decision, Exam } from "./examRun.js";
import { gradeOf, type QAnswers, type QOutcomeOption, type QTemplate } from "./questionnaires.js";

/**
 * Поступающие: карточка ребёнка, анкеты (родителя и сотрудников), направление
 * на тест, бумажные результаты и решение.
 *
 * Всё хранит сервер (подколлекции организации). В карточке лежит только
 * сводка этапов — итог без содержимого: содержимое анкет с данными о здоровье
 * отдаётся отдельно и только тем, кому разрешено шаблоном.
 */

export interface StageSummary {
  templateId: string;
  title: string;
  status: "draft" | "done";
  outcome: string | null;
  outcomeLabel: string;
  tone: QOutcomeOption["tone"] | null;
  allowsTest: boolean;
  by: string;
  byName: string;
  at: number;
}

/** Решение по кандидату — как в бумажной «Анкете кандидата на поступление». */
export type CandidateDecision = "enroll" | "trial" | "rejected" | "pending";
export const CANDIDATE_DECISION_LABEL: Record<CandidateDecision, string> = {
  enroll: "Зачисление рекомендовано", trial: "Пробный период", rejected: "Отказ", pending: "На рассмотрении",
};
/**
 * Что пишет и решает администрация в анкете кандидата (пункты 3–5 бланка).
 * Остальное в анкете — из карточки, анкеты родителя и теста.
 */
export interface CandidateInfo {
  responsible: string;
  /** Общий результат / заключение. */
  conclusion: string;
  /** Обратная связь родителю: сильные и слабые стороны, рекомендации, условия. */
  feedback: string;
  /** «Обратная связь: да» — с этого момента ученик видит свои результаты по QR. */
  feedbackGiven: boolean;
  decision: CandidateDecision | null;
  trialFrom: string; trialTo: string;
  klass: string;
  reviewDate: string;
  parentNotified: boolean | null;
  nextContact: string;
  by: string; at: number;
}
const DECISIONS: CandidateDecision[] = ["enroll", "trial", "rejected", "pending"];
const LEGACY_DECISION: Record<Decision, CandidateDecision> = { accepted: "enroll", reserve: "pending", rejected: "rejected" };
const txt = (v: unknown, max: number) => String(v ?? "").replace(/\r/g, "").trim().slice(0, max);
const day = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : "");

export function sanitizeCandidate(raw: any): Omit<CandidateInfo, "by" | "at"> {
  return {
    responsible: txt(raw?.responsible, 120),
    conclusion: txt(raw?.conclusion, 1000),
    feedback: txt(raw?.feedback, 4000),
    feedbackGiven: raw?.feedbackGiven === true,
    decision: DECISIONS.includes(raw?.decision) ? raw.decision : null,
    trialFrom: day(raw?.trialFrom), trialTo: day(raw?.trialTo),
    klass: txt(raw?.klass, 20),
    reviewDate: day(raw?.reviewDate),
    parentNotified: typeof raw?.parentNotified === "boolean" ? raw.parentNotified : null,
    nextContact: txt(raw?.nextContact, 200),
  };
}
/** Анкета кандидата карточки; решение, принятое до анкеты, переносится в неё. */
export function candidateOf(a: Pick<Applicant, "candidate" | "decision">): CandidateInfo | null {
  if (a.candidate) return a.candidate;
  if (!a.decision) return null;
  return { ...sanitizeCandidate({ conclusion: a.decision.comment }), decision: LEGACY_DECISION[a.decision.value] || null, by: a.decision.by, at: a.decision.at };
}

export interface PaperResult { id: string; title: string; rows: { subject: string; score: number | null; max: number | null }[]; comment: string; at: number; byName: string }

export interface Applicant {
  id: string;
  tenantId: string;
  /** Сквозной номер в организации — его пишут на бумаге и вводят в поиск. */
  refNo: number;
  child: { name: string; birthDate: string; grade: string; school?: string };
  parent: { name: string; phone: string };
  note: string;
  /** Анкета родителя: сдана ли (содержимое — в applicant_forms). */
  parentForm: { status: "none" | "done"; at: number | null; by: "parent" | "staff" | null };
  stages: Record<string, StageSummary>;
  referral: {
    examId: string | null; examTitle: string; examCode: string | null;
    issuedAt: number; by: string; byName: string; manual: boolean; reason: string;
  } | null;
  paperResults: PaperResult[];
  /** Прежнее решение (Принят / Резерв / Не принят) — читается через candidateOf. */
  decision?: { value: Decision; comment: string; by: string; at: number } | null;
  /** Анкета кандидата: заключение, обратная связь, решение (администрация). */
  candidate?: CandidateInfo | null;
  /** Секреты ссылок QR — видят только сотрудники (для перепечатки). */
  tokens: { parent: string; card: string; referral?: string };
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  createdByName: string;
}

/** Анкета ребёнка по шаблону: снимок шаблона, ответы, итог. */
export interface ApplicantForm {
  id: string;
  applicantId: string;
  templateId: string;
  template: QTemplate;
  grade: number | null;
  answers: QAnswers;
  outcome: string | null;
  status: "draft" | "done";
  filledBy: { kind: "parent" | "staff"; uid?: string; name: string };
  consent?: { at: number; version: string; ip: string };
  createdAt: number;
  updatedAt: number;
  doneAt: number | null;
}

/** Ссылки по QR — у каждой своя цель (принцип наименьших прав). */
export type LinkPurpose = "parent" | "referral" | "card";

export type Stage = "new" | "parent" | "staff" | "not_recommended" | "passed" | "referred" | "testing" | "tested" | "decided";
export const STAGE_LABEL: Record<Stage, string> = {
  new: "Записан",
  parent: "Анкета родителя",
  staff: "Диагностика идёт",
  not_recommended: "Не рекомендован",
  passed: "Диагностика пройдена",
  referred: "Направлен на тест",
  testing: "Пишет тест",
  tested: "Тест сдан",
  decided: "Решение принято",
};

/** Этап поступающего — для списка и фильтров. */
export function stageOf(a: Pick<Applicant, "parentForm" | "stages" | "referral" | "decision" | "candidate" | "paperResults">, attempt?: { status: string } | null): Stage {
  const d = candidateOf(a)?.decision;
  if (d && d !== "pending") return "decided";
  if (attempt?.status === "finished" || a.paperResults.length) return "tested";
  if (attempt?.status === "in_progress") return "testing";
  if (a.referral) return "referred";
  const st = Object.values(a.stages);
  if (st.some(s => s.status === "done" && !s.allowsTest)) return "not_recommended";
  if (st.length && st.every(s => s.status === "done")) return "passed";
  if (st.length) return "staff";
  return a.parentForm.status === "done" ? "parent" : "new";
}

/**
 * Допуск к тесту по итогам анкет: все пройденные этапы пускают (итог с
 * «пускает к тесту»). Какой именно тест — решает класс, а не человек.
 */
export const admittedByStages = (a: Pick<Applicant, "stages">) => {
  const st = Object.values(a.stages);
  return st.length > 0 && st.every(s => s.status === "done" && s.allowsTest);
};

/**
 * Экзамен для направления: открыт (или черновик — его откроют к дате), для
 * класса поступающего, и все его этапы пройдены с пускающим итогом.
 * Итог пускает, если входит в passOutcomes этапа экзамена, а без них — если
 * в шаблоне у него «пускает к тесту».
 */
export function examForApplicant(exams: Exam[], a: Pick<Applicant, "child" | "stages">, templates: Record<string, Pick<QTemplate, "outcome">>, override = false): Exam | null {
  const g = gradeOf(a.child.grade);
  if (g === null) return null;
  const fit = exams.filter(e => !e.archived && e.status !== "closed" && (e.settings.admission?.grades || []).includes(g))
    // Допущен администрацией вопреки итогу — этапы не проверяем, тест всё равно по классу.
    .filter(e => override || (e.settings.admission?.stages || []).every(st => {
      const s = a.stages[st.templateId];
      if (!s || s.status !== "done" || !s.outcome) return false;
      if (st.passOutcomes.length) return st.passOutcomes.includes(s.outcome);
      return !!templates[st.templateId]?.outcome?.options.find(o => o.id === s.outcome)?.allowsTest;
    }));
  // Открытый — раньше черновика.
  return fit.sort((x, y) => (x.status === "open" ? 0 : 1) - (y.status === "open" ? 0 : 1) || y.updatedAt - x.updatedAt)[0] || null;
}

/**
 * Уровень предмета в анкете кандидата. Если у предмета своя шкала в частях
 * оценки (английский: Pre-Intermediate, Intermediate…) — она; иначе
 * «низкий / средний / отличный» по порогам экзамена.
 */
export function subjectLevel(
  s: { id: string; percent: number },
  parts: { kind: string; sections: string[]; value: string }[],
  levels: { mid: number; high: number } = { mid: 50, high: 77 },
): { band: 0 | 1 | 2; own: string | null } {
  const band = s.percent >= levels.high ? 2 : s.percent >= levels.mid ? 1 : 0;
  const own = parts.find(p => (p.kind === "labels" || p.kind === "band") && p.sections.length === 1 && p.sections[0] === s.id && p.value !== "—");
  return { band, own: own ? own.value : null };
}

export const refLabel = (n: number) => `№ ${String(n).padStart(4, "0")}`;
