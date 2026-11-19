import React, { useCallback, useEffect, useState } from "react";
import { Bell, BellRing, Loader2, MonitorSmartphone } from "lucide-react";
import { auth } from "../../../lib/firebase";
import { btn, card } from "../journals/components/ui";
import { TelegramIcon } from "../../../components/workspace/TelegramIcon";

/**
 * Профиль → «Уведомления»: на каждое действие свой переключатель. Один
 * переключатель — и колокольчик на сайте, и Telegram (если подключён).
 */
interface Data {
  sections: { id: string; label: string }[];
  events: { key: string; section: string; label: string; on: boolean }[];
  telegram: boolean;
}

const call = async (tenantId: string, path: string, init: RequestInit = {}) => {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(`/api/notify/${tenantId}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw new Error(j.error || `Ошибка ${r.status}`);
  return j;
};

/** Для колокольчика: включено ли действие (клиентские типы — задачи, чат…). */
export async function loadNotifyPrefs(tenantId: string): Promise<Record<string, boolean>> {
  const j: Data = await call(tenantId, "/prefs");
  return Object.fromEntries(j.events.map(e => [e.key, e.on]));
}

const desktopState = () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission);

export default function NotifySettings({ tenantId }: { tenantId: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [test, setTest] = useState<"idle" | "busy" | "ok">("idle");
  const [desk, setDesk] = useState(desktopState());

  const load = useCallback(async () => { try { setD(await call(tenantId, "/prefs")); setError(null); } catch (e: any) { setError(e.message); } }, [tenantId]);
  useEffect(() => { void load(); }, [load]);

  const toggle = async (key: string, on: boolean) => {
    if (!d) return;
    const next = d.events.map(e => (e.key === key ? { ...e, on } : e));
    setD({ ...d, events: next }); setSaving(key); setError(null);
    try {
      await call(tenantId, "/prefs", { method: "PUT", body: JSON.stringify({ prefs: Object.fromEntries(next.map(e => [e.key, e.on])) }) });
      window.dispatchEvent(new CustomEvent("sf:notify-prefs"));
    } catch (e: any) { setError(e.message); void load(); } finally { setSaving(null); }
  };
  const sendTest = async () => {
    setTest("busy"); setError(null);
    try { await call(tenantId, "/test", { method: "POST" }); setTest("ok"); setTimeout(() => setTest("idle"), 4000); }
    catch (e: any) { setError(e.message); setTest("idle"); }
  };

  return (
    <section className={`${card} p-4 space-y-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-bold text-[var(--text-main)] flex items-center gap-2"><Bell className="w-5 h-5 text-[var(--accent)]" /> Уведомления</h2>
        {d?.telegram && <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#229ED9]/10 text-[#229ED9]"><TelegramIcon className="w-3.5 h-3.5" /> и в Telegram</span>}
        <div className="ml-auto flex flex-wrap gap-1.5">
          {desk === "default" && (
            <button className={btn} onClick={async () => { await Notification.requestPermission().catch(() => {}); setDesk(desktopState()); }}>
              <MonitorSmartphone className="w-4 h-4" /> На рабочий стол
            </button>
          )}
          <button className={btn} disabled={test === "busy"} onClick={sendTest}>
            {test === "busy" ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />} {test === "ok" ? "Отправлено" : "Проверить"}
          </button>
        </div>
      </div>
      {!d ? <div className="py-6 flex justify-center">{error ? <span className="text-sm text-rose-600">{error}</span> : <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />}</div> : (
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
          {d.sections.map(s => (
            <div key={s.id}>
              <div className="text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1">{s.label}</div>
              <ul className="divide-y divide-[var(--border-color)]">
                {d.events.filter(e => e.section === s.id).map(e => (
                  <li key={e.key}>
                    <label className="flex items-center gap-3 py-2 cursor-pointer">
                      <span className="flex-1 min-w-0 text-sm text-[var(--text-main)]">{e.label}</span>
                      {saving === e.key && <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--text-muted)]" />}
                      <Switch on={e.on} onChange={v => void toggle(e.key, v)} label={e.label} />
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {d && error && <div className="text-sm text-rose-600">{error}</div>}
    </section>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={e => { e.preventDefault(); onChange(!on); }}
      className={`relative w-10 h-6 shrink-0 rounded-full transition-colors ${on ? "bg-[var(--accent)]" : "bg-[var(--border-color)]"}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : ""}`} />
    </button>
  );
}
