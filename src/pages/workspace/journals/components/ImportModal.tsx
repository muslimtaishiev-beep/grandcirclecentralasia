import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { Button, toast } from "../../../../components/ui";
import { JOURNAL_LIMITS, type Journal, type JournalColumn } from "../../../../shared/journals";
import { readFirstSheet } from "../journalExcel";
import { Modal, btn, input, label } from "./ui";

type Api = (path: string, init?: RequestInit) => Promise<any>;
const IMPORTABLE = ["text", "number", "date", "select", "checkbox"];
const norm = (s: string) => s.trim().toLowerCase().replace(/ё/g, "е");

/** «31.12.2026» → «2026-12-31»; остальное как есть. */
const toIso = (s: string) => { const m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s.trim()); return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : s.trim(); };
const convert = (c: JournalColumn, raw: string): unknown => {
  const v = raw.trim();
  if (!v) return null;
  if (c.type === "date") return toIso(v);
  if (c.type === "checkbox") {
    if (/^(да|yes|true|1|\+|✓)$/i.test(v) || norm(v) === norm(c.yesLabel || "да")) return true;
    if (/^(нет|no|false|0|-)$/i.test(v) || norm(v) === norm(c.noLabel || "нет")) return false;
    return null;
  }
  if (c.type === "number") return Number(v.replace(",", ".").replace(/\s/g, ""));
  return v;
};

/** Загрузка записей из Excel: колонки файла сопоставляются с колонками журнала по заголовку. */
export default function ImportModal({ journal, api, onDone, onClose }: { journal: Journal; api: Api; onDone: (entries: any[]) => void; onClose: () => void }) {
  const cols = journal.columns.filter(c => IMPORTABLE.includes(c.type));
  const [rows, setRows] = useState<string[][] | null>(null);
  const [map, setMap] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setError("");
    try {
      const r = await readFirstSheet(f);
      if (r.length < 2) { setError("В файле нет строк с данными"); return; }
      setRows(r);
      const m: Record<number, string> = {};
      r[0].forEach((h, i) => { const hit = cols.find(c => norm(c.label) === norm(h)); if (hit) m[i] = hit.id; });
      setMap(m);
    } catch (e: any) { setError(`Не удалось прочитать файл: ${e.message}`); }
  };

  const data = useMemo(() => {
    if (!rows) return [];
    return rows.slice(1).map(r => {
      const values: Record<string, unknown> = {};
      for (const [i, cid] of Object.entries(map)) {
        const c = cols.find(x => x.id === cid); if (!c) continue;
        const v = convert(c, r[Number(i)] ?? "");
        if (v !== null && !(typeof v === "number" && Number.isNaN(v))) values[cid] = v;
      }
      return { values };
    }).filter(e => Object.keys(e.values).length > 0);
  }, [rows, map, cols]);

  const run = async () => {
    setBusy(true); setError("");
    try {
      const created: any[] = [];
      for (let i = 0; i < data.length; i += JOURNAL_LIMITS.maxBulk) {
        const j = await api(`/${journal.id}/entries`, { method: "POST", body: JSON.stringify({ entries: data.slice(i, i + JOURNAL_LIMITS.maxBulk) }) });
        created.push(...(j.entries || []));
      }
      toast.success(`Загружено записей: ${created.length}`);
      onDone(created); onClose();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal title="Загрузить из Excel" onClose={onClose}>
      <div className="space-y-4">
        <label className={`${btn} w-fit`}><Upload className="w-4 h-4" /> Выбрать файл
          <input type="file" accept=".xlsx" className="hidden" onChange={e => pick(e.target.files?.[0])} /></label>
        {rows && (
          <div className="space-y-2">
            {rows[0].map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`${label} !mb-0 w-1/2 truncate`} title={h}>{h || `Столбец ${i + 1}`}</span>
                <select className={input} value={map[i] || ""} onChange={e => setMap(m => { const n = { ...m }; if (e.target.value) n[i] = e.target.value; else delete n[i]; return n; })}>
                  <option value="">Пропустить</option>
                  {cols.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            ))}
            <div className="text-sm text-[var(--text-muted)]">Записей: {data.length}</div>
          </div>
        )}
        {error && <div role="alert" className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button variant="primary" loading={busy} disabled={!data.length} onClick={run}>Загрузить</Button>
        </div>
      </div>
    </Modal>
  );
}
