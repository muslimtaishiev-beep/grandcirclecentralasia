import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, X } from 'lucide-react';

/**
 * Вышла новая версия сайта, а вкладка открыта давно — предложить обновить.
 * Раз в 5 минут и при возвращении на вкладку сравниваем имя главного
 * скрипта (/assets/index-*.js) у открытой страницы и на сервере.
 */
const SCRIPT = /\/assets\/index-[\w-]+\.js/;
const current = () => (document.querySelector('script[type="module"][src*="/assets/"]')?.getAttribute('src') || '').match(SCRIPT)?.[0] || '';

export default function UpdateBanner() {
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const mine = current();
    if (!mine) return; // разработка — сборки нет
    let stop = false;
    const check = async () => {
      if (stop || document.hidden) return;
      try {
        const html = await (await fetch(`/?v=${Date.now()}`, { cache: 'no-store' })).text();
        const live = html.match(SCRIPT)?.[0];
        if (live && live !== mine) setReady(true);
      } catch { /* нет сети — проверим позже */ }
    };
    const timer = setInterval(check, 5 * 60_000);
    const onVisible = () => { if (!document.hidden) void check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { stop = true; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  if (!ready || hidden) return null;
  return createPortal(
    <div className="fixed z-[95] top-3 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm flex items-center gap-3 p-3 pr-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xl animate-toast-in" role="status">
      <span className="flex-1 text-sm font-medium text-[var(--text-main)]">Доступна новая версия</span>
      <button onClick={() => window.location.reload()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-[var(--accent)] text-white">
        <RefreshCw className="w-4 h-4" /> Обновить
      </button>
      <button onClick={() => setHidden(true)} className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)]" aria-label="Закрыть"><X className="w-4 h-4" /></button>
    </div>,
    document.body,
  );
}
