import { useMemo, useState } from "react";
import { X, Check, Loader2, Lock, Info } from "lucide-react";
import {
  PERMISSIONS, ORG_MODULES, WORKSPACE_SCREENS,
  resolvePermissions, migrateLegacyPermissions, hasFullAccess, navAllowed,
  type PermissionKey,
} from "../../../shared/permissions";

/**
 * Карточка доступа сотрудника: должность + личные права + итог.
 *
 * Доступ складывается из двух слоёв. Должность даёт базовый набор — его
 * здесь не снять, только сменив должность. Личные галочки добавляют права
 * сверху. Итог — то, что сотрудник реально увидит в меню, — показан тут же,
 * вместе с причиной по каждому праву: от должности, личное, выключено
 * организацией. Владелец больше не гадает, «почему у Айгуль нет CRM».
 *
 * Выдать можно только то, что есть у самого: чужие права задизейблены.
 */
type Role = { id: string; name: string; permissions: PermissionKey[] };

interface Props {
  member: any;
  roles: Role[];
  /** Организация из /api/tenants/my — модули, экраны и права вызывающего. */
  tenant: any;
  busy: boolean;
  onClose: () => void;
  onSave: (patch: { customRoleId: string | null; permissions: PermissionKey[] }) => Promise<void>;
}

export default function EmployeeAccessModal({ member, roles, tenant, busy, onClose, onSave }: Props) {
  const systemRole = hasFullAccess(member?.role);
  const [roleId, setRoleId] = useState<string>(member?.customRoleId ? String(member.customRoleId) : "");
  const [personal, setPersonal] = useState<Set<PermissionKey>>(
    () => new Set(migrateLegacyPermissions(member || {})),
  );

  const disabledModules: string[] = Array.isArray(tenant?.disabledModules) ? tenant.disabledModules : [];
  const disabledScreens: string[] = Array.isArray(tenant?.disabledScreens) ? tenant.disabledScreens : [];

  const fromRole = useMemo(
    () => new Set<PermissionKey>(roles.find(r => r.id === roleId)?.permissions || []),
    [roles, roleId],
  );
  const moduleOff = useMemo(
    () => new Set<PermissionKey>(ORG_MODULES.filter(m => disabledModules.includes(m.key)).flatMap(m => m.permissions)),
    [disabledModules],
  );
  const callerGranted = useMemo(
    () => new Set<PermissionKey>(Array.isArray(tenant?.effectivePermissions) ? tenant.effectivePermissions : []),
    [tenant?.effectivePermissions],
  );
  const hadBefore = useMemo(() => new Set<PermissionKey>(migrateLegacyPermissions(member || {})), [member]);

  const effective = useMemo(() => resolvePermissions({
    role: member?.role,
    permissions: [...personal],
    rolePermissions: [...fromRole],
    disabledModules,
  }), [member?.role, personal, fromRole, disabledModules]);

  const visibleScreens = useMemo(
    () => WORKSPACE_SCREENS.filter(s => navAllowed(s.key, effective, disabledScreens)),
    [effective, disabledScreens],
  );

  const legacy = !Array.isArray(member?.permissions)
    || (Array.isArray(member?.customPermissions) && member.customPermissions.length > 0);

  const categories = [...new Set(PERMISSIONS.map(p => p.category))];

  const toggle = (key: PermissionKey) => setPersonal(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const save = () => void onSave({ customRoleId: roleId || null, permissions: [...personal] });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => !busy && onClose()}>
      <div onClick={e => e.stopPropagation()}
        className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl"
        data-testid="employee-access-modal">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-bold truncate">{member?.displayName || member?.email || "Сотрудник"}</h2>
            <p className="text-xs text-[var(--text-muted)]">{member?.email || ""}</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-main)] shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {systemRole ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
            <div className="font-bold text-emerald-600 flex items-center gap-2"><Lock className="w-4 h-4" /> Полный доступ</div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Владелец или администратор организации видит всё. Изменить это можно только сменой роли — её выдаёт владелец.
            </p>
          </div>
        ) : (
          <>
            {legacy && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-700 flex gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                Права этого сотрудника хранятся в устаревшем формате. При сохранении они будут переведены в новый — набор доступа не изменится.
              </div>
            )}

            <div>
              <label className="block text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1.5">Должность</label>
              <select value={roleId} onChange={e => setRoleId(e.target.value)} disabled={busy}
                data-testid="employee-role-select"
                className="w-full px-3 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-sm">
                <option value="">Без должности — только личные права</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name} · {r.permissions?.length || 0} прав</option>)}
              </select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase font-mono font-bold text-[var(--text-muted)]">Личные права сверх должности</div>
                <div className="text-xs text-[var(--text-muted)]">
                  Итог: <b className="text-[var(--text-main)]" data-testid="effective-count">{effective.size}</b> из {PERMISSIONS.length}
                </div>
              </div>
              {categories.map(cat => (
                <div key={cat} className="space-y-1">
                  <div className="text-[11px] font-bold text-[var(--text-muted)]">{cat}</div>
                  {PERMISSIONS.filter(p => p.category === cat).map(p => {
                    const byRole = fromRole.has(p.key);
                    const off = moduleOff.has(p.key);
                    const own = personal.has(p.key);
                    const cannotGrant = !callerGranted.has(p.key) && !hadBefore.has(p.key);
                    const checked = own || byRole;
                    const disabled = busy || byRole || off || (cannotGrant && !own);
                    const hint = off ? "Модуль выключен для всей организации"
                      : byRole ? "Даёт должность — снять можно сменой должности"
                      : cannotGrant ? "У вас нет этого права — выдать его нельзя" : "";
                    return (
                      <label key={p.key} title={hint}
                        data-testid={`perm-${p.key}`}
                        className={`flex items-start gap-2.5 py-1 rounded-lg px-1 ${disabled ? "opacity-70" : "cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"}`}>
                        <input type="checkbox" className="mt-0.5" checked={checked} disabled={disabled}
                          onChange={() => toggle(p.key)} />
                        <span className="min-w-0 flex-1">
                          <span className={`text-sm font-semibold ${off ? "line-through" : ""}`}>{p.label}</span>
                          <span className="block text-[11px] text-[var(--text-muted)]">{p.description}</span>
                        </span>
                        <span className="shrink-0 flex gap-1">
                          {byRole && <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">от должности</span>}
                          {own && !byRole && !off && <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 border border-sky-500/20">личное</span>}
                          {off && <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-500 border border-slate-500/20">выключено организацией</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-color)] p-3">
              <div className="text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1.5">
                Что увидит в меню · {visibleScreens.length} из {WORKSPACE_SCREENS.length}
              </div>
              <div className="flex flex-wrap gap-1" data-testid="visible-screens">
                {visibleScreens.map(s => (
                  <span key={s.key} className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)]">{s.label}</span>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-[var(--border-color)]">
              <button onClick={onClose} disabled={busy}
                className="flex-1 py-2.5 rounded-xl border border-[var(--border-color)] font-bold text-sm">Отмена</button>
              <button onClick={save} disabled={busy} data-testid="employee-access-save"
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Сохранить
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
