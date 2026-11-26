/**
 * «Где работает» сотрудник: классы (параллели и литеры), ступени, предметы,
 * свои группы. По этому собирают адресатов («учителям 5-х классов»,
 * «начальной школе», «МО математики»). Общий модуль сервера и кабинета.
 *
 * Ступень выводится из классов, но её можно задать вручную (например,
 * педагог-организатор начальной школы без своих классов).
 * Предметы и группы — подписи; справочник организации подсказывает варианты.
 */

export type SchoolLevel = "primary" | "middle" | "high";

export const SCHOOL_LEVELS: { id: SchoolLevel; label: string; grades: number[] }[] = [
  { id: "primary", label: "Начальная школа", grades: [1, 2, 3, 4] },
  { id: "middle", label: "Средняя школа", grades: [5, 6, 7, 8, 9] },
  { id: "high", label: "Старшая школа", grades: [10, 11] },
];
export const STAFF_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
export const LEVEL_LABEL = Object.fromEntries(SCHOOL_LEVELS.map(l => [l.id, l.label])) as Record<SchoolLevel, string>;

export interface StaffPlacement {
  /** Параллели: 1…11. */
  grades: number[];
  /** Литеры по желанию: «5А», «5Б». Параллель из них попадает в grades. */
  classes: string[];
  /** Ступени, заданные вручную; пусто — по классам. */
  levels: SchoolLevel[];
  subjects: string[];
  groups: string[];
}

export const EMPTY_PLACEMENT: StaffPlacement = { grades: [], classes: [], levels: [], subjects: [], groups: [] };

/** Справочник организации: предметы и свои группы (подсказки при отметке). */
export interface StaffDirectory { subjects: string[]; groups: string[] }

const label = (v: unknown, max = 60) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const uniq = (xs: string[]) => {
  const seen = new Set<string>(); const out: string[] = [];
  for (const x of xs) { const k = x.toLowerCase(); if (x && !seen.has(k)) { seen.add(k); out.push(x); } }
  return out;
};

/** «5 а», «5-А», «5a» → «5А». Не класс — пусто. */
export function normClass(v: unknown): string {
  const m = String(v ?? "").toUpperCase().replace(/[\s\-.]/g, "").replace(/A/g, "А").replace(/B/g, "В").replace(/C/g, "С").replace(/E/g, "Е").match(/^(\d{1,2})([А-ЯЁ]{0,2})$/);
  if (!m) return "";
  const g = Number(m[1]);
  return g >= 1 && g <= 11 ? `${g}${m[2]}` : "";
}
export const gradeOfClass = (c: string) => Number((c.match(/^\d+/) || ["0"])[0]);

export function sanitizePlacement(raw: unknown): StaffPlacement {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const classes = uniq((Array.isArray(r.classes) ? r.classes : []).map(normClass)).slice(0, 40);
  const grades = [...new Set([
    ...(Array.isArray(r.grades) ? r.grades : []).map(Number).filter(g => Number.isInteger(g) && g >= 1 && g <= 11),
    ...classes.map(gradeOfClass),
  ])].sort((a, b) => a - b);
  const ids = new Set(SCHOOL_LEVELS.map(l => l.id));
  const levels = [...new Set((Array.isArray(r.levels) ? r.levels : []).map(String).filter((x): x is SchoolLevel => ids.has(x as SchoolLevel)))];
  return {
    grades, classes, levels,
    subjects: uniq((Array.isArray(r.subjects) ? r.subjects : []).map(x => label(x))).slice(0, 20),
    groups: uniq((Array.isArray(r.groups) ? r.groups : []).map(x => label(x))).slice(0, 30),
  };
}

/** Место работы из документа сотрудника (отсутствующие поля — пусто). */
export const placementOf = (m: any): StaffPlacement => sanitizePlacement({ grades: m?.grades, classes: m?.classes, levels: m?.levels, subjects: m?.subjects, groups: m?.groups });

/** Ступени сотрудника: заданные вручную, иначе — по классам. */
export function levelsOf(p: Pick<StaffPlacement, "grades" | "levels">): SchoolLevel[] {
  if (p.levels?.length) return p.levels;
  return SCHOOL_LEVELS.filter(l => l.grades.some(g => p.grades.includes(g))).map(l => l.id);
}

/** «5А, 5Б, 7» — литеры, а параллели без литер — числом. */
export function classesText(p: Pick<StaffPlacement, "grades" | "classes">): string {
  const withLetters = new Set(p.classes.map(gradeOfClass));
  return [...p.classes, ...p.grades.filter(g => !withLetters.has(g)).map(String)]
    .sort((a, b) => gradeOfClass(a) - gradeOfClass(b) || a.localeCompare(b, "ru")).join(", ");
}

export const isEmptyPlacement = (p: StaffPlacement) => !p.grades.length && !p.levels.length && !p.subjects.length && !p.groups.length;

export function sanitizeDirectory(raw: unknown): StaffDirectory {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    subjects: uniq((Array.isArray(r.subjects) ? r.subjects : []).map(x => label(x))).slice(0, 80),
    groups: uniq((Array.isArray(r.groups) ? r.groups : []).map(x => label(x))).slice(0, 80),
  };
}

/** Новые подписи сотрудника — в справочник организации (чтобы потом выбирать, а не печатать). */
export const mergeDirectory = (d: StaffDirectory, p: Pick<StaffPlacement, "subjects" | "groups">): StaffDirectory =>
  sanitizeDirectory({ subjects: [...d.subjects, ...p.subjects], groups: [...d.groups, ...p.groups] });

/** Массовая правка: добавить или убрать отметки у нескольких сотрудников. */
export function applyBulk(p: StaffPlacement, add: Partial<StaffPlacement>, remove: Partial<StaffPlacement>): StaffPlacement {
  const minus = <T,>(xs: T[], ys?: T[]) => (ys?.length ? xs.filter(x => !ys.map(y => String(y).toLowerCase()).includes(String(x).toLowerCase())) : xs);
  const next = {
    grades: minus([...p.grades, ...(add.grades || [])], remove.grades),
    classes: minus([...p.classes, ...(add.classes || [])], remove.classes),
    levels: minus([...p.levels, ...(add.levels || [])], remove.levels),
    subjects: minus([...p.subjects, ...(add.subjects || [])], remove.subjects),
    groups: minus([...p.groups, ...(add.groups || [])], remove.groups),
  };
  // Убрали параллель — уходят и её литеры.
  if (remove.grades?.length) next.classes = next.classes.filter(c => !remove.grades!.includes(gradeOfClass(c)));
  return sanitizePlacement(next);
}
