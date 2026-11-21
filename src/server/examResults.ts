import admin from "firebase-admin";
import { appUrl, sendTemplated, type SendResult } from "./emailEvents.js";
import { buildView } from "./resultPages.js";
import { DECISION_LABEL, sanitizeSettings, type Attempt, type Exam } from "../shared/examRun.js";
import type { ResultData, ResultPageView } from "../shared/resultPages.js";

/**
 * Страница результатов обычного (не вступительного) экзамена:
 * когда она доступна, как собирается и письмо «Результаты готовы» со ссылкой.
 */
const db = () => admin.firestore();
const col = (t: string, name: string) => db().collection("tenants").doc(t).collection(name);

type Att = Pick<Attempt, "status" | "published" | "superseded" | "applicantId">;

/** Результат ученику доступен по правилам экзамена (показ сразу или после публикации). */
export function examResultOpen(exam: Exam, a: Att): boolean {
  if (a.status !== "finished" || a.applicantId) return false;
  const mode = sanitizeSettings(exam.settings).results.showToStudent;
  return mode === "immediately" || (mode === "after_publish" && !!a.published);
}

/** Экзамен отдаёт результаты страницей и страница выбрана. */
export const examUsesPage = (exam: Exam): boolean => {
  const rs = sanitizeSettings(exam.settings).results;
  return rs.delivery === "page" && !!rs.pageId;
};

/** Когда уходит письмо: при публикации (по умолчанию) или вручную. */
export const examSendsOnPublish = (exam: Exam): boolean => sanitizeSettings(exam.settings).results.sendOn === "publish";

/** Ссылка ученика на страницу результата — по токену работы, без ввода фамилии. */
export async function examResultLink(exam: Exam, token: string): Promise<string> {
  return exam.code && token ? `${await appUrl()}/exam/${exam.code}/result?k=${encodeURIComponent(token)}` : "";
}

const nf = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

/** Вариант страницы по решению (иначе «по умолчанию»), переменные подставлены, ссылки на файлы подписаны. */
export async function examResultView(t: string, exam: Exam, a: Attempt, orgName: string): Promise<ResultPageView | null> {
  const rs = sanitizeSettings(exam.settings).results;
  if (rs.delivery !== "page" || !rs.pageId || !a.result) return null;
  const r = a.result;
  const decision = rs.decisions && a.decision ? a.decision : null;
  const feedback = decision?.comment || "";
  const subjects = r.sections.map(s => ({ title: s.title, percent: s.percent, level: "" }));
  const data: ResultData = { child: a.student.name, examTitle: exam.title, subjects, feedback, trial: null };
  const date = new Date(a.finishedAt || Date.now()).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const vars: Record<string, string> = {
    имя: a.student.name, ребёнок: a.student.name, экзамен: exam.title, балл: `${nf(r.earned)} / ${nf(r.max)}`, процент: `${nf(r.percent)}%`,
    номер: a.shortId, решение: decision ? DECISION_LABEL[decision.value] : "", организация: orgName, дата: date,
    обратная_связь: feedback, класс: "", класс_зачисления: "", пробный_с: "", пробный_по: "",
  };
  try { return await buildView(t, rs.pageId, decision?.value || "", vars, data); } catch (e: any) { console.error("[exam-page]", e?.message || e); return null; }
}

/** Письмо «Результаты готовы» на почту из регистрации работы со ссылкой на страницу. */
export async function emailExamResultsReady(t: string, exam: Exam, a: Attempt & { token?: string }, o: { force?: boolean; by?: string } = {}): Promise<SendResult> {
  try {
    if (a.applicantId) return { sent: false, skipped: true, reason: "Поступающему результаты отправляет приёмная" };
    if (!examUsesPage(exam)) return { sent: false, skipped: true, reason: "Экзамен отдаёт результаты не страницей" };
    if (!examResultOpen(exam, a)) return { sent: false, reason: "Результаты ещё не открыты ученику" };
    const to = String(a.student?.email || "");
    if (!to && !o.force) return { sent: false, skipped: true, reason: "Почту у ученика не спрашивали" };
    const rs = sanitizeSettings(exam.settings).results;
    const r = a.result;
    const vars: Record<string, string> = {
      имя: a.student.name, ребёнок: a.student.name, экзамен: exam.title, номер: a.shortId,
      ссылка: await examResultLink(exam, String(a.token || "")),
      ...(r ? { балл: `${nf(r.earned)} / ${nf(r.max)}`, процент: `${nf(r.percent)}%` } : {}),
    };
    return await sendTemplated({
      tenantId: t, templateId: rs.readyEmail || "", to, vars, event: "results_ready", refId: `${t}_${a.id}`, force: o.force, by: o.by,
      ctx: { attemptId: a.id, examId: exam.id, label: `${a.student.name} · ${exam.title}` },
      actionUrl: `/workspace/${t}/exams/${exam.id}`, noRecipient: "Нет почты ученика",
      mirror: { ref: col(t, "exam_attempts").doc(a.id), field: "resultsEmail" },
    });
  } catch (e) { console.error("[exam] results-ready email", e); return { sent: false, reason: "Не удалось отправить" }; }
}

/** Повторная отправка из журнала писем: работа по ctx.attemptId. */
export async function resendExamResultsReady(t: string, attemptId: string, by: string): Promise<SendResult> {
  const s = await col(t, "exam_attempts").doc(attemptId).get();
  const x = s.data();
  if (!x) return { sent: false, reason: "Нет работы" };
  const es = await col(t, "exams").doc(String(x.examId)).get();
  if (!es.exists) return { sent: false, reason: "Экзамен удалён" };
  return emailExamResultsReady(t, { ...(es.data() as Exam), id: es.id }, { ...(x as Attempt), id: s.id }, { force: true, by });
}
