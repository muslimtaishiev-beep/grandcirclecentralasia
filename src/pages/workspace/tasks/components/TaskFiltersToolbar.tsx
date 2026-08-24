import React from 'react';
import { Filter, User, Calendar, Tag } from 'lucide-react';
import { TaskFilters } from '../../../../hooks/useTaskManager';
import { useAuth } from '../../../../contexts/AuthContext';

interface Props {
  filters: TaskFilters;
  onFilterChange: (newFilters: TaskFilters) => void;
}

export default function TaskFiltersToolbar({ filters, onFilterChange }: Props) {
  const { user } = useAuth();
  const isMyTasks = filters.assigneeId === user?.uid;

  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-2 hide-scrollbar w-full md:w-auto">
      <button 
        onClick={() => onFilterChange({ ...filters, assigneeId: isMyTasks ? undefined : user?.uid })}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors border ${
          isMyTasks ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--accent)]'
        }`}
      >
        <User className="w-4 h-4" /> Мои задачи
      </button>

      <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors border bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--accent)]">
        <Tag className="w-4 h-4" /> Отдел
      </button>

      <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors border bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--accent)]">
        <Filter className="w-4 h-4" /> Приоритет
      </button>
      
      <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors border bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--accent)]">
        <Calendar className="w-4 h-4" /> Дедлайн
      </button>
    </div>
  );
}
