import React, { useEffect, useRef, useCallback } from "react";

// Types matching useProctoringEngine output
interface ProctoringTelemetry {
  headPose: { pitch: number; yaw: number; roll: number };
  gazeDirection: "CENTER" | "LEFT" | "RIGHT" | "DOWN";
  gazeRatio: number;
  handsDetected: number;
  handStatus: "IN_FRAME" | "BELOW_DESK" | "NO_HANDS";
  currentGesture?: {
    gesture: string;
    label: string;
    extendedFingers: number;
    signaledOption?: string;
  };
  decodedGestureOption?: string;
  decodedGestureStream?: string;
  facesDetected: number;
  phoneDetected?: boolean;
  bookDetected?: boolean;
  lightAnomaly: boolean;
  isViolating: boolean;
  isDraftWork: boolean;
  fps: number;

  // Lip reading telemetry
  mouthAspectRatio?: number;
  isSilentLipSpeaking?: boolean;
  currentViseme?: string;
  visemeLabel?: string;
  decodedLipWord?: string;
  decodedLipOption?: string;

  // Audio telemetry
  audioLevel?: number;
  audioStatus?: 'SILENT' | 'NORMAL' | 'WHISPER' | 'TALKING';
  lastTranscript?: string;
  speechProbability?: number;
}

interface ProctoringEvent {
  id: string;
  timestamp: number;
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface DetectedObject {
  categoryName: string;
  score: number;
  boundingBox: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  };
}

interface ProctoringOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  telemetry: ProctoringTelemetry;
  events: ProctoringEvent[];
  isRecording: boolean;
  recordingDuration: number;
  sessionStartTime: number;
  faceLandmarks?: Point3D[][] | null;
  detectedObjects?: DetectedObject[] | null;
  handLandmarks?: Point3D[][] | null;
}

// Colors
const NEON_CYAN = "#00E5FF";
const NEON_RED = "#FF2A6D";
const NEON_PURPLE = "#A855F7";
const NEON_PINK = "#EC4899";
const NEON_YELLOW = "#FACC15";
const GREEN_OK = "#10B981";
const HUD_BG = "rgba(15, 23, 42, 0.86)";
const HUD_TEXT = "#E2E8F0";

