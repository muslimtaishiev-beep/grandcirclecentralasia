import type { CandidateFormConfig } from "./candidateForm.js";
import { isGroup, type CondNode, type When } from "./conditions.js";
import { itemVisible, sectionVisible, visibleItemIds, type QAnswer, type QAnswers, type QBind, type QItem, type QTemplate } from "./questionnaires.js";

/**
 * «Сведения об ученике» — одни на всех. Карточка поступающего, анкета
 * родителя, вопросы ученику перед тестом и анкета кандидата читают и пишут
 * одно и то же:
 *  - поля карточки (ФИО, дата рождения, школа, телефоны, почты) живут в карточке;
 *  - ответы на вопросы анкеты родителя — в анкете родителя, а пока её нет —
 *    в карточке (intake): их даёт ученик перед тестом.
 * Какие вопросы задать ученику, решает анкета кандидата организации: всё, что
 * в ней есть и ещё не заполнено. В коде нет ни одного вопроса.
 */

type Slot = ["child" | "parent", string];
/** Источник поля анкеты кандидата → поле карточки. */
export const SOURCE_SLOT: Record<string, Slot> = {
  "child.name": ["child", "name"], "child.birthDate": ["child", "birthDate"], "child.grade": ["child", "grade"], "child.school": ["child", "school"],
  "student.phone": ["child", "phone"], "student.email": ["child", "email"],
  "parent.name": ["parent", "name"], "parent.phone": ["parent", "phone"],
};

export interface CardLike {
  child?: Record<string, unknown> | null;
  parent?: Record<string, unknown> | null;
  intake?: QAnswers | null;
}

/** Значение поля карточки по связи «child.school». */
export const cardValue = (a: CardLike | null | undefined, bind: string): string => {
  const [k, f] = bind.split(".") as Slot;
  return String((a?.[k] as any)?.[f] ?? "").trim();
};

export const answered = (x?: QAnswer | null): boolean => (Array.isArray(x?.value) ? x!.value.length > 0 : !!String(x?.value ?? "").trim());

/**
 * Ответы на пункты анкеты родителя из всех источников: сам родитель → ученик
 * перед тестом → карточка (для пунктов, привязанных к её полям).
 */
export function profileAnswers(a: CardLike | null | undefined, tpl: Pick<QTemplate, "sections"> | null | undefined, parent?: QAnswers | null): QAnswers {
  const out: QAnswers = {};
  for (const i of tpl?.sections.flatMap(s => s.items) || []) {
    const p = parent?.[i.id]; const s = a?.intake?.[i.id];
    if (answered(p)) out[i.id] = p!;
    else if (answered(s)) out[i.id] = s!;
    else if (i.bind && cardValue(a, i.bind)) out[i.id] = { value: cardValue(a, i.bind) };
  }
  return out;
}

const refsOf = (w: When | undefined): string[] => {
  const out: string[] = [];
  const walk = (n: CondNode) => { if (isGroup(n)) n.items.forEach(walk); else if (n.field.startsWith("q:")) out.push(n.field.slice(2)); };
  if (w) walk(w);
  return out;
};

export const INTAKE_ID = "intake";

/**
 * Вопросы ученику перед тестом: поля анкеты кандидата, которые ещё пусты.
 * По направлению card — карточка (спрашивается только недостающее); без
 * карточки — всё, кроме того, что уже спрашивает регистрация (skip).
 * null — спрашивать нечего.
 */
export function intakeTemplate(o: {
  form: CandidateFormConfig;
  parentTpl: QTemplate | null;
  grade: number | null;
  card?: CardLike | null;
  parentAnswers?: QAnswers | null;
  skip?: QBind[];
}): QTemplate | null {
  const g = o.grade; const card = o.card || null;
  const have = profileAnswers(card, o.parentTpl, o.parentAnswers);
  const vis = o.parentTpl ? visibleItemIds(o.parentTpl, g, { answers: have }) : new Set<string>();
  const where = new Map<string, { item: QItem; when: string[]; ok: boolean }>();
  for (const s of o.parentTpl?.sections || []) for (const i of s.items) {
    where.set(i.id, { item: i, when: [...refsOf(s.when), ...refsOf(i.when)], ok: sectionVisible(s, g) && itemVisible(i, g) });
  }
  const skip = new Set<string>(o.skip || []);
  const taken = new Set<string>();
  const known = (bind: string) => skip.has(bind) || taken.has(bind) || !!cardValue(card, bind);
  const items: QItem[] = [];
  for (const f of o.form.fields) {
    if (f.grades?.length && (g === null || !f.grades.includes(g))) continue;
    if (f.source.startsWith("answer:")) {
      const w = where.get(f.source.slice(7));
      if (!w || !w.ok || w.item.kind === "rating" || w.item.kind === "note" || items.some(x => x.id === w.item.id)) continue;
      const i = w.item;
      if (i.bind) { if (known(i.bind)) continue; }
      else if (answered(have[i.id])) continue;
      // Условие пункта: всё, от чего оно зависит, уже отвечено — считаем сразу; спрашивается здесь же — оставляем.
      let when: When | undefined;
      if (w.when.length) {
        if (w.when.every(id => answered(have[id]))) { if (!vis.has(i.id)) continue; }
        else if (w.when.every(id => items.some(x => x.id === id))) when = i.when;
      }
      if (i.bind) taken.add(i.bind);
      const { when: _w, showParent: _s, materials: _m, prompts: _p, norms: _n, measures: _ms, ...rest } = i;
      items.push({ ...rest, ...(when ? { when } : {}) });
    } else {
      const slot = SOURCE_SLOT[f.source];
      if (!slot || f.source === "child.name" || f.source === "child.grade") continue;
      const bind = slot.join(".") as QBind;
      if (known(bind)) continue;
      taken.add(bind);
      items.push({
        id: `c_${slot[0]}_${slot[1]}`, label: f.label, bind,
        kind: bind === "child.birthDate" ? "date" : bind.endsWith(".phone") ? "phone" : "text",
        ...(bind === "child.phone" || bind === "child.email" ? {} : { required: true }),
      });
    }
  }
  // Почта ученика: письмо о результатах уходит и родителю, и ему.
  if (!known("child.email")) items.push({ id: "c_child_email", kind: "text", label: "Почта ученика", bind: "child.email" });
  if (!items.length) return null;
  return {
    id: INTAKE_ID, title: "", description: "", audience: "parent", fillPermission: null, viewPermission: null, sensitive: false,
    sections: [{ id: INTAKE_ID, title: "Сведения об ученике", items }], outcome: null, attachments: [], version: 0,
  };
}

/** Ответы ученика: что идёт в поля карточки, а что — в ответы на вопросы анкеты. */
export function splitIntake(tpl: Pick<QTemplate, "sections">, answers: QAnswers): { free: QAnswers } {
  const free: QAnswers = {};
  for (const i of tpl.sections.flatMap(s => s.items)) if (!i.bind && answered(answers[i.id])) free[i.id] = answers[i.id];
  return { free };
}
