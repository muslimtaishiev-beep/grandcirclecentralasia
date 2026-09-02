import { useState } from "react";
import { useParams } from "react-router-dom";
import { openCertificate, certificateHTML } from "../lib/placementCertificate";
import { useResolvedTenantId } from "../lib/resolveTenant";

/**
 * Портал проверки результатов среза для учеников.
 *
 * Requires the work number AND the surname. The number alone is six digits —
 * brute-forceable in minutes — and these are minors' exam results, so the
 * surname is the second factor. A wrong number and a wrong surname return the
 * same message on purpose: a different one would confirm which numbers exist.
 *
 * Nothing is shown until the завуч publishes the stream. Until then the portal
 * says so plainly rather than showing a half-checked score.
 */

type Result = {
  studentName: string; shortId: string; grade: number;
  correct: number; total: number; percent: number;
  satMath: number | null; decision: string; approved: boolean;
  assignedClass: string | null; photo?: string | null; adjusted: boolean;
  finishedAt?: any;
  sections: { title: string; correct: number; total: number; percent: number; sat: number | null }[];
};

export default function PlacementResultPortal() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const tenantResolve = useResolvedTenantId(orgSlug);
  const tenantId = tenantResolve.tenantId;

  const [shortId, setShortId] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [annulled, setAnnulled] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  // Сертификат, показанный прямо на странице: запасной путь, когда браузер
  // не дал открыть окно (телефоны и Safari блокируют их по умолчанию).
  const [inlineCert, setInlineCert] = useState<string | null>(null);

  const lookup = async () => {
    setError(null); setResult(null); setPending(null); setAnnulled(null);
    const digits = shortId.replace(/\D/g, "");
    if (!digits) return setError("Введите номер работы — он был на экране во время экзамена.");
    if (!lastName.trim()) return setError("Введите имя или фамилию так, как записывались на экзамен.");
    setBusy(true);
    try {
      const res = await fetch("/api/placement/my-result", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, shortId: digits, lastName }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Работа не найдена."); return; }
      if (data.pending) { setPending(data.message); return; }
      if (data.annulled) { setAnnulled(data.message); return; }
      setResult(data);
    } catch (e) {
      setError("Нет связи с сервером. Попробуйте ещё раз.");
    } finally { setBusy(false); }
  };

  if (tenantResolve.loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Загрузка…</div>;
  }
  if (tenantResolve.notFound) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-md">
          <div className="text-4xl mb-3">🏫</div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Организация не найдена</h1>
          <p className="text-slate-500 text-sm">Проверьте адрес — возможно, в ссылке опечатка.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center p-4 py-10">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Результаты вступительного среза</h1>
        <p className="text-slate-500 text-sm mb-6">
          Введите номер работы и своё имя или фамилию — так, как записывались на экзамен.
        </p>

        {!result && !annulled && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Номер работы</label>
            <input value={shortId} onChange={e => setShortId(e.target.value)}
              inputMode="numeric" placeholder="например, 482913" autoComplete="off"
              className="w-full border border-slate-300 rounded-xl p-3 mb-4 bg-slate-50 font-mono tracking-widest text-lg" />

            <label className="block text-sm font-medium text-slate-700 mb-1">Имя или фамилия</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)}
              placeholder="Иванов" autoComplete="name"
              onKeyDown={e => { if (e.key === "Enter") void lookup(); }}
              className="w-full border border-slate-300 rounded-xl p-3 mb-5 bg-slate-50" />

            {error && <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</div>}
            {pending && <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">{pending}</div>}

            <button onClick={lookup} disabled={busy}
              className={`w-full py-4 rounded-xl font-bold text-white text-lg ${
                busy ? "bg-slate-400" : "bg-blue-600 hover:bg-blue-700 shadow-lg"}`}>
              {busy ? "Ищем…" : "Посмотреть результат"}
            </button>
          </div>
        )}

        {annulled && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6 text-center">
            <div className="text-3xl mb-2">⚠</div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Работа аннулирована</h2>
            <p className="text-slate-600 text-sm mb-4">{annulled}</p>
            <button onClick={() => { setAnnulled(null); setShortId(""); setLastName(""); }}
              className="text-sm text-blue-600 font-semibold">Проверить другую работу</button>
          </div>
        )}

        {result && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200">
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Работа № {result.shortId}</div>
              <h2 className="text-xl font-bold text-slate-900">{result.studentName}</h2>
              <p className="text-sm text-slate-500">{result.grade} класс</p>
            </div>

            <div className="px-6 py-6 grid gap-4">
              <div className="flex items-end gap-4 flex-wrap">
                <div>
                  <div className="text-5xl font-bold text-slate-900 tabular-nums leading-none">{result.percent}%</div>
                  <div className="text-sm text-slate-500 mt-1">
                    {result.correct} из {result.total} баллов
                  </div>
                </div>
                {result.satMath !== null && (
                  <div className="ml-auto text-right">
                    <div className="text-3xl font-bold text-blue-700 tabular-nums leading-none">{result.satMath}</div>
                    <div className="text-xs text-slate-500 mt-1">эквивалент SAT<br/>по математике</div>
                  </div>
                )}
              </div>

              {result.sections.length > 0 && (
                <div className="grid gap-2">
                  {result.sections.map(s => (
                    <div key={s.title} className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3">
                      <span className="text-slate-700">{s.title}</span>
                      <span className="flex items-center gap-3">
                        {s.sat !== null && <span className="text-xs text-slate-400">SAT {s.sat}</span>}
                        <span className="font-mono font-bold text-slate-900 tabular-nums">{s.correct} / {s.total}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className={`rounded-xl p-4 border ${
                result.approved ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Класс зачисления</div>
                <div className="text-2xl font-bold text-slate-900">
                  {result.assignedClass || result.decision}
                </div>
                {!result.approved && (
                  <div className="text-xs text-slate-500 mt-1">
                    Предварительно. Окончательное распределение объявит школа.
                  </div>
                )}
              </div>

              {result.adjusted && (
                <p className="text-xs text-slate-500">
                  Балл уточнён комиссией после проверки письменной работы.
                </p>
              )}

              <button onClick={() => {
                  if (!openCertificate(result as any)) {
                    // Окно не открылось — показываем сертификат здесь же,
                    // вместо того чтобы просить ученика лезть в настройки.
                    setInlineCert(certificateHTML(result as any, "/stamp.png", { toolbar: false }));
                  }
                }}
                className="w-full py-3.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow">
                🎓 Открыть сертификат
              </button>

              <button onClick={() => { setResult(null); setShortId(""); setLastName(""); }}
                className="text-sm text-blue-600 font-semibold text-center">
                Проверить другую работу
              </button>
            </div>
          </div>
        )}

        {inlineCert && (
          <div className="fixed inset-0 z-50 bg-slate-900/70 flex flex-col p-2 sm:p-4">
            <div className="flex gap-2 justify-end mb-2">
              <button onClick={() => {
                  const f = document.getElementById("cert-frame") as HTMLIFrameElement | null;
                  f?.contentWindow?.print();
                }}
                className="px-4 py-2 rounded-lg bg-white text-slate-800 font-semibold text-sm shadow">
                Печать / PDF
              </button>
              <button onClick={() => setInlineCert(null)}
                className="px-4 py-2 rounded-lg bg-white text-slate-800 font-semibold text-sm shadow">
                Закрыть
              </button>
            </div>
            <iframe id="cert-frame" title="Сертификат" srcDoc={inlineCert}
              className="flex-1 w-full bg-white rounded-lg" />
          </div>
        )}

        <p className="text-xs text-slate-400 mt-5 text-center">
          Не помните номер работы? Обратитесь к завучу — он найдёт вас по фамилии.
        </p>
      </div>
    </div>
  );
}
