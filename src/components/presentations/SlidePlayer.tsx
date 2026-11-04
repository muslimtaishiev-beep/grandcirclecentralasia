import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Grid3x3, Maximize, Minimize, NotebookText, Play, X } from "lucide-react";
import { SLIDE_CSS, prepareSlide, type PreparedSlide } from "./slideHtml";
import type { PresentationFace, PresentationSlide } from "../../shared/presentations";

/**
 * Показ колоды Claude Slides: холст 1920×1080, вписанный в экран, переходы
 * между слайдами, поэтапное появление (data-build-in), видео со звуком
 * (клик — пуск и пауза, как в плеере Claude), живые встроенные страницы,
 * заметки докладчика, полноэкранный режим, стрелки, пробел и свайпы.
 * Номер слайда — в адресе (#slide-3): ссылку можно дать на нужный слайд.
 */
const W = 1920, H = 1080;

function useFonts(faces: Record<string, PresentationFace>) {
  useEffect(() => {
    for (const f of Object.values(faces)) {
      if (document.querySelector(`link[data-face="${CSS.escape(f.href)}"]`)) continue;
      const l = document.createElement("link");
      l.rel = "stylesheet"; l.href = f.href; l.setAttribute("data-face", f.href);
      document.head.appendChild(l);
    }
  }, [faces]);
}

