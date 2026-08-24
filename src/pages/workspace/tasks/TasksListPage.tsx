import React, { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useTaskManager } from '../../../hooks/useTaskManager';
import { WorkspaceTask } from '../../../types/tasks';
import TaskFiltersToolbar from './components/TaskFiltersToolbar';
import CreateTaskModal from './components/CreateTaskModal';

export default function TasksListPage() {
  const { activeTenant } = useOutletContext<any>();
  const { tasks, filters, setFilters } = useTaskManager(activeTenant?.id);
  const [selectedTask, setSelectedTask] = useState<WorkspaceTask | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex p-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg">
            <Link to={`/workspace/${activeTenant?.id}/tasks/board`} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded transition">
              <LayoutGrid className="w-4 h-4" />
            </Link>
            <div className="p-1.5 bg-[var(--accent)] text-white rounded shadow-sm"><List className="w-4 h-4" /></div>
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-main)] hidden md:block">Список задач</h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <TaskFiltersToolbar filters={filters} onFilterChange={setFilters} />
          <button 
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 bg-[var(--accent)] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:brightness-110 transition shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Добавить
          </button>
        </div>
      </div>

      <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-color)] overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-[var(--bg-surface)] text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-color)]">
                <th className="px-6 py-4 font-bold">Название</th>
                <th className="px-6 py-4 font-bold">Статус</th>
                <th className="px-6 py-4 font-bold">Приоритет</th>
                <th className="px-6 py-4 font-bold">Прогресс</th>
                <th className="px-6 py-4 font-bold text-right">Дедлайн</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm font-medium text-[var(--text-muted)]">
                    Задачи не найдены
                  </td>
                </tr>
              ) : tasks.map(task => {
                const completed = task.subtasks?.filter(s => s.isCompleted).length || 0;
                const total = task.subtasks?.length || 0;
                return (
                  <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer" onClick={() => setSelectedTask(task)}>
                    <td className="px-6 py-4">
                      <div className="font-bold text-sm text-[var(--text-main)] line-clamp-1">{task.title}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        {task.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {total > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${(completed/total)*100}%` }}></div>
                          </div>
                          <span className="text-xs font-bold text-[var(--text-muted)]">{completed}/{total}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-medium text-[var(--text-muted)]">
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <TaskModal isOpen={!!selectedTask} onClose={() => setSelectedTask(null)} task={selectedTask || undefined} />
      <CreateTaskModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} tenantId={activeTenant?.id} />
    </div>
  );
}
