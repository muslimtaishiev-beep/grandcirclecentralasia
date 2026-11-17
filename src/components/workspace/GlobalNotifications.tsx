import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Check, X } from 'lucide-react';
import { useNotifications, type AppNotification } from '../../lib/useNotifications';
import { useAuth } from '../../contexts/AuthContext';
import { useOutletContext, useNavigate } from 'react-router-dom';
import clsx from 'clsx';

export default function GlobalNotifications() {
  const { user } = useAuth();
  const { activeTenant } = useOutletContext<any>() || {};
  const { notifications, unreadCount, loaded, markAsRead, markAllAsRead } = useNotifications(activeTenant?.id, user?.uid);
  const navigate = useNavigate();
  
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Всплывашки: только то, что пришло или обновилось после входа на страницу.
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const seen = useRef<{ tenant: string; at: Map<string, number> } | null>(null);
  useEffect(() => {
    if (!loaded) return;
    const stamp = (n: AppNotification) => (n.createdAt?.toMillis ? n.createdAt.toMillis() : 0);
    const tenant = String(activeTenant?.id || '');
    if (!seen.current || seen.current.tenant !== tenant) {
      seen.current = { tenant, at: new Map(notifications.map(n => [n.id, stamp(n)])) };
      return;
    }
    const at = seen.current.at;
    const fresh = notifications.filter(n => !n.read && stamp(n) > (at.get(n.id) ?? 0));
    notifications.forEach(n => at.set(n.id, stamp(n)));
    if (!fresh.length) return;
    setToasts(t => [...fresh, ...t.filter(x => !fresh.some(f => f.id === x.id))].slice(0, 3));
    // Открытый список поступающих и карточка обновляются сами.
    fresh.forEach(n => window.dispatchEvent(new CustomEvent('sf:notification', { detail: n })));
  }, [notifications, loaded, activeTenant?.id]);
  useEffect(() => {
    if (!toasts.length) return;
    const timer = setTimeout(() => setToasts(t => t.slice(0, -1)), 12000);
    return () => clearTimeout(timer);
  }, [toasts]);
  const dismiss = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const openToast = (n: AppNotification) => {
    dismiss(n.id);
    if (!n.read) void markAsRead(n.id);
    if (n.actionUrl) navigate(n.actionUrl);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (dropdownRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Список и всплывашки — в body: шапка и страница на одном уровне наложения,
          и страница (она ниже в разметке) закрывала всё, что выпадает из шапки. */}
      {toasts.length > 0 && createPortal(
        <div className="fixed z-[90] bottom-4 left-4 right-4 sm:left-auto sm:w-96 flex flex-col gap-2" aria-live="polite">
          {toasts.map(n => (
            <div key={n.id} className="animate-toast-in flex items-start gap-3 p-3 pr-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xl">
              <button className="flex-1 min-w-0 flex items-start gap-3 text-left" onClick={() => openToast(n)}>
                <span className="w-8 h-8 shrink-0 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] grid place-items-center"><Bell className="w-4 h-4" /></span>
                <span className="min-w-0">
                  <span className="block font-semibold text-sm text-[var(--text-main)]">{n.title}</span>
                  <span className="block text-xs text-[var(--text-muted)] mt-0.5">{n.body}</span>
                </span>
              </button>
              <button className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5" onClick={() => dismiss(n.id)} aria-label="Закрыть"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>, document.body
      )}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[var(--bg-surface)]"></span>
        )}
      </button>

      {isOpen && createPortal(
        <div ref={panelRef} className="fixed top-14 right-2 sm:right-4 mt-1 w-80 max-w-[calc(100vw-1rem)] bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-xl z-[80] flex flex-col overflow-hidden max-h-[min(500px,calc(100dvh-5rem))]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
            <h3 className="font-semibold text-[var(--text-main)] text-sm">Уведомления</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Прочитать все
              </button>
            )}
          </div>
          
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-[var(--text-muted)] text-sm">
                Нет новых уведомлений
              </div>
            ) : (
              <div className="flex flex-col">
                {notifications.map(n => (
                  <div 
                    key={n.id} 
                    onClick={() => { if (!n.read) markAsRead(n.id); if (n.actionUrl) { setIsOpen(false); navigate(n.actionUrl); } }}
                    className={clsx(
                      "p-4 border-b border-[var(--border-color)] last:border-b-0 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition",
                      !n.read ? "bg-[var(--accent)]/5" : ""
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={clsx(
                        "w-2 h-2 rounded-full mt-1.5 shrink-0",
                        !n.read ? "bg-[var(--accent)]" : "bg-transparent"
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className={clsx("font-medium text-sm text-[var(--text-main)]", n.actionUrl && "hover:underline")}>
                          {n.title}
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">
                          {n.body}
                        </p>
                        <div className="text-[10px] text-[var(--text-muted)] mt-1.5 opacity-70">
                          {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString('ru-RU') : 'Только что'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>, document.body
      )}
    </div>
  );
}
