import { useCallback, useEffect, useRef, useState } from "react";

import jsQR from "jsqr";
import { QrCode, Camera, CameraOff, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { auth } from "../../../lib/firebase";

/**
 * Проверка билетов на входе.
 *
 * Волонтёр — сотрудник организации: входит в свой аккаунт, открывает эту
 * страницу, наводит камеру на QR гостя. Дальше всё автоматически: код
 * распознаётся, сервер отмечает вход, экран вспыхивает зелёной рамкой с
 * именем гостя — или красной, если по билету уже входили. Никаких алертов
 * и лишних тапов: у двери очередь, руки заняты телефоном.
 *
 * Распознавание — jsQR по кадрам с камеры: нативный BarcodeDetector есть не
 * во всех браузерах (Safari — нет), а волонтёры приходят с любыми телефонами.
 */

type ScanOutcome = {
  result: "ok" | "already" | "inactive" | "notticket" | "error";
  guest?: { name: string; status?: string; statusLabel?: string; checkedInAt?: any };
  formTitle?: string;
  error?: string;
};

const fmtTime = (t: any): string => {
  const ms = t?._seconds ? t._seconds * 1000 : t?.seconds ? t.seconds * 1000 : NaN;
  return Number.isFinite(ms)
    ? new Date(ms).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : "";
};

/** Код билета из содержимого QR: полный URL /track/XXX или голый код. */
function extractToken(raw: string): string | null {
  const m = raw.match(/\/track\/([A-Za-z0-9]{6,20})/);
  if (m) return m[1].toUpperCase();
  if (/^[A-Za-z0-9]{6,20}$/.test(raw.trim())) return raw.trim().toUpperCase();
  return null;
}

export default function TicketScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  // Один и тот же QR в кадре десятки раз в секунду — глушим повторы,
  // пока волонтёр не наведётся на следующего гостя.
  const recentRef = useRef<Map<string, number>>(new Map());
  const busyRef = useRef(false);

  const [cameraState, setCameraState] = useState<"idle" | "on" | "denied">("idle");
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [checkedCount, setCheckedCount] = useState(0);
  const outcomeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showOutcome = (o: ScanOutcome) => {
    setOutcome(o);
    if (outcomeTimer.current) clearTimeout(outcomeTimer.current);
    // Красные исходы висят дольше: их волонтёр должен успеть прочитать,
    // зелёный — только подтвердить взглядом.
    outcomeTimer.current = setTimeout(() => setOutcome(null), o.result === "ok" ? 2500 : 5000);
    if (navigator.vibrate) navigator.vibrate(o.result === "ok" ? 80 : [120, 80, 120]);
  };

  const handleToken = useCallback(async (token: string) => {
    const now = Date.now();
    const last = recentRef.current.get(token) || 0;
    if (now - last < 6000 || busyRef.current) return;
    recentRef.current.set(token, now);
    busyRef.current = true;
    try {
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : "";
      const res = await fetch("/api/forms/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ token }),
      });
      const j = await res.json();
      if (!j.success) {
        showOutcome({ result: "error", error: j.error || "Билет не найден" });
        return;
      }
      showOutcome(j);
      if (j.result === "ok") setCheckedCount(c => c + 1);
    } catch {
      showOutcome({ result: "error", error: "Нет связи с сервером" });
    } finally { busyRef.current = false; }
  }, []);

  const scanLoop = useCallback(() => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (video && canvas && video.readyState >= 2) {
      // Кадр уменьшается до 480px по ширине: jsQR на полном 1080p-кадре
      // съедает CPU слабого телефона, а кода в четверть экрана хватает.
      const scale = Math.min(1, 480 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx && canvas.width > 0) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (code?.data) {
          const token = extractToken(code.data);
          if (token) void handleToken(token);
        }
      }
    }
    rafRef.current = requestAnimationFrame(scanLoop);
  }, [handleToken]);

  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) { setCameraState("denied"); return; }
      // Задняя камера: волонтёр наводит телефон на чужой экран.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      // srcObject нельзя присвоить здесь: <video> рендерится только в
      // состоянии "on", и в этот момент videoRef ещё пуст — поток утекал в
      // никуда, сканер смотрел в чёрный экран. Подключение — в эффекте ниже,
      // когда элемент уже существует.
      setCameraState("on");
    } catch {
      setCameraState("denied");
    }
  }, []);

  useEffect(() => {
    if (cameraState !== "on" || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => {});
    rafRef.current = requestAnimationFrame(scanLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cameraState, scanLoop]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (outcomeTimer.current) clearTimeout(outcomeTimer.current);
  }, []);

  const frameColor = !outcome ? "border-transparent"
    : outcome.result === "ok" ? "border-emerald-500"
    : "border-red-500";

  return (
    <div className="max-w-2xl mx-auto space-y-4 text-[var(--text-main)]">
      <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <QrCode className="w-6 h-6 text-emerald-500" />
            Проверка билетов
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Наведите камеру на QR-код гостя — вход отметится автоматически
          </p>
        </div>
        {checkedCount > 0 && (
          <div className="text-right">
            <div className="text-2xl font-bold text-emerald-500 tabular-nums">{checkedCount}</div>
            <div className="text-[10px] uppercase font-mono text-[var(--text-muted)]">пропущено</div>
          </div>
        )}
      </div>

      {/* Организация сканеру не нужна: сервер определяет её по самому билету
          и сверяет с членством сканирующего. Страница работает сразу. */}
      {cameraState === "idle" ? (
        <button onClick={() => void startCamera()}
          className="w-full py-16 rounded-2xl border-2 border-dashed border-[var(--border-color)] hover:border-emerald-500/50 transition flex flex-col items-center gap-3 cursor-pointer">
          <Camera className="w-12 h-12 text-emerald-500" />
          <span className="font-bold">Включить камеру</span>
          <span className="text-xs text-[var(--text-muted)]">Браузер спросит разрешение</span>
        </button>
      ) : cameraState === "denied" ? (
        <div className="py-16 rounded-2xl border border-red-500/30 bg-red-500/5 flex flex-col items-center gap-3 text-center px-6">
          <CameraOff className="w-12 h-12 text-red-500" />
          <span className="font-bold">Камера недоступна</span>
          <span className="text-xs text-[var(--text-muted)]">
            Разрешите доступ к камере в настройках браузера и обновите страницу.
          </span>
        </div>
      ) : (
        <div className={`relative rounded-2xl overflow-hidden border-8 transition-colors duration-200 ${frameColor} bg-black`}>
          <video ref={videoRef} playsInline muted className="w-full max-h-[70vh] object-cover" />
          <canvas ref={canvasRef} className="hidden" />

          {/* Прицел — чтобы волонтёр понимал, куда наводить. */}
          {!outcome && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-52 h-52 border-2 border-white/60 rounded-2xl" />
            </div>
          )}

          {/* Исход — поверх видео, крупно; сканирование не останавливается. */}
          {outcome && (
            <div className="absolute inset-x-0 bottom-0 p-4">
              {outcome.result === "ok" && (
                <div className="bg-emerald-600 text-white rounded-2xl p-4 flex items-center gap-3 shadow-2xl">
                  <CheckCircle2 className="w-10 h-10 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-extrabold text-lg truncate">{outcome.guest?.name}</div>
                    <div className="text-sm opacity-90">Проходит ✓</div>
                  </div>
                </div>
              )}
              {outcome.result === "already" && (
                <div className="bg-red-600 text-white rounded-2xl p-4 flex items-center gap-3 shadow-2xl">
                  <XCircle className="w-10 h-10 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-extrabold text-lg truncate">{outcome.guest?.name}</div>
                    <div className="text-sm font-bold">
                      УЖЕ ВХОДИЛ{outcome.guest?.checkedInAt ? ` в ${fmtTime(outcome.guest.checkedInAt)}` : ""} — не пускать
                    </div>
                  </div>
                </div>
              )}
              {outcome.result === "inactive" && (
                <div className="bg-amber-500 text-black rounded-2xl p-4 flex items-center gap-3 shadow-2xl">
                  <XCircle className="w-10 h-10 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-extrabold text-lg truncate">{outcome.guest?.name}</div>
                    <div className="text-sm font-bold">
                      Билет не активен: {outcome.guest?.statusLabel || "не одобрен"}
                    </div>
                  </div>
                </div>
              )}
              {outcome.result === "notticket" && (
                <div className="bg-slate-700 text-white rounded-2xl p-4 text-center font-bold shadow-2xl">
                  Это не билет — QR от другой заявки
                </div>
              )}
              {outcome.result === "error" && (
                <div className="bg-slate-700 text-white rounded-2xl p-4 text-center font-bold shadow-2xl">
                  {outcome.error}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-[var(--text-muted)] text-center">
        Повторный скан того же билета показывает «уже входил» — гостя с чужим
        скриншотом система не пропустит.
      </p>
    </div>
  );
}
