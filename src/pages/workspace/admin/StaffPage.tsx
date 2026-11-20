import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, UserPlus, Users } from "lucide-react";
import { Button, EmptyState, PageHeader, Spinner, Table, Tabs, input, useUrlTab } from "../../../components/ui";
import { STATUS_LABEL, STATUS_STYLE, apiCall, errText, fmtDate, useAdminCtx, type StaffRow, type StaffStatus } from "./api";
import ActionMenu from "./ActionMenu";
import { runStaffAction, staffMenu, type StaffActionKind } from "./staffActions";
import WhoCanPanel from "./WhoCanPanel";
import OwnershipPanel from "./OwnershipPanel";
import { auth } from "../../../lib/firebase";

type Tab = "staff" | "who" | "owner";

export default function StaffPage() {
  const { tenantId, base, can, isOwner } = useAdminCtx();
  const nav = useNavigate();
  const tabs = [
    { id: "staff", label: "Сотрудники" },
    { id: "who", label: "Кто может…" },
    { id: "owner", label: "Передача владения", hidden: !isOwner },
  ] as const;
  const [tab, setTab] = useUrlTab<Tab>("tab", tabs, "staff");

  const [rows, setRows] = useState<StaffRow[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | StaffStatus>("");
  const [role, setRole] = useState("");

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const j = await apiCall<{ staff: StaffRow[]; canManage: boolean }>(`/api/tenants/${tenantId}/staff`);
      setRows(j.staff); setCanManage(j.canManage); setError("");
    } catch (e) { setError(errText(e)); setRows([]); }
  }, [tenantId]);
  useEffect(() => { void load(); }, [load]);

  const roleNames = useMemo(() => [...new Set((rows || []).map(r => r.roleName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru")), [rows]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows || []).filter(r => (!status || r.status === status) && (!role || r.roleName === role)
      && (!needle || `${r.name} ${r.email} ${r.departmentName}`.toLowerCase().includes(needle)));
  }, [rows, q, status, role]);

  const run = async (s: StaffRow, k: StaffActionKind) => { if (await runStaffAction(tenantId, k, s)) void load(); };
  const me = auth.currentUser?.uid;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Сотрудники"
        actions={can("team:manage") && <Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => nav(`${base}/settings/roles?tab=staff`)}>Пригласить</Button>}
        tabs={<Tabs tabs={tabs.map(t => ({ ...t }))} value={tab} onChange={id => setTab(id as Tab)} />} />

      {tab === "who" && <WhoCanPanel tenantId={tenantId} base={base} />}
      {tab === "owner" && isOwner && <OwnershipPanel tenantId={tenantId} onDone={load} />}
      {tab === "staff" && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск" aria-label="Поиск" className={`${input} !pl-9`} />
            </div>
            <select value={status} onChange={e => setStatus(e.target.value as "" | StaffStatus)} aria-label="Статус" className={`${input} !w-auto`}>
              <option value="">Все статусы</option>
              {(Object.keys(STATUS_LABEL) as StaffStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <select value={role} onChange={e => setRole(e.target.value)} aria-label="Должность" className={`${input} !w-auto`}>
              <option value="">Все должности</option>
              {roleNames.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {error && <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">{error}</div>}
          {!rows ? <Spinner /> : !shown.length ? (
            <EmptyState icon={<Users />} title={rows.length ? "Никого не найдено" : "Сотрудников нет"} />
          ) : (
            <Table minWidth={760}>
              <thead><tr><th>Сотрудник</th><th>Должность</th><th>Отдел</th><th>Статус</th><th>Последний вход</th><th className="w-12" /></tr></thead>
              <tbody>
                {shown.map(s => (
                  <tr key={s.uid} className="cursor-pointer" onClick={() => nav(`${base}/admin/staff/${encodeURIComponent(s.uid)}`)}>
                    <td>
                      <Link to={`${base}/admin/staff/${encodeURIComponent(s.uid)}`} onClick={e => e.stopPropagation()} className="font-medium hover:underline">{s.name || s.email || s.uid}</Link>
                      {s.email && s.name !== s.email && <div className="text-xs text-[var(--text-muted)]">{s.email}</div>}
                    </td>
                    <td>{s.roleName}</td>
                    <td className="text-[var(--text-muted)]">{s.departmentName || "—"}</td>
                    <td><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status]}`}>{STATUS_LABEL[s.status]}</span></td>
                    <td className="text-[var(--text-muted)] whitespace-nowrap">{s.status === "invited" ? "—" : fmtDate(s.lastSeenAt)}</td>
                    <td className="text-right"><ActionMenu actions={staffMenu(s, canManage, s.uid === me, k => void run(s, k))} /></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}
