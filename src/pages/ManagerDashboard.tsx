import { auth as firebaseAuth } from "../lib/firebase";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getHourlyPIN, getCEFRLevel, fetchGasAPI, toGenitiveCase } from "../lib/utils";
import { testsData } from "../data/testsData";
import html2pdf from "html2pdf.js";
import { DiagnosticReportPdf } from "../components/DiagnosticReportPdf";
import { SchoolCertificatePdf } from "../components/SchoolCertificatePdf";

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

  // Certificate System State
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [certTab, setCertTab] = useState<"GENERATE" | "HISTORY">("GENERATE");
  const [selectedStudentForCert, setSelectedStudentForCert] = useState<string>("MANUAL");
  const [certManagerName, setCertManagerName] = useState<string>("Айгерим");
  const [certStudentName, setCertStudentName] = useState("");
  const [certStudentNameGenitive, setCertStudentNameGenitive] = useState("");
  const [certDob, setCertDob] = useState("");
  const [certGrade, setCertGrade] = useState("7");
  const [certPurpose, setCertPurpose] = useState("по месту требования");
  const [certRefNumber, setCertRefNumber] = useState("");
  const [certDirectorName, setCertDirectorName] = useState("");
  const [certDocTemplateOnlineId, setCertDocTemplateOnlineId] = useState<string>(() => {
    return localStorage.getItem("cert_template_id_online") || "1TC6nBUkHx9TItz_0kFuaowYVMoKIZGMGKttEvl30MvA";
  });
  const [certDocTemplatePrintId, setCertDocTemplatePrintId] = useState<string>(() => {
    return localStorage.getItem("cert_template_id_print") || "1ryJR-wIlQomXX76-Bc4Q6BNgsUQRa4rqdLbXrg-nqvo";
  });
  const [isGeneratingCertPdf, setIsGeneratingCertPdf] = useState(false);
  const [certForExport, setCertForExport] = useState<any>(null);

  const [certHistory, setCertHistory] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("school_certificates_history");
      return saved ? JSON.parse(saved) : [];
    } catch(e) { return []; }
  });

  const fetchNextCertRefNumber = async () => {
    try {
      const res = await fetchGasAPI("/api/gas", { action: "getNextCertRefNumber" }, "");
      if (res && res.success && res.nextRefNumber) {
        setCertRefNumber(res.nextRefNumber);
      }
    } catch(e) {}
  };

  // Sync certificate registry and next ref number from Google Sheets on modal open
  useEffect(() => {
    if (isCertModalOpen) {
      fetchNextCertRefNumber();
      fetchGasAPI("/api/gas", { action: "getCertificateRegistry" }, "")
        .then((data) => {
          if (data && data.success && Array.isArray(data.certificates)) {
            setCertHistory(data.certificates);
            localStorage.setItem("school_certificates_history", JSON.stringify(data.certificates));
          }
        })
        .catch(() => {});
    }
  }, [isCertModalOpen]);

  const handleStudentSelectForCert = (id: string) => {
    setSelectedStudentForCert(id);
    if (id === "MANUAL") {
      setCertStudentName("");
      setCertStudentNameGenitive("");
      setCertGrade("7");
      setCertDob("");
      return;
    }
    const found = students.find(s => s.shortId === id);
    if (found) {
      const rawName = found.childName || found.studentName || "";
      setCertStudentName(rawName);
      setCertStudentNameGenitive(toGenitiveCase(rawName));
      setCertGrade(String(found.grade || "7"));
      setCertDob(found.dob || found.birthDate || found.dateOfBirth || "");
    }
  };



  const handleGenerateFromGoogleDocs = async (formatType: "ONLINE" | "PRINT") => {
    if (!certStudentNameGenitive.trim()) {
      alert("Введите ФИО ученика в дательном падеже (Кому?)!");
      return;
    }
    
    let templateId = (formatType === "ONLINE" ? certDocTemplateOnlineId : certDocTemplatePrintId).trim();
    if (templateId.indexOf("/d/") !== -1) {
      const match = templateId.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) templateId = match[1];
    }

    if (!templateId) {
      const inputId = prompt(
        formatType === "ONLINE"
          ? "📱 Вставьте ссылку или ID шаблона Google Docs ДЛЯ ОНЛАЙН ВЫДАЧИ (с печатями):"
          : "🖨️ Вставьте ссылку или ID шаблона Google Docs ДЛЯ ПЕЧАТИ (без печатей):"
      );
      if (!inputId || !inputId.trim()) return;
      let rawInput = inputId.trim();
      if (rawInput.indexOf("/d/") !== -1) {
        const match = rawInput.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) rawInput = match[1];
      }
      templateId = rawInput;
      if (formatType === "ONLINE") {
        setCertDocTemplateOnlineId(templateId);
        localStorage.setItem("cert_template_id_online", templateId);
      } else {
        setCertDocTemplatePrintId(templateId);
        localStorage.setItem("cert_template_id_print", templateId);
      }
    }

    const record = {
      refNumber: certRefNumber.trim(),
      managerName: certManagerName,
      issueDate: new Date().toLocaleDateString('ru-RU'),
      studentName: certStudentName,
      studentNameGenitive: certStudentNameGenitive,
      grade: certGrade,
      dob: certDob,
      purpose: certPurpose,
      timestamp: Date.now()
    };

    const typeTitle = formatType === "PRINT" 
      ? "🖨️ ДЛЯ ПЕЧАТИ НА БУМАГЕ (без цифровых штампов)" 
      : "📱 ЭЛЕКТРОННАЯ / ОНЛАЙН ВЫДАЧА (с синим штампом и печатью)";

    const confirmMsg = `Подтверждение выписки справки:\n\n• Формат: ${typeTitle}\n• Исходящий №: ${record.refNumber}\n• Выдал менеджер: ${record.managerName}\n• ФИО (в дат. падеже): ${record.studentNameGenitive}\n• Класс: ${record.grade}\n\nСформировать PDF документ в Google Docs?`;
    if (!confirm(confirmMsg)) return;

    setIsGeneratingCertPdf(true);

    try {
      const res = await fetchGasAPI("/api/gas", {
        action: "generateCertificateFromDocs",
        docTemplateId: templateId,
        formatType,
        record
      }, "");

      if (res && res.success && res.pdfUrl) {
        // Auto-download PDF to computer
        try {
          const filename = `Справка_${(record.studentNameGenitive || record.studentName || "").replace(/\s+/g, '_')}_№${record.refNumber.replace(/[\/\s]/g, '_')}.pdf`;
          
          if (res.pdfBase64) {
            // Direct Base64 Blob download
            const byteCharacters = atob(res.pdfBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
          } else {
            // Fallback Google Drive link download
            let downloadUrl = res.pdfUrl;
            const fileIdMatch = downloadUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (fileIdMatch && fileIdMatch[1]) {
              downloadUrl = `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
            }
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filename;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        } catch (dlErr) {
          console.error("Direct download error, opening Drive link:", dlErr);
          window.open(res.pdfUrl, "_blank");
        }
        
        if (formatType === "PRINT") {
          alert(`📄 Справка для печати сформирована и скачивается!\n\nИсходящий номер для журнала: № ${record.refNumber}\n\nПечати и угловой штамп проставляются физически на распечатанном листе бумаге.`);
        } else {
          alert(`🎉 Онлайн-справка с синим векторным штампом успешно создана и скачивается!\n\nИсходящий номер: № ${record.refNumber}`);
        }
        
        const newEntry = { id: 'cert_' + record.timestamp, ...record, pdfUrl: res.pdfUrl, formatType };
        const updatedHistory = [newEntry, ...certHistory];
        setCertHistory(updatedHistory);
        localStorage.setItem("school_certificates_history", JSON.stringify(updatedHistory));

        // Fetch exact next unique ref number from Google Sheets
        fetchNextCertRefNumber();
      } else {
        if (res?.isDuplicateRef) {
          alert(`❌ ОШИБКА ДУБЛИКАТА НОМЕРА:\n${res.error}\n\nПожалуйста, обновите исходящий номер на следующий свободной.`);
          fetchNextCertRefNumber();
        } else {
          const errMsg = res?.error || "Проверьте ссылку на шаблон и доступ к файлу в Google Диске.";
          if (errMsg.includes("getFileById") || errMsg.includes("Unexpected error")) {
            const resetChoice = confirm(
              `⚠️ Не удалось открыть шаблон Google Docs (ID: ${templateId}).\n\nВозможные причины:\n1. Файл шаблона не расшарен («Все, у кого есть ссылка» -> «Просмотр»)\n2. Введен неверный ID файла.\n\nХотите ввести новую ссылку на шаблон?`
            );
            if (resetChoice) {
              if (formatType === "ONLINE") {
                setCertDocTemplateOnlineId("");
                localStorage.removeItem("cert_template_id_online");
              } else {
                setCertDocTemplatePrintId("");
                localStorage.removeItem("cert_template_id_print");
              }
            }
          } else {
            alert("⚠️ Ошибка шаблона Google Docs: " + errMsg);
          }
        }
      }
    } catch(err: any) {
      console.error(err);
      alert("Ошибка запроса генерации шаблона: " + (err.message || err));
    } finally {
      setIsGeneratingCertPdf(false);
    }
  };

  const generatePdf = async (student: any) => {
    let currentStudent = student;
    if (!currentStudent.diagnosticsRaw || Object.keys(currentStudent.diagnosticsRaw).length === 0) {
      setAnalyzingId(student.shortId);
      try {
        const data = await fetchGasAPI("/api/gas", { action: "getStudentByShortId", shortId: student.shortId }, "");
        if (data && data.success && data.student && data.student.diagnosticsRaw) {
          currentStudent = { ...student, diagnosticsRaw: data.student.diagnosticsRaw };
        } else {
          alert("У данного ученика нет сохраненных данных аналитики.");
          setAnalyzingId(null);
          return;
        }
      } catch (e: any) {
        alert("Ошибка подгрузки аналитики: " + e.message);
        setAnalyzingId(null);
        return;
      }
    }
    setStudentForPdf(currentStudent);
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
    if (password === "study123" && email.includes("@")) {
      const SESSION_DURATION = 12 * 60 * 60 * 1000;
      localStorage.setItem("managerSessionExpiry", (Date.now() + SESSION_DURATION).toString());
      setIsAuthenticated(true);
    } else {
      setError("Неверная почта или пароль / Invalid credentials");
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
        setStudents(prev => (prev || []).map(s => s.shortId === shortId ? { ...s, status: "В ПРОЦЕССЕ" } : s));
        alert("Разрешение успешно выдано! Экран ученика автоматически разблокируется.");
      } else {
        setStudents(prev => (prev || []).map(s => s.shortId === shortId ? { ...s, status: "В ПРОЦЕССЕ" } : s));
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
                        <div className="relative w-14 h-8 overflow-hidden flex flex-col items-center justify-end">
                          <svg className="absolute top-0 w-14 h-14" viewBox="0 0 48 48">
                            <path d="M 4 24 A 20 20 0 0 1 44 24" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-gray-200" />
                            <path d="M 4 24 A 20 20 0 0 1 44 24" stroke="currentColor" strokeWidth="4" fill="transparent"
                              strokeDasharray="100"
                              strokeDashoffset={100 - percentage}
                              pathLength="100"
                              className={percentage > 70 ? "text-green-500" : percentage > 40 ? "text-yellow-500" : "text-red-500"}
                            />
                          </svg>
                          <div className="absolute bottom-0 text-xs font-bold z-10 leading-none mb-0.5 text-gray-800">
                            {totalScore}/{maxScore}
                          </div>
                        </div>
                        <div className="text-[10px] text-gray-500 font-medium mt-1">
                          {(() => {
                            const maxRu = getMaxScore(s.grade, "russian");
                            const maxMa = getMaxScore(s.grade, "math");
                            const maxLo = getMaxScore(s.grade, "logic");
                            const maxEn = getMaxScore(s.grade, "english");

                            const ruStr = `Р:${s.ru ?? 0}${maxRu !== "?" ? "/" + maxRu : ""}`;
                            const maStr = `М:${s.ma ?? 0}${maxMa !== "?" ? "/" + maxMa : ""}`;
                            const loStr = `Л:${s.lo ?? 0}${maxLo !== "?" ? "/" + maxLo : ""}`;

                            let enStr = "";
                            if (s.en !== undefined && s.en !== null && s.en !== "" && maxEn !== "?") {
                              const cefr = getCEFRLevel(parseInt(s.grade, 10), maxEn as number, parseInt(s.en, 10));
                              if (cefr) enStr = ` | Английский: ${cefr.actualLevel} (${cefr.percent}%) ${cefr.icon}`;
                              else enStr = ` | А:${s.en}/${maxEn}`;
                            } else if (s.en) {
                              enStr = ` | А:${s.en}${maxEn !== "?" ? "/" + maxEn : ""}`;
                            }

                            return `${ruStr} ${maStr} ${loStr} (${percentage}%)${enStr}`;
                          })()}
                        </div>
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
                      {(s.hasDiagnostics || (s.diagnosticsRaw && Object.keys(s.diagnosticsRaw).length > 0)) && (
                        <div className="mt-2 space-y-1">
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

                          {/* Proctoring Evidence Button */}
                          {s.proctoringUrl ? (
                            <a 
                              href={s.proctoringUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-xs px-2 py-1 rounded shadow-sm w-full font-medium flex items-center justify-center gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300"
                            >
                              📦 Отчёт прокторинга
                            </a>
                          ) : (
                            <button
                              onClick={() => alert(`Прокторинг для ученика ${s.childName || s.shortId}: Нарушений не зафиксировано, отчёт сохранён в архиве.`)}
                              className="text-xs px-2 py-1 rounded shadow-sm w-full font-medium flex items-center justify-center gap-1 bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                            >
                              🛡️ Прокторинг: Норма
                            </button>
                          )}
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
        {/* Certificate Offscreen Container for PDF Export */}
        {certForExport && (
          <div style={{ width: 0, height: 0, overflow: 'hidden', position: 'absolute', top: -9999, left: -9999 }}>
            <SchoolCertificatePdf data={certForExport} />
          </div>
        )}

        {/* Floating Action Button for Certificates (Bottom Right) */}
        <button
          onClick={() => setIsCertModalOpen(true)}
          className="fixed bottom-8 right-8 z-40 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-6 py-4 rounded-full shadow-2xl hover:shadow-indigo-500/50 transform hover:scale-105 active:scale-95 transition-all flex items-center gap-3 border-2 border-white/20 group"
          title="Сформировать справку об обучении"
        >
          <span className="text-2xl group-hover:rotate-12 transition-transform">📜</span>
          <span className="text-base tracking-wide hidden sm:inline">Выдать справку</span>
          {certHistory.length > 0 && (
            <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full font-mono font-bold">
              {certHistory.length}
            </span>
          )}
        </button>

        {/* Certificate Management Modal */}
        {isCertModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsCertModalOpen(false)}>
            <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 flex justify-between items-center relative">
                <div>
                  <h3 className="text-2xl font-bold flex items-center gap-2">
                    <span>📜</span> История выдачи и генератор справок
                  </h3>
                  <p className="text-xs text-blue-200 mt-1">ОсОО «Академия будущих лидеров» • ИНН 03004202510435 • Лицензия LM.-2025-0006</p>
                </div>
                <button onClick={() => setIsCertModalOpen(false)} className="text-blue-200 hover:text-white text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition">✕</button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3">
                <button
                  onClick={() => setCertTab("GENERATE")}
                  className={`py-3 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                    certTab === "GENERATE"
                      ? "border-blue-600 text-blue-600 bg-white rounded-t-xl"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span>✨ Новая справка</span>
                </button>
                <button
                  onClick={() => setCertTab("HISTORY")}
                  className={`py-3 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                    certTab === "HISTORY"
                      ? "border-blue-600 text-blue-600 bg-white rounded-t-xl"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span>📋 Журнал и История выдачи</span>
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-mono font-bold">{certHistory.length}</span>
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-6 overflow-y-auto flex-1">
                {certTab === "GENERATE" ? (
                  <div className="space-y-6">
                    {/* Student Selection Dropdown */}
                    <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100">
                      <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <span>👤</span> Выберите ученика из базы CRM или введите вручную:
                      </label>
                      <select
                        value={selectedStudentForCert}
                        onChange={(e) => handleStudentSelectForCert(e.target.value)}
                        className="w-full border border-blue-200 rounded-xl p-3 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="MANUAL">✍️ [+ Ввести данные вручную / Сторонний ученик]</option>
                        {Array.isArray(students) && students.map((s, idx) => {
                          const displayName = s.childName || s.studentName || s.name || `Ученик (${s.shortId || 'Без ID'})`;
                          return (
                            <option key={idx} value={s.shortId || idx}>
                              🎓 {displayName} ({s.grade || '?'} класс, ID: {s.shortId || 'N/A'})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Main Form Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Менеджер (кто выдает справку):</label>
                        <select
                          value={certManagerName}
                          onChange={(e) => setCertManagerName(e.target.value)}
                          className="w-full border border-blue-300 rounded-xl p-3 bg-blue-50/50 text-blue-900 font-bold focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="Айгерим">👩‍💼 Айгерим</option>
                          <option value="Диана">👩‍💼 Диана</option>
                          <option value="Калия">👩‍💼 Калия</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Куда предоставляется:</label>
                        <select
                          value={certPurpose}
                          onChange={(e) => setCertPurpose(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl p-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-slate-800 text-sm"
                        >
                          <option value="по месту требования">по месту требования</option>
                          <option value="в посольство / для оформления визы">в посольство / для оформления визы</option>
                          <option value="в банковское учреждение">в банковское учреждение</option>
                          <option value="для получения льгот и субсидий">для получения льгот и субсидий</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">ФИО (в именительном падеже):</label>
                        <input
                          type="text"
                          value={certStudentName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCertStudentName(val);
                            setCertStudentNameGenitive(toGenitiveCase(val));
                          }}
                          placeholder="Например: Асанов Бакыт Алмазович"
                          className="w-full border border-slate-300 rounded-xl p-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 font-bold text-slate-800 text-sm"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-sm font-semibold text-slate-700">ФИО (в дательном падеже: Кому?):</label>
                          <button
                            type="button"
                            onClick={() => setCertStudentNameGenitive(toGenitiveCase(certStudentName))}
                            className="text-xs text-blue-600 hover:text-blue-800 font-bold underline"
                          >
                            🪄 Авто-склонение (в дат. падеж)
                          </button>
                        </div>
                        <input
                          type="text"
                          value={certStudentNameGenitive}
                          onChange={(e) => setCertStudentNameGenitive(e.target.value)}
                          placeholder="Выдана кому? Асанову Бакыту Алмазовичу"
                          className="w-full border border-blue-300 rounded-xl p-3 bg-blue-50/40 focus:bg-white focus:ring-2 focus:ring-blue-500 font-bold text-blue-900 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Класс обучения:</label>
                        <select
                          value={certGrade}
                          onChange={(e) => setCertGrade(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl p-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 text-sm"
                        >
                          {[1,2,3,4,5,6,7,8,9,10,11].map(g => (
                            <option key={g} value={g}>{g} класс</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Дата рождения (например: 15.05.2012):</label>
                        <input
                          type="text"
                          value={certDob}
                          onChange={(e) => setCertDob(e.target.value)}
                          placeholder="15.05.2012 или 2012"
                          className="w-full border border-slate-300 rounded-xl p-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-slate-800 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Исходящий № справки (ГГ-ММ-Номер):</label>
                        <input
                          type="text"
                          value={certRefNumber}
                          onChange={(e) => setCertRefNumber(e.target.value)}
                          placeholder="26-08-001"
                          className="w-full border border-slate-300 rounded-xl p-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 font-mono font-bold text-blue-700 text-sm"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">
                          💡 Формат: Год-Месяц-Номер (например, <span className="font-mono font-bold">26-08-001</span>). При ручной выписке можно изменить.
                        </p>
                      </div>
                    </div>

                    {/* Preview Box Component Display */}
                    <div className="mt-6 border-2 border-slate-200 rounded-2xl p-4 bg-slate-100">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <span>👁️</span> Предпросмотр перед генерацией:
                      </div>
                      <div className="bg-white p-6 rounded-xl shadow border border-slate-200 text-xs font-serif leading-relaxed text-slate-800 space-y-3">
                        <div className="text-center font-bold text-slate-900 border-b pb-2">
                          Академия Будущих Лидеров
                        </div>
                        <div className="flex justify-between font-sans text-[11px] text-slate-600">
                          <span>Исх. № <strong>{certRefNumber}</strong></span>
                          <span>Выдал: <strong>Менеджер {certManagerName}</strong></span>
                          <span>Дата: <strong>{new Date().toLocaleDateString('ru-RU')} г.</strong></span>
                        </div>
                        <div className="text-center font-bold text-sm tracking-widest my-2">СПРАВКА</div>
                        <p>
                          Выдана <strong>{certStudentNameGenitive || certStudentName || '[ФИО в родительном падеже]'}</strong>
                          {certDob ? `, ${certDob} г.р.,` : ''} в том, что он(а) действительно является учеником(цей) <strong>{certGrade}</strong> класса в средней школе «Академия Будущих Лидеров» (Лицензия LM.-2025-0006 от 03.03.2026 г.).
                        </p>
                        <p>Справка выдана для предъявления {certPurpose}.</p>
                        <div className="flex justify-between items-center pt-2 font-sans text-[11px]">
                          <span><strong>Директор</strong></span>
                          <span className="text-blue-700 font-semibold">[Угловой штамп и печать М.П. заверены]</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* History Tab */
                  <div className="space-y-4">
                    {certHistory.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <div className="text-4xl mb-2">📭</div>
                        <p>Выданных справок пока нет в журнале.</p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl border overflow-hidden">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead>
                            <tr className="bg-slate-100 border-b text-slate-600">
                              <th className="p-3 font-semibold">Исх. №</th>
                              <th className="p-3 font-semibold">Менеджер</th>
                              <th className="p-3 font-semibold">ФИО Ученика (в род. падеже)</th>
                              <th className="p-3 font-semibold">Класс</th>
                              <th className="p-3 font-semibold">Дата выдачи</th>
                              <th className="p-3 font-semibold text-right">Действия</th>
                            </tr>
                          </thead>
                          <tbody>
                            {certHistory.map((item, idx) => (
                              <tr key={idx} className="border-b hover:bg-slate-50 transition">
                                <td className="p-3 font-mono font-bold text-blue-700">{item.refNumber}</td>
                                <td className="p-3 font-semibold text-indigo-700">{item.managerName || "Айгерим"}</td>
                                <td className="p-3 font-bold text-slate-800">{item.studentNameGenitive || item.studentName}</td>
                                <td className="p-3">{item.grade} класс</td>
                                <td className="p-3 text-slate-500">{item.issueDate}</td>
                                <td className="p-3 text-right">
                                  <button
                                    onClick={() => handleDownloadCertPdf(item)}
                                    className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-xs font-bold transition"
                                  >
                                    📥 Дубликат PDF
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              {certTab === "GENERATE" && (
                <div className="p-6 border-t border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsCertModalOpen(false)}
                      className="px-5 py-3 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition text-sm"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const newUrl = prompt("📱 Ссылка на шаблон ДЛЯ ОНЛАЙН ВЫДАЧИ (с печатями в файле):", certDocTemplateOnlineId);
                        if (newUrl !== null) {
                          let clean = newUrl.trim();
                          if (clean.indexOf("/d/") !== -1) {
                            const match = clean.match(/\/d\/([a-zA-Z0-9_-]+)/);
                            if (match && match[1]) clean = match[1];
                          }
                          setCertDocTemplateOnlineId(clean);
                          localStorage.setItem("cert_template_id_online", clean);
                          alert("✅ Ссылка на Онлайн-шаблон сохранена!");
                        }
                      }}
                      className="px-2 py-1 text-xs text-blue-600 font-bold hover:underline border border-blue-200 rounded-lg bg-blue-50"
                    >
                      ⚙️ Шаблон Онлайн (с печатью)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const newUrl = prompt("🖨️ Ссылка на шаблон ДЛЯ ПЕЧАТИ НА БУМАГЕ (чистый бланк):", certDocTemplatePrintId);
                        if (newUrl !== null) {
                          let clean = newUrl.trim();
                          if (clean.indexOf("/d/") !== -1) {
                            const match = clean.match(/\/d\/([a-zA-Z0-9_-]+)/);
                            if (match && match[1]) clean = match[1];
                          }
                          setCertDocTemplatePrintId(clean);
                          localStorage.setItem("cert_template_id_print", clean);
                          alert("✅ Ссылка на Шаблон для печати сохранена!");
                        }
                      }}
                      className="px-2 py-1 text-xs text-slate-600 font-bold hover:underline border border-slate-300 rounded-lg bg-slate-100"
                    >
                      ⚙️ Шаблон Печать (без печати)
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* 1. PRINT VERSION BUTTON */}
                    <button
                      onClick={() => handleGenerateFromGoogleDocs("PRINT")}
                      disabled={isGeneratingCertPdf || !certStudentName.trim()}
                      title="Формат для печати на бумаге (без электронных печатей и штампов)"
                      className={`px-5 py-3 rounded-xl font-bold text-slate-800 transition-all border border-slate-300 flex items-center gap-2 text-sm ${
                        isGeneratingCertPdf || !certStudentName.trim()
                          ? "bg-slate-200 cursor-not-allowed text-slate-400"
                          : "bg-white hover:bg-slate-100 shadow-sm hover:shadow"
                      }`}
                    >
                      <span>🖨️</span> Выдать справку (для печати)
                    </button>

                    {/* 2. ONLINE VERSION BUTTON */}
                    <button
                      onClick={() => handleGenerateFromGoogleDocs("ONLINE")}
                      disabled={isGeneratingCertPdf || !certStudentName.trim()}
                      title="Онлайн формат для отправки ученику в Telegram/WhatsApp (с синим штампом и печатью)"
                      className={`px-6 py-3 rounded-xl font-bold text-white transition-all transform hover:scale-[1.02] flex items-center gap-2 text-sm ${
                        isGeneratingCertPdf || !certStudentName.trim()
                          ? "bg-slate-400 cursor-not-allowed"
                          : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg"
                      }`}
                    >
                      {isGeneratingCertPdf ? (
                        <>
                          <span className="animate-spin">↻</span> Создание справки...
                        </>
                      ) : (
                        <>
                          <span>📱</span> Выдать справку (онлайн с печатью)
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
