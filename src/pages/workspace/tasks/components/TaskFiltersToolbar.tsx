import React from 'react';
import { Archive, Search, User } from 'lucide-react';
import { TaskFilters } from '../../../../hooks/useTaskManager';
import { TaskMember } from '../../../../services/taskService';
import { useAuth } from '../../../../contexts/AuthContext';
import { PRIORITIES } from './taskLabels';
import { TaskPriority } from '../../../../types/tasks';

interface Props {
  filters: TaskFilters;
  onFilterChange: (newFilters: TaskFilters) => void;
  members: TaskMember[];
}

const chip = (on: boolean) => `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors border cursor-pointer ${on ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--accent)]'}`;
const sel = 'bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 text-sm text-[var(--text-main)] outline-none';

export default function TaskFiltersToolbar({ filters, onFilterChange, members }: Props) {
  const { user } = useAuth();
  const isMine = !!user?.uid && filters.assigneeId === user.uid;

  return (
    <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
      <button className={chip(isMine)} onClick={() => onFilterChange({ ...filters, assigneeId: isMine ? undefined : user?.uid })}>
        <User className="w-4 h-4" /> Мои задачи
      </button>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <input className={`${sel} pl-8 w-40`} placeholder="Поиск" value={filters.search || ''} onChange={e => onFilterChange({ ...filters, search: e.target.value })} />
      </div>
      <select className={sel} value={filters.assigneeId && !isMine ? filters.assigneeId : ''} onChange={e => onFilterChange({ ...filters, assigneeId: e.target.value || undefined })}>
        <option value="">{isMine ? 'Исполнитель: я' : 'Все исполнители'}</option>
        {members.filter(m => m.id !== user?.uid).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <select className={sel} value={filters.priority || ''} onChange={e => onFilterChange({ ...filters, priority: (e.target.value || undefined) as TaskPriority | undefined })}>
        <option value="">Любой приоритет</option>
        {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select>
      <button className={chip(!!filters.archived)} onClick={() => onFilterChange({ ...filters, archived: !filters.archived })}>
        <Archive className="w-4 h-4" /> Архив
      </button>
    </div>
  );
}
