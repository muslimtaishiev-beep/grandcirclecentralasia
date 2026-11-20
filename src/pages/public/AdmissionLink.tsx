import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import FormFiller from "../../components/admissions/FormFiller";
import PublicBrand from "../../components/public/PublicBrand";
import LegalLinks from "../../components/public/LegalLinks";
import { privacyHref } from "../../shared/legalDocs";
import { gradeOf, missingFor, type QAnswers, type QTemplate } from "../../shared/questionnaires";

/**
 * Любой QR поступающего: /a/<токен>.
 *
 * Кто сканирует, решает сервер по входу: сотрудник этой школы с правами —
 * сразу в карточку на свою вкладку; родитель — его анкета; ученик по
 * направлению — его тест; код с листа для сотрудников — предложение войти.
 * Вход на телефоне запоминается — войти достаточно один раз.
 */
type Info =
  | { mode: "staff"; url: string; who: string }
  | { mode: "staff_only"; org: Org; signedIn: boolean }
  | { mode: "student"; org: Org; signedIn: boolean; child: { name: string; grade: string }; exam: { code: string; title: string } | null; referred?: boolean;
      paper?: boolean; tested?: boolean; results?: { examTitle: string; subjects: { title: string; percent: number; level: string }[] } | null }
  | { mode: "parent"; org: Org; signedIn: boolean; locked: boolean; template: QTemplate; answers: QAnswers; done: boolean; grade: string };
type Org = { id: string; name: string; logoUrl: string | null };

