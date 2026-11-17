import React, { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Modal } from "../journals/components/ui";

/**
 * Сканер внутри кабинета. Камера телефона открывает QR в браузере по
 * умолчанию — а сотрудник мог войти в другом. Здесь скан всегда идёт от
 * имени вошедшего сотрудника: QR с любой бумаги поступающего открывает его
 * карточку на нужной вкладке.
 */
const TOKEN = /\/a\/([\w-]{20,60})(?:\?s=([\w-]{1,40}))?/;

export default function QrScanModal({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const [state, setState] = useState<"starting" | "on" | "denied">("starting");
  const [seen, setSeen] = useState<string | null>(null);

  const loop = useCallback(() => {
    const v = videoRef.current, c = canvasRef.current;
    if (v && c && v.readyState >= 2) {
      const k = Math.min(1, 480 / v.videoWidth);
      c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (ctx && c.width) {
        ctx.drawImage(v, 0, 0, c.width, c.height);
        const code = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: "dontInvert" });
        const m = code?.data.match(TOKEN);
        if (m) { setSeen(m[1]); window.location.href = `/a/${m[1]}${m[2] ? `?s=${m[2]}` : ""}`; return; }
        if (code?.data) setSeen("other");
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) { setState("denied"); return; }
        streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
        setState("on");
      } catch { setState("denied"); }
    })();
    return () => { cancelAnimationFrame(rafRef.current); streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);
  useEffect(() => {
    if (state !== "on" || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => {});
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state, loop]);

  return (
    <Modal title="Сканировать QR поступающего" onClose={onClose}>
      {state === "denied" ? <p className="text-sm text-rose-600">Нет доступа к камере. Разрешите камеру для сайта в настройках браузера.</p> : (
        <div className="space-y-2">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
            <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-[18%] border-2 border-white/80 rounded-2xl pointer-events-none" />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <p className="text-sm text-[var(--text-muted)] text-center">{seen === "other" ? "Это не QR поступающего" : seen ? "Открываем…" : "Наведите на QR с направления, анкеты или листа"}</p>
        </div>
      )}
    </Modal>
  );
}
