import { candidateOf, subjectLevel, type Applicant, type CandidateInfo } from "../../../shared/admissions";
import { partResults, type Attempt, type Exam } from "../../../shared/examRun";
import { answerText, type QAnswers, type QTemplate } from "../../../shared/questionnaires";
import { candidateSheet, downloadPdf, linkUrl, type CandidateDoc, type PrintOrg } from "../../../lib/admissionPrint";

/**
 * «Анкета кандидата на поступление»: всё, что система уже знает, — из
 * карточки, анкеты родителя и теста; заключение, обратная связь и решение —
 * из того, что вписала администрация. Заменяет сертификат и «Отчёт по темам»
 * вступительных тестов: сильные стороны и зона роста идут в пункт 4.
 */
export interface TestSummary {
  examTitle: string; status: string; superseded?: boolean; finishedAt: number | null; paper?: boolean;
  sections: { id: string; title: string; percent: number; correct?: number; total?: number }[];
  parts: { title: string; value: string; kind: string; sections: string[] }[];
  percent: number | null;
  topics: { topic: string; percent: number }[];
  levels: { mid: number; high: number };
  studentPhone?: string;
}

/** Итоги работы из экзамена — для анкеты, когда карточки поступающего нет или она недоступна. */
export function testOfAttempt(a: Attempt, exam: Exam): TestSummary | null {
  const r = a.result;
  if (!r) return null;
  const parts = partResults(r.sections, exam.settings.scoring)
    .map(p => ({ title: p.title, value: p.value, kind: p.kind, sections: exam.settings.scoring.parts?.find(q => q.id === p.id)?.sections || [] }));
  return {
    examTitle: a.examTitle, status: a.status, superseded: a.superseded, finishedAt: a.finishedAt, paper: !!(a as any).paper,
    sections: r.sections.map(s => ({ id: s.id, title: s.title, percent: s.percent, correct: s.correct, total: s.total })),
    parts, percent: parts.length && exam.settings.scoring.hideTotal ? null : r.percent,
    topics: (r.topics || []).filter(t => t.topic && t.topic !== "—").map(t => ({ topic: t.topic, percent: t.percent })),
    levels: exam.settings.admission?.levels || { mid: 50, high: 77 },
    studentPhone: a.student.extra?.studentPhone || "",
  };
}

/** Последний сданный тест (пересдача заменяет прежний). */
export const latestTest = (xs: TestSummary[]) =>
  xs.filter(x => x.status === "finished" && !x.superseded).sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0))[0] || null;

/** Сильные стороны и зона роста по темам — как в прежнем отчёте (от 80% и ниже 60%). */
export function topicFeedback(topics: TestSummary["topics"]): string {
  const f = (xs: TestSummary["topics"]) => xs.slice(0, 6).map(t => `${t.topic} (${Math.round(t.percent)}%)`).join(", ");
  const strong = topics.filter(t => t.percent >= 80).sort((a, b) => b.percent - a.percent);
  const weak = topics.filter(t => t.percent < 60).sort((a, b) => a.percent - b.percent);
  return [strong.length ? `Сильные стороны: ${f(strong)}.` : "", weak.length ? `Зона роста: ${f(weak)}.` : ""].filter(Boolean).join("\n");
}

type ParentForm = { template: QTemplate; answers?: QAnswers } | null | undefined;
const answerOf = (form: ParentForm, id: string) => {
  const item = form?.template.sections.flatMap(s => s.items).find(i => i.id === id);
  return item && form?.answers ? answerText(item, form.answers[id]) : "";
};

export function candidateDoc(o: {
  applicant?: Applicant | null;
  parentForm?: ParentForm;
  test: TestSummary | null;
  /** Без карточки (работа без направления) — данные из регистрации на тест. */
  fallback?: { name: string; birthDate: string; grade: string; school: string; parentName: string; parentPhone: string; studentPhone: string };
}): CandidateDoc {
  const a = o.applicant || null;
  const c: CandidateInfo | null = a ? candidateOf(a) : null;
  const f = o.fallback;
  const t = o.test;
  const overall = !t ? "" : t.parts.length ? t.parts.map(p => `${p.title}: ${p.value}`).join(", ") : t.percent != null ? `${String(t.percent).replace(".", ",")} %` : "";
  return {
    date: a?.createdAt ?? null,
    responsible: c?.responsible || a?.createdByName || "",
    child: { name: a?.child.name || f?.name || "", birthDate: a?.child.birthDate || f?.birthDate || "", grade: a?.child.grade || f?.grade || "", school: a?.child.school || f?.school || "" },
    refNo: a?.refNo ?? null,
    program: answerOf(o.parentForm, "program"),
    grades3: answerOf(o.parentForm, "grades3"),
    grades3Subjects: answerOf(o.parentForm, "grades3_subjects"),
    studentPhone: answerOf(o.parentForm, "student_phone") || t?.studentPhone || f?.studentPhone || "",
    parentName: a?.parent.name || f?.parentName || "",
    parentPhone: a?.parent.phone || f?.parentPhone || "",
    whySchool: answerOf(o.parentForm, "why_school"),
    source: answerOf(o.parentForm, "source"),
    stages: { consult: !!a && Object.values(a.stages).some(s => s.status === "done"), tested: !!t, feedback: !!c?.feedbackGiven },
    subjects: (t?.sections || []).map(s => { const lv = subjectLevel(s, t!.parts, t!.levels); return { title: s.title, percent: s.percent, band: lv.band, own: lv.own }; }),
    overall,
    conclusion: c?.conclusion || "",
    feedback: c?.feedback || (t ? topicFeedback(t.topics) : ""),
    decision: c?.decision || null,
    trialFrom: c?.trialFrom || "", trialTo: c?.trialTo || "", klass: c?.klass || "", reviewDate: c?.reviewDate || "",
    parentNotified: c?.parentNotified ?? null, nextContact: c?.nextContact || "", decisionBy: c?.decision ? c.by : "",
    qrUrl: a?.tokens.referral ? linkUrl(a.tokens.referral) : null,
  };
}

export async function saveCandidate(org: PrintOrg, doc: CandidateDoc): Promise<void> {
  const name = `Анкета кандидата — ${doc.child.name || "ученик"}${doc.refNo ? ` — № ${String(doc.refNo).padStart(4, "0")}` : ""}.pdf`.replace(/[\\/:*?"<>|]/g, " ");
  await downloadPdf(await candidateSheet(org, doc), name);
}
