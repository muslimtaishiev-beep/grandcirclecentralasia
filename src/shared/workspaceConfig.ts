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

/** Поле анкеты регистрации на экзамен. */
export interface RegistrationField {
  /** Что спрашиваем: имя, телефон, почта, класс/уровень. */
  key: "name" | "phone" | "email" | "grade";
  label?: string;
  placeholder?: string;
  /** Показывать ли поле вообще. */
  visible?: boolean;
  /** Обязательно ли заполнять. */
  required?: boolean;
}

export interface RegistrationConfig {
  title?: string;
  subtitle?: string;
  fields?: RegistrationField[];
  /** Варианты в выпадающем списке «класс/уровень»: «7», «Начальный»… */
  gradeOptions?: string[];
  /** Что дописать после варианта: «класс» → «7 класс». Пусто — ничего. */
  gradeSuffix?: string;
  /** Требовать имя и фамилию через пробел. У части организаций одно имя. */
  requireFullName?: boolean;
  /** Кто называет PIN: «менеджер», «завуч», «администратор». */
  pinAuthority?: string;
  /** Нужен ли PIN вообще. */
  pinRequired?: boolean;
  /** Текст согласия на обработку данных (обычный текст, без разметки). */
  consentText?: string;
  /** Кнопка старта. */
  startButtonLabel?: string;
}

export interface TicketsConfig {
  /** Заголовок публичной страницы заявки и билета. */
  publicTitle?: string;
  /** Что показать, когда приём закрыт. */
  closedTitle?: string;
  closedMessage?: string;
  /** Кнопка отправки заявки. */
  submitButtonLabel?: string;
  /** Заголовок и текст после отправки. */
  successTitle?: string;
  successMessage?: string;
  /** Подпись билета у гостя: «Билет», «Пропуск», «Приглашение». */
  ticketWord?: string;
  /** Телефон поддержки на публичных страницах. */
  supportPhone?: string;
  /** Что писать на входе при успешной проверке билета. */
  checkinOkText?: string;
}

export interface EmailConfig {
  /** Имя отправителя в письмах: «Приёмная комиссия Гимназии №5». */
  fromName?: string;
  /** Куда попадут ответы на письма. */
  replyTo?: string;
  /** Подпись внизу письма. */
  signature?: string;
}

export interface LandingConfig {
  /** Бейдж над заголовком: «Регистрация открыта». */
  badge?: string;
  /** Подзаголовок под названием организации. */
  subtitle?: string;
  /** Кнопки: подписи. Первая ведёт на результаты, вторая — на вход в тест. */
  primaryCtaLabel?: string;
  secondaryCtaLabel?: string;
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
  /** Анкета регистрации на экзамен. */
  registration?: RegistrationConfig;
  /** Публичные страницы заявок и билетов. */
  tickets?: TicketsConfig;
  /** Письма от имени организации. */
  email?: EmailConfig;
  /** Публичный лендинг /:org/admission. */
  landing?: LandingConfig;
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
  // Умолчания повторяют прежние зашитые тексты: организация, которая ничего
  // не настраивала, видит ровно то же, что и раньше.
  registration: {
    title: "Входное тестирование",
    subtitle: "",
    fields: [
      { key: "name", label: "ФИО", placeholder: "Иванов Иван Иванович", visible: true, required: true },
      { key: "phone", label: "Номер телефона", placeholder: "+996 555 123 456", visible: true, required: true },
      { key: "email", label: "E-mail (для результатов)", placeholder: "student@example.com", visible: true, required: true },
      { key: "grade", label: "Выберите ваш класс", placeholder: "", visible: true, required: true },
    ],
    gradeOptions: ["7", "8", "9", "10", "11"],
    gradeSuffix: "класс",
    requireFullName: true,
    pinAuthority: "менеджер",
    pinRequired: true,
    consentText: "",
    startButtonLabel: "Начать тест",
  },
  tickets: {
    publicTitle: "",
    closedTitle: "Приём заявок закрыт",
    closedMessage: "Приём заявок по этой форме закрыт.",
    submitButtonLabel: "Отправить заявку",
    successTitle: "Заявка принята!",
    successMessage: "",
    ticketWord: "Билет",
    supportPhone: "",
    checkinOkText: "Проходит",
  },
  email: { fromName: "", replyTo: "", signature: "" },
  landing: {
    badge: "Регистрация открыта",
    subtitle: "Первый этап отбора — диагностический тест. Покажи свои знания и стань частью будущего.",
    primaryCtaLabel: "Узнать результаты",
    secondaryCtaLabel: "Вход для участников",
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
    registration: mergeRegistration(c.registration),
    tickets: { ...DEFAULT_WORKSPACE_CONFIG.tickets, ...(c.tickets || {}) },
    email: { ...DEFAULT_WORKSPACE_CONFIG.email, ...(c.email || {}) },
    landing: { ...DEFAULT_WORKSPACE_CONFIG.landing, ...(c.landing || {}) },
  };
}

/**
 * Поля анкеты сливаются по ключу, а не заменяются целиком: организация может
 * поменять подпись одного поля, не переписывая остальные, и новое поле,
 * добавленное в платформу, появится у всех.
 */
function mergeRegistration(raw: RegistrationConfig | undefined): Required<RegistrationConfig> {
  const base = DEFAULT_WORKSPACE_CONFIG.registration as Required<RegistrationConfig>;
  const c = raw || {};
  const byKey = new Map((Array.isArray(c.fields) ? c.fields : []).map(f => [f?.key, f]));
  return {
    ...base,
    ...c,
    fields: base.fields.map(def => ({ ...def, ...(byKey.get(def.key) || {}) })),
    gradeOptions: Array.isArray(c.gradeOptions) && c.gradeOptions.length ? c.gradeOptions : base.gradeOptions,
  };
}

/** Подпись варианта в списке классов/уровней: «7» + «класс» → «7 класс». */
export const gradeOptionLabel = (value: string, suffix?: string) =>
  suffix ? `${value} ${suffix}`.trim() : value;

/** Поле анкеты по ключу — с учётом настроек организации. */
export const regField = (
  cfg: { registration?: RegistrationConfig } | null | undefined,
  key: RegistrationField["key"],
): Required<RegistrationField> => {
  const merged = mergeRegistration(cfg?.registration);
  const f = merged.fields.find(x => x.key === key);
  const def = (DEFAULT_WORKSPACE_CONFIG.registration as Required<RegistrationConfig>).fields.find(x => x.key === key)!;
  return { ...def, ...(f || {}) } as Required<RegistrationField>;
};
