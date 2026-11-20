import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Plus, X } from "lucide-react";
import { Button, PageHeader, Spinner, card, confirmDialog, input, toast } from "../../../components/ui";
import { apiCall, errText, fmtDate, post, put, useAdminCtx } from "./api";

interface KeyInfo { hasKey: boolean; prefix: string | null; issuedAt: number | null; allowedOrigins: string[] }

export default function IntegrationsPage() {
  const { tenantId } = useAdminCtx();
  const [info, setInfo] = useState<KeyInfo | null>(null);
  const [fresh, setFresh] = useState("");
  const [busy, setBusy] = useState(false);
  const [origins, setOrigins] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try { const j = await apiCall<KeyInfo>(`/api/tenants/${tenantId}/api-key`); setInfo(j); setOrigins(j.allowedOrigins); }
    catch (e) { toast.error(errText(e)); }
  }, [tenantId]);
  useEffect(() => { void load(); }, [load]);

  const issue = async () => {
    if (info?.hasKey && !(await confirmDialog({ title: "Перевыпустить ключ", message: "Старый ключ перестанет работать.", confirmLabel: "Перевыпустить", danger: true }))) return;
    setBusy(true);
    try { const j = await post<{ apiKey: string }>(`/api/tenants/${tenantId}/api-key`); setFresh(j.apiKey); await load(); }
    catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(fresh); toast.success("Скопировано"); } catch { toast.error("Не удалось скопировать"); }
  };
  const addOrigin = () => {
    const v = draft.trim();
    if (v && !origins.includes(v)) setOrigins([...origins, v]);
    setDraft("");
  };
  const saveOrigins = async () => {
    setSaving(true);
    try {
      const j = await put<{ allowedOrigins: string[] }>(`/api/tenants/${tenantId}/api-key/origins`, { origins });
      setOrigins(j.allowedOrigins); toast.success("Сохранено"); await load();
    } catch (e) { toast.error(errText(e)); } finally { setSaving(false); }
  };

  if (!info) return <Spinner />;
  const dirty = JSON.stringify(origins) !== JSON.stringify(info.allowedOrigins);
  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="Интеграции" />
      <section className={`${card} mb-4 p-4`}>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]"><KeyRound className="h-4 w-4" /> Ключ API</div>
        {fresh && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2">
            <code className="min-w-0 flex-1 break-all text-xs text-[var(--text-main)]">{fresh}</code>
            <Button size="sm" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => void copy()}>Копировать</Button>
            <Button size="sm" variant="ghost" aria-label="Скрыть" onClick={() => setFresh("")}><X className="h-4 w-4" /></Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1 text-sm text-[var(--text-muted)]">
            {info.hasKey ? <>{info.prefix || "••••"}{info.issuedAt ? ` · выпущен ${fmtDate(info.issuedAt)}` : ""}</> : "Ключа нет"}
          </div>
          <Button variant={info.hasKey ? "secondary" : "primary"} loading={busy} onClick={() => void issue()}>{info.hasKey ? "Перевыпустить" : "Выпустить"}</Button>
        </div>
      </section>
      <section className={`${card} p-4`}>
        <div className="mb-3 text-sm font-semibold text-[var(--text-main)]">Разрешённые сайты</div>
        <ul className="mb-3 space-y-1.5">
          {origins.map(o => (
            <li key={o} className="flex items-center gap-2 text-sm text-[var(--text-main)]">
              <span className="min-w-0 flex-1 truncate">{o}</span>
              <button type="button" aria-label="Убрать" onClick={() => setOrigins(origins.filter(x => x !== o))} className="text-[var(--text-muted)] hover:text-rose-500 cursor-pointer"><X className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && addOrigin()} placeholder="https://example.kg" aria-label="Адрес сайта" className={input} />
          <Button icon={<Plus className="h-4 w-4" />} onClick={addOrigin} disabled={!draft.trim()}>Добавить</Button>
          <Button variant="primary" disabled={!dirty} loading={saving} onClick={() => void saveOrigins()}>Сохранить</Button>
        </div>
      </section>
    </div>
  );
}
