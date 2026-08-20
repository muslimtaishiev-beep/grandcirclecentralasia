import React, { useState, useEffect, useRef } from 'react';
import { ProctoringEvent, PROCTORING_WARNING_MESSAGES } from '../lib/useProctoringEngine';

interface ActiveWarning {
  id: string;
  event: ProctoringEvent;
  expiresAt: number;
}

interface ProctoringWarningOverlayProps {
  events: ProctoringEvent[];
  isActive: boolean;
}

const DISPLAY_DURATION_MS = 4500; // How long each toast stays visible
const DISABLED_TYPES: ProctoringEvent['type'][] = [
  'SILENT_LIP_SPEAKING_DETECTED',
  'FAST_ANSWER',
];

/**
 * ProctoringWarningOverlay
 *
 * Fullscreen animated overlay displayed on top of the student's test page.
 * Shows a pulsing red border + centered toast notification whenever a
 * proctoring violation occurs.
 *
 * Design goals:
 * - Pointer-events: none so the student can still interact with the test
 * - Only HIGH/MEDIUM severity events trigger user-visible warnings
 * - Auto-dismisses after DISPLAY_DURATION_MS
 * - Shows at most 1 warning at a time (queues them)
 */
export default function ProctoringWarningOverlay({ events, isActive }: ProctoringWarningOverlayProps) {
  const [activeWarning, setActiveWarning] = useState<ActiveWarning | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const processedEventsRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<ProctoringEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drain the queue and show next warning
  const showNextWarning = () => {
    const next = queueRef.current.shift();
    if (!next) {
      setIsVisible(false);
      setActiveWarning(null);
      return;
    }

    const warning: ActiveWarning = {
      id: next.id,
      event: next,
      expiresAt: Date.now() + DISPLAY_DURATION_MS,
    };

    setActiveWarning(warning);
    setIsVisible(true);

    timerRef.current = setTimeout(() => {
      setIsVisible(false);
      // Small gap before next warning
      setTimeout(showNextWarning, 350);
    }, DISPLAY_DURATION_MS);
  };

  // Ingest new events into queue
  useEffect(() => {
    if (!isActive) return;

    const newEvents = events.filter((e) => {
      if (processedEventsRef.current.has(e.id)) return false;
      if (DISABLED_TYPES.includes(e.type)) return false;
      if (e.severity === 'LOW') return false;
      return true;
    });

    if (newEvents.length === 0) return;

    newEvents.forEach((e) => {
      processedEventsRef.current.add(e.id);
      queueRef.current.push(e);
    });

    // If nothing is currently showing, start draining queue
    if (!activeWarning) {
      showNextWarning();
    }
  }, [events, isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!isActive) return null;

  const msg = activeWarning ? PROCTORING_WARNING_MESSAGES[activeWarning.event.type] : null;
  const severity = msg?.severity ?? 'MEDIUM';

  const borderColor = severity === 'HIGH'
    ? 'rgba(239,68,68,0.9)'   // red-500
    : 'rgba(245,158,11,0.85)'; // amber-500

  const toastBg = severity === 'HIGH'
    ? 'linear-gradient(135deg, rgba(127,29,29,0.97) 0%, rgba(185,28,28,0.97) 100%)'
    : 'linear-gradient(135deg, rgba(120,53,15,0.97) 0%, rgba(180,83,9,0.97) 100%)';

  return (
    <>
      {/* ── Global CSS for warning animations ── */}
      <style>{`
        @keyframes proctoring-border-pulse {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1; }
        }
        @keyframes proctoring-toast-in {
          0%   { opacity: 0; transform: translateY(-28px) scale(0.94); }
          60%  { opacity: 1; transform: translateY(4px) scale(1.01); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes proctoring-toast-out {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-16px) scale(0.96); }
        }
        @keyframes proctoring-icon-shake {
          0%, 100% { transform: rotate(0deg); }
          20%  { transform: rotate(-12deg); }
          40%  { transform: rotate(12deg); }
          60%  { transform: rotate(-8deg); }
          80%  { transform: rotate(8deg); }
        }
        @keyframes proctoring-progress {
          from { width: 100%; }
          to   { width: 0%; }
        }

        .proctoring-border-ring {
          animation: proctoring-border-pulse 1.1s ease-in-out infinite;
        }
        .proctoring-toast-enter {
          animation: proctoring-toast-in 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .proctoring-toast-exit {
          animation: proctoring-toast-out 0.32s ease-in forwards;
        }
        .proctoring-icon-shake {
          animation: proctoring-icon-shake 0.5s ease-in-out;
        }
        .proctoring-progress-bar {
          animation: proctoring-progress ${DISPLAY_DURATION_MS}ms linear forwards;
        }
      `}</style>

      {/* ── Fullscreen container (pointer-events: none so test interaction works) ── */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* ── Animated Red / Amber Border Ring ── */}
        {isVisible && activeWarning && (
          <div
            className="proctoring-border-ring"
            style={{
              position: 'absolute',
              inset: 0,
              border: `5px solid ${borderColor}`,
              borderRadius: '0px',
              boxShadow: `inset 0 0 40px 10px ${borderColor.replace('0.9', '0.25')}, 0 0 60px 20px ${borderColor.replace('0.9', '0.20')}`,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* ── Corner Brackets ── */}
        {isVisible && activeWarning && (
          <>
            {/* Top-left */}
            <div style={{ position: 'absolute', top: 12, left: 12, width: 48, height: 48,
              borderTop: `4px solid ${borderColor}`, borderLeft: `4px solid ${borderColor}`, borderRadius: '4px 0 0 0' }} />
            {/* Top-right */}
            <div style={{ position: 'absolute', top: 12, right: 12, width: 48, height: 48,
              borderTop: `4px solid ${borderColor}`, borderRight: `4px solid ${borderColor}`, borderRadius: '0 4px 0 0' }} />
            {/* Bottom-left */}
            <div style={{ position: 'absolute', bottom: 12, left: 12, width: 48, height: 48,
              borderBottom: `4px solid ${borderColor}`, borderLeft: `4px solid ${borderColor}`, borderRadius: '0 0 0 4px' }} />
            {/* Bottom-right */}
            <div style={{ position: 'absolute', bottom: 12, right: 12, width: 48, height: 48,
              borderBottom: `4px solid ${borderColor}`, borderRight: `4px solid ${borderColor}`, borderRadius: '0 0 4px 0' }} />
          </>
        )}

        {/* ── Toast Notification ── */}
        {msg && msg.title && activeWarning && (
          <div
            key={activeWarning.id}
            className={isVisible ? 'proctoring-toast-enter' : 'proctoring-toast-exit'}
            style={{
              marginTop: 24,
              background: toastBg,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1.5px solid ${borderColor}`,
              borderRadius: 16,
              padding: '20px 28px 16px',
              maxWidth: 480,
              minWidth: 320,
              boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 40px ${borderColor.replace('0.9', '0.35')}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Icon + Title row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                key={activeWarning.id + '_icon'}
                className="proctoring-icon-shake"
                style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}
              >
                {msg.icon}
              </span>
              <div>
                <div style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: '#fff',
                  letterSpacing: '-0.3px',
                  lineHeight: 1.2,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}>
                  {msg.title}
                </div>
                <div style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.82)',
                  marginTop: 3,
                  lineHeight: 1.4,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}>
                  {msg.body}
                </div>
              </div>
            </div>

            {/* REC indicator */}
            <div style={{
              position: 'absolute',
              top: 14,
              right: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#ef4444',
                boxShadow: '0 0 8px #ef4444',
                animation: 'proctoring-border-pulse 1s infinite',
              }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', letterSpacing: 1 }}>
                REC
              </span>
            </div>

            {/* Progress bar (auto-dismiss timer) */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 3,
              background: 'rgba(255,255,255,0.1)',
            }}>
              <div
                key={activeWarning.id + '_progress'}
                className="proctoring-progress-bar"
                style={{
                  height: '100%',
                  background: borderColor,
                  transformOrigin: 'left',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
