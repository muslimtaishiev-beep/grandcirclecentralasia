import React, { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Copy, CheckCircle2 } from "lucide-react";
import FancyQr from "../../../../components/forms/FancyQr";
import type { Journal, JournalColumn, JournalEntry } from "../../../../shared/journals";
import { Modal, btn } from "./ui";

type Api = (path: string, init?: RequestInit) => Promise<any>;

/**
 * QR для подписи одной записи. Сотрудник держит экран, человек сканирует
 * своим телефоном и подтверждает — окно само видит подпись и закрывается.
 */
export default function SignQrModal({ journal, entry, column, api, onSigned, onClose, logo }: {
  journal: Journal; entry: JournalEntry; column: JournalColumn; api: Api; logo?: string | null;
  onSigned: (e: JournalEntry) => void; onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  const [copied, setCopied] = useState(false);

  const issue = useCallback(async () => {
    setError(null); setUrl("");
    try {
      const j = await api(`/${journal.id}/entries/${entry.id}/sign-token`, { method: "POST", body: JSON.stringify({ columnId: column.id }) });
      setUrl(`${window.location.origin}${j.path}`);
      setExpiresAt(j.expiresAt);
    } catch (e: any) { setError(e.message); }
  }, [api, journal.id, entry.id, column.id]);
  useEffect(() => { void issue(); }, [issue]);

  // Ждём подпись: раз в три секунды, пока окно открыто.
  useEffect(() => {
    if (!url || signed) return;
    const t = setInterval(async () => {
      try {
        const j = await api(`/${journal.id}/entries/${entry.id}`);
        if (j.entry?.values?.[column.id]?.signedAt) {
          setSigned(true);
          onSigned(j.entry);
        }
      } catch { /* сеть моргнула — попробуем на следующем круге */ }
    }, 3000);
    return () => clearInterval(t);
  }, [api, url, signed, journal.id, entry.id, column.id, onSigned]);

  const person = journal.settings.personColumnId ? entry.values?.[journal.settings.personColumnId] : "";

  return (
    <Modal title={column.label} onClose={onClose}>
      <div className="flex flex-col items-center text-center gap-3">
        {person && <div className="text-lg font-bold text-[var(--text-main)]">{String(person)}</div>}
        {signed ? (
          <div className="py-8 flex flex-col items-center gap-2 text-emerald-600">
            <CheckCircle2 className="w-14 h-14" />
            <div className="font-semibold">Подписано</div>
            <button className={btn} onClick={onClose}>Готово</button>
          </div>
        ) : error ? (
          <div className="text-sm text-rose-600 py-6">{error}</div>
        ) : !url ? (
          <div className="py-16"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>
        ) : (
          <>
            <div className="bg-white rounded-2xl p-3"><FancyQr value={url} size={260} logo={logo} /></div>
            <p className="text-sm text-[var(--text-muted)] max-w-xs">Пусть отсканирует камерой телефона и подтвердит. Окно обновится само.</p>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><Loader2 className="w-3 h-3 animate-spin" /> Ждём подпись · ссылка действует до {new Date(expiresAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
            <div className="flex gap-2">
              <button className={btn} onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                <Copy className="w-4 h-4" /> {copied ? "Скопировано" : "Ссылка"}
              </button>
              <button className={btn} onClick={issue} title="Прежний код перестанет работать"><RefreshCw className="w-4 h-4" /> Новый QR</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
