import { auth as firebaseAuth } from "../lib/firebase";
import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { fetchGasAPI } from "../lib/utils";
import toast, { Toaster } from "react-hot-toast";
const loadHtml2Pdf = async () => (await import("html2pdf.js")).default;
import { DiagnosticReportPdf } from "../components/DiagnosticReportPdf";
import { useAuth } from "../contexts/AuthContext";

export default function ManagerForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { orgId: routeOrgId, shortId: routeShortId } = useParams();

  const urlShortId = routeShortId || searchParams.get("shortId") || searchParams.get("testId") || "";
  const tenantId = routeOrgId || searchParams.get("tenantId");
  const initialMode = searchParams.get("mode") === "reject" ? "REJECT" : searchParams.get("mode") === "psychologist" ? "PSYCHOLOGIST" : "ACCEPT";
  const cabinetPath = tenantId ? `/workspace/${tenantId}/tests/manage` : "/workspace";

  const [shortId, setShortId] = useState(urlShortId);
  const [student, setStudent] = useState<any>(null);
  const [gradeData, setGradeData] = useState<any>(null);

  const [managerName, setManagerName] = useState(() => {
    return firebaseAuth.currentUser?.displayName || firebaseAuth.currentUser?.email || "Менеджер";
  });

  useEffect(() => {
    if (user) {
      setManagerName(user.displayName || user.email || "Менеджер");
    }
  }, [user]);

  const [analyzing, setAnalyzing] = useState(false);
  const [stampUrl, setStampUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!routeOrgId) return;
    fetch(`/api/tenant/public?id=${encodeURIComponent(routeOrgId)}`)
      .then(r => r.json()).then(j => setStampUrl(j?.tenant?.legal?.stampUrl || null)).catch(() => {});
  }, [routeOrgId]);

  const generatePdf = () => {
    if (!student || !student.diagnosticsRaw || Object.keys(student.diagnosticsRaw).length === 0) {
      toast.error("У данного ученика нет сохраненных данных аналитики.");
      return;
    }
    setAnalyzing(true);
    setTimeout(async () => {
      const element = document.getElementById('pdf-diagnostic-report');
      if (element) {
        const displayName = student.childName || student.studentName || student.shortId;
        const opt: any = {
          margin: 0,
          filename: `Аналитика_${displayName}_${student.grade}класс.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        const worker = (await loadHtml2Pdf())().set(opt).from(element);
        worker.output('datauristring').then(async (base64: string) => {
          try {
            const displayName = student.childName || student.studentName || student.shortId;
            const res = await fetchGasAPI("/api/gas", {
              action: "uploadPdf",
              shortId: student.shortId || shortId,
              childName: displayName,
              base64Data: base64
            }, "");
            
            if (res.success) {
              toast.success("PDF успешно сохранен на Google Диск!");
            } else {
              toast.error("Ошибка при сохранении на Диск: " + (res.error || JSON.stringify(res)));
            }
          } catch(err: any) {
            toast.error("Критическая ошибка сети при сохранении: " + err.message);
            console.error(err);
          }
        }).then(() => {
          worker.save().then(() => setAnalyzing(false));
        });
      } else {
        setAnalyzing(false);
      }
    }, 500);
  };

  const [childName, setChildName] = useState("");
  const [parentName, setParentName] = useState("");
  const [phone, setPhone] = useState("");
  const [managerComment, setManagerComment] = useState("");
  
  // Single-Step Decision Mode: "ACCEPT" | "PSYCHOLOGIST" | "REJECT"
  const [decisionMode, setDecisionMode] = useState<"ACCEPT" | "PSYCHOLOGIST" | "REJECT">(initialMode as any);

  // Payment fields for ACCEPT mode
  const [paymentInfo, setPaymentInfo] = useState("Kaspi Pay");
  const [initialFee, setInitialFee] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [firstMonthPayment, setFirstMonthPayment] = useState("Оплачено");

  // Rejection fields for REJECT mode
  const [rejectReason, setRejectReason] = useState("Низкий балл");
  const [otherReason, setOtherReason] = useState("");
  const [feedback, setFeedback] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchStudent = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchGasAPI("/api/gas", { action: "getStudentByShortId", shortId, tenantId });
      if (data.success) {
        setStudent(data.student);
        if (data.student.studentName || data.student.childName) {
          setChildName(data.student.childName || data.student.studentName || "");
        }
        if (data.student.parentName && data.student.parentName !== '—') {
          setParentName(data.student.parentName);
        }
        const existingPhone = data.student.phone || data.student.studentPhone;
        if (existingPhone && existingPhone !== '—') {
          setPhone(String(existingPhone));
        }
        if (data.student.initialFee) setInitialFee(String(data.student.initialFee));
        if (data.student.totalCost) setTotalCost(String(data.student.totalCost));
        if (data.student.paymentInfo) setPaymentInfo(String(data.student.paymentInfo));
        if (data.student.firstMonthPayment) setFirstMonthPayment(String(data.student.firstMonthPayment));
        if (data.student.rejectReason) setRejectReason(String(data.student.rejectReason));
        if (data.student.feedback) setFeedback(String(data.student.feedback));
        if (data.student.managerComment) setManagerComment(String(data.student.managerComment));

        if (data.student.grade) {
          try {
            const snap = await getDoc(doc(db, 'tests', `test_grade_${data.student.grade}_${tenantId}`));
            if (snap.exists()) {
              setGradeData(snap.data().questions);
            }
          } catch(e) {}
        }
      } else {
        setError(data.error || "Ученик не найден");
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (urlShortId) {
      fetchStudent();
    }
  }, [urlShortId]);

  const handleSubmitDecision = async () => {
    if (!managerName || !childName || !parentName || !phone) {
      setError("Заполните все обязательные поля (Имя менеджера, Имя ученика, ФИО родителя, Телефон)");
      return;
    }
    
    if (decisionMode === "ACCEPT" && (!initialFee || !totalCost)) {
      if (!confirm("Вступительный взнос или стоимость обучения не заполнены. Продолжить принятие без фиксирования сумм?")) {
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      const finalRejectReason = rejectReason === "Другое" ? otherReason : rejectReason;

      const payload: any = {
        action: "submitManagerForm",
        shortId,
        childName,
        parentName,
        phone,
        managerName,
        managerComment,
        tenantId
      };

      if (decisionMode === "ACCEPT") {
        payload.sentToPsych = false;
        payload.finalDecision = "ПРИНЯТ";
        payload.paymentInfo = paymentInfo;
        payload.initialFee = initialFee;
        payload.totalCost = totalCost;
        payload.firstMonthPayment = firstMonthPayment;
      } else if (decisionMode === "PSYCHOLOGIST") {
        payload.sentToPsych = true;
      } else if (decisionMode === "REJECT") {
        payload.sentToPsych = false;
        payload.finalDecision = "ОТКЛОНЕН";
        payload.rejectReason = finalRejectReason;
        payload.feedback = feedback;
      }

      const data = await fetchGasAPI("/api/gas", payload);

      if (data.success) {
        if (decisionMode === "ACCEPT") {
          toast.success("🎉 Ученик успешно ПРИНЯТ! Данные по оплате сохранены.");
          setTimeout(() => navigate(cabinetPath), 1200);
        } else if (decisionMode === "PSYCHOLOGIST") {
          toast.success("📋 Ученик успешно направлен к психологу.");
          setTimeout(() => navigate(`/receipt/${shortId}${tenantId ? `?tenantId=${tenantId}` : ''}`), 1000);
        } else {
          toast.success("❌ Решение об отказе зарегистрировано.");
          setTimeout(() => navigate(cabinetPath), 1200);
        }
      } else {
        setError(data.error || "Не удалось сохранить решение");
      }
    } catch (err: any) {
      setError(err.message || "Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-4 text-slate-500">
        Загрузка формы...
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 py-12 px-4">
      <Toaster position="top-center" />
      {student && (
        <div style={{ width: 0, height: 0, overflow: "hidden" }}>
          <DiagnosticReportPdf student={student} stampUrl={stampUrl} />
        </div>
      )}
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-blue-600 px-8 py-6 text-white text-center flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-left">Анкета Менеджера</h1>
            <p className="text-blue-100 text-xs text-left mt-0.5">Принятие, напраление к психологу или отказ в один шаг</p>
          </div>
          <button onClick={() => navigate(cabinetPath)} className="text-sm bg-white/20 px-4 py-2 rounded-xl hover:bg-white/30 font-medium">Кабинет</button>
        </div>

        <div className="p-8">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm border border-red-100 font-medium">
              ⚠️ {error}
            </div>
          )}

          {!student ? (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">Введите ID ученика (6 цифр)</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={shortId} 
                  onChange={e => setShortId(e.target.value)} 
                  placeholder="123456"
                  className="w-full border border-slate-300 rounded-xl p-3 text-xl tracking-widest bg-slate-50 font-mono" 
                />
                <button onClick={fetchStudent} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-xl font-semibold transition">
                  {loading ? "..." : "Найти"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {(() => {
                let maxRu = 0, maxMa = 0, maxLo = 0;
                if (student.grade && gradeData) {
                  maxRu = gradeData.russian?.reduce((sum: any, q: any) => sum + (q.points || 1), 0) || 0;
                  maxMa = gradeData.math?.reduce((sum: any, q: any) => sum + (q.points || 1), 0) || 0;
                  if (gradeData.logic) {
                    maxLo = gradeData.logic.reduce((sum: any, q: any) => sum + (q.points || 1), 0);
                  }
                }
                const totalMax = maxRu + maxMa + maxLo;
                const percent = totalMax > 0 ? Math.round((student.totalScore / totalMax) * 100) : 0;
                
                return (
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl mb-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-xs font-mono text-slate-400">ID: {student.shortId}</span>
                        <h3 className="font-bold text-slate-800 text-lg">{student.childName || student.studentName || "Ученик"}</h3>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        student.finalDecision === "ПРИНЯТ" ? "bg-green-600 text-white" :
                        student.finalDecision === "ОТКЛОНЕН" ? "bg-red-600 text-white" :
                        "bg-amber-100 text-amber-800"
                      }`}>
                        {student.finalDecision || "НЕ ОБРАБОТАН"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm text-slate-700 bg-white p-3 rounded-xl border border-slate-100">
                      <div>Класс: <b>{student.grade}</b></div>
                      <div>Общий балл: <b>{student.totalScore} из {totalMax} ({percent}%)</b></div>
                      <div>Русский: <b>{student.russian} из {maxRu}</b></div>
                      <div>Математика: <b>{student.math} из {maxMa}</b></div>
                      <div>Логика: <b>{student.logic} из {maxLo}</b></div>
                      {student.cheated && <div className="col-span-2 text-red-600 font-bold bg-red-50 px-2 py-1 rounded text-xs mt-1">! Заподозрен в списывании</div>}
                    </div>

                    {student.diagnosticsRaw && Object.keys(student.diagnosticsRaw).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <button 
                          onClick={generatePdf} 
                          disabled={analyzing}
                          className="px-4 py-2 rounded-xl shadow-sm font-medium text-xs bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200 flex items-center gap-2"
                        >
                          {analyzing ? "↻ Генерация..." : "📄 Скачать Анализ работы (PDF)"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Data fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-slate-700">Имя менеджера *</label>
                  <input type="text" value={managerName} onChange={e=>setManagerName(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 bg-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-slate-700">Имя ученика *</label>
                  <input type="text" value={childName} onChange={e=>setChildName(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 bg-white text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-slate-700">ФИО Родителя *</label>
                  <input type="text" value={parentName} onChange={e=>setParentName(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 bg-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-slate-700">Телефон родителя *</label>
                  <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 bg-white text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-700">Комментарий менеджера</label>
                <textarea value={managerComment} onChange={e=>setManagerComment(e.target.value)} placeholder="Заметки по беседе с родителями..." className="w-full border border-slate-300 rounded-xl p-3 bg-white text-sm h-20"></textarea>
              </div>

              {/* UPFRONT DECISION SELECTION TABS */}
              <div className="pt-2">
                <label className="block text-sm font-bold text-slate-800 mb-2">Выберите решение по ученику:</label>
                <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 rounded-2xl">
                  <button 
                    type="button"
                    onClick={() => setDecisionMode("ACCEPT")}
                    className={`py-3 px-3 rounded-xl font-bold text-xs transition flex flex-col items-center gap-1 ${
                      decisionMode === "ACCEPT" 
                        ? "bg-emerald-600 text-white shadow-md" 
                        : "text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span>💚 ПРИНЯТЬ</span>
                    <span className="font-normal text-[10px] opacity-90">(с оплатой)</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => setDecisionMode("PSYCHOLOGIST")}
                    className={`py-3 px-3 rounded-xl font-bold text-xs transition flex flex-col items-center gap-1 ${
                      decisionMode === "PSYCHOLOGIST" 
                        ? "bg-purple-600 text-white shadow-md" 
                        : "text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span>🟣 К ПСИХОЛОГУ</span>
                    <span className="font-normal text-[10px] opacity-90">(на собеседование)</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => setDecisionMode("REJECT")}
                    className={`py-3 px-3 rounded-xl font-bold text-xs transition flex flex-col items-center gap-1 ${
                      decisionMode === "REJECT" 
                        ? "bg-rose-600 text-white shadow-md" 
                        : "text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span>🔴 ОТКЛОНИТЬ</span>
                    <span className="font-normal text-[10px] opacity-90">(отказ)</span>
                  </button>
                </div>
              </div>

              {/* MODE 1: ACCEPTANCE FORM WITH PAYMENT FIELDS */}
              {decisionMode === "ACCEPT" && (
                <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl space-y-4 animate-fadeIn">
                  <h4 className="font-bold text-emerald-900 text-sm flex items-center gap-2">
                    <span>💳</span> Данные по оплате и договору (Принятие ученика)
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-emerald-900">Форма / Способ оплаты</label>
                      <select 
                        value={paymentInfo} 
                        onChange={e => setPaymentInfo(e.target.value)}
                        className="w-full border border-emerald-300 rounded-xl p-2.5 bg-white text-sm text-slate-800"
                      >
                        <option value="Kaspi Pay">Kaspi Pay</option>
                        <option value="Наличные в кассу">Наличные в кассу</option>
                        <option value="Банковский перевод (р/с)">Банковский перевод (р/с)</option>
                        <option value="Рассрочка Kaspi">Рассрочка Kaspi</option>
                        <option value="Другое">Другое</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1 text-emerald-900">Статус 1-го месяца</label>
                      <select 
                        value={firstMonthPayment} 
                        onChange={e => setFirstMonthPayment(e.target.value)}
                        className="w-full border border-emerald-300 rounded-xl p-2.5 bg-white text-sm text-slate-800"
                      >
                        <option value="Оплачено">Оплачено</option>
                        <option value="В ожидании">В ожидании</option>
                        <option value="Частично">Частично</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-emerald-900">Вступительный взнос (₸) *</label>
                      <input 
                        type="text" 
                        placeholder="50 000" 
                        value={initialFee} 
                        onChange={e => setInitialFee(e.target.value)}
                        className="w-full border border-emerald-300 rounded-xl p-2.5 bg-white text-sm font-semibold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-emerald-900">Стоимость по договору (₸) *</label>
                      <input 
                        type="text" 
                        placeholder="450 000" 
                        value={totalCost} 
                        onChange={e => setTotalCost(e.target.value)}
                        className="w-full border border-emerald-300 rounded-xl p-2.5 bg-white text-sm font-semibold text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 2: REJECTION FORM */}
              {decisionMode === "REJECT" && (
                <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl space-y-4 animate-fadeIn">
                  <h4 className="font-bold text-rose-900 text-sm flex items-center gap-2">
                    <span>❌</span> Укажите причину отказа
                  </h4>

                  <div>
                    <label className="block text-xs font-semibold mb-1 text-rose-900">Основная причина</label>
                    <select 
                      value={rejectReason} 
                      onChange={e => setRejectReason(e.target.value)}
                      className="w-full border border-rose-300 rounded-xl p-2.5 bg-white text-sm text-slate-800"
                    >
                      <option value="Низкий балл">Низкий академический балл</option>
                      <option value="Высокая стоимость">Высокая стоимость обучения</option>
                      <option value="Выбрали другую школу">Выбрали другую школу</option>
                      <option value="Переезд в другой город">Переезд в другой город</option>
                      <option value="Отсутствие мест">Отсутствие свободных мест</option>
                      <option value="Другое">Другая причина</option>
                    </select>
                  </div>

                  {rejectReason === "Другое" && (
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-rose-900">Уточните причину</label>
                      <input 
                        type="text" 
                        value={otherReason} 
                        onChange={e => setOtherReason(e.target.value)}
                        placeholder="Введите причину отказа..." 
                        className="w-full border border-rose-300 rounded-xl p-2.5 bg-white text-sm text-slate-800"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold mb-1 text-rose-900">Обратная связь для родителей</label>
                    <textarea 
                      value={feedback} 
                      onChange={e => setFeedback(e.target.value)}
                      placeholder="Рекомендации по подтягиванию предмета..."
                      className="w-full border border-rose-300 rounded-xl p-2.5 bg-white text-sm text-slate-800 h-20"
                    ></textarea>
                  </div>
                </div>
              )}

              {/* SUBMIT BUTTON */}
              <div className="pt-2">
                <button 
                  onClick={handleSubmitDecision}
                  disabled={loading}
                  className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition flex items-center justify-center gap-2 text-base ${
                    loading ? "bg-slate-400 cursor-not-allowed" :
                    decisionMode === "ACCEPT" ? "bg-emerald-600 hover:bg-emerald-700" :
                    decisionMode === "PSYCHOLOGIST" ? "bg-purple-600 hover:bg-purple-700" :
                    "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {loading ? (
                    <span>Отправка данных...</span>
                  ) : decisionMode === "ACCEPT" ? (
                    <><span>✅</span> Зачислить ученика (Принять с оплатой)</>
                  ) : decisionMode === "PSYCHOLOGIST" ? (
                    <><span>📋</span> Направить к психологу</>
                  ) : (
                    <><span>❌</span> Подтвердить отказ (Отклонить)</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
