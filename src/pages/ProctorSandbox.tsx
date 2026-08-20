import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { useProctoringEngine, ProctoringEvent } from "../lib/useProctoringEngine";
import { useCompositeRecorder } from "../lib/useCompositeRecorder";
import { useAnswerTiming } from "../lib/useAnswerTiming";
import ProctoringWarningOverlay from "../components/ProctoringWarningOverlay";

const ProctoringOverlay = lazy(() => import("../components/ProctoringOverlay"));

// Mock questions for test simulation
const MOCK_QUESTIONS = [
  { id: "q1", text: "Укажите правильное написание слова:", options: ["Парашют", "Парашут", "Порашют", "Порашут"], correct: 0, points: 1, subject: "russian" },
  { id: "q2", text: "Решите уравнение: 2x + 5 = 17", options: ["x = 4", "x = 5", "x = 6", "x = 7"], correct: 2, points: 2, subject: "math" },
  { id: "q3", text: "Найдите площадь прямоугольника со сторонами 7 см и 12 см:", options: ["84 см²", "38 см²", "19 см²", "96 см²"], correct: 0, points: 2, subject: "math" },
  { id: "q4", text: "Какое слово является синонимом к слову «храбрый»?", options: ["Робкий", "Смелый", "Тихий", "Грустный"], correct: 1, points: 1, subject: "russian" },
  { id: "q5", text: "Продолжите последовательность: 2, 6, 18, 54, ...", options: ["108", "162", "72", "216"], correct: 1, points: 3, subject: "logic" },
  { id: "q6", text: "Упростите выражение: 3(a + 2b) − 2(a − b)", options: ["a + 8b", "a + 4b", "5a + 4b", "a + 6b"], correct: 0, points: 3, subject: "math" },
  { id: "q7", text: "Найдите лишнее слово в ряду:", options: ["Бежать", "Мчаться", "Нестись", "Стоять"], correct: 3, points: 1, subject: "logic" },
  { id: "q8", text: "Если A = true, B = false, то A AND (NOT B) = ?", options: ["true", "false", "undefined", "null"], correct: 0, points: 3, subject: "logic" },
];

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function formatEventTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return formatTime(s);
}

function severityColor(sev: string): string {
  if (sev === "HIGH") return "text-red-400";
  if (sev === "MEDIUM") return "text-amber-400";
  return "text-blue-400";
}

function severityBg(sev: string): string {
  if (sev === "HIGH") return "bg-red-500/20 border-red-500/40";
  if (sev === "MEDIUM") return "bg-amber-500/20 border-amber-500/40";
  return "bg-blue-500/20 border-blue-500/40";
}

function eventTypeIcon(type: string): string {
  switch (type) {
    case "GAZE_LEFT": case "GAZE_RIGHT": return "👁";
    case "EXTRA_FACE": return "👥";
    case "HAND_BELOW": return "🤚";
    case "SWIPE": return "👆";
    case "LIGHT_ANOMALY": return "💡";
    case "FAST_ANSWER": return "⚡";
    case "PHONE_DETECTED": return "📱";
    case "BOOK_DETECTED": return "📖";
    case "SPEECH_CHEAT_DETECTED": return "🗣";
    case "GESTURE_SIGNAL_DETECTED": return "✌️";
    case "SILENT_LIP_SPEAKING_DETECTED": return "👄";
    case "PASTE_DETECTED": return "📋";
    case "TAB_SWITCH": return "🔀";
    case "FACE_LOST": return "❌";
    default: return "⚠";
  }
}

function eventTypeLabel(type: string): string {
  switch (type) {
    case "GAZE_LEFT": return "Взгляд влево";
    case "GAZE_RIGHT": return "Взгляд вправо";
    case "EXTRA_FACE": return "Второе лицо";
    case "HAND_BELOW": return "Рука под столом";
    case "SWIPE": return "Свайп-жест";
    case "LIGHT_ANOMALY": return "Свет телефона";
    case "FAST_ANSWER": return "Быстрый ответ";
    case "PHONE_DETECTED": return "Телефон в кадре!";
    case "BOOK_DETECTED": return "Книга / конспект";
    case "SPEECH_CHEAT_DETECTED": return "Речь / Попытка подсказки";
    case "GESTURE_SIGNAL_DETECTED": return "Сигнализирование пальцами";
    case "SILENT_LIP_SPEAKING_DETECTED": return "Чтение по губам / Проговаривание";
    case "PASTE_DETECTED": return "Вставка текста";
    case "TAB_SWITCH": return "Смена вкладки";
    case "FACE_LOST": return "Лицо потеряно";
    default: return type;
  }
}

