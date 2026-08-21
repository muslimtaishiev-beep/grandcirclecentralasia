import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, Trash } from 'lucide-react';
import { useNotifications } from '../../lib/useNotifications';
import { useAuth } from '../../contexts/AuthContext';
import { useOutletContext, Link } from 'react-router-dom';
import clsx from 'clsx';

export default function GlobalNotifications() {
  const { user } = useAuth();
  const { activeTenant } = useOutletContext<any>();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(activeTenant?.id, user?.uid);
  
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[var(--bg-surface)]"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-xl z-50 flex flex-col overflow-hidden max-h-[500px]">
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
                    onClick={() => { if (!n.read) markAsRead(n.id); }}
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
                        {n.actionUrl ? (
                          <Link to={n.actionUrl} className="font-medium text-sm text-[var(--text-main)] hover:underline">
                            {n.title}
                          </Link>
                        ) : (
                          <div className="font-medium text-sm text-[var(--text-main)]">
                            {n.title}
                          </div>
                        )}
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
        </div>
      )}
    </div>
  );
}
