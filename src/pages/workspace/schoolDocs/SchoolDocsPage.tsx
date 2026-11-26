import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { ChevronRight, ClipboardCheck, Download, ExternalLink, File, FileImage, FileSpreadsheet, FileText, Folder, FolderOpen, FolderPlus, Pencil, RotateCcw, Shield, Trash2, Upload } from "lucide-react";
import { Button, EmptyState, Modal, PageHeader, Spinner, Tabs, confirmDialog, input, toast, useUrlTab } from "../../../components/ui";
import { fmtSize, type FolderAccess } from "../../../shared/schoolDocs";
import { docsApi, uploadOne, type FileRow, type FolderRow } from "./docsApi";
import FolderAccessModal from "./FolderAccessModal";
import type { DocsStaff } from "./AudiencePicker";
import RequestsTab from "./RequestsTab";

/**
 * «Документы школы»: папки как на диске. Слева дерево, справа содержимое.
 * Кто что видит и может — решает сервер по доступу папки; здесь только
 * показываем то, что пришло, и кнопки по правам.
 */
type Tree = Awaited<ReturnType<ReturnType<typeof docsApi>["tree"]>>;
type Content = Awaited<ReturnType<ReturnType<typeof docsApi>["folder"]>>;

const fmtDate = (ms: number) => new Date(ms).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const iconOf = (type: string) => (type.startsWith("image/") ? FileImage : /sheet|excel|csv/.test(type) ? FileSpreadsheet : /pdf|word|document|text|rtf/.test(type) ? FileText : File);

