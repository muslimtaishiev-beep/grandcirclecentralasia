import React, { useState, useEffect } from 'react';
import { Settings, Loader2 } from 'lucide-react';

export default function MaintenanceControl() {
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("Идут плановые технические работы по обновлению серверов прокторинга. Доступ будет восстановлен в ближайшее время.");
  const [maintenanceTime, setMaintenanceTime] = useState("30-45 минут");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch("/api/public/maintenance")
      .then(res => res.json())
      .then(data => {
        if (data) {
          setMaintenanceEnabled(Boolean(data.enabled));
          if (data.message) setMaintenanceMessage(data.message);
          if (data.estimatedTime) setMaintenanceTime(data.estimatedTime);
        }
      })
      .catch(() => {});
  }, []);

  const handleToggle = async () => {
    setIsSaving(true);
    const newState = !maintenanceEnabled;
    try {
      const token = localStorage.getItem("admin_token") || sessionStorage.getItem("admin_token") || "";
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          enabled: newState,
          message: maintenanceMessage,
          estimatedTime: maintenanceTime
        })
      });
      if (res.ok) {
        setMaintenanceEnabled(newState);
      }
    } catch (e) {
      console.error("Failed to update maintenance mode", e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`p-5 rounded-2xl border backdrop-blur-md transition-all ${
      maintenanceEnabled 
        ? "bg-amber-500/10 border-amber-500/50" 
        : "bg-white/5 border-white/10"
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings className={`w-5 h-5 ${maintenanceEnabled ? "text-amber-500 animate-spin-slow" : "text-slate-400"}`} />
          <h3 className={`font-semibold ${maintenanceEnabled ? "text-amber-500" : "text-white"}`}>Режим тех. работ</h3>
        </div>
        <button
          onClick={handleToggle}
          disabled={isSaving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            maintenanceEnabled ? 'bg-amber-500' : 'bg-slate-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              maintenanceEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Сообщение для пользователей</label>
          <input 
            type="text" 
            value={maintenanceMessage}
            onChange={(e) => setMaintenanceMessage(e.target.value)}
            disabled={isSaving}
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Ожидаемое время</label>
          <input 
            type="text" 
            value={maintenanceTime}
            onChange={(e) => setMaintenanceTime(e.target.value)}
            disabled={isSaving}
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
          />
        </div>
      </div>
      
      {maintenanceEnabled && (
        <div className="mt-4 p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg text-[11px] text-amber-200">
          Сайт сейчас недоступен для всех, кроме суперадминистраторов.
        </div>
      )}
    </div>
  );
}
