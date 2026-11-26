import type { PermissionKey } from "./permissions.js";

/**
 * Все действия, о которых приходят уведомления, — одним списком. По нему
 * сервер решает, кому слать, а профиль показывает переключатели. Один
 * переключатель — и колокольчик на сайте, и Telegram (если подключён).
 *
 * `for` — у кого есть хотя бы одно из прав, тому действие и показывается
 * в настройках (пусто — всем сотрудникам). `on` — включено по умолчанию.
 */
export type NotifySection = "admissions" | "exams" | "forms" | "docs" | "email" | "work";

export const NOTIFY_SECTIONS: { id: NotifySection; label: string }[] = [
  { id: "admissions", label: "Поступающие" },
  { id: "exams", label: "Экзамены" },
  { id: "forms", label: "Формы и заявки" },
  { id: "docs", label: "Документы школы" },
  { id: "email", label: "Письма" },
  { id: "work", label: "Задачи и чат" },
];

export interface NotifyEventDef {
  key: string;
  section: NotifySection;
  label: string;
  for: PermissionKey[];
  on: boolean;
  /** false — событие пока никто не создаёт: в настройках не показываем, чтобы переключатель не обманывал. */
  live?: boolean;
}

const ADM: PermissionKey[] = ["admission:manage"];
const ADM_PSY: PermissionKey[] = ["admission:manage", "psych:conduct"];
const EXAM: PermissionKey[] = ["tests:manage", "tests:review"];

export const NOTIFY_EVENTS: NotifyEventDef[] = [
  { key: "adm.new", section: "admissions", label: "Новый поступающий", for: ADM_PSY, on: true },
  { key: "adm.parent", section: "admissions", label: "Родитель заполнил анкету", for: ADM_PSY, on: true },
  { key: "adm.session", section: "admissions", label: "Началась сессия у психолога", for: ADM, on: true },
  { key: "adm.done", section: "admissions", label: "Сессия завершена · направление", for: ADM, on: true },
  { key: "adm.test_start", section: "admissions", label: "Начал тест", for: ADM, on: false },
  { key: "adm.section", section: "admissions", label: "Закончил часть теста", for: ADM, on: false },
  { key: "adm.tested", section: "admissions", label: "Закончил тест", for: ADM, on: true },
  { key: "adm.results", section: "admissions", label: "Внесены результаты на бумаге", for: ADM, on: true },
  { key: "adm.decision", section: "admissions", label: "Принято решение", for: ADM, on: true },

  { key: "exam.start", section: "exams", label: "Начал тест", for: EXAM, on: false },
  { key: "exam.section", section: "exams", label: "Закончил часть теста", for: EXAM, on: false },
  { key: "exam.finished", section: "exams", label: "Закончил тест", for: EXAM, on: true },
  { key: "exam.proctoring", section: "exams", label: "Нарушение прокторинга", for: EXAM, on: true },

  { key: "form.submission", section: "forms", label: "Новая заявка в моих формах", for: [], on: true },

  { key: "docs.request", section: "docs", label: "Просят сдать документы", for: [], on: true },
  { key: "docs.remind", section: "docs", label: "Напоминание о сроке сдачи", for: [], on: true },
  { key: "docs.review", section: "docs", label: "Мои документы приняли или вернули", for: [], on: true },
  { key: "docs.submitted", section: "docs", label: "Сдали документы по моему сбору", for: [], on: true },
  { key: "docs.due", section: "docs", label: "Срок моего сбора прошёл — кто не сдал", for: [], on: true },
  { key: "email.failed", section: "email", label: "Письмо не ушло", for: ["admission:manage", "tests:manage", "team:manage", "certificates:issue", "crm:manage"], on: true },

  { key: "task", live: false, section: "work", label: "Задачи", for: [], on: true },
  { key: "mention", live: false, section: "work", label: "Упоминания", for: [], on: true },
  { key: "chat", live: false, section: "work", label: "Чат", for: [], on: true },
  { key: "crm", live: false, section: "work", label: "CRM", for: [], on: true },
];

const BY_KEY = new Map(NOTIFY_EVENTS.map(e => [e.key, e]));
export const notifyEventDef = (key: string) => BY_KEY.get(key);

/** Личные настройки: только отличия от умолчаний — { ключ: вкл/выкл }. */
export type NotifyPrefs = Record<string, boolean>;

export function wantsEvent(prefs: NotifyPrefs | null | undefined, key: string): boolean {
  if (prefs && typeof prefs[key] === "boolean") return prefs[key];
  return BY_KEY.get(key)?.on ?? true;
}

/** Только известные ключи и булевы значения. */
export function sanitizePrefs(raw: unknown): NotifyPrefs {
  const out: NotifyPrefs = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (BY_KEY.has(k) && typeof v === "boolean") out[k] = v;
  return out;
}

/** Тип уведомления, созданного на клиенте (задача, чат…), → его переключатель. */
export const clientTypeEvent = (type: string) => (["task", "mention", "chat", "crm"].includes(type) ? type : null);
