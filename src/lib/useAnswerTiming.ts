import { useState, useRef, useCallback } from 'react';

/**
 * Result of evaluating answer response timing for a question.
 */
export interface TimingResult {
  suspicious: boolean;
  type?: 'FAST_ANSWER';
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
  actualTime?: number;
  expectedTime?: number;
}

/**
 * Details of a captured clipboard paste event.
 */
export interface PasteEvent {
  timestamp: number;
  textLength: number;
  preview: string;
  targetId: string;
}

/**
 * Summary timing report entry for a answered question.
 */
export interface TimingReport {
  questionId: string;
  expectedTime: number;
  actualTime: number;
  ratio: number;
  suspicious: boolean;
}

interface QuestionStartData {
  startTime: number;
  expectedTimeSeconds: number;
}

/**
 * React hook for tracking answer timing during tests to detect suspiciously fast answers
 * and clipboard paste events.
 *
 * All timing data is maintained in refs to avoid triggering re-renders on timer updates.
 * Only paste events trigger state updates.
 */
export function useAnswerTiming(): {
  startQuestionTimer: (questionId: string, expectedTimeSeconds: number) => void;
  recordAnswer: (questionId: string) => TimingResult;
  setupPasteMonitoring: () => () => void;
  pasteEvents: PasteEvent[];
  getTimingReport: () => TimingReport[];
} {
  // Store question start timestamps and expected times without causing re-renders
  const startTimesRef = useRef<Map<string, QuestionStartData>>(new Map());

  // Store completed question timing reports in order
  const reportsRef = useRef<Map<string, TimingReport>>(new Map());

  // Store recorded paste events in React state
  const [pasteEvents, setPasteEvents] = useState<PasteEvent[]>([]);

  /**
   * Records the current timestamp when a question is displayed to the user.
   *
   * @param questionId Unique identifier for the question
   * @param expectedTimeSeconds Expected duration in seconds to complete the question
   */
  const startQuestionTimer = useCallback((questionId: string, expectedTimeSeconds: number) => {
    if (!questionId || expectedTimeSeconds <= 0) {
      return;
    }
    startTimesRef.current.set(questionId, {
      startTime: Date.now(),
      expectedTimeSeconds,
    });
  }, []);

  /**
   * Records when the user submits or clicks an answer for a question and evaluates elapsed time.
   *
   * Thresholds for suspicion:
   * - Elapsed < 0.15 * expectedTime -> HIGH severity suspicious fast answer
   * - Elapsed < 0.30 * expectedTime -> MEDIUM severity suspicious fast answer
   * - Otherwise -> Not suspicious
   *
   * @param questionId Unique identifier for the question
   * @returns TimingResult indicating suspicion level and actual elapsed time
   */
  const recordAnswer = useCallback((questionId: string): TimingResult => {
    const startData = startTimesRef.current.get(questionId);
    if (!startData) {
      return { suspicious: false };
    }

    const now = Date.now();
    const actualTime = (now - startData.startTime) / 1000;
    const expectedTime = startData.expectedTimeSeconds;
    const ratio = expectedTime > 0 ? actualTime / expectedTime : 1;

    // \u2705 FAST_ANSWER detection is disabled by product decision.
    // Timing data is still tracked for analytics purposes only.
    const result: TimingResult = {
      suspicious: false, // always false — fast-answer violations are turned off
      actualTime,
      expectedTime,
    };

    const report: TimingReport = {
      questionId,
      expectedTime,
      actualTime,
      ratio,
      suspicious: false,
    };

    reportsRef.current.set(questionId, report);

    return result;
  }, []);

  /**
   * Sets up a global listener on `document` for `paste` events.
   * Logs details for each paste action (timestamp, length, preview snippet, target element ID).
   *
   * @returns Cleanup function to unbind the paste event listener
   */
  const setupPasteMonitoring = useCallback(() => {
    const handlePaste = (event: ClipboardEvent) => {
      try {
        const text = event.clipboardData?.getData('text') || '';
        const targetElement = event.target as HTMLElement | null;
        const targetId = targetElement?.id || '';

        const newPasteEvent: PasteEvent = {
          timestamp: Date.now(),
          textLength: text.length,
          preview: text.slice(0, 20),
          targetId,
        };

        setPasteEvents((prev) => [...prev, newPasteEvent]);
      } catch (error) {
        console.error('Error handling paste event:', error);
      }
    };

    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, []);

  /**
   * Returns a list of all timing reports generated for completed questions.
   */
  const getTimingReport = useCallback((): TimingReport[] => {
    return Array.from(reportsRef.current.values());
  }, []);

  return {
    startQuestionTimer,
    recordAnswer,
    setupPasteMonitoring,
    pasteEvents,
    getTimingReport,
  };
}
