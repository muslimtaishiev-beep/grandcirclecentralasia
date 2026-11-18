import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2, RefreshCw, Send, XCircle } from "lucide-react";
import { emailApi } from "../../../lib/emailTemplatesApi";
import { btn, card } from "../journals/components/ui";

/** Журнал отправленных писем: что, кому, ушло ли; переотправка по одному и пачкой. */
interface Row { id: string; event: "referral" | "tested" | "form"; to: string; status: "sent" | "failed" | "pending"; reason: string; at: number; tries: number; subject: string; label: string; canResend: boolean; actionUrl: string }

const EVENT_LABEL: Record<Row["event"], string> = { referral: "Направление", tested: "После теста", form: "Заявка" };
const when = (ms: number) => new Date(ms).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function EmailLog({ tenantId }: { tenantId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"all" | "failed">("all");
  const [event, setEvent] = useState<"all" | Row["event"]>("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try { setRows((await emailApi(tenantId, "/log")).log); setError(null); } catch (e: any) { setError(e.message); setRows([]); }
  }, [tenantId]);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => (rows || []).filter(r => (status === "all" || r.status === "failed") && (event === "all" || r.event === event)), [rows, status, event]);
  const failedCount = (rows || []).filter(r => r.status === "failed").length;

  const resend = async (ids: string[]) => {
    setBusy(ids.length === 1 ? ids[0] : "bulk"); setMsg(null);
    try {
      const j = await emailApi(tenantId, "/resend", { method: "POST", body: JSON.stringify({ logIds: ids }) });
      setMsg({ ok: !j.failed, text: j.failed ? `Отправлено: ${j.sent}, не ушло: ${j.failed}` : `Отправлено: ${j.sent}` });
      setPicked(new Set());
    } catch (e: any) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(null); await load(); }
  };

  if (!rows) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>;
  const pickable = shown.filter(r => r.canResend);
  const chosen = pickable.filter(r => picked.has(r.id));
  const seg = (on: boolean) => `px-3 py-1.5 transition ${on ? "bg-[var(--accent)] text-white font-semibold" : "text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]"}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-[var(--border-color)] overflow-hidden text-sm">
          <button className={seg(status === "all")} onClick={() => setStatus("all")}>Все</button>
          <button className={seg(status === "failed")} onClick={() => setStatus("failed")}>Не ушли{failedCount ? ` · ${failedCount}` : ""}</button>
        </div>
        <div className="flex rounded-lg border border-[var(--border-color)] overflow-hidden text-sm overflow-x-auto max-w-full">
          <button className={`${seg(event === "all")} whitespace-nowrap`} onClick={() => setEvent("all")}>Все письма</button>
          {(Object.keys(EVENT_LABEL) as Row["event"][]).map(k => <button key={k} className={`${seg(event === k)} whitespace-nowrap`} onClick={() => setEvent(k)}>{EVENT_LABEL[k]}</button>)}
        </div>
        <button className={`${btn} ml-auto`} onClick={() => void load()} aria-label="Обновить"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {chosen.length > 0 && (
        <div className="sticky top-2 z-20 bg-[var(--accent)] text-white rounded-xl px-4 py-2 flex flex-wrap items-center gap-2 shadow-lg">
          <span className="text-sm font-bold">Выбрано: {chosen.length}</span>
          <button className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-sm font-semibold inline-flex items-center gap-1.5" disabled={!!busy} onClick={() => resend(chosen.map(r => r.id))}>
            {busy === "bulk" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Переотправить
          </button>
          <button className="ml-auto px-3 py-1.5 rounded-lg text-sm hover:bg-white/15" onClick={() => setPicked(new Set())}>Снять</button>
        </div>
      )}
      {msg && <div className={`text-sm ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</div>}
      {error && <div className="text-sm text-rose-600">{error}</div>}

      {/* Телефон: карточки — статус и «Переотправить» не уезжают за край. */}
      {shown.length > 0 && (
        <div className="md:hidden space-y-2">
          {shown.map(r => (
            <div key={r.id} className={`${card} p-3 space-y-1.5 ${r.status === "failed" ? "!bg-rose-500/5" : ""}`}>
              <div className="flex items-start gap-2">
                {r.canResend && <input type="checkbox" className="mt-1" aria-label="Выбрать" checked={picked.has(r.id)} onChange={() => setPicked(p => { const n = new Set(p); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })} />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-[var(--text-main)]">{r.actionUrl ? <Link to={r.actionUrl} className="hover:text-[var(--accent)]">{r.label || r.subject || "—"}</Link> : (r.label || r.subject || "—")}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">{EVENT_LABEL[r.event] || r.event} · {when(r.at)}{r.tries > 1 ? ` · ${r.tries}×` : ""}</div>
                  <div className="text-xs text-[var(--text-main)] break-all">{r.to || <span className="text-[var(--text-muted)]">нет почты</span>}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {r.status === "sent" ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="w-4 h-4" /> Ушло</span>
                  : r.status === "failed" ? <span className="inline-flex items-start gap-1 text-xs text-rose-600"><XCircle className="w-4 h-4 shrink-0" /> {r.reason || "Не ушло"}</span>
                  : <span className="text-xs text-[var(--text-muted)]">Отправляется…</span>}
                {r.canResend && <button className={`${btn} !py-1 !text-xs ml-auto`} disabled={!!busy} onClick={() => resend([r.id])}>
                  {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Переотправить
                </button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className={`${card} overflow-x-auto ${shown.length ? "hidden md:block" : ""}`}>
        {!shown.length ? <div className="p-10 text-center text-sm text-[var(--text-muted)]">Писем нет</div> : (
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase font-mono text-[var(--text-muted)] border-b border-[var(--border-color)]">
              <tr>
                <th className="pl-4 pr-1 py-2.5 w-8">
                  <input type="checkbox" aria-label="Выбрать все" checked={pickable.length > 0 && pickable.every(r => picked.has(r.id))}
                    onChange={e => setPicked(e.target.checked ? new Set(pickable.map(r => r.id)) : new Set())} />
                </th>
                <th className="px-3 py-2.5 text-left font-medium">Когда</th>
                <th className="px-3 py-2.5 text-left font-medium">Письмо</th>
                <th className="px-3 py-2.5 text-left font-medium">Кому</th>
                <th className="px-3 py-2.5 text-left font-medium">Статус</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {shown.map(r => (
                <tr key={r.id} className={r.status === "failed" ? "bg-rose-500/5" : ""}>
                  <td className="pl-4 pr-1 py-2.5">{r.canResend && <input type="checkbox" aria-label="Выбрать" checked={picked.has(r.id)} onChange={() => setPicked(p => { const n = new Set(p); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })} />}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs text-[var(--text-muted)]">{when(r.at)}{r.tries > 1 ? ` · ${r.tries}×` : ""}</td>
                  <td className="px-3 py-2.5 min-w-[200px]">
                    <div className="text-[var(--text-main)]">{r.actionUrl ? <Link to={r.actionUrl} className="hover:text-[var(--accent)] hover:underline">{r.label || r.subject || "—"}</Link> : (r.label || r.subject || "—")}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">{EVENT_LABEL[r.event] || r.event}{r.subject && r.label ? ` · ${r.subject}` : ""}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[var(--text-main)] break-all">{r.to || <span className="text-[var(--text-muted)]">нет почты</span>}</td>
                  <td className="px-3 py-2.5">
                    {r.status === "sent" ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="w-4 h-4" /> Ушло</span>
                      : r.status === "failed" ? <span className="inline-flex items-start gap-1 text-xs text-rose-600"><XCircle className="w-4 h-4 shrink-0" /> {r.reason || "Не ушло"}</span>
                      : <span className="text-xs text-[var(--text-muted)]">Отправляется…</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {r.canResend && <button className={`${btn} !py-1 !text-xs whitespace-nowrap`} disabled={!!busy} onClick={() => resend([r.id])}>
                      {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Переотправить
                    </button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
