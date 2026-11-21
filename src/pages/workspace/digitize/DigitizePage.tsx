import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { ScanText, Search, X } from "lucide-react";
import { Button, Spinner, toast, confirmDialog } from "../../../components/ui";
import DigitizeWizard from "../../../components/digitize/DigitizeWizard";
import { DIGITIZE_MODE_LABEL, type DigitizedScan, type DigitizeTargetType } from "../../../shared/digitize";
import { useDigitizeApi } from "./digitizeApi";

interface Usage { used: number; limit: number }
interface ScanDetails { scan: DigitizedScan; pages: string[] }

const TARGET_PATH: Record<DigitizeTargetType, string> = { document: "docs", sheet: "sheets", journal: "journals" };

const fmtDate = (ts: number): string => new Date(ts).toLocaleString("ru", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function DigitizePage() {
  const { activeTenant } = useOutletContext<{ activeTenant: { id: string } | null }>();
  const tenantId = activeTenant?.id || "";
  const api = useDigitizeApi(tenantId);
  const [scans, setScans] = useState<DigitizedScan[] | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [search, setSearch] = useState("");
  const [wizard, setWizard] = useState(false);
  const [viewing, setViewing] = useState<DigitizedScan | null>(null);
  const [pages, setPages] = useState<string[] | null>(null);

  const targetHref = (s: DigitizedScan): string => `/workspace/${tenantId}/${TARGET_PATH[s.target.type]}/${s.target.id}`;

  const reload = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [a, b] = await Promise.all([
        api("/scans") as Promise<{ scans: DigitizedScan[] }>,
        api("/usage") as Promise<{ usage: Usage }>,
      ]);
      setScans([...a.scans].sort((x, y) => y.createdAt - x.createdAt));
      setUsage(b.usage);
    } catch (e) {
      setScans(prev => prev ?? []);
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить");
    }
  }, [api, tenantId]);

  useEffect(() => { void reload(); }, [reload]);

  const open = async (s: DigitizedScan) => {
    setViewing(s); setPages(null);
    try {
      const r = (await api(`/scans/${s.id}`)) as ScanDetails;
      setPages(r.pages);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось открыть");
      setViewing(null);
    }
  };

  const remove = async (s: DigitizedScan) => {
    if (!(await confirmDialog({ title: "Удалить оригинал?", message: s.title, confirmLabel: "Удалить", danger: true }))) return;
    try {
      await api(`/scans/${s.id}`, { method: "DELETE" });
      setViewing(null);
      toast.success("Удалено");
      void reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Не удалось удалить"); }
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (scans || []).filter(s => !q || s.title.toLowerCase().includes(q) || s.target.title.toLowerCase().includes(q));
  }, [scans, search]);

  const startBtn = <Button icon={<ScanText className="w-4 h-4" />} onClick={() => setWizard(true)}>Оцифровать</Button>;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-[var(--bg-app)]">
      <div className="p-4 sm:p-6 border-b border-[var(--border-color)] bg-[var(--bg-panel)] shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-main)] flex items-center gap-2">
            <ScanText className="w-6 h-6 text-indigo-500" /> Оцифровка
          </h1>
          {usage && <p className="text-[var(--text-muted)] mt-1 font-medium text-sm">{usage.used} / {usage.limit} стр. в этом месяце</p>}
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input type="text" placeholder="Поиск" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]" />
          </div>
          {startBtn}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {scans === null ? (
          <div className="py-20 flex justify-center"><Spinner /></div>
        ) : visible.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-6 border-2 border-dashed border-[var(--border-color)] rounded-2xl">
            <ScanText className="w-12 h-12 text-[var(--text-muted)] opacity-30" />
            {startBtn}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map(s => (
              <div key={s.id} onClick={() => void open(s)}
                className="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-2xl px-4 py-3 hover:border-[var(--accent)] transition cursor-pointer flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[var(--text-main)] truncate">{s.title}</div>
                  <div className="text-xs text-[var(--text-muted)] flex flex-wrap gap-x-3">
                    <span>{DIGITIZE_MODE_LABEL[s.mode]}</span>
                    <Link to={targetHref(s)} onClick={e => e.stopPropagation()} className="text-[var(--accent)] hover:underline truncate max-w-full">→ {s.target.title}</Link>
                  </div>
                </div>
                <div className="text-xs text-[var(--text-muted)] flex flex-wrap gap-x-3 sm:justify-end shrink-0">
                  <span>{s.pageCount} стр.</span>
                  <span>{s.createdByName}</span>
                  <span>{fmtDate(s.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-stretch sm:items-center justify-center sm:p-6" onClick={() => setViewing(null)}>
          <div className="bg-[var(--bg-panel)] w-full sm:max-w-3xl sm:rounded-2xl flex flex-col max-h-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--border-color)] flex items-center gap-3">
              <h2 className="font-bold text-[var(--text-main)] truncate flex-1">{viewing.title}</h2>
              <button onClick={() => setViewing(null)} className="p-1 text-[var(--text-muted)] cursor-pointer" aria-label="Закрыть"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex flex-col gap-3 bg-[var(--bg-app)]">
              {pages === null ? <div className="py-10 flex justify-center"><Spinner /></div> : pages.map((src, i) => (
                <img key={i} src={src} alt={`${i + 1}`} className="w-full rounded-lg border border-[var(--border-color)] cursor-zoom-in"
                  onClick={() => window.open(src, "_blank", "noopener")} />
              ))}
            </div>
            <div className="p-4 border-t border-[var(--border-color)] flex flex-wrap gap-2 justify-end">
              <Button variant="secondary" onClick={() => void remove(viewing)}>Удалить оригинал</Button>
              <Link to={targetHref(viewing)}><Button>Открыть результат</Button></Link>
            </div>
          </div>
        </div>
      )}

      {wizard && <DigitizeWizard tenantId={tenantId} onClose={() => setWizard(false)} onSaved={() => { void reload(); }} />}
    </div>
  );
}
