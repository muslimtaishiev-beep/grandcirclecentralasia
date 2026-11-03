import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { compressImageToDataUrl } from "../../lib/compressImage";

/**
 * Подпись в журнале по QR — открывается на телефоне подписывающего.
 *
 * Без входа: ссылка одноразовая и ведёт к одной ячейке одной записи.
 * Вместе с ответами отправляем сведения об устройстве — сервер сохраняет
 * их рядом с подписью, чтобы потом было видно, когда и с чего подписали.
 */
type Sub = { id: string; type: "checkbox" | "text" | "photo"; label: string; required: boolean };
type Info = {
  org: { name: string; logoUrl: string | null; markUrl: string | null };
  journal: { title: string };
  column: { label: string; subfields: Sub[] };
  summary: { label: string; value: string }[];
  closed: string | null;
  expiresAt: number;
};

export default function JournalSign() {
  const { token = "" } = useParams();
  const [info, setInfo] = useState<Info | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/journals/sign/${encodeURIComponent(token)}`);
      const j = await r.json();
      if (!j.success) setError(j.error || "Ссылка недействительна"); else setInfo(j);
    } catch { setError("Нет связи с сервером. Проверьте интернет и обновите страницу."); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const client = {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
        screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
        platform: (navigator as any).userAgentData?.platform || navigator.platform || "",
        language: navigator.language || "",
        touch: "ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0,
      };
      const r = await fetch(`/api/journals/sign/${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, client }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.success) setError(j.error || "Не удалось подписать"); else setDone(j.signedAt);
    } catch { setError("Нет связи с сервером. Попробуйте ещё раз."); }
    finally { setBusy(false); }
  };

  const photo = async (id: string, f?: File) => {
    if (!f) return;
    const r = await compressImageToDataUrl(f, { maxSide: 1024, maxBytes: 240 * 1024 });
    if ("error" in r) setError(r.error); else setAnswers(a => ({ ...a, [id]: r.dataUrl }));
  };

  const ready = info && info.column.subfields.every(s =>
    !s.required || (s.type === "checkbox" ? answers[s.id] === true : !!String(answers[s.id] || "").trim()));

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center p-4 py-10">
      <div className="w-full max-w-md">
        {loading ? (
          <div className="text-center text-slate-400 py-16">Загружаем…</div>
        ) : done ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
            <div className="text-5xl">✅</div>
            <h1 className="text-xl font-bold text-slate-900">Подписано</h1>
            <p className="text-sm text-slate-500">{new Date(done).toLocaleString("ru-RU")}. Можно закрыть страницу.</p>
          </div>
        ) : !info ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <h1 className="text-lg font-bold text-slate-900 mb-1">Ссылка не работает</h1>
            <p className="text-sm text-slate-500">{error}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {info.org.logoUrl && <img src={info.org.logoUrl} alt="" className="h-10 w-auto max-w-[180px] object-contain" />}
                <span>{info.org.name}</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900">{info.column.label}</h1>
              <p className="text-sm text-slate-500">{info.journal.title}</p>
            </div>
            {info.summary.length > 0 && (
              <dl className="px-6 py-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm bg-slate-50 border-b border-slate-100">
                {info.summary.map(s => (
                  <React.Fragment key={s.label}><dt className="text-slate-500">{s.label}</dt><dd className="font-medium text-slate-900">{s.value}</dd></React.Fragment>
                ))}
              </dl>
            )}
            {info.closed ? (
              <div className="p-6 text-center text-slate-600">{info.closed}</div>
            ) : (
              <div className="p-6 space-y-4">
                {info.column.subfields.map(s => (
                  <div key={s.id}>
                    {s.type === "checkbox" ? (
                      <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                        <input type="checkbox" className="mt-0.5 w-5 h-5" checked={answers[s.id] === true} onChange={e => setAnswers(a => ({ ...a, [s.id]: e.target.checked }))} />
                        <span className="text-slate-800">{s.label}{s.required && <span className="text-rose-500"> *</span>}</span>
                      </label>
                    ) : s.type === "text" ? (
                      <>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">{s.label}{s.required && <span className="text-rose-500"> *</span>}</label>
                        <input className="w-full border border-slate-300 rounded-xl p-3 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none" value={answers[s.id] || ""} onChange={e => setAnswers(a => ({ ...a, [s.id]: e.target.value }))} />
                      </>
                    ) : (
                      <>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">{s.label}{s.required && <span className="text-rose-500"> *</span>}</label>
                        {answers[s.id] && <img src={answers[s.id]} alt="" className="h-32 rounded-xl mb-2 object-cover" />}
                        <label className="inline-block px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 cursor-pointer">
                          {answers[s.id] ? "Переснять" : "Сделать фото"}
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => photo(s.id, e.target.files?.[0])} />
                        </label>
                      </>
                    )}
                  </div>
                ))}
                {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</div>}
                <button onClick={submit} disabled={!ready || busy}
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-40 transition">
                  {busy ? "Отправляем…" : "Подписать"}
                </button>
                <p className="text-[11px] text-slate-400 text-center">Вместе с подписью сохраняются время и сведения об устройстве.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
