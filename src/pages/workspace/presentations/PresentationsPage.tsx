import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Copy, Download, ExternalLink, Globe, Loader2, Lock, MonitorPlay, Search, Trash2, Upload, Users, UserCheck } from "lucide-react";
import { auth } from "../../../lib/firebase";
import FancyQr, { QR_THEMES, downloadQr } from "../../../components/forms/FancyQr";
import { Thumb } from "../../../components/presentations/SlidePlayer";
import { SLIDE_CSS, prepareSlide } from "../../../components/presentations/slideHtml";
import { tenantLogos } from "../../../shared/legal";
import { ACCESS_HINT, ACCESS_LABEL, showLink, type PresentationAccess, type PresentationAccessMode, type PresentationSlide } from "../../../shared/presentations";
import { Modal, btn, btnPrimary, card, input, label } from "../journals/components/ui";
import { parseDeckFile, putFile, type ParsedDeck } from "./deckZip";

/**
 * Презентации организации: загрузка колоды Claude Slides (.zip) или
 * HTML-страницы, показ по ссылке и доступ — у каждой презентации свой.
 */
interface Item {
  id: string; title: string; description: string; kind: "slides" | "html"; code: string; status: "uploading" | "ready";
  access: PresentationAccess; slideCount: number; cover: PresentationSlide | null;
  createdByName: string; createdAt: number; updatedAt: number; size: number; canManage: boolean;
}
type Employee = { uid: string; name: string; email: string };

const ACCESS_ICON: Record<PresentationAccessMode, React.ComponentType<{ className?: string }>> = { private: Lock, org: Users, people: UserCheck, public: Globe };
const mb = (n: number) => (n / 1024 / 1024).toLocaleString("ru-RU", { maximumFractionDigits: 1 });

