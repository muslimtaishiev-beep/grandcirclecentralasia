import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function ManagerForm() {
  const [searchParams] = useSearchParams();
  const testId = searchParams.get("testId");

  const [manager, setManager] = useState("");
  const [parentName, setParentName] = useState("");
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState("Консультация");
  const [paymentPreInfo, setPaymentPreInfo] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [paymentMinus1Month, setPaymentMinus1Month] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!testId) {
      setError("Некорректная ссылка: Отсутствует ID теста. Пожалуйста, отсканируйте правильный QR-код.");
    }
  }, [testId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testId) return;

    setLoading(true);
    setError("");

    try {
      const gasUrl = import.meta.env.VITE_GAS_URL || "";
      if (!gasUrl) throw new Error("Системная ошибка: Не настроен URL базы данных.");

      const res = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "submitManagerForm",
          testId,
          manager,
          parentName,
          phone,
          stage,
          paymentPreInfo,
          deposit,
          totalCost,
          paymentMinus1Month
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || "Произошла ошибка на сервере.");
      }
    } catch (err: any) {
      setError(err.message || "Ошибка подключения к сети.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✓</div>
          <h2 className="text-2xl font-bold mb-2">Анкета успешно отправлена!</h2>
          <p className="text-slate-500 mb-6">Данные успешно сохранены в CRM.</p>
          <button onClick={() => window.location.href="/"} className="text-blue-600 font-medium">Вернуться на главную</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-blue-600 px-8 py-6 text-white text-center">
          <h1 className="text-2xl font-bold">Анкета Менеджера</h1>
          <p className="opacity-80 text-sm mt-1">ID Теста: {testId || "ОШИБКА"}</p>
        </div>

        <div className="p-8">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm border border-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Имя менеджера</label>
                <input required type="text" value={manager} onChange={e=>setManager(e.target.value)} className="w-full border rounded-xl p-3 bg-slate-50" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">ФИО Родителя</label>
                <input required type="text" value={parentName} onChange={e=>setParentName(e.target.value)} className="w-full border rounded-xl p-3 bg-slate-50" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Телефон</label>
                <input required type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full border rounded-xl p-3 bg-slate-50" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Стадия работы</label>
                <select value={stage} onChange={e=>setStage(e.target.value)} className="w-full border rounded-xl p-3 bg-slate-50">
                  <option>Консультация</option>
                  <option>Договор подписан</option>
                  <option>Отказ</option>
                  <option>Думают</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-4">Финансы</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">Оплата до.инфо</label>
                  <input type="number" min="0" value={paymentPreInfo} onChange={e=>setPaymentPreInfo(Number(e.target.value))} className="w-full border rounded-xl p-3 bg-slate-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">Взнос</label>
                  <input type="number" min="0" value={deposit} onChange={e=>setDeposit(Number(e.target.value))} className="w-full border rounded-xl p-3 bg-slate-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">Общая стоимость</label>
                  <input type="number" min="0" value={totalCost} onChange={e=>setTotalCost(Number(e.target.value))} className="w-full border rounded-xl p-3 bg-slate-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">Оплата -1-месяц</label>
                  <input type="number" min="0" value={paymentMinus1Month} onChange={e=>setPaymentMinus1Month(Number(e.target.value))} className="w-full border rounded-xl p-3 bg-slate-50" />
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading || !testId}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-blue-700 transition"
            >
              {loading ? "Отправка..." : "Сохранить анкету в CRM"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
