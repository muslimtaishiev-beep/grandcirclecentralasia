/**
 * Права доступа — единственный источник правды.
 *
 * До этого модуля в проекте жили ЧЕТЫРЕ несовместимые системы прав: строки
 * вида `crm:read`, матрица модулей `mod_*` с галочками view/edit/execute,
 * булевы флаги `canManageUsers` и список модулей тарифа `MODULE_*`. Понимала
 * навигацию только первая; матрица подмешивалась через хардкод-мапу, а
 * булевы флаги не читал вообще никто.
 *
 * Хуже того, два экрана писали права в РАЗНЫЕ поля одного документа, а
 * проверка объединяла их по ИЛИ: запрет, поставленный в «Правах и
 * сотрудниках», молча отменялся «Матрицей PBAC».
 *
 * Здесь всё сведено в одно: каталог прав, пресеты должностей, карта
 * «пункт меню → право» и единственная функция разрешения доступа.
 */

export type PermissionKey =
  // Тесты и прокторинг
  | "tests:read" | "tests:manage" | "tests:review" | "certificates:issue"
  // Обучение
  | "edu:schedule" | "edu:payroll"
  // CRM
  | "crm:read" | "crm:manage"
  // Работа и общение
  | "chat:use" | "tasks:use" | "docs:use" | "sheets:use" | "tickets:check"
  // Администрирование
  | "team:manage" | "settings:manage";

export interface PermissionDef {
  key: PermissionKey;
  label: string;
  description: string;
  category: string;
}

