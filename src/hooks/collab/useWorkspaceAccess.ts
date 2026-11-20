import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { resolvePermissions, type PermissionKey } from '../../shared/permissions';

export interface WorkspaceAccess {
  uid: string | undefined;
  /** Администратор организации — как isTenantAdmin в правилах базы (метка в токене). */
  isAdmin: boolean;
  /** Есть ли у сотрудника право в этой организации. */
  can: (perm: PermissionKey) => boolean;
}

/**
 * Что сотрудник может в текущей организации — те же источники, что у правил
 * базы: права из членства и метка администратора в токене. Кнопки, которые
 * база всё равно отклонит, по этому хуку не показываются.
 */
export function useWorkspaceAccess(tenantIdArg?: string): WorkspaceAccess {
  const ctx = useOutletContext<{ activeTenant?: any } | null>();
  const tenant = ctx?.activeTenant;
  const tenantId = tenantIdArg || tenant?.id;
  const { user } = useAuth();
  const [claimAdmin, setClaimAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    const u = auth.currentUser;
    if (!u || !tenantId) { setClaimAdmin(false); return; }
    u.getIdTokenResult().then(r => {
      if (!alive) return;
      const c: any = r.claims || {};
      const ids: string[] = Array.isArray(c.tenantAdminIds) ? c.tenantAdminIds : [];
      setClaimAdmin(c.isSuperadmin === true || ids.includes(tenantId));
    }).catch(() => { if (alive) setClaimAdmin(false); });
    return () => { alive = false; };
  }, [tenantId, user?.uid]);

  const granted = useMemo<Set<string>>(() => {
    if (!tenant) return new Set();
    if (Array.isArray(tenant.effectivePermissions)) return new Set(tenant.effectivePermissions);
    return resolvePermissions({
      role: tenant.role,
      permissions: tenant.permissions,
      customPermissions: tenant.customPermissions,
      rolePermissions: tenant.customRole?.permissions,
      disabledModules: tenant.disabledModules,
    }) as Set<string>;
  }, [tenant]);

  return { uid: user?.uid, isAdmin: claimAdmin, can: (p: PermissionKey) => claimAdmin || granted.has(p) };
}
