import { candidateOf, subjectLevel, type Applicant } from "../../../shared/admissions";
import { NEUTRAL_CANDIDATE_FORM, type CandidateFormConfig } from "../../../shared/candidateForm";
import { partResults, type Attempt, type Exam } from "../../../shared/examRun";
import { answerText, gradeOf, visibleItemIds, type QAnswers, type QTemplate } from "../../../shared/questionnaires";
import { SOURCE_SLOT, cardValue } from "../../../shared/candidateIntake";
import { candidateSheet, downloadPdf, linkUrl, type CandidateDoc, type PrintOrg } from "../../../lib/admissionPrint";

/**
 * «Анкета кандидата»: вид — из настроек организации (CandidateFormConfig),
 * данные — из карточки, анкеты родителя и теста; заключение, обратная связь
 * и решение — из того, что вписала администрация. У экзаменов, где она
 * включена, заменяет сертификат и «Отчёт по темам»: сильные стороны и зона
 * роста по темам идут в обратную связь.
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

/** Итоги работы из экзамена — когда карточки поступающего нет или она недоступна. */
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

/** Сильные стороны и зона роста по темам — пороги из анкеты организации. */
export function topicFeedback(topics: TestSummary["topics"], th: CandidateFormConfig["topics"] = NEUTRAL_CANDIDATE_FORM.topics): string {
  const f = (xs: TestSummary["topics"]) => xs.slice(0, 6).map(t => `${t.topic} (${Math.round(t.percent)}%)`).join(", ");
  const strong = topics.filter(t => t.percent >= th.strong).sort((a, b) => b.percent - a.percent);
  const weak = topics.filter(t => t.percent < th.weak).sort((a, b) => a.percent - b.percent);
  return [strong.length ? `Сильные стороны: ${f(strong)}.` : "", weak.length ? `Зона роста: ${f(weak)}.` : ""].filter(Boolean).join("\n");
}

/** Ответы на вопросы анкеты родителя для анкеты кандидата — сервер собирает их из всех источников (sheet). */
export type ParentForm = { template: Pick<QTemplate, "sections">; answers?: QAnswers } | null | undefined;

/**
 * Поля «Сведений об ученике», которые показываются этому ребёнку: по классу
 * и по анкете родителя — вопрос, скрытый условием, не попадает и сюда.
 */
function visibleFields(cfg: CandidateFormConfig, g: number | null, pf: ParentForm) {
  const items = pf?.template.sections.flatMap(s => s.items) || [];
  const shown = pf ? visibleItemIds(pf.template, g, pf.answers && Object.keys(pf.answers).length ? { answers: pf.answers } : {}) : new Set<string>();
  return cfg.fields
    .filter(x => !x.grades?.length || (g !== null && x.grades.includes(g)))
    .filter(x => !x.source.startsWith("answer:") || shown.has(x.source.slice(7)) || !items.length);
}

/** Поле анкеты для правки: откуда, что сейчас стоит, какие варианты. */
export interface SheetField {
  id: string; label: string; source: string; half?: boolean;
  /** card — значение живёт в карточке (правка меняет карточку); иначе — правка поверх анкеты. */
  card: boolean;
  kind: "text" | "date" | "choice" | "multi";
  overridden: boolean;
  value: string;
  options: { id: string; label: string; on: boolean }[];
}

/** Все заполняемые поля «Сведений об ученике» — из настроек анкеты организации, для любых будущих полей. */
export function sheetFields(o: { form: CandidateFormConfig; applicant: Applicant; parentForm?: ParentForm; test: TestSummary | null }): SheetField[] {
  const a = o.applicant;
  const items = o.parentForm?.template.sections.flatMap(s => s.items) || [];
  const doc = candidateDoc({ form: o.form, orgName: "", applicant: a, parentForm: o.parentForm, test: o.test });
  const over = candidateOf(a)?.overrides || {};
  return visibleFields(o.form, gradeOf(a.child.grade), o.parentForm).map((f, i) => {
    const shown = doc.fields[i];
    const card = !!SOURCE_SLOT[f.source];
    const item = f.source.startsWith("answer:") ? items.find(x => x.id === f.source.slice(7)) : undefined;
    const choice = item && (item.kind === "choice" || item.kind === "multi");
    const raw = card ? cardValue(a, SOURCE_SLOT[f.source].join(".")) || (f.source === "student.phone" ? o.test?.studentPhone || "" : "") : shown?.value || "";
    return {
      id: f.id, label: f.label, source: f.source, half: f.half, card,
      kind: f.source === "child.birthDate" ? "date" : choice ? (item!.kind as "choice" | "multi") : "text",
      overridden: over[f.id] !== undefined,
      value: raw,
      options: choice ? (item!.options || []).map((x, k) => ({ id: x.id, label: x.label, on: !!shown?.options?.[k]?.on })) : [],
    };
  });
}
const ru = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v).toLocaleDateString("ru-RU") : v);

