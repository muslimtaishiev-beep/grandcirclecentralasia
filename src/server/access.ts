import {
  ALL_PERMISSION_KEYS, PERMISSIONS, hasFullAccess, isPermissionKey, migrateLegacyPermissions,
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

/**
 * Активные сотрудники организации, у которых есть хотя бы одно из прав —
 * адресаты уведомлений. Должности читаются по разу на всю выборку.
 */
export async function membersWith(db: Db, tenantId: string, anyOf: PermissionKey[]): Promise<{ uid: string; name: string }[]> {
  const ms = await db.collection("memberships").where("tenantId", "==", tenantId).where("status", "==", "active").get();
  const roles = new Map<string, Promise<Set<PermissionKey>>>();
  const rolePerms = (id: string) => {
    if (!roles.has(id)) roles.set(id, db.collection("custom_roles").doc(id).get()
      .then(r => new Set<PermissionKey>((r.exists ? r.data()?.permissions || [] : []).filter(isPermissionKey))));
    return roles.get(id)!;
  };
  const out = new Map<string, string>();
  for (const d of ms.docs) {
    const m: any = d.data();
    if (!m.userId) continue;
    let ok = hasFullAccess(m.role) || migrateLegacyPermissions(m).some(p => anyOf.includes(p));
    if (!ok && m.customRoleId) { const rp = await rolePerms(String(m.customRoleId)); ok = anyOf.some(p => rp.has(p)); }
    if (ok) out.set(String(m.userId), String(m.displayName || ""));
  }
  return [...out].map(([uid, name]) => ({ uid, name }));
}

/** Есть ли у пользователя хотя бы одно из прав в организации. */
export async function hasAnyPermission(db: Db, user: any, tenantId: string, anyOf: PermissionKey[]): Promise<boolean> {
  const mine = await callerPermissions(db, user?.uid, tenantId, user);
  return anyOf.some(p => mine.has(p));
}

/** Права должности этой организации; null — должности нет или она чужая. */
export async function rolePermissions(db: Db, tenantId: string, roleId: string): Promise<{ name: string; perms: Set<PermissionKey> } | null> {
  if (!roleId) return null;
  const r = await db.collection("custom_roles").doc(String(roleId)).get();
  if (!r.exists || r.data()?.tenantId !== tenantId) return null;
  return { name: String(r.data()?.name || "Сотрудник"), perms: new Set((r.data()?.permissions || []).filter(isPermissionKey)) };
}

const isOwnerRole = (r: unknown) => ["owner", "org:owner"].includes(String(r || ""));
const permNames = (xs: PermissionKey[]) => xs.map(k => PERMISSIONS.find(p => p.key === k)?.label || k).join(", ");

/**
 * Единая защита от повышения прав — для смены должности, личных прав,
 * приглашения и правки должностей. Текст отказа или null, если можно.
 *
 *  — свой доступ не меняют (единственный владелец не запрёт организацию);
 *  — владельца меняет только владелец, администратора — владелец или администратор;
 *  — нельзя трогать сотрудника, у которого есть права шире ваших;
 *  — нельзя выдать то, чего нет у самого (grant — права ПОСЛЕ изменения).
 */
export async function accessChangeDenied(db: Db, caller: { uid: string; isSuperadmin?: boolean }, tenantId: string, target: any | null, grant: Iterable<PermissionKey>): Promise<string | null> {
  if (caller.isSuperadmin === true) return null;
  const me = await activeMembership(db, caller.uid, tenantId);
  if (!me) return "Доступно только сотрудникам организации";
  const meFull = hasFullAccess(me.role);
  const mine = await membershipPermissions(db, me);
  if (target) {
    if (target.userId && String(target.userId) === caller.uid) return "Свой доступ меняет другой владелец или администратор";
    if (isOwnerRole(target.role) && !isOwnerRole(me.role)) return "Доступ владельца меняет только владелец";
    if (hasFullAccess(target.role) && !meFull) return "Доступ администратора меняет только владелец или администратор";
    if (!meFull) {
      const over = [...(await membershipPermissions(db, target))].filter(p => !mine.has(p));
      if (over.length) return `У сотрудника есть права, которых нет у вас: ${permNames(over)}`;
    }
  }
  const excess = [...grant].filter(p => !mine.has(p));
  return excess.length ? `Нельзя выдать права, которых нет у вас: ${permNames(excess)}` : null;
}

/** Системные роли, которые может выдать вызывающий (владелец — только владелец/суперадмин). */
export function canAssignSystemRole(callerRole: unknown, isSuperadmin: boolean, target: string): boolean {
  if (isSuperadmin) return true;
  if (!hasFullAccess(callerRole)) return false;
  if (target === "org:owner") return ["owner", "org:owner"].includes(String(callerRole));
  return true;
}

// ── Кто вызывает: единая проверка для кабинета и публичных страниц ──────

export interface StaffCaller {
  uid: string;
  name: string;
  email: string;
  /** Системная роль с полным доступом (владелец, админ) или суперадмин. */
  full: boolean;
  /** Активный сотрудник этой организации. */
  member: boolean;
  perms: Set<PermissionKey>;
}

/**
 * Вызывающий в организации: членство и права. null — вход не выполнен.
 * Права модулей, выключенных у организации, сюда не попадают: экран
 * закрывает requireScreen/checkTenantOpen.
 */
export async function staffCaller(db: Db, tenantId: string, user: any): Promise<StaffCaller | null> {
  if (!user?.uid) return null;
  const uid = String(user.uid);
  const base = { uid, name: String(user.name || user.email || uid).slice(0, 120), email: String(user.email || "").toLowerCase() };
  if (user.isSuperadmin === true) return { ...base, full: true, member: true, perms: new Set(ALL_PERMISSION_KEYS) };
  const m = await activeMembership(db, uid, tenantId);
  if (!m) return { ...base, full: false, member: false, perms: new Set() };
  return { ...base, name: String(m.displayName || base.name).slice(0, 120), full: hasFullAccess(m.role), member: true, perms: await membershipPermissions(db, m) };
}

export const hasPerm = (c: StaffCaller | null | undefined, ...anyOf: PermissionKey[]) =>
  !!c && c.member && (c.full || anyOf.some(p => c.perms.has(p)));

/**
 * Вход не обязателен: токен проверяется, только если прислан. Нужен
 * публичным страницам, которые сотруднику показывают больше (скан QR).
 * Неверный токен — как без входа, а не ошибка.
 */
export function optionalAuth(verify: (token: string) => Promise<any>) {
  return async (req: any, _res: any, next: any) => {
    const token = String(req.headers.authorization || "").replace("Bearer ", "").trim();
    if (token) { try { req.user = await verify(token); } catch { /* как без входа */ } }
    next();
  };
}

/**
 * Пропускает сотрудника организации с любым из прав (полный доступ — всегда).
 * Кладёт req.caller. Организация — из параметра :tenantId.
 */
export function requirePerm(db: () => Db, ...anyOf: PermissionKey[]) {
  return async (req: any, res: any, next: any) => {
    try {
      const c = await staffCaller(db(), String(req.params.tenantId || ""), req.user);
      if (!c?.member) return res.status(403).json({ success: false, error: "Доступно только сотрудникам организации" });
      if (anyOf.length && !hasPerm(c, ...anyOf)) return res.status(403).json({ success: false, error: "Недостаточно прав" });
      req.caller = c;
      next();
    } catch (e: any) {
      console.error("[access]", e);
      return res.status(500).json({ success: false, error: "Не удалось проверить доступ" });
    }
  };
}
