import React, { useCallback, useEffect, useState } from "react";
import { Loader2, LogOut, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { btn, btnPrimary, card, input, label } from "../journals/components/ui";
import { TelegramIcon } from "../../../components/workspace/TelegramIcon";
import { useParams } from "react-router-dom";
import NotifySettings from "./NotifySettings";
export { TelegramIcon };

/**
 * Профиль сотрудника: имя и телефон, Telegram (уведомления и подтверждения
 * входа), безопасность — оповещения о входе, последние входы, выйти везде.
 */
interface Profile {
  profile: { email: string; displayName: string; phone: string; avatarUrl: string | null; loginAlerts: boolean; provider: string };
  telegram: { configured: boolean; bot: string; linked: boolean; username: string };
  logins: { at: number; device: string; ip: string; status: string; current: boolean }[];
}

const api = async (path: string, init: RequestInit = {}) => {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(`/api${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw new Error(j.error || `Ошибка ${r.status}`);
  return j;
};
const when = (ms: number) => new Date(ms).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export default function ProfilePage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [d, setD] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { const j: Profile = await api("/profile"); setD(j); setName(j.profile.displayName); setPhone(j.profile.phone); setError(null); }
    catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  // Вернулся из Telegram после «Старт» — обновить статус.
  useEffect(() => { const on = () => { if (document.visibilityState === "visible") void load(); }; document.addEventListener("visibilitychange", on); return () => document.removeEventListener("visibilitychange", on); }, [load]);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key); setError(null);
    try { await fn(); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };
  const connect = async () => {
    // Окно открываем сразу — иначе браузер сочтёт его всплывающим.
    const w = window.open("", "_blank");
    setBusy("tg");
    try { const j = await api("/telegram/link", { method: "POST" }); if (w) w.location.href = j.url; else window.location.href = j.url; }
    catch (e: any) { w?.close(); setError(e.message); } finally { setBusy(null); }
  };

  if (!d) return <div className="py-16 flex justify-center">{error ? <span className="text-sm text-rose-600">{error}</span> : <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />}</div>;
  const p = d.profile;
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-[var(--accent)] text-white grid place-items-center text-2xl font-bold overflow-hidden shrink-0">
          {p.avatarUrl ? <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" /> : (p.displayName || p.email || "?")[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-[var(--text-main)] truncate">{p.displayName || p.email}</h1>
          <div className="text-sm text-[var(--text-muted)] truncate">{p.email}</div>
        </div>
      </div>
      {error && <div className="text-sm text-rose-600">{error}</div>}

      <section className={`${card} p-4 space-y-3`}>
        <h2 className="font-bold text-[var(--text-main)]">Данные</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><span className={label}>Имя и фамилия</span><input className={input} value={name} onChange={e => setName(e.target.value)} /></div>
          <div><span className={label}>Телефон</span><input className={input} inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+996 …" /></div>
        </div>
        {(name !== p.displayName || phone !== p.phone) && (
          <button className={btnPrimary} disabled={busy === "save"} onClick={() => run("save", () => api("/profile", { method: "PUT", body: JSON.stringify({ displayName: name, phone }) }))}>
            {busy === "save" && <Loader2 className="w-4 h-4 animate-spin" />} Сохранить
          </button>
        )}
      </section>

      {d.telegram.configured && (
        <section className={`${card} p-4 space-y-3`}>
          <h2 className="font-bold text-[var(--text-main)] flex items-center gap-2"><TelegramIcon /> Telegram</h2>
          {d.telegram.linked ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-[var(--text-main)]">Подключён{d.telegram.username ? ` · @${d.telegram.username}` : ""}</span>
              <button className={`${btn} ml-auto`} disabled={busy === "tgoff"} onClick={() => run("tgoff", () => api("/telegram/link", { method: "DELETE" }))}>Отключить</button>
            </div>
          ) : (
            <button onClick={connect} disabled={busy === "tg"}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#229ED9] hover:bg-[#1c8cc2] text-white font-semibold text-sm disabled:opacity-60">
              {busy === "tg" ? <Loader2 className="w-4 h-4 animate-spin" /> : <TelegramIcon className="w-5 h-5" />} Подключить Telegram
            </button>
          )}
          <p className="text-xs text-[var(--text-muted)]">Уведомления сайта и оповещения о входе в аккаунт.</p>
        </section>
      )}

      {orgId && <NotifySettings tenantId={orgId} />}

      <section className={`${card} p-4 space-y-3`}>
        <h2 className="font-bold text-[var(--text-main)] flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /> Безопасность</h2>
        <label className="flex items-center gap-2 text-sm text-[var(--text-main)]">
          <input type="checkbox" checked={p.loginAlerts} disabled={busy === "alerts"}
            onChange={e => run("alerts", () => api("/profile", { method: "PUT", body: JSON.stringify({ loginAlerts: e.target.checked }) }))} />
          Сообщать о входе в аккаунт (Telegram, без него — письмо о новом устройстве)
        </label>
        <div>
          <span className={label}>Последние входы</span>
          <ul className="divide-y divide-[var(--border-color)] text-sm">
            {d.logins.map((x, i) => (
              <li key={i} className="py-2 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <MonitorSmartphone className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                <span className="text-[var(--text-main)]">{x.device}</span>
                <span className="text-xs text-[var(--text-muted)]">IP {x.ip || "—"} · {when(x.at)}</span>
                {x.current && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700">этот вход</span>}
                {x.status === "denied" && <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600">отклонён</span>}
              </li>
            ))}
            {!d.logins.length && <li className="py-2 text-[var(--text-muted)]">Пока нет записей</li>}
          </ul>
        </div>
        <button className={`${btn} text-rose-600`} disabled={busy === "out"} onClick={() => confirm("Выйти на всех устройствах, включая это? Везде нужно будет войти заново.") && run("out", async () => { await api("/profile/signout-all", { method: "POST" }); await signOut(auth); })}>
          <LogOut className="w-4 h-4" /> Выйти на всех устройствах
        </button>
      </section>
    </div>
  );
}
