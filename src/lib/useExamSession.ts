import { useState, useEffect, useCallback, useRef } from "react";

export interface ExamSessionConfig {
  testId?: string;
  studentName: string;
  grade: number;
  shortId?: string;
  isTester?: boolean;
}

export interface ExamSessionState {
  sessionId: string | null;
  shortId: string | null;
  status: "INITIALIZING" | "IN_PROGRESS" | "SUBMITTING" | "SUBMITTED" | "ERROR";
  answers: Record<string, any>;
  elapsedSeconds: number;
  timeLimitMinutes: number;
  error: string | null;
}

export function useExamSession(config: ExamSessionConfig) {
  const [state, setState] = useState<ExamSessionState>({
    sessionId: config.testId || null,
    shortId: config.shortId || null,
    status: "INITIALIZING",
    answers: {},
    elapsedSeconds: 0,
    timeLimitMinutes: 90,
    error: null,
  });

  const storageKeyRef = useRef<string>(`exam_answers_${config.shortId || config.studentName}_${config.grade}`);

  // 1. Initialize or load from localStorage
  useEffect(() => {
    // Try to load cached answers from localStorage
    try {
      const saved = localStorage.getItem(storageKeyRef.current);
      if (saved) {
        const parsed = JSON.parse(saved);
        setState((prev) => ({ ...prev, answers: parsed }));
      }
    } catch (e) {}

    // Register session with backend
    fetch("/api/exams/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setState((prev) => ({
            ...prev,
            sessionId: data.sessionId,
            shortId: data.studentShortId,
            status: "IN_PROGRESS",
            timeLimitMinutes: data.timeLimitMinutes || 90,
          }));
        } else {
          setState((prev) => ({ ...prev, status: "IN_PROGRESS" }));
        }
      })
      .catch(() => {
        // Fallback gracefully even if offline
        setState((prev) => ({ ...prev, status: "IN_PROGRESS" }));
      });
  }, [config.studentName, config.grade, config.shortId]);

  // 2. Save answer and persist to localStorage
  const setAnswer = useCallback((questionId: string, value: any) => {
    setState((prev) => {
      const updated = { ...prev.answers, [questionId]: value };
      try {
        localStorage.setItem(storageKeyRef.current, JSON.stringify(updated));
      } catch (e) {}
      return { ...prev, answers: updated };
    });
  }, []);

  // 3. Submit Exam
  const submitExam = useCallback(
    async (cheated: boolean = false) => {
      setState((prev) => ({ ...prev, status: "SUBMITTING" }));

      try {
        const payload = {
          sessionId: state.sessionId,
          shortId: state.shortId || config.shortId,
          studentName: config.studentName,
          grade: config.grade,
          answers: state.answers,
          cheated,
          isTester: config.isTester,
        };

        const res = await fetch("/api/exams/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.success) {
          // Clear local storage on success
          try {
            localStorage.removeItem(storageKeyRef.current);
          } catch (e) {}

          setState((prev) => ({ ...prev, status: "SUBMITTED" }));
          return data;
        } else {
          throw new Error(data.error || "Submission failed");
        }
      } catch (err: any) {
        setState((prev) => ({ ...prev, status: "ERROR", error: err.message }));
        throw err;
      }
    },
    [state.sessionId, state.shortId, state.answers, config]
  );

  return {
    ...state,
    setAnswer,
    submitExam,
  };
}
