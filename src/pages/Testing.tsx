import React, { useState, useEffect, useRef, useCallback } from "react";
import DOMPurify from "dompurify";
import { QRCodeCanvas } from "qrcode.react";
import { Reorder } from "framer-motion";
import { testsData } from "../data/testsData";
import { Question } from "../types";
import { getHourlyPIN, isValidHourlyPIN, normalizeDigits, formatMathText, getCEFRLevel, fetchGasAPI } from "../lib/utils";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useTenant } from "../context/TenantContext";
import QuestionFactory from "../components/tests/QuestionFactory";
import ExamQuestion from "../components/tests/ExamQuestion";
import { useProctoringEngine, ProctoringDetectorFlags } from "../lib/useProctoringEngine";
import ProctoringWarningOverlay from "../components/ProctoringWarningOverlay";
import { useResolvedTenantId } from "../lib/resolveTenant";
import { useParams } from "react-router-dom";

/**
 * Часы экзамена — изолированный компонент.
 *
 * Тикают внутри себя: раньше setRemainingSeconds жил в состоянии всей
 * страницы, и каждую секунду перерисовывался весь экзамен со списком
 * вопросов. Теперь ежесекундно обновляются только эти несколько цифр.
 * Таймер мягкий: ноль показывает «Время вышло», ничего не отправляя.
 */
const ExamClock = React.memo(function ExamClock({ phaseStartedAt, timeLimitMinutes }: {
  phaseStartedAt: number; timeLimitMinutes: number;
}) {
  const calc = () => timeLimitMinutes * 60 - Math.floor((Date.now() - phaseStartedAt) / 1000);
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setLeft(calc()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseStartedAt, timeLimitMinutes]);
  return (
    <div className={`font-mono font-bold text-lg ${left <= 0 ? "text-red-600" : left < 300 ? "text-amber-600" : "text-slate-600"}`}>
      {left <= 0 ? "Время вышло" : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}
    </div>
  );
});

