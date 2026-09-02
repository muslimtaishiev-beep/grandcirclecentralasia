import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useProctoringEngine } from "../lib/useProctoringEngine";
import { useResolvedTenantId } from "../lib/resolveTenant";
import ProctoringWarningOverlay from "../components/ProctoringWarningOverlay";

/**
 * Вступительный срез знаний 5-11 — экран ученика.
 *
 * SAT-style: one question at a time, a question map that shows what is
 * answered / flagged / current, a per-section clock. Everything that decides
 * anything lives on the server — this screen never sees a correct answer, and
 * cannot regenerate its own variant.
 *
 * Answers are saved to the server as they are given (debounced) AND mirrored
 * to localStorage, because a student whose browser dies mid-exam must not lose
 * work. The server copy is authoritative; the local one only survives an
 * offline blip.
 */

type Question = {
  id: string; subject: string; topic: string; difficulty: number;
  type?: "multiple_choice" | "text_input";
  text: string; options: string[]; points: number;
};
type Section = {
  key: string; title: string; minutes: number;
  deadline: number | null; finished: boolean; questions: Question[];
};
type Session = {
  sessionId: string; shortId: string; grade: number;
  status: string; currentSection: number;
  sections: Section[]; answers: Record<string, string>;
  /** Настройка прокторинга на момент старта — см. proctorStartedAtRef. */
  proctoring?: { enabled: boolean; detectors?: Record<string, boolean> };
};

