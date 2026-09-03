import { useOutletContext, Link, useParams } from "react-router-dom";
import { Lock } from "lucide-react";
import { resolvePermissions, resolveScreens, type PermissionKey } from "../../shared/permissions";

/**
 * Доступ к странице воркспейса по правам.
 *
 * Скрытый пункт меню сам по себе ничего не закрывал: сотрудник без прав
 * открывал /workspace/<org>/edu/payroll по прямой ссылке и видел зарплаты
 * всей организации. Ссылки расходятся по чатам, попадают в закладки и
 * историю браузера — прятать пункт и не закрывать страницу бессмысленно.
 *
 * Отказ объясняет, что делать: к кому идти за доступом. Пустой экран без
 * объяснения человек считает поломкой и идёт жаловаться.
 */
export default function RequirePermission({
  navKey, children,
}: { navKey: string; children: React.ReactNode }) {
  const ctx = useOutletContext<{ activeTenant?: any } | null>();
  const { orgId } = useParams();
  const tenant = ctx?.activeTenant;

  // Организация ещё грузится — не мигаем отказом раньше времени.
  if (!tenant) return <>{children}</>;

  const granted = Array.isArray(tenant.effectivePermissions)
    ? new Set(tenant.effectivePermissions)
    : resolvePermissions({
        role: tenant.role,
        permissions: tenant.permissions,
        customPermissions: tenant.customPermissions,
        rolePermissions: tenant.customRole?.permissions,
        disabledModules: tenant.disabledModules,
      });

  // Три слоя: закрыто платформой, скрыто организацией, не выдано сотруднику.
  const visible = Array.isArray(tenant.visibleScreens)
    ? new Set<string>(tenant.visibleScreens)
    : new Set(resolveScreens({
        platformDisabledScreens: tenant.platformDisabledScreens,
        disabledScreens: tenant.disabledScreens,
        disabledModules: tenant.disabledModules,
        granted: granted as Set<PermissionKey>,
      }).visible);
  if (visible.has(navKey)) return <>{children}</>;

  return (
    <div className="max-w-lg mx-auto py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-color)] flex items-center justify-center mx-auto mb-4">
        <Lock className="w-6 h-6 text-[var(--text-muted)]" />
      </div>
      <h1 className="text-xl font-bold text-[var(--text-main)] mb-2">Нет доступа к этому разделу</h1>
      <p className="text-sm text-[var(--text-muted)] mb-1">
        Ваша должность — «{tenant.customRole?.name || tenant.role || "Сотрудник"}».
      </p>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        Доступ выдаёт руководитель организации в разделе «Роли и доступы».
      </p>
      <Link to={`/workspace/${orgId || tenant.id}`}
        className="inline-block px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm">
        На главную
      </Link>
    </div>
  );
}
