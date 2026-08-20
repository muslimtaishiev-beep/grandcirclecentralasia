import { useCallback, useRef, RefObject } from 'react';
import { ProctoringEvent } from './useProctoringEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface EvidenceSnapshot {
  eventId: string;
  eventType: ProctoringEvent['type'];
  severity: ProctoringEvent['severity'];
  description: string;
  timestamp: number;      // ms relative to session start
  absoluteTime: number;   // Unix timestamp
  jpegDataUrl: string;    // Base64 JPEG canvas capture
}

export interface ProctoringReport {
  sessionId: string;
  orgId: string;
  studentName: string;
  studentShortId: string;
  testId: string;
  honestyIndex: number;
  sessionStartTime: number;
  sessionEndTime: number;
  totalViolations: number;
  violationsByType: Record<string, number>;
  events: ProctoringEvent[];
  snapshots: EvidenceSnapshot[];
  markdownReport: string;
}

export interface EvidencePackage {
  report: ProctoringReport;
  /** Set to true when package was successfully uploaded to backend */
  uploaded: boolean;
  uploadedFolderUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Only capture snapshots for these severity levels (not LOW) */
const CAPTURE_SEVERITIES: ProctoringEvent['severity'][] = ['MEDIUM', 'HIGH'];

/** Events that are disabled and should not appear in report */
const SILENT_EVENTS: ProctoringEvent['type'][] = [
  'SILENT_LIP_SPEAKING_DETECTED',
  'FAST_ANSWER',
];

/** JPEG quality (0-1) for canvas snapshot compression */
const JPEG_QUALITY = 0.72;

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useProctoringEvidence
 *
 * Manages automatic canvas snapshot capture on violation events
 * and compiles the complete end-of-session evidence package.
 *
 * Architecture notes:
 * - Snapshots are stored in a ref (not state) to avoid re-renders during test
 * - processedEventIds prevents duplicate captures for the same event
 * - On session end, compileReport() generates markdown + structured data
 * - Upload goes through /api/proctoring/upload-evidence (server injects org_id)
 *
 * SaaS multi-tenant note:
 * - orgId is passed in from parent (injected by server auth context, never from student)
 * - Evidence folder path on backend: [org_id_uuid]/[session_id_uuid]/
 */
export function useProctoringEvidence(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  sessionId: string,
  orgId: string,
  studentName: string,
  studentShortId: string,
  testId: string,
  sessionStartTime: number,
) {
  const snapshotsRef = useRef<EvidenceSnapshot[]>([]);
  const processedEventIds = useRef<Set<string>>(new Set());

  /**
   * Capture a JPEG snapshot of the current canvas frame.
   * Returns null if canvas is not available or capture fails.
   */
  const captureSnapshot = useCallback((): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    try {
      return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    } catch (e) {
      console.warn('[ProctoringEvidence] Canvas capture failed:', e);
      return null;
    }
  }, [canvasRef]);

  /**
   * Called whenever a new proctoring event fires.
   * Captures a snapshot if the event is MEDIUM/HIGH and not already processed.
   */
  const onEvent = useCallback((event: ProctoringEvent) => {
    // Skip already processed events
    if (processedEventIds.current.has(event.id)) return;
    // Skip disabled event types
    if (SILENT_EVENTS.includes(event.type)) return;
    // Skip LOW severity — not worth a snapshot
    if (!CAPTURE_SEVERITIES.includes(event.severity)) return;

    processedEventIds.current.add(event.id);

    const jpegDataUrl = captureSnapshot();
    if (!jpegDataUrl) return;

    const snapshot: EvidenceSnapshot = {
      eventId: event.id,
      eventType: event.type,
      severity: event.severity,
      description: event.description,
      timestamp: event.timestamp,
      absoluteTime: sessionStartTime + event.timestamp,
      jpegDataUrl,
    };

    snapshotsRef.current.push(snapshot);
    console.log(`[ProctoringEvidence] 📸 Snapshot captured for ${event.type} @ ${event.timestamp}ms`);
  }, [captureSnapshot, sessionStartTime]);

  /**
   * Returns all captured snapshots so far (read-only view).
   */
  const getSnapshots = useCallback((): EvidenceSnapshot[] => {
    return [...snapshotsRef.current];
  }, []);

