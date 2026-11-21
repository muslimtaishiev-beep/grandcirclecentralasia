import React, { useCallback, useEffect, useRef, useState } from "react";
import Confetti from "react-confetti";
import { motion } from "framer-motion";
import type { Block, LetterStep, MediaRef, ResultData, SplashStep, Step, Theme, Variant, VideoStep } from "../../shared/resultPages";

/**
 * Страница результатов: проигрывает шаги варианта — заставка, видео, письмо.
 * Один код для сайта (mode="live", на весь экран) и для редактора
 * (mode="preview": без автоперехода, клик по блоку выбирает его).
 * Текст рисуется как React-узлы: HTML не принимается, **жирный** разбирается здесь.
 */
export interface ResultExperienceProps {
  variant: Variant;
  data: ResultData;
  org: { name: string; logoUrl: string | null };
  mode: "live" | "preview";
  device?: "desktop" | "phone";
  /** preview: какой шаг показать (по умолчанию — письмо). */
  stepId?: string;
  selectedBlockId?: string | null;
  onSelectBlock?: (blockId: string) => void;
  selectedStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
  /** live: шаг сменился (индекс). */
  onStepChange?: (index: number) => void;
}

const SERIF = 'Georgia, "Times New Roman", "Noto Serif", serif';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const SELECT_COLOR = "#6366f1";

const bold = (line: string, key: string): React.ReactNode[] =>
  line.split(/(\*\*[^*\n]+\*\*)/g).map((p, i) => (/^\*\*[^*\n]+\*\*$/.test(p) ? <b key={`${key}${i}`}>{p.slice(2, -2)}</b> : <React.Fragment key={`${key}${i}`}>{p}</React.Fragment>));

function Rich({ text }: { text: string }) {
  const paras = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  return (
    <>
      {paras.map((p, i) => (
        <p key={i} style={{ margin: "0 0 1em", lineHeight: 1.7 }}>
          {p.split("\n").map((l, j) => <React.Fragment key={j}>{j > 0 && <br />}{bold(l, `${i}-${j}-`)}</React.Fragment>)}
        </p>
      ))}
    </>
  );
}

function Spinner() {
  return <div style={{ width: 44, height: 44, border: "4px solid rgba(255,255,255,.2)", borderTopColor: "#fff", borderRadius: "50%", animation: "rp-spin 0.9s linear infinite" }} />;
}

const mediaUrl = (m: MediaRef | null | undefined) => (m?.url || "");

