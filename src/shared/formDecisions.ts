/**
 * Решения (состояния) формы: что может быть с заявкой и что уходит заявителю
 * при смене состояния. Общий модуль сервера и кабинета.
 *
 * Заявка хранит id состояния. Для формы без настроек состояния — нынешние
 * системные статусы (id = системный статус), поэтому старые заявки читаются
 * как раньше. `kind` — системный статус, по которому работают билеты, сканер,
 * фильтры и статистика.
 */
import { MODE_STATUSES, STATUS_LABEL, isFormStatus, type FormMode, type FormStatus } from "./formStatuses.js";

export type NotifyMode = "none" | "auto" | "at" | "manual";

export interface DecisionNotify {
  mode: NotifyMode;
  /** Для auto: через сколько минут (не меньше NOTIFY_MIN_DELAY). */
  delayMin: number;
  /** Для at: время отправки, мс. */
  at?: number;
  emailTemplateId?: string;
  /** Страница результатов, которую заявитель видит на /track/:token. */
  pageId?: string;
}

export interface Decision {
  id: string;
  label: string;
  color: string;
  kind: FormStatus;
  notify: DecisionNotify;
}

export const NOTIFY_MIN_DELAY = 2;
export const NOTIFY_DEFAULT_DELAY = 5;
export const MAX_DECISIONS = 20;

export const NOTIFY_MODES: { id: NotifyMode; label: string }[] = [
  { id: "none", label: "Не отправлять" },
  { id: "auto", label: "Автоматически через…" },
  { id: "at", label: "В заданное время" },
  { id: "manual", label: "Вручную при смене" },
];

/** Те же цвета, что у STATUS_COLOR, но значением — для style и страницы отслеживания. */
export const KIND_COLOR: Record<FormStatus, string> = {
  new: "#3b82f6", review: "#f59e0b", testing: "#8b5cf6", waitlist: "#94a3b8",
  approved: "#10b981", paid: "#14b8a6", checked_in: "#16a34a", rejected: "#ef4444", cancelled: "#64748b",
};
export const DECISION_PALETTE = ["#3b82f6", "#f59e0b", "#8b5cf6", "#94a3b8", "#10b981", "#14b8a6", "#16a34a", "#ef4444", "#64748b", "#ec4899"];

const HEX = /^#[0-9a-fA-F]{6}$/;
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const REF = /^[A-Za-z0-9_-]{4,64}$/;
export const DECISION_ID = ID;

export const formModeOf = (form: unknown): FormMode => ((form as any)?.mode === "ticket" ? "ticket" : "application");

const noNotify = (): DecisionNotify => ({ mode: "none", delayMin: NOTIFY_DEFAULT_DELAY });
const baseDecision = (kind: FormStatus): Decision => ({ id: kind, label: STATUS_LABEL[kind], color: KIND_COLOR[kind], kind, notify: noNotify() });

/** Состояния формы без настроек — статусы её режима. */
export function defaultDecisions(mode: FormMode): Decision[] {
  return MODE_STATUSES[mode].map(baseDecision);
}

const line = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function sanitizeNotify(raw: unknown): DecisionNotify {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const mode: NotifyMode = r.mode === "auto" || r.mode === "at" || r.mode === "manual" ? r.mode : "none";
  const d = Math.round(Number(r.delayMin));
  const out: DecisionNotify = { mode, delayMin: Number.isFinite(d) ? Math.min(10080, Math.max(NOTIFY_MIN_DELAY, d)) : NOTIFY_DEFAULT_DELAY };
  const at = Number(r.at);
  if (Number.isFinite(at) && at > 0) out.at = Math.floor(at);
  if (typeof r.emailTemplateId === "string" && REF.test(r.emailTemplateId)) out.emailTemplateId = r.emailTemplateId;
  if (typeof r.pageId === "string" && REF.test(r.pageId)) out.pageId = r.pageId;
  return out;
}

/**
 * Очистка списка состояний: лишние поля отброшены, id уникальны, у системного
 * id тип равен ему самому, «новая заявка» всегда есть (с неё всё начинается).
 * Пусто или не список — состояния режима формы.
 */
export function sanitizeDecisions(raw: unknown, mode: FormMode): Decision[] {
  if (!Array.isArray(raw) || !raw.length) return defaultDecisions(mode);
  const seen = new Set<string>();
  const out: Decision[] = [];
  for (const x of raw) {
    if (out.length >= MAX_DECISIONS) break;
    const r = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    if (!ID.test(id) || seen.has(id)) continue;
    seen.add(id);
    const kind: FormStatus = isFormStatus(id) ? id : isFormStatus(r.kind) ? r.kind : "new";
    out.push({
      id, kind,
      label: line(r.label, 40) || STATUS_LABEL[kind],
      color: typeof r.color === "string" && HEX.test(r.color) ? r.color.toLowerCase() : KIND_COLOR[kind],
      notify: sanitizeNotify(r.notify),
    });
  }
  if (!out.length) return defaultDecisions(mode);
  if (!seen.has("new")) out.unshift(baseDecision("new"));
  return out;
}

/** Состояния формы (форма из базы или из кабинета). */
export const resolveDecisions = (form: unknown): Decision[] => sanitizeDecisions((form as any)?.decisions, formModeOf(form));

/** Состояние по id заявки; неизвестный id (старые данные) — системный статус или серая заглушка. */
export function decisionOf(list: Decision[], id: unknown): Decision {
  const s = String(id ?? "new") || "new";
  const f = list.find(d => d.id === s);
  if (f) return f;
  if (isFormStatus(s)) return baseDecision(s);
  return { id: s, label: s, color: "#94a3b8", kind: "new", notify: noNotify() };
}

/** Системный статус заявки: по нему работают билеты, сканер и статистика. */
export const kindOfStatus = (list: Decision[], id: unknown): FormStatus => decisionOf(list, id).kind;

/** Состояние, в которое сканер переводит вход: своё с типом «гость пришёл», иначе системное. */
export const checkedInId = (list: Decision[]): string => list.find(d => d.kind === "checked_in")?.id || "checked_in";

/**
 * Когда слать письмо при переходе в состояние. null — по расписанию не шлём
 * (не настроено или ручной режим). Время «в заданное» уже прошло — через минимум.
 */
export function notifyRunAt(n: DecisionNotify, now: number): number | null {
  if (n.mode === "auto") return now + Math.max(NOTIFY_MIN_DELAY, n.delayMin || NOTIFY_DEFAULT_DELAY) * 60_000;
  if (n.mode === "at") return n.at && n.at > now ? n.at : now + NOTIFY_MIN_DELAY * 60_000;
  return null;
}

export const notifyJobKey = (submissionId: string) => `form_notify:${submissionId}`;
