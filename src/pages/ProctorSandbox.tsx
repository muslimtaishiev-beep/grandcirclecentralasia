import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { useProctoringEngine, ProctoringEvent } from "../lib/useProctoringEngine";
import { useCompositeRecorder } from "../lib/useCompositeRecorder";
import { useAnswerTiming } from "../lib/useAnswerTiming";

const ProctoringOverlay = lazy(() => import("../components/ProctoringOverlay"));

// ─── Mock test questions for the sandbox prototype ───
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
    case "PASTE_DETECTED": return "Вставка текста";
    case "TAB_SWITCH": return "Смена вкладки";
    case "FACE_LOST": return "Лицо потеряно";
    default: return type;
  }
}

// ─── MAIN COMPONENT ───
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

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const eventLogRef = useRef<HTMLDivElement | null>(null);

  // Hooks
  const engine = useProctoringEngine(videoRef, canvasRef, isSessionActive);
  const recorder = useCompositeRecorder(canvasRef);
  const timing = useAnswerTiming();

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
  }, [isSessionActive]);

  // Convert paste events to proctoring events
  useEffect(() => {
    if (timing.pasteEvents.length > 0) {
      const latest = timing.pasteEvents[timing.pasteEvents.length - 1];
      engine.addEvent({
        type: "PASTE_DETECTED",
        severity: "HIGH",
        description: `Clipboard paste detected (${latest.textLength} chars)`,
      });
    }
  }, [timing.pasteEvents.length]);

  // ─── Camera Init ───
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
          ? "Доступ к камере запрещён. Разрешите камеру в настройках браузера."
          : "Не удалось подключить камеру: " + err.message
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

  // ─── Session Start ───
  const startSession = useCallback(
    (selectedMode: "student" | "admin") => {
      setMode(selectedMode);
      setIsSessionActive(true);
      setCurrentQ(0);
      setTestAnswers({});
      setTestFinished(false);

      // Start recording with audio
      if (audioStream) {
        recorder.startRecording(audioStream);
      } else {
        recorder.startRecording();
      }

      // Start timer for first question
      if (selectedMode === "student") {
        const q = MOCK_QUESTIONS[0];
        timing.startQuestionTimer(q.id, (q.points || 1) * 45);
      }
    },
    [audioStream, recorder, timing]
  );

  // ─── Answer a question ───
  const handleAnswer = useCallback(
    (optionIdx: number) => {
      const q = MOCK_QUESTIONS[currentQ];
      const result = timing.recordAnswer(q.id);

      if (result.suspicious) {
        engine.addEvent({
          type: "FAST_ANSWER",
          severity: result.severity || "MEDIUM",
          description: `Ответ за ${(result.actualTime || 0).toFixed(1)}с (ожидалось ${(result.expectedTime || 0).toFixed(0)}с)`,
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

  // ─── Stop Session ───
  const stopSession = useCallback(async () => {
    setIsSessionActive(false);
    const blob = await recorder.stopRecording();
    if (blob) {
      recorder.downloadRecording(`proctoring_sandbox_${Date.now()}`);
    }
  }, [recorder]);

  // ══════════════════════════════════════════════
  // RENDER: Setup Screen
  // ══════════════════════════════════════════════
  if (mode === "setup") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-white select-none">
        {/* Hidden video for camera init */}
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />

        <div className="w-full max-w-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-4 py-1.5 mb-4">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-cyan-300 text-xs font-mono uppercase tracking-widest">Sandbox Mode</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              AI <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Proctoring</span>
            </h1>
            <p className="text-slate-400 mt-2 text-sm max-w-md mx-auto">
              Система визуального наблюдения с ML-анализом лица, рук, взгляда и скорости ответов. Полностью работает в браузере.
            </p>
          </div>

          {/* Camera Card */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">📹 Камера и микрофон</h2>
              {cameraReady && <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded-full px-3 py-1">✓ Подключено</span>}
            </div>

            {!cameraReady && !cameraError && (
              <button
                onClick={initCamera}
                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-cyan-500/20"
              >
                Разрешить доступ к камере
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
              <div className="text-sm text-slate-400 space-y-1">
                <p>✓ Видеопоток: {videoRef.current?.videoWidth}×{videoRef.current?.videoHeight}</p>
                <p>✓ Аудио: активен</p>
                <p className="text-xs text-slate-500 mt-2">
                  {engine.isLoading ? `⏳ ${engine.loadingProgress}` : engine.isReady ? "✓ ML-модели загружены" : engine.error ? `❌ ${engine.error}` : ""}
                </p>
              </div>
            )}
          </div>

          {/* Mode Selection */}
          {cameraReady && engine.isReady && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => startSession("student")}
                className="group bg-slate-800/50 backdrop-blur border border-slate-700/50 hover:border-cyan-500/50 rounded-2xl p-5 text-left transition-all hover:bg-slate-800/70"
              >
                <div className="text-2xl mb-2">🎓</div>
                <h3 className="text-white font-bold text-lg group-hover:text-cyan-300 transition">Режим ученика</h3>
                <p className="text-slate-400 text-xs mt-1">Пройдите мок-тест из 8 вопросов с активным прокторингом</p>
              </button>
              <button
                onClick={() => startSession("admin")}
                className="group bg-slate-800/50 backdrop-blur border border-slate-700/50 hover:border-blue-500/50 rounded-2xl p-5 text-left transition-all hover:bg-slate-800/70"
              >
                <div className="text-2xl mb-2">👨‍💼</div>
                <h3 className="text-white font-bold text-lg group-hover:text-blue-300 transition">Режим менеджера</h3>
                <p className="text-slate-400 text-xs mt-1">Мониторинг в реальном времени с полной телеметрией и логом</p>
              </button>
            </div>
          )}

          {cameraReady && engine.isLoading && (
            <div className="text-center py-6">
              <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-400 text-sm">{engine.loadingProgress}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // RENDER: Student Test Mode
  // ══════════════════════════════════════════════
  if (mode === "student") {
    const q = MOCK_QUESTIONS[currentQ];

    return (
      <div className="min-h-screen bg-slate-950 text-white select-none">
        {/* Canvas overlay (renders on the hidden canvas) */}
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
          />
        </Suspense>

        {/* Hidden elements */}
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />

        <div className="max-w-3xl mx-auto p-4 sm:p-8">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-slate-400 font-mono">PROCTORING ACTIVE</span>
            </div>
            <div className="flex items-center gap-4">
              {/* Small camera preview */}
              <div className="relative w-16 h-12 rounded-lg overflow-hidden border border-slate-700/50 shadow-lg">
                <video
                  ref={(el) => {
                    if (el && mediaStreamRef.current) {
                      el.srcObject = mediaStreamRef.current;
                      el.play().catch(() => {});
                    }
                  }}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                <div className="absolute bottom-0 right-0 w-2 h-2 bg-red-500 rounded-full m-0.5 animate-pulse" />
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Вопрос</div>
                <div className="text-lg font-bold">{testFinished ? MOCK_QUESTIONS.length : currentQ + 1}/{MOCK_QUESTIONS.length}</div>
              </div>
            </div>
          </div>

          {testFinished ? (
            // ─── Results ───
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 text-center">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-2xl font-black mb-2">Тест завершён!</h2>
              <p className="text-slate-400 text-sm mb-6">
                Правильных ответов: {Object.entries(testAnswers).filter(([qid, ans]) => MOCK_QUESTIONS.find(q => q.id === qid)?.correct === ans).length} из {MOCK_QUESTIONS.length}
              </p>

              {/* Honesty Index */}
              <div className="inline-flex items-center gap-3 bg-slate-900/50 rounded-xl px-6 py-3 mb-6">
                <span className="text-sm text-slate-400">Индекс честности:</span>
                <span className={`text-2xl font-black ${engine.honestyIndex >= 80 ? "text-green-400" : engine.honestyIndex >= 50 ? "text-amber-400" : "text-red-400"}`}>
                  {engine.honestyIndex}%
                </span>
              </div>

              {/* Events summary */}
              {engine.events.length > 0 && (
                <div className="mt-4 text-left">
                  <h3 className="text-sm font-bold text-slate-300 mb-2">Зафиксированные сработки ({engine.events.length}):</h3>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {engine.events.map(e => (
                      <div key={e.id} className={`text-xs px-3 py-1.5 rounded-lg border ${severityBg(e.severity)} flex items-center gap-2`}>
                        <span>{eventTypeIcon(e.type)}</span>
                        <span className="text-slate-400 font-mono">[{formatEventTime(e.timestamp)}]</span>
                        <span className={severityColor(e.severity)}>{e.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6 justify-center">
                <button
                  onClick={stopSession}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl font-bold text-sm hover:from-cyan-500 hover:to-blue-500 transition-all"
                >
                  ⬇ Скачать запись и выйти
                </button>
                <button
                  onClick={() => { setMode("admin"); }}
                  className="px-6 py-3 bg-slate-700/50 rounded-xl font-bold text-sm hover:bg-slate-700 transition"
                >
                  👨‍💼 Переключить на вид менеджера
                </button>
              </div>
            </div>
          ) : (
            // ─── Active Question ───
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 sm:p-8">
              {/* Subject badge */}
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${q.subject === "russian" ? "bg-green-500/20 text-green-400" : q.subject === "math" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"}`}>
                  {q.subject === "russian" ? "Русский" : q.subject === "math" ? "Математика" : "Логика"}
                </span>
                <span className="text-xs text-slate-500">{q.points} {q.points === 1 ? "балл" : q.points < 5 ? "балла" : "баллов"}</span>
              </div>

              <h2 className="text-xl font-bold mb-6">{q.text}</h2>

              <div className="space-y-3">
                {q.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    className="w-full text-left px-5 py-3.5 bg-slate-900/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-cyan-500/40 rounded-xl transition-all text-sm font-medium group"
                  >
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-700/50 text-xs font-bold mr-3 group-hover:bg-cyan-500/30 group-hover:text-cyan-300 transition">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // RENDER: Admin / Manager Monitoring Mode
  // ══════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-950 text-white select-none">
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
        />
      </Suspense>

      {/* Hidden video source */}
      <video ref={videoRef} className="hidden" playsInline muted />

      <div className="flex flex-col lg:flex-row h-screen">
        {/* LEFT: Video + Canvas (70%) */}
        <div className="flex-1 lg:w-[70%] flex flex-col p-3 sm:p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-black">👨‍💼 Панель наблюдения</h1>
              <div className="flex items-center gap-1.5 bg-slate-800/80 rounded-full px-3 py-1">
                <div className={`w-2 h-2 rounded-full ${isSessionActive ? "bg-green-400 animate-pulse" : "bg-slate-600"}`} />
                <span className="text-xs text-slate-400">{isSessionActive ? "LIVE" : "STOPPED"}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSessionActive ? (
                <button
                  onClick={stopSession}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold transition"
                >
                  ⏹ Остановить
                </button>
              ) : (
                <button
                  onClick={() => startSession("admin")}
                  className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 rounded-lg text-xs font-bold transition"
                >
                  ▶ Запустить
                </button>
              )}
            </div>
          </div>

          {/* Canvas Display (shows the composite video + overlay) */}
          <div className="flex-1 relative bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
            <canvas
              ref={canvasRef}
              className="w-full h-full object-contain"
            />

            {/* Honesty Index Badge */}
            <div className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur rounded-xl px-4 py-2 border border-slate-700/50">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Индекс честности</div>
              <div className={`text-2xl font-black ${engine.honestyIndex >= 80 ? "text-green-400" : engine.honestyIndex >= 50 ? "text-amber-400" : "text-red-400"}`}>
                {engine.honestyIndex}%
              </div>
            </div>
          </div>

          {/* Timeline Bar */}
          <div className="mt-3 bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Timeline событий</span>
              <span className="text-xs text-slate-400 font-mono">{formatTime(recorder.recordingDuration)}</span>
            </div>
            <div className="relative h-6 bg-slate-900/50 rounded-full overflow-hidden">
              {/* Progress bar */}
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-full"
                style={{ width: `${Math.min(100, (recorder.recordingDuration / (90 * 60)) * 100)}%` }}
              />

              {/* Event markers */}
              {engine.events.map((e) => {
                const totalDuration = Math.max(recorder.recordingDuration, 1) * 1000;
                const pos = Math.min(100, (e.timestamp / totalDuration) * 100);
                return (
                  <div
                    key={e.id}
                    className="absolute top-0 h-full w-1 cursor-pointer group"
                    style={{ left: `${pos}%` }}
                    title={`[${formatEventTime(e.timestamp)}] ${e.description}`}
                  >
                    <div
                      className={`w-1.5 h-full rounded-full ${
                        e.severity === "HIGH" ? "bg-red-500" : e.severity === "MEDIUM" ? "bg-amber-500" : "bg-blue-500"
                      }`}
                    />
                    {/* Tooltip on hover */}
                    <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs whitespace-nowrap z-50 shadow-xl">
                      <div className="font-mono text-slate-400">[{formatEventTime(e.timestamp)}]</div>
                      <div className={severityColor(e.severity)}>{e.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: Telemetry Panel (30%) */}
        <div className="lg:w-[30%] bg-slate-900/50 border-l border-slate-800/50 flex flex-col overflow-hidden">
          {/* Telemetry Gauges */}
          <div className="p-4 border-b border-slate-800/50 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">📊 Телеметрия</h3>

            {/* Head Pose */}
            <div className="grid grid-cols-3 gap-2">
              <TelemetryGauge label="Yaw" value={engine.telemetry.headPose.yaw} max={60} danger={25} unit="°" />
              <TelemetryGauge label="Pitch" value={engine.telemetry.headPose.pitch} max={60} danger={50} unit="°" />
              <TelemetryGauge label="Roll" value={engine.telemetry.headPose.roll} max={45} danger={30} unit="°" />
            </div>

            {/* Status indicators */}
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
                value={engine.telemetry.handStatus === "IN_FRAME" ? `В кадре (${engine.telemetry.handsDetected})` : engine.telemetry.handStatus === "BELOW_DESK" ? "Под столом" : "Нет"}
                isWarning={engine.telemetry.handStatus === "BELOW_DESK"}
              />
              <StatusBadge
                icon="👤"
                label="Лица"
                value={String(engine.telemetry.facesDetected)}
                isWarning={engine.telemetry.facesDetected > 1}
              />
              <StatusBadge
                icon="💡"
                label="Свет"
                value={engine.telemetry.lightAnomaly ? "Аномалия!" : "Норма"}
                isWarning={engine.telemetry.lightAnomaly}
              />
            </div>

            {/* FPS & Draft indicator */}
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>FPS: {engine.telemetry.fps}</span>
              {engine.telemetry.isDraftWork && (
                <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded px-2 py-0.5">📝 Черновик</span>
              )}
              {engine.telemetry.isViolating && (
                <span className="bg-red-500/10 text-red-400 border border-red-500/30 rounded px-2 py-0.5 animate-pulse">⚠ Нарушение</span>
              )}
            </div>
          </div>

          {/* Event Log */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 pb-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">📋 Лог событий ({engine.events.length})</h3>
            </div>

            <div ref={eventLogRef} className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
              {engine.events.length === 0 ? (
                <div className="text-center py-8 text-slate-600 text-xs">Нет событий — всё чисто 🟢</div>
              ) : (
                engine.events.map((e) => (
                  <div
                    key={e.id}
                    className={`text-xs px-3 py-2 rounded-lg border transition-all ${severityBg(e.severity)}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{eventTypeIcon(e.type)}</span>
                      <span className="font-mono text-slate-500">[{formatEventTime(e.timestamp)}]</span>
                      <span className={`font-bold ${severityColor(e.severity)}`}>{eventTypeLabel(e.type)}</span>
                    </div>
                    <div className="text-slate-400 mt-0.5 pl-7">{e.description}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recording controls footer */}
          <div className="p-4 border-t border-slate-800/50 space-y-2">
            {recorder.isRecording && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span>Запись: {formatTime(recorder.recordingDuration)}</span>
              </div>
            )}
            <button
              onClick={stopSession}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl text-sm font-bold transition-all"
            >
              ⬇ Остановить и скачать запись
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───

function TelemetryGauge({ label, value, max, danger, unit }: { label: string; value: number; max: number; danger: number; unit: string }) {
  const absVal = Math.abs(value);
  const pct = Math.min(100, (absVal / max) * 100);
  const isDanger = absVal > danger;

  return (
    <div className="bg-slate-800/50 rounded-lg p-2 text-center">
      <div className="text-[10px] text-slate-500 uppercase mb-1">{label}</div>
      <div className={`text-sm font-bold font-mono ${isDanger ? "text-red-400" : "text-slate-300"}`}>
        {value.toFixed(1)}{unit}
      </div>
      <div className="mt-1 h-1 bg-slate-700/50 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isDanger ? "bg-red-500" : "bg-cyan-500/60"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ icon, label, value, isWarning }: { icon: string; label: string; value: string; isWarning: boolean }) {
  return (
    <div className={`rounded-lg p-2 border text-center transition-colors ${isWarning ? "bg-red-500/10 border-red-500/30" : "bg-slate-800/50 border-slate-700/30"}`}>
      <div className="text-sm mb-0.5">{icon}</div>
      <div className="text-[10px] text-slate-500 uppercase">{label}</div>
      <div className={`text-xs font-bold ${isWarning ? "text-red-400" : "text-slate-300"}`}>{value}</div>
    </div>
  );
}
