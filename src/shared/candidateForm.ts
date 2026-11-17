/**
 * Вид «Анкеты кандидата» — у каждой организации свой, хранится в её базе
 * (admission_meta/candidate_form) и правится во вкладке «Анкеты». В коде —
 * только нейтральная форма для тех, кто ещё ничего не настроил.
 *
 * Поля раздела «Сведения об ученике» берутся из источников: карточка
 * поступающего, анкета родителя (ответ на любой её вопрос), регистрация на
 * тест. Варианты решения, слова уровней и пороги — тоже настройки.
 */

/** Откуда поле анкеты берёт значение. */
export type CandidateSource =
  | "date" | "responsible"
  | "child.name" | "child.birthDate" | "child.grade" | "child.school"
  | "parent.name" | "parent.phone" | "student.phone"
  | `answer:${string}`;

export const CARD_SOURCES: { id: CandidateSource; label: string }[] = [
  { id: "date", label: "Дата обращения" },
  { id: "responsible", label: "Ответственный" },
  { id: "child.name", label: "ФИО ученика" },
  { id: "child.birthDate", label: "Дата рождения" },
  { id: "child.grade", label: "Класс поступления" },
  { id: "child.school", label: "Школа" },
  { id: "parent.name", label: "ФИО родителя" },
  { id: "parent.phone", label: "Телефон родителя" },
  { id: "student.phone", label: "Телефон ученика (из регистрации на тест)" },
];

export interface CandidateField {
  id: string;
  label: string;
  source: CandidateSource;
  /** Только для этих классов (пусто — для всех). */
  grades?: number[];
  /** Полстроки — два поля рядом, как на бланке. */
  half?: boolean;
}

export interface CandidateDecisionOption {
  id: string;
  label: string;
  /** Решение принято (этап «решение принято»); иначе — ещё рассматривается. */
  final: boolean;
  /** С этим решением спрашиваются даты пробного периода. */
  trial?: boolean;
}

export interface CandidateFormConfig {
  title: string;
  /** Строка над заголовком; пусто — название организации. */
  orgLine: string;
  fields: CandidateField[];
  /** Раздел «Этапы поступления»: консультация, тестирование, обратная связь. */
  showStages: boolean;
  /** Фото ребёнка (снято перед тестом или при вводе бумажного теста). */
  showPhoto: boolean;
  /** Слова уровня по предмету: ниже «среднего», от «среднего», от «высокого» порога экзамена. */
  levels: [string, string, string];
  feedbackHint: string;
  /** Сильные стороны — темы от strong %, зона роста — ниже weak %. */
  topics: { strong: number; weak: number };
  decisions: CandidateDecisionOption[];
  extras: { klass: boolean; reviewDate: boolean; parentNotified: boolean; nextContact: boolean };
  note: string;
  version: number;
  updatedBy?: string;
  updatedAt?: number;
}

export const NEUTRAL_CANDIDATE_FORM: CandidateFormConfig = {
  title: "Анкета кандидата на поступление",
  orgLine: "",
  fields: [
    { id: "f_date", label: "Дата обращения", source: "date", half: true },
    { id: "f_resp", label: "Ответственный", source: "responsible", half: true },
    { id: "f_name", label: "ФИО ученика", source: "child.name" },
    { id: "f_birth", label: "Дата рождения", source: "child.birthDate", half: true },
    { id: "f_grade", label: "Класс поступления", source: "child.grade", half: true },
    { id: "f_school", label: "Школа", source: "child.school" },
    { id: "f_pname", label: "ФИО родителя", source: "parent.name", half: true },
    { id: "f_pphone", label: "Телефон родителя", source: "parent.phone", half: true },
  ],
  showStages: true,
  showPhoto: true,
  levels: ["Низкий", "Средний", "Высокий"],
  feedbackHint: "Сильные и слабые стороны, рекомендации",
  topics: { strong: 80, weak: 60 },
  decisions: [
    { id: "enroll", label: "Зачислить", final: true },
    { id: "rejected", label: "Отказ", final: true },
    { id: "pending", label: "На рассмотрении", final: false },
  ],
  extras: { klass: true, reviewDate: false, parentNotified: false, nextContact: false },
  note: "",
  version: 0,
};

const str = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const num = (v: unknown, def: number) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : def; };
const isSource = (v: unknown): v is CandidateSource =>
  CARD_SOURCES.some(s => s.id === v) || (typeof v === "string" && /^answer:[A-Za-z0-9_-]{1,40}$/.test(v));

/** Только известные поля и источники; версия растёт с каждой правкой. */
export function sanitizeCandidateForm(raw: any, prev?: CandidateFormConfig | null): CandidateFormConfig {
  const d = NEUTRAL_CANDIDATE_FORM;
  const seen = new Set<string>();
  const fields = (Array.isArray(raw?.fields) ? raw.fields : []).slice(0, 30).map((f: any, i: number) => ({
    id: ID.test(String(f?.id)) ? String(f.id) : `f${i + 1}`,
    label: str(f?.label, 80),
    source: f?.source,
    ...(Array.isArray(f?.grades) && f.grades.length ? { grades: [...new Set<number>(f.grades.map(Number).filter((g: number) => Number.isInteger(g) && g >= 0 && g <= 12))] } : {}),
    ...(f?.half === true ? { half: true } : {}),
  })).filter((f: CandidateField) => f.label && isSource(f.source) && !seen.has(f.id) && (seen.add(f.id), true));
  const dseen = new Set<string>();
  const decisions = (Array.isArray(raw?.decisions) ? raw.decisions : []).slice(0, 8).map((x: any, i: number) => ({
    id: ID.test(String(x?.id)) ? String(x.id) : `d${i + 1}`,
    label: str(x?.label, 60),
    final: x?.final === true,
    ...(x?.trial === true ? { trial: true } : {}),
  })).filter((x: CandidateDecisionOption) => x.label && !dseen.has(x.id) && (dseen.add(x.id), true));
  const lv = Array.isArray(raw?.levels) ? raw.levels : [];
  const weak = num(raw?.topics?.weak, d.topics.weak);
  return {
    title: str(raw?.title, 120) || d.title,
    orgLine: str(raw?.orgLine, 160),
    fields: fields.length ? fields : d.fields,
    showStages: typeof raw?.showStages === "boolean" ? raw.showStages : d.showStages,
    showPhoto: typeof raw?.showPhoto === "boolean" ? raw.showPhoto : d.showPhoto,
    levels: [0, 1, 2].map(i => str(lv[i], 30) || d.levels[i]) as [string, string, string],
    feedbackHint: str(raw?.feedbackHint, 300),
    topics: { weak, strong: Math.max(weak, num(raw?.topics?.strong, d.topics.strong)) },
    decisions: decisions.length ? decisions : d.decisions,
    extras: {
      klass: raw?.extras?.klass === true, reviewDate: raw?.extras?.reviewDate === true,
      parentNotified: raw?.extras?.parentNotified === true, nextContact: raw?.extras?.nextContact === true,
    },
    note: str(raw?.note, 400),
    version: (prev?.version || 0) + 1,
  };
}
