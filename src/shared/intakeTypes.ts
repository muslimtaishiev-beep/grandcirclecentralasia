/**
 * Приём заявок и бронирование ресурсов — единственный источник правды.
 *
 * Импортируется и сервером (esbuild бандлит server.ts вместе с TS-импортами),
 * и клиентом — как formStatuses.ts.
 *
 * Здесь НЕТ перечисления видов ресурсов. «Место», «стол», «слот», «команда» —
 * это не типы в коде, а названия, которые организация пишет себе сама: любой
 * ресурс это «сколько-то мест, которые можно занять». Отличия выражаются
 * полями (вместимость, время, код входа), а не литералами. Платформа
 * обслуживает и хакатон, и школьную секцию, и конференцию одним кодом.
 */

/** Что происходит с заявкой человека. */
export const ENTRY_STATUSES = ["new", "approved", "rejected", "cancelled"] as const;
export type EntryStatus = typeof ENTRY_STATUSES[number];

export const ENTRY_STATUS_LABEL: Record<EntryStatus, string> = {
  new: "Заявка принята",
  approved: "Одобрена",
  rejected: "Отклонена",
  cancelled: "Отменена",
};

export const ENTRY_STATUS_COLOR: Record<EntryStatus, string> = {
  new: "bg-blue-500",
  approved: "bg-emerald-500",
  rejected: "bg-red-500",
  cancelled: "bg-slate-500",
};

/**
 * Что происходит с бронью.
 *
 * `held` — не «отменена участником», а «место освобождено организацией»:
 * так бронь выглядит после отклонения заявки. Место возвращается в общий
 * счёт, но сама бронь и её история остаются — иначе нельзя ни разобрать
 * спор, ни вернуть человека обратно одним нажатием.
 */
export const BOOKING_STATUSES = ["active", "held", "cancelled"] as const;
export type BookingStatus = typeof BOOKING_STATUSES[number];

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  active: "Активна",
  held: "Приостановлена",
  cancelled: "Отменена",
};

/** Только активная бронь занимает место. */
export const BOOKING_HOLDS_SEAT: readonly BookingStatus[] = ["active"];

export const isEntryStatus = (v: unknown): v is EntryStatus =>
  ENTRY_STATUSES.includes(v as EntryStatus);

export const isBookingStatus = (v: unknown): v is BookingStatus =>
  BOOKING_STATUSES.includes(v as BookingStatus);

/**
 * Рамки свободной части заявки (`answers`).
 *
 * Внешний сайт присылает что хочет: состав команды массивом, вложенные
 * объекты, любые ключи — платформа в них не смотрит. Но совсем без рамок
 * база забьётся мусором, кабинет не покажет заявку, а выгрузка не соберётся.
 * Ограничиваем форму, а не смысл: массив на пять человек проходит с запасом.
 */
export const ANSWERS_LIMITS = {
  /** Глубина вложенности: {"team":[{"member":{"contact":{...}}}]} — это 4. */
  maxDepth: 5,
  /** Всего ключей во всём дереве. */
  maxKeys: 100,
  /** Длина одной строки. */
  maxStringLength: 5000,
  /** Элементов в одном массиве. */
  maxArrayLength: 50,
  /** Весь документ заявки в байтах: лимит Firestore — 1 МБ. */
  maxBytes: 700 * 1024,
} as const;

/** Контакты — единственное, что платформа требует от любой заявки. */
export interface EntryContact {
  name: string;
  email: string;
  phone: string;
}

/** Значение, которое может лежать в свободной части заявки. */
export type AnswerValue = string | number | boolean | null | AnswerValue[] | { [key: string]: AnswerValue };

export interface IntakeEntryPayload {
  contact: EntryContact;
  answers: Record<string, AnswerValue>;
}
