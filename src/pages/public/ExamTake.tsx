import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import QuestionFactory from "../../components/tests/QuestionFactory";
import ProctoringWarningOverlay from "../../components/ProctoringWarningOverlay";
import PublicBrand from "../../components/public/PublicBrand";
import LegalLinks from "../../components/public/LegalLinks";
import { GUARDIAN_NOTE, examConsentText, privacyHref, termsHref } from "../../shared/legalDocs";
import { useProctoringEngine } from "../../lib/useProctoringEngine";
import { certificateHTML, openPrint, reportHTML, type PrintData } from "../../lib/examPrint";

/**
 * Страница ученика: вход по ссылке экзамена и PIN, разделы с таймером,
 * автосохранение ответов, прокторинг, итог и поиск результата.
 *
 * Таймер считается от серверного дедлайна с поправкой на часы телефона;
 * ответы уходят пачкой через секунду после правки и при уходе со страницы.
 * Работа продолжается после перезагрузки — токен лежит в localStorage.
 */
type Info = {
  org: { id?: string; name: string; logoUrl: string | null; markUrl: string | null; consentText?: string };
  exam: {
    title: string; description: string; open: boolean; status: string; opensAt: number | null; closesAt: number | null; needPin: boolean;
    registration: { phone: boolean; email: boolean; level: boolean; levelLabel: string; photo: boolean };
    proctoring: { enabled: boolean; detectors: Record<string, boolean>; tabSwitch: boolean };
    sections: { title: string; minutes: number }[];
    resultsMode: "never" | "after_publish" | "immediately";
  };
};
type State = {
  waitingStart?: boolean;
  shortId: string; status: "in_progress" | "finished" | "annulled"; student: { name: string }; current: number;
  sections: { id: string; title: string; minutes: number; count: number; finished: boolean }[];
  section: { id: string; title: string; deadline: number; questions: any[]; answers: Record<string, string>; blocks?: { title: string; first: string }[] } | null;
  result: any; serverNow: number;
};

const shell = "min-h-dvh bg-slate-50 text-slate-900";
const box = "bg-white rounded-2xl border border-slate-200";
const inp = "w-full border border-slate-300 rounded-xl p-3 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition text-base";
const primary = "w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-40 transition";

