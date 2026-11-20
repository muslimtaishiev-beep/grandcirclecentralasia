import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArchiveRestore, ExternalLink, Trash2 } from "lucide-react";
import { Button, EmptyState, Spinner, Table, Tabs, confirmDialog, toast, useUrlTab } from "../../../components/ui";
import type { Api, ExamListItem } from "./examApi";
import ArchiveTab from "./ArchiveTab";

const PARTS = ["exams", "attempts", "questions", "legacy"] as const;
type Part = (typeof PARTS)[number];
const when = (ms?: number | null) => (ms ? new Date(ms).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

/** «Архив»: удалённые экзамены (с работами), корзина работ, корзина вопросов, прежний тест. */
export default function ArchiveHub({ api, bankApi, tenantId }: { api: Api; bankApi: Api; tenantId: string }) {
  const [part, setPart] = useUrlTab<Part>("part", PARTS, "exams");
  return (
    <div className="space-y-4">
      <Tabs value={part} onChange={p => setPart(p as Part)} tabs={[
        { id: "exams", label: "Удалённые экзамены" }, { id: "attempts", label: "Корзина работ" }, { id: "questions", label: "Корзина вопросов" }, { id: "legacy", label: "Прежний тест" },
      ]} />
      {part === "exams" && <ArchivedExams api={api} tenantId={tenantId} />}
      {part === "attempts" && <AttemptTrash api={api} />}
      {part === "questions" && <QuestionTrash api={bankApi} />}
      {part === "legacy" && <ArchiveTab api={api} />}
    </div>
  );
}

function Loading() { return <div className="py-12 flex justify-center"><Spinner /></div>; }

function ArchivedExams({ api, tenantId }: { api: Api; tenantId: string }) {
  const [rows, setRows] = useState<ExamListItem[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api("/exams?archived=1").then(j => { setRows(j.exams); setCanEdit(!!j.canEdit); }).catch(e => setError(e.message)), [api]);
  useEffect(() => { void load(); }, [load]);
  const restore = async (e: ExamListItem) => {
    try { await api(`/exams/${e.id}/restore`, { method: "POST" }); toast.success(`«${e.title}» возвращён (закрыт)`); await load(); }
    catch (err: any) { toast.error(err.message); }
  };
  if (error) return <div className="text-sm text-rose-600">{error}</div>;
  if (!rows) return <Loading />;
  if (!rows.length) return <EmptyState title="Удалённых экзаменов нет" />;
  return (
    <Table minWidth={560}>
      <thead><tr><th>Экзамен</th><th>Работ</th><th>Удалён</th><th /></tr></thead>
      <tbody>
        {rows.map(e => (
          <tr key={e.id}>
            <td><div className="font-medium">{e.title}</div>{e.group && <div className="text-[11px] text-[var(--text-muted)]">{e.group}</div>}</td>
            <td className="tabular-nums">{e.total}</td>
            <td className="text-xs text-[var(--text-muted)]">{when(e.archivedAt)}</td>
            <td className="text-right whitespace-nowrap">
              <Link to={`/workspace/${tenantId}/exams/${e.id}`}><Button size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />}>Работы</Button></Link>{" "}
              {canEdit && <Button size="sm" variant="primary" icon={<ArchiveRestore className="w-3.5 h-3.5" />} onClick={() => restore(e)}>Вернуть</Button>}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/** Общая корзина: выбрать, вернуть или стереть насовсем. */
function TrashTable<T extends { id: string }>({ rows, canEdit, head, cells, onAction, noun }: {
  rows: T[]; canEdit: boolean; head: string[]; cells: (r: T) => React.ReactNode[]; onAction: (ids: string[], action: "restore" | "purge") => Promise<void>; noun: string;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const ids = [...sel].filter(id => rows.some(r => r.id === id));
  const run = async (action: "restore" | "purge") => {
    if (action === "purge" && !(await confirmDialog({ title: `Удалить насовсем: ${ids.length}?`, message: "Вернуть будет нельзя", confirmLabel: "Удалить насовсем", danger: true }))) return;
    setBusy(true); await onAction(ids, action); setSel(new Set()); setBusy(false);
  };
  const all = rows.length > 0 && rows.every(r => sel.has(r.id));
  return (
    <div className="space-y-3">
      {canEdit && ids.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--accent)]/40 bg-[var(--bg-surface)] px-3 py-2">
          <span className="text-sm font-semibold">Выбрано: {ids.length}</span>
          <Button size="sm" variant="primary" disabled={busy} icon={<ArchiveRestore className="w-3.5 h-3.5" />} onClick={() => run("restore")}>Вернуть</Button>
          <Button size="sm" variant="danger" disabled={busy} icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => run("purge")}>Удалить насовсем</Button>
        </div>
      )}
      <Table minWidth={600}>
        <thead><tr>{canEdit && <th className="w-8"><input type="checkbox" aria-label="Выбрать все" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.map(r => r.id)))} /></th>}{head.map(h => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              {canEdit && <td><input type="checkbox" aria-label={noun} checked={sel.has(r.id)} onChange={() => setSel(p => { const n = new Set(p); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} /></td>}
              {cells(r).map((c, i) => <td key={i}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function AttemptTrash({ api }: { api: Api }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { const [t, e] = await Promise.all([api("/attempts-trash"), api("/exams")]); setRows(t.attempts); setCanEdit(!!e.canEdit); }
    catch (err: any) { setError(err.message); }
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  if (error) return <div className="text-sm text-rose-600">{error}</div>;
  if (!rows) return <Loading />;
  if (!rows.length) return <EmptyState title="Корзина работ пуста" />;
  return (
    <TrashTable rows={rows} canEdit={canEdit} noun="Работа" head={["Ученик", "Экзамен", "Итог", "Удалена"]}
      cells={r => [<div><div className="font-medium">{r.student?.name}</div><div className="text-[11px] font-mono text-[var(--text-muted)]">№ {r.shortId}</div></div>, r.examTitle, r.result ? `${r.result.percent}%` : "—", <span className="text-xs text-[var(--text-muted)]">{when(r.deletedAt)} · {r.deletedBy}</span>]}
      onAction={async (ids, action) => {
        try { const j = await api("/attempts-trash", { method: "POST", body: JSON.stringify({ ids, action }) }); toast.success(action === "restore" ? `Возвращено: ${j.count}` : `Удалено: ${j.count}`); await load(); }
        catch (e: any) { toast.error(e.message); }
      }} />
  );
}

function QuestionTrash({ api }: { api: Api }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { const [t, q] = await Promise.all([api("/questions-trash"), api("/disciplines")]); setRows(t.questions); setCanEdit(!!q.canEdit); }
    catch (err: any) { setError(err.message); }
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  if (error) return <div className="text-sm text-rose-600">{error}</div>;
  if (!rows) return <Loading />;
  if (!rows.length) return <EmptyState title="Корзина вопросов пуста" />;
  return (
    <TrashTable rows={rows} canEdit={canEdit} noun="Вопрос" head={["Номер", "Вопрос", "Удалён"]}
      cells={r => [<span className="font-mono text-xs">{r.id}</span>, <span className="line-clamp-2">{String(r.text || r.html || "").replace(/<[^>]+>/g, " ").slice(0, 160)}</span>, <span className="text-xs text-[var(--text-muted)]">{when(r.deletedAt)} · {r.deletedBy}</span>]}
      onAction={async (ids, action) => {
        try { const j = await api("/questions-trash", { method: "POST", body: JSON.stringify({ ids, action }) }); toast.success(action === "restore" ? `Возвращено: ${j.count}` : `Удалено: ${j.count}`); await load(); }
        catch (e: any) { toast.error(e.message); }
      }} />
  );
}
