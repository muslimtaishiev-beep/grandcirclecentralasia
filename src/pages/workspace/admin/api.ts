import { useOutletContext, useParams } from "react-router-dom";
import { apiCall, del, post, put } from "../../../lib/eduApi";
import { resolvePermissions, type PermissionKey } from "../../../shared/permissions";

export { apiCall, del, post, put };

export type StaffStatus = "active" | "invited" | "suspended";

export interface StaffRow {
  uid: string;
  membershipId: string;
  name: string;
  email: string;
  role: string;
  roleName: string;
  customRoleId: string | null;
  systemRole: "owner" | "admin" | null;
  departmentId: string | null;
  departmentName: string;
  status: StaffStatus;
  lastSeenAt: number | null;
  joinedAt: number | null;
  personalPermissions: number;
}

export interface AuditEventRow {
  id: string;
  at: number;
  actorUid: string;
  actorName?: string;
  action: string;
  actionLabel?: string;
  section: string;
  targetId?: string;
  targetName?: string;
  detail?: string;
  changes?: { label: string; from: string; to: string }[];
}

export const STATUS_LABEL: Record<StaffStatus, string> = { active: "Активен", invited: "Приглашён", suspended: "Отключён" };
export const STATUS_STYLE: Record<StaffStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  invited: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  suspended: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};
export const SECTION_LABEL: Record<string, string> = {
  access: "Доступ", staff: "Сотрудники", roles: "Должности", settings: "Настройки",
  security: "Безопасность", integrations: "Интеграции", data: "Данные",
};

const fmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const fmtDate = (ms?: number | null): string => (ms ? fmt.format(new Date(ms)) : "—");

/** Организация, права вызывающего и путь внутри кабинета. */
export function useAdminCtx() {
  const ctx = useOutletContext<{ activeTenant?: any; refreshTenants?: () => void } | null>();
  const { orgId } = useParams();
  const tenant = ctx?.activeTenant;
  const tenantId: string = String(orgId || tenant?.id || "");
  const granted: Set<PermissionKey> = Array.isArray(tenant?.effectivePermissions)
    ? new Set(tenant.effectivePermissions as PermissionKey[])
    : tenant ? (resolvePermissions({
      role: tenant.role, permissions: tenant.permissions, customPermissions: tenant.customPermissions,
      rolePermissions: tenant.customRole?.permissions, disabledModules: tenant.disabledModules,
    }) as Set<PermissionKey>) : new Set<PermissionKey>();
  const can = (...p: PermissionKey[]) => String(tenant?.role) === "superadmin" || p.some(x => granted.has(x));
  const isOwner = ["owner", "org:owner", "superadmin"].includes(String(tenant?.role || ""));
  return { tenant, tenantId, base: `/workspace/${tenantId}`, can, isOwner, refreshTenants: ctx?.refreshTenants };
}

export const errText = (e: unknown) => (e instanceof Error ? e.message : "Не удалось выполнить");
