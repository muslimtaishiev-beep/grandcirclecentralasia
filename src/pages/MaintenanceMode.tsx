import React, { useState, useEffect } from "react";
import { Wrench, ShieldAlert, Clock, RefreshCw, Server, AlertTriangle } from "lucide-react";

interface MaintenanceProps {
  message?: string;
  estimatedTime?: string;
  onRefreshCheck?: () => void;
}

export default function MaintenanceMode({
  message = "Идут плановые технические работы на серверах прокторинга и тестирования. Доступ будет восстановлен в ближайшее время.",
  estimatedTime = "30-45 минут",
  onRefreshCheck
}: MaintenanceProps) {
  const [timeString, setTimeString] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (onRefreshCheck) {
      onRefreshCheck();
    } else {
      window.location.reload();
    }
    setTimeout(() => setIsRefreshing(false), 1200);
  };

  return (
    <div className="min-h-dvh bg-[#050508] text-white font-sans antialiased flex flex-col justify-between relative overflow-hidden select-none">
      
      {/* ── AMBIENT BACKGROUND GLOWS ── */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
      
      {/* Grid Pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{ backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`, backgroundSize: `24px 24px` }}
      />

      {/* ── HEADER BADGE ── */}
      <header className="relative z-10 max-w-7xl mx-auto px-6 py-8 w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shadow-lg shadow-amber-500/10">
            <Wrench className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="text-xs font-mono font-bold tracking-widest text-amber-400 uppercase block">System Alert</span>
            <span className="text-sm font-black tracking-tight text-slate-200">Техническое Обслуживание</span>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-full px-4 py-1.5 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span className="text-xs font-mono text-slate-300">{timeString || "LIVE"}</span>
        </div>
      </header>

      {/* ── MAIN CONTENT CARD ── */}
      <main className="relative z-10 max-w-xl mx-auto px-6 py-12 w-full text-center my-auto">
        
        {/* Animated Icon Badge */}
        <div className="relative inline-flex items-center justify-center mb-8">
          <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/20 via-red-500/20 to-amber-500/20 rounded-full blur-xl animate-pulse" />
          <div className="w-24 h-24 rounded-3xl bg-slate-900/90 border border-amber-500/40 backdrop-blur-xl flex items-center justify-center shadow-2xl relative">
            <AlertTriangle className="w-12 h-12 text-amber-400" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4 leading-tight">
          Ведутся Технические Работы
        </h1>

        {/* Subtitle */}
        <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-8 font-medium">
          Мы обновляем серверные компоненты системы прокторинга для повышения стабильности и скорости.
        </p>

        {/* Custom Message Box from Super-Admin */}
        <div className="bg-slate-900/80 border border-amber-500/30 rounded-2xl p-5 mb-8 backdrop-blur-md shadow-2xl text-left space-y-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
          <div className="flex items-center justify-between text-xs font-mono text-amber-400 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              <span>Сообщение администратора</span>
            </span>
            <span className="text-slate-500 font-normal">System Notice</span>
          </div>
          <p className="text-slate-200 text-sm leading-relaxed font-sans font-medium">
            "{message}"
          </p>
        </div>

        {/* Estimated Time Badge */}
        {estimatedTime && (
          <div className="inline-flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-xl px-5 py-2.5 mb-8 text-xs font-mono text-slate-300">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Ориентировочное время: <strong className="text-white font-bold">{estimatedTime}</strong></span>
          </div>
        )}

        {/* Refresh Check Button */}
        <div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Проверить статус системы</span>
          </button>
        </div>

      </main>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 max-w-7xl mx-auto px-6 py-6 w-full text-center text-xs text-slate-500 font-mono flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-900">
        <div className="flex items-center gap-2">
          <Server className="w-3.5 h-3.5 text-slate-600" />
          <span>Идут технические работы</span>
        </div>
        <div>
          Все данные учеников и прогресс тестов надежно сохранены в базе.
        </div>
      </footer>

    </div>
  );
}
