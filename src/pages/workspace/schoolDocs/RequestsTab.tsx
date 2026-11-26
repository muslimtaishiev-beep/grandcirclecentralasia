import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, Bell, CalendarClock, Check, ClipboardCheck, Download, ExternalLink, FileText, Plus, RotateCcw, Trash2, Upload, UserPlus, Users, X } from "lucide-react";
import { Button, EmptyState, Modal, Spinner, Table, confirmDialog, input, toast } from "../../../components/ui";
import { EMPTY_AUDIENCE, STATUS_TEXT, isDone, type Audience, type RequestItems, type SubmitStatus } from "../../../shared/schoolDocs";
import { classesText } from "../../../shared/staffPlacement";
import AudiencePicker, { type DocsStaff } from "./AudiencePicker";
import { uploadOne, type DocsApi, type FileRow, type FolderRow, type RecipientRow, type RequestDetail, type RequestRow } from "./docsApi";

/**
 * Сборы документов: завуч объявляет («Контрольные 2 четверти до 20.12»),
 * адресаты сдают файлы прямо в папку сбора, завуч видит, кто сдал, и
 * принимает или возвращает. Здесь же «мои сборы» учителя.
 */
type Tree = { folders: FolderRow[]; me: { uid: string; name: string; manageAll: boolean }; staff?: DocsStaff[]; positions?: { id: string; name: string }[] };

const STATUS_STYLE: Record<SubmitStatus, string> = {
  done: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", accepted: "bg-emerald-600 text-white",
  late: "bg-amber-500/15 text-amber-700 dark:text-amber-400", partial: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  none: "bg-slate-500/10 text-[var(--text-muted)]", returned: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};
