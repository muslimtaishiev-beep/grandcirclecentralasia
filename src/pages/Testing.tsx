import React, { useState, useEffect, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Reorder } from "framer-motion";
import { testsData } from "../data/testsData";
import { Question } from "../types";
import { getHourlyPIN, formatMathText, getCEFRLevel, fetchGasAPI } from "../lib/utils";

export default function Testing() {
  const safeGetSession = (key: string, defaultVal: any) => {
    try { 
      return sessionStorage.getItem(key) || localStorage.getItem("persist_" + key) || defaultVal; 
    } catch(e) { return defaultVal; }
  };
  
  const [studentName, setStudentName] = useState(() => safeGetSession("studentName", ""));
  const [enteredPin, setEnteredPin] = useState(() => safeGetSession("enteredPin", ""));
  const [phase, setPhase] = useState<"login" | "core" | "intermediate" | "english" | "final" | "suspended">(
    () => (safeGetSession("phase", "") as any) || "login"
  );
  const [isResumingEnglish, setIsResumingEnglish] = useState(false);
  const [resumeShortId, setResumeShortId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetake, setIsRetake] = useState(false);

  const [grade, setGrade] = useState<number | null>(() => {
    const saved = safeGetSession("grade", null);
    return saved ? Number(saved) : null;
  });
  const [started, setStarted] = useState(() => safeGetSession("started", "") === "true");
  const [finished, setFinished] = useState(() => safeGetSession("finished", "") === "true");
  const [disqualified, setDisqualified] = useState(() => safeGetSession("disqualified", "") === "true");
  const [consentGiven, setConsentGiven] = useState(() => safeGetSession("consentGiven", "") === "true");
  const [stopAudio, setStopAudio] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    try {
      const saved = safeGetSession("answers", "");
      if (saved) return JSON.parse(saved);
      const sId = safeGetSession("shortId", "");
      if (sId) {
        const backup = localStorage.getItem(`backup_answers_${sId}`);
        if (backup) {
          const parsed = JSON.parse(backup);
          if (parsed.answers) return parsed.answers;
        }
      }
    } catch(e) {}
    return {};
  });
  const [testId, setTestId] = useState(() => safeGetSession("testId", ""));
  const [shortId, setShortId] = useState(() => {
    const saved = safeGetSession("shortId", "");
    if (saved) return saved;
    const newId = Math.floor(100000 + Math.random() * 900000).toString();
    try { sessionStorage.setItem("shortId", newId); } catch(e) {}
    return newId;
  });
  const [qrToken, setQrToken] = useState(() => safeGetSession("qrToken", ""));
  const [pendingSubmission, setPendingSubmission] = useState(() => safeGetSession("pendingSubmission", "") === "true");
  const [resultData, setResultData] = useState<any>(() => {
    const saved = safeGetSession("resultData", "");
    return saved ? JSON.parse(saved) : null;
  });
  
  const [totalBlurTime, setTotalBlurTime] = useState<number>(() => {
    const saved = safeGetSession("totalBlurTime", "0");
    return Number(saved);
  });
  const [isFullscreenViolation, setIsFullscreenViolation] = useState(() => safeGetSession("isFullscreenViolation", "") === "true");
  
  const blurTimeout = useRef<NodeJS.Timeout | null>(null);
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Sync state to sessionStorage and localStorage for OS tab kill protection
  useEffect(() => {
    try {
      const setBoth = (k: string, v: string) => { sessionStorage.setItem(k, v); localStorage.setItem("persist_" + k, v); };
      
      setBoth("studentName", studentName);
      if (grade) setBoth("grade", String(grade));
      setBoth("started", String(started));
      setBoth("finished", String(finished));
      setBoth("disqualified", String(disqualified));
      setBoth("consentGiven", String(consentGiven));
      setBoth("answers", JSON.stringify(answers));
      
      if (shortId) {
        localStorage.setItem(`backup_answers_${shortId}`, JSON.stringify({ answers, phase, grade, studentName }));
      }
      
      setBoth("testId", testId);
      setBoth("enteredPin", enteredPin);
      setBoth("shortId", shortId);
      setBoth("qrToken", qrToken);
      setBoth("pendingSubmission", String(pendingSubmission));
      if (resultData) setBoth("resultData", JSON.stringify(resultData));
      setBoth("phase", phase);
    } catch(e) {}
  }, [studentName, grade, started, finished, disqualified, consentGiven, answers, testId, shortId, qrToken, pendingSubmission, resultData, phase]);

  // Prevent accidental F5/Closing
  useEffect(() => {
    if (!started || finished || disqualified) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Вы уверены? Ваш результат может быть аннулирован!";
      return "Вы уверены? Ваш результат может быть аннулирован!";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [started, finished, disqualified]);

  // --- ANTI-CHEAT LOGIC V2 ---
  useEffect(() => {
    // Restore and check cumulative blur time on mount/reload
    if (started && !finished && !disqualified) {
      const lastBlur = safeGetSession("lastBlurTime", null);
      if (lastBlur) {
        const elapsed = Date.now() - parseInt(lastBlur, 10);
        const newTotal = totalBlurTime + Math.max(0, elapsed);
        setTotalBlurTime(newTotal);
        sessionStorage.setItem("totalBlurTime", newTotal.toString());
        localStorage.setItem("persist_totalBlurTime", newTotal.toString());
        localStorage.removeItem("persist_lastBlurTime");
        sessionStorage.removeItem("lastBlurTime");
        if (newTotal > 30000) {
           suspendTest(phase);
        }
      }
    }
  }, [started]);

  useEffect(() => {
    if (!started || finished || disqualified) return;

    const handleCheating = () => {
      // 1. For mobile: ignore blur if document is still visible (avoids native dropdown/keyboard bugs)
      const isMobile = window.innerWidth < 768;
      if (isMobile && !document.hidden) return;

      // 2. Log when they left
      if (!safeGetSession("lastBlurTime", null)) {
        const now = Date.now().toString();
        sessionStorage.setItem("lastBlurTime", now);
        localStorage.setItem("persist_lastBlurTime", now);
      }
      
      // 3. Start a timer just in case they don't trigger focus/visibilitychange (desktop hover bug)
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
      
      const timeRemaining = Math.max(0, 30000 - totalBlurTime);
      blurTimeout.current = setTimeout(() => {
        const currentPhase = phaseRef.current;
        if (currentPhase !== 'core' && currentPhase !== 'english') return;
        
        // Safety net: if the document actually has focus right now (spurious blur event), ignore
        if (document.hasFocus && document.hasFocus() && !document.hidden) {
          sessionStorage.removeItem("lastBlurTime");
          localStorage.removeItem("persist_lastBlurTime");
          return;
        }

        // Time is up! Suspend the test instead of final submission
        suspendTest(currentPhase);
      }, timeRemaining);
    };

    const handleFocus = () => {
      if (blurTimeout.current) {
        clearTimeout(blurTimeout.current);
        blurTimeout.current = null;
      }
      
      const lastBlur = safeGetSession("lastBlurTime", null);
      if (lastBlur) {
        const elapsed = Date.now() - parseInt(lastBlur, 10);
        const newTotal = totalBlurTime + Math.max(0, elapsed);
        setTotalBlurTime(newTotal);
        sessionStorage.setItem("totalBlurTime", newTotal.toString());
        localStorage.setItem("persist_totalBlurTime", newTotal.toString());
        sessionStorage.removeItem("lastBlurTime");
        localStorage.removeItem("persist_lastBlurTime");
        
        if (newTotal > 30000) {
          const currentPhase = phaseRef.current;
          if (currentPhase === 'core' || currentPhase === 'english') {
            suspendTest(currentPhase);
          }
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) handleCheating();
      else handleFocus();
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        setIsFullscreenViolation(true);
      }
    };

    window.addEventListener("blur", handleCheating);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("blur", handleCheating);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
    };
  }, [started, finished, disqualified, phase, totalBlurTime]); // Added totalBlurTime

  // Block copy/paste/context menu globally when test is active
  useEffect(() => {
    if (!started || finished) return;
    const preventAction = (e: Event) => e.preventDefault();
    const preventShortcuts = (e: KeyboardEvent) => {
      if (e.key === "F12") e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (["p", "s", "c", "v", "u"].includes(k)) e.preventDefault();
      }
    };
    
    document.addEventListener("contextmenu", preventAction);
    document.addEventListener("copy", preventAction);
    document.addEventListener("paste", preventAction);
    document.addEventListener("selectstart", preventAction);
    document.addEventListener("keydown", preventShortcuts);

    return () => {
      document.removeEventListener("contextmenu", preventAction);
      document.removeEventListener("copy", preventAction);
      document.removeEventListener("paste", preventAction);
      document.removeEventListener("selectstart", preventAction);
      document.removeEventListener("keydown", preventShortcuts);
    };
  }, [started, finished]);

  // Audio stop listener for cheaters
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!started || finished) return;
        if (disqualified) {
          setStopAudio(true); // Silence the song
        }
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [disqualified, started, finished]);

  // Reliable Audio Playback for Cheating
  useEffect(() => {
    if (disqualified && !stopAudio) {
      const audio = new Audio("/meme.mp3");
      audio.loop = true;
      audio.play().catch(e => console.warn("Autoplay blocked by browser:", e));
      
      return () => {
        audio.pause();
      };
    }
  }, [disqualified, stopAudio]);

  const resumeInterruptedTest = async () => {
    if (!resumeShortId.trim()) { alert("Введите Test ID"); return; }
    
    // Check if manager authorized retake
    try {
      const res = await fetch(`/api/public/check-retake/${resumeShortId.trim()}`);
      const data = await res.json();
      if (!data.allowed) {
        alert("Отказ. Менеджер еще не разрешил вам продолжить прерванный тест. Обратитесь к менеджеру.");
        return;
      }
    } catch(e) {
      alert("Ошибка проверки разрешения сервера. Проверьте интернет-соединение.");
      return;
    }
    
    const backupStr = localStorage.getItem(`backup_answers_${resumeShortId.trim()}`);
    if (!backupStr) {
      alert("Сохраненных ответов на этом устройстве не найдено. Обратитесь к менеджеру.");
      return;
    }
    try {
      const backup = JSON.parse(backupStr);
      setAnswers(backup.answers || {});
      setPhase(backup.phase || "core");
      setGrade(backup.grade || null);
      setStudentName(backup.studentName || "Восстановленный Ученик");
      setShortId(resumeShortId.trim());
      setIsRetake(true);
      setDisqualified(false);
      setStarted(true);
      setFinished(false);
      
      const docElm = document.documentElement as any;
      if (docElm.requestFullscreen) {
        const p = docElm.requestFullscreen();
        if (p && p.catch) p.catch(()=>{});
      }
    } catch(e) {
      alert("Ошибка восстановления данных.");
    }
  };

  const startTest = async () => {
    if (isSubmitting) return; // Prevent double-tap
    setIsSubmitting(true);
    try {
      if (isResumingEnglish) {
         if (!resumeShortId.trim()) return alert("Введите Test ID");
         if (!enteredPin.trim()) return alert("Введите PIN");
         
         const EXPECTED_PIN = getHourlyPIN();
         const TESTER_PIN = import.meta.env.VITE_TESTER_PIN;
         if (enteredPin !== EXPECTED_PIN && (!TESTER_PIN || enteredPin !== TESTER_PIN)) {
            return alert("Неверный PIN-код. Узнайте актуальный PIN у менеджера.");
         }
         
         try {
           const data = await fetchGasAPI("/api/gas", { action: "getStudentByShortId", shortId: resumeShortId });
           if (!data.success) return alert(data.error || "Не найдено");
           
           const student = data.student;
           setShortId(student.shortId);
           setGrade(student.grade);
           setStudentName(student.studentName);
           setResultData({
             totalScore: student.totalScore,
             scores: { russian: student.russian, math: student.math, logic: student.logic, english: student.english }
           });
           if (student.english !== "") {
             return alert("Английский тест уже был сдан для этого Test ID!");
           }
           if (document.documentElement.requestFullscreen) {
             const p = document.documentElement.requestFullscreen();
             if (p && p.catch) p.catch(()=>{});
           }
           setStarted(true);
           setPhase("english");
         } catch (e:any) { alert("Ошибка: " + e.message); }
         return;
      }

      if (!grade) return alert("Выберите класс!");
      if (!studentName.trim() || !/^[А-Яа-яЁёA-Za-z-]+\s+[А-Яа-яЁёA-Za-z-]+/u.test(studentName.trim())) {
        return alert("Введите полное Фамилию и Имя через пробел.");
      }
      if (!consentGiven) {
        return alert("Пожалуйста, подтвердите согласие на обработку данных.");
      }
      if (!enteredPin) {
        return alert("Введите PIN-код менеджера.");
      }
      
      const EXPECTED_PIN = getHourlyPIN();
      const TESTER_PIN = import.meta.env.VITE_TESTER_PIN;
      if (enteredPin !== EXPECTED_PIN && (!TESTER_PIN || enteredPin !== TESTER_PIN)) {
        return alert("Неверный PIN-код. Узнайте актуальный PIN у менеджера.");
      }

      try {
        const doc = document.documentElement as any;
        if (doc.requestFullscreen) {
          const p = doc.requestFullscreen();
          if (p && p.catch) p.catch(()=>{});
        } else if (doc.webkitRequestFullscreen) {
          const p = doc.webkitRequestFullscreen();
          if (p && p.catch) p.catch(()=>{});
        }
      } catch(e) { console.warn("Fullscreen API not supported", e); }
      
      const newTestId = testId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
      if (!testId) setTestId(newTestId);
      
      // Notify backend that student has started the test
      fetchGasAPI("/api/gas", {
         action: "registerStudent",
         testId: newTestId,
         shortId: shortId,
         studentName,
         grade,
         isTester: TESTER_PIN && enteredPin === TESTER_PIN
      }).catch(e => console.error("Failed to register student:", e));

      setStarted(true);
      setPhase("core");
    } finally {
      setIsSubmitting(false);
    }
  };

  
  const submitCoreTest = async (isDisqualified = false) => {
    // Immediately clear any pending anti-cheat timers when user clicks submit
    if (blurTimeout.current) { clearTimeout(blurTimeout.current); blurTimeout.current = null; }
    if (isSubmitting) return;
    setIsSubmitting(true);
    if (isDisqualified) {
      setDisqualified(true);
    }
    const payloadTestId = testId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
    if (!testId) setTestId(payloadTestId);

    const tokenUrl = `https://studyfreeforum.com/manager/form?shortId=${shortId}`;
    setQrToken(tokenUrl);

    const TESTER_PIN = import.meta.env.VITE_TESTER_PIN;
    const isTester = TESTER_PIN && enteredPin === TESTER_PIN;

    // Send only russian, math, logic answers
    const coreAnswers = {};
    if (grade && testsData[grade]) {
        [...(testsData[grade].russian||[]), ...(testsData[grade].math||[]), ...(testsData[grade].logic||[])].forEach(q => {
            if (answers[q.id]) coreAnswers[q.id] = answers[q.id];
        });
    }

    const payload = {
      action: "submitTest",
      testId: payloadTestId,
      shortId: shortId,
      studentName,
      grade,
      answers: coreAnswers,
      cheated: isDisqualified,
      isRetake,
      testerPin: isTester ? enteredPin : undefined
    };

    if (!isTester) localStorage.setItem("lastTestTime", Date.now().toString());

    try {
      const data = await fetchGasAPI("/api/gas", payload);
      if (data.success) {
        // Clear anti-cheat timer on successful submit to prevent race condition
        if (blurTimeout.current) { clearTimeout(blurTimeout.current); blurTimeout.current = null; }
        setResultData({
          totalScore: data.totalScore,
          scores: data.scores,
          cheated: data.cheated
        });
        setPendingSubmission(false);
        // Do not set finished here! We move to intermediate phase.
        setPhase("intermediate");
      } else {
        if (data.error && (data.error.includes("уже сдавали") || data.error.includes("already submitted") || data.error.includes("already"))) {
             // Recover student and proceed gracefully
             if (blurTimeout.current) { clearTimeout(blurTimeout.current); blurTimeout.current = null; }
             try {
               const recoverData = await fetchGasAPI("/api/gas", { action: "getStudentByShortId", shortId });
               if (recoverData.success) {
                 setResultData({
                   totalScore: recoverData.student.totalScore,
                   scores: { russian: recoverData.student.russian, math: recoverData.student.math, logic: recoverData.student.logic, english: recoverData.student.english },
                   diagnosticsReport: recoverData.student.diagnosticsReport
                 });
                 setPhase("intermediate");
                 return;
               }
             } catch(e) {}
             alert(data.error);
             return;
        }
        throw new Error(data.error);
      }
    } catch (e: any) {
      console.error(e);
      // Save to localStorage for offline retry
      try { localStorage.setItem('offline_test_' + payloadTestId, JSON.stringify(payload)); } catch(storageErr) {}
      alert("Ошибка отправки теста: " + e.message + ". Ваши ответы сохранены, попробуйте еще раз.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitEnglishTest = async (isDisqualified = false) => {
    // Immediately clear any pending anti-cheat timers when user clicks submit
    if (blurTimeout.current) { clearTimeout(blurTimeout.current); blurTimeout.current = null; }
    if (isSubmitting) return;
    setIsSubmitting(true);
    if (isDisqualified) setDisqualified(true);

    const TESTER_PIN = import.meta.env.VITE_TESTER_PIN;
    const isTester = TESTER_PIN && enteredPin === TESTER_PIN;

    const engAnswers = {};
    if (grade && testsData[grade] && testsData[grade].english) {
        testsData[grade].english.forEach(q => {
            if (answers[q.id]) engAnswers[q.id] = answers[q.id];
        });
    }

    const payload = {
      action: "submitEnglishTest",
      shortId: shortId,
      grade,
      answers: engAnswers,
      cheated: isDisqualified,
      isRetake,
      testerPin: isTester ? enteredPin : undefined
    };

    try {
      const data = await fetchGasAPI("/api/gas", payload);
      if (data.success) {
        if (blurTimeout.current) { clearTimeout(blurTimeout.current); blurTimeout.current = null; }
        setResultData((prev: any) => ({
           ...prev,
           scores: { ...(prev?.scores || {}), english: data.scores.english },
           diagnosticsReport: data.diagnosticsReport
        }));
        setFinished(true);
        setPhase("final");
        try {
          const exitDoc = document as any;
          if (exitDoc.exitFullscreen) {
            const p = exitDoc.exitFullscreen();
            if (p && p.catch) p.catch(()=>{});
          }
          else if (exitDoc.webkitExitFullscreen) {
            const p = exitDoc.webkitExitFullscreen();
            if (p && p.catch) p.catch(()=>{});
          }
        } catch(e) {}
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      console.error(e);
      // Save to localStorage for offline retry
      try { localStorage.setItem('offline_test_eng_' + shortId, JSON.stringify(payload)); } catch(storageErr) {}
      alert("Ошибка отправки английского: " + e.message + ". Ваши ответы сохранены, попробуйте еще раз.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const suspendTest = async (currentPhase: string) => {
    if (blurTimeout.current) { clearTimeout(blurTimeout.current); blurTimeout.current = null; }
    if (isSubmitting) return;
    setIsSubmitting(true);
    setDisqualified(true);

    const TESTER_PIN = import.meta.env.VITE_TESTER_PIN;
    const isTester = TESTER_PIN && enteredPin === TESTER_PIN;

    const payloadTestId = testId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
    if (!testId) setTestId(payloadTestId);

    const currentAnswers: Record<string, string> = {};
    if (grade && testsData[grade]) {
      if (currentPhase === 'core') {
        [...(testsData[grade].russian||[]), ...(testsData[grade].math||[]), ...(testsData[grade].logic||[])].forEach(q => {
            if (answers[q.id]) currentAnswers[q.id] = answers[q.id];
        });
      } else if (currentPhase === 'english') {
        (testsData[grade].english||[]).forEach(q => {
            if (answers[q.id]) currentAnswers[q.id] = answers[q.id];
        });
      }
    }

    const payload = {
      action: "suspendTest",
      testId: payloadTestId,
      shortId: shortId,
      studentName,
      grade,
      answers: currentAnswers,
      phase: currentPhase,
      testerPin: isTester ? enteredPin : undefined
    };

    try {
      await fetchGasAPI("/api/gas", payload);
      setPhase("suspended");
      // Keep the currentPhase around to know where to resume
      sessionStorage.setItem("suspendedPhase", currentPhase);
    } catch (e: any) {
      console.error("Failed to suspend:", e);
      setPhase("suspended"); // Still block UI locally
      sessionStorage.setItem("suspendedPhase", currentPhase);
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkSuspendStatus = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const data = await fetchGasAPI("/api/gas", { action: "checkSuspendStatus", shortId });
      if (data.success && data.status !== "ПРИОСТАНОВЛЕН") {
        setDisqualified(false);
        const resumePhase = sessionStorage.getItem("suspendedPhase") || "core";
        setPhase(resumePhase as any);
        setTotalBlurTime(0);
        sessionStorage.setItem("totalBlurTime", "0");
        
        // Restore answers from backend if available
        if (data.answers) {
          try {
            const parsed = JSON.parse(data.answers);
            setAnswers(prev => ({ ...prev, ...parsed }));
          } catch(e) {}
        }
        
        alert("Разрешение получено! Вы можете продолжить тест.");
      } else {
        alert("Менеджер еще не дал разрешение на продолжение теста.");
      }
    } catch (e: any) {
      alert("Ошибка при проверке статуса: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [submitError, setSubmitError] = useState<string | null>(null);

  const retrySubmission = async () => {
    // Find all offline tests in localStorage
    const offlineKeys = Object.keys(localStorage).filter(key => key.startsWith("offline_test_"));
    
    if (offlineKeys.length === 0) {
      setPendingSubmission(false);
      return;
    }

    for (const key of offlineKeys) {
      const payloadStr = localStorage.getItem(key);
      if (payloadStr) {
        try {
          const payloadObj = JSON.parse(payloadStr);
          const data = await fetchGasAPI("/api/gas", payloadObj);

          if (data.success) {
            localStorage.removeItem(key);
          } else {
            throw new Error(data.error || "Unknown GAS error");
          }
        } catch(e: any) {
          setSubmitError(e.message);
          alert(`Ошибка сети: ${e.message}`);
          return; // Stop on first error
        }
      }
    }
    
    // If all succeeded
    setPendingSubmission(false);
    setSubmitError(null);
    alert("Данные успешно отправлены!");
  };


  // Fullscreen Violation UI
  if (isFullscreenViolation) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center z-50">
        <h1 className="text-3xl font-bold mb-4">Нарушение режима</h1>
        <p className="text-lg text-slate-300 mb-8 max-w-md">Вы покинули полноэкранный режим. Тестирование должно проходить только в полноэкранном режиме, чтобы избежать списывания.</p>
        <button 
          onClick={() => {
            const doc = document.documentElement as any;
            if (doc.requestFullscreen) doc.requestFullscreen().catch(()=>{});
            else if (doc.webkitRequestFullscreen) doc.webkitRequestFullscreen().catch(()=>{});
            setIsFullscreenViolation(false);
          }}
          className="px-6 py-3 bg-blue-600 rounded-xl font-semibold hover:bg-blue-500 transition-colors"
        >
          Вернуться к тесту
        </button>
      </div>
    );
  }

  // Fullscreen Violation UI
  if (isFullscreenViolation) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center z-50">
        <h1 className="text-3xl font-bold mb-4">Нарушение режима</h1>
        <p className="text-lg text-slate-300 mb-8 max-w-md">Вы покинули полноэкранный режим. Тестирование должно проходить только в полноэкранном режиме, чтобы избежать списывания.</p>
        <button 
          onClick={() => {
            const doc = document.documentElement as any;
            if (doc.requestFullscreen) doc.requestFullscreen().catch(()=>{});
            else if (doc.webkitRequestFullscreen) doc.webkitRequestFullscreen().catch(()=>{});
            setIsFullscreenViolation(false);
          }}
          className="px-6 py-3 bg-blue-600 rounded-xl font-semibold hover:bg-blue-500 transition-colors"
        >
          Вернуться к тесту
        </button>
      </div>
    );
  }

  if (phase === "suspended") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-500 to-amber-700"></div>
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">⏸️</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Тест приостановлен</h2>
          <p className="text-slate-600 mb-6">Вы свернули вкладку или покинули страницу во время тестирования. Для продолжения необходимо разрешение менеджера.</p>
          
          <p className="text-sm text-slate-500 font-medium border-t pt-4">Покажите этот код менеджеру:</p>
          <div className="mt-3 text-4xl font-mono font-bold text-amber-600 tracking-widest bg-amber-50 py-3 rounded-xl border border-amber-100 mb-6">
            {shortId}
          </div>
          
          <button 
            onClick={checkSuspendStatus}
            disabled={isSubmitting}
            className={`w-full py-4 rounded-xl font-bold text-white transition-all transform hover:scale-[1.02] active:scale-[0.98] mb-4 ${
              isSubmitting ? "bg-slate-400 cursor-not-allowed" : "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700"
            }`}
          >
            {isSubmitting ? "Проверка..." : "Проверить разрешение"}
          </button>
        </div>
      </div>
    );
  }

  if (disqualified && phase !== "suspended") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 to-red-700"></div>
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">!</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Вы пойманы на списывании</h2>
        <p className="text-slate-600 mb-6">Вы покинули страницу во время тестирования. Результат аннулирован в соответствии с правилами.</p>
        <audio autoPlay src="https://www.myinstants.com/media/sounds/directed-by-robert-b_voI2Z4T.mp3" />
        <p className="text-sm text-slate-500 font-medium border-t pt-4">Покажите этот код менеджеру:</p>
        <div className="mt-3 text-4xl font-mono font-bold text-red-600 tracking-widest bg-red-50 py-3 rounded-xl border border-red-100 mb-6">
          {shortId}
        </div>
        
        <button 
          onClick={() => {
            sessionStorage.clear();
            window.location.reload();
          }}
          className="text-sm text-slate-500 hover:text-slate-800 underline transition-colors"
        >
          Закрыть и вернуться на главную
        </button>
        </div>
      </div>
    );
  }

  
  if (phase === "intermediate") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center select-none">
        <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-100">
          <h1 className="text-4xl font-extrabold text-blue-900 mb-6">Отлично! Основной тест сдан 🎉</h1>
          <p className="text-xl text-slate-600 mb-8">
            Ваш уникальный номер (Test ID): <span className="font-mono font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded">{shortId}</span>
          </p>
          <div className="bg-amber-50 p-6 rounded-xl border border-amber-200 mb-8 text-amber-800 text-left">
            <h3 className="font-bold text-lg mb-2">Что дальше?</h3>
            <p>Остался тест по английскому языку. Вы можете немного отдохнуть и сдать его прямо сейчас, либо завершить сессию и сдать его позже, введя свой Test ID на главном экране.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => {
                setPhase("english");
                if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(()=>{});
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all"
            >
              Сдать английский сейчас
            </button>
            <button
              onClick={() => {
                setFinished(true);
                setPhase("final");
                if (document.exitFullscreen) document.exitFullscreen().catch(()=>{});
              }}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-4 px-6 rounded-xl text-lg transition-all"
            >
              Завершить и выйти
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "final" || finished) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-md w-full border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
          
          {disqualified ? (
            <>
              <h1 className="text-4xl font-black text-red-600 mb-4 uppercase tracking-wider">Дисквалификация</h1>
              <p className="text-lg text-slate-600 mb-8 font-medium">Ваш тест был принудительно завершен из-за нарушения правил.</p>
            </>
          ) : (
            <>
              <h1 className="text-4xl font-extrabold text-blue-900 mb-4">Тест завершен!</h1>
              <p className="text-lg text-slate-600 mb-8 font-medium">Спасибо за участие. Ваши ответы сохранены.</p>
            </>
          )}

          {resultData ? (
            <div className="mb-6">
              {(() => {
                let maxRu = 0, maxMa = 0, maxLo = 0, maxEn = 0;
                if (grade && testsData[grade]) {
                  maxRu = testsData[grade].russian.reduce((sum, q) => sum + (q.points || 1), 0);
                  maxMa = testsData[grade].math.reduce((sum, q) => sum + (q.points || 1), 0);
                  if (testsData[grade].logic) maxLo = testsData[grade].logic.reduce((sum, q) => sum + (q.points || 1), 0);
                  if (testsData[grade].english) maxEn = testsData[grade].english.reduce((sum, q) => sum + (q.points || 1), 0);
                }
                const totalMax = maxRu + maxMa + maxLo;
                const percent = totalMax > 0 ? Math.round((resultData.totalScore / totalMax) * 100) : 0;
                
                return (
                  <>
                  {resultData && resultData.scores && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-left">
                    <h3 className="font-bold text-green-800 text-lg mb-3 text-center">Основной тест:</h3>
                    <div className="flex justify-between items-center mb-1 text-green-700">
                      <span>Русский язык:</span><span className="font-bold">{resultData.scores.russian || 0}</span>
                    </div>
                    <div className="flex justify-between items-center mb-1 text-green-700">
                      <span>Математика:</span><span className="font-bold">{resultData.scores.math || 0}</span>
                    </div>
                    <div className="flex justify-between items-center mb-1 text-green-700">
                      <span>Логика:</span><span className="font-bold">{resultData.scores.logic || 0}</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-green-200 flex flex-col items-end font-bold text-green-900 text-lg">
                      <div className="w-full flex justify-between"><span>Общий балл:</span><span>{resultData.totalScore || 0} из {totalMax}</span></div>
                      <div className="text-sm text-green-700 font-medium">({isNaN(percent) ? 0 : percent}% верных)</div>
                    </div>
                  </div>
                  )}
                  
                  {resultData && resultData.scores && resultData.scores.english !== undefined && resultData.scores.english !== "" && maxEn > 0 && (
                    <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-left">
                      <h3 className="font-bold text-indigo-800 text-lg mb-3 text-center">Английский язык:</h3>
                      {(() => {
                        const cefr = getCEFRLevel(grade!, maxEn, Number(resultData.scores?.english));
                        if (!cefr) return null;
                        return (
                          <div className="flex flex-col items-center">
                            <div className="text-3xl mb-2">{cefr.icon}</div>
                            <div className="font-bold text-indigo-900 text-xl text-center">{cefr.actualLevel}</div>
                            <div className="text-indigo-700 mt-1 font-medium">Усвоено: {cefr.percent}%</div>
                            {cefr.icon !== "✅" && (
                              <div className="text-xs text-indigo-500 mt-2 text-center">Ожидаемый уровень: {cefr.targetLevel}</div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  
                  {resultData && resultData.diagnosticsReport && (
                    <div className="mb-6 p-4 bg-white border border-slate-200 rounded-xl text-left shadow-sm">
                      <h3 className="font-bold text-slate-800 text-lg mb-3 border-b pb-2 flex items-center">
                        <span className="mr-2">📊</span> Аналитика знаний (Темы)
                      </h3>
                      <div className="text-sm text-slate-700 whitespace-pre-wrap font-medium leading-relaxed">
                        {resultData.diagnosticsReport}
                      </div>
                    </div>
                  )}
                  </>
                );
              })()}
            </div>
          ) : (
            <p className="text-sm text-slate-500 mb-6">Результаты обрабатываются. Ожидайте вердикт от менеджера.</p>
          )}

          <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-sm font-medium text-blue-800 mb-2">ID Теста для менеджера:</p>
            <p className="text-3xl font-mono font-bold tracking-widest text-blue-600">{shortId}</p>
          </div>
          
          <button onClick={() => { sessionStorage.clear(); window.location.reload(); }} className="w-full font-bold text-slate-500 hover:text-slate-700 py-2">
            Вернуться к входу
          </button>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6 text-center">Входное тестирование</h1>
          
          <div className="space-y-4 mb-6">
            {!isResumingEnglish && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">ФИО Ученика:</label>
                  <input
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          type="text" 
                    placeholder="Иванов Иван Иванович"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full border rounded-xl p-3 bg-slate-50"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Выберите ваш класс:</label>
                  <select 
                    className="w-full border rounded-xl p-3 bg-slate-50"
                    value={grade || ""}
                    onChange={(e) => setGrade(Number(e.target.value))}
                  >
                    <option value="">Не выбран</option>
                    {[7,8,9,10,11].map(g => <option key={g} value={g}>{g} класс</option>)}
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">PIN-код аудитории (спросите у менеджера):</label>
              <input
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      type="text" 
                placeholder="Например: 4812"
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                className="w-full border rounded-xl p-3 bg-slate-50 font-mono tracking-widest text-lg"
              />
            </div>
          </div>
          
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-amber-800 text-sm">
            <strong>Внимание! (Anti-Cheat)</strong>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Тест откроется на весь экран.</li>
              <li>Если вы закроете тест, свернете окно или переключитесь на другую вкладку более чем на 2 секунды — тест автоматически аннулируется с нулем баллов.</li>
              <li>Не пытайтесь обновить страницу во время прохождения теста.</li>
              <li>Копирование и вставка отключены.</li>
            </ul>
          </div>

          <div className="mb-6 flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <input 
              type="checkbox" 
              id="consent"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="mt-1 w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 flex-shrink-0 cursor-pointer"
            />
            <div className="text-sm text-slate-600 leading-relaxed">
              <label htmlFor="consent" className="cursor-pointer block mb-2 select-none">
                Я, являясь родителем (законным представителем) несовершеннолетнего кандидата на обучение, даю <a href="/privacy" target="_blank" className="text-blue-600 hover:underline">согласие</a> ОсОО «Академия будущих лидеров» (ИНН 03004202510435) и ОсОО «ЛС Центр» на сбор, обработку и трансграничную передачу персональных данных (ФИО, телефон, класс, результаты тестирования и психологического анкетирования, данные античит-системы) в соответствии с Цифровым кодексом Кыргызской Республики для целей проведения вступительных испытаний, а также принимаю условия <a href="/terms" target="_blank" className="text-blue-600 hover:underline">Пользовательского соглашения</a>.
              </label>
              <p className="text-xs text-slate-400 mt-2 border-t pt-2">
                Нажимая кнопку "Начать тест" и отмечая настоящее согласие, вы подтверждаете, что являетесь законным родителем или опекуном несовершеннолетнего кандидата и обладаете всеми законными правами на предоставление его персональных данных.
              </p>
            </div>
          </div>

          
          {!isResumingEnglish ? (
            <>
              <button 
                onClick={startTest}
                disabled={!grade || !studentName.trim() || !enteredPin.trim() || !consentGiven}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-lg disabled:opacity-50 hover:bg-blue-700 transition shadow-lg mb-3"
              >
                Начать тест
              </button>
              <button 
                onClick={() => setIsResumingEnglish(true)}
                className="w-full py-3 bg-white text-blue-600 border-2 border-blue-600 rounded-xl font-bold text-lg hover:bg-blue-50 transition"
              >
                Продолжить тест по английскому
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Ваш Test ID:</label>
                <input
                  type="text"
                  value={resumeShortId}
                  onChange={(e) => setResumeShortId(e.target.value)}
                  className="w-full border rounded-xl p-3 bg-slate-50 font-mono tracking-widest text-center"
                  placeholder="Например: 123456"
                />
              </div>
              <button 
                onClick={startTest}
                disabled={!resumeShortId.trim() || !enteredPin.trim()}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-lg disabled:opacity-50 hover:bg-indigo-700 transition shadow-lg"
              >
                Войти и начать английский
              </button>
              <button 
                onClick={resumeInterruptedTest}
                disabled={!resumeShortId.trim() || !enteredPin.trim()}
                className="w-full py-3 bg-amber-600 text-white rounded-xl font-bold text-lg disabled:opacity-50 hover:bg-amber-700 transition shadow-lg"
              >
                Продолжить прерванный тест
              </button>
              <button 
                onClick={() => setIsResumingEnglish(false)}
                className="w-full py-2 text-slate-500 font-bold hover:text-slate-700 transition"
              >
                Назад
              </button>
            </div>
          )}

        </div>
      </div>
    );
  }

  const test = testsData[grade!];
  if (!test) {
    return <div className="min-h-screen flex items-center justify-center p-4">Ошибка загрузки теста. Обновите страницу.</div>;
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 pb-20 select-none relative">
      {isSubmitting && (
        <div className="fixed inset-0 bg-white/70 backdrop-blur-sm z-50 flex items-center justify-center">
           <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center border border-blue-100">
              <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mb-6"></div>
              <div className="text-xl font-bold text-slate-800">Сохранение результатов...</div>
              <div className="text-sm text-slate-500 mt-2 font-medium">Пожалуйста, подождите (до 15 секунд)</div>
           </div>
        </div>
      )}

      <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
        <div className="font-bold text-lg">Тестирование: {grade} класс</div>
        <button 
          onClick={() => phase === "english" ? submitEnglishTest(false) : submitCoreTest(false)}
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
        >
          {isSubmitting ? "Сохраняем..." : "Завершить тест"}
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-12">
        {(phase === "core" 
          ? [
              { title: "Русский язык", q: test.russian }, 
              { title: "Математика", q: test.math }, 
              { title: "Логика", q: test.logic }
            ]
          : [
              { title: "Английский язык", q: test.english }
            ]
        ).filter(s => s.q && s.q.length > 0).map((section, idx) => (
          <div key={idx}>
            <h2 className="text-2xl font-bold mb-6 text-blue-600">{section.title}</h2>
            <div className="space-y-8">
              {section.q.map((q: Question, i: number) => (
                <div key={q.id} className="bg-slate-50 p-6 rounded-2xl border">
                  <div className="font-medium text-lg text-slate-800 whitespace-pre-wrap mb-4">
                    {q.instruction && (
                      <div className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-3 bg-blue-50 inline-block px-3 py-1 rounded">
                        {q.instruction}
                      </div>
                    )}
                    {q.html ? (
                      <div dangerouslySetInnerHTML={{ __html: `${i + 1}. ${q.html}` }} />
                    ) : (
                      <>{i + 1}. {formatMathText(q.text)}</>
                    )}
                  </div>
                  
                  {q.type === "multiple_choice" ? (
                    <div className="space-y-3">
                      {q.options?.map((opt, i) => (
                        <label key={opt} className="flex items-center space-x-3 cursor-pointer">
                          <input 
                            type="radio" 
                            name={q.id} 
                            value={opt}
                            checked={answers[q.id] === opt}
                            onChange={(e) => setAnswers({...answers, [q.id]: e.target.value})}
                            className="w-4 h-4 text-blue-600 border-slate-300"
                          />
                          {q.optionsHtml && q.optionsHtml[i] ? (
                            <span className="text-slate-700" dangerouslySetInnerHTML={{__html: q.optionsHtml[i]}} />
                          ) : (
                            <span className="text-slate-700">{formatMathText(opt)}</span>
                          )}
                        </label>
                      ))}
                    </div>
                  ) : q.type === "two_step" ? (
                    <div className="space-y-4">
                      <div className="space-y-3">
                        {q.options?.map((opt, optIndex) => {
                          const currentAns = answers[q.id] || "|";
                          const optPart = currentAns.split("|")[0];
                          const optionNumber = String(optIndex + 1);
                          return (
                            <label key={opt} className="flex items-center space-x-3 cursor-pointer">
                              <input 
                                type="radio" 
                                name={q.id} 
                                checked={optPart === optionNumber}
                                onChange={() => {
                                  const textPart = (answers[q.id] || "|").split("|")[1] || "";
                                  setAnswers({...answers, [q.id]: `${optionNumber}|${textPart}`});
                                }}
                                className="w-4 h-4 text-blue-600 border-slate-300"
                              />
                              <span className="text-slate-700">{formatMathText(opt)}</span>
                            </label>
                          );
                        })}
                      </div>
                      {(answers[q.id] || "").split("|")[0] && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                          <div className="font-bold text-blue-800 mb-2">Шаг 2</div>
                          <div className="text-sm text-blue-700 mb-3">{q.step2Text || "Запишите ваш ответ в поле ниже."}</div>
                          <input
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      type="text" 
                            placeholder="Ваш ответ..."
                            value={(answers[q.id] || "|").split("|")[1] || ""}
                            onChange={(e) => {
                              const optPart = (answers[q.id] || "|").split("|")[0];
                              setAnswers({...answers, [q.id]: `${optPart}|${e.target.value}`});
                            }}
                            className="w-full border-blue-200 focus:border-blue-500 rounded-xl p-3 bg-white"
                          />
                        </div>
                      )}
                    </div>
                  ) : q.type === "inline_dropdown" ? (
                    <div className="mt-4 text-slate-800 text-lg leading-relaxed">
                      {q.text.split("[gap]").map((part, pIdx, arr) => (
                        <React.Fragment key={pIdx}>
                          <span dangerouslySetInnerHTML={{ __html: part }} />
                          {pIdx < arr.length - 1 && (
                            <select
                              value={answers[q.id] || ""}
                              onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                              className="mx-2 p-1 border-b-2 border-blue-400 bg-blue-50/50 outline-none focus:border-blue-600 focus:bg-blue-100 rounded-t transition-colors text-blue-800 font-medium cursor-pointer"
                            >
                              <option value="" disabled>---</option>
                              {q.inlineOptions?.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  ) : q.type === "logic_matrix" ? (
                    <div className="overflow-x-auto mt-4">
                      <table className="min-w-full bg-white border border-slate-200 rounded-lg">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="p-3 text-left"></th>
                            {q.matrixCols?.map(col => <th key={col} className="p-3 text-center text-sm font-semibold text-slate-600">{col}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {q.matrixRows?.map((row, rIdx) => {
                            const valStr = answers[q.id] || "{}";
                            let valObj: Record<string, string> = {};
                            try { valObj = JSON.parse(valStr); } catch (e) {}
                            
                            return (
                              <tr key={row} className="border-b border-slate-100">
                                <td className="p-3 font-medium text-slate-700">{row}</td>
                                {q.matrixCols?.map(col => (
                                  <td key={col} className="p-3 text-center">
                                    <input 
                                      type="radio" 
                                      name={`${q.id}_${rIdx}`}
                                      checked={valObj[row] === col}
                                      onChange={() => {
                                        const newVal = { ...valObj, [row]: col };
                                        setAnswers({...answers, [q.id]: JSON.stringify(newVal)});
                                      }}
                                      className="w-4 h-4 text-blue-600 cursor-pointer"
                                    />
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : q.type === "dropdown_multiple" ? (
                    <div className="space-y-4 mt-4">
                      {q.dropdownItems?.map(item => {
                        const valStr = answers[q.id] || "{}";
                        let valObj: Record<string, string> = {};
                        try { valObj = JSON.parse(valStr); } catch (e) {}
                        return (
                          <div key={item.label} className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                            <span className="font-medium text-slate-700">{item.label}:</span>
                            <select 
                              value={valObj[item.label] || ""}
                              onChange={(e) => {
                                const newVal = { ...valObj, [item.label]: e.target.value };
                                setAnswers({...answers, [q.id]: JSON.stringify(newVal)});
                              }}
                              className="border border-slate-300 rounded p-2 bg-white flex-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="" disabled>Выберите из списка ▼</option>
                              {item.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  ) : q.type === "drag_and_drop" ? (
                    <div className="mt-4">
                      <div className="text-sm text-slate-500 mb-2">Перетащите плашки, чтобы расставить их по порядку (с 1 по {q.dragItems?.length} место)</div>
                      {(() => {
                        let items = q.dragItems || [];
                        if (answers[q.id]) {
                          try { items = JSON.parse(answers[q.id]); } catch(e) {}
                        }
                        return (
                          <Reorder.Group 
                            axis="y" 
                            values={items} 
                            onReorder={(newOrder) => setAnswers({...answers, [q.id]: JSON.stringify(newOrder)})}
                            className="space-y-2"
                          >
                            {items.map((item, index) => (
                              <Reorder.Item key={item} value={item} className="flex items-center space-x-4 bg-white p-3 rounded shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing select-none touch-none hover:border-blue-300 transition-colors">
                                <div className="font-bold text-slate-400 w-6 text-center">{index + 1}</div>
                                <div className="flex-1 font-medium text-slate-800">{item}</div>
                                <div className="text-slate-300">≡</div>
                              </Reorder.Item>
                            ))}
                          </Reorder.Group>
                        )
                      })()}
                    </div>
                  ) : q.type === "number_input" ? (
                    <input
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      type="number" 
                      placeholder="Ваш ответ (только число)..."
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswers({...answers, [q.id]: e.target.value})}
                      className="w-full border rounded-xl p-3 bg-white mt-2"
                    />
                  ) : q.type === "clickable_text" ? (
                    <div className="leading-relaxed mt-2 text-slate-800 space-y-4">
                      {(() => {
                        let selectedIds: string[] = [];
                        try { selectedIds = JSON.parse(answers[q.id] || "[]"); } catch(e) {}
                        
                        const toggleId = (id: string) => {
                          let newIds = selectedIds.includes(id) 
                            ? selectedIds.filter(x => x !== id) 
                            : [...selectedIds, id].sort((a, b) => Number(a) - Number(b));
                          setAnswers({...answers, [q.id]: JSON.stringify(newIds)});
                        };

                        const targetSegments = q.clickableSegments?.filter(s => s.isTarget && s.id) || [];

                        return (
                          <div>
                            <div className="text-base sm:text-lg leading-relaxed p-3 bg-slate-50 border border-slate-200 rounded-xl">
                              {q.clickableSegments?.map((seg, sIdx) => {
                                if (seg.isTarget && seg.id) {
                                  const isSelected = selectedIds.includes(seg.id);
                                  return (
                                    <button 
                                      key={sIdx}
                                      type="button"
                                      onClick={() => toggleId(seg.id!)}
                                      className={`mx-1 inline-flex items-center justify-center min-w-[32px] h-8 px-2 rounded-lg font-bold text-sm transition-all border ${isSelected ? 'bg-blue-600 text-white border-blue-700 shadow-md scale-105' : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50'}`}
                                    >
                                      {seg.text}
                                    </button>
                                  )
                                }
                                return <span key={sIdx}>{seg.text}</span>;
                              })}
                            </div>

                            {/* Explicit Option Buttons Below */}
                            <div className="mt-3 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                Выберите цифры ответа (нажмите на цифры):
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {targetSegments.map((seg) => {
                                  const isSelected = selectedIds.includes(seg.id!);
                                  const cleanNum = seg.id!;
                                  return (
                                    <button
                                      key={seg.id}
                                      type="button"
                                      onClick={() => toggleId(seg.id!)}
                                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-sm sm:text-base border transition-all ${
                                        isSelected 
                                          ? 'bg-blue-600 text-white border-blue-700 shadow-sm ring-2 ring-blue-300' 
                                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                                      }`}
                                    >
                                      <span>Цифра ({cleanNum})</span>
                                      {isSelected && <span>✓</span>}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="mt-2 text-xs text-slate-600 font-medium">
                                Выбранные цифры: <span className="font-bold text-blue-700">{selectedIds.length > 0 ? selectedIds.join(", ") : "ничего не выбрано"}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : q.type === "inline_inputs" ? (
                    <div className="leading-relaxed mt-2 text-slate-800 text-lg">
                      {(() => {
                        let vals: Record<string, string> = {};
                        try { vals = JSON.parse(answers[q.id] || "{}"); } catch(e) {}
                        
                        const updateVal = (id: string, val: string) => {
                          const newVals = { ...vals, [id]: val };
                          setAnswers({...answers, [q.id]: JSON.stringify(newVals)});
                        };

                        return q.inlineSegments?.map((seg, sIdx) => {
                          if (seg.type === "input" && seg.id) {
                            return (
                              <input 
                                key={sIdx}
                                type="text"
                                value={vals[seg.id] || ""}
                                onChange={(e) => updateVal(seg.id!, e.target.value)}
                                className="mx-1 inline-block border-b-2 border-slate-300 focus:border-blue-600 bg-blue-50/30 px-2 py-1 text-center w-32 outline-none transition-colors"
                              />
                            )
                          }
                          return <span key={sIdx}>{seg.text}</span>;
                        })
                      })()}
                    </div>
                  ) : (
                    <input
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      type="text" 
                      placeholder="Ваш ответ..."
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswers({...answers, [q.id]: e.target.value})}
                      className="w-full border rounded-xl p-3 bg-white mt-2"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="max-w-3xl mx-auto px-6 pb-12 flex justify-end">
        <button 
          onClick={() => phase === "english" ? submitEnglishTest(false) : submitCoreTest(false)}
          className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all"
        >
          Завершить тест
        </button>
      </div>
    </div>
  );
}
