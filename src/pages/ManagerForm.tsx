import { auth as firebaseAuth } from "../lib/firebase";
import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { fetchGasAPI } from "../lib/utils";
// html2pdf весит 961 КБ и нужен только по нажатию «скачать PDF». Статический
// импорт заставлял КАЖДОГО менеджера скачивать его при открытии экрана —
// почти мегабайт до первой отрисовки. Теперь подгружается по требованию.
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
  // Печать организации — из её реквизитов (публичный срез), не из кода.
  const [stampUrl, setStampUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!routeOrgId) return;
    fetch(`/api/tenant/public?id=${encodeURIComponent(routeOrgId)}`)
      .then(r => r.json()).then(j => setStampUrl(j?.tenant?.legal?.stampUrl || null)).catch(() => {});
  }, [routeOrgId]);

  const generatePdf = () => {
    if (!student || !student.diagnosticsRaw || Object.keys(student.diagnosticsRaw).length === 0) {
      alert("У данного ученика нет сохраненных данных аналитики.");
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
              alert("PDF успешно сохранен на Google Диск!");
            } else {
              alert("Ошибка при сохранении на Диск: " + (res.error || JSON.stringify(res)));
            }
          } catch(err: any) {
            alert("Критическая ошибка сети при сохранении: " + err.message);
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
  const [sentToPsych, setSentToPsych] = useState(false);
  const [managerComment, setManagerComment] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchStudent = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchGasAPI("/api/gas", { action: "getStudentByShortId", shortId, tenantId });
      if (data.success) {
        setStudent(data.student);
        setChildName(data.student.studentName);
        if (data.student.grade) {
          try {
            const snap = await getDoc(doc(db, 'tests', `test_grade_${data.student.grade}_${tenantId}`));
            if (snap.exists()) {
              setGradeData(snap.data().questions);
            }
          } catch(e) {}
        }
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const submitForm = async (isPsych: boolean) => {
    if (!managerName || !childName || !parentName || !phone) {
      setError("Заполните все обязательные поля");
      return;
    }
    setLoading(true);
    try {
      const data = await fetchGasAPI("/api/gas", {
          action: "submitManagerForm",
          shortId,
          childName,
          parentName,
          phone,
          managerName,
          managerComment,
          sentToPsych: isPsych,
          tenantId
      });
      if (data.success) {
        if (isPsych) {
          navigate(`/receipt/${shortId}${tenantId ? `?tenantId=${tenantId}` : ''}`);
        } else {
          navigate(cabinetPath);
        }
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-4 text-slate-500">
        Загрузка...
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 py-12 px-4">
      {student && (
        <div style={{ width: 0, height: 0, overflow: "hidden" }}>
          <DiagnosticReportPdf student={student} stampUrl={stampUrl} />
        </div>
      )}
      <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-blue-600 px-8 py-6 text-white text-center flex justify-between items-center">
          <h1 className="text-2xl font-bold">Анкета Менеджера</h1>
          <button onClick={() => navigate(cabinetPath)} className="text-sm bg-white/20 px-3 py-1 rounded-lg">Кабинет</button>
        </div>

        <div className="p-8">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm border border-red-100">
              {error}
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
                  className="w-full border rounded-xl p-3 text-xl tracking-widest bg-slate-50 font-mono" 
                />
                <button onClick={fetchStudent} disabled={loading} className="bg-blue-600 text-white px-6 rounded-xl font-medium">
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
                  <div className="bg-green-50 border border-green-100 p-4 rounded-xl mb-6">
                    <h3 className="font-bold text-green-800 text-lg mb-2">Ученик найден</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm text-green-700">
                      <div>Класс: <b>{student.grade}</b></div>
                      <div>Общий балл: <b>{student.totalScore} из {totalMax} <span className="text-xs">({percent}%)</span></b></div>
                      <div>Русский: <b>{student.russian} из {maxRu}</b></div>
                      <div>Математика: <b>{student.math} из {maxMa}</b></div>
                      <div>Логика: <b>{student.logic} из {maxLo}</b></div>
                      {student.cheated && <div className="col-span-2 text-red-600 font-bold bg-red-100 px-2 py-1 rounded inline-block w-max mt-2">! Заподозрен в списывании</div>}
                    </div>
                    {student.diagnosticsRaw && Object.keys(student.diagnosticsRaw).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-green-200">
                        <button 
                          onClick={generatePdf} 
                          disabled={analyzing}
                          className={`px-4 py-2 rounded-xl shadow-sm font-medium flex items-center gap-2 ${
                            analyzing 
                              ? "bg-gray-200 text-gray-500 cursor-not-allowed" 
                              : "bg-white text-green-700 hover:bg-green-100 border border-green-200"
                          }`}
                        >
                          {analyzing ? (
                            <><span className="animate-spin text-green-700">↻</span> Генерация и сохранение...</>
                          ) : (
                            <>📄 Скачать Анализ работы</>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">Имя менеджера *</label>
                  <input type="text" value={managerName} onChange={e=>setManagerName(e.target.value)} className="w-full border rounded-xl p-3 bg-slate-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">Имя ученика *</label>
                  <input type="text" value={childName} onChange={e=>setChildName(e.target.value)} className="w-full border rounded-xl p-3 bg-slate-50" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">ФИО Родителя *</label>
                  <input type="text" value={parentName} onChange={e=>setParentName(e.target.value)} className="w-full border rounded-xl p-3 bg-slate-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">Телефон *</label>
                  <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full border rounded-xl p-3 bg-slate-50" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Комментарий менеджера</label>
                <textarea value={managerComment} onChange={e=>setManagerComment(e.target.value)} className="w-full border rounded-xl p-3 bg-slate-50 h-24"></textarea>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  onClick={() => submitForm(false)}
                  disabled={loading}
                  className="flex-1 py-4 bg-slate-200 text-slate-700 rounded-xl font-medium disabled:opacity-50 hover:bg-slate-300 transition"
                >
                  Принять (без психолога)
                </button>
                <button 
                  onClick={() => submitForm(true)}
                  disabled={loading}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-blue-700 transition"
                >
                  Направить к психологу
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