export default function ResultExperience(p: ResultExperienceProps) {
  const { variant, data, org, mode, device = "desktop", selectedBlockId, onSelectBlock, selectedStepId, onSelectStep, onStepChange } = p;
  const preview = mode === "preview";
  const [idx, setIdx] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const letterRef = useRef<HTMLDivElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const upd = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    upd();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const go = useCallback((i: number) => { setIdx(i); onStepChange?.(i); }, [onStepChange]);

  const steps = variant.steps;
  const last = steps.length - 1;
  const current: Step | undefined = preview
    ? (p.stepId ? steps.find(s => s.id === p.stepId) : undefined) || steps[last]
    : steps[Math.min(idx, last)];
  const next = () => go(Math.min(idx + 1, last));
  const compact = device === "phone" || (size.w > 0 && size.w < 600);
  const theme = variant.theme;

  const download = async () => {
    const el = letterRef.current;
    if (!el || pdfBusy) return;
    setPdfBusy(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const opt: any = {
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: `${(data.child || "Results").replace(/[^\p{L}\p{N}_-]+/gu, "_")}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
      };
      await html2pdf().set(opt).from(el).save();
    } catch (e) { console.error("pdf", e); } finally { setPdfBusy(false); }
  };

  const showConfetti = current?.type === "letter" && theme.confetti && size.w > 0;

  return (
    <div
      ref={rootRef}
      className={preview ? "relative w-full h-full overflow-hidden" : "fixed inset-0 overflow-hidden"}
      style={{ background: current?.type === "letter" ? theme.background : "#000" }}
    >
      <style>{"@keyframes rp-spin{to{transform:rotate(360deg)}}"}</style>
      {current?.type === "splash" && (
        <Splash step={current} theme={theme} compact={compact} inert={preview} selected={selectedStepId === current.id} onSelect={onSelectStep} onOpen={next} />
      )}
      {current?.type === "video" && (
        <VideoLayer key={current.id + mediaUrl(current.media)} step={current} preview={preview} selected={selectedStepId === current.id} onSelect={onSelectStep} onDone={next} />
      )}
      {current?.type === "letter" && (
        <Letter
          step={current} theme={theme} data={data} org={org} preview={preview} compact={compact}
          letterRef={letterRef} selectedBlockId={selectedBlockId} onSelectBlock={onSelectBlock} onDownload={download} pdfBusy={pdfBusy}
        />
      )}
      {showConfetti && (
        <Confetti
          key={`${theme.confetti}-${current?.id}`} width={size.w} height={size.h} recycle={false}
          numberOfPieces={preview ? 250 : 800} gravity={0.15} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 20 }}
        />
      )}
    </div>
  );
}

function Splash({ step, theme, compact, inert, selected, onSelect, onOpen }: { step: SplashStep; theme: Theme; compact: boolean; inert: boolean; selected: boolean; onSelect?: (id: string) => void; onOpen: () => void }) {
  return (
    <div
      onClick={() => onSelect?.(step.id)}
      style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 24, textAlign: "center", color: "#fff", fontFamily: theme.font === "serif" ? SERIF : SANS,
        background: `radial-gradient(ellipse at 50% 30%, ${theme.accent}, #0b0b14 75%)`, outline: selected ? `3px solid ${SELECT_COLOR}` : "none", outlineOffset: -3 }}
    >
      <motion.div initial={inert ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }} style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: compact ? 30 : 46, lineHeight: 1.15, margin: 0, fontWeight: 600 }}>{step.title}</h1>
        {step.subtitle && <p style={{ fontSize: compact ? 16 : 20, opacity: 0.85, margin: "14px 0 0" }}>{step.subtitle}</p>}
        <button
          type="button" onClick={e => { if (inert) { e.stopPropagation(); return; } onOpen(); }}
          style={{ marginTop: 36, padding: "14px 40px", borderRadius: 999, border: "1px solid rgba(255,255,255,.7)", background: "rgba(255,255,255,.12)", color: "#fff", fontSize: 16, letterSpacing: ".08em", textTransform: "uppercase", cursor: "pointer", backdropFilter: "blur(6px)" }}
        >
          {step.buttonText || "Открыть"}
        </button>
      </motion.div>
    </div>
  );
}