const fmtDue = (ms: number) => new Date(ms).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const fmtShort = (ms: number) => new Date(ms).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const toLocal = (ms: number) => { const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };
const Chip = ({ s }: { s: SubmitStatus }) => <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s]}`}>{STATUS_TEXT[s]}</span>;

export default function RequestsTab({ api, tree, onOpenFolder }: { api: DocsApi; tenantId: string; tree: Tree; onOpenFolder: (id: string) => void }) {
  const [params, setParams] = useSearchParams();
  const rid = params.get("r") || "";
  const openReq = (id: string) => { const p = new URLSearchParams(params); if (id) p.set("r", id); else p.delete("r"); setParams(p); };
  const [list, setList] = useState<{ manage: RequestRow[]; mine: RequestRow[] } | null>(null);
  const [creating, setCreating] = useState(() => params.get("new") === "1");
  const load = useCallback(async () => { try { setList(await api.requests()); } catch (e: any) { toast.error(e.message); } }, [api]);
  useEffect(() => { void load(); }, [load]);
  const canCreate = tree.me.manageAll || tree.folders.some(f => f.rights.manage);

  if (rid) return <RequestView api={api} id={rid} tree={tree} onBack={() => { openReq(""); void load(); }} onOpenFolder={onOpenFolder} />;
  if (!list) return <Spinner />;
  const empty = !list.manage.length && !list.mine.length;
  return (
    <div className="space-y-5">
      {canCreate && <div className="flex justify-end"><Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>Собрать документы</Button></div>}
      {empty && <EmptyState icon={<ClipboardCheck />} title={canCreate ? "Сборов пока нет" : "Вам пока ничего не нужно сдавать"} />}
      {list.mine.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Мне сдать</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {list.mine.map(r => {
              const st = r.my!.status; const overdue = !isDone(st) && Date.now() > r.dueAt;
              return (
                <button key={r.id} type="button" onClick={() => openReq(r.id)} className={`rounded-xl border p-3 text-left hover:border-[var(--accent)] ${overdue ? "border-rose-500/40" : "border-[var(--border-color)]"} bg-[var(--bg-surface)]`}>
                  <div className="flex items-start gap-2"><span className="flex-1 font-semibold text-[var(--text-main)]">{r.title}</span><Chip s={st} /></div>
                  <div className={`mt-1 text-xs ${overdue ? "text-rose-600" : "text-[var(--text-muted)]"}`}>до {fmtDue(r.dueAt)} · {r.createdBy.name}{r.status === "closed" ? " · закрыт" : ""}</div>
                </button>
              );
            })}
          </div>
        </section>
      )}
      {list.manage.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Мои сборы</h2>
          <Table minWidth={640}>
            <thead><tr><th>Что сдать</th><th>Срок</th><th className="w-48">Сдали</th><th>Статус</th></tr></thead>
            <tbody>
              {list.manage.map(r => {
                const s = r.stats!; const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
                return (
                  <tr key={r.id} className="cursor-pointer" onClick={() => openReq(r.id)}>
                    <td className="font-medium">{r.title}</td>
                    <td className={`whitespace-nowrap ${r.status === "open" && Date.now() > r.dueAt ? "text-rose-600" : "text-[var(--text-muted)]"}`}>{fmtShort(r.dueAt)}</td>
                    <td>
                      <div className="flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-surface-hover)]"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div><span className="tabular-nums text-xs">{s.done}/{s.total}</span></div>
                    </td>
                    <td className="text-xs text-[var(--text-muted)]">{r.status === "closed" ? "Закрыт" : "Идёт"}{s.returned ? ` · на доработке ${s.returned}` : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </section>
      )}
      {creating && <CreateRequestModal api={api} tree={tree} onClose={() => { setCreating(false); const p = new URLSearchParams(params); p.delete("new"); setParams(p); }} onCreated={id => { setCreating(false); const p = new URLSearchParams(params); p.delete("new"); p.set("r", id); setParams(p); }} />}
    </div>
  );
}

// ── Создание ────────────────────────────────────────────────────────────

const REMIND = [{ h: 72, l: "за 3 дня" }, { h: 48, l: "за 2 дня" }, { h: 24, l: "за день" }, { h: 0, l: "в день срока" }];

function CreateRequestModal({ api, tree, onClose, onCreated }: { api: DocsApi; tree: Tree; onClose: () => void; onCreated: (id: string) => void }) {
  const folders = tree.folders.filter(f => f.rights.manage);
  const [folderId, setFolderId] = useState(() => new URLSearchParams(window.location.search).get("f") && folders.some(f => f.id === new URLSearchParams(window.location.search).get("f")) ? new URLSearchParams(window.location.search).get("f")! : folders[0]?.id || "");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [audience, setAudience] = useState<Audience>({ ...EMPTY_AUDIENCE });
  const [items, setItems] = useState<RequestItems>({ mode: "files", list: [], min: 1, prefix: "" });
  const [listText, setListText] = useState("");
  const [due, setDue] = useState(() => { const d = new Date(Date.now() + 7 * 86400_000); d.setHours(18, 0, 0, 0); return toLocal(d.getTime()); });
  const [more, setMore] = useState(false);
  const [remind, setRemind] = useState<number[]>([48, 0]);
  const [lateOk, setLateOk] = useState(true);
  const [review, setReview] = useState(false);
  const [notifyMode, setNotifyMode] = useState<"digest" | "each" | "summary">("digest");
  const [samples, setSamples] = useState<string[]>([]);
  const [folderFiles, setFolderFiles] = useState<FileRow[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (more && folderId) api.folder(folderId).then(j => setFolderFiles(j.files)).catch(() => setFolderFiles([])); }, [more, folderId, api]);
  const pathOf = (f: FolderRow): string => { const p = tree.folders.find(x => x.id === f.parentId); return p ? `${pathOf(p)} / ${f.name}` : f.name; };
  const go = async () => {
    setBusy(true);
    try {
      const list = items.mode === "list" ? listText.split("\n").map(x => x.trim()).filter(Boolean).map((label, i) => ({ id: `i${i + 1}`, label })) : [];
      const j = await api.createRequest({ folderId, title, note, audience, items: { ...items, list }, dueAt: new Date(due).getTime(), remind, lateOk, review, notifyMode, sampleFileIds: samples });
      toast.success(`Отправлено: ${j.recipients}`); onCreated(j.id);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const lbl = "block text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1.5";
  const seg = (on: boolean) => `rounded-md px-3 py-1 text-sm ${on ? "bg-[var(--accent)] text-white" : "text-[var(--text-main)]"}`;
  if (!folders.length) return <Modal title="Собрать документы" onClose={onClose}><EmptyState title="Сначала создайте папку, куда собирать" /></Modal>;
  return (
    <Modal title="Собрать документы" onClose={() => !busy && onClose()} xwide>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <div><span className={lbl}>Что сдать</span><input className={input} value={title} onChange={e => setTitle(e.target.value)} placeholder="Контрольные работы за 2 четверть" maxLength={120} /></div>
          <div><span className={lbl}>Пояснение</span><textarea className={input} rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Сканы или фото, по одному файлу на класс" /></div>
          <div><span className={lbl}>В папку</span>
            <select className={input} value={folderId} onChange={e => setFolderId(e.target.value)}>{folders.map(f => <option key={f.id} value={f.id}>{pathOf(f)}</option>)}</select>
          </div>
          <div><span className={lbl}>Срок</span><input type="datetime-local" className={input} value={due} onChange={e => setDue(e.target.value)} /></div>
          <div>
            <span className={lbl}>Что именно</span>
            <div className="mb-2 inline-flex rounded-lg border border-[var(--border-color)] p-0.5">
              <button type="button" className={seg(items.mode === "files")} onClick={() => setItems({ ...items, mode: "files" })}>Файлы</button>
              <button type="button" className={seg(items.mode === "perClass")} onClick={() => setItems({ ...items, mode: "perClass" })}>По классам учителя</button>
              <button type="button" className={seg(items.mode === "list")} onClick={() => setItems({ ...items, mode: "list" })}>Список</button>
            </div>
            {items.mode === "files" && <label className="flex items-center gap-2 text-sm">Не меньше <input type="number" min={1} max={50} className={`${input} !w-20`} value={items.min} onChange={e => setItems({ ...items, min: Math.max(1, Number(e.target.value) || 1) })} /> файлов</label>}
            {items.mode === "perClass" && <input className={input} value={items.prefix} onChange={e => setItems({ ...items, prefix: e.target.value })} placeholder="Подпись пункта: «Контрольная» → «Контрольная — 5А»" />}
            {items.mode === "list" && <textarea className={input} rows={4} value={listText} onChange={e => setListText(e.target.value)} placeholder={"КТП\nПояснительная записка\nОтчёт за четверть"} />}
          </div>
          {!more ? <button type="button" className="text-sm text-[var(--accent)] hover:underline" onClick={() => setMore(true)}>Настроить напоминания, проверку, образцы</button> : (
            <div className="space-y-3 rounded-xl border border-[var(--border-color)] p-3">
              <div><span className={lbl}>Напоминать не сдавшим</span>
                <div className="flex flex-wrap gap-1.5">{REMIND.map(r => <button key={r.h} type="button" className={`rounded-lg border px-2.5 py-1 text-sm ${remind.includes(r.h) ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border-color)]"}`} onClick={() => setRemind(x => (x.includes(r.h) ? x.filter(y => y !== r.h) : [...x, r.h]))}>{r.l}</button>)}</div>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={lateOk} onChange={e => setLateOk(e.target.checked)} /> Принимать после срока (с пометкой «опоздал»)</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={review} onChange={e => setReview(e.target.checked)} /> Проверять: «Принято» или «На доработку»</label>
              <div><span className={lbl}>Мне о сдаче</span>
                <select className={input} value={notifyMode} onChange={e => setNotifyMode(e.target.value as any)}>
                  <option value="digest">Раз в час одной сводкой</option><option value="each">Каждую сдачу сразу</option><option value="summary">Только итог по сроку</option>
                </select>
              </div>
              {folderFiles.length > 0 && <div><span className={lbl}>Образцы из папки</span>
                <div className="max-h-32 space-y-1 overflow-y-auto">{folderFiles.map(f => <label key={f.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={samples.includes(f.id)} onChange={() => setSamples(x => (x.includes(f.id) ? x.filter(y => y !== f.id) : [...x, f.id]))} /><span className="truncate">{f.name}</span></label>)}</div>
              </div>}
            </div>
          )}
        </div>
        <div>
          <span className={lbl}>Кому</span>
          <AudiencePicker value={audience} onChange={setAudience} staff={tree.staff || []} positions={tree.positions || []} />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-[var(--border-color)] pt-3">
        <Button onClick={onClose} disabled={busy}>Отмена</Button>
        <Button variant="primary" loading={busy} disabled={!title.trim() || !folderId} onClick={() => void go()}>Отправить</Button>
      </div>
    </Modal>
  );
}

