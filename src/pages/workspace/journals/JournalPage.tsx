import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  ArrowLeft, Plus, Search, SlidersHorizontal, Download, Loader2, QrCode, ShieldCheck, Trash2, X, Image as ImageIcon, AlertTriangle, RefreshCw,
} from "lucide-react";
import {
  displayValue, entryStatus, isFilled, roleAtLeast, STATUS_LABEL, todayIso,
  type EntryStatus, type Journal, type JournalColumn, type JournalEntry, type JournalRole,
} from "../../../shared/journals";
import { useJournalApi } from "./journalApi";
import { exportEntriesXlsx } from "./journalExcel";
import { tenantLogos } from "../../../shared/legal";
import EntryPanel from "./components/EntryPanel";
import SignQrModal from "./components/SignQrModal";
import JournalStats from "./components/JournalStats";
import JournalSettingsTab from "./components/JournalSettingsTab";
import { Modal, OptionPicker, TriToggle, btn, btnPrimary, card, input, label } from "./components/ui";

/**
 * Один журнал: записи, статистика, настройки.
 *
 * Поиск и фильтры — как в заявках: по любой колонке, в браузере, по уже
 * загруженным записям. Журнал школы за год — тысячи строк, это укладывается
 * в один запрос и фильтруется мгновенно.
 */
type Filter = { op?: string; value?: any; from?: string; to?: string };
const STATUS_TONE: Record<EntryStatus, string> = {
  done: "bg-emerald-500/10 text-emerald-600",
  open: "bg-amber-500/10 text-amber-600",
  overdue: "bg-rose-500/10 text-rose-600",
};

