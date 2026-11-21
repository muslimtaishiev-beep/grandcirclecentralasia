import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Loader2, RotateCw } from "lucide-react";
import { Button } from "../ui";
import { DIGITIZE_LIMITS } from "../../shared/digitize";
import { canvasToJpeg, detectPageQuad, loadBitmap, rotate90, warpQuad } from "../../lib/docScan";
import type { Pt, Quad } from "../../lib/docScan";

/** Обрезанная и выровненная страница. */
export interface CroppedPage {
  /** Для распознавания: до DIGITIZE_LIMITS.recognizeMaxSide px, JPEG, длина ≤ DIGITIZE_LIMITS.maxRecognizeImage. */
  recognize: string;
  /** Для хранения и превью: до DIGITIZE_LIMITS.storeMaxSide px, ≤ DIGITIZE_LIMITS.storeMaxBytes. */
  store: string;
}

export interface PageCropperProps {
  file: File;
  onDone: (page: CroppedPage) => void;
  onCancel: () => void;
}

type Source = ImageBitmap | HTMLCanvasElement;
type Stage = "loading" | "corners" | "working" | "preview";

interface Size { w: number; h: number }

const PREVIEW_SIDE = 1600;
const MAG_SIZE = 100;
const HANDLE_R = 9;
const HIT_R = 24;
const PAD = 22;

function releaseSource(s: Source | null): void {
  if (!s) return;
  if (s instanceof HTMLCanvasElement) { s.width = 1; s.height = 1; } else s.close();
}

/** Уступаем браузеру кадр, чтобы успел отрисоваться индикатор. */
function nextPaint(): Promise<void> {
  return new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
}

function fullQuad(w: number, h: number): Quad {
  return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
}