// ── Сбор: для завуча и для адресата ──────────────────────────────────────

function RequestView({ api, id, tree, onBack, onOpenFolder }: { api: DocsApi; id: string; tree: Tree; onBack: () => void; onOpenFolder: (id: string) => void }) {
  const [d, setD] = useState<RequestDetail | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => { try { setD(await api.request(id)); } catch (e: any) { setErr(e.message); } }, [api, id]);
  useEffect(() => { void load(); }, [load]);
  if (err) return <EmptyState title={err} action={<Button onClick={onBack}>Назад</Button>} />;
  if (!d) return <Spinner />;
  const r = d.request;
  const openFile = async (fid: string, download = false) => {
    const w = download ? null : window.open("about:blank", "_blank");
    try { const { url } = await api.fileUrl(fid, download); if (w) w.location.href = url; else window.location.href = url; } catch (e: any) { w?.close(); toast.error(e.message); }
  };
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-main)]"><ArrowLeft className="h-4 w-4" /> Все сборы</button>
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <div className="flex flex-wrap items-start gap-2">
          <h2 className="flex-1 text-lg font-bold text-[var(--text-main)]">{r.title}</h2>
          {r.status === "closed" && <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-xs">Закрыт</span>}
        </div>
        <div className={`mt-1 text-sm ${r.status === "open" && Date.now() > r.dueAt ? "text-rose-600" : "text-[var(--text-muted)]"}`}>Срок — {fmtDue(r.dueAt)} · от {r.createdBy.name} · папка <button type="button" className="underline" onClick={() => onOpenFolder(r.folderId)}>{r.folderName}</button></div>
        {d.audienceText && <div className="mt-1 text-sm text-[var(--text-muted)]">Кому: {d.audienceText}</div>}
        {r.note && <p className="mt-3 whitespace-pre-line text-sm text-[var(--text-main)]">{r.note}</p>}
        {d.samples.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">{d.samples.map(f => <button key={f.id} type="button" onClick={() => void openFile(f.id)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-color)] px-2 py-1 text-xs hover:border-[var(--accent)]"><FileText className="h-3.5 w-3.5" /> Образец: {f.name}</button>)}</div>
        )}
      </div>
      {d.my && <MySubmission api={api} d={d} onChanged={load} openFile={openFile} />}
      {d.manage && d.rows && d.stats && <ManagerView api={api} d={d} tree={tree} onChanged={load} openFile={openFile} />}
    </div>
  );
}

