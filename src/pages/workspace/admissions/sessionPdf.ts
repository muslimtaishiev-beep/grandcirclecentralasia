import { tenantLogos } from "../../../shared/legal";
import { downloadPdf, pdfName, sessionSheet, type PrintChild, type PrintOrg } from "../../../lib/admissionPrint";
import { gradeOf, type QAnswers, type QTemplate } from "../../../shared/questionnaires";
import type { Applicant } from "../../../shared/admissions";
import type { Api } from "./admissionApi";

/**
 * Заполненный бланк сессии файлом PDF — для администрации и самого
 * специалиста. Содержимое приходит с сервера только тем, кому анкета видна
 * целиком (full), и каждый такой просмотр пишется в журнал карточки.
 */
export interface SessionForm {
  templateId: string; status: "draft" | "done"; full: boolean; template: QTemplate;
  answers?: QAnswers; outcome: string | null; filledBy?: { name: string }; doneAt?: number | null;
}

export const orgOf = (tenant: any): PrintOrg => ({ name: String(tenant?.name || ""), logoUrl: tenantLogos(tenant).logoUrl });
export const childOf = (a: Applicant): PrintChild => ({ refNo: a.refNo, name: a.child.name, grade: a.child.grade, birthDate: a.child.birthDate });

/** Завершённые анкеты специалистов, видимые этому сотруднику целиком. */
export const sessionsOf = (forms: SessionForm[]) => forms.filter(f => f.full && f.status === "done" && f.template.audience === "staff");

export async function saveSessions(org: PrintOrg, a: Applicant, forms: SessionForm[]): Promise<void> {
  if (!forms.length) throw new Error("Бланк сессии ещё не готов или недоступен вам");
  const c = childOf(a);
  const g = gradeOf(a.child.grade);
  const sheets = await Promise.all(forms.map(f => sessionSheet(org, c, {
    cardToken: a.tokens.card, template: f.template, grade: g, answers: f.answers || {}, outcome: f.outcome,
    byName: f.filledBy?.name || "", at: f.doneAt ?? null,
  })));
  await downloadPdf(sheets.join(""), pdfName(forms.length === 1 ? forms[0].template.title : "Бланки сессий", c));
}

/** Из списка: одна кнопка — карточка подгружается и бланк скачивается. */
export async function downloadSessionById(api: Api, tenant: any, id: string): Promise<void> {
  const d = await api(`/applicants/${id}`);
  await saveSessions(orgOf(tenant), d.applicant as Applicant, sessionsOf(d.forms as SessionForm[]));
}