export default function Testing() {
  const { orgSlug, testId: urlTestId } = useParams<{ orgSlug: string, testId?: string }>();
  // Слаг из URL → id организации. Раньше при любом неизвестном имени здесь
  // молча подставлялась Академия — чужая школа получала её тесты и PIN.
  const tenantResolve = useResolvedTenantId(orgSlug);
  const resolvedTenantId = tenantResolve.tenantId;

  const safeGetSession = (key: string, defaultVal: any) => {
    try { 
      const val = sessionStorage.getItem(key) || localStorage.getItem("persist_" + key);
      if (!val || val === "undefined" || val === "null") return defaultVal;
      return val; 
    } catch(e) { return defaultVal; }
  };
  
  const clearAllTestData = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      console.log('Storage cleared!');
    } catch(e) {}
  };

  useEffect(() => {
    (window as any).clearTestStorage = () => {
      localStorage.clear();
      sessionStorage.clear();
      console.log('Storage cleared!');
      window.location.reload();
    };
  }, []);
  
  const [studentName, setStudentName] = useState(() => safeGetSession("studentName", ""));
  const [studentPhone, setStudentPhone] = useState(() => safeGetSession("studentPhone", ""));
  const [studentEmail, setStudentEmail] = useState(() => safeGetSession("studentEmail", ""));
  const [enteredPin, setEnteredPin] = useState(() => safeGetSession("enteredPin", ""));
  const [phase, setPhase] = useState<"login" | "core" | "intermediate" | "english" | "final" | "suspended">(
    () => (safeGetSession("phase", "") as any) || "login"
  );
  const [isResumingEnglish, setIsResumingEnglish] = useState(false);
  const [resumeShortId, setResumeShortId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  /**
   * То же значение, но доступное из «старых» замыканий.
   *
   * Таймер приостановки взводится в обработчике потери фокуса и живёт со
   * своим снимком состояния. Он читал isSubmitting из замыкания, где оно
   * было false, — и приостанавливал тест ПРЯМО ВО ВРЕМЯ сдачи работы. Так
   * ученик, ждавший медленный ответ сервера, получал «тест приостановлен».
   */
  const isSubmittingRef = useRef(false);
  const markSubmitting = (v: boolean) => { isSubmittingRef.current = v; setIsSubmitting(v); };
  const [isRetake, setIsRetake] = useState(false);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  // Анкета регистрации и название организации приходят вместе с вопросами:
  // страница анонимна и документ организации прочитать не может.
  const [regCfg, setRegCfg] = useState<any>(null);
  const [orgName, setOrgName] = useState("");
  /** Поле анкеты: подпись, подсказка, показывать ли, обязательно ли. */
  const rf = (key: "name" | "phone" | "email" | "grade") => {
    const DEF: Record<string, { label: string; placeholder: string }> = {
      name: { label: "ФИО", placeholder: "Иванов Иван Иванович" },
      phone: { label: "Номер телефона", placeholder: "+996 555 123 456" },
      email: { label: "E-mail (для результатов)", placeholder: "student@example.com" },
      grade: { label: "Выберите ваш класс", placeholder: "" },
    };
    const f = (regCfg?.fields || []).find((x: any) => x?.key === key) || {};
    return {
      label: f.label || DEF[key].label,
      placeholder: f.placeholder ?? DEF[key].placeholder,
      visible: f.visible !== false,
      required: f.required !== false,
    };
  };
  const gradeOptions: string[] = (regCfg?.gradeOptions?.length ? regCfg.gradeOptions : ["7", "8", "9", "10", "11"]).map(String);
  const gradeSuffix: string = regCfg?.gradeSuffix ?? "класс";
  const pinAuthority: string = regCfg?.pinAuthority || "менеджер";
  const pinRequired: boolean = regCfg?.pinRequired !== false;
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | null>(null);
  const [phaseStartedAt, setPhaseStartedAt] = useState<number | null>(() => {
    const saved = safeGetSession("phaseStartedAt", "");
    return saved ? Number(saved) : null;
  });

  const [grade, setGrade] = useState<number | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlGrade = params.get("grade");
      if (urlGrade && !isNaN(Number(urlGrade))) return Number(urlGrade);
      // Fall back to parsing the grade out of a shared test link's :testId
      // (e.g. "test_grade_7_org_future_leaders") when ?grade= wasn't included —
      // older links copied from the admin panel may only carry the doc id.
      const pathMatch = window.location.pathname.match(/test_grade_(\d+)/);
      if (pathMatch) return Number(pathMatch[1]);
    } catch(e) {}
    const saved = safeGetSession("grade", null);
    return saved ? Number(saved) : null;
  });
  const [started, setStarted] = useState(() => safeGetSession("started", "") === "true");
  const [finished, setFinished] = useState(() => safeGetSession("finished", "") === "true");
  const [disqualified, setDisqualified] = useState(() => safeGetSession("disqualified", "") === "true");
  const [consentGiven, setConsentGiven] = useState(() => safeGetSession("consentGiven", "") === "true");
  const [stopAudio, setStopAudio] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    try {
      const saved = safeGetSession("answers", "");
      if (saved) return JSON.parse(saved);
      const sId = safeGetSession("shortId", "");
      if (sId && sId !== "undefined") {
        const backup = localStorage.getItem(`backup_answers_${sId}`);
        if (backup) {
          const parsed = JSON.parse(backup);
          if (parsed.answers) return parsed.answers;
        }
      }
    } catch(e) {}
    return {};
  });
  const [testId, setTestId] = useState(() => safeGetSession("testId", ""));
  const [firestoreTestData, setFirestoreTestData] = useState<any>(null);
  // Proctoring: config arrives with the questions (the student is anonymous
  // and cannot read the tenant doc), camera is requested only if enabled.
  const [proctoringConfig, setProctoringConfig] = useState<{ enabled: boolean; detectors: ProctoringDetectorFlags } | null>(null);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [proctoringUnavailable, setProctoringUnavailable] = useState(false);
  const proctorVideoRef = useRef<HTMLVideoElement | null>(null);
  const proctorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const proctorStreamRef = useRef<MediaStream | null>(null);
  const [shortId, setShortId] = useState(() => {
    const saved = safeGetSession("shortId", "");
    if (saved && saved !== "undefined" && saved !== "null") return saved;
    const newId = Math.floor(100000 + Math.random() * 900000).toString();
    try { 
      sessionStorage.setItem("shortId", newId); 
      localStorage.setItem("persist_shortId", newId);
    } catch(e) {}
    return newId;
  });
  const [qrToken, setQrToken] = useState(() => safeGetSession("qrToken", ""));
  const [pendingSubmission, setPendingSubmission] = useState(() => safeGetSession("pendingSubmission", "") === "true");
  const [resultData, setResultData] = useState<any>(() => {
    const saved = safeGetSession("resultData", "");
    return saved ? JSON.parse(saved) : null;
  });
  
  const [totalBlurTime, setTotalBlurTime] = useState<number>(() => {
    const saved = safeGetSession("totalBlurTime", "0");
    return Number(saved);
  });
  const [isFullscreenViolation, setIsFullscreenViolation] = useState(() => safeGetSession("isFullscreenViolation", "") === "true");
  
  const blurTimeout = useRef<NodeJS.Timeout | null>(null);
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ── PROCTORING ──────────────────────────────────────────────────────────
  // Runs invisibly while the student answers: no preview, no controls. The
  // camera is requested only once the exam actually starts and only if the
  // tenant enabled proctoring, so a school with it switched off never sees a
  // permission prompt.
  const proctoringWanted = Boolean(proctoringConfig?.enabled) && started && !finished && (phase === "core" || phase === "english");

  // Whether to HOLD the camera, which is broader than whether to analyse it.
  // A suspended exam is paused, not over: releasing the stream there meant the
  // browser re-prompted for permission the moment the manager let the student
  // back in — a permission dialog appearing mid-exam, outside any click, which
  // Chrome renders over the page and Safari may refuse outright.
  const proctoringCameraNeeded =
    Boolean(proctoringConfig?.enabled) && started && !finished &&
    (phase === "core" || phase === "english" || phase === "suspended" || isFullscreenViolation);

  // Acquires the camera once and hands the stream to the hidden <video> the
  // engine reads from. Called from startTest (before fullscreen, inside the
  // click gesture) and again from the effect below as a safety net for a
  // restored/resumed session that never passed through startTest.
  //
  // No session recording is made: storing 90-minute video needs Firebase
  // Storage, which requires the Blaze plan. The evidence the manager acts on —
  // the violation log with timestamps and a snapshot at each violation — fits
  // in Firestore and costs nothing.
  const acquireProctoringCamera = async (): Promise<boolean> => {
    if (proctorStreamRef.current) return true;
    try {
      // navigator.mediaDevices is absent entirely — not merely blocked — on a
      // page served over plain HTTP and in older Android WebViews. Reaching
      // straight for .getUserMedia there throws a synchronous TypeError rather
      // than rejecting, so a promise .catch() never sees it. Check first and
      // fall through to the unsupervised path like any other refusal.
      if (!navigator.mediaDevices?.getUserMedia) {
        console.warn("[Proctoring] getUserMedia unavailable (insecure context or old browser)");
        setProctoringUnavailable(true);
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: Boolean(proctoringConfig?.detectors?.audioAnalysis !== false),
      });
      proctorStreamRef.current = stream;
      if (proctorVideoRef.current) {
        proctorVideoRef.current.srcObject = stream;
        try { await proctorVideoRef.current.play(); } catch (e) {}
      }
      setCameraGranted(true);
      setProctoringUnavailable(false);
      return true;
    } catch (e) {
      // Denied, missing or busy camera must never cost a student their exam —
      // they carry on, and the submission is flagged so the manager knows the
      // session was unsupervised rather than clean.
      console.warn("[Proctoring] camera unavailable:", e);
      setProctoringUnavailable(true);
      return false;
    }
  };

  useEffect(() => {
    if (!proctoringCameraNeeded) return;
    if (proctorStreamRef.current) return;      // already granted in startTest
    if (proctoringUnavailable) return;         // already refused; do not re-prompt
    let cancelled = false;
    (async () => {
      await acquireProctoringCamera();
      // Started elsewhere in the meantime, or the component went away: drop the
      // stream rather than leaving the camera light on after the exam.
      if (cancelled && proctorStreamRef.current) {
        proctorStreamRef.current.getTracks().forEach((t) => t.stop());
        proctorStreamRef.current = null;
      }
    })();
    return () => { cancelled = true; };
  }, [proctoringCameraNeeded, proctoringUnavailable]);

  // Release the camera only once the exam is genuinely over (submit, finish) —
  // never for a pause the student is expected to come back from.
  useEffect(() => {
    if (proctoringCameraNeeded) return;
    if (proctorStreamRef.current) {
      proctorStreamRef.current.getTracks().forEach(t => t.stop());
      proctorStreamRef.current = null;
      setCameraGranted(false);
    }
  }, [proctoringWanted]);

  const proctoringActive = proctoringWanted && cameraGranted;
  const proctor = useProctoringEngine(
    proctorVideoRef,
    proctorCanvasRef,
    proctoringActive,
    undefined,
    {
      detectors: proctoringConfig?.detectors,
      // Tab switching is already policed by this page's own blur budget with a
      // suspend flow; letting the engine warn about it too meant two different
      // punishments for one action.
      suppressEvents: ["TAB_SWITCH"],
    }
  );

  // Evidence: a frame grabbed at the moment of each MEDIUM/HIGH violation.
  // The engine never paints to the canvas (only the sandbox's visual overlay
  // does), so the frame is copied here before capture — otherwise every
  // snapshot would come out blank.
  const proctorSnapshotsRef = useRef<{ type: string; atMs: number; dataUrl: string }[]>([]);
  const capturedEventIdsRef = useRef<Set<string>>(new Set());
  const proctorStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (proctoringActive && proctorStartedAtRef.current === null) {
      proctorStartedAtRef.current = Date.now();
    }
  }, [proctoringActive]);

  useEffect(() => {
    if (!proctoringActive) return;
    const video = proctorVideoRef.current;
    const canvas = proctorCanvasRef.current;
    if (!video || !canvas) return;

    for (const ev of proctor.events) {
      if (capturedEventIdsRef.current.has(ev.id)) continue;
      capturedEventIdsRef.current.add(ev.id);
      if (ev.severity === "LOW") continue;
      if (proctorSnapshotsRef.current.length >= 20) continue;
      try {
        const ctx = canvas.getContext("2d");
        if (!ctx || !video.videoWidth) continue;
        // Downscale to 640px wide. These frames are base64 inside a single
        // Firestore document, and 20 full 720p JPEGs come to ~3 MB — past the
        // 1 MB document limit, so the whole evidence write would be rejected
        // and the manager would get nothing. At 640px the set stays under
        // ~0.7 MB while a phone or a second person is still plainly visible.
        const scale = Math.min(1, 640 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        proctorSnapshotsRef.current.push({
          type: ev.type,
          atMs: ev.timestamp,
          dataUrl: canvas.toDataURL("image/jpeg", 0.6),
        });
      } catch (e) { /* a frame we cannot grab is not worth failing the exam over */ }
    }
  }, [proctor.events, proctoringActive]);

  // Sends the session dossier (violations with timecodes + snapshots) to the
  // manager. Called on submit; failures are swallowed because a proctoring
  // report must never block a student from handing in their work.
  const sendProctoringReport = async () => {
    if (!proctoringConfig?.enabled) return;
    if (!proctoringActive && !proctoringUnavailable) return;
    const tenantId = resolvedTenantId;

    try {
      await fetch("/api/exams/proctoring-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shortId,
          tenantId,
          unavailable: proctoringUnavailable,
          honestyIndex: proctor.honestyIndex,
          startedAt: proctorStartedAtRef.current,
          endedAt: Date.now(),
          violations: proctor.events.map(e => ({
            type: e.type, severity: e.severity, description: e.description, timestamp: e.timestamp,
          })),
          snapshots: proctorSnapshotsRef.current,
        }),
        signal: AbortSignal.timeout(20000),
      });
    } catch (e) {
      console.warn("[Proctoring] report upload failed:", e);
    }
  };

  /**
   * Ответ на вопрос. Ссылка на функцию стабильна, поэтому React.memo на
   * карточке вопроса работает: раньше стрелка создавалась заново для каждого
   * вопроса при каждой перерисовке, и memo не спасал.
   *
   * Функциональное обновление вместо {...answers}: замыкание больше не
   * держит весь объект ответов, и обработчик не нужно пересоздавать.
   */
  const handleAnswer = useCallback((id: string, val: any) => {
    const stringified = typeof val === 'object' ? JSON.stringify(val) : val;
    setAnswers(prev => (prev[id] === stringified ? prev : { ...prev, [id]: stringified }));
  }, []);

  const setBoth = useCallback((k: string, v: string) => {
    if (!v || v === "undefined" || v === "null") return;
    try {
      sessionStorage.setItem(k, v);
      localStorage.setItem("persist_" + k, v);
    } catch { /* приватный режим или переполненное хранилище */ }
  }, []);

  /**
   * Сохранение анкеты и состояния экзамена. Меняется редко — пишем сразу.
   *
   * `answers` из зависимостей УБРАН намеренно: он менялся на каждую букву и
   * тянул за собой 34 синхронные записи в sessionStorage и localStorage.
   * Это блокирующие обращения к диску на главном потоке — вместе с
   * прокторингом они и съедали ввод ученика. Ответы сохраняются ниже, с
   * задержкой.
   */
  const formRef = useRef({ studentName, studentPhone, studentEmail, enteredPin });
  formRef.current = { studentName, studentPhone, studentEmail, enteredPin };

  /**
   * Состояние экзамена — сразу: оно меняется по событиям (старт, фаза,
   * сдача), а не по нажатию клавиш.
   */
  useEffect(() => {
    if (grade) setBoth("grade", String(grade));
    setBoth("started", String(started));
    setBoth("finished", String(finished));
    setBoth("disqualified", String(disqualified));
    setBoth("consentGiven", String(consentGiven));
    setBoth("testId", testId);
    setBoth("shortId", shortId);
    setBoth("qrToken", qrToken);
    setBoth("pendingSubmission", String(pendingSubmission));
    if (resultData) setBoth("resultData", JSON.stringify(resultData));
    setBoth("phase", phase);
    if (phaseStartedAt) setBoth("phaseStartedAt", String(phaseStartedAt));
  }, [setBoth, grade, started, finished, disqualified, consentGiven, testId, shortId,
      qrToken, pendingSubmission, resultData, phase, phaseStartedAt]);

  /**
   * Поля анкеты — с задержкой, как и ответы.
   *
   * Имя, телефон, почта и PIN человек ВВОДИТ, то есть меняет по букве. Ради
   * восстановления после перезагрузки хватает последнего значения; писать
   * восемь ключей в два хранилища на каждый символ — незачем.
   */
  useEffect(() => {
    const flush = () => {
      const f = formRef.current;
      setBoth("studentName", f.studentName);
      setBoth("studentPhone", f.studentPhone);
      setBoth("studentEmail", f.studentEmail);
      setBoth("enteredPin", f.enteredPin);
    };
    const t = setTimeout(flush, 800);
    // Внимание: flush() здесь НЕ вызывается. Эффект пересоздаётся на каждое
    // нажатие клавиши, и запись в очистке означала бы ту же запись на каждый
    // символ — задержка не работала бы вовсе. Уход со страницы страхует
    // отдельный слушатель pagehide, живущий вне этого цикла.
    return () => clearTimeout(t);
  }, [studentName, studentPhone, studentEmail, enteredPin, setBoth]);

  // Дозапись при уходе со страницы — один слушатель на всё время жизни.
  useEffect(() => {
    const onLeave = () => {
      const f = formRef.current;
      setBoth("studentName", f.studentName);
      setBoth("studentPhone", f.studentPhone);
      setBoth("studentEmail", f.studentEmail);
      setBoth("enteredPin", f.enteredPin);
      setBoth("answers", JSON.stringify(answersRef.current));
    };
    window.addEventListener("pagehide", onLeave);
    return () => { window.removeEventListener("pagehide", onLeave); onLeave(); };
  }, [setBoth]);

  /**
   * Ответы — отдельно и с задержкой в секунду.
   *
   * Ученик печатает быстрее, чем раз в секунду, и промежуточные варианты
   * ответа сохранять незачем: важно последнее значение. Задержка обнуляется
   * при каждой букве, поэтому запись происходит в паузе между словами, а не
   * во время набора. При уходе со страницы дописываем немедленно — иначе
   * последняя секунда работы потерялась бы.
   */
  const answersRef = useRef(answers);
  answersRef.current = answers;
  useEffect(() => {
    const flush = () => {
      setBoth("answers", JSON.stringify(answersRef.current));
      if (shortId) {
        try {
          localStorage.setItem(`backup_answers_${shortId}`,
            JSON.stringify({ answers: answersRef.current, phase, grade, studentName }));
        } catch { /* переполнено */ }
      }
    };
    // Как и с анкетой: без flush() в очистке, иначе запись происходила бы
    // на каждое нажатие. Сохранение при уходе — отдельным слушателем ниже.
    const t = setTimeout(flush, 1000);
    return () => clearTimeout(t);
  }, [answers, shortId, phase, grade, studentName, setBoth]);

  // Страховка от непрерывного ввода: пока ученик отвечает без пауз, задержка
  // выше не срабатывает вовсе — и вкладка, убитая системой в этот момент,
  // теряла бы всё с последней паузы. Раз в 4 секунды копия пишется в любом
  // случае; вместе с задержкой это даёт максимум 4 секунды потерь.
  useEffect(() => {
    if (!started || finished) return;
    const t = setInterval(() => {
      setBoth("answers", JSON.stringify(answersRef.current));
      if (shortId) {
        try {
          localStorage.setItem(`backup_answers_${shortId}`,
            JSON.stringify({ answers: answersRef.current, phase, grade, studentName }));
        } catch { /* переполнено */ }
      }
    }, 4000);
    return () => clearInterval(t);
  }, [started, finished, shortId, phase, grade, studentName, setBoth]);

  // Start (or resume, on reload) the soft countdown whenever entering a timed phase.
  useEffect(() => {
    if (phase === "core" || phase === "english") {
      if (!phaseStartedAt) setPhaseStartedAt(Date.now());
    } else {
      setPhaseStartedAt(null);
    }
  }, [phase]);


  // Load questions from /api/exams/questions (server-side read, no client Firestore)
  useEffect(() => {
    if (!grade && !testId) return;

    const fetchQuestions = async () => {
      setQuestionsLoading(true);
      setQuestionsError(null);

      try {
        const params = new URLSearchParams();
        params.set("grade", String(grade || 0));
        // Только резолвленный id. Слаг из адреса (например «leaders») сервер
        // не знает, и раньше он молча уводил на непомеченный тест.
        if (!resolvedTenantId) { setQuestionsLoading(false); return; }
        params.set("tenantId", resolvedTenantId);

        const res = await fetch(`/api/exams/questions?${params}`);
        const data = await res.json();
        if (data?.registration) setRegCfg(data.registration);
        if (data?.orgName) setOrgName(data.orgName);

        if (!res.ok || !data.success) {
          setQuestionsError(data.error || "Failed to load test questions");
          return;
        }

        setFirestoreTestData({ questions: data.questions });
        if (data.timeLimitMinutes) setTimeLimitMinutes(Number(data.timeLimitMinutes));
        if (data.proctoring) setProctoringConfig(data.proctoring);
      } catch (e: any) {
        setQuestionsError(e.message || "Network error while loading questions");
      } finally {
        setQuestionsLoading(false);
      }
    };

    fetchQuestions();
  }, [grade, testId, resolvedTenantId]);

  // Prevent accidental F5/Closing
  useEffect(() => {
    if (!started || finished || disqualified) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Вы уверены? Ваш результат может быть аннулирован!";
      return "Вы уверены? Ваш результат может быть аннулирован!";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [started, finished, disqualified]);

  // --- ANTI-CHEAT LOGIC V2 ---
  useEffect(() => {
    // Restore and check cumulative blur time on mount/reload (only if not already suspended)
    if (started && !finished && !disqualified && phase !== "suspended") {
      const lastBlur = safeGetSession("lastBlurTime", null);
      if (lastBlur) {
        const elapsed = Date.now() - parseInt(lastBlur, 10);
        const newTotal = totalBlurTime + Math.max(0, elapsed);
        setTotalBlurTime(newTotal);
        sessionStorage.setItem("totalBlurTime", newTotal.toString());
        localStorage.setItem("persist_totalBlurTime", newTotal.toString());
        localStorage.removeItem("persist_lastBlurTime");
        sessionStorage.removeItem("lastBlurTime");
        if (newTotal > 30000) {
           suspendTest(phase);
        }
      }
    }
  }, [started, phase]);

  // Auto-check manager approval every 4 seconds when suspended
  useEffect(() => {
    if (phase !== "suspended" || !shortId) return;

    checkSuspendStatus(true);
    const interval = setInterval(() => {
      checkSuspendStatus(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [phase, shortId]);

  useEffect(() => {
    if (!started || finished || disqualified) return;

    const handleCheating = () => {
      // 0. Работа уже сдаётся — фокус не считаем вовсе.
      //
      // Пока ученик ждёт ответ сервера, страница может потерять фокус сама:
      // от подвисшего кадра, от системного окна, от того что человек
      // переключился проверить интернет. Раньше это взводило таймер, и
      // сдающий получал «тест приостановлен» вместо результата.
      if (isSubmittingRef.current) return;

      // 1. For mobile: ignore blur if document is still visible (avoids native dropdown/keyboard bugs)
      const isMobile = window.innerWidth < 768;
      if (isMobile && !document.hidden) return;

      // 2. Log when they left
      if (!safeGetSession("lastBlurTime", null)) {
        const now = Date.now().toString();
        sessionStorage.setItem("lastBlurTime", now);
        localStorage.setItem("persist_lastBlurTime", now);
      }
      
      // 3. Start a timer just in case they don't trigger focus/visibilitychange (desktop hover bug)
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
      
      const timeRemaining = Math.max(0, 30000 - totalBlurTime);
      blurTimeout.current = setTimeout(() => {
        const currentPhase = phaseRef.current;
        if (currentPhase !== 'core' && currentPhase !== 'english') return;
        
        // Safety net: if the document actually has focus right now (spurious blur event), ignore
        if (document.hasFocus && document.hasFocus() && !document.hidden) {
          sessionStorage.removeItem("lastBlurTime");
          localStorage.removeItem("persist_lastBlurTime");
          return;
        }

        // Time is up! Suspend the test instead of final submission
        suspendTest(currentPhase);
      }, timeRemaining);
    };

    const handleFocus = () => {
      if (blurTimeout.current) {
        clearTimeout(blurTimeout.current);
        blurTimeout.current = null;
      }
      
      const lastBlur = safeGetSession("lastBlurTime", null);
      if (lastBlur) {
        const elapsed = Date.now() - parseInt(lastBlur, 10);
        const newTotal = totalBlurTime + Math.max(0, elapsed);
        setTotalBlurTime(newTotal);
        sessionStorage.setItem("totalBlurTime", newTotal.toString());
        localStorage.setItem("persist_totalBlurTime", newTotal.toString());
        sessionStorage.removeItem("lastBlurTime");
        localStorage.removeItem("persist_lastBlurTime");
        
        if (newTotal > 30000) {
          const currentPhase = phaseRef.current;
          if (currentPhase === 'core' || currentPhase === 'english') {
            suspendTest(currentPhase);
          }
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) handleCheating();
      else handleFocus();
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        setIsFullscreenViolation(true);
        // Record it: leaving fullscreen is the moment an exam most often goes
        // wrong, and it was previously invisible to both the manager and the
        // audit log. keepalive so it still lands if the tab is being closed.
        try {
          fetch("/api/exams/event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            keepalive: true,
            body: JSON.stringify({
              event: "fullscreen_exit",
              shortId,
              tenantId: resolvedTenantId,
              studentName,
              grade,
              detail: `фаза: ${phaseRef.current}`,
            }),
          }).catch(() => {});
        } catch (e) { /* logging must never disturb the exam */ }
      }
    };

    window.addEventListener("blur", handleCheating);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("blur", handleCheating);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
    };
  }, [started, finished, disqualified, phase, totalBlurTime]); // Added totalBlurTime

  // Block copy/paste/context menu globally when test is active
  useEffect(() => {
    if (!started || finished) return;
    const preventAction = (e: Event) => e.preventDefault();
    const preventShortcuts = (e: KeyboardEvent) => {
      if (e.key === "F12") e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (["p", "s", "c", "v", "u"].includes(k)) e.preventDefault();
      }
    };
    
    document.addEventListener("contextmenu", preventAction);
    document.addEventListener("copy", preventAction);
    document.addEventListener("paste", preventAction);
    document.addEventListener("selectstart", preventAction);
    document.addEventListener("keydown", preventShortcuts);

    return () => {
      document.removeEventListener("contextmenu", preventAction);
      document.removeEventListener("copy", preventAction);
      document.removeEventListener("paste", preventAction);
      document.removeEventListener("selectstart", preventAction);
      document.removeEventListener("keydown", preventShortcuts);
    };
  }, [started, finished]);

  // Audio stop listener for cheaters
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!started || finished) return;
        if (disqualified) {
          setStopAudio(true); // Silence the song
        }
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [disqualified, started, finished]);

  // Reliable Audio Playback for Cheating
  useEffect(() => {
    if (disqualified && !stopAudio) {
      const audio = new Audio("/meme.mp3");
      audio.loop = true;
      audio.play().catch(e => console.warn("Autoplay blocked by browser:", e));
      
      return () => {
        audio.pause();
      };
    }
  }, [disqualified, stopAudio]);

  const resumeInterruptedTest = async () => {
    if (!resumeShortId.trim()) { alert("Введите Test ID"); return; }
    
    // Check if manager authorized retake
    try {
      const res = await fetch(`/api/public/check-retake/${resumeShortId.trim()}`);
      const data = await res.json();
      if (!data.allowed) {
        alert("Отказ. Менеджер еще не разрешил вам продолжить прерванный тест. Обратитесь к менеджеру.");
        return;
      }
    } catch(e) {
      alert("Ошибка проверки разрешения сервера. Проверьте интернет-соединение.");
      return;
    }
    
    const backupStr = localStorage.getItem(`backup_answers_${resumeShortId.trim()}`);
    if (!backupStr) {
      alert("Сохраненных ответов на этом устройстве не найдено. Обратитесь к менеджеру.");
      return;
    }
    try {
      const backup = JSON.parse(backupStr);
      setAnswers(backup.answers || {});
      setPhase(backup.phase || "core");
      setGrade(backup.grade || null);
      setStudentName(backup.studentName || "Восстановленный Ученик");
      setShortId(resumeShortId.trim());
      setIsRetake(true);
      setDisqualified(false);
      setStarted(true);
      setFinished(false);
      
      const docElm = document.documentElement as any;
      if (docElm.requestFullscreen) {
        const p = docElm.requestFullscreen();
        if (p && p.catch) p.catch(()=>{});
      }
    } catch(e) {
      alert("Ошибка восстановления данных.");
    }
  };

  const startTest = async () => {
    if (isSubmitting) return; // Prevent double-tap
    markSubmitting(true);
    try {
      if (isResumingEnglish) {
         if (!resumeShortId.trim()) return alert("Введите Test ID");
         if (!enteredPin.trim()) return alert("Введите PIN");
         
         const TESTER_PIN = import.meta.env.VITE_TESTER_PIN;
         if (pinRequired && !isValidHourlyPIN(enteredPin, resolvedTenantId) && (!TESTER_PIN || enteredPin !== TESTER_PIN)) {
            return alert("Неверный PIN-код. Узнайте актуальный PIN у менеджера.");
         }
         
         try {
           const data = await fetchGasAPI("/api/gas", { action: "getStudentByShortId", shortId: resumeShortId, tenantId: resolvedTenantId });
           if (!data.success) return alert(data.error || "Не найдено");
           
           const student = data.student;
           setShortId(student.shortId);
           setGrade(student.grade);
           setStudentName(student.studentName);
           setResultData({
             totalScore: student.totalScore,
             scores: { russian: student.russian, math: student.math, logic: student.logic, english: student.english }
           });
           if (student.english !== "") {
             return alert("Английский тест уже был сдан для этого Test ID!");
           }
           if (document.documentElement.requestFullscreen) {
             const p = document.documentElement.requestFullscreen();
             if (p && p.catch) p.catch(()=>{});
           }
           setStarted(true);
           setPhase("english");
         } catch (e:any) { alert("Ошибка: " + e.message); }
         return;
      }

      // Проверяем только то, что организация действительно спрашивает.
      // Раньше все поля были обязательны всегда, а имя обязано было состоять
      // ровно из двух слов латиницей или кириллицей — киргизские буквы «ө ү ң»
      // и одиночные имена отклонялись.
      if (rf("grade").visible && rf("grade").required && !grade) {
        return alert(`Укажите: ${rf("grade").label.toLowerCase()}.`);
      }
      if (rf("name").visible && rf("name").required && !studentName.trim()) {
        return alert(`Укажите: ${rf("name").label.toLowerCase()}.`);
      }
      if (regCfg?.requireFullName !== false && studentName.trim()
          && !/^[\p{L}-]+\s+[\p{L}-]+/u.test(studentName.trim())) {
        return alert("Введите фамилию и имя через пробел.");
      }
      if (rf("phone").visible && rf("phone").required
          && (!studentPhone.trim() || studentPhone.trim().replace(/\D/g, "").length < 9)) {
        return alert("Введите корректный номер телефона.");
      }
      if (rf("email").visible && rf("email").required
          && (!studentEmail.trim() || !studentEmail.includes("@"))) {
        return alert("Введите корректный E-mail адрес.");
      }
      if (!consentGiven) {
        return alert("Пожалуйста, подтвердите согласие на обработку данных.");
      }
      if (!enteredPin) {
        return alert("Введите PIN-код менеджера.");
      }
      
      const TESTER_PIN = import.meta.env.VITE_TESTER_PIN;
      if (pinRequired && !isValidHourlyPIN(enteredPin, resolvedTenantId) && (!TESTER_PIN || enteredPin !== TESTER_PIN)) {
        // Say which case it is. A student typing the right code and being told
        // it is wrong has nothing to act on; a student whose device clock is
        // off needs to know that, not to go ask for the PIN again.
        const digits = normalizeDigits(enteredPin);
        if (!digits) {
          return alert("Введите PIN-код цифрами.");
        }
        if (digits.length !== 4) {
          return alert(`PIN состоит из 4 цифр, а вы ввели ${digits.length}. Проверьте код.`);
        }
        // Correct for some other hour: their clock is wrong, not the code.
        const clockOff = [-6,-5,-4,-3,-2,2,3,4,5,6].some(o => digits === getHourlyPIN(o, resolvedTenantId));
        if (clockOff) {
          return alert(
            "PIN верный, но часы на вашем устройстве идут неточно, поэтому код не совпал.\n\n" +
            "Включите автоматическую установку времени в настройках телефона и попробуйте снова."
          );
        }
        return alert("Неверный PIN-код. Узнайте актуальный PIN у менеджера.");
      }

      // Camera BEFORE fullscreen. Browsers refuse to render the permission
      // prompt over a fullscreen page, so asking afterwards left the student
      // stuck: they had to press Escape, breaking out of the exam, just to
      // grant access. Asking here also keeps the request inside the click
      // handler, which is the gesture Safari requires.
      if (proctoringConfig?.enabled) {
        await acquireProctoringCamera();
      }

      try {
        const doc = document.documentElement as any;
        if (doc.requestFullscreen) {
          const p = doc.requestFullscreen();
          if (p && p.catch) p.catch(()=>{});
        } else if (doc.webkitRequestFullscreen) {
          const p = doc.webkitRequestFullscreen();
          if (p && p.catch) p.catch(()=>{});
        }
      } catch(e) { console.warn("Fullscreen API not supported", e); }
      
      const newTestId = testId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
      if (!testId) setTestId(newTestId);
      
      // Notify backend that student has started the test
      fetchGasAPI("/api/gas", {
         action: "registerStudent",
         tenantId: resolvedTenantId,
         enteredPin,
         testId: newTestId,
         shortId: shortId,
         studentName,
         studentPhone,
         studentEmail,
         grade,
         isTester: TESTER_PIN && enteredPin === TESTER_PIN
      }).catch(e => console.error("Failed to register student:", e));

      setStarted(true);
      setPhase("core");
    } finally {
      markSubmitting(false);
    }
  };

  
  const submitCoreTest = async (isDisqualified = false) => {
    // Immediately clear any pending anti-cheat timers when user clicks submit
    if (blurTimeout.current) { clearTimeout(blurTimeout.current); blurTimeout.current = null; }
    if (isSubmitting) return;
    markSubmitting(true);
    if (isDisqualified) {
      setDisqualified(true);
    }
    const payloadTestId = testId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
    if (!testId) setTestId(payloadTestId);

    const tokenUrl = `https://studyfreeforum.com/manager/form?shortId=${shortId}`;
    setQrToken(tokenUrl);

    const TESTER_PIN = import.meta.env.VITE_TESTER_PIN;
    const isTester = TESTER_PIN && enteredPin === TESTER_PIN;

    // Send russian, math, logic answers from active questions or entire answers map
    const activeTestQuestions = (firestoreTestData && firestoreTestData.questions)
      ? firestoreTestData.questions
      : (grade && testsData[grade] ? testsData[grade] : null);

    const coreAnswers: Record<string, any> = {};
    if (activeTestQuestions) {
        [...(activeTestQuestions.russian||[]), ...(activeTestQuestions.math||[]), ...(activeTestQuestions.logic||[])].forEach((q: any) => {
            if (answers[q.id] !== undefined && answers[q.id] !== null) {
              coreAnswers[q.id] = answers[q.id];
            }
        });
    } else {
        Object.assign(coreAnswers, answers);
    }

    const payload = {
      action: "submitTest",
      tenantId: resolvedTenantId,
      testId: payloadTestId,
      shortId: shortId,
      studentName,
      studentPhone,
      studentEmail,
      grade,
      answers: coreAnswers,
      cheated: isDisqualified,
      isRetake,
      testerPin: isTester ? enteredPin : undefined
    };

    if (!isTester) localStorage.setItem("lastTestTime", Date.now().toString());

    try {
      const data = await fetchGasAPI("/api/gas", payload);
      if (data.success) {
        // Clear anti-cheat timer on successful submit to prevent race condition
        if (blurTimeout.current) { clearTimeout(blurTimeout.current); blurTimeout.current = null; }
        // Fire-and-forget: the dossier must never delay or block the handoff.
        void sendProctoringReport();
        setResultData({
          totalScore: data.totalScore,
          scores: data.scores,
          cheated: data.cheated
        });
        setPendingSubmission(false);
        // The intermediate screen exists solely to offer the English test.
        // Grade 7 has none, so it announced "Основной тест сдан" and then
        // asked the student to come back for a test that does not exist.
        // Where there is no English section, go straight to the result.
        const engQuestions = (firestoreTestData as any)?.questions?.english
          || (grade ? (testsData as any)[grade]?.english : null)
          || [];
        if (engQuestions.length === 0) {
          setFinished(true);
          setPhase("final");
          if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        } else {
          setPhase("intermediate");
        }
      } else {
        if (data.error && (data.error.includes("уже сдавали") || data.error.includes("already submitted") || data.error.includes("already"))) {
             // Recover student and proceed gracefully
             if (blurTimeout.current) { clearTimeout(blurTimeout.current); blurTimeout.current = null; }
             try {
               const recoverData = await fetchGasAPI("/api/gas", { action: "getStudentByShortId", shortId, tenantId: resolvedTenantId });
               if (recoverData.success) {
                 setResultData({
                   totalScore: recoverData.student.totalScore,
                   scores: { russian: recoverData.student.russian, math: recoverData.student.math, logic: recoverData.student.logic, english: recoverData.student.english },
                   diagnosticsReport: recoverData.student.diagnosticsReport
                 });
                 setPhase("intermediate");
                 return;
               }
             } catch(e) {}
             alert(data.error);
             return;
        }
        throw new Error(data.error);
      }
    } catch (e: any) {
      console.error(e);
      // Save to localStorage for offline retry
      try { localStorage.setItem('offline_test_' + payloadTestId, JSON.stringify(payload)); } catch(storageErr) {}
      alert("Ошибка отправки теста: " + e.message + ". Ваши ответы сохранены, попробуйте еще раз.");
    } finally {
      markSubmitting(false);
    }
  };

  const submitEnglishTest = async (isDisqualified = false) => {
    // Immediately clear any pending anti-cheat timers when user clicks submit
    if (blurTimeout.current) { clearTimeout(blurTimeout.current); blurTimeout.current = null; }
    if (isSubmitting) return;
    markSubmitting(true);
    if (isDisqualified) setDisqualified(true);

    const TESTER_PIN = import.meta.env.VITE_TESTER_PIN;
    const isTester = TESTER_PIN && enteredPin === TESTER_PIN;

    const engAnswers: Record<string, any> = {};
    const activeEngQuestions = (firestoreTestData && firestoreTestData.questions && firestoreTestData.questions.english)
      ? firestoreTestData.questions.english
      : (grade && testsData[grade] && testsData[grade].english ? testsData[grade].english : null);

    if (activeEngQuestions) {
        activeEngQuestions.forEach((q: any) => {
            if (answers[q.id] !== undefined && answers[q.id] !== null) {
              engAnswers[q.id] = answers[q.id];
            }
        });
    } else {
        Object.assign(engAnswers, answers);
    }

    const activeShortId = (shortId && shortId !== "undefined" && shortId !== "null") ? shortId : Math.floor(100000 + Math.random() * 900000).toString();
    if (shortId !== activeShortId) setShortId(activeShortId);

    const payload = {
      action: "submitEnglishTest",
      tenantId: resolvedTenantId,
      shortId: activeShortId,
      studentName,
      studentPhone,
      studentEmail,
      grade,
      answers: engAnswers,
      cheated: isDisqualified,
      isRetake,
      testerPin: isTester ? enteredPin : undefined
    };

    try {
      const data = await fetchGasAPI("/api/gas", payload);
      if (data.success) {
        if (blurTimeout.current) { clearTimeout(blurTimeout.current); blurTimeout.current = null; }
        void sendProctoringReport();
        const engScore = (data.scores && typeof data.scores.english === 'number') 
          ? data.scores.english 
          : (typeof data.scores?.scores?.english === 'number' ? data.scores.scores.english : 0);

        setResultData((prev: any) => ({
           ...prev,
           scores: { ...(prev?.scores || {}), english: engScore },
           diagnosticsReport: prev?.diagnosticsReport || data.diagnosticsReport || ""
        }));
        setFinished(true);
        setPhase("final");
        try {
          const exitDoc = document as any;
          if (exitDoc.exitFullscreen) {
            const p = exitDoc.exitFullscreen();
            if (p && p.catch) p.catch(()=>{});
          }
          else if (exitDoc.webkitExitFullscreen) {
            const p = exitDoc.webkitExitFullscreen();
            if (p && p.catch) p.catch(()=>{});
          }
        } catch(e) {}
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      console.error(e);
      // Save to localStorage for offline retry
      try { localStorage.setItem('offline_test_eng_' + shortId, JSON.stringify(payload)); } catch(storageErr) {}
      alert("Ошибка отправки английского: " + e.message + ". Ваши ответы сохранены, попробуйте еще раз.");
    } finally {
      markSubmitting(false);
    }
  };

  const suspendTest = async (currentPhase: string) => {
    if (blurTimeout.current) { clearTimeout(blurTimeout.current); blurTimeout.current = null; }
    if (isSubmittingRef.current || phaseRef.current === "suspended") return;
    markSubmitting(true);

    const TESTER_PIN = import.meta.env.VITE_TESTER_PIN;
    const isTester = TESTER_PIN && enteredPin === TESTER_PIN;

    const payloadTestId = testId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
    if (!testId) setTestId(payloadTestId);

    const activeShortId = (shortId && shortId !== "undefined" && shortId !== "null") ? shortId : Math.floor(100000 + Math.random() * 900000).toString();
    if (shortId !== activeShortId) setShortId(activeShortId);

    const currentAnswers: Record<string, string> = {};
    const activeTestQ = (firestoreTestData && firestoreTestData.questions)
      ? firestoreTestData.questions
      : (grade && testsData[grade] ? testsData[grade] : null);

    if (activeTestQ) {
      if (currentPhase === 'core') {
        [...(activeTestQ.russian||[]), ...(activeTestQ.math||[]), ...(activeTestQ.logic||[])].forEach((q: any) => {
            if (answers[q.id] !== undefined) currentAnswers[q.id] = answers[q.id];
        });
      } else if (currentPhase === 'english') {
        (activeTestQ.english||[]).forEach((q: any) => {
            if (answers[q.id] !== undefined) currentAnswers[q.id] = answers[q.id];
        });
      }
    } else {
      Object.assign(currentAnswers, answers);
    }

    const savePhase = (currentPhase === 'suspended' ? (sessionStorage.getItem("suspendedPhase") || localStorage.getItem("persist_suspendedPhase") || 'core') : currentPhase);

    const payload = {
      action: "suspendTest",
      testId: payloadTestId,
      shortId: activeShortId,
      studentName,
      grade,
      answers: currentAnswers,
      phase: savePhase,
      testerPin: isTester ? enteredPin : undefined
    };

    try {
      setPhase("suspended");
      sessionStorage.setItem("suspendedPhase", savePhase);
      localStorage.setItem("persist_suspendedPhase", savePhase);
      sessionStorage.setItem("phase", "suspended");
      localStorage.setItem("persist_phase", "suspended");
      await fetchGasAPI("/api/gas", payload);
    } catch (e: any) {
      console.error("Failed to suspend:", e);
      setPhase("suspended");
      sessionStorage.setItem("suspendedPhase", savePhase);
      localStorage.setItem("persist_suspendedPhase", savePhase);
      sessionStorage.setItem("phase", "suspended");
      localStorage.setItem("persist_phase", "suspended");
    } finally {
      markSubmitting(false);
    }
  };

  const checkSuspendStatus = async (silent = false) => {
    if (isSubmitting) return;
    if (!silent) markSubmitting(true);
    try {
      const data = await fetchGasAPI("/api/gas", { action: "checkSuspendStatus", shortId });
      if (data.success && data.status !== "ПРИОСТАНОВЛЕН") {
        setDisqualified(false);
        // Clear the fullscreen warning too: leaving the tab drops fullscreen as
        // well, so without this the student is handed straight back to the
        // violation screen the moment the manager lets them continue.
        setIsFullscreenViolation(false);
        try { sessionStorage.removeItem("isFullscreenViolation"); } catch (e) {}
        const resumePhase = sessionStorage.getItem("suspendedPhase") || localStorage.getItem("persist_suspendedPhase") || "core";
        setPhase(resumePhase as any);
        setTotalBlurTime(0);
        
        // Clean ALL blur time and suspension state from BOTH sessionStorage and localStorage
        sessionStorage.setItem("totalBlurTime", "0");
        localStorage.setItem("persist_totalBlurTime", "0");

        sessionStorage.removeItem("lastBlurTime");
        localStorage.removeItem("persist_lastBlurTime");

        sessionStorage.removeItem("suspendedPhase");
        localStorage.removeItem("persist_suspendedPhase");

        sessionStorage.setItem("phase", resumePhase);
        localStorage.setItem("persist_phase", resumePhase);
        
        // Restore answers from backend if available
        if (data.answers) {
          try {
            const parsed = typeof data.answers === 'string' ? JSON.parse(data.answers) : data.answers;
            setAnswers(prev => ({ ...prev, ...parsed }));
          } catch(e) {}
        }
        
        if (!silent) {
          alert("Разрешение получено! Вы можете продолжить тест.");
        }
      } else {
        if (!silent) {
          alert("Менеджер еще не дал разрешение на продолжение теста.");
        }
      }
    } catch (e: any) {
      if (!silent) {
        alert("Ошибка при проверке статуса: " + e.message);
      }
    } finally {
      if (!silent) markSubmitting(false);
    }
  };

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasOfflineSubmissions, setHasOfflineSubmissions] = useState(false);
  const [isRetryingSubmission, setIsRetryingSubmission] = useState(false);

  const countOfflineSubmissions = () => {
    try {
      return Object.keys(localStorage).filter(key => key.startsWith("offline_test_")).length;
    } catch(e) { return 0; }
  };

  // Detect any answers that previously failed to send (network error) so we can
  // surface a visible retry banner instead of leaving them stuck silently in localStorage.
  useEffect(() => {
    setHasOfflineSubmissions(countOfflineSubmissions() > 0);
  }, [phase]);

  const retrySubmission = async () => {
    setIsRetryingSubmission(true);
    // Find all offline tests in localStorage
    const offlineKeys = Object.keys(localStorage).filter(key => key.startsWith("offline_test_"));

    if (offlineKeys.length === 0) {
      setPendingSubmission(false);
      setHasOfflineSubmissions(false);
      setIsRetryingSubmission(false);
      return;
    }

    for (const key of offlineKeys) {
      const payloadStr = localStorage.getItem(key);
      if (payloadStr) {
        try {
          const payloadObj = JSON.parse(payloadStr);
          const data = await fetchGasAPI("/api/gas", payloadObj);

          if (data.success) {
            localStorage.removeItem(key);
          } else {
            throw new Error(data.error || "Unknown GAS error");
          }
        } catch(e: any) {
          setSubmitError(e.message);
          setHasOfflineSubmissions(countOfflineSubmissions() > 0);
          setIsRetryingSubmission(false);
          alert(`Ошибка сети: ${e.message}`);
          return; // Stop on first error
        }
      }
    }

    // If all succeeded
    setPendingSubmission(false);
    setSubmitError(null);
    setHasOfflineSubmissions(false);
    setIsRetryingSubmission(false);
    alert("Данные успешно отправлены!");
  };


  const OfflineRetryBanner = hasOfflineSubmissions ? (
    <div className="fixed bottom-0 left-0 right-0 z-[60] bg-red-600 text-white px-4 py-3 flex flex-col sm:flex-row items-center justify-center gap-3 shadow-2xl">
      <span className="text-sm font-medium text-center">
        ⚠ Не удалось отправить ваши ответы на сервер (проблема с сетью). Данные сохранены на этом устройстве.
      </span>
      <button
        onClick={retrySubmission}
        disabled={isRetryingSubmission}
        className="px-4 py-1.5 bg-white text-red-600 rounded-lg font-bold text-sm hover:bg-red-50 disabled:opacity-50 transition whitespace-nowrap"
      >
        {isRetryingSubmission ? "Отправка..." : "Повторить отправку"}
      </button>
    </div>
  ) : null;

  // Proctoring has to survive every early return below. The hidden <video> is
  // what the engine reads frames from, so unmounting it stops detection dead —
  // and leaving fullscreen (the most common way an exam goes wrong) hit exactly
  // that path: the student saw the violation screen, the camera went dark, and
  // no warning could ever appear again for the rest of the exam.
  const ProctoringLayer = (
    <>
      {proctoringCameraNeeded && (
        <>
          <video
            ref={proctorVideoRef}
            className="fixed -top-[9999px] -left-[9999px] w-[640px] h-[480px] pointer-events-none opacity-0"
            playsInline
            muted
          />
          <canvas ref={proctorCanvasRef} className="hidden" width={640} height={480} />
        </>
      )}
      <ProctoringWarningOverlay events={proctor.events} isActive={proctoringActive} />
    </>
  );

  // Fullscreen Violation UI
  // Suspension outranks the fullscreen warning. Both can be true at once — the
  // student is suspended for being away, and leaving the tab also drops
  // fullscreen — and this branch used to win, so the suspended screen was
  // unreachable: "Вернуться к тесту" cleared the flag, the suspended screen
  // appeared, resuming re-entered fullscreen, and the warning came straight
  // back. The student could never reach the manager's permission at all.
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


  if (isFullscreenViolation && phase !== "suspended") {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center z-50">
        {ProctoringLayer}
        <h1 className="text-3xl font-bold mb-4">Нарушение режима</h1>
        <p className="text-lg text-slate-300 mb-8 max-w-md">Вы покинули полноэкранный режим. Тестирование должно проходить только в полноэкранном режиме, чтобы избежать списывания.</p>
        <button
          onClick={() => {
            const doc = document.documentElement as any;
            if (doc.requestFullscreen) doc.requestFullscreen().catch(()=>{});
            else if (doc.webkitRequestFullscreen) doc.webkitRequestFullscreen().catch(()=>{});
            setIsFullscreenViolation(false);
          }}
          className="px-6 py-3 bg-blue-600 rounded-xl font-semibold hover:bg-blue-500 transition-colors"
        >
          Вернуться к тесту
        </button>
      </div>
    );
  }

  if (phase === "suspended") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        {ProctoringLayer}
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-500 to-amber-700"></div>
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">⏸️</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Тест приостановлен</h2>
          <p className="text-slate-600 mb-6">Вы свернули вкладку или покинули страницу во время тестирования. Для продолжения необходимо разрешение менеджера.</p>
          
          <p className="text-sm text-slate-500 font-medium border-t pt-4">Покажите этот код менеджеру:</p>
          <div className="mt-3 text-4xl font-mono font-bold text-amber-600 tracking-widest bg-amber-50 py-3 rounded-xl border border-amber-100 mb-6">
            {shortId}
          </div>
          
          <button 
            onClick={() => checkSuspendStatus(false)}
            disabled={isSubmitting}
            className={`w-full py-4 rounded-xl font-bold text-white transition-all transform hover:scale-[1.02] active:scale-[0.98] mb-4 ${
              isSubmitting ? "bg-slate-400 cursor-not-allowed" : "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700"
            }`}
          >
            {isSubmitting ? "Проверка..." : "Проверить разрешение"}
          </button>
        </div>
      </div>
    );
  }

  if (disqualified && (phase as string) !== "suspended") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 to-red-700"></div>
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">!</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Вы пойманы на списывании</h2>
        <p className="text-slate-600 mb-6">Вы покинули страницу во время тестирования. Результат аннулирован в соответствии с правилами.</p>
        <audio autoPlay src="https://www.myinstants.com/media/sounds/directed-by-robert-b_voI2Z4T.mp3" />
        <p className="text-sm text-slate-500 font-medium border-t pt-4">Покажите этот код менеджеру:</p>
        <div className="mt-3 text-4xl font-mono font-bold text-red-600 tracking-widest bg-red-50 py-3 rounded-xl border border-red-100 mb-6">
          {shortId}
        </div>
        
        <button 
          onClick={() => {
            clearAllTestData();
            window.location.reload();
          }}
          className="text-sm text-slate-500 hover:text-slate-800 underline transition-colors"
        >
          Закрыть и вернуться на главную
        </button>
        </div>
      </div>
    );
  }

  
  if (phase === "intermediate") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center select-none">
        <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-100">
          <h1 className="text-3xl font-extrabold text-blue-900 mb-6">Основная часть принята</h1>
          <p className="text-xl text-slate-600 mb-8">
            Номер работы: <span className="font-mono font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded">{shortId}</span>
          </p>
          <div className="bg-amber-50 p-6 rounded-xl border border-amber-200 mb-8 text-amber-800 text-left">
            <h3 className="font-bold text-lg mb-2">Что дальше?</h3>
            <p>Остался тест по английскому языку. Его можно сдать сейчас или позже, введя номер работы на главном экране.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => {
                setPhase("english");
                if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(()=>{});
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all"
            >
              Сдать английский сейчас
            </button>
            <button
              onClick={() => {
                setFinished(true);
                setPhase("final");
                if (document.exitFullscreen) document.exitFullscreen().catch(()=>{});
              }}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-4 px-6 rounded-xl text-lg transition-all"
            >
              Завершить и выйти
            </button>
          </div>
        </div>
        {OfflineRetryBanner}
      </div>
    );
  }

  if (phase === "final" || finished) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-md w-full border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
          
          {disqualified ? (
            <>
              <h1 className="text-4xl font-black text-red-600 mb-4 uppercase tracking-wider">Дисквалификация</h1>
              <p className="text-lg text-slate-600 mb-8 font-medium">Ваш тест был принудительно завершен из-за нарушения правил.</p>
            </>
          ) : (
            <>
              {/* Баллы ученику не показываются — результаты видит только
                  организация. Раньше здесь выводилась полная разбивка по
                  предметам, уровень CEFR и аналитика по темам. */}
              <h1 className="text-3xl font-extrabold text-blue-900 mb-4">{regCfg?.finishTitle || "Работа принята"}</h1>
              <p className="text-base text-slate-600 mb-8 font-medium leading-relaxed">
                {regCfg?.finishText || "Ваши ответы сохранены и переданы на проверку. Результаты сообщит организация после рассмотрения всех работ. Сохраните номер работы — он понадобится при обращении."}
              </p>
            </>
          )}

          <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-sm font-medium text-blue-800 mb-2">Номер работы:</p>
            <p className="text-3xl font-mono font-bold tracking-widest text-blue-600">{shortId}</p>
          </div>
          
          <button onClick={() => { clearAllTestData(); window.location.reload(); }} className="w-full font-bold text-slate-500 hover:text-slate-700 py-2">
            Вернуться к входу
          </button>
        </div>
        {OfflineRetryBanner}
      </div>
    );
  }

  if (!started) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold mb-1 text-center">{regCfg?.title || "Входное тестирование"}</h1>
          {(regCfg?.subtitle || orgName) && (
            <p className="text-sm text-slate-500 text-center mb-5">{regCfg?.subtitle || orgName}</p>
          )}
          
          <div className="space-y-4 mb-6">
            {!isResumingEnglish && (
              <>
                <div style={{ display: rf("name").visible ? undefined : "none" }}>
                  <label className="block text-sm font-medium mb-2">{rf("name").label}:</label>
                  <input
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          type="text" 
                    placeholder={rf("name").placeholder}
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full border rounded-xl p-3 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{rf("phone").label}:</label>
                  <input
                    type="tel" 
                    placeholder={rf("phone").placeholder}
                    value={studentPhone}
                    onChange={(e) => setStudentPhone(e.target.value)}
                    className="w-full border rounded-xl p-3 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{rf("email").label}:</label>
                  <input
                    type="email" 
                    placeholder={rf("email").placeholder}
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    className="w-full border rounded-xl p-3 bg-slate-50"
                  />
                </div>
                
                <div style={{ display: rf("grade").visible ? undefined : "none" }}>
                  <label className="block text-sm font-medium mb-2">{rf("grade").label}:</label>
                  <select 
                    className="w-full border rounded-xl p-3 bg-slate-50"
                    value={grade || ""}
                    onChange={(e) => setGrade(Number(e.target.value))}
                  >
                    <option value="">Не выбран</option>
                    {gradeOptions.map(g => (
                      <option key={g} value={g}>{gradeSuffix ? `${g} ${gradeSuffix}` : g}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div style={{ display: pinRequired ? undefined : "none" }}>
              <label className="block text-sm font-medium mb-2">PIN-код аудитории (спросите у {pinAuthority}а):</label>
              <input
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      type="text" 
                placeholder="Например: 4812"
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                className="w-full border rounded-xl p-3 bg-slate-50 font-mono tracking-widest text-lg"
              />
            </div>
          </div>
          
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-amber-800 text-sm">
            <strong>Внимание! (Anti-Cheat)</strong>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Тест откроется на весь экран.</li>
              <li>Если вы закроете тест, свернете окно или переключитесь на другую вкладку более чем на 2 секунды — тест автоматически аннулируется с нулем баллов.</li>
              <li>Не пытайтесь обновить страницу во время прохождения теста.</li>
              <li>Копирование и вставка отключены.</li>
            </ul>
          </div>

          <div className="mb-6 flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <input 
              type="checkbox" 
              id="consent"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="mt-1 w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 flex-shrink-0 cursor-pointer"
            />
            <div className="text-sm text-slate-600 leading-relaxed">
              <label htmlFor="consent" className="cursor-pointer block mb-2 select-none">
                {regCfg?.consentText ? regCfg.consentText : (<>
                  Я даю <a href="/privacy" target="_blank" className="text-blue-600 hover:underline">согласие</a> на
                  сбор и обработку персональных данных (имя, телефон, результаты тестирования, данные системы
                  наблюдения) для проведения испытания{orgName ? ` в «${orgName}»` : ""}, а также принимаю
                  условия <a href="/terms" target="_blank" className="text-blue-600 hover:underline">пользовательского соглашения</a>.
                </>)}
              </label>
              <p className="text-xs text-slate-400 mt-2 border-t pt-2">
                Нажимая кнопку "Начать тест" и отмечая настоящее согласие, вы подтверждаете, что являетесь законным родителем или опекуном несовершеннолетнего кандидата и обладаете всеми законными правами на предоставление его персональных данных.
              </p>
            </div>
          </div>

          
          {!isResumingEnglish ? (
            <>
              <button 
                onClick={startTest}
                disabled={
                  (rf("grade").visible && rf("grade").required && !grade)
                  || (rf("name").visible && rf("name").required && !studentName.trim())
                  || (rf("phone").visible && rf("phone").required && !studentPhone.trim())
                  || (rf("email").visible && rf("email").required && !studentEmail.trim())
                  || (pinRequired && !enteredPin.trim())
                  || !consentGiven
                }
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-lg disabled:opacity-50 hover:bg-blue-700 transition shadow-lg mb-3"
              >
                {regCfg?.startButtonLabel || "Начать тест"}
              </button>
              <button 
                onClick={() => setIsResumingEnglish(true)}
                className="w-full py-3 bg-white text-blue-600 border-2 border-blue-600 rounded-xl font-bold text-lg hover:bg-blue-50 transition"
              >
                Продолжить тест по английскому
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Ваш Test ID:</label>
                <input
                  type="text"
                  value={resumeShortId}
                  onChange={(e) => setResumeShortId(e.target.value)}
                  className="w-full border rounded-xl p-3 bg-slate-50 font-mono tracking-widest text-center"
                  placeholder="Например: 123456"
                />
              </div>
              <button 
                onClick={startTest}
                disabled={!resumeShortId.trim() || !enteredPin.trim()}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-lg disabled:opacity-50 hover:bg-indigo-700 transition shadow-lg"
              >
                Войти и начать английский
              </button>
              <button 
                onClick={resumeInterruptedTest}
                disabled={!resumeShortId.trim() || !enteredPin.trim()}
                className="w-full py-3 bg-amber-600 text-white rounded-xl font-bold text-lg disabled:opacity-50 hover:bg-amber-700 transition shadow-lg"
              >
                Продолжить прерванный тест
              </button>
              <button 
                onClick={() => setIsResumingEnglish(false)}
                className="w-full py-2 text-slate-500 font-bold hover:text-slate-700 transition"
              >
                Назад
              </button>
            </div>
          )}

        </div>
      </div>
    );
  }

  const test = (firestoreTestData && firestoreTestData.questions)
    ? firestoreTestData.questions
    : (grade && testsData[grade]?.questions ? testsData[grade].questions : null) || (grade ? testsData[grade] : null);

  const hasQuestions = test && (
    (test.russian && test.russian.length > 0) ||
    (test.math && test.math.length > 0) ||
    (test.english && test.english.length > 0) ||
    (test.logic && test.logic.length > 0)
  );

  if (questionsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-4 border border-slate-200">
          <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          <h3 className="text-xl font-bold text-slate-800">Загрузка теста...</h3>
          <p className="text-sm text-slate-500">Загружаются задания для {grade} класса</p>
        </div>
      </div>
    );
  }

  if (questionsError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-4 border border-red-200">
          <div className="text-4xl">⚠️</div>
          <h3 className="text-xl font-bold text-red-600">Не удалось загрузить тест</h3>
          <p className="text-sm text-slate-600">{questionsError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  if (!hasQuestions) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-4 border border-slate-200">
          <div className="text-4xl">📭</div>
          <h3 className="text-xl font-bold text-slate-800">Тест недоступен</h3>
          <p className="text-sm text-slate-500">К сожалению, для {grade} класса тест пока не загружен. Пожалуйста, обратитесь к администратору.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 pb-20 select-none relative">
      {/* Proctoring runs invisibly: the student sees no preview of themselves,
          only the warning overlay when something is actually flagged. */}
      {ProctoringLayer}

      {isSubmitting && (
        <div className="fixed inset-0 bg-white/70 backdrop-blur-sm z-50 flex items-center justify-center">
           <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center border border-blue-100">
              <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mb-6"></div>
              <div className="text-xl font-bold text-slate-800">Сохранение результатов...</div>
              <div className="text-sm text-slate-500 mt-2 font-medium">Пожалуйста, подождите (до 15 секунд)</div>
           </div>
        </div>
      )}

      <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10 gap-4">
        <div className="font-bold text-lg">Тестирование: {grade} класс</div>
        {phaseStartedAt && timeLimitMinutes && (phase === "core" || phase === "english") ? (
          <ExamClock phaseStartedAt={phaseStartedAt} timeLimitMinutes={timeLimitMinutes} />
        ) : null}
        <button
          onClick={() => phase === "english" ? submitEnglishTest(false) : submitCoreTest(false)}
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
        >
          {isSubmitting ? "Сохраняем..." : "Завершить тест"}
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-12">
        {(phase === "core" 
          ? [
              { title: "Русский язык", q: test.russian }, 
              { title: "Математика", q: test.math }, 
              { title: "Логика", q: test.logic }
            ]
          : [
              { title: "Английский язык", q: test.english }
            ]
        ).filter(s => s.q && s.q.length > 0).map((section, idx) => (
          <div key={idx}>
            <h2 className="text-2xl font-bold mb-6 text-blue-600">{section.title}</h2>
            <div className="space-y-8">
              {section.q.map((q: any) => (
                <ExamQuestion
                  key={q.id}
                  question={q}
                  rawValue={answers[q.id]}
                  onAnswer={handleAnswer}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="max-w-3xl mx-auto px-6 pb-12 flex justify-end">
        <button 
          onClick={() => phase === "english" ? submitEnglishTest(false) : submitCoreTest(false)}
          className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all"
        >
          Завершить тест
        </button>
      </div>
      {OfflineRetryBanner}
    </div>
  );
}
