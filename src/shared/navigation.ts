import type { PermissionKey } from "./permissions.js";

/**
 * Реестр навигации кабинета: область → раздел → подразделы.
 *
 * Из него строятся меню слева, защита страниц, поиск Cmd+K и список экранов,
 * которые платформа и организация включают поштучно (WORKSPACE_SCREENS).
 * Ключ `screen` — тот же, что в NAV_PERMISSION и в настройках организаций:
 * менять его нельзя, на нём держатся сохранённые выключенные экраны.
 *
 * Иконки — именами: файл читает и сервер, ему React-иконки не нужны.
 */

export type NavIcon =
  | "home" | "admissions" | "exams" | "schedule" | "journals" | "subscriptions" | "presentations"
  | "crm" | "forms" | "tickets" | "intake" | "chat" | "tasks" | "docs" | "sheets" | "digitize" | "payroll"
  | "team" | "audit" | "integrations" | "departments" | "workspace" | "emails" | "automations" | "sites" | "functions" | "billing" | "builder";

export interface NavSub { label: string; path: string; keywords?: string }

export interface NavItem {
  /** Ключ экрана (NAV_PERMISSION, выключение экранов). null — экран вне этого механизма. */
  screen: string | null;
  label: string;
  /** Путь внутри /workspace/<org>; "" — главная. */
  path: string;
  icon: NavIcon;
  /** Другие пути раздела — для подсветки пункта меню. */
  match?: string[];
  /** Пункту меню нужно ещё одно из этих прав (страница при этом защищена экраном). */
  anyPerm?: PermissionKey[];
  /** Заготовка: видит только платформа, в меню организации не выводится. */
  inDevelopment?: boolean;
  /** Только экран (настройки), без пункта меню. */
  menu?: false;
  sub?: NavSub[];
}