export function candidateDoc(o: {
  form: CandidateFormConfig;
  orgName: string;
  applicant?: Applicant | null;
  parentForm?: ParentForm;
  test: TestSummary | null;
  photo?: string | null;
  /** Без карточки (работа без направления) — данные из регистрации на тест. */
  fallback?: { name: string; birthDate: string; grade: string; school: string; parentName: string; parentPhone: string; studentPhone: string };
}): CandidateDoc {
  const { form: cfg, test: t, fallback: f } = o;
  const a = o.applicant || null;
  const c = a ? candidateOf(a) : null;
  const grade = a?.child.grade || f?.grade || "";
  const g = gradeOf(grade);
  const items = o.parentForm?.template.sections.flatMap(s => s.items) || [];
  const value = (src: string): Pick<CandidateDoc["fields"][number], "value" | "options"> => {
    if (src.startsWith("answer:")) {
      const item = items.find(i => i.id === src.slice(7));
      if (!item) return { value: "" };
      const ans = o.parentForm?.answers?.[item.id];
      if (item.kind === "choice" || item.kind === "multi") {
        const picked = item.kind === "multi" ? (Array.isArray(ans?.value) ? ans!.value : []) : [ans?.value];
        return { value: "", options: (item.options || []).map(x => ({ label: x.label, on: picked.includes(x.id) })) };
      }
      return { value: ru(answerText(item, ans)) };
    }
    switch (src) {
      case "date": return { value: a?.createdAt ? new Date(a.createdAt).toLocaleDateString("ru-RU") : "" };
      case "responsible": return { value: c?.responsible || a?.createdByName || "" };
      case "child.name": return { value: a?.child.name || f?.name || "" };
      case "child.birthDate": return { value: ru(a?.child.birthDate || f?.birthDate || "") };
      case "child.grade": return { value: grade ? (/^\d+$/.test(grade.trim()) ? `${grade.trim()} класс` : grade) : "" };
      case "child.school": return { value: a?.child.school || f?.school || "" };
      case "parent.name": return { value: a?.parent.name || f?.parentName || "" };
      case "parent.phone": return { value: a?.parent.phone || f?.parentPhone || "" };
      case "student.phone": return { value: a?.child.phone || t?.studentPhone || f?.studentPhone || "" };
      case "student.email": return { value: a?.child.email || "" };
      default: return { value: "" };
    }
  };
  // Правка администрации поверх анкеты родителя и других источников.
  const withOverride = (fid: string, src: string): Pick<CandidateDoc["fields"][number], "value" | "options"> => {
    const o = c?.overrides?.[fid];
    if (o === undefined) return value(src);
    if (Array.isArray(o)) {
      const item = src.startsWith("answer:") ? items.find(i => i.id === src.slice(7)) : undefined;
      return { value: "", options: (item?.options || []).map(x => ({ label: x.label, on: o.includes(x.id) })) };
    }
    return { value: ru(o) };
  };
  const chosen = cfg.decisions.find(d => d.id === c?.decision);
  return {
    orgLine: cfg.orgLine || o.orgName,
    title: cfg.title,
    refNo: a?.refNo ?? null,
    qrUrl: a?.tokens.referral ? linkUrl(a.tokens.referral) : null,
    photo: cfg.showPhoto !== false ? o.photo || null : null,
    fields: visibleFields(cfg, g, o.parentForm).map(x => ({ label: x.label, half: x.half, ...withOverride(x.id, x.source) })),
    stages: cfg.showStages ? { consult: !!a && Object.values(a.stages).some(s => s.status === "done"), tested: !!t, feedback: !!c?.feedbackGiven } : null,
    levels: cfg.levels,
    subjects: (t?.sections || []).map(s => { const lv = subjectLevel(s, t!.parts, t!.levels); return { title: s.title, percent: s.percent, band: lv.band, own: lv.own }; }),
    overall: !t ? "" : t.parts.length ? t.parts.map(p => `${p.title}: ${p.value}`).join(", ") : t.percent != null ? `${String(t.percent).replace(".", ",")} %` : "",
    conclusion: c?.conclusion || "",
    feedbackHint: cfg.feedbackHint,
    feedback: c?.feedback || (t ? topicFeedback(t.topics, cfg.topics) : ""),
    decisions: cfg.decisions.map(d => ({ label: d.label, on: d.id === c?.decision })),
    trial: cfg.decisions.some(d => d.trial) ? { from: chosen?.trial ? c?.trialFrom || "" : "", to: chosen?.trial ? c?.trialTo || "" : "" } : null,
    klass: cfg.extras.klass ? c?.klass || "" : null,
    reviewDate: cfg.extras.reviewDate ? c?.reviewDate || "" : null,
    parentNotified: cfg.extras.parentNotified ? (c?.parentNotified ?? null) : undefined,
    nextContact: cfg.extras.nextContact ? c?.nextContact || "" : null,
    decisionBy: c?.decision ? c.by : "",
    note: cfg.note,
  };
}

export async function saveCandidate(org: PrintOrg, doc: CandidateDoc, childName: string): Promise<void> {
  const name = `${doc.title} — ${childName || "ученик"}${doc.refNo ? ` — № ${String(doc.refNo).padStart(4, "0")}` : ""}.pdf`.replace(/[\\/:*?"<>|]/g, " ");
  await downloadPdf(await candidateSheet(org, doc), name);
}
