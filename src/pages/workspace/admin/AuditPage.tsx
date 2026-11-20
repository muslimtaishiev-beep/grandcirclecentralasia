import { Fragment, useCallback, useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { Button, EmptyState, PageHeader, Spinner, Table, input } from "../../../components/ui";
import { SECTION_LABEL, apiCall, errText, fmtDate, useAdminCtx, type AuditEventRow, type StaffRow } from "./api";

/** Список событий; строка раскрывается, если у события есть правки «было → стало». */
export function AuditList({ events, empty }: { events: AuditEventRow[]; empty: string }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!events.length) return <EmptyState icon={<ScrollText />} title={empty} />;
  return (
    <Table minWidth={640}>
      <thead><tr><th>Время</th><th>Кто</th><th>Действие</th><th>Над чем</th></tr></thead>
      <tbody>
        {events.map(e => (
          <Fragment key={e.id}>
            <tr className={e.changes?.length ? "cursor-pointer" : ""} onClick={() => e.changes?.length && setOpen(open === e.id ? null : e.id)}>
              <td className="whitespace-nowrap text-[var(--text-muted)]">{fmtDate(e.at)}</td>
              <td>{e.actorName || e.actorUid}</td>
              <td>{e.actionLabel || e.action}{e.detail ? <span className="text-[var(--text-muted)]"> · {e.detail}</span> : null}</td>
              <td className="text-[var(--text-muted)]">{e.targetName || "—"}</td>
            </tr>
            {open === e.id && e.changes?.map((c, i) => (
              <tr key={`${e.id}_${i}`} className="bg-[var(--bg-app)]">
                <td />
                <td colSpan={3} className="text-xs"><b>{c.label}</b>: <span className="text-[var(--text-muted)]">{c.from || "—"}</span> → {c.to || "—"}</td>
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
    </Table>
  );
}

const day = (v: string, end = false) => (v ? new Date(`${v}T${end ? "23:59:59.999" : "00:00:00"}`).getTime() : 0);

export default function AuditPage() {
  const { tenantId, can } = useAdminCtx();
  const [events, setEvents] = useState<AuditEventRow[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [actor, setActor] = useState("");
  const [section, setSection] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const query = useCallback((before?: number) => {
    const p = new URLSearchParams({ limit: "50" });
    if (actor) p.set("actor", actor);
    if (section) p.set("section", section);
    if (from) p.set("from", String(day(from)));
    const upper = before || (to ? day(to, true) : 0);
    if (upper) p.set("before", String(upper));
    return `/api/tenants/${tenantId}/audit?${p}`;
  }, [tenantId, actor, section, from, to]);

  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    setEvents(null);
    apiCall<{ events: AuditEventRow[]; next: number | null }>(query())
      .then(j => { if (alive) { setEvents(j.events); setNext(j.next); setError(""); } })
      .catch(e => { if (alive) { setError(errText(e)); setEvents([]); } });
    return () => { alive = false; };
  }, [tenantId, query]);

  useEffect(() => {
    if (!tenantId || !can("team:view", "team:manage")) return;
    apiCall<{ staff: StaffRow[] }>(`/api/tenants/${tenantId}/staff`).then(j => setStaff(j.staff)).catch(() => {});
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    if (!next) return;
    setMore(true);
    try {
      const j = await apiCall<{ events: AuditEventRow[]; next: number | null }>(query(next));
      setEvents(prev => [...(prev || []), ...j.events]); setNext(j.next);
    } catch (e) { setError(errText(e)); } finally { setMore(false); }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Журнал действий" />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {staff.length > 0 && (
          <select value={actor} onChange={e => setActor(e.target.value)} aria-label="Сотрудник" className={`${input} !w-auto`}>
            <option value="">Все сотрудники</option>
            {staff.map(s => <option key={s.uid} value={s.uid}>{s.name || s.email}</option>)}
          </select>
        )}
        <select value={section} onChange={e => setSection(e.target.value)} aria-label="Раздел" className={`${input} !w-auto`}>
          <option value="">Все разделы</option>
          {Object.entries(SECTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} aria-label="С даты" className={`${input} !w-auto`} />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} aria-label="По дату" className={`${input} !w-auto`} />
      </div>
      {error && <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">{error}</div>}
      {!events ? <Spinner /> : <AuditList events={events} empty="Событий нет" />}
      {next && <div className="mt-3 text-center"><Button loading={more} onClick={() => void loadMore()}>Показать ещё</Button></div>}
    </div>
  );
}
