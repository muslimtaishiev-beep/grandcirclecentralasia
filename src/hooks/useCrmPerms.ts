import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { hasFullAccess, resolvePermissions, type PermissionKey } from '../shared/permissions';

/**
 * Права текущего сотрудника в организации — чтобы прятать кнопки, которые
 * правила базы всё равно отклонят. Источник — тот же, что у меню и
 * RequirePermission: effectivePermissions от сервера.
 */
export function useTenantAccess() {
  const ctx = useOutletContext<{ activeTenant?: any } | null>();
  const { user } = useAuth();
  const t = ctx?.activeTenant;
  return useMemo(() => {
    const granted: Set<string> = !t ? new Set() : Array.isArray(t.effectivePermissions)
      ? new Set(t.effectivePermissions)
      : resolvePermissions({ role: t.role, permissions: t.permissions, customPermissions: t.customPermissions, rolePermissions: t.customRole?.permissions, disabledModules: t.disabledModules }) as Set<string>;
    const isAdmin = hasFullAccess(t?.role) || !!(user as any)?.isSuperadmin;
    return {
      tenantId: t?.id as string | undefined,
      uid: user?.uid || '',
      name: user?.displayName || user?.email || 'Сотрудник',
      isAdmin,
      can: (p: PermissionKey) => isAdmin || granted.has(p),
    };
  }, [t, user]);
}

/** CRM: смотреть и управлять. */
export function useCrmPerms() {
  const a = useTenantAccess();
  return { ...a, canView: a.can('crm:read') || a.can('crm:manage'), canManage: a.can('crm:manage') };
}
