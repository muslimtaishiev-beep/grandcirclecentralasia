import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, FileText, FileSpreadsheet, CheckSquare, Briefcase, MessageSquare, X, ArrowRight, Plus, Users, Calendar, Video, Settings, LayoutTemplate, Zap, Loader2 } from 'lucide-react';
import { searchGlobal, SearchResult } from '../../services/globalSearchService';

interface SpotlightCommandBarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SpotlightCommandBar({ isOpen, onClose }: SpotlightCommandBarProps) {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      if (orgId) {
        setLoading(true);
        const res = await searchGlobal(orgId, query);
        setResults(res);
        setLoading(false);
        setSelectedIndex(0);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query, orgId]);

  const quickActions = [
    { title: '+ Создать сделку', path: `/workspace/${orgId}/crm/deals`, icon: Plus, category: 'Действия' },
    { title: '+ Новый документ', path: `/workspace/${orgId}/docs/new`, icon: FileText, category: 'Действия' },
    { title: '+ Назначить урок', path: `/workspace/${orgId}/edu/schedule`, icon: Calendar, category: 'Действия' },
    { title: '+ Запустить звонок', path: `/workspace/${orgId}/chat`, icon: Video, category: 'Действия' },
  ];

  const quickNav = [
    { title: 'Настройки PBAC & Доступы', path: `/workspace/${orgId}/settings/permission-matrix`, icon: Settings, category: 'Навигация' },
    { title: 'Тарифы и Биллинг', path: `/workspace/${orgId}/billing`, icon: Zap, category: 'Навигация' },
    { title: 'Конструктор сайтов', path: `/workspace/${orgId}/sites`, icon: LayoutTemplate, category: 'Навигация' },
  ];

  const filteredQuickLinks = [...quickActions, ...quickNav].filter(item =>
    item.title.toLowerCase().includes(query.toLowerCase())
  );

  const allDisplayItems = query ? [...filteredQuickLinks, ...results] : [...quickActions, ...quickNav];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < allDisplayItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : allDisplayItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allDisplayItems[selectedIndex]) {
        navigate(allDisplayItems[selectedIndex].path);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-start justify-center pt-20 p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[var(--text-main)]"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Input Header */}
        <div className="p-4 border-b border-[var(--border-color)] flex items-center gap-3">
          <Search className="w-5 h-5 text-emerald-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Что вы ищете? Поиск по контактам, документам, группам (Cmd+K)..."
            className="w-full bg-transparent outline-none text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)]"
          />
          {loading && <Loader2 className="w-5 h-5 text-emerald-500 animate-spin shrink-0" />}
          <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="p-3 max-h-96 overflow-y-auto space-y-1">
          {allDisplayItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-muted)]">
              Ничего не найдено по запросу "{query}"
            </div>
          ) : (
            allDisplayItems.map((item, idx) => {
              const Icon = (item as any).icon || FileText;
              return (
                <div
                  key={item.path + idx}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => {
                    navigate(item.path);
                    onClose();
                  }}
                  className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition ${
                    selectedIndex === idx ? 'bg-emerald-500/10 dark:bg-emerald-500/20' : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      selectedIndex === idx ? 'bg-emerald-500 text-white' : 'bg-black/5 dark:bg-white/10 text-[var(--text-muted)]'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className={`font-semibold text-sm transition ${selectedIndex === idx ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                        {item.title}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">{item.category}</span>
                        {(item as any).description && (
                          <span className="text-[11px] text-[var(--text-muted)] opacity-80 truncate max-w-[250px]">- {(item as any).description}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className={`w-4 h-4 transition ${selectedIndex === idx ? 'text-emerald-500 opacity-100' : 'text-[var(--text-muted)] opacity-0'}`} />
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-[var(--bg-panel)] border-t border-[var(--border-color)] flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">Навигация: <kbd className="px-1.5 py-0.5 bg-black/10 dark:bg-white/10 rounded">↑</kbd><kbd className="px-1.5 py-0.5 bg-black/10 dark:bg-white/10 rounded">↓</kbd></span>
            <span className="flex items-center gap-1">Выбор: <kbd className="px-1.5 py-0.5 bg-black/10 dark:bg-white/10 rounded">Enter</kbd></span>
          </div>
          <span>Поиск по разделам</span>
        </div>

      </div>
    </div>
  );
}
