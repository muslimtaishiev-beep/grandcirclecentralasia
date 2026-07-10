import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function ManagerForm() {
  const [searchParams] = useSearchParams();
  const testId = searchParams.get("testId");
  const ts = searchParams.get("ts");
  const token = searchParams.get("token");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    manager: "",
    parentName: "",
    phone: "",
    stage: "",
    paymentPreInfo: "",
    deposit: "",
    totalCost: "",
    paymentMinus1Month: ""
  });

  useEffect(() => {
    if (!testId || !ts || !token) {
      setError("Неверная или поврежденная ссылка");
      return;
    }

    // Проверка времени жизни QR кода (15 минут = 900000 мс)
    const timestamp = parseInt(ts, 10);
    if (Date.now() - timestamp > 900000) {
      setError("Срок действия QR-кода истёк (прошло больше 15 минут).");
      return;
    }

    // Простая проверка подписи
    try {
      const expectedToken = btoa(`${testId}:${ts}:studyfree-secret`);
      if (token !== expectedToken) {
        setError("Неверная цифровая подпись.");
      }
    } catch (e) {
      setError("Ошибка проверки токена.");
    }
  }, [testId, ts, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const gasUrl = import.meta.env.VITE_GAS_URL || "";
      if (!gasUrl) {
        alert("Google Apps Script URL не настроен.");
        setLoading(false);
        return;
      }

      const res = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "submitManagerForm",
          testId,
          ...formData
        })
      });

      const result = await res.json();
      if (result.success) {
        setSuccess(true);
      } else {
        alert("Ошибка сохранения: " + result.error);
      }
    } catch (err) {
      alert("Ошибка сети при отправке");
    }
    setLoading(false);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow max-w-sm text-center">
          <div className="text-red-500 font-bold text-xl mb-2">Доступ запрещен</div>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow max-w-sm text-center">
          <div className="text-emerald-500 font-bold text-2xl mb-2">Готово!</div>
          <p className="text-slate-600">Данные успешно отправлены в CRM (Google Sheets).</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-6 sm:p-8">
        <h1 className="text-2xl font-bold mb-6">Оформление ученика</h1>
        <div className="text-sm text-slate-500 mb-6 bg-slate-100 p-3 rounded-lg font-mono break-all">
          ID Теста: {testId}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Менеджер</label>
            <select 
              required
              value={formData.manager}
              onChange={(e) => setFormData({...formData, manager: e.target.value})}
              className="w-full border rounded-xl p-3 bg-slate-50"
            >
              <option value="">Выберите себя</option>
              <option value="Калия">Калия</option>
              <option value="Гуля">Гуля</option>
              <option value="Айгерим">Айгерим</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">ФИО Родителя</label>
            <input 
              required type="text"
              value={formData.parentName}
              onChange={(e) => setFormData({...formData, parentName: e.target.value})}
              className="w-full border rounded-xl p-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Номер ученика</label>
            <input 
              required type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="w-full border rounded-xl p-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Стадия работы</label>
            <input 
              required type="text"
              value={formData.stage}
              onChange={(e) => setFormData({...formData, stage: e.target.value})}
              className="w-full border rounded-xl p-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Оплата до.инфо</label>
            <input 
              required type="number"
              value={formData.paymentPreInfo}
              onChange={(e) => setFormData({...formData, paymentPreInfo: e.target.value})}
              className="w-full border rounded-xl p-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Взнос</label>
            <input 
              required type="number"
              value={formData.deposit}
              onChange={(e) => setFormData({...formData, deposit: e.target.value})}
              className="w-full border rounded-xl p-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Общая стоимость после скидки</label>
            <input 
              required type="number"
              value={formData.totalCost}
              onChange={(e) => setFormData({...formData, totalCost: e.target.value})}
              className="w-full border rounded-xl p-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Оплата -1-месяц</label>
            <input 
              required type="number"
              value={formData.paymentMinus1Month}
              onChange={(e) => setFormData({...formData, paymentMinus1Month: e.target.value})}
              className="w-full border rounded-xl p-3"
            />
          </div>

          <button 
            disabled={loading}
            type="submit"
            className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl mt-6 disabled:opacity-50 hover:bg-blue-700 transition"
          >
            {loading ? "Отправка..." : "Отправить в CRM"}
          </button>
        </form>
      </div>
    </div>
  );
}