function MySubmission({ api, d, onChanged, openFile }: { api: DocsApi; d: RequestDetail; onChanged: () => Promise<void>; openFile: (id: string, dl?: boolean) => Promise<void> }) {
  const my = d.my!; const r = d.request;
  const files = my.submission?.files || [];
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const pick = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<string>("");
  const send = async (list: FileList | null, itemId: string) => {
    if (!list?.length) return;
    setBusy(itemId || "all");
    let ok = 0;
    for (const f of [...list]) {
      try { setProgress(0); await uploadOne(api, f, { requestId: r.id, ...(itemId ? { itemId } : {}) }, n => setProgress(Math.round((n / Math.max(1, f.size)) * 100))); ok++; }
      catch (e: any) { toast.error(`${f.name}: ${e.message}`); }
    }
    if (ok) toast.success(ok === 1 ? "Файл сдан" : `Сдано файлов: ${ok}`);
    setBusy(null); await onChanged();
  };
  const remove = async (fid: string, name: string) => {
    if (!(await confirmDialog({ title: `Убрать «${name}»?`, confirmLabel: "Убрать", danger: true }))) return;
    try { await api.deleteFile(fid); await onChanged(); } catch (e: any) { toast.error(e.message); }
  };
  const choose = (itemId: string) => { setTarget(itemId); setTimeout(() => pick.current?.click(), 0); };
  const rows = my.items.length ? my.items : [{ id: "", label: r.items.mode === "files" && r.items.min > 1 ? `Файлы (не меньше ${r.items.min})` : "Файлы" }];
  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2"><h3 className="flex-1 font-semibold">Моя сдача</h3><Chip s={my.status} /></div>
      {my.submission?.review?.status === "returned" && <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-400">Вернули на доработку{my.submission.review.comment ? `: ${my.submission.review.comment}` : ""}</div>}
      <input ref={pick} type="file" multiple className="hidden" onChange={e => { void send(e.target.files, target); e.target.value = ""; }} />
      <div className="space-y-3">
        {rows.map(it => {
          const mine = files.filter(f => (it.id ? f.itemId === it.id : true));
          return (
            <div key={it.id || "all"} className="rounded-xl border border-[var(--border-color)] p-3">
              <div className="flex flex-wrap items-center gap-2">
                {mine.length ? <Check className="h-4 w-4 text-emerald-600" /> : <span className="h-4 w-4 rounded-full border border-[var(--border-color)]" />}
                <span className="flex-1 text-sm font-medium">{it.label}</span>
                {my.canUpload && <Button size="sm" variant={mine.length ? "secondary" : "primary"} loading={busy === (it.id || "all")} icon={<Upload className="h-3.5 w-3.5" />} onClick={() => choose(it.id)}>{mine.length ? "Ещё файл" : "Загрузить"}</Button>}
              </div>
              {busy === (it.id || "all") && <div className="mt-2 h-1 rounded-full bg-[var(--bg-surface-hover)]"><div className="h-1 rounded-full bg-[var(--accent)]" style={{ width: `${progress}%` }} /></div>}
              {mine.length > 0 && (
                <ul className="mt-2 space-y-1">{mine.map(f => (
                  <li key={f.id} className="flex items-center gap-2 text-sm">
                    <button type="button" className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => void openFile(f.id)}>{f.name}</button>
                    <span className="text-xs text-[var(--text-muted)]">{fmtShort(f.at)}</span>
                    {my.canUpload && <button type="button" aria-label="Убрать" className="text-rose-600" onClick={() => void remove(f.id, f.name)}><Trash2 className="h-4 w-4" /></button>}
                  </li>
                ))}</ul>
              )}
            </div>
          );
        })}
      </div>
      {!my.canUpload && my.status !== "accepted" && <div className="mt-3 text-sm text-[var(--text-muted)]">{r.status === "closed" ? "Сбор закрыт" : "Срок прошёл — сдача закрыта"}</div>}
    </div>
  );
}