const LETTERS = ["А", "Б", "В", "Г", "Д", "Е"];
const DIFFICULTY_LABEL: Record<number, string> = { 1: "лёгкий", 2: "средний", 3: "сложный" };

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function PlacementExam() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  // Резолвим слаг из URL в id организации: /oxford-school/... и /org_.../...
  // работают одинаково, а неизвестное имя — честная ошибка, не подстановка.
  const tenantResolve = useResolvedTenantId(orgSlug);
  const tenantId = tenantResolve.tenantId;

  const [phase, setPhase] = useState<"login" | "photo" | "exam" | "between" | "final">("login");
  const [session, setSession] = useState<Session | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [cursor, setCursor] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sectionResult, setSectionResult] = useState<any>(null);
  const [final, setFinal] = useState<any>(null);

  // Login fields
  const [studentName, setStudentName] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [grade, setGrade] = useState("7");
  const [enteredPin, setEnteredPin] = useState("");

  // Фото для сертификата: снимается ДО экзамена, отдельным шагом. Движок
  // прокторинга в этот момент ещё не работает, поэтому кадр не может стать
  // нарушением — это фото на документ, а не наблюдение.
  const photoVideoRef = useRef<HTMLVideoElement | null>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const photoStreamRef = useRef<MediaStream | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const shortIdRef = useRef<string>("");

  // ── Прокторинг ────────────────────────────────────────────────────────────
  // Включается завучем в настройках экзамена и приезжает вместе с сессией:
  // ученик анонимен и прочитать настройку из Firestore не может.
  //
  // Отказ от камеры экзамен НЕ прерывает. Срез пишут в том числе с чужих
  // телефонов и старых ноутбуков; лишить человека поступления из-за сломанной
  // камеры нельзя. Работа просто помечается как несопровождённая.
  const proctorVideoRef = useRef<HTMLVideoElement | null>(null);
  const proctorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const proctorStreamRef = useRef<MediaStream | null>(null);
  const proctorStartedAtRef = useRef<number>(0);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [proctoringUnavailable, setProctoringUnavailable] = useState(false);
  const proctoringReportedRef = useRef(false);
  const pendingRef = useRef<Record<string, string>>({});
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoFinishing = useRef(false);

  const storageKey = `placement_${tenantId}`;

  // Прокторинг нужен, только пока человек действительно пишет работу.
  const proctoringOn = Boolean(session?.proctoring?.enabled);
  const proctoringWanted = proctoringOn && phase === "exam";

  /**
   * Камера для наблюдения.
   *
   * Запрашивается ПОСЛЕ фотографии на сертификат и отдельным потоком: фото
   * снимается до начала экзамена и нарушением быть не может по определению.
   */
  const acquireProctorCamera = useCallback(async (): Promise<boolean> => {
    if (proctorStreamRef.current) return true;
    try {
      // На http:// и в старых WebView mediaDevices нет вовсе, и обращение к
      // getUserMedia бросает синхронно — .catch() такого не увидит.
      if (!navigator.mediaDevices?.getUserMedia) {
        setProctoringUnavailable(true);
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: session?.proctoring?.detectors?.audioAnalysis !== false,
      });
      proctorStreamRef.current = stream;
      if (proctorVideoRef.current) {
        proctorVideoRef.current.srcObject = stream;
        try { await proctorVideoRef.current.play(); } catch {}
      }
      proctorStartedAtRef.current = Date.now();
      setCameraGranted(true);
      setProctoringUnavailable(false);
      return true;
    } catch {
      // Отказ, занятая или сломанная камера не стоят человеку экзамена.
      setProctoringUnavailable(true);
      return false;
    }
  }, [session?.proctoring?.detectors?.audioAnalysis]);

  useEffect(() => {
    if (!proctoringWanted || proctorStreamRef.current || proctoringUnavailable) return;
    void acquireProctorCamera();
  }, [proctoringWanted, proctoringUnavailable, acquireProctorCamera]);

  // Отпускаем камеру, когда экзамен действительно закончен, — но не на
  // перерыве между секциями, куда человек вернётся.
  useEffect(() => {
    if (phase !== "final") return;
    if (proctorStreamRef.current) {
      proctorStreamRef.current.getTracks().forEach(t => t.stop());
      proctorStreamRef.current = null;
      setCameraGranted(false);
    }
  }, [phase]);

  const proctoringActive = proctoringWanted && cameraGranted;
  const proctor = useProctoringEngine(
    proctorVideoRef, proctorCanvasRef, proctoringActive, undefined,
    {
      detectors: session?.proctoring?.detectors,
      // Переключение вкладок у среза не карается: экзамен идёт не в
      // полноэкранном режиме, и предупреждать за каждый уход фокуса —
      // значит завалить человека шумом на ровном месте.
      suppressEvents: ["TAB_SWITCH"],
    },
  );

  /**
   * Протокол наблюдения — завучу, при сдаче работы.
   *
   * Ошибки проглатываются намеренно: отчёт прокторинга не должен помешать
   * человеку сдать экзамен. Балл он не меняет — это материал для завуча.
   */
  const sendProctoringReport = useCallback(async () => {
    if (!proctoringOn || proctoringReportedRef.current) return;
    if (!cameraGranted && !proctoringUnavailable) return;
    proctoringReportedRef.current = true;
    try {
      await fetch("/api/placement/proctoring", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId, shortId: shortIdRef.current,
          unavailable: proctoringUnavailable,
          honestyIndex: proctor.honestyIndex,
          startedAt: proctorStartedAtRef.current, endedAt: Date.now(),
          violations: proctor.events.map(e => ({
            type: e.type, severity: e.severity,
            description: e.description, timestamp: e.timestamp,
          })),
        }),
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      // Молча: работа уже сдана, и это важнее протокола.
    }
  }, [proctoringOn, cameraGranted, proctoringUnavailable, tenantId, proctor]);

  // Restore an interrupted attempt on load: the id is what lets the server
  // hand back the same variant.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (saved.shortId) {
        shortIdRef.current = saved.shortId;
        setStudentName(saved.studentName || "");
        setGrade(String(saved.grade || "7"));
        setAnswers(saved.answers || {});
        setFlags(saved.flags || {});
      }
    } catch (e) { /* corrupt storage must not block the exam */ }
  }, [storageKey]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const activeSection: Section | null = session ? session.sections[session.currentSection] : null;
  const questions = activeSection?.questions || [];
  const question = questions[cursor];
  const remaining = activeSection?.deadline ? activeSection.deadline - now : null;

  const persistLocal = useCallback((patch: Record<string, unknown>) => {
    try {
      const prev = JSON.parse(localStorage.getItem(storageKey) || "{}");
      localStorage.setItem(storageKey, JSON.stringify({ ...prev, ...patch }));
    } catch (e) { /* private mode */ }
  }, [storageKey]);

  /** Sends whatever has accumulated; never throws — a failed save retries on the next answer. */
  const flushAnswers = useCallback(async () => {
    const batch = pendingRef.current;
    if (!Object.keys(batch).length || !shortIdRef.current) return;
    pendingRef.current = {};
    try {
      await fetch("/api/placement/answer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, shortId: shortIdRef.current, answers: batch }),
      });
    } catch (e) {
      // Put them back so the next flush retries rather than dropping answers.
      pendingRef.current = { ...batch, ...pendingRef.current };
    }
  }, [tenantId]);

  const answer = (qid: string, value: string) => {
    setAnswers(prev => {
      const next = { ...prev, [qid]: value };
      persistLocal({ answers: next });
      return next;
    });
    pendingRef.current[qid] = value;
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flushAnswers, 1200);
  };

  const toggleFlag = (qid: string) => {
    setFlags(prev => {
      const next = { ...prev, [qid]: !prev[qid] };
      persistLocal({ flags: next });
      return next;
    });
  };

  const stopPhotoCamera = useCallback(() => {
    if (photoStreamRef.current) {
      photoStreamRef.current.getTracks().forEach(t => t.stop());
      photoStreamRef.current = null;
    }
  }, []);

  const openPhotoStep = async () => {
    setPhotoError(null);
    // PIN и наличие вопросов проверяются ДО съёмки: сфотографироваться,
    // чтобы затем услышать «неверный код» или «экзамена нет», — обидно и
    // бессмысленно.
    setBusy(true);
    try {
      const res = await fetch("/api/placement/check-pin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, enteredPin, grade: Number(grade) }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Не удалось проверить PIN."); return; }
    } catch (e) {
      setError("Нет связи с сервером. Проверьте интернет и попробуйте снова.");
      return;
    } finally { setBusy(false); }

    setPhase("photo");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhotoError("Камера недоступна на этом устройстве. Можно продолжить без фото.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false,
      });
      photoStreamRef.current = stream;
      if (photoVideoRef.current) {
        photoVideoRef.current.srcObject = stream;
        try { await photoVideoRef.current.play(); } catch (e) {}
      }
    } catch (e) {
      // Отказ от камеры не должен закрывать дорогу к экзамену — сертификат
      // просто будет без фотографии.
      setPhotoError("Камера не разрешена. Можно продолжить без фото — сертификат будет без снимка.");
    }
  };

  const takePhoto = () => {
    // Обратный отсчёт: ученику сказано смотреть в камеру, и снимок должен
    // случиться предсказуемо, а не в момент, когда он тянется к мыши.
    setCountdown(3);
    const tick = (n: number) => {
      if (n === 0) {
        const v = photoVideoRef.current, c = photoCanvasRef.current;
        setCountdown(null);
        if (!v || !c || !v.videoWidth) { setPhotoError("Не удалось сделать снимок. Попробуйте ещё раз."); return; }
        // Квадратный кадр по центру — как на документе.
        const side = Math.min(v.videoWidth, v.videoHeight);
        c.width = 400; c.height = 400;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, 400, 400);
        setPhotoData(c.toDataURL("image/jpeg", 0.82));
        return;
      }
      setCountdown(n);
      setTimeout(() => tick(n - 1), 1000);
    };
    setTimeout(() => tick(2), 1000);
  };

  const confirmPhotoAndStart = async () => {
    if (photoData) {
      const sid = shortIdRef.current || String(Math.floor(100000 + Math.random() * 900000));
      shortIdRef.current = sid;
      try {
        await fetch("/api/placement/photo", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, shortId: sid, photo: photoData }),
        });
      } catch (e) { /* без фото экзамен всё равно должен начаться */ }
    }
    stopPhotoCamera();
    await startExam();
  };

  const startExam = async () => {
    setError(null);
    if (!studentName.trim() || studentName.trim().split(/\s+/).length < 2) {
      return setError("Введите фамилию и имя полностью.");
    }
    if (!enteredPin.trim()) return setError("Введите PIN-код аудитории — его называет завуч.");
    setBusy(true);
    try {
      const sid = shortIdRef.current || String(Math.floor(100000 + Math.random() * 900000));
      const res = await fetch("/api/placement/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, grade: Number(grade), shortId: sid, studentName, studentPhone, studentEmail, enteredPin }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Не удалось начать экзамен."); return; }
      shortIdRef.current = data.session.shortId;
      persistLocal({ shortId: data.session.shortId, studentName, grade, answers: data.session.answers || {} });
      setSession(data.session);
      setAnswers(prev => ({ ...prev, ...(data.session.answers || {}) }));
      setCursor(0);
      setPhase("exam");
    } catch (e: any) {
      setError("Нет связи с сервером. Проверьте интернет и попробуйте снова.");
    } finally {
      setBusy(false);
    }
  };

  const finishSection = useCallback(async (auto = false) => {
    if (busy || !shortIdRef.current) return;
    setBusy(true);
    try {
      await flushAnswers();
      const res = await fetch("/api/placement/finish-section", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, shortId: shortIdRef.current }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Не удалось завершить секцию."); return; }
      if (data.final) {
        void sendProctoringReport();
        setFinal(data.final);
        setPhase("final");
        try { localStorage.removeItem(storageKey); } catch (e) {}
      } else {
        setSectionResult({ ...data.sectionResult, auto });
        setSession(prev => prev ? {
          ...prev,
          currentSection: data.nextSection.index,
          sections: prev.sections.map((s, i) =>
            i === data.nextSection.index ? { ...s, deadline: data.nextSection.deadline } : s),
        } : prev);
        setCursor(0);
        setPhase("between");
      }
    } catch (e: any) {
      setError("Не удалось отправить результат. Проверьте интернет — ответы сохранены.");
    } finally {
      setBusy(false);
      autoFinishing.current = false;
    }
  }, [busy, flushAnswers, storageKey, tenantId]);

  // Time is up: close the section automatically, keeping what was answered.
  useEffect(() => {
    if (phase !== "exam" || remaining === null || autoFinishing.current) return;
    if (remaining <= 0) {
      autoFinishing.current = true;
      void finishSection(true);
    }
  }, [phase, remaining, finishSection]);

  // Save on the way out — closing the tab must not lose the last answer.
  useEffect(() => {
    const onHide = () => { void flushAnswers(); };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flushAnswers]);

  const answeredCount = useMemo(
    () => questions.filter(q => answers[q.id] !== undefined && answers[q.id] !== "").length,
    [questions, answers]);

  // ── Login ────────────────────────────────────────────────────────────────
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

  if (phase === "login") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-lg w-full border border-slate-200">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Вступительный срез знаний</h1>
          <p className="text-slate-500 mb-6 text-sm">Математика и английский язык. Результат определяет класс, в который вы будете распределены.</p>

          {shortIdRef.current && (
            <div className="mb-5 rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
              Найдена незаконченная попытка (ID <span className="font-mono font-bold">{shortIdRef.current}</span>).
              Войдите — вы продолжите с того же места, с теми же вопросами.
            </div>
          )}

          <label className="block text-sm font-medium text-slate-700 mb-1">Фамилия и имя</label>
          <input value={studentName} onChange={e => setStudentName(e.target.value)}
            placeholder="Иванов Иван" autoComplete="name"
            className="w-full border border-slate-300 rounded-xl p-3 mb-4 bg-slate-50" />

          <label className="block text-sm font-medium text-slate-700 mb-1">Телефон</label>
          <input value={studentPhone} onChange={e => setStudentPhone(e.target.value)}
            type="tel" placeholder="+996 700 000 000" autoComplete="tel"
            className="w-full border border-slate-300 rounded-xl p-3 mb-4 bg-slate-50" />

          <label className="block text-sm font-medium text-slate-700 mb-1">E-mail (для результата)</label>
          <input value={studentEmail} onChange={e => setStudentEmail(e.target.value)}
            type="email" placeholder="name@example.com" autoComplete="email"
            className="w-full border border-slate-300 rounded-xl p-3 mb-4 bg-slate-50" />

          <label className="block text-sm font-medium text-slate-700 mb-1">Класс, в который поступаете</label>
          <select value={grade} onChange={e => setGrade(e.target.value)}
            className="w-full border border-slate-300 rounded-xl p-3 mb-4 bg-slate-50">
            {[5, 6, 7, 8, 9, 10, 11].map(g => <option key={g} value={g}>{g} класс</option>)}
          </select>

          <label className="block text-sm font-medium text-slate-700 mb-1">PIN-код аудитории</label>
          <input value={enteredPin} onChange={e => setEnteredPin(e.target.value)}
            inputMode="numeric" placeholder="4 цифры" autoComplete="off"
            className="w-full border border-slate-300 rounded-xl p-3 mb-5 bg-slate-50 font-mono tracking-widest text-lg" />

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</div>
          )}

          <button onClick={() => {
              setError(null);
              if (!studentName.trim() || studentName.trim().split(/\s+/).length < 2) {
                return setError("Введите фамилию и имя полностью.");
              }
              if (!enteredPin.trim()) return setError("Введите PIN-код аудитории — его называет завуч.");
              void openPhotoStep();
            }} disabled={busy}
            className={`w-full py-4 rounded-xl font-bold text-white text-lg transition ${
              busy ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 shadow-lg"}`}>
            {busy ? "Собираем вариант…" : "Продолжить"}
          </button>
        </div>
      </div>
    );
  }

  // ── Фото для сертификата ─────────────────────────────────────────────────
  if (phase === "photo") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 max-w-md w-full border border-slate-200 text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Фотография для сертификата</h2>
          <p className="text-sm text-slate-500 mb-5">
            Посмотрите прямо в камеру. Снимок займёт пару секунд и попадёт
            на ваш сертификат — как фото на документе.
          </p>

          <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-square mb-4">
            {photoData ? (
              <img src={photoData} alt="Ваше фото" className="w-full h-full object-cover" />
            ) : (
              <>
                {/* Без зеркала: снимок пишется с камеры как есть, и зеркальный
                    предпросмотр показывал бы не то, что попадёт на сертификат. */}
                <video ref={photoVideoRef} playsInline muted
                  className="w-full h-full object-cover" />
                {countdown !== null && (
                  <div className="absolute inset-0 grid place-items-center bg-black/40">
                    <span className="text-7xl font-bold text-white tabular-nums">{countdown}</span>
                  </div>
                )}
                {/* Овал-подсказка, куда поместить лицо */}
                {countdown === null && (
                  <div className="absolute inset-0 grid place-items-center pointer-events-none">
                    <div className="w-40 h-52 rounded-[50%] border-2 border-white/50" />
                  </div>
                )}
              </>
            )}
          </div>
          <canvas ref={photoCanvasRef} className="hidden" />

          {photoError && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 mb-4 text-left">
              {photoError}
            </div>
          )}

          <div className="grid gap-2">
            {photoData ? (
              <>
                <button onClick={confirmPhotoAndStart} disabled={busy}
                  className={`w-full py-4 rounded-xl font-bold text-white text-lg ${
                    busy ? "bg-slate-400" : "bg-blue-600 hover:bg-blue-700 shadow-lg"}`}>
                  {busy ? "Собираем вариант…" : "Хорошо, начать экзамен"}
                </button>
                <button onClick={() => { setPhotoData(null); void openPhotoStep(); }}
                  className="w-full py-3 rounded-xl border border-slate-300 text-slate-600 font-semibold">
                  Переснять
                </button>
              </>
            ) : (
              <>
                <button onClick={takePhoto} disabled={countdown !== null || !!photoError}
                  className={`w-full py-4 rounded-xl font-bold text-white text-lg ${
                    countdown !== null || photoError ? "bg-slate-400" : "bg-blue-600 hover:bg-blue-700 shadow-lg"}`}>
                  {countdown !== null ? "Смотрите в камеру…" : "📷 Сделать снимок"}
                </button>
                <button onClick={() => { stopPhotoCamera(); void startExam(); }}
                  className="w-full py-3 rounded-xl border border-slate-300 text-slate-600 font-semibold">
                  Продолжить без фото
                </button>
              </>
            )}
          </div>

          <p className="text-xs text-slate-400 mt-4">
            Снимок используется только для сертификата. К проверке работы
            и наблюдению за экзаменом он отношения не имеет.
          </p>
        </div>
      </div>
    );
  }

  // ── Between sections ─────────────────────────────────────────────────────
  if (phase === "between" && session) {
    const next = session.sections[session.currentSection];
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center border border-slate-200">
          <div className="text-4xl mb-3">✓</div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Секция завершена</h2>
          {sectionResult?.auto && (
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm mb-4">
              Время секции вышло. Всё, что вы успели ответить, сохранено.
            </p>
          )}
          <p className="text-slate-600 mb-6">
            Следующая секция: <b>{next.title}</b>, {next.minutes} минут.
          </p>
          <button onClick={() => { setSectionResult(null); setPhase("exam"); }}
            className="w-full py-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg">
            Перейти к секции «{next.title}»
          </button>
          <p className="text-xs text-slate-400 mt-4">Таймер уже идёт — не задерживайтесь.</p>
        </div>
      </div>
    );
  }

  // ── Finished ─────────────────────────────────────────────────────────────
  if (phase === "final" && final) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-lg w-full text-center border border-slate-200">
          {/* Баллы здесь НЕ показываются. Машинная проверка — только начало:
              работу ещё сверяют с черновиком, могут снять вопрос или зачесть
              половину, а класс назначает школа. Цифра, показанная сейчас,
              разошлась бы с итоговой и превратилась бы в спор. */}
          <div className="text-4xl mb-3">🎓</div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Поздравляем, экзамен сдан!</h2>
          <p className="text-slate-600 mb-6">
            Ваша работа передана на проверку. Результат будет опубликован
            после того, как комиссия сверит работы — мы сообщим вам об этом.
          </p>

          <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-5 mb-6">
            <div className="text-sm text-blue-900 mb-1">Номер вашей работы</div>
            <div className="text-4xl font-mono font-bold text-blue-700 tracking-widest">{shortIdRef.current}</div>
            <div className="text-xs text-blue-800 mt-2">
              Запишите или сфотографируйте. По этому номеру и вашей фамилии
              вы посмотрите результат, когда школа его опубликует.
            </div>
          </div>

          <p className="text-sm text-slate-500">
            Проверить результат позже:{" "}
            <span className="font-medium text-slate-700">
              {typeof window !== "undefined" ? `${window.location.host}/${tenantId}/results` : ""}
            </span>
          </p>
        </div>
      </div>
    );
  }

  // ── Exam ─────────────────────────────────────────────────────────────────
  if (!session || !activeSection || !question) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Загрузка…</div>;
  }

  const lowTime = remaining !== null && remaining < 5 * 60000;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col select-none">
      {/* Прокторинг. Видео и canvas скрыты — ученик не должен смотреть на себя
          вместо задач, а движку нужен только кадр. Оверлей монтируется здесь,
          внутри ветки экзамена: вынесенный наружу, он размонтировался бы на
          каждом раннем return выше вместе со всем деревом. */}
      {proctoringOn && (
        <>
          <video ref={proctorVideoRef} autoPlay playsInline muted
            className="fixed opacity-0 pointer-events-none w-px h-px -z-10" />
          <canvas ref={proctorCanvasRef} className="hidden" />
          {proctoringActive && (
            <ProctoringWarningOverlay events={proctor.events} isActive={proctoringActive} />
          )}
          {proctoringUnavailable && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 text-center">
              Камера недоступна — экзамен продолжается, работа будет отмечена как написанная без наблюдения.
            </div>
          )}
        </>
      )}

      {/* Top bar: section, clock, position */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 sticky top-0 z-20">
        <div className="text-sm text-slate-600 min-w-0">
          <span className="font-semibold text-slate-900">{activeSection.title}</span>
          <span className="hidden sm:inline"> · секция {session.currentSection + 1} из {session.sections.length}</span>
          {/* Имя и номер работы всё время на виду: результат ищется по номеру,
              и ученик должен запомнить его к концу экзамена, а не искать потом. */}
          <div className="text-xs text-slate-400 truncate">
            {studentName} · № <span className="font-mono font-semibold text-slate-600">{shortIdRef.current}</span>
          </div>
        </div>
        <div className={`font-mono font-bold text-lg tabular-nums px-3 py-1 rounded-lg ${
          lowTime ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-800"}`}>
          {remaining !== null ? formatClock(remaining) : "—"}
        </div>
        <div className="text-sm text-slate-500 tabular-nums">
          {cursor + 1} / {questions.length}
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 px-4 sm:px-6 py-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3 flex-wrap text-xs">
            <span className={`px-2 py-0.5 rounded-full font-semibold ${
              question.difficulty === 1 ? "bg-emerald-50 text-emerald-700"
              : question.difficulty === 2 ? "bg-amber-50 text-amber-700"
              : "bg-red-50 text-red-700"}`}>
              {DIFFICULTY_LABEL[question.difficulty] || "—"}
            </span>
            {question.topic && <span className="text-slate-500">Тема: {question.topic}</span>}
            <button onClick={() => toggleFlag(question.id)}
              className={`ml-auto font-semibold ${flags[question.id] ? "text-amber-600" : "text-slate-400 hover:text-slate-600"}`}>
              {flags[question.id] ? "⚑ Отмечен" : "⚐ Отметить"}
            </button>
          </div>

          <p className="text-lg sm:text-xl font-semibold text-slate-900 mb-5 leading-snug">{question.text}</p>

          {question.type === "text_input" ? (
            <div>
              <input
                value={answers[question.id] || ""}
                onChange={e => answer(question.id, e.target.value)}
                placeholder="Введите ответ"
                autoComplete="off" autoCorrect="off" spellCheck={false}
                className="w-full border border-slate-300 rounded-xl p-4 text-lg bg-white focus:border-blue-500 focus:outline-none" />
              <p className="text-xs text-slate-400 mt-2">
                Ответ засчитывается независимо от запятой или точки в десятичной дроби.
              </p>
            </div>
          ) : (
          <div className="grid gap-2">
            {question.options.map((opt, i) => {
              const letter = LETTERS[i];
              const selected = answers[question.id] === letter;
              return (
                <button key={i} onClick={() => answer(question.id, letter)}
                  className={`flex items-center gap-3 text-left p-3 rounded-xl border transition ${
                    selected ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                  <span className={`w-7 h-7 rounded-full grid place-items-center text-sm font-bold shrink-0 border ${
                    selected ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 text-slate-500"}`}>
                    {letter}
                  </span>
                  <span className="text-slate-800">{opt.replace(/^[А-ЯA-Z][).]\s*/, "")}</span>
                </button>
              );
            })}
          </div>
          )}

          <div className="flex gap-3 mt-6">
            <button onClick={() => setCursor(c => Math.max(0, c - 1))} disabled={cursor === 0}
              className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold disabled:opacity-40">
              Назад
            </button>
            {cursor < questions.length - 1 ? (
              <button onClick={() => setCursor(c => c + 1)}
                className="flex-1 px-5 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700">
                Далее
              </button>
            ) : (
              <button onClick={() => {
                  const unanswered = questions.length - answeredCount;
                  const msg = unanswered > 0
                    ? `Без ответа осталось вопросов: ${unanswered}. Завершить секцию?`
                    : "Завершить секцию?";
                  if (confirm(msg)) void finishSection();
                }}
                disabled={busy}
                className="flex-1 px-5 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50">
                {busy ? "Отправляем…" : "Завершить секцию"}
              </button>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</div>
          )}
        </div>
      </div>

      {/* Question map */}
      <div className="bg-white border-t border-slate-200 px-4 sm:px-6 py-3 sticky bottom-0">
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {questions.map((q, i) => {
              const done = answers[q.id] !== undefined && answers[q.id] !== "";
              const flagged = flags[q.id];
              const current = i === cursor;
              return (
                <button key={q.id} onClick={() => setCursor(i)}
                  className={`w-8 h-8 rounded-lg text-xs font-mono border transition ${
                    current ? "border-2 border-blue-600 text-blue-700 font-bold"
                    : flagged ? "border-amber-400 text-amber-700 font-bold"
                    : done ? "bg-blue-600 border-blue-600 text-white font-semibold"
                    : "border-slate-200 text-slate-400 hover:border-slate-300"}`}>
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="text-xs text-slate-500">
            Отвечено {answeredCount} из {questions.length}
            {Object.values(flags).some(Boolean) && " · отмеченные вопросы обведены жёлтым"}
          </div>
        </div>
      </div>
    </div>
  );
}
