import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Lock } from "lucide-react";
import { Button, EmptyState, PageHeader, Spinner, Table, Tabs, toast, useUrlTab } from "../../../components/ui";
import type { PermissionKey } from "../../../shared/permissions";
import { auth } from "../../../lib/firebase";
import EmployeeAccessModal from "../settings/EmployeeAccessModal";
import ActionMenu from "./ActionMenu";
import { STATUS_LABEL, STATUS_STYLE, apiCall, errText, fmtDate, post, useAdminCtx, type AuditEventRow, type StaffStatus } from "./api";
import { runStaffAction, staffMenu, type StaffActionKind } from "./staffActions";
import { AuditList } from "./AuditPage";
import { PlacementModal, placementLine } from "./PlacementFields";
import { put } from "./api";
import type { StaffDirectory, StaffPlacement } from "../../../shared/staffPlacement";

interface Card {
  staff: { uid: string; name: string; email: string; role: string; roleName: string; systemRole: "owner" | "admin" | null; status: StaffStatus; lastSeenAt: number | null; joinedAt: number | null; isSelf: boolean; placement: StaffPlacement; teacher: boolean };
  directory: StaffDirectory;
  access: { full: boolean; role: { id: string; name: string } | null; permissions: { key: string; label: string; granted: boolean; via: string[]; moduleOff: boolean }[] };
  member: any;
  activity: AuditEventRow[];
  history: AuditEventRow[];
  logins: { at: number; device: string; ip: string; status: string }[];
  canManage: boolean;
}
type Tab = "access" | "activity" | "logins";
const TABS = [{ id: "access", label: "Доступ" }, { id: "activity", label: "Активность" }, { id: "logins", label: "Входы" }] as const;
const viaText = (v: string) => v.startsWith("role:") ? `Роль: ${v.slice(5)}` : v.startsWith("position:") ? `Должность: ${v.slice(9)}` : "Личное право";

