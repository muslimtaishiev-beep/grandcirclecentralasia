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
  decision: { value: Decision; comment: string; by: string; at: number } | null;
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
export function stageOf(a: Pick<Applicant, "parentForm" | "stages" | "referral" | "decision" | "paperResults">, attempt?: { status: string } | null): Stage {
  if (a.decision) return "decided";
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

export const refLabel = (n: number) => `№ ${String(n).padStart(4, "0")}`;
