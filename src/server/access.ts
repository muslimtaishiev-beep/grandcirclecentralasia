import {
  ALL_PERMISSION_KEYS, hasFullAccess, isPermissionKey, migrateLegacyPermissions,
  type PermissionKey,
} from "../shared/permissions.js";

type Db = FirebaseFirestore.Firestore;

/**
 * Права одного членства — единая серверная точка.
 *
 * Раньше этот расчёт был скопирован в трёх местах (requireTenantAdmin,
 * callerPermissions, приглашение) и в каждом чуть по-своему. Полный доступ
 * даёт только системная роль; остальным — личные права плюс права
 * должности. Модули организации здесь НЕ вычитаются: это делает
 * resolvePermissions там, где есть документ организации.
 */
export async function membershipPermissions(db: Db, m: any): Promise<Set<PermissionKey>> {
  if (hasFullAccess(m?.role)) return new Set(ALL_PERMISSION_KEYS);
  const own = new Set<PermissionKey>(migrateLegacyPermissions(m || {}));
  if (m?.customRoleId) {
    const r = await db.collection("custom_roles").doc(String(m.customRoleId)).get();
    if (r.exists) for (const p of (r.data()?.permissions || [])) if (isPermissionKey(p)) own.add(p);
  }
  return own;
}

/** Активное членство пользователя в организации или null. */
export async function activeMembership(db: Db, uid: string, tenantId: string): Promise<any | null> {
  if (!uid || !tenantId) return null;
  const ms = await db.collection("memberships")
    .where("userId", "==", uid).where("tenantId", "==", tenantId)
    .where("status", "==", "active").limit(1).get();
  return ms.empty ? null : { id: ms.docs[0].id, ...ms.docs[0].data() };
}

/** Права вызывающего в организации — для защиты от эскалации. */
export async function callerPermissions(db: Db, uid: string, tenantId: string, user: any): Promise<Set<PermissionKey>> {
  if (user?.isSuperadmin === true) return new Set(ALL_PERMISSION_KEYS);
  const m = await activeMembership(db, uid, tenantId);
  if (!m) return new Set();
  return membershipPermissions(db, m);
}

/** Есть ли у пользователя хотя бы одно из прав в организации. */
export async function hasAnyPermission(db: Db, user: any, tenantId: string, anyOf: PermissionKey[]): Promise<boolean> {
  const mine = await callerPermissions(db, user?.uid, tenantId, user);
  return anyOf.some(p => mine.has(p));
}

/** Системные роли, которые может выдать вызывающий (владелец — только владелец/суперадмин). */
export function canAssignSystemRole(callerRole: unknown, isSuperadmin: boolean, target: string): boolean {
  if (isSuperadmin) return true;
  if (!hasFullAccess(callerRole)) return false;
  if (target === "org:owner") return ["owner", "org:owner"].includes(String(callerRole));
  return true;
}