  /**
   * Compiles the full proctoring report into a structured ProctoringReport object.
   * Call this at end of session before uploading.
   */
  const compileReport = useCallback((
    events: ProctoringEvent[],
    honestyIndex: number,
    videoBlob?: Blob | null,
  ): ProctoringReport => {
    const now = Date.now();
    const reportableEvents = events.filter(e => !SILENT_EVENTS.includes(e.type));

    // Count violations by type
    const violationsByType: Record<string, number> = {};
    reportableEvents.forEach((e) => {
      violationsByType[e.type] = (violationsByType[e.type] || 0) + 1;
    });

    const sessionDurationSec = Math.round((now - sessionStartTime) / 1000);
    const mm = Math.floor(sessionDurationSec / 60);
    const ss = sessionDurationSec % 60;
    const durationStr = `${mm}:${ss.toString().padStart(2, '0')}`;

    // ── Markdown Report ──
    const lines: string[] = [
      `# Отчёт Прокторинга — ${studentName}`,
      ``,
      `**Дата:** ${new Date(sessionStartTime).toLocaleString('ru-RU')}`,
      `**Студент:** ${studentName} (ID: ${studentShortId})`,
      `**Тест ID:** ${testId}`,
      `**Организация (Тенант):** ${orgId}`,
      `**Длительность сессии:** ${durationStr}`,
      `**Индекс честности:** ${honestyIndex}%`,
      `**Всего нарушений:** ${reportableEvents.length}`,
      `**Скриншотов снято:** ${snapshotsRef.current.length}`,
      ``,
      `---`,
      ``,
      `## Сводка по типам нарушений`,
      ``,
    ];

    Object.entries(violationsByType).forEach(([type, count]) => {
      lines.push(`- **${type}**: ${count} раз(а)`);
    });

    if (reportableEvents.length === 0) {
      lines.push(`✅ Нарушений не зафиксировано`);
    }

    lines.push(``, `---`, ``, `## Хронология нарушений`, ``);

    if (reportableEvents.length === 0) {
      lines.push(`*(Нарушений не зафиксировано)*`);
    } else {
      reportableEvents.forEach((e, i) => {
        const t = e.timestamp;
        const tMm = Math.floor(t / 60000);
        const tSs = Math.floor((t % 60000) / 1000);
        const timeStr = `${tMm.toString().padStart(2, '0')}:${tSs.toString().padStart(2, '0')}`;
        const hasSnapshot = snapshotsRef.current.some(s => s.eventId === e.id);
        lines.push(
          `### ${i + 1}. [${timeStr}] ${e.type} — ${e.severity}${hasSnapshot ? ' 📸' : ''}`,
          `> ${e.description}`,
          ``
        );
      });
    }

    lines.push(
      `---`,
      ``,
      `*Отчёт сформирован автоматически системой AI Proctoring.*`,
      `*Session ID: ${sessionId}*`,
    );

    return {
      sessionId,
      orgId,
      studentName,
      studentShortId,
      testId,
      honestyIndex,
      sessionStartTime,
      sessionEndTime: now,
      totalViolations: reportableEvents.length,
      violationsByType,
      events: reportableEvents,
      snapshots: [...snapshotsRef.current],
      markdownReport: lines.join('\n'),
    };
  }, [sessionId, orgId, studentName, studentShortId, testId, sessionStartTime]);

  /**
   * Uploads the evidence package to the server.
   *
   * SaaS Architecture:
   * - POST /api/proctoring/upload-evidence
   * - Server injects org_id from env/auth — the client CANNOT override it
   * - Server stores to Google Drive: [org_id]/[session_id]/
   * - Returns { success, folderUrl } for manager dashboard display
   *
   * Note: Video blob is large — future improvement is to get a pre-signed
   * Upload URL from server (Firebase Storage / S3) and upload directly from
   * client without going through the Express proxy.
   */
  const uploadEvidence = useCallback(async (
    report: ProctoringReport,
    videoBlob?: Blob | null,
    authToken?: string,
  ): Promise<{ success: boolean; folderUrl?: string; error?: string }> => {
    try {
      // Convert snapshots to simple base64 strings (strip data URL prefix)
      const snapshotPayload = report.snapshots.slice(0, 20).map(s => ({
        eventId: s.eventId,
        eventType: s.eventType,
        severity: s.severity,
        description: s.description,
        timestamp: s.timestamp,
        jpegBase64: s.jpegDataUrl.split(',')[1] || '',
      }));

      const payload = {
        sessionId: report.sessionId,
        studentName: report.studentName,
        studentShortId: report.studentShortId,
        testId: report.testId,
        honestyIndex: report.honestyIndex,
        sessionStartTime: report.sessionStartTime,
        sessionEndTime: report.sessionEndTime,
        totalViolations: report.totalViolations,
        violationsByType: report.violationsByType,
        markdownReport: report.markdownReport,
        snapshots: snapshotPayload,
        // orgId is intentionally NOT sent by client — server injects from auth token
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/proctoring/upload-evidence', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Upload failed: HTTP ${res.status}`);
      }

      console.log('[ProctoringEvidence] ✅ Evidence package uploaded:', data.folderUrl);
      return { success: true, folderUrl: data.folderUrl };
    } catch (e: any) {
      console.error('[ProctoringEvidence] ❌ Upload failed:', e.message);
      return { success: false, error: e.message };
    }
  }, []);

  return {
    onEvent,
    getSnapshots,
    compileReport,
    uploadEvidence,
    snapshotCount: () => snapshotsRef.current.length,
  };
}
