import admin from "firebase-admin";
import { diffRows, type AuditChange } from "./applicantAudit.js";

/**
 * Журнал действий организации: tenants/{t}/audit. Пишет только сервер
 * (правила базы запрещают запись с клиента), читает право «Журнал действий».
 * Событие — кто, когда, что, над кем; правки — построчно «было → стало».
 */
export type AuditSection = "access" | "staff" | "roles" | "settings" | "security" | "integrations" | "data";
export interface AuditActor { uid: string; name: string }
export interface AuditEvent {
  actor: AuditActor;
  /** Код действия: login, invite, role.change, staff.suspend… */
  action: string;
  section: AuditSection;
  /** Над кем/чем: сотрудник, должность, настройка. */
  target?: { kind: string; id: string; name?: string };
  /** Короткая строка для списка. */
  detail?: string;
  changes?: AuditChange[];
}

export const SYSTEM_ACTOR: AuditActor = { uid: "system", name: "Система" };
export { diffRows };

const clip = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim().slice(0, max);

/** Кто вызывает — из req.user (имя из токена; на клиенте подменяется только своё). */
export const actorOf = (user: any): AuditActor => ({
  uid: String(user?.uid || "system"),
  name: clip(user?.name || user?.email || user?.uid || "Система", 120),
});

/**
 * Записать событие. Ошибка журнала не ломает действие — только лог.
 * docId — для событий, которые не должны дублироваться (вход за сеанс).
 */
export async function writeAudit(db: FirebaseFirestore.Firestore, tenantId: string, ev: AuditEvent, docId?: string): Promise<void> {
  if (!tenantId) return;
  const changes = (ev.changes || []).slice(0, 40).map(c => ({ label: clip(c.label, 120), from: clip(c.from, 500), to: clip(c.to, 500) }));
  const doc = {
    at: Date.now(),
    actorUid: ev.actor.uid, actorName: clip(ev.actor.name, 120),
    action: clip(ev.action, 60), section: ev.section,
    ...(ev.target ? { targetKind: clip(ev.target.kind, 40), targetId: clip(ev.target.id, 200), targetName: clip(ev.target.name, 160) } : {}),
    ...(ev.detail ? { detail: clip(ev.detail, 300) } : {}),
    ...(changes.length ? { changes } : {}),
  };
  const col = db.collection("tenants").doc(tenantId).collection("audit");
  try {
    if (docId) await col.doc(docId).create(doc);
    else await col.add(doc);
  } catch (e: any) {
    if (docId && (e?.code === 6 || /already exists/i.test(String(e?.message)))) return;
    console.error("[audit]", e?.message || e);
  }
}

/** Подписи действий — общие для сервера и экрана журнала. */
export const AUDIT_ACTIONS: Record<string, string> = {
  "login": "Вход",
  "invite": "Приглашение",
  "invite.resend": "Повторное приглашение",
  "invite.revoke": "Приглашение отозвано",
  "role.change": "Смена должности и прав",
  "role.save": "Должность изменена",
  "role.create": "Должность создана",
  "role.delete": "Должность удалена",
  "staff.suspend": "Сотрудник отключён",
  "staff.resume": "Сотрудник включён",
  "staff.remove": "Сотрудник удалён из организации",
  "staff.sessions": "Выход на всех устройствах",
  "staff.password": "Сброс пароля (письмо)",
  "staff.password.set": "Пароль задан администратором",
  "owner.transfer": "Передача владения",
  "owner.add": "Добавлен владелец",
  "settings.workspace": "Настройка разделов",
  "settings.legal": "Реквизиты",
  "settings.modules": "Модули",
  "settings.screens": "Разделы меню",
  "apikey.issue": "Выпущен ключ API",
  "apikey.origins": "Разрешённые сайты",
  "form.close": "Приём заявок закрыт",
  "form.open": "Приём заявок открыт",
  "form.archive": "Форма в архиве",
  "form.restore": "Форма возвращена из архива",
  "form.purge": "Форма стёрта",
};

// ── Платформенный журнал audit_logs (суперадмин) ──

/**
 * Запись в журнал действий.
 *
 * Тот же документ, что пишут writeAuditLog в server.ts и audit в
 * placementRoutes: одинаковая форма важнее удобства, иначе журнал
 * суперадмина и кабинет показывают разное про одно и то же событие.
 *
 * Отдельным модулем, а не импортом из server.ts: writeAuditLog оттуда не
 * экспортируется, а server.ts сам импортирует роутеры — обращение назад
 * замкнуло бы цикл зависимостей.
 *
 * Пишем и забываем: журнал не должен задерживать или ронять то действие,
 * которое записывает. Потерять строку журнала плохо, потерять из-за неё
 * заявку человека — намного хуже.
 */
export function audit(action: string, tenantId: string, fields: Record<string, unknown> = {}): void {
  admin.firestore().collection("audit_logs").add({
    timestamp: admin.firestore.Timestamp.now(),
    createdAt: new Date().toISOString(),
    action,
    tenantId: tenantId || "unknown",
    ...fields,
  }).catch(() => {});
}
