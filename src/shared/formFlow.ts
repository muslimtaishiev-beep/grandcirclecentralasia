/**
 * Этапы заявки — что делают организаторы после смены состояния.
 *
 * Этап идёт после состояния формы («Одобрено») или после другого этапа и
 * может иметь своё условие (общий движок «показывать, если…»). У заявки,
 * где этап сейчас виден, организаторы отмечают кнопки-отметки («Первый
 * форум»), пишут комментарий и нажимают «Опубликовать» — уходит письмо по
 * шаблону этапа. Опубликованный этап открывает следующие за ним.
 *
 * Хранится в форме (custom_forms.flow, пишет только сервер); состояние по
 * заявке — form_submissions.flow[stepId]. Общий модуль сервера и кабинета.
 */
import { evalWhen, sanitizeWhen, UNKNOWN, type CondField, type CondValue, type When } from "./conditions.js";
import { decisionOf, resolveDecisions } from "./formDecisions.js";

export interface FlowMark { id: string; label: string }
export type FlowAfter = { kind: "status"; id: string } | { kind: "step"; id: string };

export interface FlowStep {
  id: string;
  title: string;
  /** Откуда стрелка: состояние формы или этап. */
  after: FlowAfter;
  /** Дополнительное условие ветки. */
  when?: When;
  /** Кнопки-отметки: можно выбрать несколько. */
  marks: FlowMark[];
  /** Сколько отметок нужно, чтобы опубликовать (0 — можно и без отметок). */
  minMarks: number;
  /** Поле «комментарий организаторов». */
  comment: boolean;
  /** Письмо при публикации (шаблон вида «Заявка» или «Любое»); пусто — без письма. */
  emailTemplateId?: string;
}

export interface FormFlow { steps: FlowStep[] }

export interface StepState {
  marks: string[];
  comment: string;
  published: { at: number; by: string; byName: string } | null;
  /** Публикация по таймеру. */
  publishAt?: number | null;
  by: string;
  byName: string;
  at: number;
  /** Статус письма (пишет отправка). */
  email?: { status: string; reason?: string; at: number; to?: string };
}

export const MAX_STEPS = 30;
export const MAX_MARKS = 12;
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const REF = /^[A-Za-z0-9_-]{4,64}$/;
export const STEP_ID = ID;
const line = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Поле формы (то, что нужно этапам). */
interface FieldLike { id: string; label?: string; type?: string; options?: string[] }
const fieldsOf = (form: any): FieldLike[] => (Array.isArray(form?.fields) ? form.fields : []).filter((f: any) => f && typeof f.id === "string" && f.type !== "section");

/** Вариант ответа в условии — по номеру: подписи бывают длинными и с любыми знаками. */
const optId = (i: number) => `o${i}`;

/**
 * Каталог полей для условия этапа: состояние, ответы формы, отметки и
 * публикация этапов выше по ветке (before — этап, для которого условие).
 */
export function flowFields(form: any, steps: FlowStep[], before?: string): CondField[] {
  const out: CondField[] = [
    { id: "status", label: "Состояние заявки", kind: "choice", options: resolveDecisions(form).map(d => ({ id: d.id, label: d.label })) },
  ];
  for (const f of fieldsOf(form)) {
    const label = line(f.label, 80) || f.id;
    const opts = (f.options || []).map((o, i) => ({ id: optId(i), label: line(o, 80) }));
    if ((f.type === "select" || f.type === "radio") && opts.length) out.push({ id: `a:${f.id}`, label, kind: "choice", options: opts, group: "Ответы" });
    else if (f.type === "multi" && opts.length) out.push({ id: `a:${f.id}`, label, kind: "multi", options: opts, group: "Ответы" });
    else if (f.type === "number") out.push({ id: `a:${f.id}`, label, kind: "number", group: "Ответы" });
    else if (f.type === "date") out.push({ id: `a:${f.id}`, label, kind: "date", group: "Ответы" });
    else if (f.type !== "file" && f.type !== "checkbox") out.push({ id: `a:${f.id}`, label, kind: "text", group: "Ответы" });
  }
  for (const s of before ? ancestors(steps, before) : steps) {
    if (s.marks.length) out.push({ id: `m:${s.id}`, label: `Отметки: ${s.title}`, kind: "multi", options: s.marks.map(m => ({ id: m.id, label: m.label })), group: "Этапы" });
    out.push({ id: `p:${s.id}`, label: `Опубликован: ${s.title}`, kind: "choice", options: [{ id: "yes", label: "Да" }, { id: "no", label: "Нет" }], group: "Этапы" });
  }
  return out;
}

/** Этапы выше по ветке (родитель, его родитель…). */
export function ancestors(steps: FlowStep[], id: string): FlowStep[] {
  const byId = new Map(steps.map(s => [s.id, s]));
  const out: FlowStep[] = [];
  let cur = byId.get(id);
  const seen = new Set<string>();
  while (cur && cur.after.kind === "step" && !seen.has(cur.id)) {
    seen.add(cur.id);
    const p = byId.get(cur.after.id);
    if (!p) break;
    out.push(p); cur = p;
  }
  return out;
}

