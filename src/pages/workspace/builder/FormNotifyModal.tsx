import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Loader2, Plus, X } from "lucide-react";
import { auth } from "../../../lib/firebase";
import { Modal, btn, btnPrimary } from "../journals/components/ui";
import { TelegramIcon } from "../../../components/workspace/TelegramIcon";

/** Кто получает новые заявки формы в Telegram: себя — сразу, других — по их согласию. */
interface Data {
  canAssign: boolean;
  me: { uid: string; telegram: boolean };
  watchers: { uid: string; name: string; status: "active" | "pending"; byName: string }[];
  staff: { uid: string; name: string }[];
}

export default function FormNotifyModal({ tenantId, form, onClose }: { tenantId: string; form: { id: string; title: string }; onClose: () => void }) {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const call = useCallback(async (path = "", init: RequestInit = {}) => {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(`/api/form-notify/${tenantId}/${form.id}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === false) throw new Error(j.error || `Ошибка ${r.status}`);
    return j;
  }, [tenantId, form.id]);
  const load = useCallback(async () => { try { setD(await call()); setError(null); } catch (e: any) { setError(e.message); } }, [call]);
  useEffect(() => { void load(); }, [load]);
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key); setError(null);
    try { await fn(); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  const mine = d?.watchers.find(w => w.uid === d.me.uid);
  return (
    <Modal title={`Telegram · ${form.title}`} onClose={onClose}>
      {!d ? <div className="py-10 flex justify-center">{error ? <span className="text-sm text-rose-600">{error}</span> : <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />}</div> : (
        <div className="space-y-4">
          {/* Себе */}
          {!d.me.telegram ? (
            <Link to={`/workspace/${tenantId}/profile`} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#229ED9] hover:bg-[#1c8cc2] text-white font-semibold text-sm">
              <TelegramIcon /> Подключить Telegram в профиле
            </Link>
          ) : mine?.status === "active" ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-main)]">
              <TelegramIcon /> Заявки приходят вам
              <button className={`${btn} ml-auto`} disabled={!!busy} onClick={() => run("me", () => call(`/${d.me.uid}`, { method: "DELETE" }))}>Отключить</button>
            </div>
          ) : (
            <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#229ED9] hover:bg-[#1c8cc2] text-white font-semibold text-sm disabled:opacity-60" disabled={!!busy}
              onClick={() => run("me", () => call("", { method: "POST", body: JSON.stringify({}) }))}>
              {busy === "me" ? <Loader2 className="w-4 h-4 animate-spin" /> : <TelegramIcon />} Получать заявки в Telegram
            </button>
          )}

          {/* Кто ещё получает */}
          {d.watchers.filter(w => w.uid !== d.me.uid).length > 0 && (
            <ul className="divide-y divide-[var(--border-color)] rounded-xl border border-[var(--border-color)]">
              {d.watchers.filter(w => w.uid !== d.me.uid).map(w => (
                <li key={w.uid} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="text-[var(--text-main)] min-w-0 truncate">{w.name}</span>
                  {w.status === "pending"
                    ? <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700"><Clock className="w-3 h-3" /> ждёт ответа</span>
                    : <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700">получает</span>}
                  {d.canAssign && <button className="ml-auto p-1 rounded-md text-[var(--text-muted)] hover:text-rose-600" aria-label="Отключить" disabled={!!busy} onClick={() => run(w.uid, () => call(`/${w.uid}`, { method: "DELETE" }))}><X className="w-4 h-4" /></button>}
                </li>
              ))}
            </ul>
          )}

          {/* Подключить других — с правом «Уведомления по заявкам» */}
          {d.canAssign && (
            <div className="space-y-1.5">
              <div className="text-[11px] uppercase font-mono font-bold text-[var(--text-muted)]">Сотрудники с Telegram</div>
              {d.staff.filter(s => s.uid !== d.me.uid).length ? d.staff.filter(s => s.uid !== d.me.uid).map(s => (
                <div key={s.uid} className="flex items-center gap-2 text-sm">
                  <span className="text-[var(--text-main)] min-w-0 truncate">{s.name}</span>
                  <button className={`${btnPrimary} ml-auto !py-1 !text-xs`} disabled={!!busy} onClick={() => run(s.uid, () => call("", { method: "POST", body: JSON.stringify({ uid: s.uid }) }))}>
                    {busy === s.uid ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Пригласить
                  </button>
                </div>
              )) : <div className="text-sm text-[var(--text-muted)]">Все сотрудники с Telegram уже подключены</div>}
            </div>
          )}
          {error && <div className="text-sm text-rose-600">{error}</div>}
        </div>
      )}
    </Modal>
  );
}