function errText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export default function PageCropper({ file, onDone, onCancel }: PageCropperProps) {
  const [stage, setStage] = useState<Stage>("loading");
  const [error, setError] = useState("");
  const [srcSize, setSrcSize] = useState<Size>({ w: 0, h: 0 });
  const [quad, setQuad] = useState<Quad | null>(null);
  const [area, setArea] = useState<Size>({ w: 0, h: 0 });
  const [drag, setDrag] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const srcRef = useRef<Source | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const warpedRef = useRef<HTMLCanvasElement | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const shownRef = useRef<HTMLCanvasElement | null>(null);
  const magRef = useRef<HTMLCanvasElement | null>(null);
  const resultRef = useRef<HTMLCanvasElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Размер доступной области
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stage]);

  const buildPreview = useCallback((src: Source) => {
    const k = Math.min(1, PREVIEW_SIDE / Math.max(src.width, src.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(src.width * k));
    c.height = Math.max(1, Math.round(src.height * k));
    c.getContext("2d")?.drawImage(src, 0, 0, c.width, c.height);
    if (previewRef.current) { previewRef.current.width = 1; previewRef.current.height = 1; }
    previewRef.current = c;
  }, []);

  const setSource = useCallback(async (src: Source) => {
    if (srcRef.current && srcRef.current !== src) releaseSource(srcRef.current);
    srcRef.current = src;
    buildPreview(src);
    setSrcSize({ w: src.width, h: src.height });
    await nextPaint();
    setQuad(detectPageQuad(src));
    setStage("corners");
  }, [buildPreview]);

  // Загрузка файла
  useEffect(() => {
    let cancelled = false;
    setStage("loading");
    setError("");
    (async () => {
      try {
        await nextPaint();
        const bmp = await loadBitmap(file);
        if (cancelled) { bmp.close(); return; }
        await setSource(bmp);
      } catch (e) {
        if (!cancelled) { setError(errText(e, "Не удалось открыть фото.")); setStage("corners"); }
      }
    })();
    return () => { cancelled = true; };
  }, [file, setSource]);

  // Освобождение всего при закрытии
  useEffect(() => () => {
    releaseSource(srcRef.current); srcRef.current = null;
    if (previewRef.current) { previewRef.current.width = 1; previewRef.current.height = 1; previewRef.current = null; }
    if (warpedRef.current) { warpedRef.current.width = 1; warpedRef.current.height = 1; warpedRef.current = null; }
  }, []);

  // Размер изображения на экране
  const avail: Size = { w: Math.max(0, area.w - PAD * 2), h: Math.max(0, area.h - PAD * 2) };
  const fit = srcSize.w > 0 && avail.w > 0 && avail.h > 0 ? Math.min(avail.w / srcSize.w, avail.h / srcSize.h) : 0;
  const dispW = Math.round(srcSize.w * fit);
  const dispH = Math.round(srcSize.h * fit);

  // Отрисовка картинки на экране (этап 1)
  useEffect(() => {
    const c = shownRef.current, p = previewRef.current;
    if (stage !== "corners" || !c || !p || dispW === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(dispW * dpr);
    c.height = Math.round(dispH * dpr);
    c.getContext("2d")?.drawImage(p, 0, 0, c.width, c.height);
  }, [stage, dispW, dispH, srcSize]);

  // Превью выровненной страницы (этап 2)
  useEffect(() => {
    const c = resultRef.current, w = warpedRef.current;
    if (stage !== "preview" || !c || !w) return;
    c.width = w.width; c.height = w.height;
    c.getContext("2d")?.drawImage(w, 0, 0);
  }, [stage]);

  const toDisp = (p: Pt): Pt => ({ x: p.x * fit, y: p.y * fit });

  // Лупа
  useEffect(() => {
    const m = magRef.current, p = previewRef.current;
    if (drag === null || !quad || !m || !p || fit === 0) return;
    const g = m.getContext("2d");
    if (!g) return;
    const pk = p.width / srcSize.w;
    const cx = quad[drag].x * pk, cy = quad[drag].y * pk;
    const half = MAG_SIZE / 4 / Math.max(fit, 0.0001) * pk; // область 50 экранных px → 2x
    g.fillStyle = "#fff";
    g.fillRect(0, 0, m.width, m.height);
    g.drawImage(p, cx - half, cy - half, half * 2, half * 2, 0, 0, m.width, m.height);
    g.strokeStyle = "rgba(244,63,94,0.9)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(m.width / 2, m.height / 2 - 8); g.lineTo(m.width / 2, m.height / 2 + 8);
    g.moveTo(m.width / 2 - 8, m.height / 2); g.lineTo(m.width / 2 + 8, m.height / 2);
    g.stroke();
  }, [drag, quad, fit, srcSize.w]);

  const moveCorner = (i: number, e: React.PointerEvent<SVGElement>) => {
    const svg = svgRef.current;
    if (!svg || !quad || fit === 0) return;
    const r = svg.getBoundingClientRect();
    const x = Math.min(srcSize.w, Math.max(0, (e.clientX - r.left) / fit));
    const y = Math.min(srcSize.h, Math.max(0, (e.clientY - r.top) / fit));
    setQuad((q) => {
      if (!q) return q;
      const n = [...q] as Quad;
      n[i] = { x, y };
      return n;
    });
  };

  const onRotate = async () => {
    const src = srcRef.current;
    if (!src || busy) return;
    setBusy(true); setError(""); setStage("working");
    try {
      await nextPaint();
      await setSource(rotate90(src));
    } catch (e) {
      setError(errText(e, "Не удалось повернуть фото."));
      setStage("corners");
    } finally { setBusy(false); }
  };

  const onCrop = async () => {
    const src = srcRef.current;
    if (!src || !quad || busy) return;
    setBusy(true); setError(""); setStage("working");
    try {
      await nextPaint();
      const w = warpQuad(src, quad, 3000);
      if (warpedRef.current) { warpedRef.current.width = 1; warpedRef.current.height = 1; }
      warpedRef.current = w;
      setStage("preview");
    } catch (e) {
      setError(errText(e, "Не удалось выровнять страницу."));
      setStage("corners");
    } finally { setBusy(false); }
  };

  const onConfirm = async () => {
    const w = warpedRef.current;
    if (!w || busy) return;
    setBusy(true); setError("");
    try {
      await nextPaint();
      const recognize = canvasToJpeg(w, DIGITIZE_LIMITS.recognizeMaxSide, DIGITIZE_LIMITS.maxRecognizeImage / 1.37);
      if (recognize.length > DIGITIZE_LIMITS.maxRecognizeImage) throw new Error("Страница слишком тяжёлая. Попробуйте обрезать точнее.");
      const store = canvasToJpeg(w, DIGITIZE_LIMITS.storeMaxSide, DIGITIZE_LIMITS.storeMaxBytes);
      onDone({ recognize, store });
    } catch (e) {
      setError(errText(e, "Не удалось подготовить страницу."));
    } finally { setBusy(false); }
  };

  const errorLine = error ? <p className="px-4 pb-1 text-sm text-rose-600" role="alert">{error}</p> : null;

  if (stage === "loading" || stage === "working") {
    return (
      <div className="flex flex-col h-full min-h-0 items-center justify-center bg-[var(--bg-app)]" role="status">
        <Loader2 className="w-7 h-7 animate-spin text-[var(--accent)]" />
        <span className="sr-only">Загрузка…</span>
      </div>
    );
  }

  if (stage === "preview") {
    return (
      <div className="flex flex-col h-full min-h-0 bg-[var(--bg-app)]">
        <div className="flex-1 min-h-0 flex items-center justify-center p-4 overflow-hidden">
          <canvas ref={resultRef} className="max-w-full max-h-full object-contain rounded shadow-lg bg-white" style={{ width: "auto", height: "auto" }} />
        </div>
        {errorLine}
        <div className="flex gap-2 justify-end p-3 border-t border-[var(--border-color)] bg-[var(--bg-panel)]">
          <Button onClick={() => { setError(""); setStage("corners"); }} disabled={busy}>Назад</Button>
          <Button variant="primary" onClick={onConfirm} loading={busy}>Готово</Button>
        </div>
      </div>
    );
  }

  // Этап «Края»
  const pts = quad ? quad.map(toDisp) : [];
  const outline = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const dim = pts.length === 4
    ? `M0,0H${dispW}V${dispH}H0Z M${pts.map((p, i) => `${i ? "L" : ""}${p.x},${p.y}`).join(" ")}Z`
    : "";
  let magStyle: React.CSSProperties | undefined;
  if (drag !== null && pts[drag]) {
    const p = pts[drag];
    const left = Math.min(Math.max(PAD + p.x - MAG_SIZE / 2, 4), Math.max(4, area.w - MAG_SIZE - 4));
    const above = PAD + p.y - MAG_SIZE - 40;
    magStyle = { left, top: above >= 4 ? above : PAD + p.y + 40, width: MAG_SIZE, height: MAG_SIZE };
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--bg-app)]">
      <div ref={areaRef} className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden" style={{ padding: PAD }}>
        {dispW > 0 && quad && (
          <div className="relative select-none" style={{ width: dispW, height: dispH, touchAction: "none" }}>
            <canvas ref={shownRef} style={{ width: dispW, height: dispH, display: "block" }} />
            <svg ref={svgRef} width={dispW} height={dispH} className="absolute inset-0 overflow-visible" style={{ touchAction: "none" }}>
              <path d={dim} fillRule="evenodd" fill="rgba(0,0,0,0.5)" />
              <polygon points={outline} fill="none" stroke="var(--accent)" strokeWidth={2} />
              {pts.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r={HANDLE_R} fill="var(--accent)" stroke="#fff" strokeWidth={2} pointerEvents="none" />
                  <circle cx={p.x} cy={p.y} r={HIT_R} fill="transparent" style={{ touchAction: "none", cursor: "grab" }}
                    onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag(i); moveCorner(i, e); }}
                    onPointerMove={(e) => { if (drag === i) moveCorner(i, e); }}
                    onPointerUp={() => setDrag(null)}
                    onPointerCancel={() => setDrag(null)} />
                </g>
              ))}
            </svg>
          </div>
        )}
        {drag !== null && magStyle && (
          <canvas ref={magRef} width={MAG_SIZE * 2} height={MAG_SIZE * 2}
            className="absolute rounded-full border-2 border-[var(--accent)] shadow-lg pointer-events-none bg-white" style={magStyle} />
        )}
      </div>
      {errorLine}
      <div className="flex flex-wrap items-center gap-2 p-3 border-t border-[var(--border-color)] bg-[var(--bg-panel)]">
        <Button icon={<RotateCw className="w-4 h-4" />} onClick={onRotate} disabled={!quad || busy}>Повернуть</Button>
        <Button onClick={() => quad && setQuad(fullQuad(srcSize.w, srcSize.h))} disabled={!quad || busy}>Весь кадр</Button>
        <div className="flex-1" />
        <Button onClick={onCancel} disabled={busy}>Отмена</Button>
        <Button variant="primary" onClick={onCrop} disabled={!quad || busy}>Обрезать</Button>
      </div>
    </div>
  );
}