/** Один слайд на холсте. active — слайд на экране: только у него живут видео и встроенные страницы. */
function SlideView({ slide, active, step, thumb }: { slide: PreparedSlide; active: boolean; step: number; thumb?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Видео: картинка-обложка с data-video становится плеером. Звук — если в
  // колоде он включён (data-video-sound="on"). Пуск и пауза — по клику.
  useLayoutEffect(() => {
    const root = ref.current; if (!root) return;
    root.innerHTML = slide.html;
    if (thumb) return;
    const videos: HTMLVideoElement[] = [];
    root.querySelectorAll<HTMLImageElement>("img[data-video]").forEach(img => {
      const src = img.getAttribute("data-video"); if (!src) return;
      const wrap = document.createElement("div");
      wrap.setAttribute("style", img.getAttribute("style") || "");
      wrap.style.overflow = "hidden"; wrap.style.cursor = "pointer";
      if (!wrap.style.position) wrap.style.position = "relative";
      const v = document.createElement("video");
      v.src = src; v.poster = img.getAttribute("src") || ""; v.playsInline = true; v.preload = "metadata";
      v.muted = img.getAttribute("data-video-sound") !== "on";
      v.setAttribute("aria-label", img.getAttribute("alt") || "Видео");
      v.style.cssText = `width:100%;height:100%;object-fit:${img.style.objectFit || "contain"};display:block;background:inherit`;
      const btn = document.createElement("div");
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="64" height="64" fill="#fff"><path d="M8 5v14l11-7z"/></svg>`;
      btn.style.cssText = "position:absolute;left:50%;top:50%;width:140px;height:140px;margin:-70px 0 0 -70px;border-radius:50%;background:rgba(18,21,28,.72);display:flex;align-items:center;justify-content:center;transition:opacity .2s;pointer-events:none";
      const sync = () => { btn.style.opacity = v.paused ? "1" : "0"; };
      v.addEventListener("play", sync); v.addEventListener("pause", sync); v.addEventListener("ended", sync);
      wrap.addEventListener("click", e => { e.stopPropagation(); if (v.paused) void v.play(); else v.pause(); });
      wrap.append(v, btn);
      img.replaceWith(wrap);
      videos.push(v);
    });
    root.querySelectorAll("a[href]").forEach(a => { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer"); });
    return () => { videos.forEach(v => { v.pause(); v.removeAttribute("src"); v.load(); }); };
  }, [slide, thumb]);

  // Живые страницы — только на активном слайде: их анимация идёт по кругу и
  // не должна крутиться на всех слайдах сразу.
  useLayoutEffect(() => {
    const root = ref.current; if (!root || thumb) return;
    const frames: HTMLIFrameElement[] = [];
    if (active) {
      for (const e of slide.embeds) {
        const ph = root.querySelector<HTMLElement>(`[data-embed="${e.key}"]`); if (!ph) continue;
        const f = document.createElement("iframe");
        f.setAttribute("sandbox", "allow-scripts");
        f.setAttribute("title", "Встроенная анимация");
        f.srcdoc = e.srcdoc;
        f.style.cssText = "width:100%;height:100%;border:0;display:block;background:transparent";
        ph.replaceChildren(f);
        frames.push(f);
      }
    }
    return () => frames.forEach(f => f.remove());
  }, [slide, active, thumb]);

  // Уход со слайда — видео на паузу.
  useEffect(() => {
    if (active || thumb) return;
    ref.current?.querySelectorAll("video").forEach(v => v.pause());
  }, [active, thumb]);

  // Поэтапное появление: первые step элементов видны, остальные ждут.
  useLayoutEffect(() => {
    ref.current?.querySelectorAll("[data-build-in]").forEach((el, i) => el.classList.toggle("pending", !thumb && i >= step));
  }, [step, slide, thumb]);

  return <div ref={ref} className="slide-root" style={{ width: W, height: H }} />;
}

export default function SlidePlayer({ title, slides: raw, faces, assets, header, onClose }: {
  title: string;
  slides: PresentationSlide[];
  faces: Record<string, PresentationFace>;
  assets: Record<string, string>;
  /** Что показать слева в верхней панели (логотип организации). */
  header?: React.ReactNode;
  onClose?: () => void;
}) {
  useFonts(faces);
  const slides = useMemo(() => raw.map(s => prepareSlide(s.id, s.html, assets)), [raw, assets]);
  const fromHash = () => { const m = location.hash.match(/slide-(\d+)/); return m ? Math.min(Math.max(0, Number(m[1]) - 1), Math.max(0, raw.length - 1)) : 0; };
  const [i, setI] = useState(fromHash);
  const [prev, setPrev] = useState<{ i: number; dir: number } | null>(null);
  const [step, setStep] = useState(0);
  const [overview, setOverview] = useState(false);
  const [notes, setNotes] = useState(false);
  const [full, setFull] = useState(false);
  const [chrome, setChrome] = useState(true);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.5);
  const cur = slides[i];

  useLayoutEffect(() => {
    const el = stageRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(el.clientWidth / W, el.clientHeight / H)));
    ro.observe(el); return () => ro.disconnect();
  }, [notes]);

  const go = useCallback((n: number, atEnd = false) => {
    setI(old => {
      const k = Math.min(Math.max(0, n), slides.length - 1);
      if (k === old) return old;
      setPrev({ i: old, dir: k > old ? 1 : -1 });
      // Назад — на слайд целиком, со всеми появившимися элементами.
      setStep(atEnd ? slides[k].builds : 0);
      return k;
    });
  }, [slides]);
  const next = useCallback(() => { if (cur && step < cur.builds) setStep(s => s + 1); else go(i + 1); }, [cur, step, go, i]);
  const back = useCallback(() => { if (step > 0) setStep(s => s - 1); else go(i - 1, true); }, [step, go, i]);

  useEffect(() => { if (!prev) return; const t = setTimeout(() => setPrev(null), 450); return () => clearTimeout(t); }, [prev]);
  useEffect(() => { history.replaceState(null, "", `#slide-${i + 1}`); }, [i]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); next(); }
      else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); back(); }
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(slides.length - 1, true);
      else if (e.key.toLowerCase() === "f" || e.key.toLowerCase() === "а") void toggleFull();
      else if (e.key.toLowerCase() === "g" || e.key.toLowerCase() === "п") setOverview(o => !o);
      else if (e.key === "Escape" && overview) setOverview(false);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFull = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch { /* iPhone не умеет полноэкранный режим для страницы — просто остаёмся как есть */ }
  };
  useEffect(() => { const h = () => setFull(!!document.fullscreenElement); document.addEventListener("fullscreenchange", h); return () => document.removeEventListener("fullscreenchange", h); }, []);

  // В полном экране панели прячутся через 2,5 с без движения мыши.
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wake = () => { setChrome(true); if (idle.current) clearTimeout(idle.current); if (full) idle.current = setTimeout(() => setChrome(false), 2500); };
  useEffect(() => { wake(); }, [full]); // eslint-disable-line react-hooks/exhaustive-deps

  // Свайп: влево — дальше, вправо — назад.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const t = touch.current; touch.current = null; if (!t) return;
    const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx < 0) next(); else back(); }
  };

  if (!cur) return <div className="h-dvh grid place-items-center bg-[#0b0d12] text-white/60">В презентации нет слайдов</div>;
  const anim = (k: number, role: "in" | "out") => {
    const t = slides[k].transition;
    if (!prev || t === "none") return {};
    const dir = prev.dir;
    if (t === "push") return { animation: `${role === "in" ? "sp-push-in" : "sp-push-out"} .45s cubic-bezier(.2,.8,.2,1) both`, ["--d" as any]: dir };
    return { animation: `${role === "in" ? "sp-fade-in" : "sp-fade-out"} .4s ease both` };
  };
  const btn = "p-2.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition disabled:opacity-30";

  return (
    <div ref={rootRef} className="h-dvh w-full flex flex-col bg-[#0b0d12] text-white select-none" onMouseMove={wake} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <style>{SLIDE_CSS + `
@keyframes sp-fade-in{from{opacity:0}to{opacity:1}}
@keyframes sp-fade-out{from{opacity:1}to{opacity:0}}
@keyframes sp-push-in{from{transform:translateX(calc(var(--d) * 100%))}to{transform:none}}
@keyframes sp-push-out{from{transform:none}to{transform:translateX(calc(var(--d) * -100%))}}
@media (prefers-reduced-motion: reduce){.sp-layer{animation:none!important}}`}</style>

      <div className={`shrink-0 flex items-center gap-3 px-3 sm:px-4 h-12 transition-opacity ${full && !chrome ? "opacity-0" : "opacity-100"}`}>
        {header}
        <div className="min-w-0 flex-1 truncate text-sm font-semibold text-white/90">{title}</div>
        {onClose && <button className={btn} onClick={onClose} aria-label="Закрыть"><X className="w-5 h-5" /></button>}
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div ref={stageRef} className="relative flex-1 min-h-0 min-w-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/2 overflow-hidden shadow-2xl" style={{ width: W * scale, height: H * scale, transform: "translate(-50%,-50%)" }}>
            {prev && prev.i !== i && (
              <div key={`p${prev.i}`} className="sp-layer absolute inset-0" style={anim(i, "out")}>
                <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}><SlideView slide={slides[prev.i]} active={false} step={slides[prev.i].builds} /></div>
              </div>
            )}
            <div key={`c${i}`} className="sp-layer absolute inset-0" style={anim(i, "in")}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}><SlideView slide={cur} active step={step} /></div>
            </div>
          </div>
          {/* Широкие невидимые зоны по краям: клик — назад / дальше. */}
          <button aria-label="Предыдущий слайд" className="absolute left-0 top-0 bottom-0 w-[8%] cursor-w-resize" onClick={back} />
          <button aria-label="Следующий слайд" className="absolute right-0 top-0 bottom-0 w-[8%] cursor-e-resize" onClick={next} />
        </div>
        {notes && (
          <aside className="shrink-0 lg:w-[360px] max-h-[30vh] lg:max-h-none overflow-y-auto border-t lg:border-t-0 lg:border-l border-white/10 bg-white/[.03] p-4 text-[15px] leading-relaxed text-white/85 whitespace-pre-line">
            <div className="text-[11px] uppercase tracking-wider font-bold text-white/40 mb-2">Заметки · слайд {i + 1}</div>
            {cur.notes || <span className="text-white/40">У этого слайда нет заметок.</span>}
          </aside>
        )}
      </div>

      <div className={`shrink-0 flex items-center justify-center gap-1 sm:gap-2 px-2 h-14 transition-opacity ${full && !chrome ? "opacity-0" : "opacity-100"}`}>
        <button className={btn} onClick={back} disabled={i === 0 && step === 0} aria-label="Назад"><ChevronLeft className="w-6 h-6" /></button>
        <span className="tabular-nums text-sm text-white/70 min-w-[64px] text-center">{i + 1} / {slides.length}</span>
        <button className={btn} onClick={next} disabled={i === slides.length - 1 && step >= cur.builds} aria-label="Дальше"><ChevronRight className="w-6 h-6" /></button>
        <span className="w-px h-6 bg-white/10 mx-1" />
        <button className={btn} onClick={() => setOverview(true)} title="Все слайды (G)" aria-label="Все слайды"><Grid3x3 className="w-5 h-5" /></button>
        <button className={`${btn} ${notes ? "bg-white/10 text-white" : ""}`} onClick={() => setNotes(n => !n)} title="Заметки докладчика" aria-label="Заметки"><NotebookText className="w-5 h-5" /></button>
        <button className={btn} onClick={toggleFull} title="Во весь экран (F)" aria-label="Во весь экран">{full ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}</button>
      </div>

      {overview && (
        <div className="fixed inset-0 z-50 bg-[#0b0d12]/95 overflow-y-auto p-4 sm:p-8" onClick={() => setOverview(false)}>
          <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {slides.map((s, k) => (
              <button key={s.id} onClick={e => { e.stopPropagation(); go(k); setOverview(false); }}
                className={`text-left rounded-xl overflow-hidden ring-2 transition ${k === i ? "ring-blue-500" : "ring-transparent hover:ring-white/40"}`}>
                <Thumb slide={s} />
                <div className="px-2 py-1.5 text-xs text-white/70 tabular-nums bg-white/5">{k + 1}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Миниатюра слайда под ширину ячейки. */
export function Thumb({ slide }: { slide: PreparedSlide }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [k, setK] = useState(0.15);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setK(el.clientWidth / W));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="relative w-full overflow-hidden bg-black/30 pointer-events-none" style={{ aspectRatio: "16 / 9" }}>
      <div style={{ transform: `scale(${k})`, transformOrigin: "0 0" }}><SlideView slide={slide} active={false} step={0} thumb /></div>
      {slide.embeds.length > 0 && <Play className="absolute right-2 bottom-2 w-4 h-4 text-white/70" />}
    </div>
  );
}
