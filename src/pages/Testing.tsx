import React, { useState, useEffect, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { testsData } from "../data/testsData";
import { Question } from "../types";
import { getHourlyPIN } from "../lib/utils";

export default function Testing() {
  const [studentName, setStudentName] = useState(() => sessionStorage.getItem("studentName") || "");
  const [enteredPin, setEnteredPin] = useState("");
  const [grade, setGrade] = useState<number | null>(() => {
    const saved = sessionStorage.getItem("grade");
    return saved ? Number(saved) : null;
  });
  const [started, setStarted] = useState(() => sessionStorage.getItem("started") === "true");
  const [finished, setFinished] = useState(() => sessionStorage.getItem("finished") === "true");
  const [disqualified, setDisqualified] = useState(() => sessionStorage.getItem("disqualified") === "true");
  const [stopAudio, setStopAudio] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const saved = sessionStorage.getItem("answers");
    return saved ? JSON.parse(saved) : {};
  });
  const [testId, setTestId] = useState(() => sessionStorage.getItem("testId") || "");
  const [shortId, setShortId] = useState(() => {
    const saved = sessionStorage.getItem("shortId");
    if (saved) return saved;
    const newId = Math.floor(100000 + Math.random() * 900000).toString();
    sessionStorage.setItem("shortId", newId);
    return newId;
  });
  const [qrToken, setQrToken] = useState(() => sessionStorage.getItem("qrToken") || "");
  const [pendingSubmission, setPendingSubmission] = useState(() => sessionStorage.getItem("pendingSubmission") === "true");
  
  const blurTimeout = useRef<NodeJS.Timeout | null>(null);

  // Sync state to sessionStorage for F5 protection
  useEffect(() => {
    sessionStorage.setItem("studentName", studentName);
    if (grade) sessionStorage.setItem("grade", String(grade));
    sessionStorage.setItem("started", String(started));
    sessionStorage.setItem("finished", String(finished));
    sessionStorage.setItem("disqualified", String(disqualified));
    sessionStorage.setItem("answers", JSON.stringify(answers));
    sessionStorage.setItem("testId", testId);
    sessionStorage.setItem("shortId", shortId);
    sessionStorage.setItem("qrToken", qrToken);
    sessionStorage.setItem("pendingSubmission", String(pendingSubmission));
  }, [studentName, grade, started, finished, disqualified, answers, testId, shortId, qrToken, pendingSubmission]);

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

  // --- ANTI-CHEAT LOGIC ---
  useEffect(() => {
    if (!started || finished || disqualified) return;

    const handleCheating = () => {
      // 2 seconds grace period
      blurTimeout.current = setTimeout(() => {
        submitTest(true); // submit immediately as cheating
      }, 2000);
    };

    const handleFocus = () => {
      if (blurTimeout.current) {
        clearTimeout(blurTimeout.current);
        blurTimeout.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleCheating();
      } else {
        handleFocus();
      }
    };

    window.addEventListener("blur", handleCheating);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", handleCheating);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
    };
  }, [started, finished, disqualified, answers]); // Add answers to dependencies so submitTest gets latest

  // Block copy/paste/context menu globally when test is active
  useEffect(() => {
    if (!started || finished) return;
    const preventAction = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", preventAction);
    document.addEventListener("copy", preventAction);
    document.addEventListener("paste", preventAction);
    document.addEventListener("selectstart", preventAction);

    return () => {
      document.removeEventListener("contextmenu", preventAction);
      document.removeEventListener("copy", preventAction);
      document.removeEventListener("paste", preventAction);
      document.removeEventListener("selectstart", preventAction);
    };
  }, [started, finished]);

  // Audio stop listener for cheaters
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!started || finished) return;
        if (!disqualified) {
          submitTest(true); // Cheating
        } else {
          setStopAudio(true); // Silence the song
        }
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [disqualified]);

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

  const startTest = async () => {
    if (!grade) return alert("Выберите класс");
    if (!studentName.trim()) return alert("Введите ФИО");
    
    const TESTER_PIN = import.meta.env.VITE_TESTER_PIN || "TESTER_2026_SECRET_PIN";
    const isTester = enteredPin === TESTER_PIN;
    if (!isTester && enteredPin !== getHourlyPIN()) {
      return alert("Неверный PIN-код. Узнайте актуальный PIN у менеджера.");
    }

    // Check timer constraint only if not tester
    if (!isTester) {
      const lastTestTime = localStorage.getItem("lastTestTime");
      if (lastTestTime) {
        const timePassed = Date.now() - Number(lastTestTime);
        const oneHour = 60 * 60 * 1000;
        if (timePassed < oneHour) {
          const minutesLeft = Math.ceil((oneHour - timePassed) / 60000);
          return alert(`Вы уже сдавали тест недавно. Попробуйте еще раз через ${minutesLeft} минут.`);
        }
      }
    }
    
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen API failed", err);
    }

    if (!testId) {
      setTestId(crypto.randomUUID());
    }
    setStarted(true);
  };

  const submitTest = async (isDisqualified = false) => {
    setFinished(true);
    if (isDisqualified) {
      setDisqualified(true);
    }

    const payloadTestId = testId || crypto.randomUUID();
    if (!testId) setTestId(payloadTestId);

    const tokenUrl = `https://studyfreeforum.com/manager/form?shortId=${shortId}`;
    setQrToken(tokenUrl);

    const TESTER_PIN = import.meta.env.VITE_TESTER_PIN || "TESTER_2026_SECRET_PIN";
    const isTester = enteredPin === TESTER_PIN;

    const payload = {
      action: "submitTest",
      testId: payloadTestId,
      shortId: shortId,
      studentName,
      grade,
      answers,
      cheated: isDisqualified,
      testerPin: isTester ? enteredPin : undefined
    };

    // Save timer for anti-spam only if not tester
    if (!isTester) {
      localStorage.setItem("lastTestTime", Date.now().toString());
    }

    const sendData = async () => {
      try {
        const gasUrl = "/api/gas";
        const res = await fetch(gasUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          setPendingSubmission(false);
          localStorage.removeItem(`offline_test_${payloadTestId}`);
        } else {
          // If server actively rejects (e.g. rate limit or duplicate)
          if (data.error && data.error.includes("уже сдавали")) {
             alert(data.error);
             setPendingSubmission(false); // Don't retry
             localStorage.removeItem(`offline_test_${payloadTestId}`);
             return;
          }
          throw new Error(data.error);
        }
      } catch (e) {
        console.error("Failed to submit to GAS", e);
        setPendingSubmission(true);
        localStorage.setItem(`offline_test_${payloadTestId}`, JSON.stringify(payload));
      }
    };
    
    await sendData();

    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (e) {}
  };

  const retrySubmission = async () => {
    const payloadStr = localStorage.getItem(`offline_test_${testId}`);
    if (payloadStr) {
      try {
        const gasUrl = "/api/gas" || "";
        const res = await fetch(gasUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: payloadStr
        });
        const data = await res.json();
        if (data.success) {
          setPendingSubmission(false);
          localStorage.removeItem(`offline_test_${testId}`);
          alert("Данные успешно отправлены!");
        }
      } catch(e) {
        alert("Ошибка сети. Попробуйте еще раз.");
      }
    }
  };

  if (disqualified) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 to-red-700"></div>
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">!</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Тест аннулирован</h2>
        <p className="text-slate-600 mb-6">Вы покинули страницу во время тестирования. Результат аннулирован в соответствии с правилами.</p>
        <p className="text-sm text-slate-500 font-medium border-t pt-4">Покажите этот код менеджеру:</p>
        <div className="mt-3 text-4xl font-mono font-bold text-red-600 tracking-widest bg-red-50 py-3 rounded-xl border border-red-100">
          {shortId}
        </div>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold mb-2">Тест завершён</h2>
          
          {pendingSubmission ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6">
              <strong>Ошибка сети!</strong>
              <p className="text-sm mt-1 mb-3">Ваши ответы сохранены на устройстве. Пожалуйста, не закрывайте вкладку и дождитесь появления интернета.</p>
              <button onClick={retrySubmission} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium">Повторить отправку</button>
            </div>
          ) : (
            <p className="text-slate-500 mb-6">Покажите этот QR-код менеджеру<br/>или продиктуйте код ниже:</p>
          )}

          <div className="bg-slate-100 p-4 rounded-xl inline-block select-none pointer-events-none mb-6">
            <QRCodeCanvas value={qrToken} size={250} level="H" />
          </div>

          <div className="text-4xl font-mono font-bold text-blue-700 tracking-widest bg-blue-50 py-3 rounded-xl border border-blue-200">
            {shortId}
          </div>
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
            <div>
              <label className="block text-sm font-medium mb-2">ФИО Ученика:</label>
              <input 
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

            <div>
              <label className="block text-sm font-medium mb-2">PIN-код аудитории (спросите у менеджера):</label>
              <input 
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

          <button 
            onClick={startTest}
            disabled={!grade || !studentName.trim() || !enteredPin.trim()}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-blue-700 transition"
          >
            Начать тест
          </button>
        </div>
      </div>
    );
  }

  const test = testsData[grade!];

  return (
    <div className="min-h-screen bg-white text-slate-900 pb-20 select-none">
      <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
        <div className="font-bold text-lg">Тестирование: {grade} класс</div>
        <button 
          onClick={() => submitTest(false)}
          className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700"
        >
          Завершить тест
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-12">
        {[{ title: "Русский язык", q: test.russian }, { title: "Математика", q: test.math }, { title: "Логика", q: test.logic }].map((section, idx) => (
          <div key={idx}>
            <h2 className="text-2xl font-bold mb-6 text-blue-600">{section.title}</h2>
            <div className="space-y-8">
              {section.q.map((q: Question, i: number) => (
                <div key={q.id} className="bg-slate-50 p-6 rounded-2xl border">
                  <p className="font-medium mb-4">{i + 1}. {q.text}</p>
                  
                  {q.type === "multiple_choice" ? (
                    <div className="space-y-3">
                      {q.options?.map(opt => (
                        <label key={opt} className="flex items-center space-x-3 cursor-pointer">
                          <input 
                            type="radio" 
                            name={q.id} 
                            value={opt}
                            checked={answers[q.id] === opt}
                            onChange={(e) => setAnswers({...answers, [q.id]: e.target.value})}
                            className="w-4 h-4 text-blue-600 border-slate-300"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input 
                      type="text" 
                      placeholder="Ваш ответ..."
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswers({...answers, [q.id]: e.target.value})}
                      className="w-full border rounded-xl p-3 bg-white"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