export default function ProctorSandbox() {
  const [mode, setMode] = useState<"setup" | "student" | "admin">("setup");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  // Test state
  const [currentQ, setCurrentQ] = useState(0);
  const [testAnswers, setTestAnswers] = useState<Record<string, number>>({});
  const [testFinished, setTestFinished] = useState(false);

  // Refs — PERSISTENT across DOM changes
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const eventLogRef = useRef<HTMLDivElement | null>(null);

  // ML & Recording Hooks
  const currentQuestionText = mode === "student" && MOCK_QUESTIONS[currentQ] ? MOCK_QUESTIONS[currentQ].text : undefined;
  const engine = useProctoringEngine(videoRef, canvasRef, isSessionActive, currentQuestionText);
  const recorder = useCompositeRecorder(canvasRef);
  const timing = useAnswerTiming();

  // Ensure camera stream stays attached to videoRef whenever DOM updates
  const syncVideoStream = useCallback(() => {
    if (videoRef.current && mediaStreamRef.current) {
      if (videoRef.current.srcObject !== mediaStreamRef.current) {
        videoRef.current.srcObject = mediaStreamRef.current;
      }
      videoRef.current.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    syncVideoStream();
  }, [mode, cameraReady, syncVideoStream]);

  // Auto-scroll event log
  useEffect(() => {
    if (eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [engine.events]);

  // Setup paste monitoring when session starts
  useEffect(() => {
    if (isSessionActive) {
      const cleanup = timing.setupPasteMonitoring();
      return cleanup;
    }
  }, [isSessionActive, timing]);

  // Convert paste events to proctoring events
  useEffect(() => {
    if (timing.pasteEvents.length > 0) {
      const latest = timing.pasteEvents[timing.pasteEvents.length - 1];
      engine.addEvent({
        type: "PASTE_DETECTED",
        severity: "HIGH",
        description: `Вставка из буфера обмена (${latest.textLength} символов)`,
      });
    }
  }, [timing.pasteEvents.length, engine]);

  // Camera initialization
  const initCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: true,
      });
      mediaStreamRef.current = stream;
      setAudioStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch (err: any) {
      setCameraError(
        err.name === "NotAllowedError"
          ? "Доступ к камере запрещён. Разрешите доступ к камере в браузере."
          : "Ошибка подключения камеры: " + err.message
      );
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Start Session
  const startSession = useCallback(
    (selectedMode: "student" | "admin") => {
      setMode(selectedMode);
      setIsSessionActive(true);
      setCurrentQ(0);
      setTestAnswers({});
      setTestFinished(false);

      // Re-sync video element stream
      setTimeout(syncVideoStream, 100);

      // Start composite recording
      if (audioStream) {
        recorder.startRecording(audioStream);
      } else {
        recorder.startRecording();
      }

      // Start timer for question 1
      if (selectedMode === "student") {
        const q = MOCK_QUESTIONS[0];
        timing.startQuestionTimer(q.id, (q.points || 1) * 45);
      }
    },
    [audioStream, recorder, timing, syncVideoStream]
  );

  // Handle answering question in student mode
  const handleAnswer = useCallback(
    (optionIdx: number) => {
      const q = MOCK_QUESTIONS[currentQ];
      const result = timing.recordAnswer(q.id);

      if (result.suspicious) {
        engine.addEvent({
          type: "FAST_ANSWER",
          severity: result.severity || "MEDIUM",
          description: `Слишком быстрый ответ на вопрос "${q.text.slice(0, 25)}..." (${(result.actualTime || 0).toFixed(1)}с)`,
        });
      }

      setTestAnswers((prev) => ({ ...prev, [q.id]: optionIdx }));

      if (currentQ < MOCK_QUESTIONS.length - 1) {
        const nextQ = MOCK_QUESTIONS[currentQ + 1];
        timing.startQuestionTimer(nextQ.id, (nextQ.points || 1) * 45);
        setCurrentQ(currentQ + 1);
      } else {
        setTestFinished(true);
      }
    },
    [currentQ, engine, timing]
  );

  // Stop Session
  const stopSession = useCallback(async () => {
    setIsSessionActive(false);
    const blob = await recorder.stopRecording();
    if (blob) {
      recorder.downloadRecording(`proctoring_session_${Date.now()}`);
    }
  }, [recorder]);

  // Simulate test events for manual verification
  const simulateEvent = useCallback(
    (type: ProctoringEvent["type"], severity: ProctoringEvent["severity"], desc: string) => {
      engine.addEvent({ type, severity, description: desc });
    },
    [engine]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white select-none relative">
      {/* ── PERSISTENT HIDDEN MEDIA ELEMENTS ── */}
      {/* These elements stay in DOM at all times so video stream & canvas are never lost */}
      <video
        ref={videoRef}
        className="fixed -top-[9999px] -left-[9999px] w-[640px] h-[480px] pointer-events-none opacity-0"
        playsInline
        muted
      />

      {/* ── PROCTORING WARNING OVERLAY (Student-facing animated alerts) ── */}
      <ProctoringWarningOverlay
        events={engine.events}
        isActive={isSessionActive && mode === "student"}
      />

      {/* Proctoring Overlay renderer */}
      <Suspense fallback={null}>
        <ProctoringOverlay
          videoRef={videoRef}
          canvasRef={canvasRef}
          telemetry={engine.telemetry}
          events={engine.events}
          isRecording={recorder.isRecording}
          recordingDuration={recorder.recordingDuration}
          sessionStartTime={engine.sessionStartTime}
          faceLandmarks={engine.faceLandmarks}
          detectedObjects={engine.detectedObjects}
          handLandmarks={engine.handLandmarks}
        />
      </Suspense>

      {/* ══════════════════════════════════════════════ */}
      {/* MODE 1: SETUP SCREEN */}
      {/* ══════════════════════════════════════════════ */}
      {mode === "setup" && (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
          <canvas ref={canvasRef} className="hidden" />

          <div className="w-full max-w-xl">
            {/* Title */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-4 py-1.5 mb-4">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-cyan-300 text-xs font-mono uppercase tracking-widest">AI Proctoring Sandbox</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                Песочница <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Прокторинга</span>
              </h1>
              <p className="text-slate-400 mt-2 text-sm max-w-md mx-auto">
                Автономная система визуального наблюдения: нейросети распознают лицо, взгляд, руки и свет прямо в браузере.
              </p>
            </div>

            {/* Camera Card */}
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 mb-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>📹</span> Камера и Микрофон
                </h2>
                {cameraReady && (
                  <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded-full px-3 py-1 font-mono">
                    ✓ Камера активна
                  </span>
                )}
              </div>

              {!cameraReady && !cameraError && (
                <button
                  onClick={initCamera}
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-cyan-500/20"
                >
                  Включить камеру и запустить ML
                </button>
              )}

              {cameraError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
                  {cameraError}
                  <button onClick={initCamera} className="mt-2 w-full py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm transition">
                    Попробовать снова
                  </button>
                </div>
              )}

              {cameraReady && (
                <div className="space-y-3">
                  <div className="text-sm text-slate-300 space-y-1">
                    <p>✓ Камера: <span className="font-mono text-cyan-400">{videoRef.current?.videoWidth || 1280}×{videoRef.current?.videoHeight || 720}</span></p>
                    <p>✓ Запись звука: <span className="text-green-400">Включена</span></p>
                    <p className="text-xs text-slate-400">
                      {engine.isLoading ? `⏳ ${engine.loadingProgress}` : engine.isReady ? "✓ Нейросети загружены и готовы" : engine.error ? `❌ ${engine.error}` : ""}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Mode selection buttons */}
            {cameraReady && engine.isReady && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => startSession("student")}
                  className="group bg-slate-900/80 backdrop-blur border border-slate-800 hover:border-cyan-500/50 rounded-2xl p-5 text-left transition-all hover:bg-slate-800/80 shadow-xl"
                >
                  <div className="text-3xl mb-3">🎓</div>
                  <h3 className="text-white font-bold text-lg group-hover:text-cyan-300 transition">Режим Ученика</h3>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                    Пройдите тест из 8 вопросов с фоновым наблюдением
                  </p>
                </button>

                <button
                  onClick={() => startSession("admin")}
                  className="group bg-slate-900/80 backdrop-blur border border-slate-800 hover:border-blue-500/50 rounded-2xl p-5 text-left transition-all hover:bg-slate-800/80 shadow-xl"
                >
                  <div className="text-3xl mb-3">👨‍💼</div>
                  <h3 className="text-white font-bold text-lg group-hover:text-blue-300 transition">Режим Менеджера</h3>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                    Панель онлайн-наблюдения с вектором взгляда и логом
                  </p>
                </button>
              </div>
            )}

            {cameraReady && engine.isLoading && (
              <div className="text-center py-6">
                <div className="w-10 h-10 border-3 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-400 text-sm font-mono">{engine.loadingProgress}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* MODE 2: STUDENT TEST MODE */}
      {/* ══════════════════════════════════════════════ */}
      {mode === "student" && (
        <div className="min-h-screen p-4 sm:p-8">
          <canvas ref={canvasRef} className="hidden" />

          <div className="max-w-3xl mx-auto">
            {/* Top Bar */}
            <div className="flex items-center justify-between mb-8 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <div>
                  <div className="text-xs font-bold text-green-400 uppercase tracking-wider">AI Proctoring Active</div>
                  <div className="text-[11px] text-slate-400">Наблюдение ведётся в скрытом режиме</div>
                </div>
              </div>

              {/* Floating Camera Overlay Canvas Preview */}
              <div className="flex items-center gap-4">
                <div className="relative w-28 h-20 bg-black rounded-xl overflow-hidden border border-cyan-500/40 shadow-lg">
                  {/* Mirrors the main overlay canvas so student can see camera */}
                  <canvas
                    ref={(c) => {
                      if (c && canvasRef.current) {
                        const ctx = c.getContext("2d");
                        if (ctx) ctx.drawImage(canvasRef.current, 0, 0, c.width, c.height);
                      }
                    }}
                    width={112}
                    height={80}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-500">Вопрос</div>
                  <div className="text-lg font-bold text-white">{testFinished ? MOCK_QUESTIONS.length : currentQ + 1}/{MOCK_QUESTIONS.length}</div>
                </div>
              </div>
            </div>

            {testFinished ? (
              /* Test Results */
              <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
                <div className="text-5xl mb-4">🎉</div>
                <h2 className="text-2xl font-black mb-2">Тест завершён!</h2>
                <p className="text-slate-400 text-sm mb-6">
                  Правильных ответов: <span className="text-white font-bold">{Object.entries(testAnswers).filter(([qid, ans]) => MOCK_QUESTIONS.find(q => q.id === qid)?.correct === ans).length}</span> из {MOCK_QUESTIONS.length}
                </p>

                {/* Honesty Index */}
                <div className="inline-flex items-center gap-3 bg-slate-950/80 rounded-xl px-6 py-3 border border-slate-800 mb-6">
                  <span className="text-sm text-slate-400">Индекс честности:</span>
                  <span className={`text-3xl font-black ${engine.honestyIndex >= 80 ? "text-green-400" : engine.honestyIndex >= 50 ? "text-amber-400" : "text-red-400"}`}>
                    {engine.honestyIndex}%
                  </span>
                </div>

                {/* Detected Events */}
                {engine.events.length > 0 && (
                  <div className="mt-4 text-left max-w-md mx-auto">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Зафиксированные сработки ({engine.events.length}):</h3>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {engine.events.map((e) => (
                        <div key={e.id} className={`text-xs px-3 py-2 rounded-lg border ${severityBg(e.severity)} flex items-center gap-2`}>
                          <span>{eventTypeIcon(e.type)}</span>
                          <span className="text-slate-400 font-mono">[{formatEventTime(e.timestamp)}]</span>
                          <span className={severityColor(e.severity)}>{e.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 mt-8 justify-center">
                  <button
                    onClick={stopSession}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all"
                  >
                    ⬇ Скачать видеозапись
                  </button>
                  <button
                    onClick={() => setMode("admin")}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-sm text-slate-300 transition"
                  >
                    👨‍💼 Открыть вид менеджера
                  </button>
                </div>
              </div>
            ) : (
              /* Active Question Card */
              <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-xs px-3 py-1 rounded-full font-bold ${MOCK_QUESTIONS[currentQ].subject === "russian" ? "bg-green-500/20 text-green-400 border border-green-500/30" : MOCK_QUESTIONS[currentQ].subject === "math" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-purple-500/20 text-purple-400 border border-purple-500/30"}`}>
                    {MOCK_QUESTIONS[currentQ].subject === "russian" ? "Русский язык" : MOCK_QUESTIONS[currentQ].subject === "math" ? "Математика" : "Логика"}
                  </span>
                  <span className="text-xs text-slate-400">{MOCK_QUESTIONS[currentQ].points} балла</span>
                </div>

                <h2 className="text-xl font-bold text-white mb-6 leading-relaxed">
                  {MOCK_QUESTIONS[currentQ].text}
                </h2>

                <div className="space-y-3">
                  {MOCK_QUESTIONS[currentQ].options.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(idx)}
                      className="w-full text-left px-5 py-4 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 rounded-xl transition-all text-sm font-medium group flex items-center gap-3"
                    >
                      <span className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center group-hover:bg-cyan-500 group-hover:text-black transition">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="text-slate-200 group-hover:text-white transition">{opt}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* MODE 3: ADMIN / MANAGER MONITORING VIEW */}
      {/* ══════════════════════════════════════════════ */}
      {mode === "admin" && (
        <div className="flex flex-col lg:flex-row h-screen">
          {/* LEFT: Video Canvas + Timeline (70%) */}
          <div className="flex-1 lg:w-[70%] flex flex-col p-3 sm:p-4 gap-3">
            {/* Header */}
            <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5">
              <div className="flex items-center gap-3">
                <h1 className="text-base font-black text-white flex items-center gap-2">
                  <span>👨‍💼</span> Панель Наблюдения Менеджера
                </h1>
                <div className="flex items-center gap-1.5 bg-slate-950 rounded-full px-3 py-1 border border-slate-800">
                  <div className={`w-2 h-2 rounded-full ${isSessionActive ? "bg-green-400 animate-pulse" : "bg-slate-600"}`} />
                  <span className="text-xs text-slate-400 font-mono">{isSessionActive ? "LIVE" : "STOPPED"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMode("student")}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition"
                >
                  🎓 Вид ученика
                </button>
                {isSessionActive ? (
                  <button
                    onClick={stopSession}
                    className="px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold transition"
                  >
                    ⏹ Остановить
                  </button>
                ) : (
                  <button
                    onClick={() => startSession("admin")}
                    className="px-4 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 rounded-lg text-xs font-bold transition"
                  >
                    ▶ Запустить
                  </button>
                )}
              </div>
            </div>

            {/* Main Display Canvas */}
            <div className="flex-1 relative bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain"
              />

              {/* Honesty Index Badge */}
              <div className="absolute bottom-4 right-4 bg-slate-900/90 backdrop-blur rounded-xl px-4 py-2.5 border border-slate-700/60 shadow-xl">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Индекс честности</div>
                <div className={`text-2xl font-black ${engine.honestyIndex >= 80 ? "text-green-400" : engine.honestyIndex >= 50 ? "text-amber-400" : "text-red-400"}`}>
                  {engine.honestyIndex}%
                </div>
              </div>
            </div>

            {/* Timeline Bar */}
            <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Timeline нарушений</span>
                <span className="text-xs text-slate-400 font-mono">{formatTime(recorder.recordingDuration)}</span>
              </div>
              <div className="relative h-6 bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
                <div
                  className="absolute top-0 left-0 h-full bg-cyan-500/20 border-r border-cyan-400 transition-all"
                  style={{ width: `${Math.min(100, (recorder.recordingDuration / (90 * 60)) * 100)}%` }}
                />

                {engine.events.map((e) => {
                  const totalDur = Math.max(recorder.recordingDuration, 1) * 1000;
                  const pos = Math.min(100, (e.timestamp / totalDur) * 100);
                  return (
                    <div
                      key={e.id}
                      className="absolute top-0 h-full w-1.5 cursor-pointer group"
                      style={{ left: `${pos}%` }}
                    >
                      <div className={`w-full h-full ${e.severity === "HIGH" ? "bg-red-500" : e.severity === "MEDIUM" ? "bg-amber-500" : "bg-blue-500"}`} />
                      <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs whitespace-nowrap z-50 shadow-2xl">
                        <div className="font-mono text-slate-400">[{formatEventTime(e.timestamp)}]</div>
                        <div className={severityColor(e.severity)}>{e.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Telemetry + Simulation Panel (30%) */}
          <div className="lg:w-[30%] bg-slate-900/90 border-l border-slate-800 flex flex-col overflow-hidden">
            {/* Telemetry Gauges */}
            <div className="p-4 border-b border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">📊 Телеметрия (Real-Time)</h3>

              <div className="grid grid-cols-3 gap-2">
                <TelemetryGauge label="Yaw" value={engine.telemetry.headPose.yaw} max={60} danger={20} unit="°" />
                <TelemetryGauge label="Pitch" value={engine.telemetry.headPose.pitch} max={60} danger={45} unit="°" />
                <TelemetryGauge label="Roll" value={engine.telemetry.headPose.roll} max={45} danger={25} unit="°" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <StatusBadge
                  icon="👁"
                  label="Взгляд"
                  value={engine.telemetry.gazeDirection}
                  isWarning={engine.telemetry.gazeDirection !== "CENTER" && engine.telemetry.gazeDirection !== "DOWN"}
                />
                <StatusBadge
                  icon="✋"
                  label="Руки"
                  value={engine.telemetry.handStatus === "IN_FRAME" ? `В кадре (${engine.telemetry.handsDetected})` : engine.telemetry.handStatus === "BELOW_DESK" ? "Под столом!" : "Нет"}
                  isWarning={engine.telemetry.handStatus === "BELOW_DESK"}
                />
                <StatusBadge
                  icon="👤"
                  label="Лица"
                  value={String(engine.telemetry.facesDetected)}
                  isWarning={engine.telemetry.facesDetected > 1}
                />
                <StatusBadge
                  icon="📱"
                  label="Телефон"
                  value={engine.telemetry.phoneDetected ? "ОБНАРУЖЕН!" : "Нет"}
                  isWarning={Boolean(engine.telemetry.phoneDetected)}
                />
                <StatusBadge
                  icon="💡"
                  label="Свет"
                  value={engine.telemetry.lightAnomaly ? "Аномалия!" : "Норма"}
                  isWarning={engine.telemetry.lightAnomaly}
                />
                <StatusBadge
                  icon="🎤"
                  label="Звук / Шёпот"
                  value={engine.telemetry.audioStatus === "WHISPER" ? `ШЁПОТ (ZCR ${engine.telemetry.zeroCrossingRate})` : engine.telemetry.audioStatus === "TALKING" ? `Разговор (${engine.telemetry.audioLevel}dB)` : "Тишина"}
                  isWarning={engine.telemetry.audioStatus === "WHISPER"}
                />
                <StatusBadge
                  icon="🧠"
                  label="Смысл речи"
                  value={engine.telemetry.speechIntentCategory === "AI_PROMPT" ? "ИИ-ЗАПРОС!" : engine.telemetry.speechIntentCategory === "EXAM_HELP_REQUEST" ? "ПОДСКАЗКА!" : engine.telemetry.speechIntentCategory === "DICTATION" ? "НИКДОВКА!" : "Норма"}
                  isWarning={engine.telemetry.speechIntentCategory === "AI_PROMPT" || engine.telemetry.speechIntentCategory === "EXAM_HELP_REQUEST"}
                />
                <StatusBadge
                  icon="✌️"
                  label="Декодер жестов"
                  value={engine.telemetry.decodedGestureStream ? `Поток: ${engine.telemetry.decodedGestureStream}` : engine.telemetry.currentGesture?.label || "Нет жеста"}
                  isWarning={Boolean(engine.telemetry.currentGesture?.signaledOption)}
                />
                <StatusBadge
                  icon="👄"
                  label="Декодер губ"
                  value={engine.telemetry.isSilentLipSpeaking ? `СЛОВО: "${engine.telemetry.decodedLipWord || engine.telemetry.visemeLabel}"` : engine.telemetry.visemeLabel || "Покой"}
                  isWarning={engine.telemetry.isSilentLipSpeaking}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 font-mono pt-1">
                <span>FPS: {engine.telemetry.fps}</span>
                {engine.telemetry.isDraftWork && <span className="text-yellow-400">📝 Черновик</span>}
                {engine.telemetry.isViolating && <span className="text-red-400 animate-pulse">⚠ Нарушение</span>}
              </div>
            </div>

            {/* Test Simulation Controls */}
            <div className="p-3 border-b border-slate-800 bg-slate-950/50">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">🧪 ТЕСТОВЫЕ СИМУЛЯЦИИ</div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <button
                  onClick={() => simulateEvent("GAZE_LEFT", "MEDIUM", "Взгляд отвлёкся влево (угол 28°)")}
                  className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-300 transition text-left"
                >
                  👁 Взгляд вбок
                </button>
                <button
                  onClick={() => simulateEvent("HAND_BELOW", "MEDIUM", "Руки ушли под стол (работа с телефоном)")}
                  className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-300 transition text-left"
                >
                  🤚 Рука под столом
                </button>
                <button
                  onClick={() => simulateEvent("EXTRA_FACE", "HIGH", "Обнаружено 2 лица в кадре!")}
                  className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-300 transition text-left"
                >
                  👥 Второе лицо
                </button>
                <button
                  onClick={() => simulateEvent("LIGHT_ANOMALY", "HIGH", "Свечение от смартфона/планшета снизу")}
                  className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-300 transition text-left"
                >
                  💡 Свет телефона
                </button>
                <button
                  onClick={() => simulateEvent("SPEECH_CHEAT_DETECTED", "HIGH", "🗣 Речь/подсказка (Вероятность 90%): \"сири что во втором...\"")}
                  className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-300 transition text-left"
                >
                  🗣 Запрос ответа (90%)
                </button>
                <button
                  onClick={() => simulateEvent("GESTURE_SIGNAL_DETECTED", "HIGH", "✋ Декодер жестов: Передан сигнал \"Вариант B\" (✌️ 2 пальца)")}
                  className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-300 transition text-left"
                >
                  ✌️ Декодер жеста (Вариант B)
                </button>
                <button
                  onClick={() => simulateEvent("SILENT_LIP_SPEAKING_DETECTED", "HIGH", "👄 Чтение по губам (Распознано слово): \"ВТОРОЙ (Вариант Б)\" (92% уверенность)")}
                  className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-300 transition text-left"
                >
                  👄 Чтение губ ("ВТОРОЙ (Б)")
                </button>
                <button
                  onClick={() => simulateEvent("TAB_SWITCH", "HIGH", "Пользователь сменил вкладку браузера")}
                  className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-300 transition text-left"
                >
                  🔀 Смена вкладки
                </button>
              </div>
            </div>

            {/* Scrollable Event Log */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-3 pb-1 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">📋 Журнал событий ({engine.events.length})</h3>
              </div>

              <div ref={eventLogRef} className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
                {engine.events.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">Нет зафиксированных нарушений 🟢</div>
                ) : (
                  engine.events.map((e) => (
                    <div key={e.id} className={`text-xs p-2.5 rounded-lg border ${severityBg(e.severity)}`}>
                      <div className="flex items-center gap-2">
                        <span>{eventTypeIcon(e.type)}</span>
                        <span className="font-mono text-slate-400">[{formatEventTime(e.timestamp)}]</span>
                        <span className={`font-bold ${severityColor(e.severity)}`}>{eventTypeLabel(e.type)}</span>
                      </div>
                      <div className="text-slate-300 mt-1 pl-6 text-[11px] leading-tight">{e.description}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Download controls */}
            <div className="p-3 border-t border-slate-800 space-y-2">
              <button
                onClick={stopSession}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl text-xs font-bold text-white transition-all shadow-lg shadow-cyan-500/20"
              >
                ⬇ Остановить и скачать видеозапись
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SUB-COMPONENTS ──

function TelemetryGauge({ label, value, max, danger, unit }: { label: string; value: number; max: number; danger: number; unit: string }) {
  const absVal = Math.abs(value);
  const pct = Math.min(100, (absVal / max) * 100);
  const isDanger = absVal > danger;

  return (
    <div className="bg-slate-950/80 rounded-lg p-2 text-center border border-slate-800">
      <div className="text-[10px] text-slate-400 uppercase font-mono">{label}</div>
      <div className={`text-xs font-bold font-mono ${isDanger ? "text-red-400" : "text-slate-200"}`}>
        {value.toFixed(1)}{unit}
      </div>
      <div className="mt-1 h-1 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isDanger ? "bg-red-500" : "bg-cyan-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ icon, label, value, isWarning }: { icon: string; label: string; value: string; isWarning: boolean }) {
  return (
    <div className={`rounded-lg p-2 border text-center transition-colors ${isWarning ? "bg-red-500/10 border-red-500/40 text-red-300" : "bg-slate-950/80 border-slate-800 text-slate-300"}`}>
      <div className="text-xs mb-0.5">{icon}</div>
      <div className="text-[9px] text-slate-400 uppercase font-mono">{label}</div>
      <div className={`text-[11px] font-bold ${isWarning ? "text-red-400" : "text-slate-200"}`}>{value}</div>
    </div>
  );
}
