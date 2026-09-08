import admin from "firebase-admin";

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
