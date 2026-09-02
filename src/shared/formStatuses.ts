/**
 * Статусы заявок — единственный источник правды.
 *
 * Импортируется и сервером (esbuild бандлит server.ts вместе с TS-импортами),
 * и клиентом. До этого модуля в проекте жили ТРИ расходящихся набора подписей
 * (formRoutes, FormBuilder, QrTracker): один и тот же статус назывался
 * «Заявка принята», «Новые» и «Новая Заявка (Получена)» одновременно, и
 * завуч с заявителем видели разные слова про одно и то же.
 */

export const FORM_STATUSES = [
  "new", "review", "testing", "waitlist",
  "approved", "paid", "checked_in", "rejected", "cancelled",
] as const;
export type FormStatus = typeof FORM_STATUSES[number];

export const STATUS_LABEL: Record<FormStatus, string> = {
  new: "Заявка принята",
  review: "На рассмотрении",
  testing: "Тестирование",
  waitlist: "Лист ожидания",
  approved: "Одобрено",
  paid: "Оплачено",
  checked_in: "Гость пришёл",
  rejected: "Отклонено",
  cancelled: "Отменена",
};

/** Цвета бейджей и полос: одинаковые в кабинете и на трекере. */
export const STATUS_COLOR: Record<FormStatus, string> = {
  new: "bg-blue-500",
  review: "bg-amber-500",
  testing: "bg-violet-500",
  waitlist: "bg-slate-400",
  approved: "bg-emerald-500",
  paid: "bg-teal-500",
  checked_in: "bg-green-600",
  rejected: "bg-red-500",
  cancelled: "bg-slate-500",
};

/** Режим формы: приём заявок (поступление) или билеты на событие. */
export type FormMode = "application" | "ticket";

/**
 * Какие статусы доступны в каждом режиме. «Тестирование» бессмысленно для
 * билета, «Оплачено» и «Гость пришёл» — для заявки на поступление; полный
 * список в одном дропдауне заставлял бы выбирать между чужими статусами.
 */
export const MODE_STATUSES: Record<FormMode, readonly FormStatus[]> = {
  application: ["new", "review", "testing", "waitlist", "approved", "rejected", "cancelled"],
  ticket: ["new", "review", "waitlist", "approved", "paid", "checked_in", "rejected", "cancelled"],
};

/**
 * Статусы, при которых в билетном режиме гостю показывается QR-билет.
 * До одобрения билета не существует — только заявка на него.
 */
export const TICKET_ACTIVE: readonly FormStatus[] = ["approved", "paid", "checked_in"];

export const isFormStatus = (v: unknown): v is FormStatus =>
  FORM_STATUSES.includes(v as FormStatus);