export default function SchoolDocsPage() {
  const { activeTenant } = useOutletContext<any>();
  const t = String(activeTenant?.id || "");
  const api = useMemo(() => docsApi(t), [t]);
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useUrlTab<"folders" | "requests" | "trash">("tab", ["folders", "requests", "trash"], "folders");
  const cur = params.get("f") || "";
  const open = (id: string) => { const p = new URLSearchParams(params); if (id) p.set("f", id); else p.delete("f"); p.delete("tab"); setParams(p); };

  const [tree, setTree] = useState<Tree | null>(null);
  const [content, setContent] = useState<Content | null>(null);
  const [error, setError] = useState("");
  const loadTree = useCallback(async () => { if (!t) return; try { setTree(await api.tree()); setError(""); } catch (e: any) { setError(e.message); } }, [api, t]);
  const loadFolder = useCallback(async () => {
    if (!cur) { setContent(null); return; }
    try { setContent(await api.folder(cur)); } catch (e: any) { toast.error(e.message); open(""); }
  }, [api, cur]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void loadTree(); }, [loadTree]);
  useEffect(() => { void loadFolder(); }, [loadFolder]);
  const reload = async () => { await Promise.all([loadTree(), loadFolder()]); };

  const [naming, setNaming] = useState<null | { title: string; value: string; onSave: (v: string) => Promise<void> }>(null);
  const [access, setAccess] = useState<FolderRow | null>(null);
  const [uploads, setUploads] = useState<{ name: string; done: number; size: number; error?: string }[]>([]);
  const [drag, setDrag] = useState(false);
  const pick = useRef<HTMLInputElement>(null);

  if (error) return <EmptyState title={error} />;
  if (!tree) return <Spinner />;
  const me = tree.me;
  const folder = content?.folder || null;
  const roots = tree.folders.filter(f => !f.parentId);
  const canCreate = folder ? folder.rights.manage : me.manageAll;
  const staff: DocsStaff[] = tree.staff || [];

  const createFolder = () => setNaming({
    title: folder ? `Новая папка в «${folder.name}»` : "Новая папка", value: "",
    onSave: async name => { const j = await api.createFolder(name, folder?.id || null); setNaming(null); await loadTree(); open(j.id); },
  });
  const renameFolder = (f: FolderRow) => setNaming({ title: "Переименовать папку", value: f.name, onSave: async name => { await api.updateFolder(f.id, { name }); setNaming(null); await reload(); } });
  const deleteFolder = async (f: FolderRow) => {
    if (!(await confirmDialog({ title: `Убрать папку «${f.name}» в корзину?`, message: "Вместе со всем, что внутри. Вернуть можно 30 дней.", confirmLabel: "В корзину", danger: true }))) return;
    try { await api.deleteFolder(f.id); toast.success("Папка в корзине"); open(f.parentId || ""); await loadTree(); } catch (e: any) { toast.error(e.message); }
  };
  const saveAccess = async (a: FolderAccess) => { if (!access) return; try { await api.updateFolder(access.id, { access: a }); toast.success("Доступ сохранён"); setAccess(null); await reload(); } catch (e: any) { toast.error(e.message); } };

  const upload = async (files: FileList | File[]) => {
    if (!folder?.rights.upload) return;
    const list = [...files];
    setUploads(list.map(f => ({ name: f.name, done: 0, size: f.size })));
    let ok = 0;
    for (let i = 0; i < list.length; i++) {
      try { await uploadOne(api, list[i], { folderId: folder.id }, n => setUploads(u => u.map((x, k) => (k === i ? { ...x, done: n } : x)))); ok++; setUploads(u => u.map((x, k) => (k === i ? { ...x, done: x.size } : x))); }
      catch (e: any) { setUploads(u => u.map((x, k) => (k === i ? { ...x, error: e.message } : x))); }
    }
    if (ok) toast.success(`Загружено: ${ok}`);
    await loadFolder();
    setUploads(u => u.filter(x => x.error));
  };
  const openFile = async (f: FileRow, download = false) => {
    // Окно открываем сразу (иначе браузер сочтёт его всплывающим), адрес подставляем после ответа.
    const w = download ? null : window.open("about:blank", "_blank");
    try { const { url } = await api.fileUrl(f.id, download); if (w) w.location.href = url; else window.location.href = url; }
    catch (e: any) { w?.close(); toast.error(e.message); }
  };
  const renameFile = (f: FileRow) => setNaming({ title: "Переименовать файл", value: f.name, onSave: async name => { await api.updateFile(f.id, { name }); setNaming(null); await loadFolder(); } });
  const deleteFile = async (f: FileRow) => {
    if (!(await confirmDialog({ title: `Убрать «${f.name}» в корзину?`, confirmLabel: "В корзину", danger: true }))) return;
    try { await api.deleteFile(f.id); await loadFolder(); } catch (e: any) { toast.error(e.message); }
  };

  const tabs = [{ id: "folders", label: "Папки" }, { id: "requests", label: "Сборы документов" }, ...(me.manageAll ? [{ id: "trash", label: "Корзина" }] : [])];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Документы школы" tabs={<Tabs tabs={tabs} value={tab} onChange={id => setTab(id as any)} />} />
      {tab === "requests" && <RequestsTab api={api} tenantId={t} tree={tree} onOpenFolder={open} />}
      {tab === "trash" && <TrashTab api={api} onRestored={reload} />}
      {tab === "folders" && (
        <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden md:block">
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-2">
              <button type="button" onClick={() => open("")} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${!cur ? "bg-[var(--accent)]/10 font-semibold text-[var(--accent)]" : "text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]"}`}><FolderOpen className="h-4 w-4" /> Все папки</button>
              <TreeLevel all={tree.folders} parent={null} cur={cur} open={open} depth={0} />
            </div>
            {tree.usage && (
              <div className="mt-3 px-1 text-xs text-[var(--text-muted)]">
                <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface-hover)]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.min(100, (tree.usage.used / tree.usage.quota) * 100)}%` }} /></div>
                Занято {fmtSize(tree.usage.used)} из {fmtSize(tree.usage.quota)}
              </div>
            )}
          </aside>

          <section className={`min-w-0 rounded-2xl border bg-[var(--bg-surface)] p-3 sm:p-4 ${drag ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30" : "border-[var(--border-color)]"}`}
            onDragOver={e => { if (folder?.rights.upload) { e.preventDefault(); setDrag(true); } }} onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) void upload(e.dataTransfer.files); }}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm">
                <button type="button" className="text-[var(--text-muted)] hover:text-[var(--text-main)]" onClick={() => open("")}>Все папки</button>
                {(content?.path || []).map(p => <span key={p.id} className="flex items-center gap-1"><ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" /><button type="button" className={p.id === cur ? "font-semibold text-[var(--text-main)]" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"} onClick={() => open(p.id)}>{p.name}</button></span>)}
              </nav>
              {canCreate && <Button size="sm" icon={<FolderPlus className="h-4 w-4" />} onClick={createFolder}>Папка</Button>}
              {folder?.rights.upload && <Button size="sm" variant="primary" icon={<Upload className="h-4 w-4" />} onClick={() => pick.current?.click()}>Загрузить</Button>}
              {folder?.rights.manage && <Button size="sm" icon={<ClipboardCheck className="h-4 w-4" />} onClick={() => { const p = new URLSearchParams(params); p.set("tab", "requests"); p.set("new", "1"); setParams(p); }}>Собрать документы</Button>}
              {folder?.rights.manage && <Button size="sm" icon={<Shield className="h-4 w-4" />} onClick={() => setAccess(folder)}>Доступ</Button>}
              {folder?.rights.manage && <Button size="sm" variant="ghost" aria-label="Переименовать" icon={<Pencil className="h-4 w-4" />} onClick={() => renameFolder(folder)} />}
              {folder?.rights.manage && <Button size="sm" variant="ghost" aria-label="В корзину" icon={<Trash2 className="h-4 w-4 text-rose-600" />} onClick={() => void deleteFolder(folder)} />}
              <input ref={pick} type="file" multiple className="hidden" onChange={e => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ""; }} />
            </div>

            {uploads.length > 0 && (
              <div className="mb-3 space-y-1.5 rounded-xl border border-[var(--border-color)] p-2.5 text-sm">
                {uploads.map((u, i) => (
                  <div key={i}>
                    <div className="flex justify-between gap-2"><span className="truncate">{u.name}</span><span className={u.error ? "text-rose-600" : "text-[var(--text-muted)]"}>{u.error || `${Math.round((u.done / Math.max(1, u.size)) * 100)}%`}</span></div>
                    {!u.error && <div className="mt-1 h-1 rounded-full bg-[var(--bg-surface-hover)]"><div className="h-1 rounded-full bg-[var(--accent)]" style={{ width: `${(u.done / Math.max(1, u.size)) * 100}%` }} /></div>}
                  </div>
                ))}
                {uploads.some(u => u.error) && <button type="button" className="text-xs text-[var(--text-muted)] underline" onClick={() => setUploads([])}>Скрыть</button>}
              </div>
            )}

            {(() => {
              const subs = folder ? content?.folders || [] : roots;
              const files = folder ? content?.files || [] : [];
              if (cur && !content) return <Spinner />;
              if (!subs.length && !files.length) return (
                <EmptyState icon={<FolderOpen />} title={folder ? (folder.rights.upload ? "Пусто — перетащите файлы сюда" : "Пусто") : canCreate ? "Создайте первую папку" : "Вам пока не открыли ни одной папки"}
                  action={!folder && canCreate ? <Button variant="primary" icon={<FolderPlus className="h-4 w-4" />} onClick={createFolder}>Папка</Button> : undefined} />
              );
              return (
                <div className="space-y-4">
                  {subs.length > 0 && (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
                      {subs.map(f => (
                        <button key={f.id} type="button" onClick={() => open(f.id)} className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 py-2.5 text-left text-sm hover:border-[var(--accent)]">
                          <Folder className="h-5 w-5 shrink-0 text-amber-500" /><span className="truncate font-medium text-[var(--text-main)]">{f.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {files.length > 0 && (
                    <ul className="divide-y divide-[var(--border-color)]">
                      {files.map(f => {
                        const Icon = iconOf(f.type);
                        const mine = f.uploadedBy.uid === me.uid;
                        return (
                          <li key={f.id} className="flex items-center gap-3 py-2">
                            <Icon className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />
                            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void openFile(f)}>
                              <div className="truncate text-sm font-medium text-[var(--text-main)] hover:underline">{f.name}</div>
                              <div className="text-xs text-[var(--text-muted)]">{f.uploadedBy.name} · {fmtDate(f.at)} · {fmtSize(f.size)}{f.requestId ? " · по сбору" : ""}</div>
                            </button>
                            <Button size="sm" variant="ghost" aria-label="Открыть" icon={<ExternalLink className="h-4 w-4" />} onClick={() => void openFile(f)} />
                            <Button size="sm" variant="ghost" aria-label="Скачать" icon={<Download className="h-4 w-4" />} onClick={() => void openFile(f, true)} />
                            {(mine || folder?.rights.manage) && <Button size="sm" variant="ghost" aria-label="Переименовать" icon={<Pencil className="h-4 w-4" />} onClick={() => renameFile(f)} />}
                            {(mine || folder?.rights.manage) && <Button size="sm" variant="ghost" aria-label="В корзину" icon={<Trash2 className="h-4 w-4 text-rose-600" />} onClick={() => void deleteFile(f)} />}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })()}
          </section>
        </div>
      )}

      {naming && <NameModal {...naming} onClose={() => setNaming(null)} />}
      {access && access.access && (
        <FolderAccessModal name={access.name} value={access.access} root={!access.parentId} staff={staff} positions={tree.positions || []} onClose={() => setAccess(null)} onSave={saveAccess} />
      )}
    </div>
  );
}

function TreeLevel({ all, parent, cur, open, depth }: { all: FolderRow[]; parent: string | null; cur: string; open: (id: string) => void; depth: number }) {
  const kids = all.filter(f => f.parentId === parent);
  if (!kids.length || depth > 8) return null;
  return (
    <ul>
      {kids.map(f => (
        <li key={f.id}>
          <button type="button" onClick={() => open(f.id)} style={{ paddingLeft: 8 + depth * 14 }}
            className={`flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-sm ${cur === f.id ? "bg-[var(--accent)]/10 font-semibold text-[var(--accent)]" : "text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]"}`}>
            <Folder className="h-4 w-4 shrink-0 text-amber-500" /><span className="truncate">{f.name}</span>
          </button>
          <TreeLevel all={all} parent={f.id} cur={cur} open={open} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );
}

function NameModal({ title, value, onSave, onClose }: { title: string; value: string; onSave: (v: string) => Promise<void>; onClose: () => void }) {
  const [v, setV] = useState(value);
  const [busy, setBusy] = useState(false);
  const go = async () => { if (!v.trim()) return; setBusy(true); try { await onSave(v.trim()); } catch (e: any) { toast.error(e.message); } finally { setBusy(false); } };
  return (
    <Modal title={title} onClose={() => !busy && onClose()}>
      <input autoFocus className={input} value={v} maxLength={180} onChange={e => setV(e.target.value)} onKeyDown={e => e.key === "Enter" && void go()} />
      <div className="mt-4 flex justify-end gap-2"><Button onClick={onClose} disabled={busy}>Отмена</Button><Button variant="primary" loading={busy} disabled={!v.trim()} onClick={() => void go()}>Сохранить</Button></div>
    </Modal>
  );
}

function TrashTab({ api, onRestored }: { api: ReturnType<typeof docsApi>; onRestored: () => Promise<void> }) {
  const [d, setD] = useState<Awaited<ReturnType<ReturnType<typeof docsApi>["trash"]>> | null>(null);
  const load = useCallback(async () => { try { setD(await api.trash()); } catch (e: any) { toast.error(e.message); } }, [api]);
  useEffect(() => { void load(); }, [load]);
  if (!d) return <Spinner />;
  const restore = async (kind: "file" | "folder", id: string) => { try { await api.restore(kind, id); toast.success("Возвращено"); await load(); await onRestored(); } catch (e: any) { toast.error(e.message); } };
  if (!d.folders.length && !d.files.length) return <EmptyState icon={<Trash2 />} title="Корзина пуста" />;
  return (
    <div className="space-y-1 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
      <div className="mb-2 text-xs text-[var(--text-muted)]">Хранится {d.days} дней</div>
      {d.folders.map(f => (
        <div key={f.id} className="flex items-center gap-2 py-1.5 text-sm"><Folder className="h-4 w-4 text-amber-500" /><span className="flex-1 truncate">{f.path ? `${f.path} / ` : ""}{f.name}</span><span className="text-xs text-[var(--text-muted)]">{fmtDate(f.deletedAt)}</span><Button size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => void restore("folder", f.id)}>Вернуть</Button></div>
      ))}
      {d.files.map(f => (
        <div key={f.id} className="flex items-center gap-2 py-1.5 text-sm"><File className="h-4 w-4 text-[var(--text-muted)]" /><span className="flex-1 truncate">{f.name}<span className="ml-1 text-xs text-[var(--text-muted)]">{f.folderName}</span></span><span className="text-xs text-[var(--text-muted)]">{fmtDate(f.deletedAt)}</span><Button size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => void restore("file", f.id)}>Вернуть</Button></div>
      ))}
    </div>
  );
}