export default function ExamTake({ resultMode = false }: { resultMode?: boolean }) {
  const { code = "" } = useParams();
  const C = code.toUpperCase();
  const storeKey = `exam_${C}`;
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [token, setToken] = useState<string>(() => { try { return JSON.parse(localStorage.getItem(`exam_${code.toUpperCase()}`) || "{}").token || ""; } catch { return ""; } });
  const [phase, setPhase] = useState<"loading" | "login" | "photo" | "exam" | "final">("loading");
  const [form, setForm] = useState({ name: "", phone: "", email: "", level: "", pin: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [skew, setSkew] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [banner, setBanner] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "offline">("saved");
  const pending = useRef<Record<string, string>>({});
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishing = useRef(false);

  const post = useCallback(async (path: string, body: object) => {
    const r = await fetch(`/api/exam-public/${C}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === false) throw Object.assign(new Error(j.error || `Ошибка ${r.status}`), { reset: j.reset });
    return j;
  }, [C]);

  const applyState = useCallback((s: State) => {
    setState(s); setSkew(s.serverNow - Date.now());
    if (s.section) setAnswers(a => ({ ...s.section!.answers, ...a, ...pending.current }));
    setPhase(s.status === "in_progress" ? "exam" : "final");
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/exam-public/${C}`); const j = await r.json();
        if (!j.success) { setError(j.error); setPhase("login"); return; }
        setInfo(j);
        if (resultMode) { setPhase("final"); return; }
        if (token) {
          try { const s = await post("/state", { token }); if (s.state.waitingStart) { setState(s.state); setPhase("photo"); } else applyState(s.state); return; }
          catch (e: any) { if (e.reset) { localStorage.removeItem(storeKey); setToken(""); } }
        }
        setPhase("login");
      } catch { setError("Нет связи с сервером. Проверьте интернет и обновите страницу."); setPhase("login"); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);

  // ── Ответы: пачкой, с повтором ──
  /**
   * Отправить накопленные ответы. true — всё сохранено. Отправка в пути
   * дожидается (иначе «Завершить раздел» обгонял бы её, и сервер отбрасывал
   * ответы уже закрытого раздела). Отказ «работа сдана / время вышло» не
   * повторяется — повторять там нечего.
   */
  const inflight = useRef<Promise<boolean> | null>(null);
  const flush = useCallback(async (): Promise<boolean> => {
    if (flushTimer.current) { clearTimeout(flushTimer.current); flushTimer.current = null; }
    if (inflight.current) await inflight.current;
    const batch = pending.current;
    if (!Object.keys(batch).length || !token) return true;
    pending.current = {};
    setSaveState("saving");
    const p = (async () => {
      try { await post("/answer", { token, answers: batch }); setSaveState("saved"); return true; }
      catch (e: any) {
        if (/сдана|вышло/.test(String(e?.message))) { setSaveState("saved"); return false; }
        pending.current = { ...batch, ...pending.current }; setSaveState("offline");
        flushTimer.current = setTimeout(() => void flush(), 4000);
        return false;
      }
    })();
    inflight.current = p;
    try { return await p; } finally { if (inflight.current === p) inflight.current = null; }
  }, [post, token]);
  const setAnswer = (qid: string, v: any) => {
    const val = typeof v === "string" ? v : JSON.stringify(v);
    setAnswers(a => ({ ...a, [qid]: val }));
    pending.current[qid] = val;
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => void flush(), 1200);
  };
  useEffect(() => {
    const h = () => {
      if (!Object.keys(pending.current).length || !token) return;
      navigator.sendBeacon?.(`/api/exam-public/${C}/answer`, new Blob([JSON.stringify({ token, answers: pending.current })], { type: "application/json" }));
    };
    window.addEventListener("pagehide", h);
    return () => window.removeEventListener("pagehide", h);
  }, [C, token]);

  // ── Прокторинг ──
  const proctorOn = !!info?.exam.proctoring.enabled;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const [camOk, setCamOk] = useState(false);
  const [camFail, setCamFail] = useState(false);
  const snaps = useRef<{ type: string; atMs: number; dataUrl: string }[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const reported = useRef(false);
  const wantCam = proctorOn && phase === "exam";
  useEffect(() => {
    if (!wantCam || streamRef.current || camFail) return;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) { setCamFail(true); return; }
        const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: info?.exam.proctoring.detectors.audioAnalysis !== false });
        streamRef.current = s;
        if (videoRef.current) { videoRef.current.srcObject = s; try { await videoRef.current.play(); } catch { /* автоплей */ } }
        startedAtRef.current = Date.now(); setCamOk(true);
      } catch { setCamFail(true); }
    })();
  }, [wantCam, camFail, info]);
  useEffect(() => { if (phase === "final" && streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; setCamOk(false); } }, [phase]);
  // Уход со страницы — камера и микрофон освобождаются.
  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); }, []);
  const proctorActive = wantCam && camOk;
  const proctor = useProctoringEngine(videoRef, canvasRef, proctorActive, undefined, {
    detectors: info?.exam.proctoring.detectors as any,
    suppressEvents: info?.exam.proctoring.tabSwitch ? [] : ["TAB_SWITCH"],
  });
  // Снимок в момент среднего или грубого нарушения — не больше 20, кадр 640px.
  useEffect(() => {
    if (!proctorActive) return;
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;
    for (const ev of proctor.events) {
      if (seen.current.has(ev.id)) continue;
      seen.current.add(ev.id);
      if (ev.severity === "LOW" || snaps.current.length >= 20 || !v.videoWidth) continue;
      try {
        const k = Math.min(1, 640 / v.videoWidth);
        c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
        c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
        snaps.current.push({ type: ev.type, atMs: ev.timestamp, dataUrl: c.toDataURL("image/jpeg", 0.6) });
      } catch { /* кадр не снялся — экзамен важнее */ }
    }
  }, [proctor.events, proctorActive]);
  const sendReport = useCallback(async () => {
    if (!proctorOn || reported.current || !token) return;
    if (!camOk && !camFail) return;
    reported.current = true;
    try {
      await post("/proctoring", {
        token, unavailable: camFail && !camOk, honestyIndex: proctor.honestyIndex, startedAt: startedAtRef.current, endedAt: Date.now(),
        violations: proctor.events.map(e => ({ type: e.type, severity: e.severity, description: e.description, timestamp: e.timestamp })),
        snapshots: snaps.current,
      });
    } catch { /* работа сдана — это важнее протокола */ }
  }, [proctorOn, token, camOk, camFail, proctor, post]);

  // ── Разделы ──
  const finishSection = useCallback(async (auto = false) => {
    if (!state?.section || finishing.current) return;
    if (!auto) {
      const left = state.section.questions.filter(q => !String(answers[q.id] ?? "").trim()).length;
      if (!confirm(left ? `Без ответа: ${left}. Завершить раздел «${state.section.title}»? Вернуться к нему будет нельзя.` : `Завершить раздел «${state.section.title}»? Вернуться к нему будет нельзя.`)) return;
    }
    finishing.current = true; setBusy(true); setError(null);
    try {
      // Ответы не сохранились — раздел не закрываем: иначе они пропадут. По
      // таймеру всё равно закрываем — сервер примет только то, что дошло.
      const saved = await flush();
      if (!saved && !auto) { setError("Нет связи — последние ответы ещё не сохранены. Проверьте интернет и нажмите ещё раз."); return; }
      const j = await post("/finish-section", { token, sectionId: state.section.id });
      const s: State = j.state;
      if (s.status !== "in_progress") await sendReport();
      else setBanner(`${auto ? "Время раздела вышло. " : ""}Начался раздел «${s.section?.title}» — ${s.sections[s.current].minutes} мин`);
      applyState(s); window.scrollTo({ top: 0 });
    } catch (e: any) { setError(e.message); }
    finally { finishing.current = false; setBusy(false); }
  }, [state, answers, flush, post, token, sendReport, applyState]);

  const leftMs = state?.section ? state.section.deadline - (now + skew) : 0;
  // Время вышло — сдаём раздел; если не получилось (сеть), повторяем раз в 5 секунд.
  const timeUp = phase === "exam" && !!state?.section && leftMs <= 0;
  useEffect(() => {
    if (!timeUp) return;
    void finishSection(true);
    const t = setInterval(() => void finishSection(true), 5000);
    return () => clearInterval(t);
  }, [timeUp]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (banner) { const t = setTimeout(() => setBanner(null), 6000); return () => clearTimeout(t); } }, [banner]);

  const start = async () => {
    setBusy(true); setError(null);
    try {
      const j = await post("/start", { ...form, consent });
      localStorage.setItem(storeKey, JSON.stringify({ token: j.token, shortId: j.shortId }));
      setToken(j.token);
      if (j.state.waitingStart) { setState(j.state); setPhase("photo"); }
      else applyState(j.state);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (phase === "loading") return <div className={`${shell} flex items-center justify-center text-slate-400`}>Загружаем…</div>;
  if (!info) return <Center><div className={`${box} p-8 text-center`}><h1 className="text-lg font-bold mb-1">Экзамен недоступен</h1><p className="text-sm text-slate-500">{error}</p></div></Center>;

  if (resultMode || (phase === "final" && !state)) return <ResultLookup info={info} code={C} />;

  if (phase === "final" && state) {
    return (
      <Center>
        <PublicBrand name={info.org.name} logoUrl={info.org.logoUrl} />
        <div className={`${box} p-8 text-center space-y-3`}>
          <div className="text-5xl">{state.status === "annulled" ? "⛔" : "✅"}</div>
          <h1 className="text-xl font-bold">{state.status === "annulled" ? "Работа аннулирована" : "Работа сдана"}</h1>
          <p className="text-sm text-slate-500">Номер работы — сохраните его:</p>
          <div className="text-3xl font-mono font-black tracking-widest">{state.shortId}</div>
          {state.result ? <ResultCard r={state.result} /> : info.exam.resultsMode === "after_publish"
            ? <p className="text-sm text-slate-500">Результат появится после проверки. Узнать его можно по номеру работы и фамилии:</p>
            : info.exam.resultsMode === "never" ? <p className="text-sm text-slate-500">Результаты сообщит организатор.</p> : null}
          {info.exam.resultsMode === "after_publish" && <Link to={`/exam/${C}/result`} className="inline-block text-blue-600 font-semibold">Узнать результат</Link>}
          <button className="block mx-auto text-xs text-slate-400 hover:underline" onClick={() => { localStorage.removeItem(storeKey); window.location.reload(); }}>Это не я — начать заново</button>
        </div>
      </Center>
    );
  }

  if (phase === "photo" && state) {
    return <PhotoStep info={info} onDone={async (photo) => {
      if (photo) await post("/photo", { token, photo }).catch(() => {});
      // Таймер первого раздела запускается только сейчас — после фото.
      try { const j = await post("/begin", { token }); applyState(j.state); } catch (e: any) { setError(e.message); }
    }} />;
  }

  if (phase === "login") {
    const reg = info.exam.registration;
    const notYet = info.exam.opensAt && Date.now() < info.exam.opensAt;
    return (
      <Center>
        <PublicBrand name={info.org.name} logoUrl={info.org.logoUrl} />
        <div className={box}>
          <div className="px-6 pt-6 pb-4 border-b border-slate-100">
            <h1 className="text-2xl font-bold">{info.exam.title}</h1>
            {info.exam.description && <p className="text-slate-500 text-sm mt-1 whitespace-pre-line">{info.exam.description}</p>}
            <div className="flex flex-wrap gap-1.5 mt-3">{info.exam.sections.map((s, i) => <span key={i} className="text-xs bg-slate-100 rounded-full px-2.5 py-1">{s.title} · {s.minutes} мин</span>)}</div>
          </div>
          {!info.exam.open ? (
            <div className="p-6 text-center text-slate-600">{notYet ? `Экзамен откроется ${new Date(info.exam.opensAt!).toLocaleString("ru-RU")}` : "Экзамен сейчас закрыт."}<div className="mt-3"><Link className="text-blue-600 text-sm font-semibold" to={`/exam/${C}/result`}>Узнать результат</Link></div></div>
          ) : (
            <div className="p-6 space-y-3">
              <Field l="Фамилия и имя"><input className={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoComplete="name" /></Field>
              {reg.phone && <Field l="Телефон"><input className={inp} type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+996 …" autoComplete="tel" /></Field>}
              {reg.email && <Field l="Почта"><input className={inp} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} autoComplete="email" /></Field>}
              {reg.level && <Field l={reg.levelLabel}><input className={inp} value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} /></Field>}
              {info.exam.needPin && <Field l="PIN аудитории"><input className={`${inp} text-center text-2xl tracking-[0.4em] font-mono`} inputMode="numeric" value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 8) })} placeholder="••••" /></Field>}
              {info.exam.proctoring.enabled && <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">Во время экзамена ведётся наблюдение через камеру: браузер попросит доступ. Нарушения фиксируются со временем и снимком.</p>}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50/50">
                <input type="checkbox" className="mt-1 w-5 h-5 shrink-0" checked={consent} onChange={e => setConsent(e.target.checked)} />
                <span className="text-sm text-slate-700 leading-relaxed">
                  {examConsentText(info.org.name, info.org.consentText)}{" "}
                  <a href={privacyHref(info.org.id)} target="_blank" rel="noreferrer" className="text-blue-600 underline">Политика конфиденциальности</a> ·{" "}
                  <a href={termsHref(info.org.id)} target="_blank" rel="noreferrer" className="text-blue-600 underline">Соглашение</a>
                  <span className="block text-xs text-slate-500 mt-1.5">{GUARDIAN_NOTE}</span>
                </span>
              </label>
              {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</div>}
              <button className={primary} disabled={busy || !form.name.trim() || !consent} onClick={start}>{busy ? "Начинаем…" : "Начать экзамен"}</button>
              <div className="text-center"><Link className="text-blue-600 text-sm" to={`/exam/${C}/result`}>Узнать результат</Link></div>
            </div>
          )}
        </div>
      </Center>
    );
  }

  // ── Экзамен ──
  const sec = state!.section!;
  const answered = sec.questions.filter(q => String(answers[q.id] ?? "").trim()).length;
  const mm = Math.max(0, Math.floor(leftMs / 60000)), ss = Math.max(0, Math.floor((leftMs % 60000) / 1000));
  const low = leftMs < 5 * 60000;
  return (
    <div className={shell}>
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-slate-500 truncate">{info.exam.title} · раздел {state!.current + 1} из {state!.sections.length}</div>
            <div className="font-bold truncate">{sec.title}</div>
          </div>
          <div className="text-right">
            <div className={`font-mono text-xl font-black tabular-nums ${low ? "text-rose-600" : ""}`}>{mm}:{String(ss).padStart(2, "0")}</div>
            <div className="text-[10px] text-slate-500">{answered}/{sec.questions.length} · {saveState === "saved" ? "сохранено" : saveState === "saving" ? "сохраняем…" : "нет связи, повторим"}</div>
          </div>
        </div>
        <div className="h-1 bg-slate-100"><div className="h-1 bg-blue-600 transition-all" style={{ width: `${(answered / Math.max(1, sec.questions.length)) * 100}%` }} /></div>
      </div>
      {banner && <div className="max-w-3xl mx-auto px-4 pt-3"><div className="rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-2.5">{banner}</div></div>}
      {proctorOn && (
        <div className="fixed bottom-3 right-3 z-30 w-28 rounded-xl overflow-hidden border-2 border-white shadow-lg bg-black">
          <video ref={videoRef} muted playsInline className="w-full h-20 object-cover -scale-x-100" />
          <canvas ref={canvasRef} className="hidden" />
          {camFail && <div className="text-[10px] text-amber-200 p-1 text-center">Камера недоступна — работа будет без наблюдения</div>}
        </div>
      )}
      <ProctoringWarningOverlay events={proctor.events} isActive={proctorActive} />
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4 pb-28">
        {sec.questions.map((q, i) => (
          <div key={q.id} id={`q-${q.id}`} className="scroll-mt-24">
            {sec.blocks?.find(b => b.first === q.id) && <h2 className="text-xl font-bold text-blue-700 mt-4 mb-3">{sec.blocks.find(b => b.first === q.id)!.title}</h2>}
            <div className="text-xs font-semibold text-slate-400 mb-1.5">Вопрос {i + 1} из {sec.questions.length}{q.points !== 1 ? ` · ${q.points} балла` : ""}</div>
            <QuestionFactory question={q} value={answers[q.id] ?? ""} onChange={v => setAnswer(q.id, v)} />
          </div>
        ))}
        {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</div>}
        <button className={primary} disabled={busy} onClick={() => finishSection(false)}>
          {state!.current + 1 < state!.sections.length ? `Завершить раздел и перейти к «${state!.sections[state!.current + 1].title}»` : "Сдать работу"}
        </button>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className={`${shell} flex items-start justify-center p-4 py-10`}><div className="w-full max-w-xl">{children}<LegalLinks /></div></div>;
}
function Field({ l, children }: { l: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-sm font-medium text-slate-700 mb-1.5">{l}</span>{children}</label>;
}

const num = (n: number) => Number(n).toLocaleString("ru-RU", { maximumFractionDigits: 1 });

function ResultCard({ r }: { r: any }) {
  return (
    <div className="text-left space-y-3 pt-2">
      <div className="flex flex-wrap gap-2 justify-center">
        <Pill t="Результат" v={`${num(r.percent)}%`} />
        <Pill t="Баллы" v={`${num(r.earned)} / ${num(r.max)}`} />
        {r.mark != null && <Pill t="Отметка" v={String(r.mark)} />}
        {r.band != null && <Pill t="Балл 1–5" v={Number(r.band).toFixed(1).replace(".", ",")} />}
        {r.scaleLabel && <Pill t="Уровень" v={r.scaleLabel} />}
        {r.group && <Pill t="Группа" v={r.group} />}
        {r.decision && <Pill t="Решение" v={r.decision} />}
      </div>
      <div className="space-y-1.5">
        {r.sections.map((s: any) => (
          <div key={s.id}><div className="flex justify-between text-sm"><span>{s.title}</span><b>{num(s.percent)}%</b></div><div className="h-1.5 bg-slate-100 rounded-full"><div className="h-1.5 bg-blue-600 rounded-full" style={{ width: `${s.percent}%` }} /></div></div>
        ))}
      </div>
    </div>
  );
}
const Pill = ({ t, v }: { t: string; v: string }) => <div className="rounded-xl border border-slate-200 px-3 py-2 text-center"><div className="text-[10px] uppercase font-bold text-slate-500">{t}</div><div className="font-bold">{v}</div></div>;

function ResultLookup({ info, code }: { info: Info; code: string }) {
  const [shortId, setShortId] = useState(() => { try { return JSON.parse(localStorage.getItem(`exam_${code}`) || "{}").shortId || ""; } catch { return ""; } });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<any>(null);
  const check = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/exam-public/${code}/result`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shortId, name }) });
      const j = await r.json();
      if (!j.success) setError(j.error); else setRes(j);
    } catch { setError("Нет связи с сервером"); }
    finally { setBusy(false); }
  };
  const printData = useMemo((): PrintData | null => res?.state === "ready" ? {
    title: res.exam.certificateTitle, examTitle: res.exam.title, student: { name: res.student.name, level: res.student.level, shortId: res.student.shortId },
    orgName: res.org.name, logoUrl: res.org.logoUrl, school: res.school, photo: res.photo, result: res.result,
  } : null, [res]);
  const MSG: Record<string, string> = { pending: "Работа проверяется. Результат появится после публикации.", hidden: "Результаты этого экзамена сообщает организатор.", in_progress: "Работа ещё не сдана.", annulled: "Работа аннулирована организатором." };
  return (
    <Center>
      <PublicBrand name={info.org.name} logoUrl={info.org.logoUrl} />
      <div className={`${box} p-6 space-y-3`}>
        <h1 className="text-xl font-bold">Результат: {info.exam.title}</h1>
        {!res || res.state !== "ready" ? (
          <>
            <Field l="Номер работы"><input className={`${inp} font-mono tracking-widest`} inputMode="numeric" value={shortId} onChange={e => setShortId(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" /></Field>
            <Field l="Фамилия"><input className={inp} value={name} onChange={e => setName(e.target.value)} /></Field>
            {error && <div className="text-sm text-rose-600">{error}</div>}
            {res && MSG[res.state] && <div className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3">{MSG[res.state]}</div>}
            <button className={primary} disabled={busy || shortId.length < 6 || name.trim().length < 2} onClick={check}>{busy ? "Ищем…" : "Показать результат"}</button>
          </>
        ) : (
          <>
            <div className="font-semibold">{res.student.name}{res.student.level ? ` · ${res.student.level}` : ""}</div>
            <ResultCard r={res.result} />
            {printData && (
              <div className="flex flex-wrap gap-2 pt-2">
                {res.exam.certificate && <button className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm" onClick={() => openPrint(certificateHTML(printData))}>Сертификат</button>}
                <button className="px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm" onClick={() => openPrint(reportHTML(printData))}>Отчёт по темам</button>
              </div>
            )}
          </>
        )}
      </div>
    </Center>
  );
}

/** Фото до начала экзамена — для сертификата и сверки личности. */
function PhotoStep({ info, onDone }: { info: Info; onDone: (photo: string | null) => Promise<void> }) {
  const v = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [fail, setFail] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    (async () => {
      try { stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } }); if (v.current) { v.current.srcObject = stream.current; await v.current.play().catch(() => {}); } }
      catch { setFail(true); }
    })();
    return () => stream.current?.getTracks().forEach(t => t.stop());
  }, []);
  // «Переснять» монтирует новый <video> — подключаем к нему тот же поток.
  useEffect(() => { if (!shot && v.current && stream.current && v.current.srcObject !== stream.current) { v.current.srcObject = stream.current; void v.current.play().catch(() => {}); } }, [shot]);
  const take = () => {
    const el = v.current; if (!el?.videoWidth) return;
    const c = document.createElement("canvas"); const k = Math.min(1, 480 / el.videoWidth);
    c.width = el.videoWidth * k; c.height = el.videoHeight * k;
    c.getContext("2d")!.drawImage(el, 0, 0, c.width, c.height);
    setShot(c.toDataURL("image/jpeg", 0.8));
  };
  const go = async (photo: string | null) => { setBusy(true); stream.current?.getTracks().forEach(t => t.stop()); await onDone(photo); };
  return (
    <Center>
      <PublicBrand name={info.org.name} logoUrl={info.org.logoUrl} />
      <div className={`${box} p-6 space-y-3 text-center`}>
        <h1 className="text-xl font-bold">Фото для экзамена</h1>
        <p className="text-sm text-slate-500">Смотрите в камеру, лицо целиком в кадре.</p>
        {fail ? <p className="text-sm text-amber-700">Камера недоступна — можно продолжить без фото.</p>
          : shot ? <img src={shot} alt="" className="mx-auto rounded-xl max-h-64" /> : <video ref={v} muted playsInline className="mx-auto rounded-xl max-h-64 -scale-x-100 bg-black" />}
        {!fail && (shot
          ? <div className="flex gap-2"><button className="flex-1 py-3 rounded-xl border border-slate-300 font-semibold" onClick={() => setShot(null)}>Переснять</button><button className={`${primary} flex-1`} disabled={busy} onClick={() => go(shot)}>Начать экзамен</button></div>
          : <button className={primary} onClick={take}>Сделать фото</button>)}
        {fail && <button className={primary} disabled={busy} onClick={() => go(null)}>Начать экзамен</button>}
      </div>
    </Center>
  );
}