/** Только известные поля, после — существующее, без циклов, условия — по каталогу этапа. */
export function sanitizeFlow(raw: unknown, form: any): FormFlow {
  const list = Array.isArray((raw as any)?.steps) ? (raw as any).steps : [];
  const statusIds = new Set(resolveDecisions(form).map(d => d.id));
  const seen = new Set<string>();
  const steps: FlowStep[] = [];
  for (const r of list.slice(0, MAX_STEPS)) {
    const id = String(r?.id ?? "");
    if (!ID.test(id) || seen.has(id)) continue;
    seen.add(id);
    const ms = new Set<string>();
    const marks = (Array.isArray(r?.marks) ? r.marks : []).slice(0, MAX_MARKS)
      .map((m: any, i: number) => ({ id: ID.test(String(m?.id)) ? String(m.id) : `m${i + 1}`, label: line(m?.label, 60) }))
      .filter((m: FlowMark) => m.label && !ms.has(m.id) && (ms.add(m.id), true));
    const kind = r?.after?.kind === "step" ? "step" : "status";
    const n = Math.round(Number(r?.minMarks));
    steps.push({
      id, title: line(r?.title, 60) || "Этап",
      after: { kind, id: String(r?.after?.id ?? "") } as FlowAfter,
      marks,
      minMarks: Number.isFinite(n) ? Math.max(0, Math.min(marks.length, n)) : Math.min(1, marks.length),
      comment: r?.comment === true,
      ...(typeof r?.emailTemplateId === "string" && REF.test(r.emailTemplateId) ? { emailTemplateId: r.emailTemplateId } : {}),
      ...(r?.when ? { when: r.when } : {}),
    });
  }
  // Каждый этап должен через родителей дойти до существующего состояния: ссылка в пустоту или цикл — этап отбрасывается.
  const byId = new Map(steps.map(x => [x.id, x]));
  const rooted = (s: FlowStep): boolean => {
    const up = new Set<string>();
    let cur: FlowStep | undefined = s;
    while (cur && cur.after.kind === "step") {
      if (up.has(cur.id)) return false;
      up.add(cur.id); cur = byId.get(cur.after.id);
    }
    return !!cur && statusIds.has(cur.after.id);
  };
  const alive = steps.filter(rooted);
  return {
    steps: alive.map(s => {
      const w = s.when ? sanitizeWhen(s.when, flowFields(form, alive, s.id)) : undefined;
      const { when: _w, ...rest } = s;
      return w ? { ...rest, when: w } : rest;
    }),
  };
}

export const resolveFlow = (form: any): FormFlow => sanitizeFlow(form?.flow, form);

/** Значение поля условия у заявки. */
export function flowGetter(form: any, sub: any, steps: FlowStep[]): (field: string) => CondValue {
  const fields = new Map(fieldsOf(form).map(f => [f.id, f]));
  const state = (sub?.flow || {}) as Record<string, StepState>;
  return (f: string) => {
    if (f === "status") return String(sub?.status || "new");
    if (f.startsWith("a:")) {
      const def = fields.get(f.slice(2));
      const v = sub?.data?.[f.slice(2)];
      if (!def) return UNKNOWN;
      const opts = def.options || [];
      const toId = (x: unknown) => { const i = opts.indexOf(String(x)); return i >= 0 ? optId(i) : String(x); };
      if (def.type === "multi") return (Array.isArray(v) ? v : v ? [v] : []).map(toId);
      if (def.type === "select" || def.type === "radio") return v === undefined || v === null || v === "" ? undefined : toId(v);
      return Array.isArray(v) ? v.join(", ") : (v as any);
    }
    if (f.startsWith("m:")) return state[f.slice(2)]?.marks || [];
    if (f.startsWith("p:")) return state[f.slice(2)]?.published ? "yes" : "no";
    void steps;
    return UNKNOWN;
  };
}

/** Виден ли этап у заявки: родитель выполнен и условие верно. */
export function stepActive(form: any, sub: any, steps: FlowStep[], step: FlowStep): boolean {
  const state = (sub?.flow || {}) as Record<string, StepState>;
  if (step.after.kind === "status") {
    if (String(sub?.status || "new") !== step.after.id) return false;
  } else {
    const parent = steps.find(s => s.id === step.after.id);
    if (!parent || !state[parent.id]?.published || !stepActive(form, sub, steps, parent)) return false;
  }
  return evalWhen(step.when, flowGetter(form, sub, steps));
}

/** Этапы, которые сейчас видны у заявки (в порядке ветки). */
export function activeSteps(form: any, sub: any, flow: FormFlow = resolveFlow(form)): FlowStep[] {
  return flow.steps.filter(s => stepActive(form, sub, flow.steps, s));
}

export const canPublish = (step: FlowStep, st: Pick<StepState, "marks"> | null | undefined) => (st?.marks?.length || 0) >= step.minMarks;

/** Подписи выбранных отметок по порядку этапа. */
export const markLabels = (step: FlowStep, st: Pick<StepState, "marks"> | null | undefined) =>
  step.marks.filter(m => (st?.marks || []).includes(m.id)).map(m => m.label);

/** Подпись «после чего» для конструктора и истории. */
export function afterLabel(form: any, steps: FlowStep[], a: FlowAfter): string {
  if (a.kind === "status") return decisionOf(resolveDecisions(form), a.id).label;
  return steps.find(s => s.id === a.id)?.title || "этап";
}

export const flowJobKey = (submissionId: string, stepId: string) => `form_flow:${submissionId}:${stepId}`;
