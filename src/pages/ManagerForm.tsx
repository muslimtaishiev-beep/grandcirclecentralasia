import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function ManagerForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlShortId = searchParams.get("shortId") || searchParams.get("testId") || "";

  const [password, setPassword] = useState("");
  const [auth, setAuth] = useState(() => localStorage.getItem("managerAuth") === "true");
  const [shortId, setShortId] = useState(urlShortId);
  const [student, setStudent] = useState<any>(null);

  const [managerName, setManagerName] = useState("");
  const [childName, setChildName] = useState("");
  const [parentName, setParentName] = useState("");
  const [phone, setPhone] = useState("");
  const [managerComment, setManagerComment] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "manager2024" || localStorage.getItem("managerAuth") === "true") {
      setAuth(true);
      localStorage.setItem("managerAuth", "true");
      if (shortId) fetchStudent();
    } else {
      setError("Неверный пароль");
    }
  };

  useEffect(() => {
    if (auth && shortId) {
      fetchStudent();
    }
  }, []);

  const fetchStudent = async () => {
    if (!shortId) return;
    setLoading(true);
    setError("");
    try {
      const gasUrl = import.meta.env.VITE_GAS_URL || "";
      const res = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "getStudentByShortId", shortId })
      });
      const data = await res.json();
      if (data.success) {
        setStudent(data.student);
        setChildName(data.student.studentName);
      } else {
        setError(data.error);
        setStudent(null);
      }
    } catch (err: any) {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (sentToPsych: boolean) => {
    if (!managerName || !childName || !parentName || !phone) {
      setError("Заполните все обязательные поля!");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const gasUrl = import.meta.env.VITE_GAS_URL || "";
      const res = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
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
        if (sentToPsych) {
          navigate(`/receipt/${shortId}`);
        } else {
          alert("Данные успешно сохранены в CRM!");
          navigate("/manager-dashboard");
        }
      } else {
        setError(data.error || "Ошибка сервера");
      }
    } catch (err: any) {
      setError("Ошибка подключения");
    } finally {
      setLoading(false);
    }
  };

  if (!auth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center">
          <h2 className="text-2xl font-bold mb-4">Вход менеджера</h2>
          {error && <div className="text-red-500 mb-4 text-sm">{error}</div>}
          <form onSubmit={handleAuth}>
            <input 
              type="password" 
              placeholder="Пароль" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border p-3 rounded-xl mb-4 bg-slate-50"
            />
            <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-xl font-medium">Войти</button>
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
              <div className="bg-green-50 border border-green-100 p-4 rounded-xl mb-6">
                <h3 className="font-bold text-green-800 text-lg mb-2">Ученик найден</h3>
                <div className="grid grid-cols-2 gap-2 text-sm text-green-700">
                  <div>Класс: <b>{student.grade}</b></div>
                  <div>Общий балл: <b>{student.totalScore}</b></div>
                  <div>Русский: <b>{student.russian}</b></div>
                  <div>Математика: <b>{student.math}</b></div>
                  <div>Логика: <b>{student.logic}</b></div>
                </div>
              </div>

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