export interface NavGroup { id: string; label: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "home", label: "Главная", items: [
      { screen: "dashboard", label: "Главная", path: "", icon: "home", match: ["/dashboard"] },
    ],
  },
  {
    id: "admissions", label: "Приём и экзамены", items: [
      {
        screen: "admissions", label: "Приём", path: "/admissions", icon: "admissions",
        sub: [{ label: "Поступающие", path: "/admissions" }, { label: "Анкеты", path: "/admissions?view=templates", keywords: "шаблоны анкет" }],
      },
      {
        screen: "exams", label: "Экзамены", path: "/exams", icon: "exams",
        anyPerm: ["tests:manage", "placement:manage", "tests:review"],
        sub: [
          { label: "Экзамены", path: "/exams" },
          { label: "Сейчас", path: "/exams?tab=live", keywords: "идёт экзамен" },
          { label: "Банк вопросов", path: "/exams?tab=bank", keywords: "вопросы" },
          { label: "Архив прежнего теста", path: "/exams?tab=archive" },
        ],
      },
    ],
  },
  {
    id: "learning", label: "Обучение", items: [
      { screen: "schedule", label: "Расписание", path: "/edu/schedule", icon: "schedule" },
      { screen: "journals", label: "Журналы", path: "/journals", icon: "journals" },
      { screen: "subscriptions", label: "Абонементы", path: "/edu/subscriptions", icon: "subscriptions" },
      { screen: "presentations", label: "Презентации", path: "/presentations", icon: "presentations" },
    ],
  },
  {
    id: "sales", label: "Продажи и заявки", items: [
      {
        screen: "crm", label: "CRM", path: "/crm/contacts", icon: "crm", match: ["/crm"],
        sub: [{ label: "Контакты", path: "/crm/contacts" }, { label: "Сделки", path: "/crm/deals", keywords: "воронка" }],
      },
      { screen: "forms", label: "Формы и заявки", path: "/builder/forms", icon: "forms", sub: [{ label: "Формы и заявки", path: "/builder/forms", keywords: "qr" }] },
      { screen: "tickets", label: "Проверка билетов", path: "/tickets", icon: "tickets", sub: [{ label: "Сканер билетов", path: "/tickets", keywords: "qr вход" }] },
      { screen: "intake", label: "Приём и бронирование", path: "", icon: "intake", menu: false },
    ],
  },
  {
    id: "work", label: "Работа", items: [
      { screen: "chat", label: "Чаты", path: "/chat", icon: "chat", sub: [{ label: "Чаты", path: "/chat", keywords: "звонок сообщения" }] },
      {
        screen: "tasks", label: "Задачи", path: "/tasks", icon: "tasks",
        sub: [{ label: "Задачи: список", path: "/tasks/list" }, { label: "Задачи: доска", path: "/tasks/board", keywords: "канбан" }],
      },
      { screen: "docs", label: "Документы", path: "/docs", icon: "docs", sub: [{ label: "Новый документ", path: "/docs/new" }] },
      { screen: "sheets", label: "Таблицы", path: "/sheets", icon: "sheets", sub: [{ label: "Новая таблица", path: "/sheets/new" }] },
      // Тот же экран «Документы»: включается и выключается вместе с ним, отдельного права нет.
      { screen: "docs", label: "Оцифровка", path: "/digitize", icon: "digitize", sub: [{ label: "Оцифровка", path: "/digitize", keywords: "скан фото рукопись распознать бумага" }] },
    ],
  },
  {
    id: "finance", label: "Финансы", items: [
      { screen: "payroll", label: "Зарплаты", path: "/edu/payroll", icon: "payroll", sub: [{ label: "Зарплаты и касса", path: "/edu/payroll", keywords: "ведомость касса ставки" }] },
    ],
  },
  {
    id: "admin", label: "Администрирование", items: [
      { screen: "adminOverview", label: "Обзор", path: "/admin", icon: "workspace", sub: [{ label: "Обзор: что не настроено", path: "/admin", keywords: "настройка проверка" }] },
      { screen: "staff", label: "Сотрудники", path: "/admin/staff", icon: "team", match: ["/settings/roles", "/settings/permissions", "/settings/permission-matrix"], sub: [{ label: "Сотрудники: список и карточки", path: "/admin/staff", keywords: "отключить входы пригласить" }, { label: "Должности и права", path: "/admin/staff?tab=roles", keywords: "роли должности права доступ" }, { label: "Кто может…", path: "/admin/staff?tab=who", keywords: "право доступ отчёт" }, { label: "Передача владения", path: "/admin/staff?tab=owner", keywords: "владелец" }] },
      { screen: "audit", label: "Журнал действий", path: "/admin/audit", icon: "audit", sub: [{ label: "Журнал действий", path: "/admin/audit", keywords: "аудит история" }] },
      { screen: "integrations", label: "Интеграции", path: "/admin/integrations", icon: "integrations", sub: [{ label: "Ключ API", path: "/admin/integrations", keywords: "api ключ сайты" }] },
      { screen: "departments", label: "Отделы", path: "/settings/departments", icon: "departments", sub: [{ label: "Оргструктура и отделы", path: "/settings/departments" }] },
      { screen: "workspaceSetup", label: "Разделы и организация", path: "/settings/workspace", icon: "workspace", match: ["/settings/templates"], sub: [{ label: "Настройка организации", path: "/settings/workspace", keywords: "разделы названия реквизиты" }] },
      { screen: "emailTemplates", label: "Письма", path: "/settings/emails", icon: "emails", sub: [{ label: "Письма: шаблоны и журнал", path: "/settings/emails", keywords: "почта отправитель" }] },
    ],
  },
  {
    id: "dev", label: "В разработке", items: [
      { screen: "automations", label: "Автоматизации", path: "/automations", icon: "automations", inDevelopment: true },
      { screen: "sites", label: "Конструктор сайта", path: "/sites", icon: "sites", inDevelopment: true },
      { screen: "functions", label: "Конструктор функций", path: "/functions/studio", icon: "functions", inDevelopment: true },
      { screen: null, label: "Тарифы и оплата", path: "/billing", icon: "billing", inDevelopment: true },
      { screen: null, label: "Конструктор", path: "/builder", icon: "builder", inDevelopment: true, match: [] },
    ],
  },
];

/**
 * Разделы «Администрирования», для которых ещё нет страницы. В меню не
 * выводятся, пока страница не готова.
 */
export const NAV_PLANNED = ["Организация", "Уведомления и Telegram"] as const;

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap(g => g.items);

/** Все пути раздела, с которыми совпадает адрес (для подсветки). */
const itemPaths = (it: NavItem) => [it.path, ...(it.match || [])];

/**
 * Активный пункт: по самому длинному совпавшему префиксу. Главная — только
 * на самом адресе организации, иначе она горела бы на любой странице.
 */
export function activeNavItem(pathname: string, orgId: string, items: NavItem[] = NAV_ITEMS): NavItem | null {
  const base = `/workspace/${orgId}`;
  if (!pathname.startsWith(base)) return null;
  const rest = pathname.slice(base.length).replace(/\/+$/, "");
  let best: NavItem | null = null, bestLen = -1;
  for (const it of items) {
    if (it.menu === false) continue;
    for (const p of itemPaths(it)) {
      const ok = p === "" ? rest === "" : rest === p || rest.startsWith(p + "/");
      if (ok && p.length > bestLen) { best = it; bestLen = p.length; }
    }
  }
  return best;
}

/** Экран, которым защищена страница по адресу (для защиты маршрутов). */
export const navItemByScreen = (screen: string) => NAV_ITEMS.find(i => i.screen === screen) || null;
