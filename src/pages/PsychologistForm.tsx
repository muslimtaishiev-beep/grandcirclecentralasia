import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function PsychologistForm() {
  const { shortId } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [auth, setAuth] = useState(() => localStorage.getItem("psychAuth") === "true");
  const [student, setStudent] = useState<any>(null);
  
  const [verdict, setVerdict] = useState("БРАТЬ");
  const [comment, setComment] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "psycho2024" || localStorage.getItem("psychAuth") === "true") {
      setAuth(true);
      localStorage.setItem("psychAuth", "true");
      fetchStudent();
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
        body: JSON.stringify({ action: "getPsychologistStudent", shortId })
      });
      const data = await res.json();
      if (data.success) {
        setStudent(data.student);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const gasUrl = import.meta.env.VITE_GAS_URL || "";
      const res = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "submitPsychologistForm",
          shortId,
          verdict,
          comment
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(true);
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
          <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🧠</div>
          <h2 className="text-2xl font-bold mb-4">Вход Психолога</h2>
          {error && <div className="text-red-500 mb-4 text-sm">{error}</div>}
          <form onSubmit={handleAuth}>
            <input 
              type="password" 
              placeholder="Пароль" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border p-3 rounded-xl mb-4 bg-slate-50 text-center"
            />
            <button type="submit" className="w-full bg-purple-600 text-white p-3 rounded-xl font-medium">Войти</button>
          </form>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✓</div>
          <h2 className="text-2xl font-bold mb-2">Вердикт сохранен!</h2>
          <p className="text-slate-500 mb-6">Менеджеры увидят ваше решение в системе.</p>
          <button onClick={() => window.location.href="/"} className="text-purple-600 font-medium">Вернуться на главную</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-lg mx-auto bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-purple-600 px-8 py-6 text-white text-center">
          <h1 className="text-2xl font-bold">Оценка Психолога</h1>
          <p className="opacity-80 text-sm mt-1">Ученик ID: {shortId}</p>
        </div>

        <div className="p-8">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm border border-red-100">
              {error}
            </div>
          )}

          {!student && loading ? (
            <div className="text-center text-slate-500">Загрузка данных...</div>
          ) : student ? (
            <div className="space-y-6">
              <div className="bg-slate-50 border p-4 rounded-xl">
                <div className="text-sm text-slate-500 mb-1">Менеджер направил: <b>{student.managerName}</b></div>
                <div className="text-lg font-bold mb-1">{student.childName}</div>
                <div className="text-sm">Баллы: Ру {student.ru} | Ма {student.ma} | Ло {student.lo}</div>
                {student.managerComment && (
                  <div className="mt-2 text-sm italic text-slate-600 border-l-2 border-purple-300 pl-3">
                    "{student.managerComment}"
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-3 text-slate-700">Вердикт</label>
                  <div className="flex gap-4">
                    <label className={`flex-1 p-4 rounded-xl border-2 text-center cursor-pointer transition ${verdict === 'БРАТЬ' ? 'border-green-500 bg-green-50 text-green-700 font-bold' : 'border-slate-200 text-slate-500'}`}>
                      <input type="radio" className="hidden" name="verdict" value="БРАТЬ" checked={verdict === 'БРАТЬ'} onChange={e => setVerdict(e.target.value)} />
                      БРАТЬ
                    </label>
                    <label className={`flex-1 p-4 rounded-xl border-2 text-center cursor-pointer transition ${verdict === 'НЕ БРАТЬ' ? 'border-red-500 bg-red-50 text-red-700 font-bold' : 'border-slate-200 text-slate-500'}`}>
                      <input type="radio" className="hidden" name="verdict" value="НЕ БРАТЬ" checked={verdict === 'НЕ БРАТЬ'} onChange={e => setVerdict(e.target.value)} />
                      НЕ БРАТЬ
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">Комментарий психолога (необязательно)</label>
                  <textarea value={comment} onChange={e=>setComment(e.target.value)} className="w-full border rounded-xl p-3 bg-slate-50 h-32" placeholder="Опишите ваши наблюдения..."></textarea>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-4 bg-purple-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-purple-700 transition"
                >
                  {loading ? "Отправка..." : "Сохранить вердикт"}
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
