import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Shield, Plus, Trash2, Check, Loader2, Users, EyeOff, X } from "lucide-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";
import {
  PERMISSIONS, ROLE_PRESETS, ORG_MODULES, migrateLegacyPermissions,
  type PermissionKey,
} from "../../../shared/permissions";

/**
 * Должности, права и модули организации — один экран вместо трёх.
 *
 * Раньше права жили на двух экранах, писались в разные поля и складывались по
 * ИЛИ: запрет в «Правах и сотрудниках» молча отменялся «Матрицей PBAC».
 * Здесь единственное место, где выдаётся доступ, и то, что здесь снято, снято
 * по-настоящему.
 *
 * Должности задаёт владелец: у каждой компании свои названия и свой набор
 * обязанностей — фиксированный список «менеджер/преподаватель/проктор»
 * подходил только школе.
 */

type Role = { id: string; name: string; description?: string; permissions: PermissionKey[]; memberCount?: number };

async function authHeaders() {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export default function RolesAndAccess() {
  const ctx = useOutletContext<{ activeTenant?: any; refreshTenants?: () => void } | null>();
  const tenant = ctx?.activeTenant;
  const tenantId = tenant?.id;

  const [tab, setTab] = useState<"roles" | "staff" | "modules">("roles");
  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editing, setEditing] = useState<Role | null>(null);
  const [disabled, setDisabled] = useState<string[]>([]);

  const say = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(null), 5000); };

  const loadRoles = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/roles`, { headers: await authHeaders() });
      const j = await res.json();
      if (!j.success) { setError(j.error || "Не удалось загрузить должности"); return; }
      setRoles(j.roles || []);
    } catch { setError("Нет связи с сервером"); }
    finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { void loadRoles(); }, [loadRoles]);
  useEffect(() => { setDisabled(Array.isArray(tenant?.disabledModules) ? tenant.disabledModules : []); }, [tenant?.disabledModules]);

  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, "memberships"), where("tenantId", "==", tenantId));
    return onSnapshot(q, snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => setError("Не удалось загрузить сотрудников"));
  }, [tenantId]);

  const saveRole = async (role: Role) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/roles`, {
        method: "POST", headers: await authHeaders(),
        body: JSON.stringify({
          roleId: role.id.startsWith("new_") ? undefined : role.id,
          name: role.name, description: role.description, permissions: role.permissions,
        }),
      });
      const j = await res.json();
      if (!j.success) { setError(j.error || "Не удалось сохранить"); return; }
      setEditing(null); say("Должность сохранена"); void loadRoles();
    } catch { setError("Нет связи с сервером"); }
    finally { setBusy(false); }
  };

  const deleteRole = async (role: Role) => {
    if (!confirm(`Удалить должность «${role.name}»?`)) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/roles/${role.id}`, {
        method: "DELETE", headers: await authHeaders(),
      });
      const j = await res.json();
      if (!j.success) { setError(j.error || "Не удалось удалить"); return; }
      say("Должность удалена"); void loadRoles();
    } catch { setError("Нет связи с сервером"); }
    finally { setBusy(false); }
  };

  const assignRole = async (membershipId: string, customRoleId: string) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/members/${membershipId}/role`, {
        method: "POST", headers: await authHeaders(),
        body: JSON.stringify({ customRoleId: customRoleId || null }),
      });
      const j = await res.json();
      if (!j.success) { setError(j.error || "Не удалось назначить"); return; }
      say("Должность назначена. Сотрудник увидит изменения после перезагрузки страницы.");
      void loadRoles();
    } catch { setError("Нет связи с сервером"); }
    finally { setBusy(false); }
  };

  const saveModules = async (next: string[]) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/modules`, {
        method: "PUT", headers: await authHeaders(),
        body: JSON.stringify({ disabledModules: next }),
      });
      const j = await res.json();
      if (!j.success) { setError(j.error || "Не удалось сохранить"); return; }
      setDisabled(next);
      say("Настройка модулей сохранена. Пункты пропадут у всех после перезагрузки.");
      ctx?.refreshTenants?.();
    } catch { setError("Нет связи с сервером"); }
    finally { setBusy(false); }
  };

  const categories = [...new Set(PERMISSIONS.map(p => p.category))];
  const roleName = (m: any) => roles.find(r => r.id === m.customRoleId)?.name || m.role || "—";

  if (!tenant) return <div className="py-16 text-center text-[var(--text-muted)] text-sm">Загрузка организации…</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-5 text-[var(--text-main)]">
      <div className="border-b border-[var(--border-color)] pb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-emerald-500" /> Роли и доступы
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {tenant.name} · должности компании, права сотрудников и видимость разделов
        </p>
      </div>

      <div className="flex gap-1 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl p-1 text-xs w-fit">
        {([["roles", `Должности (${roles.length})`], ["staff", `Сотрудники (${members.length})`], ["modules", "Модули"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-lg font-bold transition ${
              tab === k ? "bg-[var(--bg-surface)] text-emerald-500 shadow-xs" : "text-[var(--text-muted)]"}`}>
            {label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-500">{error}</div>}
      {notice && <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm text-emerald-600">{notice}</div>}

      {/* ── Должности ────────────────────────────────────────────────── */}
      {tab === "roles" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={() => setEditing({ id: `new_${Date.now()}`, name: "", description: "", permissions: [] })}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Новая должность
            </button>
            <span className="text-xs text-[var(--text-muted)]">или из готовых:</span>
            {ROLE_PRESETS.map(p => (
              <button key={p.name}
                onClick={() => setEditing({ id: `new_${Date.now()}`, name: p.name, description: p.description, permissions: [...p.permissions] })}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-xs font-semibold hover:border-emerald-500/50">
                {p.name}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-12 text-center text-[var(--text-muted)] text-sm">
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : roles.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-muted)] text-sm border border-dashed border-[var(--border-color)] rounded-2xl">
              Должностей пока нет. Создайте свою или возьмите готовую — права можно поменять в любой момент.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {roles.map(r => (
                <div key={r.id} className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold truncate">{r.name}</div>
                      {r.description && <div className="text-xs text-[var(--text-muted)]">{r.description}</div>}
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 shrink-0">
                      <Users className="w-3.5 h-3.5" /> {r.memberCount || 0}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Прав: <b className="text-[var(--text-main)]">{r.permissions?.length || 0}</b> из {PERMISSIONS.length}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEditing({ ...r, permissions: [...(r.permissions || [])] })}
                      className="text-xs font-bold text-emerald-500 hover:underline">Изменить</button>
                    <button onClick={() => void deleteRole(r)}
                      className="text-xs font-bold text-[var(--text-muted)] hover:text-red-500 flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" /> Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Сотрудники ───────────────────────────────────────────────── */}
      {tab === "staff" && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-panel)] text-[11px] uppercase font-mono text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3 text-left">Сотрудник</th>
                <th className="px-4 py-3 text-left">Должность</th>
                <th className="px-4 py-3 text-left w-56">Назначить</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => {
                const systemRole = ["owner", "org:owner", "admin", "org:admin"].includes(String(m.role));
                return (
                  <tr key={m.id} className="border-t border-[var(--border-color)]">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{m.displayName || m.email || m.userId?.slice(0, 8)}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{m.email || ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={systemRole ? "text-emerald-500 font-bold" : ""}>{roleName(m)}</span>
                      {systemRole && <div className="text-[11px] text-[var(--text-muted)]">полный доступ</div>}
                    </td>
                    <td className="px-4 py-3">
                      {systemRole ? (
                        <span className="text-[11px] text-[var(--text-muted)]">владельца не меняем</span>
                      ) : (
                        <select value={m.customRoleId || ""} disabled={busy}
                          onChange={e => void assignRole(m.id, e.target.value)}
                          className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 text-xs">
                          <option value="">Без должности</option>
                          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
              {members.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-10 text-center text-[var(--text-muted)] text-sm">
                  Сотрудников пока нет. Добавьте их в разделе «Права &amp; Сотрудники».
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Модули организации ───────────────────────────────────────── */}
      {tab === "modules" && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-muted)]">
            Выключенный модуль исчезает из меню у ВСЕХ сотрудников, включая тех,
            кому право выдано должностью. Так убирают разделы, которыми компания не пользуется.
          </p>
          {ORG_MODULES.map(mod => {
            const off = disabled.includes(mod.key);
            return (
              <label key={mod.key}
                className="flex items-start gap-3 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 cursor-pointer">
                <input type="checkbox" checked={!off} disabled={busy}
                  onChange={e => void saveModules(e.target.checked
                    ? disabled.filter(k => k !== mod.key)
                    : [...disabled, mod.key])}
                  className="mt-1 w-5 h-5" />
                <span className="min-w-0">
                  <span className="font-bold flex items-center gap-2">
                    {mod.label}
                    {off && <span className="text-[10px] uppercase font-mono text-[var(--text-muted)] flex items-center gap-1">
                      <EyeOff className="w-3 h-3" /> скрыт
                    </span>}
                  </span>
                  <span className="block text-xs text-[var(--text-muted)]">{mod.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      )}

      {/* ── Редактор должности ───────────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !busy && setEditing(null)}>
          <div onClick={e => e.stopPropagation()}
            className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{editing.id.startsWith("new_") ? "Новая должность" : "Изменить должность"}</h2>
              <button onClick={() => setEditing(null)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
              placeholder="Название должности — например, «Старший администратор»"
              className="w-full px-3 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-sm" />
            <input value={editing.description || ""} onChange={e => setEditing({ ...editing, description: e.target.value })}
              placeholder="Кратко: чем занимается"
              className="w-full px-3 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-sm" />

            {categories.map(cat => (
              <div key={cat} className="space-y-1.5">
                <div className="text-[11px] uppercase font-mono font-bold text-[var(--text-muted)]">{cat}</div>
                {PERMISSIONS.filter(p => p.category === cat).map(p => (
                  <label key={p.key} className="flex items-start gap-2.5 cursor-pointer py-0.5">
                    <input type="checkbox" className="mt-0.5"
                      checked={editing.permissions.includes(p.key)}
                      onChange={e => setEditing({
                        ...editing,
                        permissions: e.target.checked
                          ? [...editing.permissions, p.key]
                          : editing.permissions.filter(k => k !== p.key),
                      })} />
                    <span className="min-w-0">
                      <span className="text-sm font-semibold">{p.label}</span>
                      <span className="block text-[11px] text-[var(--text-muted)]">{p.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            ))}

            <div className="flex gap-2 pt-2 border-t border-[var(--border-color)]">
              <button onClick={() => setEditing(null)} disabled={busy}
                className="flex-1 py-2.5 rounded-xl border border-[var(--border-color)] font-bold text-sm">Отмена</button>
              <button onClick={() => void saveRole(editing)} disabled={busy || !editing.name.trim()}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
