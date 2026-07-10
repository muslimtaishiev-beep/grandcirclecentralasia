import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function ManagerDashboard() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [auth, setAuth] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "manager2024") {
      setAuth(true);
      fetchStudents();
    } else {
      setError("Неверный пароль");
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    setError("");
    try {
      const gasUrl = import.meta.env.VITE_GAS_URL || "";
      const res = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "getAllStudents" })
      });
      const data = await res.json();
      if (data.success) {
        setStudents(data.students);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const updateDecision = async (shortId: string, decision: string) => {
    const confirm = window.confirm(`Вы уверены, что хотите установить статус "${decision}" для ученика ${shortId}?`);
    if (!confirm) return;

    try {
      const gasUrl = import.meta.env.VITE_GAS_URL || "";
      const res = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "updateFinalDecision", shortId, finalDecision: decision })
      });
      const data = await res.json();
      if (data.success) {
        setStudents(prev => prev.map(s => s.shortId === shortId ? { ...s, finalDecision: decision } : s));
      } else {
        alert("Ошибка: " + data.error);
      }
    } catch (err) {
      alert("Ошибка сети");
    }
  };

  if (!auth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">📊</div>
          <h2 className="text-2xl font-bold mb-4">Кабинет Менеджера</h2>
          {error && <div className="text-red-500 mb-4 text-sm">{error}</div>}
          <form onSubmit={handleAuth}>
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
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800">CRM Учеников</h1>
          <div className="flex gap-4">
            <button onClick={fetchStudents} className="bg-white text-slate-600 px-4 py-2 rounded-xl shadow border font-medium hover:bg-slate-50">Обновить</button>
            <button onClick={() => navigate("/manager/form")} className="bg-blue-600 text-white px-4 py-2 rounded-xl shadow font-medium hover:bg-blue-700">+ Новая анкета</button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-500">Загрузка данных...</div>
        ) : (
          <div className="bg-white rounded-2xl shadow overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 border-b">
                  <th className="p-4 font-medium">Short ID</th>
                  <th className="p-4 font-medium">Имя ученика</th>
                  <th className="p-4 font-medium">Менеджер</th>
                  <th className="p-4 font-medium">Баллы (Р/М/Л)</th>
                  <th className="p-4 font-medium">Психолог</th>
                  <th className="p-4 font-medium">Статус Психолога</th>
                  <th className="p-4 font-medium">Финальное решение</th>
                  <th className="p-4 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={i} className="border-b hover:bg-slate-50 transition">
                    <td className="p-4 font-mono font-bold text-blue-600">{s.shortId}</td>
                    <td className="p-4 font-medium">{s.childName}</td>
                    <td className="p-4 text-slate-500">{s.managerName}</td>
                    <td className="p-4">
                      <span className="bg-slate-100 px-2 py-1 rounded text-xs mr-1">{s.ru}</span>
                      <span className="bg-slate-100 px-2 py-1 rounded text-xs mr-1">{s.ma}</span>
                      <span className="bg-slate-100 px-2 py-1 rounded text-xs">{s.lo}</span>
                    </td>
                    <td className="p-4">
                      {s.sentToPsych === "ДА" ? <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold">НАПРАВЛЕН</span> : <span className="text-slate-400 text-xs">НЕТ</span>}
                    </td>
                    <td className="p-4">
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
                          <button onClick={() => updateDecision(s.shortId, "ПРИНЯТ")} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200">Принять</button>
                          <button onClick={() => updateDecision(s.shortId, "ОТКЛОНЕН")} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200">Отклонить</button>
                        </div>
                      )}
                      {s.managerName === "Не назначен" && (
                        <button onClick={() => navigate(`/manager/form?testId=${s.shortId}`)} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200">Заполнить анкету</button>
                      )}
                    </td>
                  </tr>
                ))}
                {students.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center p-8 text-slate-500">Нет данных</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