function usePresApi(tenantId: string) {
  return useCallback(async (path: string, init: RequestInit = {}) => {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
    const r = await fetch(`/api/presentations/${tenantId}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === false) throw new Error(j.error || `Ошибка ${r.status}`);
    return j;
  }, [tenantId]);
}

export default function PresentationsPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const tenantId: string = activeTenant?.id || "";
  const api = usePresApi(tenantId);
  const [items, setItems] = useState<Item[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sharing, setSharing] = useState<Item | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try { const j = await api(""); setItems(j.presentations); setCanCreate(!!j.canCreate); setError(null); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api, tenantId]);
  useEffect(() => { void load(); }, [load]);

  const visible = items.filter(p => !q.trim() || p.title.toLowerCase().includes(q.trim().toLowerCase()));
  const remove = async (p: Item) => {
    if (!confirm(`Удалить «${p.title}»? Ссылка перестанет открываться, видео и картинки удалятся.`)) return;
    try { await api(`/${p.id}`, { method: "DELETE" }); await load(); } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <style>{SLIDE_CSS}</style>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-xl md:text-2xl font-bold text-[var(--text-main)]">Презентации</h1>
          <p className="text-sm text-[var(--text-muted)]">Показ со звуком и анимациями по ссылке. Кому открыть — решаете для каждой презентации.</p>
        </div>
        {canCreate && <button className={`${btnPrimary} w-full sm:w-auto justify-center`} onClick={() => setUploading(true)}><Upload className="w-4 h-4" /> Загрузить презентацию</button>}
      </div>

      {items.length > 6 && (
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input className={`${input} pl-9`} placeholder="Поиск по названию" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      )}
      {loading && <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>}
      {error && <div className="text-sm text-rose-600">{error}</div>}
      {!loading && !items.length && (
        <div className={`${card} p-10 text-center space-y-2`}>
          <MonitorPlay className="w-10 h-10 mx-auto text-[var(--text-muted)]" />
          <div className="font-semibold text-[var(--text-main)]">Презентаций пока нет</div>
          <p className="text-sm text-[var(--text-muted)]">{canCreate ? "Загрузите колоду Claude Slides (.zip) или HTML-страницу." : "Когда вам откроют презентацию, она появится здесь."}</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map(p => <Card key={p.id} p={p} onShare={() => setSharing(p)} onDelete={() => remove(p)} />)}
      </div>

      {uploading && <UploadModal api={api} onClose={() => setUploading(false)} onDone={async () => { setUploading(false); await load(); }} />}
      {sharing && <ShareModal p={sharing} api={api} tenant={activeTenant} onClose={() => setSharing(null)} onSaved={async () => { await load(); }} />}
    </div>
  );
}

function Card({ p, onShare, onDelete }: { p: Item; onShare: () => void; onDelete: () => void }) {
  const cover = useMemo(() => (p.cover ? prepareSlide(p.cover.id, p.cover.html, {}) : null), [p.cover]);
  const Icon = ACCESS_ICON[p.access.mode];
  const link = showLink(window.location.origin, p.code);
  return (
    <div className={`${card} overflow-hidden flex flex-col`}>
      <a href={p.status === "ready" ? link : undefined} target="_blank" rel="noreferrer" className="block relative bg-[#0b0d12]">
        {cover ? <Thumb slide={cover} /> : <div className="aspect-video grid place-items-center text-white/50"><MonitorPlay className="w-10 h-10" /></div>}
        {p.status !== "ready" && <div className="absolute inset-0 grid place-items-center bg-black/60 text-white text-sm">Загрузка не завершена</div>}
      </a>
      <div className="p-3 flex-1 flex flex-col gap-2">
        <div className="font-semibold text-[var(--text-main)] leading-snug line-clamp-2">{p.title}</div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--bg-surface-hover)]"><Icon className="w-3 h-3" /> {ACCESS_LABEL[p.access.mode]}{p.access.mode === "people" ? ` · ${p.access.people.length}` : ""}</span>
          <span>{p.kind === "slides" ? `${p.slideCount} слайдов` : "HTML-страница"}</span>
          {p.size > 0 && <span>{mb(p.size)} МБ</span>}
          <span>{p.createdByName}</span>
        </div>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          <a className={`${btnPrimary} ${p.status !== "ready" ? "pointer-events-none opacity-40" : ""}`} href={link} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /> Открыть</a>
          {p.canManage && <button className={btn} onClick={onShare}><Users className="w-4 h-4" /> Доступ</button>}
          {p.canManage && <button className={`${btn} text-rose-600 ml-auto`} onClick={onDelete} title="Удалить"><Trash2 className="w-4 h-4" /></button>}
        </div>
      </div>
    </div>
  );
}

function AccessPicker({ value, onChange, employees }: { value: PresentationAccess; onChange: (v: PresentationAccess) => void; employees: Employee[] | null }) {
  const [q, setQ] = useState("");
  const list = (employees || []).filter(e => !q.trim() || `${e.name} ${e.email}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="space-y-2">
      <div className="grid sm:grid-cols-2 gap-2">
        {(["private", "org", "people", "public"] as const).map(m => {
          const Icon = ACCESS_ICON[m];
          return (
            <label key={m} className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer ${value.mode === m ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border-color)]"}`}>
              <input type="radio" className="mt-1" checked={value.mode === m} onChange={() => onChange({ ...value, mode: m })} />
              <span><span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-main)]"><Icon className="w-4 h-4" /> {ACCESS_LABEL[m]}</span>
                <span className="block text-[11px] text-[var(--text-muted)] mt-0.5">{ACCESS_HINT[m]}</span></span>
            </label>
          );
        })}
      </div>
      {value.mode === "people" && (
        <div className="rounded-xl border border-[var(--border-color)]">
          <div className="p-2 border-b border-[var(--border-color)] flex items-center gap-2">
            <input className={`${input} flex-1`} placeholder="Найти сотрудника" value={q} onChange={e => setQ(e.target.value)} />
            <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">Отмечено: {value.people.length}</span>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {!employees && <div className="p-4 text-center"><Loader2 className="w-4 h-4 animate-spin inline text-[var(--text-muted)]" /></div>}
            {list.map(e => (
              <label key={e.uid} className="flex items-center gap-2.5 px-3 py-2 border-t border-[var(--border-color)] first:border-0 cursor-pointer hover:bg-[var(--bg-surface-hover)]">
                <input type="checkbox" checked={value.people.includes(e.uid)} onChange={ev => onChange({ ...value, people: ev.target.checked ? [...value.people, e.uid] : value.people.filter(x => x !== e.uid) })} />
                <span className="min-w-0"><span className="block text-sm text-[var(--text-main)] truncate">{e.name}</span><span className="block text-[11px] text-[var(--text-muted)] truncate">{e.email}</span></span>
              </label>
            ))}
            {employees && !list.length && <div className="p-4 text-center text-sm text-[var(--text-muted)]">Никого не нашли</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function useEmployees(api: ReturnType<typeof usePresApi>, need: boolean) {
  const [list, setList] = useState<Employee[] | null>(null);
  useEffect(() => { if (need && !list) api("/employees").then(j => setList(j.employees)).catch(() => setList([])); }, [need, list, api]);
  return list;
}

function ShareModal({ p, api, tenant, onClose, onSaved }: { p: Item; api: ReturnType<typeof usePresApi>; tenant: any; onClose: () => void; onSaved: () => Promise<void> }) {
  const [access, setAccess] = useState<PresentationAccess>(p.access);
  const [title, setTitle] = useState(p.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const employees = useEmployees(api, access.mode === "people");
  const link = showLink(window.location.origin, p.code);
  const mark = tenantLogos(tenant).markUrl;
  const dirty = JSON.stringify(access) !== JSON.stringify(p.access) || title.trim() !== p.title;
  const save = async () => {
    setBusy(true); setError(null);
    try { await api(`/${p.id}`, { method: "PUT", body: JSON.stringify({ access, title }) }); await onSaved(); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal title="Доступ к презентации" onClose={onClose} wide>
      <div className="space-y-4">
        <div><span className={label}>Название</span><input className={input} value={title} onChange={e => setTitle(e.target.value)} /></div>
        <div>
          <span className={label}>Кто может открыть</span>
          <AccessPicker value={access} onChange={setAccess} employees={employees} />
        </div>
        <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-start">
          <div className="space-y-2">
            <span className={label}>Ссылка</span>
            <div className="flex gap-2">
              <input className={`${input} font-mono text-xs`} readOnly value={link} onFocus={e => e.target.select()} />
              <button className={btn} onClick={() => { void navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}><Copy className="w-4 h-4" /> {copied ? "Скопировано" : "Копировать"}</button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">Ссылка не меняется при смене доступа: закрыли — у тех, кому доступ больше не положен, она перестаёт открываться. Номер слайда можно добавить в конец: <span className="font-mono">#slide-5</span>.</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="bg-white rounded-xl p-2"><FancyQr value={link} size={132} logo={mark} /></div>
            <button className="text-xs text-[var(--accent)] hover:underline inline-flex items-center gap-1" onClick={() => downloadQr(link, QR_THEMES[0], `QR — ${p.title}.png`, 1024, mark)}><Download className="w-3 h-3" /> QR для печати</button>
          </div>
        </div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
          <button className={btn} onClick={onClose}>Закрыть</button>
          <button className={btnPrimary} disabled={busy || !dirty || !title.trim() || (access.mode === "people" && !access.people.length)} onClick={save}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} {saved ? "Сохранено" : "Сохранить"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function UploadModal({ api, onClose, onDone }: { api: ReturnType<typeof usePresApi>; onClose: () => void; onDone: () => void }) {
  const [deck, setDeck] = useState<ParsedDeck | null>(null);
  const [fileName, setFileName] = useState("");
  const [title, setTitle] = useState("");
  const [access, setAccess] = useState<PresentationAccess>({ mode: "org", people: [] });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const employees = useEmployees(api, access.mode === "people");
  const total = deck ? Object.values(deck.files).reduce((n, f) => n + f.blob.size, 0) : 0;

  const pick = async (f?: File) => {
    if (!f) return;
    setError(null); setDeck(null); setFileName(f.name);
    try { const d = await parseDeckFile(f); setDeck(d); setTitle(d.title); }
    catch (e: any) { setError(e.message); }
  };
  const upload = async () => {
    if (!deck) return;
    setBusy(true); setError(null);
    try {
      const assets = Object.fromEntries(Object.entries(deck.files).map(([id, f]) => [id, { type: f.type, size: f.blob.size }]));
      const j = await api("", { method: "POST", body: JSON.stringify({ title, kind: deck.kind, slides: deck.slides, faces: deck.faces, assets, access, source: { kind: deck.kind === "slides" ? "claude_slides" : "html", ref: fileName } }) });
      const loaded: Record<string, number> = {};
      setProgress({ done: 0, total });
      // По три файла параллельно: быстрее, и не забиваем канал учительского ноутбука.
      const queue = Object.entries(deck.files);
      const worker = async () => {
        for (let it = queue.shift(); it; it = queue.shift()) {
          const [id, f] = it;
          await putFile(j.uploads[id], f.blob, f.type, n => { loaded[id] = n; setProgress({ done: Object.values(loaded).reduce((a, b) => a + b, 0), total }); });
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      await api(`/${j.id}/finalize`, { method: "POST" });
      onDone();
    } catch (e: any) { setError(e.message); setBusy(false); setProgress(null); }
  };

  return (
    <Modal title="Загрузить презентацию" onClose={busy ? () => {} : onClose} wide>
      <div className="space-y-4">
        <label className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer ${deck ? "border-emerald-500/50 bg-emerald-500/5" : "border-[var(--border-color)] hover:border-[var(--accent)]"}`}>
          <Upload className="w-7 h-7 text-[var(--text-muted)]" />
          <span className="text-sm font-semibold text-[var(--text-main)]">{fileName || "Выберите .zip колоды или .html-файл"}</span>
          {deck && <span className="text-xs text-emerald-700">{deck.kind === "slides" ? `${deck.slides.length} слайдов · ${Object.keys(deck.files).length} файлов · ${mb(total)} МБ` : "HTML-страница"}</span>}
          <input type="file" accept=".zip,.html,.htm" className="hidden" disabled={busy} onChange={e => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {deck?.missing.length ? <div className="text-sm text-rose-600">В архиве нет {deck.missing.length} файлов, на которые ссылаются слайды (видео или картинки). Соберите архив заново со всеми файлами из _blob.</div> : null}

        <details className="rounded-xl border border-[var(--border-color)] p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-[var(--text-main)]">Как получить .zip из Claude</summary>
          <div className="mt-2 space-y-1.5 text-[13px] text-[var(--text-muted)]">
            <p>В чате Claude, где сделана презентация, напишите:</p>
            <p className="font-mono text-[12px] bg-[var(--bg-surface-hover)] rounded-lg p-2 text-[var(--text-main)]">Собери все файлы этой презентации в один zip: project/deck.json, папку project/slides и все загруженные файлы (_blob) — картинки и видео — с их id в имени.</p>
            <p>Скачайте архив и выберите его здесь. Подойдёт и любая страница, сохранённая одним .html-файлом.</p>
          </div>
        </details>

        {deck && (
          <>
            <div><span className={label}>Название</span><input className={input} value={title} onChange={e => setTitle(e.target.value)} /></div>
            <div><span className={label}>Кто может открыть</span><AccessPicker value={access} onChange={setAccess} employees={employees} /></div>
          </>
        )}
        {progress && (
          <div>
            <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1"><span>Загружаем видео и картинки…</span><span className="tabular-nums">{mb(progress.done)} / {mb(progress.total)} МБ</span></div>
            <div className="h-2 rounded-full bg-[var(--bg-surface-hover)]"><div className="h-2 rounded-full bg-[var(--accent)] transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 100}%` }} /></div>
          </div>
        )}
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
          <button className={btn} onClick={onClose} disabled={busy}>Отмена</button>
          <button className={btnPrimary} disabled={busy || !deck || !title.trim() || !!deck.missing.length || (access.mode === "people" && !access.people.length)} onClick={upload}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Загрузить
          </button>
        </div>
      </div>
    </Modal>
  );
}
