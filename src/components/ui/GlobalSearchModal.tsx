import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, FileText, FileSpreadsheet, CheckSquare, Briefcase, MessageSquare, X, ArrowRight } from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const quickLinks = [
    { title: 'Чаты и сообщения', path: `/workspace/${orgId}/chat`, icon: MessageSquare, category: 'Коммуникации' },
    { title: 'Задачи и проекты', path: `/workspace/${orgId}/tasks`, icon: CheckSquare, category: 'Планирование' },
    { title: 'CRM Сделки & Контакты', path: `/workspace/${orgId}/crm/deals`, icon: Briefcase, category: 'Продажи' },
    { title: 'База знаний и документы', path: `/workspace/${orgId}/docs`, icon: FileText, category: 'Документы' },
    { title: 'Электронные таблицы', path: `/workspace/${orgId}/sheets`, icon: FileSpreadsheet, category: 'Аналитика' },
  ];

  const filtered = quickLinks.filter(item =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-start justify-center pt-20 p-4 animate-fade-in">
      <div className="w-full max-w-xl bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[var(--text-main)]">
        
        {/* Input Header */}
        <div className="p-4 border-b border-[var(--border-color)] flex items-center gap-3">
          <Search className="w-5 h-5 text-emerald-500 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Быстрый поиск по задачам, документам, чатам (Cmd+K)..."
            className="w-full bg-transparent outline-hidden text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)]"
            autoFocus
          />
          <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="p-3 max-h-80 overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-muted)]">
              Ничего не найдено по запросу "{query}"
            </div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={idx}
                onClick={() => {
                  navigate(item.path);
                  onClose();
                }}
                className="group flex items-center justify-between p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm group-hover:text-emerald-500 transition">{item.title}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">{item.category}</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition" />
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-[var(--bg-panel)] border-t border-[var(--border-color)] flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono">
          <span>Нажмите <kbd className="px-1.5 py-0.5 bg-black/10 dark:bg-white/10 rounded">ESC</kbd> для закрытия</span>
          <span>Быстрый поиск</span>
        </div>

      </div>
    </div>
  );
}
