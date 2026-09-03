import admin from "firebase-admin";
import { encodePermissionCodes, hasFullAccess } from "../shared/permissions.js";
import { membershipPermissions } from "./access.js";

type Db = FirebaseFirestore.Firestore;

export interface TenantClaims {
  tenantIds: string[];
  /** Организации, где у человека есть право управлять командой или настройками. */
  tenantAdminIds: string[];
  isSuperadmin: boolean;
  /** Коды прав по организациям: "*" — полный доступ, иначе "tr,cm,…". */
  pc: Record<string, string>;
}

/** Firebase отводит на все claims 1000 байт; оставляем запас. */
const CLAIMS_BUDGET = 900;

/**
 * Claims считаются из ПРАВ, а не из названия роли.
 *
 * Раньше tenantAdminIds получал тот, чья роль называлась «admin» или
 * содержала подстроку «Руководитель». Должность «Руководитель смены» без
 * единой галочки становилась администратором Firestore и могла переписать
 * любое членство, включая своё; а «Менеджер по персоналу» с правом
 * «Управление сотрудниками» — не могла ничего.
 */
export async function buildClaims(db: Db, uid: string): Promise<TenantClaims> {
  const [ms, sa] = await Promise.all([
    db.collection("memberships").where("userId", "==", uid).where("status", "==", "active").get(),
    db.collection("superadmins").doc(uid).get(),
  ]);
  const tenantIds: string[] = [];
  const tenantAdminIds: string[] = [];
  const pc: Record<string, string> = {};

  for (const d of ms.docs) {
    const m = d.data();
    const t = String(m.tenantId || "");
    if (!t) continue;
    if (!tenantIds.includes(t)) tenantIds.push(t);

    const perms = await membershipPermissions(db, m);
    const full = hasFullAccess(m.role);
    if (full || perms.has("team:manage") || perms.has("settings:manage")) {
      if (!tenantAdminIds.includes(t)) tenantAdminIds.push(t);
    }
    // Несколько членств в одной организации складываются.
    const code = full ? "*" : encodePermissionCodes(perms);
    if (pc[t] === "*" || code === "*") pc[t] = "*";
    else pc[t] = [...new Set([...(pc[t] ? pc[t].split(",") : []), ...code.split(",")].filter(Boolean))].join(",");
  }

  const claims: TenantClaims = { tenantIds, tenantAdminIds, isSuperadmin: sa.exists, pc };
  // Если не влезает в бюджет — снимаем коды у самых «толстых» организаций.
  // Правила там деградируют к запрету; серверные проверки не зависят от claims.
  while (JSON.stringify(claims).length > CLAIMS_BUDGET && Object.keys(claims.pc).length) {
    const fattest = Object.entries(claims.pc).sort((a, b) => b[1].length - a[1].length)[0][0];
    delete claims.pc[fattest];
  }
  return claims;
}

const sortedEq = (a: unknown, b: unknown) =>
  JSON.stringify([...(Array.isArray(a) ? a : [])].map(String).sort())
  === JSON.stringify([...(Array.isArray(b) ? b : [])].map(String).sort());

const pcEq = (a: unknown, b: Record<string, string>) => {
  const x = a && typeof a === "object" ? a as Record<string, string> : {};
  const ka = Object.keys(x).sort(), kb = Object.keys(b).sort();
  if (ka.join() !== kb.join()) return false;
  return ka.every(k => sortedEq(String(x[k]).split(","), b[k].split(",")));
};

export function claimsEqual(next: TenantClaims, current: any): boolean {
  return Boolean(current?.isSuperadmin) === next.isSuperadmin
    && sortedEq(current?.tenantIds, next.tenantIds)
    && sortedEq(current?.tenantAdminIds, next.tenantAdminIds)
    && pcEq(current?.pc, next.pc);
}

/**
 * Пересчитать и записать claims пользователя. Возвращает true, если они
 * изменились — клиенту тогда нужно обновить токен.
 */
export async function syncClaims(db: Db, uid: string, current?: any): Promise<boolean> {
  if (!uid) return false;
  const next = await buildClaims(db, uid);
  let cur = current;
  if (cur === undefined) {
    try { cur = (await admin.auth().getUser(uid)).customClaims || {}; } catch { cur = {}; }
  }
  if (claimsEqual(next, cur)) return false;
  await admin.auth().setCustomUserClaims(uid, next as any);
  return true;
}
