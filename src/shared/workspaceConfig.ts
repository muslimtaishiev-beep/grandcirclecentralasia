/**
 * Настройка воркспейса под вид деятельности организации.
 *
 * Разные компании устроены по-разному: у школы — преподаватели и кабинеты,
 * у ивент-агентства — ведущие и площадки, у спортивной секции — тренеры и
 * залы. Экраны, которые называют всё «Академией» и требуют «ID преподавателя»
 * от компании без преподавателей, выглядят для неё чужими.
 *
 * Значения по умолчанию нейтральны. Прежний заголовок «Панель Управления
 * Академией» перенесён в workspaceConfig самой Академии (миграция
 * seedAcademyLegal) — новые организации не называются чужим именем.
 */

export interface WorkspaceTerms {
  /** Кто ведёт занятия: «Преподаватель» / «Тренер» / «Ведущий»… */
  teacher: string;
  /** Где проходят занятия: «Кабинет» / «Зал» / «Площадка»… */
  room: string;
  /** Кого учат/обслуживают: «Ученик» / «Клиент» / «Участник»… */
  student: string;
  /** Как объединяют людей: «Группа» / «Команда» / «Поток»… */
  group: string;
  /** Единица занятия: «Урок» / «Занятие» / «Тренировка»… */
  lesson: string;
  /** Продукт оплаты: «Абонемент» / «Пакет» / «Членство»… */
  subscription: string;
}

export interface WorkspaceConfig {
  /** Прошёл ли владелец быструю настройку. */
  setupCompleted?: boolean;
  /** Вид деятельности — свободная строка для дашборда и подсказок. */
  activityType?: string;
  /** Заголовок и подзаголовок дашборда. */
  dashboardTitle?: string;
  dashboardSubtitle?: string;
  /** Терминология экранов. */
  terms?: Partial<WorkspaceTerms>;
  /** Расписание: какие поля обязательны при создании занятия. */
  schedule?: {
    requireTeacher?: boolean;
    requireRoom?: boolean;
  };
}

/** Прежние тексты — то, что видят организации без конфига. */
export const DEFAULT_WORKSPACE_CONFIG: Required<Omit<WorkspaceConfig, "setupCompleted" | "activityType">> & { activityType: string } = {
  activityType: "Образование",
  dashboardTitle: "Панель управления",
  dashboardSubtitle:
    "Обзор показателей учебного процесса, результаты поступивших абитуриентов, CRM-сделки и аналитика в реальном времени.",
  terms: {
    teacher: "Преподаватель",
    room: "Кабинет",
    student: "Ученик",
    group: "Группа",
    lesson: "Урок",
    subscription: "Абонемент",
  },
  schedule: {
    requireTeacher: true,
    requireRoom: true,
  },
};

/** Готовые пресеты для быстрой настройки — стартовая точка, всё правится. */
export const ACTIVITY_PRESETS: { key: string; label: string; config: WorkspaceConfig }[] = [
  {
    key: "school",
    label: "Школа / академия",
    config: {
      activityType: "Образование",
      dashboardTitle: "Панель управления школой",
      dashboardSubtitle: "Учебный процесс, результаты учеников и аналитика в реальном времени.",
      terms: { teacher: "Преподаватель", room: "Кабинет", student: "Ученик", group: "Класс", lesson: "Урок", subscription: "Абонемент" },
      schedule: { requireTeacher: true, requireRoom: true },
    },
  },
  {
    key: "courses",
    label: "Курсы / тренинги",
    config: {
      activityType: "Курсы",
      dashboardTitle: "Панель управления курсами",
      dashboardSubtitle: "Потоки, занятия, заявки студентов и продажи.",
      terms: { teacher: "Тренер", room: "Аудитория", student: "Студент", group: "Поток", lesson: "Занятие", subscription: "Пакет занятий" },
      schedule: { requireTeacher: true, requireRoom: false },
    },
  },
  {
    key: "events",
    label: "События / мероприятия",
    config: {
      activityType: "События",
      dashboardTitle: "Панель управления событиями",
      dashboardSubtitle: "Билеты, заявки гостей, программа и команда.",
      terms: { teacher: "Ведущий", room: "Площадка", student: "Участник", group: "Смена", lesson: "Событие", subscription: "Пакет" },
      schedule: { requireTeacher: false, requireRoom: false },
    },
  },
  {
    key: "sport",
    label: "Спорт / секции",
    config: {
      activityType: "Спорт",
      dashboardTitle: "Панель управления клубом",
      dashboardSubtitle: "Тренировки, абонементы, посещаемость и команда.",
      terms: { teacher: "Тренер", room: "Зал", student: "Спортсмен", group: "Группа", lesson: "Тренировка", subscription: "Абонемент" },
      schedule: { requireTeacher: true, requireRoom: true },
    },
  },
];

/** Конфиг организации с добивкой прежних текстов по умолчанию. */
export function resolveWorkspaceConfig(raw: unknown): typeof DEFAULT_WORKSPACE_CONFIG & { setupCompleted: boolean } {
  const c = (raw && typeof raw === "object" ? raw : {}) as WorkspaceConfig;
  return {
    setupCompleted: Boolean(c.setupCompleted),
    activityType: c.activityType || DEFAULT_WORKSPACE_CONFIG.activityType,
    dashboardTitle: c.dashboardTitle || DEFAULT_WORKSPACE_CONFIG.dashboardTitle,
    dashboardSubtitle: c.dashboardSubtitle || DEFAULT_WORKSPACE_CONFIG.dashboardSubtitle,
    terms: { ...DEFAULT_WORKSPACE_CONFIG.terms, ...(c.terms || {}) },
    schedule: { ...DEFAULT_WORKSPACE_CONFIG.schedule, ...(c.schedule || {}) },
  };
}
