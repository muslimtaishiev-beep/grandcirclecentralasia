import { auth as firebaseAuth } from "../lib/firebase";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { testsData } from "../data/testsData";

export default function ManagerForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlShortId = searchParams.get("shortId") || searchParams.get("testId") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [shortId, setShortId] = useState(urlShortId);
  const [student, setStudent] = useState<any>(null);

  const [managerName, setManagerName] = useState("");
  const [childName, setChildName] = useState("");
  const [parentName, setParentName] = useState("");
  const [phone, setPhone] = useState("");
  const [sentToPsych, setSentToPsych] = useState(false);
  const [managerComment, setManagerComment] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        setIsAuthenticated(true);
      }
    });
    return unsub;
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
    } catch (err: any) {
      setError("Ошибка входа: " + err.message);
    }
  };

  const fetchStudent = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("https://grand-circle-secure-proxy.vercel.app/api/gas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getStudentByShortId", shortId })
      });
      const data = await res.json();
      if (data.success) {
        setStudent(data.student);
        setChildName(data.student.studentName);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const submitForm = async () => {
    if (!managerName || !childName || !parentName || !phone) {
      setError("Заполните все обязательные поля");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("https://grand-circle-secure-proxy.vercel.app/api/gas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submitManagerForm",
          shortId,
          childName,
          parentName,
          phone,
          managerName,
          managerComment,
          sentToPsych
        })
      });
      const data = await res.json();
      if (data.success) {
        navigate("/manager-dashboard");
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-6 text-center text-slate-800">Вход для менеджеров</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="email" 
              placeholder="Email" 
              value={email} 
              onChange={e=>setEmail(e.target.value)}
              className="w-full border p-3 rounded-xl bg-slate-50"
              required
            />
            <input 
              type="password" 
              placeholder="Пароль" 
              value={password} 
              onChange={e=>setPassword(e.target.value)}
              className="w-full border p-3 rounded-xl bg-slate-50"
              required
            />
            {error && <div className="text-red-500 text-sm">{error}</div>}
            <button type="submit" className="w-full bg-blue-600 text-white font-medium py-3 rounded-xl hover:bg-blue-700 transition">
              Войти
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-blue-600 px-8 py-6 text-white text-center flex justify-between items-center">
          <h1 className="text-2xl font-bold">Анкета Менеджера</h1>
          <button onClick={() => navigate("/manager-dashboard")} className="text-sm bg-white/20 px-3 py-1 rounded-lg">Кабинет</button>
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
                if (student.grade && testsData[student.grade as any]) {
                  const gradeData = testsData[student.grade as any];
                  maxRu = gradeData.russian.reduce((sum, q) => sum + (q.points || 1), 0);
                  maxMa = gradeData.math.reduce((sum, q) => sum + (q.points || 1), 0);
                  if (gradeData.logic) {
                    maxLo = gradeData.logic.reduce((sum, q) => sum + (q.points || 1), 0);
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
                  onClick={() => handleSubmit(false)}
                  disabled={loading}
                  className="flex-1 py-4 bg-slate-200 text-slate-700 rounded-xl font-medium disabled:opacity-50 hover:bg-slate-300 transition"
                >
                  Принять (без психолога)
                </button>
                <button 
                  onClick={() => handleSubmit(true)}
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
