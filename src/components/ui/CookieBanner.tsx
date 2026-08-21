import React, { useState, useEffect } from 'react';
import { Cookie, Shield, Check, X } from 'lucide-react';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent_v1');
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const acceptAll = () => {
    localStorage.setItem('cookie_consent_v1', JSON.stringify({ analytics: true, essential: true, date: new Date().toISOString() }));
    setVisible(false);
  };

  const acceptEssentialOnly = () => {
    localStorage.setItem('cookie_consent_v1', JSON.stringify({ analytics: false, essential: true, date: new Date().toISOString() }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 bg-[var(--bg-surface)]/95 backdrop-blur-xl border border-[var(--border-color)] rounded-2xl p-5 shadow-2xl space-y-3 animate-fade-in text-[var(--text-main)]">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
          <Cookie className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-sm flex items-center gap-1.5">
            Конфиденциальность и Куки
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Мы используем cookie-файлы и локальное хранилище для безопасной аутентификации и улучшения работы сервиса.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
        <button
          onClick={acceptEssentialOnly}
          className="px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition"
        >
          Только необходимые
        </button>
        <button
          onClick={acceptAll}
          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl flex items-center gap-1 transition cursor-pointer shadow-sm"
        >
          <Check className="w-3.5 h-3.5" /> Принять все
        </button>
      </div>
    </div>
  );
}