type Dim = "grade" | "level" | "subject" | "group" | "position";
const DIMS: { id: Dim; label: string }[] = [{ id: "grade", label: "Классы" }, { id: "level", label: "Ступени" }, { id: "subject", label: "Предметы" }, { id: "group", label: "Группы" }, { id: "position", label: "Должности" }];

function ManagerView({ api, d, tree, onChanged, openFile }: { api: DocsApi; d: RequestDetail; tree: Tree; onChanged: () => Promise<void>; openFile: (id: string, dl?: boolean) => Promise<void> }) {
  const r = d.request; const rows = d.rows!; const s = d.stats!;
  const [filter, setFilter] = useState<"all" | "missing" | "check">("all");
  const [only, setOnly] = useState<string[] | null>(null);
  const [dim, setDim] = useState<Dim>(() => (s.by.grade.length ? "grade" : s.by.position.length ? "position" : "level"));
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState<RecipientRow | null>(null);
  const [extending, setExtending] = useState(false);
  const [adding, setAdding] = useState(false);
  const done = s.done + s.late + s.accepted;
  const shown = useMemo(() => rows.filter(x => (only ? only.includes(x.uid) : true) && (filter === "missing" ? !isDone(x.status) : filter === "check" ? x.review?.status === "pending" : true))
    .sort((a, b) => Number(isDone(a.status)) - Number(isDone(b.status)) || a.name.localeCompare(b.name, "ru")), [rows, filter, only]);
  const act = async (fn: () => Promise<any>, ok?: string) => { setBusy(true); try { const j = await fn(); if (ok) toast.success(ok); await onChanged(); return j; } catch (e: any) { toast.error(e.message); } finally { setBusy(false); } };
  const pending = rows.filter(x => x.review?.status === "pending").length;
  const ring = [
    { label: "Сдали", n: s.done + s.accepted, color: "#16a34a" }, { label: "С опозданием", n: s.late, color: "#d97706" },
    { label: "Частично", n: s.partial, color: "#0284c7" }, { label: "На доработке", n: s.returned, color: "#e11d48" }, { label: "Не сдали", n: s.none, color: "#94a3b8" },
  ];
  const exportXlsx = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Сдача");
    ws.addRow(["Сотрудник", "Должность", "Классы", "Предметы", "Статус", "Файлов", "Когда", "Проверка"]).font = { bold: true };
    for (const x of rows) ws.addRow([x.name, x.positionName, x.placement ? classesText(x.placement) : "", x.placement?.subjects.join(", ") || "", x.statusText, x.files.length, x.at ? new Date(x.at).toLocaleString("ru-RU") : "", x.review ? `${x.review.status === "accepted" ? "Принято" : x.review.status === "returned" ? "На доработке" : "Ждёт проверки"}${x.review.comment ? ` — ${x.review.comment}` : ""}` : ""]);
    ws.columns.forEach((c, i) => { c.width = [32, 18, 14, 22, 20, 8, 18, 30][i]; });
    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a"); a.href = url; a.download = `${r.title.replace(/[\\/:*?"<>|]/g, " ")} — сдача.xlsx`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const bars = s.by[dim];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {r.status === "open" && <Button size="sm" icon={<Bell className="h-4 w-4" />} disabled={busy || done === s.total} onClick={() => void act(async () => { const j = await api.remind(r.id); toast.success(`Напомнили: ${j.sent}`); })}>Напомнить не сдавшим</Button>}
        <Button size="sm" icon={<CalendarClock className="h-4 w-4" />} disabled={busy} onClick={() => setExtending(true)}>Срок</Button>
        <Button size="sm" icon={<UserPlus className="h-4 w-4" />} disabled={busy} onClick={() => setAdding(true)}>Добавить людей</Button>
        <Button size="sm" icon={<Users className="h-4 w-4" />} disabled={busy} onClick={() => void act(async () => { const j = await api.updateRequest(r.id, { rebuild: true }); toast.success(j.added || j.dropped ? `Добавлено ${j.added}, убрано ${j.dropped}` : "Состав не изменился"); })}>Пересобрать получателей</Button>
        <Button size="sm" icon={<Download className="h-4 w-4" />} onClick={() => void exportXlsx()}>Excel</Button>
        <span className="flex-1" />
        {r.status === "open"
          ? <Button size="sm" variant="ghost" disabled={busy} onClick={async () => { if (await confirmDialog({ title: "Закрыть сбор?", message: "Сдавать больше будет нельзя, напоминания остановятся.", confirmLabel: "Закрыть" })) void act(() => api.updateRequest(r.id, { status: "closed" }), "Сбор закрыт"); }}>Закрыть сбор</Button>
          : <Button size="sm" variant="ghost" icon={<RotateCcw className="h-4 w-4" />} disabled={busy} onClick={() => void act(() => api.updateRequest(r.id, { status: "open" }), "Сбор открыт")}>Открыть снова</Button>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
          <div className="flex flex-wrap items-center gap-5">
            <DoneRing parts={ring} done={done} total={s.total} />
            <ul className="space-y-1 text-sm">{ring.filter(p => p.n).map(p => <li key={p.label} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{p.label}<b className="tabular-nums">{p.n}</b></li>)}</ul>
          </div>
          {s.days.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-xs text-[var(--text-muted)]">Сдачи по дням</div>
              <div className="flex h-16 items-end gap-1">{s.days.map(x => { const max = Math.max(...s.days.map(y => y.count)); return <div key={x.day} title={`${new Date(x.day).toLocaleDateString("ru-RU")}: ${x.count}`} className={`flex-1 rounded-t ${new Date(x.day).getTime() > r.dueAt ? "bg-amber-500" : "bg-emerald-500"}`} style={{ height: `${(x.count / max) * 100}%`, minHeight: 4 }} />; })}</div>
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
          <div className="mb-3 flex flex-wrap gap-1">{DIMS.filter(x => s.by[x.id].length).map(x => <button key={x.id} type="button" onClick={() => { setDim(x.id); setOnly(null); }} className={`rounded-lg px-2.5 py-1 text-xs ${dim === x.id ? "bg-[var(--accent)] text-white" : "border border-[var(--border-color)]"}`}>{x.label}</button>)}</div>
          {!bars.length ? <div className="text-sm text-[var(--text-muted)]">Нет данных: у сотрудников не отмечены классы, предметы или группы</div> : (
            <ul className="space-y-1.5">{bars.map(b => (
              <li key={b.key}>
                <button type="button" disabled={!b.missing.length} onClick={() => { setOnly(b.missing); setFilter("all"); }} className="w-full rounded-lg px-1.5 py-1 text-left enabled:hover:bg-[var(--bg-surface-hover)]" title={b.missing.length ? "Показать, кто не сдал" : undefined}>
                  <div className="flex items-baseline gap-2 text-xs"><span className="flex-1">{b.label}</span><span className="tabular-nums font-semibold">{b.done}/{b.total}</span>{b.missing.length > 0 && <span className="text-rose-600">не сдали {b.missing.length}</span>}</div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--bg-surface-hover)]"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(b.done / Math.max(1, b.total)) * 100}%` }} /></div>
                </button>
              </li>
            ))}</ul>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {(["all", "missing", ...(r.review ? ["check"] : [])] as const).map(k => <button key={k} type="button" onClick={() => setFilter(k as any)} className={`rounded-lg px-2.5 py-1 text-sm ${filter === k ? "bg-[var(--accent)] text-white" : "border border-[var(--border-color)]"}`}>{k === "all" ? `Все · ${s.total}` : k === "missing" ? `Не сдали · ${s.total - done}` : `Проверить · ${pending}`}</button>)}
          {only && <button type="button" onClick={() => setOnly(null)} className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)]/10 px-2 py-1 text-xs text-[var(--accent)]">Выбранные на графике · {only.length}<X className="h-3 w-3" /></button>}
        </div>
        <Table minWidth={720}>
          <thead><tr><th>Сотрудник</th><th>Классы</th><th>Статус</th><th>Файлы</th><th>Когда</th>{r.review && <th className="w-44" />}</tr></thead>
          <tbody>{shown.map(x => (
            <tr key={x.uid}>
              <td><div className="font-medium">{x.name}</div><div className="text-xs text-[var(--text-muted)]">{x.positionName}{!x.active ? " · не работает" : ""}</div></td>
              <td className="text-xs text-[var(--text-muted)]">{x.placement ? classesText(x.placement) || "—" : "—"}</td>
              <td><Chip s={x.status} />{x.review?.status === "pending" && <div className="mt-0.5 text-[11px] text-sky-600">ждёт проверки</div>}{x.review?.comment && x.review.status === "returned" && <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{x.review.comment}</div>}</td>
              <td className="max-w-[260px]">{x.files.map(f => <button key={f.id} type="button" onClick={() => void openFile(f.id)} className="flex max-w-full items-center gap-1 truncate text-left text-xs hover:underline"><ExternalLink className="h-3 w-3 shrink-0" /><span className="truncate">{f.name}</span></button>)}{!x.files.length && <span className="text-xs text-[var(--text-muted)]">—</span>}</td>
              <td className={`whitespace-nowrap text-xs ${x.late ? "text-amber-700" : "text-[var(--text-muted)]"}`}>{x.at ? fmtShort(x.at) : "—"}</td>
              {r.review && <td className="whitespace-nowrap text-right">{x.files.length > 0 && x.review?.status !== "accepted" && <>
                <Button size="sm" variant="primary" disabled={busy} onClick={() => void act(() => api.review(r.id, x.uid, "accepted"), "Принято")}>Принять</Button>
                <Button size="sm" variant="ghost" disabled={busy} className="ml-1 text-rose-600" onClick={() => setReturning(x)}>Вернуть</Button></>}</td>}
            </tr>
          ))}</tbody>
        </Table>
      </div>
      {returning && <ReturnModal name={returning.name} onClose={() => setReturning(null)} onSave={async c => { await act(() => api.review(r.id, returning.uid, "returned", c), "Вернули на доработку"); setReturning(null); }} />}
      {extending && <DueModal value={r.dueAt} onClose={() => setExtending(false)} onSave={async ms => { await act(() => api.updateRequest(r.id, { dueAt: ms }), "Срок изменён"); setExtending(false); }} />}
      {adding && <AddPeopleModal staff={(tree.staff || []).filter(p => !rows.some(x => x.uid === p.uid))} onClose={() => setAdding(false)} onSave={async uids => { await act(() => api.updateRequest(r.id, { add: uids }), `Добавлено: ${uids.length}`); setAdding(false); }} />}
    </div>
  );
}