function VideoLayer({ step, preview, selected, onSelect, onDone }: { step: VideoStep; preview: boolean; selected: boolean; onSelect?: (id: string) => void; onDone: () => void }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const src = mediaUrl(step.media);
  return (
    <div onClick={() => onSelect?.(step.id)} style={{ position: "absolute", inset: 0, background: "#000", display: "grid", placeItems: "center", outline: selected ? `3px solid ${SELECT_COLOR}` : "none", outlineOffset: -3 }}>
      {src && !failed ? (
        <>
          {loading && !preview && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <Spinner />
              <p style={{ color: "rgba(255,255,255,.6)", fontFamily: "monospace", fontSize: 13, letterSpacing: ".15em", textTransform: "uppercase", margin: 0 }}>Загрузка…</p>
            </div>
          )}
          <video
            src={src} autoPlay={!preview} playsInline controls preload={preview ? "metadata" : "auto"}
            onCanPlay={() => setLoading(false)} onPlaying={() => setLoading(false)} onWaiting={() => setLoading(true)}
            onEnded={() => { if (!preview) onDone(); }} onError={() => { setFailed(true); setLoading(false); }}
            style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }}
          />
        </>
      ) : (
        <p style={{ color: "rgba(255,255,255,.6)", fontSize: 14, textAlign: "center", padding: 24 }}>{failed ? "Видео не загрузилось" : "Видео не выбрано"}</p>
      )}
      {step.caption && <div style={{ position: "absolute", left: 20, bottom: 56, right: 20, color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,.8)", fontSize: 15, pointerEvents: "none" }}>{step.caption}</div>}
      {(step.skippable || failed || !src) && !preview && (
        <button type="button" onClick={e => { e.stopPropagation(); onDone(); }}
          style={{ position: "absolute", right: 24, top: 20, zIndex: 10, color: "rgba(255,255,255,.8)", background: "rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.35)", borderRadius: 999, padding: "8px 18px", fontSize: 13, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer" }}>
          Пропустить
        </button>
      )}
    </div>
  );
}

function Letter({ step, theme, data, org, preview, compact, letterRef, selectedBlockId, onSelectBlock, onDownload, pdfBusy }: {
  step: LetterStep; theme: Theme; data: ResultData; org: { name: string; logoUrl: string | null }; preview: boolean; compact: boolean;
  letterRef: React.RefObject<HTMLDivElement | null>; selectedBlockId?: string | null; onSelectBlock?: (id: string) => void; onDownload: () => void; pdfBusy: boolean;
}) {
  const vintage = theme.frame === "vintage";
  const ink = vintage ? "#3b2f1c" : "#0f172a";
  const font = vintage || theme.font === "serif" ? SERIF : SANS;
  const pad = compact ? 24 : theme.frame === "full" ? 56 : 64;

  const paper: React.CSSProperties = vintage
    ? {
        backgroundColor: "#f3e6c4",
        backgroundImage: [
          "radial-gradient(ellipse at 18% 8%, rgba(255,255,255,.55), transparent 55%)",
          "radial-gradient(ellipse at 88% 92%, rgba(120,80,20,.22), transparent 60%)",
          "radial-gradient(circle at 70% 30%, rgba(150,105,40,.10), transparent 35%)",
          "repeating-linear-gradient(0deg, rgba(120,90,40,.04) 0 1px, transparent 1px 3px)",
          "repeating-linear-gradient(90deg, rgba(120,90,40,.03) 0 1px, transparent 1px 4px)",
        ].join(","),
        boxShadow: "inset 0 0 70px rgba(139,97,32,.38), inset 0 0 6px rgba(90,60,20,.5), 0 14px 40px rgba(0,0,0,.3)",
        border: "1px solid rgba(110,80,30,.45)", borderRadius: 3, maxWidth: 720,
      }
    : theme.frame === "card"
      ? { background: "#fff", boxShadow: "0 10px 40px rgba(15,23,42,.12)", border: "1px solid rgba(15,23,42,.08)", borderRadius: 14, maxWidth: 720 }
      : { background: "transparent", maxWidth: 760 };

  const sel = (id: string): React.CSSProperties => (preview ? { cursor: "pointer", outline: selectedBlockId === id ? `2px solid ${SELECT_COLOR}` : "2px solid transparent", outlineOffset: 6, borderRadius: 4 } : {});

  const renderBlock = (b: Block): React.ReactNode => {
    switch (b.type) {
      case "heading": return <h1 style={{ fontSize: compact ? 26 : 34, lineHeight: 1.2, margin: "0 0 .6em", fontWeight: 600, color: vintage ? theme.accent : ink }}>{b.text}</h1>;
      case "text": return <div style={{ fontSize: compact ? 16 : 17 }}><Rich text={b.text} /></div>;
      case "results":
        if (!data.subjects.length) return null;
        return (
          <div style={{ margin: "0 0 1.2em" }}>
            {(b.title || data.examTitle) && <h2 style={{ fontSize: 13, letterSpacing: ".12em", textTransform: "uppercase", color: theme.accent, margin: "0 0 12px" }}>{b.title || data.examTitle}</h2>}
            {data.subjects.map(s => (
              <div key={s.title} style={{ margin: "0 0 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <span style={{ fontWeight: 600 }}>{s.title}</span>
                  <b style={{ fontVariantNumeric: "tabular-nums", fontSize: 18 }}>{String(s.percent).replace(".", ",")}%</b>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: vintage ? "rgba(90,60,20,.18)" : "rgba(15,23,42,.08)", marginTop: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, s.percent))}%`, background: theme.accent, borderRadius: 3 }} />
                </div>
                {s.level && <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>{s.level}</div>}
              </div>
            ))}
          </div>
        );
      case "feedback":
        if (!data.feedback) return null;
        return (
          <div style={{ margin: "0 0 1.2em", padding: "14px 18px", borderLeft: `4px solid ${theme.accent}`, background: vintage ? "rgba(120,80,20,.08)" : "rgba(15,23,42,.04)" }}>
            {b.title && <div style={{ fontSize: 13, letterSpacing: ".12em", textTransform: "uppercase", opacity: 0.7, marginBottom: 6 }}>{b.title}</div>}
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{data.feedback}</div>
          </div>
        );
      case "trial":
        if (!data.trial) return null;
        return (
          <div style={{ margin: "0 0 1.2em" }}>
            {b.title && <h2 style={{ fontSize: 13, letterSpacing: ".12em", textTransform: "uppercase", color: theme.accent, margin: "0 0 10px" }}>{b.title}</h2>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
              {([["С", data.trial.from], ["По", data.trial.to], ["Класс", data.trial.klass]] as const).filter(x => x[1]).map(([k, v]) => (
                <div key={k} style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${theme.accent}55` }}>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>{k}</div><div style={{ fontWeight: 600, fontSize: 17 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        );
      case "signature":
        return (
          <div style={{ margin: "1.6em 0 0" }}>
            {mediaUrl(b.image) && <img src={mediaUrl(b.image)} alt="" crossOrigin="anonymous" style={{ maxHeight: 70, maxWidth: 220, display: "block", marginBottom: 6 }} />}
            <div style={{ fontStyle: "italic", fontSize: 19 }}>{b.name}</div>
            {b.role && <div style={{ fontSize: 14, opacity: 0.7 }}>{b.role}</div>}
          </div>
        );
      case "image":
        return mediaUrl(b.media) ? <img src={mediaUrl(b.media)} alt={b.alt} crossOrigin="anonymous" style={{ width: "100%", height: "auto", borderRadius: 8, margin: "0 0 1.2em", display: "block" }} /> : (preview ? <div style={{ padding: 24, textAlign: "center", fontSize: 13, opacity: 0.5, border: "1px dashed currentColor", borderRadius: 8, margin: "0 0 1.2em" }}>Картинка не выбрана</div> : null);
      case "button":
        if (!b.text || !b.url) return preview ? <div style={{ fontSize: 13, opacity: 0.5, margin: "0 0 1.2em" }}>Кнопка: укажите текст и ссылку</div> : null;
        return (
          <div style={{ margin: "0 0 1.2em" }}>
            <a href={b.url} target="_blank" rel="noopener noreferrer" onClick={e => { if (preview) e.preventDefault(); }}
              style={{ display: "inline-block", padding: "12px 28px", borderRadius: vintage ? 3 : 10, background: theme.accent, color: "#fff", textDecoration: "none", fontWeight: 600, fontFamily: SANS }}>{b.text}</a>
          </div>
        );
      case "divider": return <hr style={{ border: 0, borderTop: `1px solid ${vintage ? "rgba(90,60,20,.35)" : "rgba(15,23,42,.15)"}`, margin: "1.6em 0" }} />;
    }
  };

  const sealOn = theme.seal && !!org.logoUrl;
  return (
    <div style={{ position: "absolute", inset: 0, overflowY: "auto", padding: compact ? "16px 12px" : "40px 20px", fontFamily: font, color: ink }}>
      <motion.div
        initial={preview ? false : { y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, delay: 0.2 }}
        style={{ margin: "0 auto", width: "100%", ...paper }}
      >
        <div ref={letterRef} style={{ padding: pad, ...(theme.frame === "full" ? { background: "transparent" } : {}) }}>
          {(sealOn || theme.header) && (
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              {sealOn && (
                <img src={org.logoUrl!} alt={org.name} crossOrigin="anonymous"
                  style={{ width: 72, height: 72, objectFit: "contain", borderRadius: "50%", padding: 6, background: "#fff", border: `2px solid ${theme.accent}`, boxShadow: vintage ? "0 2px 6px rgba(90,40,20,.35)" : "none", transform: vintage ? "rotate(-6deg)" : "none", margin: "0 auto 10px", display: "block" }} />
              )}
              {theme.header && <div style={{ fontSize: 13, letterSpacing: ".2em", textTransform: "uppercase", color: theme.accent }}>{theme.header}</div>}
            </div>
          )}
          {step.blocks.map((b, i) => {
            const node = renderBlock(b);
            if (!node && !preview) return null;
            return (
              <motion.div key={b.id} data-block-id={b.id} initial={preview ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: preview ? 0 : 0.5 + i * 0.12 }}
                onClick={() => onSelectBlock?.(b.id)} style={sel(b.id)}>
                {node}
              </motion.div>
            );
          })}
          <div data-html2canvas-ignore="true" style={{ marginTop: 32, textAlign: "center" }}>
            <button type="button" onClick={onDownload} disabled={pdfBusy}
              style={{ padding: "11px 26px", borderRadius: vintage ? 3 : 10, border: `1px solid ${theme.accent}`, background: "transparent", color: theme.accent, fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: pdfBusy ? 0.5 : 1 }}>
              {pdfBusy ? "Готовим PDF…" : "Скачать PDF"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
