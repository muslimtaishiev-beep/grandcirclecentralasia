import React, { useState, useEffect, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { testsData } from "../data/testsData";
import { Question } from "../types";
import { motion } from "framer-motion";

export default function Testing() {
  const [studentName, setStudentName] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [disqualified, setDisqualified] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [scores, setScores] = useState({ russian: 0, math: 0, logic: 0 });
  const [testId, setTestId] = useState("");
  const [qrToken, setQrToken] = useState("");
  
  const blurTimeout = useRef<NodeJS.Timeout | null>(null);

  // --- ANTI-CHEAT LOGIC ---
  useEffect(() => {
    if (!started || finished || disqualified) return;

    const handleCheating = () => {
      // 2 seconds grace period
      blurTimeout.current = setTimeout(() => {
        setDisqualified(true);
        submitTest(true); // submit with 0 points
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
  }, [started, finished, disqualified]);

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

  const startTest = async () => {
    if (!grade) return alert("Выберите класс");
    
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen API failed", err);
    }

    setTestId(crypto.randomUUID());
    setStarted(true);
  };

  const calculateScores = () => {
    if (!grade) return { russian: 0, math: 0, logic: 0 };
    const test = testsData[grade];
    let ru = 0, ma = 0, lo = 0;

    test.russian.forEach(q => {
      if (answers[q.id]?.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) ru += q.points;
    });
    test.math.forEach(q => {
      if (answers[q.id]?.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) ma += q.points;
    });
    test.logic.forEach(q => {
      if (answers[q.id]?.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) lo += q.points;
    });

    return { russian: ru, math: ma, logic: lo };
  };

  const submitTest = async (isDisqualified = false) => {
    setFinished(true);
    const calculatedScores = isDisqualified ? { russian: 0, math: 0, logic: 0 } : calculateScores();
    setScores(calculatedScores);

    // Generate secure token for QR
    const ts = Date.now();
    // In a real app, hash this with a secret. For now, simple base64 to deter simple URL copy.
    const token = btoa(`${testId}:${ts}:studyfree-secret`);
    setQrToken(`https://studyfreeforum.com/manager/form?testId=${testId}&ts=${ts}&token=${token}`);

    // Call Google Apps Script (Placeholder URL, user needs to provide it)
    try {
      const gasUrl = import.meta.env.VITE_GAS_URL || "";
      if (gasUrl) {
        await fetch(gasUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "submitTest",
            testId,
            studentName,
            grade,
            scores: calculatedScores
          })
        });
      }
    } catch (e) {
      console.error("Failed to submit to GAS", e);
    }
    
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (e) {}
  };

  if (disqualified) {
    return (
      <div className="min-h-screen bg-red-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center">
          <h1 className="text-3xl font-bold text-red-600 mb-4">Нарушение правил!</h1>
          <p className="text-slate-800">
            Вы покинули окно тестирования, свернули браузер или открыли другую вкладку. Тест принудительно завершен с результатом 0 баллов.
          </p>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold mb-2">Тест завершён</h2>
          <p className="text-slate-500 mb-6">Покажите этот QR-код менеджеру</p>
          <div className="bg-slate-100 p-4 rounded-xl inline-block select-none pointer-events-none mb-6">
            <QRCodeCanvas value={qrToken} size={250} level="H" />
          </div>
          <div className="grid grid-cols-3 gap-4 border-t pt-6">
            <div><div className="text-sm text-slate-500">Русский</div><div className="font-bold">{scores.russian}</div></div>
            <div><div className="text-sm text-slate-500">Математика</div><div className="font-bold">{scores.math}</div></div>
            <div><div className="text-sm text-slate-500">Логика</div><div className="font-bold">{scores.logic}</div></div>
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
                onChange={(e) => setGrade(Number(e.target.value))}
              >
                <option value="">Не выбран</option>
                {[7,8,9,10,11].map(g => <option key={g} value={g}>{g} класс</option>)}
              </select>
            </div>
          </div>
          
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-amber-800 text-sm">
            <strong>Внимание! (Anti-Cheat)</strong>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Тест откроется на весь экран.</li>
              <li>Если вы закроете тест, свернете окно или переключитесь на другую вкладку более чем на 2 секунды — тест автоматически аннулируется с нулем баллов.</li>
              <li>Копирование и вставка отключены.</li>
            </ul>
          </div>

          <button 
            onClick={startTest}
            disabled={!grade || !studentName.trim()}
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