// Lip landmark indices for Face Mesh
const LIP_OUTER_INDICES = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatEventTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function ProctoringOverlay({
  videoRef,
  canvasRef,
  telemetry,
  events,
  isRecording,
  recordingDuration,
  sessionStartTime,
  faceLandmarks,
  detectedObjects,
  handLandmarks,
}: ProctoringOverlayProps) {
  const animFrameRef = useRef<number>(0);
  const recentEventsRef = useRef<ProctoringEvent[]>([]);

  useEffect(() => {
    const now = Date.now() - sessionStartTime;
    recentEventsRef.current = events.filter(
      (e) => now - e.timestamp < 8000
    );
  }, [events, sessionStartTime]);

  const draw = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      animFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    // 1. Draw raw video frame
    ctx.drawImage(video, 0, 0, w, h);

    const isViolating = telemetry.isViolating;
    const boxColor = isViolating ? NEON_RED : GREEN_OK;
    const vectorColor = isViolating ? NEON_RED : NEON_CYAN;

    // 2. Draw Face Bounding Box & Vector & Lip Mesh Outline
    if (faceLandmarks && faceLandmarks.length > 0) {
      for (let faceIdx = 0; faceIdx < faceLandmarks.length; faceIdx++) {
        const face = faceLandmarks[faceIdx];
        if (!face || face.length === 0) continue;

        let minX = 1, minY = 1, maxX = 0, maxY = 0;
        for (const pt of face) {
          if (pt.x < minX) minX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y > maxY) maxY = pt.y;
        }

        const bx = minX * w;
        const by = minY * h;
        const bw = (maxX - minX) * w;
        const bh = (maxY - minY) * h;

        const faceColor = faceIdx === 0 ? boxColor : "#F59E0B";
        ctx.strokeStyle = faceColor;
        ctx.lineWidth = 2.5;
        ctx.setLineDash(faceIdx === 0 ? [] : [8, 4]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.setLineDash([]);

        if (faceIdx > 0) {
          ctx.fillStyle = "rgba(245, 158, 11, 0.85)";
          ctx.fillRect(bx, by - 24, 140, 22);
          ctx.fillStyle = "#000";
          ctx.font = "bold 13px monospace";
          ctx.fillText("⚠ EXTRA PERSON", bx + 4, by - 7);
        }

        // Draw Lip Mesh Contour & Decoded Word Badge
        if (faceIdx === 0) {
          ctx.beginPath();
          for (let i = 0; i < LIP_OUTER_INDICES.length; i++) {
            const idx = LIP_OUTER_INDICES[i];
            if (face[idx]) {
              const lx = face[idx].x * w;
              const ly = face[idx].y * h;
              if (i === 0) ctx.moveTo(lx, ly);
              else ctx.lineTo(lx, ly);
            }
          }
          ctx.closePath();
          ctx.strokeStyle = telemetry.isSilentLipSpeaking ? NEON_PINK : "rgba(236, 72, 153, 0.4)";
          ctx.lineWidth = telemetry.isSilentLipSpeaking ? 3 : 1;
          ctx.stroke();

          // Render Decoded Lip Word Badge directly over mouth
          if (telemetry.isSilentLipSpeaking && face[13]) {
            const mx = face[13].x * w;
            const my = face[13].y * h;
            const decodedWord = telemetry.decodedLipWord || telemetry.visemeLabel || 'Бесшумная речь';
            const lipBadgeText = `👄 РАСШИФРОВАНО: "${decodedWord}"`;
            const lbW = ctx.measureText(lipBadgeText).width + 20;

            ctx.fillStyle = "rgba(236, 72, 153, 0.95)";
            roundRect(ctx, mx - lbW / 2, my + 15, lbW, 26, 6);
            ctx.fill();
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 12px sans-serif";
            ctx.fillText(lipBadgeText, mx - lbW / 2 + 10, my + 32);
          }
        }

        if (faceIdx === 0 && face[1]) {
          const nose = face[1];
          const noseX = nose.x * w;
          const noseY = nose.y * h;

          const yawRad = (telemetry.headPose.yaw * Math.PI) / 180;
          const pitchRad = (telemetry.headPose.pitch * Math.PI) / 180;
          const vecLen = 80;
          const endX = noseX + Math.sin(yawRad) * vecLen;
          const endY = noseY + Math.sin(pitchRad) * vecLen;

          ctx.beginPath();
          ctx.moveTo(noseX, noseY);
          ctx.lineTo(endX, endY);
          ctx.strokeStyle = vectorColor;
          ctx.lineWidth = 2.5;
          ctx.stroke();

          const angle = Math.atan2(endY - noseY, endX - noseX);
          const headLen = 10;
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - headLen * Math.cos(angle - 0.4),
            endY - headLen * Math.sin(angle - 0.4)
          );
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - headLen * Math.cos(angle + 0.4),
            endY - headLen * Math.sin(angle + 0.4)
          );
          ctx.strokeStyle = vectorColor;
          ctx.lineWidth = 2;
          ctx.stroke();

          if (isViolating) {
            const now = Date.now() - sessionStartTime;
            const recentViolations = recentEventsRef.current.filter(
              (e) => e.severity === "HIGH" && now - e.timestamp < 5000
            );
            if (recentViolations.length > 0) {
              const latest = recentViolations[recentViolations.length - 1];
              const badgeW = Math.min(ctx.measureText(latest.description).width + 16, 320);
              
              ctx.fillStyle = "rgba(255, 42, 109, 0.90)";
              roundRect(ctx, bx, by - 30, badgeW, 26, 6);
              ctx.fill();
              ctx.fillStyle = "#FFF";
              ctx.font = "bold 12px monospace";
              ctx.fillText(
                `[${formatEventTime(latest.timestamp)}] ${latest.description}`.slice(0, 52),
                bx + 6,
                by - 12
              );
            }
          }
        }
      }
    }

    // 3. Draw Hand Landmarks & Decoded Option Badges
    if (handLandmarks && handLandmarks.length > 0) {
      for (const hand of handLandmarks) {
        if (!hand || hand.length < 21) continue;

        let minX = 1, minY = 1, maxX = 0, maxY = 0;

        ctx.fillStyle = NEON_CYAN;
        for (const pt of hand) {
          const px = pt.x * w;
          const py = pt.y * h;
          if (pt.x < minX) minX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y > maxY) maxY = pt.y;

          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        const hbx = minX * w;
        const hby = minY * h;
        const hbw = (maxX - minX) * w;
        const hbh = (maxY - minY) * h;

        ctx.strokeStyle = telemetry.currentGesture?.signaledOption ? NEON_YELLOW : "rgba(0, 229, 255, 0.5)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(hbx, hby, hbw, hbh);
        ctx.setLineDash([]);

        if (telemetry.currentGesture && telemetry.currentGesture.gesture !== 'NONE') {
          const gText = telemetry.decodedGestureOption ? `✌️ ДЕКОДИРОВАНО: ${telemetry.decodedGestureOption}` : telemetry.currentGesture.label;
          const gW = ctx.measureText(gText).width + 20;
          const gy = Math.max(0, hby - 26);

          ctx.fillStyle = telemetry.currentGesture.signaledOption ? "rgba(250, 204, 21, 0.95)" : "rgba(15, 23, 42, 0.85)";
          roundRect(ctx, hbx, gy, gW, 24, 5);
          ctx.fill();

          ctx.fillStyle = telemetry.currentGesture.signaledOption ? "#000000" : "#FFFFFF";
          ctx.font = "bold 12px sans-serif";
          ctx.fillText(gText, hbx + 10, gy + 16);
        }
      }
    }

    // 4. Draw Objects
    if (detectedObjects && detectedObjects.length > 0) {
      for (const obj of detectedObjects) {
        const bbox = obj.boundingBox;
        if (!bbox) continue;

        const isPhone = obj.categoryName.toLowerCase().includes("phone");
        const strokeColor = isPhone ? NEON_RED : NEON_PURPLE;
        const labelEmoji = isPhone ? "📱" : obj.categoryName.toLowerCase().includes("book") ? "📖" : "🔍";

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 2]);
        ctx.strokeRect(bbox.originX, bbox.originY, bbox.width, bbox.height);
        ctx.setLineDash([]);

        const labelText = `${labelEmoji} ${obj.categoryName.toUpperCase()} (${Math.round(obj.score * 100)}%)`;
        const textW = ctx.measureText(labelText).width + 16;
        const ly = Math.max(0, bbox.originY - 24);

        ctx.fillStyle = isPhone ? "rgba(255, 42, 109, 0.90)" : "rgba(168, 85, 247, 0.90)";
        roundRect(ctx, bbox.originX, ly, textW, 22, 4);
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 11px monospace";
        ctx.fillText(labelText, bbox.originX + 8, ly + 15);
      }
    }

    // 5. HUD Telemetry Panel
    const hudX = 10;
    const hudY = 10;
    const hudW = 340;
    const hudH = 125;

    ctx.fillStyle = HUD_BG;
    roundRect(ctx, hudX, hudY, hudW, hudH, 8);
    ctx.fill();

    ctx.strokeStyle = isViolating || telemetry.phoneDetected || telemetry.isSilentLipSpeaking ? NEON_RED : "rgba(0, 229, 255, 0.3)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, hudX, hudY, hudW, hudH, 8);
    ctx.stroke();

    ctx.fillStyle = HUD_TEXT;
    ctx.font = "bold 11px monospace";
    ctx.fillText("PROCTORING REALTIME DECODER", hudX + 12, hudY + 18);

    ctx.font = "11px monospace";
    const y1 = hudY + 36;
    ctx.fillStyle = Math.abs(telemetry.headPose.yaw) > 20 ? NEON_RED : "#94A3B8";
    ctx.fillText(`Yaw: ${telemetry.headPose.yaw.toFixed(1)}°`, hudX + 12, y1);
    ctx.fillStyle = telemetry.headPose.pitch < -45 ? NEON_RED : telemetry.isDraftWork ? "#FCD34D" : "#94A3B8";
    ctx.fillText(`Pitch: ${telemetry.headPose.pitch.toFixed(1)}°`, hudX + 130, y1);

    const y2 = y1 + 18;
    ctx.fillStyle = telemetry.gazeDirection !== "CENTER" && telemetry.gazeDirection !== "DOWN" ? NEON_RED : "#94A3B8";
    ctx.fillText(`Gaze: ${telemetry.gazeDirection}`, hudX + 12, y2);

    ctx.fillStyle = telemetry.handStatus === "BELOW_DESK" ? NEON_RED : "#94A3B8";
    ctx.fillText(`Hands: ${telemetry.handsDetected} (${telemetry.handStatus})`, hudX + 130, y2);

    const y3 = y2 + 18;
    ctx.fillStyle = telemetry.facesDetected > 1 ? NEON_RED : "#94A3B8";
    ctx.fillText(`Faces: ${telemetry.facesDetected}`, hudX + 12, y3);

    ctx.fillStyle = (telemetry.speechProbability || 0) > 50 ? NEON_RED : "#64748B";
    ctx.fillText(`Mic: ${telemetry.audioStatus || 'SILENT'} (${telemetry.audioLevel || 0}dB)`, hudX + 130, y3);

    const y4 = y3 + 18;
    if (telemetry.isSilentLipSpeaking) {
      ctx.fillStyle = NEON_PINK;
      ctx.font = "bold 11px monospace";
      ctx.fillText(`👄 LIP DECODED: ${telemetry.decodedLipWord || telemetry.visemeLabel}`, hudX + 12, y4);
    } else if (telemetry.decodedGestureStream) {
      ctx.fillStyle = NEON_YELLOW;
      ctx.font = "bold 11px monospace";
      ctx.fillText(`✌️ GESTURES: ${telemetry.decodedGestureStream}`, hudX + 12, y4);
    } else if (telemetry.phoneDetected) {
      ctx.fillStyle = NEON_RED;
      ctx.font = "bold 11px monospace";
      ctx.fillText("📱 PHONE DETECTED IN FRAME!", hudX + 12, y4);
    } else if (telemetry.lightAnomaly) {
      ctx.fillStyle = NEON_RED;
      ctx.font = "bold 11px monospace";
      ctx.fillText("⚡ LIGHT ANOMALY DETECTED", hudX + 12, y4);
    }

    // 6. Live Speech & VSR Lip Reading Transcript Box
    if (telemetry.lastTranscript && telemetry.lastTranscript.length > 0) {
      const displayText = telemetry.lastTranscript;
      const probText = `[Угроза: ${telemetry.speechProbability || 0}%]`;
      const textWidth = ctx.measureText(displayText).width;
      const trBoxW = Math.max(380, Math.min(textWidth + 140, 520));
      const trBoxH = 34;
      const trBoxX = 10;
      const trBoxY = h - 45;

      const isLip = telemetry.lastTranscript.includes("👄");
      const isHighRisk = (telemetry.speechProbability || 0) > 55;

      ctx.fillStyle = isLip ? "rgba(236, 72, 153, 0.92)" : isHighRisk ? "rgba(239, 68, 68, 0.90)" : "rgba(15, 23, 42, 0.85)";
      roundRect(ctx, trBoxX, trBoxY, trBoxW, trBoxH, 6);
      ctx.fill();

      ctx.strokeStyle = isLip ? "#EC4899" : isHighRisk ? "#FF2A6D" : "#3B82F6";
      ctx.lineWidth = 1.5;
      roundRect(ctx, trBoxX, trBoxY, trBoxW, trBoxH, 6);
      ctx.stroke();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText(displayText, trBoxX + 10, trBoxY + 21);

      ctx.fillStyle = isHighRisk ? "#FEF08A" : "#93C5FD";
      ctx.font = "bold 11px monospace";
      ctx.fillText(probText, trBoxX + trBoxW - 130, trBoxY + 21);
    }

    // 7. Recording Indicator
    if (isRecording) {
      const recX = w - 150;
      const recY = 10;
      ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
      roundRect(ctx, recX, recY, 140, 30, 6);
      ctx.fill();

      const blink = Math.floor(Date.now() / 500) % 2 === 0;
      if (blink) {
        ctx.beginPath();
        ctx.arc(recX + 16, recY + 15, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#EF4444";
        ctx.fill();
      }

      ctx.fillStyle = "#EF4444";
      ctx.font = "bold 12px monospace";
      ctx.fillText("REC", recX + 28, recY + 19);

      ctx.fillStyle = HUD_TEXT;
      ctx.font = "12px monospace";
      ctx.fillText(formatTime(recordingDuration), recX + 68, recY + 19);
    }

    // 8. Draft work indicator
    if (telemetry.isDraftWork && !isViolating) {
      const draftText = "📝 Работа с черновиком";
      const tw = ctx.measureText(draftText).width + 24;
      const dx = (w - tw) / 2;
      const dy = h - 40;
      ctx.fillStyle = "rgba(252, 211, 77, 0.25)";
      roundRect(ctx, dx, dy, tw, 28, 6);
      ctx.fill();
      ctx.fillStyle = "#FCD34D";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(draftText, dx + 12, dy + 19);
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [videoRef, canvasRef, telemetry, events, isRecording, recordingDuration, sessionStartTime, faceLandmarks, detectedObjects, handLandmarks]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [draw]);

  return null;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
