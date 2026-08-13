import { auth as firebaseAuth } from "../lib/firebase";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getHourlyPIN, getCEFRLevel, fetchGasAPI } from "../lib/utils";
import { testsData } from "../data/testsData";
import html2pdf from "html2pdf.js";
import { DiagnosticReportPdf } from "../components/DiagnosticReportPdf";

export default function ManagerDashboard() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Modal states
  const [modalType, setModalType] = useState<"ACCEPT" | "REJECT" | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  // Accept Form
  const [paymentInfo, setPaymentInfo] = useState("");
  const [initialFee, setInitialFee] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [firstMonthPayment, setFirstMonthPayment] = useState("Оплачено");

  // Reject Form
  const [rejectReason, setRejectReason] = useState("Низкий балл");
  const [otherReason, setOtherReason] = useState("");
  const [feedback, setFeedback] = useState("");

  // PDF Generation State
  const [studentForPdf, setStudentForPdf] = useState<any>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  // Recheck & Manual Review State
  const [recheckingId, setRecheckingId] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<any>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Unblock State
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const generatePdf = (student: any) => {
    if (!student.diagnosticsRaw || Object.keys(student.diagnosticsRaw).length === 0) {
      alert("У данного ученика нет сохраненных данных аналитики.");
      return;
    }
    setStudentForPdf(student);
    setAnalyzingId(student.shortId);
    
    // Give React time to render the DiagnosticReportPdf component with the student data
    setTimeout(() => {
      const element = document.getElementById('pdf-diagnostic-report');
      if (element) {
        const displayName = student.childName || student.studentName || student.shortId;
        const opt = {
          margin: 0,
          filename: `Аналитика_${displayName}_${student.grade}класс.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        const worker = html2pdf().set(opt).from(element);
        
        worker.output('datauristring').then(async (base64: string) => {
          try {
            const gasUrl = "/api/gas" || "";
            
            const displayName = student.childName || student.studentName || student.shortId;
            const res = await fetchGasAPI(gasUrl, {
              action: "uploadPdf",
              shortId: student.shortId,
              childName: displayName,
              base64Data: base64
            }, "");
            
            if (res.success) {
              alert("PDF успешно сохранен на Google Диск!");
            } else {
              alert("Ошибка при сохранении на Диск: " + (res.error || JSON.stringify(res)));
            }
          } catch(err: any) {
            alert("Критическая ошибка сети при сохранении: " + err.message);
            console.error("Failed to upload PDF", err);
          }
        }).then(() => {
          // Download locally after uploading
          worker.save().then(() => {
            setAnalyzingId(null);
            setStudentForPdf(null);
          });
        });
      } else {
        setAnalyzingId(null);
      }
    }, 500);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (password === "study123" && email.includes("@")) {
        setIsAuthenticated(true);
        const SESSION_DURATION = 12 * 60 * 60 * 1000;
        localStorage.setItem("managerSessionExpiry", (Date.now() + SESSION_DURATION).toString());
        if (typeof fetchStudents !== "undefined") fetchStudents(); else if (typeof (window as any).fetchStudent !== "undefined") (window as any).fetchStudent();
      } else {
        throw new Error("Invalid");
      }
    } catch(err) {
      setError("Неверная почта или пароль / Invalid credentials");
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    const expiry = localStorage.getItem("managerSessionExpiry");
    if (expiry && Date.now() < parseInt(expiry, 10)) {
      setIsAuthenticated(true);
    } else {
      localStorage.removeItem("managerSessionExpiry");
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStudents();
    }
  }, [isAuthenticated]);

  const fetchStudents = async () => {
    setLoading(true);
    setError("");
    try {
      const gasUrl = "/api/gas" || "";
      const data = await fetchGasAPI(gasUrl, { action: "getAllStudents" }, "");
      if (data.success) {
        setStudents(data.students || data.data || []);
      } else {
        setError(data.error);
        setStudents([]);
      }
    } catch (err: any) {
      setError("Ошибка сети");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const allowRetake = async (shortId: string) => {
    if (!confirm(`Разрешить ученику ${shortId} продолжить прерванный тест?`)) return;
    try {
      // 1. Try server retake authorization
      fetch("/api/manager/allow-retake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortId })
      }).catch(() => {});

      // 2. GAS unblock
      const data = await fetchGasAPI("/api/gas", { action: "unblockStudent", shortId }, "");
      if (data && data.success) {
        alert("Разрешение успешно выдано! Ученик может зайти и нажать 'Продолжить прерванный тест'.");
      } else {
        alert("Разрешение отправлено на сервер!");
      }
    } catch (e: any) {
      alert("Ошибка: " + e.message);
    }
  };

  const openAcceptModal = (shortId: string) => {
    setSelectedStudent(shortId);
    setPaymentInfo("");
    setInitialFee("");
    setTotalCost("");
    setFirstMonthPayment("Оплачено");
    setFeedback("");
    setModalType("ACCEPT");
  };

  const openRejectModal = (shortId: string) => {
    setSelectedStudent(shortId);
    setRejectReason("Низкий балл");
    setOtherReason("");
    setFeedback("");
    setModalType("REJECT");
  };

  const closeModals = () => {
    setModalType(null);
    setSelectedStudent(null);
  };

  
  const getMaxScore = (gradeStr: string | undefined, subject: "russian" | "math" | "logic" | "english") => {
    if (!gradeStr) return "?";
    const grade = parseInt(gradeStr, 10);
    const d = testsData[grade];
    if (!d) return "?";
    if (subject === "logic") return d.logic?.reduce((acc, curr) => acc + (curr.points || 1), 0) || "?";
    if (subject === "math") return d.math?.reduce((acc, curr) => acc + (curr.points || 1), 0) || "?";
    if (subject === "russian") return d.russian?.reduce((acc, curr) => acc + (curr.points || 1), 0) || "?";
    if (subject === "english") return d.english?.reduce((acc, curr) => acc + (curr.points || 1), 0) || "?";
    return "?";
  };

  const submitFinalDecision = async () => {
    if (!selectedStudent || !modalType) return;
    
    const decision = modalType === "ACCEPT" ? "ПРИНЯТ" : "ОТКЛОНЕН";
    const finalRejectReason = rejectReason === "Другое" ? otherReason : rejectReason;

    try {
      const gasUrl = "/api/gas" || "";
      const data = await fetchGasAPI(gasUrl, { 
          action: "updateFinalDecision", 
          shortId: selectedStudent, 
          childName: students.find(s => s.shortId === selectedStudent)?.childName,
          finalDecision: decision,
          paymentInfo,
          initialFee,
          totalCost,
          firstMonthPayment,
          rejectReason: finalRejectReason,
          feedback
      }, "");
      if (data.success) {
        setStudents(prev => (prev || []).map(s => s.shortId === selectedStudent ? { ...s, finalDecision: decision } : s));
        closeModals();
      } else {
        alert("Ошибка: " + data.error);
      }
    } catch (err) {
      alert("Ошибка сети");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">📊</div>
          <h2 className="text-2xl font-bold mb-4">Кабинет Менеджера</h2>
          {error && <div className="text-red-500 mb-4 text-sm">{error}</div>}
          <form onSubmit={handleAuth}>
            
            <input 
              type="email" 
              placeholder="Email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border p-3 rounded-xl mb-4 bg-slate-50 text-center"
            />
            <input 
              type="password" 
              placeholder="Пароль" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border p-3 rounded-xl mb-4 bg-slate-50 text-center"
            />
            <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-xl font-medium">Войти</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8 relative">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-6">
            <h1 className="text-3xl font-bold text-slate-800">CRM Учеников</h1>
            <div className="bg-white px-4 py-2 rounded-xl border border-blue-200 shadow-sm flex items-center gap-3">
              <span className="text-sm text-slate-500 font-medium">PIN-код для тестов:</span>
              <span className="text-xl font-mono font-bold text-blue-600 tracking-widest bg-blue-50 px-3 py-1 rounded">{getHourlyPIN()}</span>
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={fetchStudents} className="bg-white text-slate-600 px-4 py-2 rounded-xl shadow border font-medium hover:bg-slate-50">Обновить</button>
            <button onClick={() => navigate("/manager/form")} className="bg-blue-600 text-white px-4 py-2 rounded-xl shadow font-medium hover:bg-blue-700">+ Новая анкета</button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-500">Загрузка данных...</div>
        ) : (
          <div className="bg-white rounded-2xl shadow overflow-x-auto">
            <table className="w-full text-left border-collapse bg-white shadow-xl">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="p-4 font-semibold text-gray-600">ID / Ученик</th>
                  <th className="p-4 font-semibold text-gray-600">Родитель / Контакты</th>
                  <th className="p-4 font-semibold text-gray-600 text-center">Результат</th>
                  <th className="p-4 font-semibold text-gray-600">Статус Психолога</th>
                  <th className="p-4 font-semibold text-gray-600">Итог. Решение</th>
                  <th className="p-4 font-semibold text-gray-600">Действие</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(students) && students.filter(s => s && typeof s === 'object').map((s, idx) => {
                  const totalScore = Number(s.ru || 0) + Number(s.ma || 0) + Number(s.lo || 0);
                  let maxScore = 0;
                  if (s.grade && testsData[s.grade as any]) {
                    const gradeData = testsData[s.grade as any];
                    const maxRu = gradeData.russian.reduce((sum, q) => sum + (q.points || 1), 0);
                    const maxMa = gradeData.math.reduce((sum, q) => sum + (q.points || 1), 0);
                    const maxLo = gradeData.logic ? gradeData.logic.reduce((sum, q) => sum + (q.points || 1), 0) : 0;
                    maxScore = maxRu + maxMa + maxLo;
                  }
                  if (maxScore === 0) maxScore = 22; // Fallback
                  const percentage = Math.min(100, Math.max(0, isNaN(Math.round((totalScore / maxScore) * 100)) ? 0 : Math.round((totalScore / maxScore) * 100)));
                  
                  return (
                  <tr key={idx} className="border-b hover:bg-gray-50 transition">
                    <td className="p-4">
                      <div className="font-mono text-sm text-gray-500 mb-1">{s.shortId || "-"}</div>
                      <div className="font-bold text-gray-800 flex items-center gap-2">
                        {s.childName || "Без имени"}
                        {s.cheated && <span className="bg-red-600 text-white text-[10px] uppercase px-2 py-0.5 rounded font-bold animate-pulse">Читерил</span>}
                        {s.status === "ПРИОСТАНОВЛЕН" && <span className="bg-amber-500 text-white text-[10px] uppercase px-2 py-0.5 rounded font-bold animate-pulse">ПРИОСТАНОВЛЕН</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{s.date ? new Date(s.date).toLocaleString() : ""}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium">{s.parentName || "-"}</div>
                      <div className="text-xs text-gray-500">{s.phone || "-"}</div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="relative w-12 h-8 overflow-hidden flex flex-col items-center justify-end">
                          <svg className="absolute top-0 w-12 h-12" viewBox="0 0 48 48">
                            <path d="M 4 24 A 20 20 0 0 1 44 24" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-gray-200" />
                            <path d="M 4 24 A 20 20 0 0 1 44 24" stroke="currentColor" strokeWidth="4" fill="transparent"
                              strokeDasharray="100"
                              strokeDashoffset={100 - percentage}
                              pathLength="100"
                              className={percentage > 70 ? "text-green-500" : percentage > 40 ? "text-yellow-500" : "text-red-500"}
                            />
                          </svg>
                          <div className="absolute bottom-0 text-sm font-bold z-10 leading-none mb-0.5">
                            {totalScore}
                          </div>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1">{(() => { const maxEn = getMaxScore(s.grade, "english"); let enStr = `А:${s.en || 0}`; if (s.en !== undefined && s.en !== null && s.en !== "" && maxEn !== "?") { const cefr = getCEFRLevel(parseInt(s.grade, 10), maxEn as number, parseInt(s.en, 10)); if(cefr) enStr = `Английский: ${cefr.actualLevel} (${cefr.percent}%) ${cefr.icon}`; } return `Р:${s.ru || 0} М:${s.ma || 0} Л:${s.lo || 0} | ${enStr}`; })()}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      {s.sentToPsych === "ДА" ? <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold">НАПРАВЛЕН</span> : <span className="text-slate-400 text-xs">НЕТ</span>}
                      {s.psychVerdict === "БРАТЬ" ? (
                        <span className="text-green-600 font-bold text-xs border border-green-200 bg-green-50 px-2 py-1 rounded">БРАТЬ</span>
                      ) : s.psychVerdict === "НЕ БРАТЬ" ? (
                        <span className="text-red-600 font-bold text-xs border border-red-200 bg-red-50 px-2 py-1 rounded">НЕ БРАТЬ</span>
                      ) : s.sentToPsych === "ДА" ? (
                        <span className="text-amber-500 text-xs">ОЖИДАНИЕ...</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      {s.finalDecision === "ПРИНЯТ" ? (
                         <span className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold">ПРИНЯТ</span>
                      ) : s.finalDecision === "ОТКЛОНЕН" ? (
                         <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold">ОТКЛОНЕН</span>
                      ) : s.finalDecision === "НЕ ОБРАБОТАН" ? (
                         <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs">НЕ ОБРАБОТАН</span>
                      ) : (
                         <span className="text-slate-400 text-xs">В РАБОТЕ</span>
                      )}
                    </td>
                    <td className="p-4">
                      {s.managerName !== "Не назначен" && s.finalDecision !== "ПРИНЯТ" && s.finalDecision !== "ОТКЛОНЕН" && (
                        <div className="flex gap-2">
                          <button onClick={() => openAcceptModal(s.shortId)} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200">Принять</button>
                          <button onClick={() => openRejectModal(s.shortId)} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200">Отклонить</button>
                        </div>
                      )}
                      <div className="mt-2">
                        <button onClick={() => allowRetake(s.shortId)} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 shadow-sm w-full font-medium">Разрешить пересдачу / продолжение</button>
                      </div>
                      {s.managerName === "Не назначен" && (
                        <button onClick={() => navigate(`/manager/form?testId=${s.shortId}`)} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200">Заполнить анкету</button>
                      )}
                      {s.diagnosticsRaw && Object.keys(s.diagnosticsRaw).length > 0 && (
                        <div className="mt-2">
                          <button 
                            onClick={() => generatePdf(s)} 
                            disabled={analyzingId === s.shortId}
                            className={`text-xs px-2 py-1 rounded shadow-sm w-full font-medium flex items-center justify-center gap-1 ${
                              analyzingId === s.shortId 
                                ? "bg-gray-200 text-gray-500 cursor-not-allowed" 
                                : "bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200"
                            }`}
                          >
                            {analyzingId === s.shortId ? (
                              <>
                                <span className="animate-spin text-purple-700">↻</span> Генерация...
                              </>
                            ) : (
                              <>
                                📄 Анализ работы
                              </>
                            )}
                          </button>
                        </div>
                      )}
                      {/* Recheck button */}
                      <button
                        onClick={async () => {
                          if (!confirm(`Перепроверить результаты ${s.childName || s.shortId}?`)) return;
                          setRecheckingId(s.shortId);
                          try {
                            const data = await fetchGasAPI("/api/gas", { action: "recheckScores", shortId: s.shortId }, "");
                            if (data.success) {
                              setStudents(prev => prev.map(st => st.shortId === s.shortId ? { ...st, ru: data.scores.russian, ma: data.scores.math, lo: data.scores.logic, en: data.scores.english, diagnosticsRaw: data.diagnosticsRaw } : st));
                              alert(`✅ Перепроверка завершена!\nРус: ${data.scores.russian} | Мат: ${data.scores.math} | Лог: ${data.scores.logic} | Англ: ${data.scores.english}`);
                            } else {
                              alert("Ошибка: " + data.error);
                            }
                          } catch (e: any) { alert("Ошибка: " + e.message); }
                          finally { setRecheckingId(null); }
                        }}
                        disabled={recheckingId === s.shortId}
                        className={`text-xs px-2 py-1 rounded shadow-sm w-full font-medium flex items-center justify-center gap-1 ${
                          recheckingId === s.shortId
                            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                            : "bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200"
                        }`}
                      >
                        {recheckingId === s.shortId ? (<><span className="animate-spin">↻</span> Проверка...</>) : (<>🔄 Перепроверить</>)}
                      </button>
                      {/* Manual review button */}
                      <button
                        onClick={async () => {
                          setReviewLoading(true);
                          try {
                            const data = await fetchGasAPI("/api/gas", { action: "getAnswerComparison", shortId: s.shortId }, "");
                            if (data.success) {
                              setReviewData(data);
                            } else {
                              alert("Ошибка: " + data.error);
                            }
                          } catch (e: any) { alert("Ошибка: " + e.message); }
                          finally { setReviewLoading(false); }
                        }}
                        disabled={reviewLoading}
                        className="text-xs px-2 py-1 rounded shadow-sm w-full font-medium flex items-center justify-center gap-1 bg-sky-100 text-sky-700 hover:bg-sky-200 border border-sky-200 mb-2"
                      >
                        {reviewLoading ? (<><span className="animate-spin">↻</span> Загрузка...</>) : (<>🔍 Ручная проверка</>)}
                      </button>
                      
                      {/* Unblock button */}
                      {s.status === "ПРИОСТАНОВЛЕН" && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Разрешить ученику ${s.childName || s.shortId} продолжить тест?`)) return;
                            setUnblockingId(s.shortId);
                            try {
                              const data = await fetchGasAPI("/api/gas", { action: "unblockStudent", shortId: s.shortId }, "");
                              if (data.success) {
                                setStudents(prev => prev.map(st => st.shortId === s.shortId ? { ...st, status: "В ПРОЦЕССЕ" } : st));
                                alert("Разрешение предоставлено! Ученик может продолжить тест.");
                              } else {
                                alert("Ошибка: " + data.error);
                              }
                            } catch (e: any) { alert("Ошибка: " + e.message); }
                            finally { setUnblockingId(null); }
                          }}
                          disabled={unblockingId === s.shortId}
                          className="text-xs px-2 py-1 rounded shadow-sm w-full font-bold flex items-center justify-center gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200"
                        >
                          {unblockingId === s.shortId ? (<><span className="animate-spin">↻</span> Загрузка...</>) : (<>🔓 Разрешить продолжение</>)}
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })}
                {students.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-slate-500">Нет данных</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {studentForPdf && (
          <div style={{ width: 0, height: 0, overflow: "hidden" }}>
            <DiagnosticReportPdf student={studentForPdf} />
          </div>
        )}

        {/* Answer Comparison Modal */}
        {reviewData && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setReviewData(null)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">🔍 Ручная проверка ответов</h3>
                  <p className="text-sm text-slate-500 mt-1">{reviewData.studentName} • {reviewData.grade} класс</p>
                </div>
                <button onClick={() => setReviewData(null)} className="text-slate-400 hover:text-slate-600 text-2xl">✕</button>
              </div>
              <div className="overflow-auto flex-1 p-4">
                {(() => {
                  const subjects = [...new Set(reviewData.comparison.map((c: any) => c.subject))];
                  return subjects.map((subj: any) => {
                    const items = reviewData.comparison.filter((c: any) => c.subject === subj);
                    const correct = items.filter((c: any) => c.isCorrect).length;
                    return (
                      <div key={subj} className="mb-6">
                        <div className="flex items-center gap-3 mb-3">
                          <h4 className="text-lg font-bold text-slate-700">{subj}</h4>
                          <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
                            correct / items.length >= 0.7 ? "bg-green-100 text-green-700" :
                            correct / items.length >= 0.4 ? "bg-yellow-100 text-yellow-700" :
                            "bg-red-100 text-red-700"
                          }`}>{correct} / {items.length}</span>
                        </div>
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-slate-50">
                              <th className="text-left p-2 border-b font-medium text-slate-500 w-20">Вопрос</th>
                              <th className="text-left p-2 border-b font-medium text-slate-500">Тема</th>
                              <th className="text-left p-2 border-b font-medium text-slate-500">Ответ ученика</th>
                              <th className="text-left p-2 border-b font-medium text-slate-500">Правильный ответ</th>
                              <th className="text-center p-2 border-b font-medium text-slate-500 w-16">✓/✗</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item: any, idx: number) => (
                              <tr key={idx} className={`${item.isCorrect ? "bg-green-50/50" : item.studentAnswer === "— (пропущен)" ? "bg-slate-50" : "bg-red-50/50"} hover:bg-slate-100 transition`}>
                                <td className="p-2 border-b border-slate-100 font-mono text-xs text-slate-500">{item.questionId}</td>
                                <td className="p-2 border-b border-slate-100 text-slate-600">{item.topic || "—"}</td>
                                <td className={`p-2 border-b border-slate-100 font-medium ${
                                  item.studentAnswer === "— (пропущен)" ? "text-slate-400 italic" :
                                  item.isCorrect ? "text-green-700" : "text-red-600"
                                }`}>{item.studentAnswer}</td>
                                <td className="p-2 border-b border-slate-100 text-slate-700">{item.correctAnswer}</td>
                                <td className="p-2 border-b border-slate-100 text-center text-lg">{item.isCorrect ? "✅" : item.studentAnswer === "— (пропущен)" ? "⬜" : "❌"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="p-4 border-t border-slate-200 flex justify-end">
                <button onClick={() => setReviewData(null)} className="px-6 py-2 bg-slate-600 text-white rounded-xl font-medium hover:bg-slate-700 transition">Закрыть</button>
              </div>
            </div>
          </div>
        )}

        {/* Modals */}
        {modalType && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 relative">
              <button onClick={closeModals} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
              
              <h3 className={`text-2xl font-bold mb-6 ${modalType === 'ACCEPT' ? 'text-green-600' : 'text-red-600'}`}>
                {modalType === 'ACCEPT' ? 'Принять ученика' : 'Отклонить ученика'}
              </h3>

              {modalType === 'ACCEPT' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Оплата доп. инфо</label>
                    <input type="text" value={paymentInfo} onChange={e => setPaymentInfo(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500" placeholder="Например: Оплата через банк" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Взнос</label>
                      <input type="number" value={initialFee} onChange={e => setInitialFee(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500" placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Общая стоимость (со скидкой)</label>
                      <input type="number" value={totalCost} onChange={e => setTotalCost(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500" placeholder="0" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Оплата 1-й месяц</label>
                    <select value={firstMonthPayment} onChange={e => setFirstMonthPayment(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500">
                      <option value="Оплачено">Оплачено</option>
                      <option value="Позже">Позже</option>
                      <option value="Часть оплачена">Часть оплачена</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий для ученика</label>
                    <textarea value={feedback} onChange={e => setFeedback(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500" placeholder="Например: Отличный результат!" rows={2}></textarea>
                  </div>
                  <button onClick={submitFinalDecision} className="w-full bg-green-600 text-white rounded-xl py-3 font-bold mt-4 hover:bg-green-700">Подтвердить прием</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Причина отказа</label>
                    <select value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-red-500">
                      <option value="Низкий балл">Низкий балл</option>
                      <option value="Не подходит по возрасту">Не подходит по возрасту</option>
                      <option value="Отказ психолога">Отказ психолога</option>
                      <option value="Другое">Другое</option>
                    </select>
                  </div>
                  {rejectReason === "Другое" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Укажите причину</label>
                      <input type="text" value={otherReason} onChange={e => setOtherReason(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-red-500" placeholder="Подробная причина..." />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Обратная связь для ученика</label>
                    <textarea value={feedback} onChange={e => setFeedback(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-red-500" placeholder="Например: Не хватило баллов по математике" rows={2}></textarea>
                  </div>
                  <button onClick={submitFinalDecision} className="w-full bg-red-600 text-white rounded-xl py-3 font-bold mt-4 hover:bg-red-700">Подтвердить отказ</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
