import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, UserPlus, Users } from "lucide-react";
import { Button, EmptyState, PageHeader, Spinner, Table, Tabs, input, toast, useUrlTab } from "../../../components/ui";
import { STATUS_LABEL, STATUS_STYLE, apiCall, errText, fmtDate, post, useAdminCtx, type StaffRow, type StaffStatus } from "./api";
import ActionMenu from "./ActionMenu";
import { runStaffAction, staffMenu, type StaffActionKind } from "./staffActions";
import WhoCanPanel from "./WhoCanPanel";
import OwnershipPanel from "./OwnershipPanel";
import { auth } from "../../../lib/firebase";
import { BulkPlacementModal, placementLine } from "./PlacementFields";
import { SCHOOL_LEVELS, STAFF_GRADES, levelsOf, type StaffDirectory, type StaffPlacement } from "../../../shared/staffPlacement";

const RolesAndAccess = lazy(() => import("../settings/RolesAndAccess"));

type Tab = "staff" | "roles" | "who" | "owner";

export default function StaffPage() {
  const { tenantId, base, can, isOwner } = useAdminCtx();
  const nav = useNavigate();
  const tabs = [
    { id: "staff", label: "Сотрудники" },
    { id: "roles", label: "Должности" },
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
  const [inviting, setInviting] = useState(false);
  const [directory, setDirectory] = useState<StaffDirectory>({ subjects: [], groups: [] });
  const [grade, setGrade] = useState(""); const [level, setLevel] = useState(""); const [subject, setSubject] = useState(""); const [group, setGroup] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const j = await apiCall<{ staff: StaffRow[]; canManage: boolean; directory: StaffDirectory }>(`/api/tenants/${tenantId}/staff`);
      setRows(j.staff); setCanManage(j.canManage); setDirectory(j.directory || { subjects: [], groups: [] }); setError("");
    } catch (e) { setError(errText(e)); setRows([]); }
  }, [tenantId]);
  useEffect(() => { void load(); }, [load]);

  const roleNames = useMemo(() => [...new Set((rows || []).map(r => r.roleName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru")), [rows]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows || []).filter(r => (!status || r.status === status) && (!role || r.roleName === role)
      && (!grade || (grade === "none" ? r.teacher && !r.placement.grades.length : r.placement.grades.includes(Number(grade))))
      && (!level || levelsOf(r.placement).includes(level as any))
      && (!subject || r.placement.subjects.includes(subject)) && (!group || r.placement.groups.includes(group))
      && (!needle || `${r.name} ${r.email} ${r.departmentName} ${placementLine(r.placement)}`.toLowerCase().includes(needle)));
  }, [rows, q, status, role, grade, level, subject, group]);
  const subjects = useMemo(() => [...new Set([...directory.subjects, ...(rows || []).flatMap(r => r.placement.subjects)])].sort((a, b) => a.localeCompare(b, "ru")), [rows, directory]);
  const groups = useMemo(() => [...new Set([...directory.groups, ...(rows || []).flatMap(r => r.placement.groups)])].sort((a, b) => a.localeCompare(b, "ru")), [rows, directory]);
  const noGrades = (rows || []).filter(r => r.teacher && !r.placement.grades.length).length;
  const togglePick = (uid: string) => setPicked(p => { const n = new Set(p); if (n.has(uid)) n.delete(uid); else n.add(uid); return n; });
  const saveBulk = async (mode: "add" | "remove", p: StaffPlacement) => {
    try {
      const j = await post(`/api/tenants/${tenantId}/staff-placement`, { uids: [...picked], [mode]: p });
      toast.success(`Готово: ${j.done}`); setBulk(false); setPicked(new Set()); await load();
    } catch (e) { toast.error(errText(e)); }
  };

  const run = async (s: StaffRow, k: StaffActionKind) => { if (await runStaffAction(tenantId, k, s)) void load(); };
  const me = auth.currentUser?.uid;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Сотрудники"
        actions={can("team:manage") && <Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setInviting(true)}>Пригласить</Button>}
        tabs={<Tabs tabs={tabs.map(t => ({ ...t }))} value={tab} onChange={id => setTab(id as Tab)} />} />

      {inviting && <Suspense fallback={null}><RolesAndAccess view="invite" onInviteClose={() => setInviting(false)} onInvited={() => void load()} /></Suspense>}
      {tab === "roles" && <Suspense fallback={<Spinner />}><RolesAndAccess view="roles" /></Suspense>}
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
            <select value={grade} onChange={e => setGrade(e.target.value)} aria-label="Класс" className={`${input} !w-auto`}>
              <option value="">Все классы</option>
              {STAFF_GRADES.map(g => <option key={g} value={g}>{g} класс</option>)}
              {noGrades > 0 && <option value="none">Не указаны классы · {noGrades}</option>}
            </select>
            <select value={level} onChange={e => setLevel(e.target.value)} aria-label="Ступень" className={`${input} !w-auto`}>
              <option value="">Все ступени</option>
              {SCHOOL_LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
            {subjects.length > 0 && <select value={subject} onChange={e => setSubject(e.target.value)} aria-label="Предмет" className={`${input} !w-auto`}>
              <option value="">Все предметы</option>
              {subjects.map(x => <option key={x} value={x}>{x}</option>)}
            </select>}
            {groups.length > 0 && <select value={group} onChange={e => setGroup(e.target.value)} aria-label="Группа" className={`${input} !w-auto`}>
              <option value="">Все группы</option>
              {groups.map(x => <option key={x} value={x}>{x}</option>)}
            </select>}
          </div>
          {canManage && picked.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/5 px-3 py-2 text-sm">
              <span>Выбрано: {picked.size}</span>
              <Button size="sm" variant="primary" onClick={() => setBulk(true)}>Отметить классы, предметы, группы</Button>
              <button type="button" className="ml-auto text-xs text-[var(--text-muted)] hover:underline" onClick={() => setPicked(new Set())}>Снять выбор</button>
            </div>
          )}
          {bulk && <BulkPlacementModal count={picked.size} directory={directory} onClose={() => setBulk(false)} onSave={saveBulk} />}
          {error && <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">{error}</div>}
          {!rows ? <Spinner /> : !shown.length ? (
            <EmptyState icon={<Users />} title={rows.length ? "Никого не найдено" : "Сотрудников нет"} />
          ) : (
            <Table minWidth={760}>
              <thead><tr>{canManage && <th className="w-8"><input type="checkbox" aria-label="Выбрать всех" checked={shown.length > 0 && shown.every(r => picked.has(r.uid))} onChange={e => setPicked(e.target.checked ? new Set(shown.map(r => r.uid)) : new Set())} /></th>}<th>Сотрудник</th><th>Должность</th><th>Где работает</th><th>Статус</th><th>Последний вход</th><th className="w-12" /></tr></thead>
              <tbody>
                {shown.map(s => (
                  <tr key={s.uid} className="cursor-pointer" onClick={() => nav(`${base}/admin/staff/${encodeURIComponent(s.uid)}`)}>
                    {canManage && <td onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Выбрать ${s.name}`} checked={picked.has(s.uid)} onChange={() => togglePick(s.uid)} /></td>}
                    <td>
                      <Link to={`${base}/admin/staff/${encodeURIComponent(s.uid)}`} onClick={e => e.stopPropagation()} className="font-medium hover:underline">{s.name || s.email || s.uid}</Link>
                      {s.email && s.name !== s.email && <div className="text-xs text-[var(--text-muted)]">{s.email}</div>}
                    </td>
                    <td>{s.roleName}</td>
                    <td className="text-[var(--text-muted)] max-w-[260px]">{s.teacher && !s.placement.grades.length
                      ? <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400">не указаны классы</span>
                      : <span className="line-clamp-2">{placementLine(s.placement) || s.departmentName || "—"}</span>}</td>
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