export default function JournalPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const tenantId: string = activeTenant?.id || "";
  const { journalId = "" } = useParams();
  const navigate = useNavigate();
  const api = useJournalApi(tenantId);

  const [journal, setJournal] = useState<Journal | null>(null);
  const [role, setRole] = useState<JournalRole>("view");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"entries" | "stats" | "settings">("entries");

  const [search, setSearch] = useState("");
  // "notdone" — открытые и просроченные вместе: «кто не отработал».
  const [status, setStatus] = useState<"" | "notdone" | EntryStatus>("");
  const [filters, setFilters] = useState<Record<string, Filter>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<JournalEntry | null | "new">(null);
  const [qr, setQr] = useState<{ entry: JournalEntry; column: JournalColumn } | null>(null);
  const [bulk, setBulk] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId || !journalId) return;
    setLoading(true); setError(null);
    try {
      const j = await api(`/${journalId}`);
      setJournal(j.journal); setRole(j.role); setEntries(j.entries || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api, tenantId, journalId]);
  useEffect(() => { void load(); }, [load]);

  const merge = useCallback((list: JournalEntry[]) => {
    setEntries(prev => {
      const byId = new Map(prev.map(e => [e.id, e]));
      const fresh: JournalEntry[] = [];
      for (const e of list) { if (byId.has(e.id)) byId.set(e.id, e); else fresh.push(e); }
      return [...fresh, ...prev.map(e => byId.get(e.id) as JournalEntry)];
    });
  }, []);
  const onSigned = useCallback((e: JournalEntry) => merge([e]), [merge]);

  const today = todayIso();
  const visible = useMemo(() => {
    if (!journal) return [];
    const q = search.trim().toLowerCase().replace(/ё/g, "е");
    return entries.filter(e => {
      if (status) {
        const st = entryStatus(journal, e, today);
        if (status === "notdone" ? st === "done" : st !== status) return false;
      }
      for (const [cid, f] of Object.entries(filters)) {
        const c = journal.columns.find(x => x.id === cid);
        if (!c) continue;
        const v = e.values?.[cid];
        if (c.type === "date") {
          if (f.from && (!v || v < f.from)) return false;
          if (f.to && (!v || v > f.to)) return false;
        } else if (f.op === "empty") { if (isFilled(c, v) || (c.type === "checkbox" && v === false)) return false; }
        else if (f.op === "filled") { if (!isFilled(c, v)) return false; }
        else if (c.type === "checkbox" && f.value !== undefined) { if (v !== f.value) return false; }
        else if (c.type === "select" && Array.isArray(f.value) && f.value.length) { if (!f.value.includes(v)) return false; }
        else if (c.type === "text" && f.value) { if (!String(v || "").toLowerCase().includes(String(f.value).toLowerCase())) return false; }
      }
      if (q) {
        const hay = journal.columns.map(c => displayValue(c, e.values?.[c.id])).join(" ").toLowerCase().replace(/ё/g, "е");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, journal, search, status, filters, today]);

  const activeFilters = Object.values(filters).filter(f => f.op || f.from || f.to || (Array.isArray(f.value) ? f.value.length : f.value !== undefined && f.value !== "")).length;

  const [exporting, setExporting] = useState(false);
  const exportXlsx = async () => {
    if (!journal) return;
    setExporting(true);
    try { await exportEntriesXlsx(journal, visible, visible.length !== entries.length); }
    catch (e: any) { alert(`Не удалось выгрузить: ${e.message}`); }
    finally { setExporting(false); }
  };

  /** Быстрая отметка прямо в таблице — для «пришёл / не пришёл». */
  const quickSet = async (e: JournalEntry, c: JournalColumn, value: any) => {
    try {
      const j = await api(`/${journalId}/entries/${e.id}`, { method: "PATCH", body: JSON.stringify({ values: { [c.id]: value } }) });
      merge([j.entry]);
    } catch (err: any) { alert(err.message); }
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>;
  if (error || !journal) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center space-y-3">
        <p className="text-rose-600">{error || "Журнал не найден"}</p>
        <Link to={`/workspace/${tenantId}/journals`} className={btn}><ArrowLeft className="w-4 h-4" /> К журналам</Link>
      </div>
    );
  }

  const canEdit = roleAtLeast(role, "edit");
  const canManage = role === "manage";
  const tableCols = journal.columns;
  const noShowCol = journal.columns.find(c => c.type === "checkbox");
  const hasDone = journal.settings.doneColumnIds.length > 0;
  // Быстрые отборы — то, что спрашивают чаще всего, одним нажатием.
  const quick: { key: string; label: string; active: boolean; apply: () => void }[] = [
    { key: "all", label: "Все", active: !status && !activeFilters, apply: () => { setStatus(""); setFilters({}); } },
    ...(hasDone ? [{ key: "notdone", label: "Не отработали", active: status === "notdone" && !activeFilters, apply: () => { setStatus("notdone"); setFilters({}); } }] : []),
    ...(journal.settings.deadlineColumnId ? [{ key: "overdue", label: "Просрочено", active: status === "overdue" && !activeFilters, apply: () => { setStatus("overdue"); setFilters({}); } }] : []),
    ...(noShowCol ? [{
      key: "noshow", label: noShowCol.noLabel || "Нет",
      active: !status && activeFilters === 1 && filters[noShowCol.id]?.value === false,
      apply: () => { setStatus(""); setFilters({ [noShowCol.id]: { value: false } }); },
    }] : []),
  ];
  const allChecked = visible.length > 0 && visible.every(e => selected.has(e.id));

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <Link to={`/workspace/${tenantId}/journals`} className="p-2 -ml-2 rounded-lg hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)]" title="К журналам"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg md:text-2xl font-bold text-[var(--text-main)] truncate">{journal.title}</h1>
          {journal.description && <p className="hidden sm:block text-sm text-[var(--text-muted)] truncate">{journal.description}</p>}
        </div>
        {canEdit && tab === "entries" && <button className={`${btnPrimary} w-full sm:w-auto justify-center`} onClick={() => setEditing("new")}><Plus className="w-4 h-4" /> Новая запись</button>}
      </div>

      <div className="flex gap-1 border-b border-[var(--border-color)] overflow-x-auto hide-scrollbar">
        {([["entries", `Записи (${entries.length})`], ["stats", "Статистика"], ...(canManage ? [["settings", "Настройки"]] : [])] as [typeof tab, string][]).map(([k, t]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 sm:px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition ${tab === k ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]"}`}>{t}</button>
        ))}
      </div>

      {tab === "stats" && <JournalStats journal={journal} entries={entries} />}
      {/* Настройки не размонтируются при смене вкладки: иначе несохранённые
          правки пропадали, стоило заглянуть в записи. */}
      {canManage && (
        <div className={tab === "settings" ? "" : "hidden"}>
          <JournalSettingsTab journal={journal} api={api} onSaved={setJournal} onArchived={() => navigate(`/workspace/${tenantId}/journals`)} />
        </div>
      )}

      {tab === "entries" && (
        <>
          <div className={`${card} p-3 flex flex-wrap items-center gap-2`}>
            <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input className={`${input} pl-9`} placeholder="Поиск по всем колонкам" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className={`${input} flex-1 sm:flex-none sm:!w-44`} value={status} onChange={e => setStatus(e.target.value as any)}>
              <option value="">Все статусы</option>
              {hasDone && <option value="notdone">Не отработали (не закрыты)</option>}
              {(Object.keys(STATUS_LABEL) as EntryStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <button className={`${btn} ${activeFilters ? "border-[var(--accent)] text-[var(--accent)]" : ""}`} onClick={() => setShowFilters(v => !v)}>
              <SlidersHorizontal className="w-4 h-4" /> Фильтры{activeFilters ? ` (${activeFilters})` : ""}
            </button>
            <button className={btn} onClick={exportXlsx} disabled={exporting || !visible.length} title="Скачать в Excel то, что сейчас отобрано">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Excel
            </button>
            <button className={btn} onClick={load} title="Обновить"><RefreshCw className="w-4 h-4" /></button>
            <span className="w-full sm:w-auto text-xs text-[var(--text-muted)] sm:ml-auto">{visible.length === entries.length ? `${entries.length} записей` : `${visible.length} из ${entries.length}`}</span>
          </div>

          <div className="flex gap-1.5 overflow-x-auto hide-scrollbar -mt-1">
            {quick.map(q => (
              <button key={q.key} onClick={q.apply}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition ${q.active ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]"}`}>
                {q.label}
              </button>
            ))}
          </div>

          {showFilters && (
            <div className={`${card} p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3`}>
              {tableCols.map(c => <ColumnFilter key={c.id} column={c} value={filters[c.id] || {}} onChange={f => setFilters(p => ({ ...p, [c.id]: f }))} />)}
              {activeFilters > 0 && <button className="text-sm text-[var(--accent)] hover:underline text-left" onClick={() => setFilters({})}>Сбросить фильтры</button>}
            </div>
          )}

          {selected.size > 0 && canEdit && (
            <div className={`${card} p-3 flex flex-wrap items-center gap-2 border-[var(--accent)] sticky top-0 z-20`}>
              <b className="text-sm text-[var(--text-main)]">Выбрано: {selected.size}</b>
              <button className={btnPrimary} onClick={() => setBulk(true)}>Заполнить колонку у всех</button>
              {canManage && (
                <button className={`${btn} text-rose-600`} onClick={async () => {
                  if (!confirm(`Удалить ${selected.size} записей?`)) return;
                  try {
                    await api(`/${journalId}/entries/bulk`, { method: "POST", body: JSON.stringify({ ids: [...selected], action: "delete" }) });
                    setEntries(p => p.filter(e => !selected.has(e.id))); setSelected(new Set());
                  } catch (e: any) { alert(e.message); }
                }}><Trash2 className="w-4 h-4" /> Удалить</button>
              )}
              <button className={btn} onClick={() => setSelected(new Set())}><X className="w-4 h-4" /> Снять выбор</button>
            </div>
          )}

          {/* Телефон: карточки. Девять колонок таблицы на узком экране — это
              горизонтальная прокрутка, в которой теряется, чья это строка. */}
          <div className="md:hidden space-y-2">
            {visible.length === 0 && (
              <div className={`${card} px-4 py-10 text-center text-sm text-[var(--text-muted)]`}>
                {entries.length ? "Ничего не найдено — измените поиск или фильтры" : canEdit ? "Записей пока нет — нажмите «Новая запись»" : "Записей пока нет"}
              </div>
            )}
            {visible.length > 0 && canEdit && (
              <label className="flex items-center gap-2 px-1 text-xs text-[var(--text-muted)]">
                <input type="checkbox" checked={allChecked} onChange={e => setSelected(e.target.checked ? new Set(visible.map(x => x.id)) : new Set())} /> Выбрать все ({visible.length})
              </label>
            )}
            {visible.map(e => (
              <EntryCard key={e.id} journal={journal} entry={e} status={entryStatus(journal, e, today)}
                canEdit={canEdit} canManage={canManage}
                checked={selected.has(e.id)}
                onCheck={on => setSelected(p => { const n = new Set(p); if (on) n.add(e.id); else n.delete(e.id); return n; })}
                onOpen={() => setEditing(e)}
                onQuick={(c, v) => quickSet(e, c, v)}
                onQr={c => setQr({ entry: e, column: c })} />
            ))}
          </div>

          <div className={`${card} overflow-x-auto hidden md:block`}>
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-panel)] text-[11px] uppercase font-mono text-[var(--text-muted)]">
                <tr>
                  {canEdit && (
                    <th className="px-3 py-3 w-8">
                      <input type="checkbox" checked={allChecked} onChange={e => setSelected(e.target.checked ? new Set(visible.map(x => x.id)) : new Set())} />
                    </th>
                  )}
                  {tableCols.map(c => <th key={c.id} className="px-3 py-3 text-left whitespace-nowrap">{c.label}</th>)}
                  <th className="px-3 py-3 text-left">Статус</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={tableCols.length + 2} className="px-4 py-10 text-center text-[var(--text-muted)]">
                    {entries.length ? "Ничего не найдено — измените поиск или фильтры" : canEdit ? "Записей пока нет — нажмите «Новая запись»" : "Записей пока нет"}
                  </td></tr>
                )}
                {visible.map(e => {
                  const st = entryStatus(journal, e, today);
                  return (
                    <tr key={e.id} className="border-t border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] cursor-pointer" onClick={() => setEditing(e)}>
                      {canEdit && (
                        <td className="px-3 py-2" onClick={ev => ev.stopPropagation()}>
                          <input type="checkbox" checked={selected.has(e.id)} onChange={ev => setSelected(p => { const n = new Set(p); if (ev.target.checked) n.add(e.id); else n.delete(e.id); return n; })} />
                        </td>
                      )}
                      {tableCols.map(c => (
                        <td key={c.id} className="px-3 py-2 align-middle max-w-[260px]">
                          <Cell column={c} entry={e} canEdit={canEdit && (!c.managersOnly || canManage)}
                            onQuick={v => quickSet(e, c, v)} onQr={() => setQr({ entry: e, column: c })} />
                        </td>
                      ))}
                      <td className="px-3 py-2"><span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_TONE[st]}`}>{STATUS_LABEL[st]}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editing && (
        <EntryPanel journal={journal} role={role} entry={editing === "new" ? null : editing} api={api}
          onSaved={merge} onClose={() => setEditing(null)}
          onShowQr={(entry, column) => { setEditing(null); setQr({ entry, column }); }} />
      )}
      {qr && <SignQrModal journal={journal} entry={qr.entry} column={qr.column} api={api} onSigned={onSigned} onClose={() => setQr(null)} logo={tenantLogos(activeTenant).markUrl} />}
      {bulk && (
        <BulkModal journal={journal} role={role} count={selected.size} onClose={() => setBulk(false)}
          onApply={async (columnId, value) => {
            const j = await api(`/${journalId}/entries/bulk`, { method: "POST", body: JSON.stringify({ ids: [...selected], action: "set", columnId, value }) });
            merge(j.entries || []);
            setBulk(false); setSelected(new Set());
          }} />
      )}
    </div>
  );
}

/** Запись карточкой: главное сверху, быстрые отметки — прямо в карточке. */
function EntryCard({ journal, entry, status, canEdit, canManage, checked, onCheck, onOpen, onQuick, onQr }: {
  journal: Journal; entry: JournalEntry; status: EntryStatus; canEdit: boolean; canManage: boolean;
  checked: boolean; onCheck: (on: boolean) => void; onOpen: () => void;
  onQuick: (c: JournalColumn, v: any) => void; onQr: (c: JournalColumn) => void;
}) {
  const head = journal.columns.find(c => c.id === journal.settings.personColumnId) || journal.columns[0];
  const rest = journal.columns.filter(c => c.id !== head?.id);
  const interactive = (c: JournalColumn) => c.type === "checkbox" || c.type === "qr_sign";
  return (
    <div className={`${card} p-3 active:bg-[var(--bg-surface-hover)]`} onClick={onOpen}>
      <div className="flex items-start gap-2">
        {canEdit && (
          <input type="checkbox" className="mt-1 w-4 h-4 shrink-0" checked={checked}
            onClick={ev => ev.stopPropagation()} onChange={ev => onCheck(ev.target.checked)} />
        )}
        <div className="flex-1 min-w-0 font-semibold text-[var(--text-main)] break-words">
          {head ? (displayValue(head, entry.values?.[head.id]) || "—") : "Запись"}
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm items-center">
        {rest.map(c => {
          const v = entry.values?.[c.id];
          if (!interactive(c) && !isFilled(c, v) && c.type !== "name_sign") return null;
          return (
            <React.Fragment key={c.id}>
              <dt className="text-xs text-[var(--text-muted)]">{c.label}</dt>
              <dd className="min-w-0">
                <Cell column={c} entry={entry} canEdit={canEdit && (!c.managersOnly || canManage)} onQuick={v2 => onQuick(c, v2)} onQr={() => onQr(c)} />
              </dd>
            </React.Fragment>
          );
        })}
      </dl>
    </div>
  );
}

function Cell({ column: c, entry, canEdit, onQuick, onQr }: {
  column: JournalColumn; entry: JournalEntry; canEdit: boolean; onQuick: (v: any) => void; onQr: () => void;
}) {
  const v = entry.values?.[c.id];
  const stop = (ev: React.MouseEvent) => ev.stopPropagation();
  if (c.type === "checkbox") {
    return <div onClick={stop}><TriToggle compact value={v} yes={c.yesLabel || "Да"} no={c.noLabel || "Нет"} onChange={onQuick} disabled={!canEdit} /></div>;
  }
  if (c.type === "qr_sign") {
    if (v?.signedAt) {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium whitespace-nowrap" title={`Подписано ${new Date(v.signedAt).toLocaleString("ru-RU")}`}>
          <ShieldCheck className="w-3.5 h-3.5" /> {new Date(v.signedAt).toLocaleDateString("ru-RU")}
          {v.changedAfter && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-label="Запись меняли после подписи" />}
        </span>
      );
    }
    return canEdit
      ? <button onClick={ev => { stop(ev); onQr(); }} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--accent)] hover:text-[var(--accent)] whitespace-nowrap"><QrCode className="w-3.5 h-3.5" /> QR</button>
      : <span className="text-xs text-[var(--text-muted)]">—</span>;
  }
  if (c.type === "name_sign") {
    return v?.name
      ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium"><ShieldCheck className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{v.name}</span></span>
      : <span className="text-xs text-[var(--text-muted)]">—</span>;
  }
  if (c.type === "photo") return v ? <ImageIcon className="w-4 h-4 text-[var(--text-muted)]" /> : <span className="text-xs text-[var(--text-muted)]">—</span>;
  const text = displayValue(c, v);
  return text ? <span className="block truncate text-[var(--text-main)]" title={text}>{text}</span> : <span className="text-xs text-[var(--text-muted)]">—</span>;
}

function ColumnFilter({ column: c, value: f, onChange }: { column: JournalColumn; value: Filter; onChange: (f: Filter) => void }) {
  return (
    <div>
      <span className={label}>{c.label}</span>
      {c.type === "date" ? (
        <div className="flex gap-1.5">
          <input type="date" className={input} value={f.from || ""} onChange={e => onChange({ ...f, from: e.target.value || undefined })} title="с" />
          <input type="date" className={input} value={f.to || ""} onChange={e => onChange({ ...f, to: e.target.value || undefined })} title="по" />
        </div>
      ) : c.type === "select" ? (
        <OptionPicker options={c.options || []} multiple values={Array.isArray(f.value) ? f.value : []} onChangeMany={v => onChange({ value: v })} placeholder="Любое значение" />
      ) : c.type === "checkbox" ? (
        <select className={input} value={f.op || (f.value === true ? "yes" : f.value === false ? "no" : "")}
          onChange={e => onChange(e.target.value === "yes" ? { value: true } : e.target.value === "no" ? { value: false } : e.target.value === "empty" ? { op: "empty" } : {})}>
          <option value="">Любое</option>
          <option value="yes">{c.yesLabel || "Да"}</option>
          <option value="no">{c.noLabel || "Нет"}</option>
          <option value="empty">Не отмечено</option>
        </select>
      ) : c.type === "text" ? (
        <input className={input} value={f.value || ""} onChange={e => onChange({ value: e.target.value })} placeholder="Содержит…" />
      ) : (
        <select className={input} value={f.op || ""} onChange={e => onChange(e.target.value ? { op: e.target.value } : {})}>
          <option value="">Любое</option>
          <option value="filled">{c.type === "qr_sign" || c.type === "name_sign" ? "Подписано" : "Заполнено"}</option>
          <option value="empty">{c.type === "qr_sign" || c.type === "name_sign" ? "Не подписано" : "Пусто"}</option>
        </select>
      )}
    </div>
  );
}

/** Одно значение в одну колонку у всех выбранных — например вид отработки целому списку. */
function BulkModal({ journal, role, count, onClose, onApply }: {
  journal: Journal; role: JournalRole; count: number; onClose: () => void; onApply: (columnId: string, value: any) => Promise<void>;
}) {
  const cols = journal.columns.filter(c => ["select", "date", "checkbox", "text", "number", "name_sign"].includes(c.type) && (!c.managersOnly || role === "manage"));
  const [cid, setCid] = useState(cols[0]?.id || "");
  const [value, setValue] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = cols.find(x => x.id === cid);
  return (
    <Modal title={`Заполнить у ${count} записей`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <span className={label}>Колонка</span>
          <select className={input} value={cid} onChange={e => { setCid(e.target.value); setValue(null); }}>
            {cols.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </div>
        {c && (
          <div>
            <span className={label}>Значение</span>
            {c.type === "select" ? <OptionPicker options={c.options || []} value={value} onChange={setValue} />
              : c.type === "date" ? <input type="date" className={input} value={value || ""} onChange={e => setValue(e.target.value || null)} />
              : c.type === "checkbox" ? <TriToggle value={value} yes={c.yesLabel || "Да"} no={c.noLabel || "Нет"} onChange={setValue} />
              : <input className={input} value={value || ""} onChange={e => setValue(e.target.value)} placeholder={c.type === "name_sign" ? "Фамилия и имя" : ""} />}
            <p className="text-[11px] text-[var(--text-muted)] mt-1">Пустое значение очистит колонку у выбранных записей.</p>
          </div>
        )}
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-end gap-2">
          <button className={btn} onClick={onClose}>Отмена</button>
          <button className={btnPrimary} disabled={busy || !c} onClick={async () => {
            setBusy(true); setError(null);
            try { await onApply(cid, value); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
          }}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Применить</button>
        </div>
      </div>
    </Modal>
  );
}