/** Каталог: подписи взяты из прежнего экрана «Права & Сотрудники». */
export const PERMISSIONS: PermissionDef[] = [
  { key: "tests:read", label: "Просмотр тестов", description: "Доступ к списку тестов и экзаменов", category: "Тесты & Прокторинг" },
  { key: "tests:manage", label: "Создание и редактирование тестов", description: "Новые тесты, вопросы, время прохождения", category: "Тесты & Прокторинг" },
  { key: "tests:review", label: "Проверка и прокторинг", description: "Кабинет проверки, снимки нарушений, отчёты", category: "Тесты & Прокторинг" },
  { key: "certificates:issue", label: "Выдача сертификатов", description: "Регистрация и выгрузка PDF-сертификатов и справок", category: "Тесты & Прокторинг" },

  { key: "edu:schedule", label: "Расписание и посещаемость", description: "Сетка занятий, журнал, списание занятий", category: "Обучение & Журнал" },
  { key: "edu:payroll", label: "Расчёт зарплат", description: "Ставки и выплаты за проведённые занятия", category: "Обучение & Журнал" },

  { key: "crm:read", label: "Просмотр CRM", description: "Контакты, заявки, воронка — только чтение", category: "CRM & Продажи" },
  { key: "crm:manage", label: "Управление сделками", description: "Перемещение по воронке, редактирование контактов", category: "CRM & Продажи" },

  { key: "chat:use", label: "Чаты", description: "Внутренняя переписка организации", category: "Работа" },
  { key: "tasks:use", label: "Задачи", description: "Доска задач и поручения", category: "Работа" },
  { key: "docs:use", label: "Документы", description: "Совместные документы и шаблоны", category: "Работа" },
  { key: "sheets:use", label: "Таблицы", description: "Совместные таблицы", category: "Работа" },
  { key: "tickets:check", label: "Проверка билетов", description: "Сканер QR на входе — отметка гостей", category: "Работа" },

  { key: "team:manage", label: "Управление сотрудниками", description: "Приглашения, должности, назначение прав", category: "Администрирование" },
  { key: "settings:manage", label: "Настройки организации", description: "Название, терминология экранов, модули, интеграции", category: "Администрирование" },
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSIONS.map(p => p.key);
export const isPermissionKey = (v: unknown): v is PermissionKey =>
  ALL_PERMISSION_KEYS.includes(v as PermissionKey);

/**
 * Системные роли с безусловным полным доступом.
 *
 * ТОЧНОЕ совпадение, а не поиск подстроки. Прежняя проверка искала подстроки
 * «admin», «руководитель», «директор» в названии роли — и любая созданная
 * владельцем должность «Директор по продажам» молча получала права на всё,
 * включая зарплаты и настройки. Для кастомных ролей это блокер.
 */
export const FULL_ACCESS_ROLES = new Set([
  "owner", "org:owner", "admin", "org:admin", "superadmin",
  "Владелец", "Администратор",
]);

export const hasFullAccess = (role: unknown): boolean =>
  FULL_ACCESS_ROLES.has(String(role ?? "").trim());

/** Пресеты должностей — стартовая точка, владелец правит галочки. */
export const ROLE_PRESETS: { name: string; description: string; permissions: PermissionKey[] }[] = [
  {
    name: "Администратор",
    description: "Полный доступ, кроме биллинга",
    permissions: [...ALL_PERMISSION_KEYS],
  },
  {
    name: "Менеджер",
    description: "Заявки, CRM, общение",
    permissions: ["crm:read", "crm:manage", "chat:use", "tasks:use", "docs:use", "sheets:use", "tickets:check"],
  },
  {
    name: "Преподаватель",
    description: "Расписание, журнал, свои тесты",
    permissions: ["edu:schedule", "tests:read", "tests:review", "chat:use", "tasks:use", "docs:use"],
  },
  {
    name: "Проктор",
    description: "Наблюдение за экзаменами и проверка работ",
    permissions: ["tests:read", "tests:review", "chat:use", "tasks:use"],
  },
  {
    name: "Волонтёр",
    description: "Только проверка билетов на входе",
    permissions: ["tickets:check", "chat:use"],
  },
];

/**
 * Право, закрывающее пункт меню. `null` — пункт открыт всем сотрудникам.
 *
 * Дашборд и чат оставлены открытыми намеренно: новый сотрудник без единого
 * права не должен упираться в пустой экран без единой ссылки.
 */
export const NAV_PERMISSION: Record<string, PermissionKey | PermissionKey[] | null> = {
  dashboard: null,
  chat: "chat:use",
  tasks: "tasks:use",
  tickets: "tickets:check",
  docs: "docs:use",
  sheets: "sheets:use",
  schedule: "edu:schedule",
  attendance: "edu:schedule",
  subscriptions: "edu:schedule",
  payroll: "edu:payroll",
  crm: ["crm:read", "crm:manage"],
  tests: ["tests:read", "tests:manage"],
  testsManage: ["tests:review", "tests:manage"],
  placement: ["tests:manage", "tests:review"],
  forms: ["team:manage", "certificates:issue", "crm:manage"],
  functions: ["team:manage", "settings:manage"],
  departments: ["team:manage", "settings:manage"],
  permissions: ["team:manage", "settings:manage"],
  workspaceSetup: ["team:manage", "settings:manage"],
  sites: ["team:manage", "settings:manage"],
  automations: ["team:manage", "settings:manage"],
};

/**
 * Модули организации, которые владелец может выключить целиком.
 * Выключенный модуль отнимает свои права у ВСЕХ, включая роли.
 */
export const ORG_MODULES: { key: string; label: string; description: string; permissions: PermissionKey[] }[] = [
  { key: "mod_edu", label: "Обучение и расписание", description: "Занятия, журнал, абонементы, зарплаты", permissions: ["edu:schedule", "edu:payroll"] },
  { key: "mod_tests", label: "Тесты и экзамены", description: "Тесты, прокторинг, вступительный срез", permissions: ["tests:read", "tests:manage", "tests:review", "certificates:issue"] },
  { key: "mod_crm", label: "CRM и продажи", description: "Контакты, сделки, воронки", permissions: ["crm:read", "crm:manage"] },
  { key: "mod_tickets", label: "Заявки и билеты", description: "Конструктор заявок, QR-билеты, проверка на входе", permissions: ["tickets:check"] },
  { key: "mod_docs", label: "Документы и таблицы", description: "Совместные документы и таблицы", permissions: ["docs:use", "sheets:use"] },
];

/**
 * Старые формы прав → новые строки.
 *
 * Понимает всё, что успело накопиться: массив строк, булевы `canX` и матрицу
 * модулей. Из матрицы переносим честно: только «просмотр» → право на чтение,
 * «редактирование» или «выполнение» → право на управление. Прежняя проверка
 * схлопывала их и по одной галочке «чтение» открывала полный доступ к пункту.
 */
export function migrateLegacyPermissions(raw: {
  permissions?: unknown;
  customPermissions?: unknown;
}): PermissionKey[] {
  const out = new Set<PermissionKey>();

  // Форма 1: массив строк — уже нужный формат.
  if (Array.isArray(raw.permissions)) {
    for (const p of raw.permissions) if (isPermissionKey(p)) out.add(p);
  }

  // Форма 2: булевы флаги RolePermissions.
  if (raw.permissions && typeof raw.permissions === "object" && !Array.isArray(raw.permissions)) {
    const b = raw.permissions as Record<string, boolean>;
    if (b.canCreateTests) { out.add("tests:read"); out.add("tests:manage"); }
    if (b.canReviewSubmissions) { out.add("tests:read"); out.add("tests:review"); }
    if (b.canManageSchedule) out.add("edu:schedule");
    if (b.canViewFinancials) out.add("edu:payroll");
    if (b.canManageUsers) out.add("team:manage");
    if (b.canManageOrganization) out.add("settings:manage");
    if (b.canViewAnalytics) out.add("crm:read");
  }

  // Форма 3: матрица модулей mod_* с view/edit/execute.
  if (Array.isArray(raw.customPermissions)) {
    const MOD_MAP: Record<string, { read: PermissionKey[]; manage: PermissionKey[] }> = {
      mod_crm: { read: ["crm:read"], manage: ["crm:read", "crm:manage"] },
      mod_admissions: { read: ["crm:read"], manage: ["crm:read", "crm:manage", "edu:schedule"] },
      mod_proctoring: { read: ["tests:read"], manage: ["tests:read", "tests:review", "tests:manage"] },
      mod_certificates: { read: [], manage: ["certificates:issue"] },
      mod_payroll: { read: ["edu:schedule"], manage: ["edu:schedule", "edu:payroll"] },
      mod_settings: { read: [], manage: ["team:manage", "settings:manage"] },
    };
    for (const m of raw.customPermissions as any[]) {
      const map = MOD_MAP[String(m?.moduleId || "")];
      if (!map) continue;
      const keys = (m.canEdit || m.canExecute) ? map.manage : (m.canView ? map.read : []);
      for (const k of keys) out.add(k);
    }
  }

  return [...out];
}

/**
 * Итоговый набор прав сотрудника — единственная точка принятия решения.
 *
 * Порядок: владелец получает всё; остальным складываются права должности и
 * персональные; затем вычитается то, что организация выключила целиком.
 * Выключенный модуль сильнее любой роли — иначе тумблер «скрыть CRM для всех»
 * не работал бы для администратора отдела.
 */
export function resolvePermissions(input: {
  role?: unknown;
  permissions?: unknown;
  customPermissions?: unknown;
  /** Права должности сотрудника (документ custom_roles). */
  rolePermissions?: unknown;
  /** Отключённые организацией модули (ключи ORG_MODULES). */
  disabledModules?: unknown;
}): Set<PermissionKey> {
  const granted = new Set<PermissionKey>();

  if (hasFullAccess(input.role)) {
    for (const k of ALL_PERMISSION_KEYS) granted.add(k);
  } else {
    for (const p of migrateLegacyPermissions(input)) granted.add(p);
    if (Array.isArray(input.rolePermissions)) {
      for (const p of input.rolePermissions) if (isPermissionKey(p)) granted.add(p);
    }
  }

  const disabled = Array.isArray(input.disabledModules) ? input.disabledModules.map(String) : [];
  if (disabled.length) {
    for (const mod of ORG_MODULES) {
      if (!disabled.includes(mod.key)) continue;
      for (const p of mod.permissions) granted.delete(p);
    }
  }
  return granted;
}

/** Проверка одного пункта меню против набора прав. */
export function navAllowed(navKey: string, granted: Set<PermissionKey>): boolean {
  const need = NAV_PERMISSION[navKey];
  if (need === null || need === undefined) return true;
  return Array.isArray(need) ? need.some(p => granted.has(p)) : granted.has(need);
}
