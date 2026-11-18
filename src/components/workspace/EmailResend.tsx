import React, { useState } from "react";
import { CheckCircle2, Loader2, Send, XCircle } from "lucide-react";
import { emailApi } from "../../lib/emailTemplatesApi";
import type { EmailCtx, EmailEvent } from "../../shared/emailTemplate";

/** Статус письма события и «Переотправить» рядом. status — из документа события (заявка, работа, карточка). */
export interface EmailState { status?: "sent" | "failed" | "pending"; reason?: string; at?: number; to?: string }

export default function EmailResend({ tenantId, event, ctx, state, compact, onDone }: {
  tenantId: string; event: EmailEvent; ctx: EmailCtx; state?: EmailState | null; compact?: boolean; onDone?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; text: string } | null>(null);
  const go = async () => {
    setBusy(true); setRes(null);
    try { const j = await emailApi(tenantId, "/resend", { method: "POST", body: JSON.stringify({ event, ctx }) }); setRes({ ok: true, text: `Ушло${j.results?.[0]?.to ? `: ${j.results[0].to}` : ""}` }); onDone?.(); }
    catch (e: any) { setRes({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };
  const st = res ? (res.ok ? "sent" : "failed") : state?.status;
  const text = res?.text || (state?.status === "sent" ? `Ушло${state.to ? `: ${state.to}` : ""}` : state?.status === "failed" ? `Не ушло: ${state.reason || "ошибка"}` : "");
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
      {st === "sent" && <span className="inline-flex items-center gap-1 text-emerald-600" title={text}><CheckCircle2 className="w-3.5 h-3.5" />{!compact && text}</span>}
      {st === "failed" && <span className="inline-flex items-center gap-1 text-rose-600" title={text}><XCircle className="w-3.5 h-3.5" />{(!compact || res) && text}</span>}
      <button type="button" onClick={go} disabled={busy} title={compact ? text || "Отправить письмо ещё раз" : undefined}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50 whitespace-nowrap">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} {state?.status || res ? "Переотправить" : "Отправить письмо"}
      </button>
    </span>
  );
}
