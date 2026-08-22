import React, { useState } from 'react';
import { useOutletContext, Link, useParams } from 'react-router-dom';
import { Search, Plus, List as ListIcon, Columns, CheckCircle2, Circle, MoreHorizontal, Calendar, Loader2, Trash2 } from 'lucide-react';
import { useTasks, Task } from '../../../lib/useTasks';

export default function TaskList() {
  const { activeTenant } = useOutletContext<any>() || {};
  const { orgId } = useParams();
  
  const { tasks, loading, addTask, updateTaskColumn, deleteTask } = useTasks(orgId);

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    await addTask({
      title: newTaskTitle,
      description: '',
      column: 'todo',
      priority: 'medium'
    });
    setNewTaskTitle('');
    setIsAddingTask(false);
  };

  const getStatusBadge = (column: Task['column']) => {
    switch (column) {
      case 'done':
        return { label: 'Готово', style: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
      case 'in_progress':
        return { label: 'В работе', style: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
      case 'review':
        return { label: 'Проверка', style: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
      default:
        return { label: 'К выполнению', style: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' };
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6 max-w-6xl mx-auto w-full">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)]">Задачи и Проекты</h1>
          <p className="text-[var(--text-muted)] mt-1">Управление рабочим процессом команды {activeTenant?.name}</p>
        </div>
        <button 
          onClick={() => setIsAddingTask(true)}
          className="bg-[var(--accent)] text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:opacity-90 transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> Новая задача
        </button>
      </div>

      {/* New Task Inline Modal */}
      {isAddingTask && (
        <div className="bg-[var(--bg-surface)] border border-[var(--accent)] p-4 rounded-xl shadow-lg animate-in fade-in duration-200">
          <h3 className="text-sm font-bold text-[var(--text-main)] mb-2">Создать новую задачу</h3>
          <div className="flex gap-3">
            <input
              autoFocus
              type="text"
              placeholder="Введите название задачи..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateTask();
                if (e.key === 'Escape') setIsAddingTask(false);
              }}
              className="flex-1 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={handleCreateTask}
              className="bg-[var(--accent)] text-white px-4 py-2 rounded-lg font-bold text-sm hover:opacity-90 transition"
            >
              Сохранить
            </button>
            <button
              onClick={() => setIsAddingTask(false)}
              className="bg-[var(--bg-app)] text-[var(--text-muted)] border border-[var(--border-color)] px-4 py-2 rounded-lg text-sm hover:text-[var(--text-main)] transition"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Toolbar & View Switcher */}
      <div className="flex items-center justify-between">
        <div className="w-64 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input 
            type="text" 
            placeholder="Поиск задач..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text-main)]"
          />
        </div>

        <div className="flex bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg p-1">
          <div className="px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 bg-[var(--bg-surface)] shadow-sm text-[var(--text-main)]">
            <ListIcon className="w-4 h-4" /> Список
          </div>
          <Link to={`/workspace/${orgId}/tasks/board`} className="px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-main)]">
            <Columns className="w-4 h-4" /> Канбан
          </Link>
        </div>
      </div>

      {/* List Table */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 flex items-center justify-center text-[var(--text-muted)]">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-12 text-center text-[var(--text-muted)]">
            Задач пока нет. Нажмите «Новая задача», чтобы добавить первую!
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--bg-app)] border-b border-[var(--border-color)] text-[var(--text-muted)] font-mono text-xs uppercase">
              <tr>
                <th className="px-6 py-3 font-medium">Название задачи</th>
                <th className="px-6 py-3 font-medium">Статус</th>
                <th className="px-6 py-3 font-medium">Приоритет</th>
                <th className="px-6 py-3 font-medium">Дата добавления</th>
                <th className="px-6 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {filteredTasks.map(task => {
                const statusInfo = getStatusBadge(task.column);
                return (
                  <tr key={task.id} className="hover:bg-[var(--bg-app)]/50 transition group cursor-pointer">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => updateTaskColumn(task.id, task.column === 'done' ? 'todo' : 'done')}
                          className="focus:outline-none"
                        >
                          {task.column === 'done' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <Circle className="w-5 h-5 text-[var(--text-muted)] hover:text-[var(--accent)]" />
                          )}
                        </button>
                        <span className={`font-semibold transition ${task.column === 'done' ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-main)] group-hover:text-[var(--accent)]'}`}>
                          {task.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-mono border ${statusInfo.style}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${
                        task.priority === 'high' ? 'bg-red-500/10 text-red-500' :
                        task.priority === 'medium' ? 'bg-orange-500/10 text-orange-500' :
                        'bg-zinc-500/10 text-zinc-400'
                      }`}>
                        {task.priority || 'medium'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs font-mono">
                        <Calendar className="w-3.5 h-3.5" />
                        {task.createdAt ? new Date(task.createdAt.seconds ? task.createdAt.seconds * 1000 : task.createdAt).toLocaleDateString() : 'Сегодня'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => deleteTask(task.id)}
                        className="text-[var(--text-muted)] hover:text-red-500 p-1 rounded hover:bg-[var(--bg-app)] opacity-0 group-hover:opacity-100 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