function DoneRing({ parts, done, total }: { parts: { label: string; n: number; color: string }[]; done: number; total: number }) {
  const R = 52, W = 18, C = 2 * Math.PI * R; let acc = 0;
  return (
    <svg viewBox="0 0 140 140" className="h-32 w-32 shrink-0 -rotate-90" role="img" aria-label={`Сдали ${done} из ${total}`}>
      <circle cx="70" cy="70" r={R} fill="none" stroke="var(--bg-surface-hover)" strokeWidth={W} />
      {parts.map(p => { const len = total ? (p.n / total) * C : 0; const el = p.n ? <circle key={p.label} cx="70" cy="70" r={R} fill="none" stroke={p.color} strokeWidth={W} strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`} strokeDashoffset={-acc}><title>{`${p.label}: ${p.n}`}</title></circle> : null; acc += len; return el; })}
      <g className="origin-center rotate-90"><text x="70" y="68" textAnchor="middle" className="fill-[var(--text-main)] text-[22px] font-bold">{done}/{total}</text><text x="70" y="86" textAnchor="middle" className="fill-[var(--text-muted)] text-[10px]">сдали</text></g>
    </svg>
  );
}

function ReturnModal({ name, onClose, onSave }: { name: string; onClose: () => void; onSave: (comment: string) => Promise<void> }) {
  const [c, setC] = useState(""); const [busy, setBusy] = useState(false);
  return (
    <Modal title={`На доработку · ${name}`} onClose={() => !busy && onClose()}>
      <textarea autoFocus rows={3} className={input} value={c} onChange={e => setC(e.target.value)} placeholder="Что исправить" />
      <div className="mt-4 flex justify-end gap-2"><Button onClick={onClose} disabled={busy}>Отмена</Button><Button variant="danger" loading={busy} onClick={async () => { setBusy(true); try { await onSave(c.trim()); } finally { setBusy(false); } }}>Вернуть</Button></div>
    </Modal>
  );
}

function DueModal({ value, onClose, onSave }: { value: number; onClose: () => void; onSave: (ms: number) => Promise<void> }) {
  const [v, setV] = useState(toLocal(Math.max(value, Date.now() + 86400_000))); const [busy, setBusy] = useState(false);
  return (
    <Modal title="Срок сдачи" onClose={() => !busy && onClose()}>
      <input type="datetime-local" className={input} value={v} onChange={e => setV(e.target.value)} />
      <div className="mt-4 flex justify-end gap-2"><Button onClick={onClose} disabled={busy}>Отмена</Button><Button variant="primary" loading={busy} onClick={async () => { setBusy(true); try { await onSave(new Date(v).getTime()); } finally { setBusy(false); } }}>Сохранить</Button></div>
    </Modal>
  );
}

function AddPeopleModal({ staff, onClose, onSave }: { staff: DocsStaff[]; onClose: () => void; onSave: (uids: string[]) => Promise<void> }) {
  const [a, setA] = useState<Audience>({ ...EMPTY_AUDIENCE }); const [busy, setBusy] = useState(false);
  return (
    <Modal title="Добавить людей" onClose={() => !busy && onClose()} wide>
      <AudiencePicker value={a} onChange={setA} staff={staff} positions={[]} peopleOnly />
      <div className="mt-4 flex justify-end gap-2"><Button onClick={onClose} disabled={busy}>Отмена</Button><Button variant="primary" loading={busy} disabled={!a.include.length} onClick={async () => { setBusy(true); try { await onSave(a.include); } finally { setBusy(false); } }}>Добавить {a.include.length || ""}</Button></div>
    </Modal>
  );
}