export default function StaffCard() {
  const { uid = "" } = useParams();
  const { tenant, tenantId, base } = useAdminCtx();
  const [tab, setTab] = useUrlTab<Tab>("tab", TABS, "access");
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState("");
  const [roles, setRoles] = useState<{ id: string; name: string; permissions: PermissionKey[]; teacher?: boolean }[]>([]);
  const [placing, setPlacing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId || !uid) return;
    try { setCard(await apiCall<Card>(`/api/tenants/${tenantId}/staff/${encodeURIComponent(uid)}`)); setError(""); }
    catch (e) { setError(errText(e)); }
  }, [tenantId, uid]);
  useEffect(() => { void load(); }, [load]);

  const openEditor = async () => {
    try {
      if (!roles.length) setRoles((await apiCall<{ roles: any[] }>(`/api/tenants/${tenantId}/roles`)).roles || []);
      setEditing(true);
    } catch (e) { toast.error(errText(e)); }
  };
  const saveAccess = async (patch: { customRoleId: string | null; permissions: PermissionKey[] }) => {
    if (!card) return;
    setBusy(true);
    try {
      await post(`/api/tenants/${tenantId}/members/${card.member.id}/role`, patch);
      toast.success("Доступ сохранён");
      setEditing(false); await load();
      // Учительская должность — сразу спросить классы, если их ещё нет.
      if (patch.customRoleId && roles.find(r => r.id === patch.customRoleId)?.teacher && !card.staff.placement.grades.length) setPlacing(true);
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  const savePlacement = async (placement: StaffPlacement) => {
    try { await put(`/api/tenants/${tenantId}/staff/${encodeURIComponent(uid)}/placement`, { placement }); toast.success("Сохранено"); setPlacing(false); await load(); }
    catch (e) { toast.error(errText(e)); }
  };

  if (error) return <EmptyState title={error} action={<Link to={`${base}/admin/staff`} className="text-sm text-[var(--accent)]">К списку</Link>} />;
  if (!card) return <Spinner />;
  const s = card.staff;
  const isSelf = s.uid === auth.currentUser?.uid;
  const run = async (k: StaffActionKind) => { if (await runStaffAction(tenantId, k, s)) await load(); };
  const granted = card.access.permissions.filter(p => p.granted);

  return (
    <div className="max-w-5xl mx-auto">
      <Link to={`${base}/admin/staff`} className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-main)]">
        <ArrowLeft className="h-4 w-4" /> Сотрудники
      </Link>
      <PageHeader
        title={<span className="flex items-center gap-3">{s.name || s.email}<span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status]}`}>{STATUS_LABEL[s.status]}</span></span>}
        actions={<ActionMenu actions={staffMenu(s, card.canManage, isSelf, k => void run(k))} />}
        tabs={<Tabs tabs={TABS.map(t => ({ ...t }))} value={tab} onChange={id => setTab(id as Tab)} />} />
      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--text-muted)]">
        {s.email && <span>{s.email}</span>}
        <span>{s.roleName}</span>
        <span>Последний вход: {fmtDate(s.lastSeenAt)}</span>
        <span>В организации с {fmtDate(s.joinedAt)}</span>
      </div>
      <div className={`mb-4 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm ${s.teacher && !s.placement.grades.length ? "border-amber-500/40 bg-amber-500/10" : "border-[var(--border-color)]"}`}>
        <span className="text-[var(--text-muted)]">Где работает:</span>
        <span className="text-[var(--text-main)]">{placementLine(s.placement) || (s.teacher ? "не указаны классы" : "—")}</span>
        {card.canManage && <button type="button" className="ml-auto text-sm text-[var(--accent)] hover:underline" onClick={() => setPlacing(true)}>Изменить</button>}
      </div>

      {tab === "access" && (
        <div>
          {card.canManage && !isSelf && <div className="mb-3"><Button onClick={() => void openEditor()}>Изменить доступ</Button></div>}
          {card.access.full ? <EmptyState icon={<Lock />} title="Полный доступ" /> : (
            <Table minWidth={520}>
              <thead><tr><th>Право</th><th>Откуда</th><th className="w-24">Действует</th></tr></thead>
              <tbody>
                {card.access.permissions.filter(p => p.via.length).map(p => (
                  <tr key={p.key}>
                    <td>{p.label}</td>
                    <td className="text-[var(--text-muted)]">{p.via.map(viaText).join(", ")}</td>
                    <td>{p.granted ? <Check className="h-4 w-4 text-emerald-500" aria-label="Да" /> : <span className="text-xs text-amber-600 dark:text-amber-400">Модуль выключен</span>}</td>
                  </tr>
                ))}
                {!granted.length && !card.access.permissions.some(p => p.via.length) && <tr><td colSpan={3} className="text-center text-[var(--text-muted)]">Прав нет</td></tr>}
              </tbody>
            </Table>
          )}
        </div>
      )}
      {tab === "activity" && (
        <div className="space-y-6">
          <section><h2 className="mb-2 text-sm font-semibold">Что делал</h2><AuditList events={card.activity} empty="Действий нет" /></section>
          <section><h2 className="mb-2 text-sm font-semibold">Что делали с ним</h2><AuditList events={card.history} empty="Изменений нет" /></section>
        </div>
      )}
      {tab === "logins" && (!card.logins.length ? <EmptyState title="Входов нет" /> : (
        <Table minWidth={520}>
          <thead><tr><th>Время</th><th>Устройство</th><th>IP</th><th>Результат</th></tr></thead>
          <tbody>{card.logins.map((l, i) => (
            <tr key={i}><td className="whitespace-nowrap">{fmtDate(l.at)}</td><td>{l.device || "—"}</td><td>{l.ip || "—"}</td><td>{l.status || "—"}</td></tr>
          ))}</tbody>
        </Table>
      ))}

      {placing && <PlacementModal title={`Где работает · ${s.name || s.email}`} value={s.placement} directory={card.directory} onClose={() => setPlacing(false)} onSave={savePlacement} />}
      {editing && card.member && (
        <EmployeeAccessModal member={card.member} roles={roles} tenant={tenant} busy={busy}
          onClose={() => !busy && setEditing(false)} onSave={saveAccess} />
      )}
    </div>
  );
}