export default function AdmissionLink() {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [who, setWho] = useState<string | null>(null);

  useEffect(() => {
    // Ждём, пока Firebase поднимет сохранённый вход: иначе сотрудник на миг
    // выглядел бы родителем.
    const off = onAuthStateChanged(auth, async user => {
      setWho(user?.email || null);
      try {
        const t = user ? await user.getIdToken() : "";
        const s = params.get("s");
        const r = await fetch(`/api/admissions/link/${encodeURIComponent(token)}${s ? `?s=${encodeURIComponent(s)}` : ""}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.success) { setError(j.error || "Ссылка не работает"); return; }
        if (j.mode === "staff") { navigate(j.url, { replace: true }); return; }
        setInfo(j);
      } catch { setError("Нет связи с сервером. Проверьте интернет и обновите страницу."); }
    });
    return off;
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = `/a/${token}${params.get("s") ? `?s=${params.get("s")}` : ""}`;
  const staffBar = (
    <div className="text-center text-xs text-slate-500 mt-4">
      {who ? <>Вы вошли как {who} · <button className="underline" onClick={() => signOut(auth)}>выйти</button></> : <Link className="underline" to={`/login?next=${encodeURIComponent(next)}`}>Я сотрудник — войти</Link>}
    </div>
  );

  if (error) return <Shell><div className="bg-white rounded-2xl border border-slate-200 p-8 text-center"><div className="text-4xl mb-2">⚠️</div><p className="text-slate-700">{error}</p></div>{staffBar}</Shell>;
  if (!info) return <div className="min-h-dvh grid place-items-center text-slate-400 text-sm">Открываем…</div>;
  if (info.mode === "staff") return null;

  if (info.mode === "staff_only") return (
    <Shell org={info.org}>
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
        <div className="text-4xl">🔒</div>
        <h1 className="text-lg font-bold text-slate-900">Этот код — для сотрудников</h1>
        <p className="text-sm text-slate-500">{info.signedIn ? "У вашего аккаунта нет доступа к поступающим этой организации." : "Войдите, чтобы открыть карточку поступающего."}</p>
        {!info.signedIn && <Link to={`/login?next=${encodeURIComponent(next)}`} className="inline-block w-full py-3 rounded-xl bg-blue-600 text-white font-semibold">Войти</Link>}
      </div>
      {info.signedIn && staffBar}
    </Shell>
  );

  if (info.mode === "student") return (
    <Shell org={info.org}>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 text-center">
        <div className="text-sm text-slate-500">{info.tested ? "Результаты теста" : "Направление на тест"}</div>
        <h1 className="text-2xl font-bold text-slate-900">{info.child.name}</h1>
        <div className="text-slate-600">Поступает в {info.child.grade} класс</div>
        {info.results ? (
          <div className="text-left space-y-2">
            <div className="text-xs text-slate-500 text-center">{info.results.examTitle}</div>
            {info.results.subjects.map(x => (
              <div key={x.title} className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-baseline justify-between gap-2"><span className="font-medium text-slate-800">{x.title}</span><b className="text-lg tabular-nums text-slate-900">{String(x.percent).replace(".", ",")}%</b></div>
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-200 overflow-hidden"><i className="block h-full bg-blue-600 rounded-full" style={{ width: `${Math.max(0, Math.min(100, x.percent))}%` }} /></div>
                <div className="text-xs text-slate-500 mt-1">Уровень: {x.level}</div>
              </div>
            ))}
          </div>
        ) : info.tested ? (
          <p className="text-sm text-slate-600">Тест сдан. Результаты появятся здесь после встречи с администрацией школы.</p>
        ) : info.paper ? (
          <p className="text-sm text-slate-600">Тест для {info.child.grade} класса пишут на бумаге в школе. После теста результаты можно будет посмотреть по этому коду.</p>
        ) : info.exam ? (
          <>
            <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Тест</div><div className="font-semibold">{info.exam.title}</div></div>
            <button className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold" onClick={() => navigate(`/exam/${info.exam!.code}?ref=${encodeURIComponent(token)}`)}>Перейти к тесту</button>
            <p className="text-xs text-slate-500">PIN для начала назовёт организатор в аудитории.</p>
          </>
        ) : info.referred
          ? <p className="text-sm text-slate-600">Тест для {info.child.grade} класса ещё не открыт. Отсканируйте этот код в день теста — он откроет ваш тест.</p>
          : <p className="text-sm text-slate-600">Направление на тест пока не выдано. Обратитесь в приёмную.</p>}
      </div>
      {staffBar}
    </Shell>
  );

  return <ParentForm info={info} token={token} staffBar={staffBar} />;
}

function ParentForm({ info, token, staffBar }: { info: Extract<Info, { mode: "parent" }>; token: string; staffBar: React.ReactNode }) {
  // Черновик: сразу в браузере, после согласия — и на сервере (доделать можно с другого устройства).
  const key = `sf_parent_draft_${token}`;
  const [answers, setAnswers] = useState<QAnswers>(() => {
    try { const v = localStorage.getItem(key); if (v) return { ...info.answers, ...JSON.parse(v) }; } catch { /* нет хранилища */ }
    return info.answers;
  });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);
  const g = gradeOf(info.grade);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (info.locked || done) return;
    try { localStorage.setItem(key, JSON.stringify(answers)); } catch { /* нет хранилища */ }
    if (!consent) return;
    const t = setTimeout(() => {
      fetch(`/api/admissions/link/${encodeURIComponent(token)}/parent/draft`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, consent }) })
        .then(r => r.json()).then(j => { if (j?.success) setSaved(j.savedAt); }).catch(() => { /* сохранится при следующей правке */ });
    }, 1500);
    return () => clearTimeout(t);
  }, [answers, consent]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async () => {
    const miss = missingFor(info.template, answers, g, null);
    if (miss.length) { setError(`Заполните: ${miss.slice(0, 4).join(", ")}`); return; }
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/admissions/link/${encodeURIComponent(token)}/parent`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, consent }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) { setError(j.error || "Не получилось отправить"); return; }
      try { localStorage.removeItem(key); } catch { /* нет хранилища */ }
      setDone(true); window.scrollTo({ top: 0 });
    } catch { setError("Нет связи — попробуйте ещё раз"); } finally { setBusy(false); }
  };
  if (done) return (
    <Shell org={info.org}><div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2"><div className="text-5xl">✅</div><h1 className="text-xl font-bold">Спасибо! Анкета отправлена</h1><p className="text-sm text-slate-500">Изменить ответы можно через приёмную.</p></div></Shell>
  );
  return (
    <Shell org={info.org} wide>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{info.template.title}</h1>
          {info.template.description && <p className="text-sm text-slate-600 mt-1">{info.template.description}</p>}
          {info.locked && <p className="text-sm text-emerald-700 mt-2">Анкета отправлена. Изменить ответы можно через приёмную.</p>}
        </div>
        {!info.locked && <FormFiller template={info.template} grade={g} answers={answers} onChange={setAnswers} />}
        {!info.locked && (
          <>
            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50/50">
              <input type="checkbox" className="mt-1 w-5 h-5 shrink-0" checked={consent} onChange={e => setConsent(e.target.checked)} />
              <span className="text-sm text-slate-700 leading-relaxed">{info.template.consentText || "Я даю согласие на обработку указанных данных."} <a href={privacyHref(info.org.id)} target="_blank" rel="noreferrer" className="text-blue-600 underline">Политика конфиденциальности</a></span>
            </label>
            {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</div>}
            <button className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-40" disabled={busy || !consent} onClick={submit}>{busy ? "Отправляем…" : "Отправить анкету"}</button>
            {saved && <p className="text-xs text-slate-400 text-center">Черновик сохранён {new Date(saved).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</p>}
          </>
        )}
      </div>
      {staffBar}
    </Shell>
  );
}

function Shell({ org, children, wide }: { org?: Org; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-dvh bg-slate-50 flex items-start justify-center p-4 py-8">
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"}`}>
        {org && <PublicBrand name={org.name} logoUrl={org.logoUrl} />}
        {children}
        <LegalLinks />
      </div>
    </div>
  );
}
