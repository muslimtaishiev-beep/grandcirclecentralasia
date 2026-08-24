import React, { useState } from 'react';
import { X, Plus, Check } from 'lucide-react';
import { taskService } from '../../../../services/taskService';
import { TaskPriority, TaskStatus } from '../../../../types/tasks';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
}

export default function CreateTaskModal({ isOpen, onClose, tenantId }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !tenantId) return;

    setIsSubmitting(true);
    try {
      await taskService.createTask(tenantId, {
        tenantId,
        title: title.trim(),
        description: description.trim(),
        priority,
        status,
        assigneeStaffIds: [],
        tags: [],
        subtasks: []
      });
      setTitle('');
      setDescription('');
      onClose();
    } catch (err: any) {
      alert(`Ошибка создания задачи: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
          <h3 className="font-bold text-base text-[var(--text-main)] flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-500" />
            <span>Создать Задачу</span>
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-black/10 rounded text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Название задачи *</label>
            <input 
              type="text" 
              required
              placeholder="Введите название задачи..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Описание задачи</label>
            <textarea 
              rows={3}
              placeholder="Детали и контекст задачи..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Приоритет</label>
              <select 
                value={priority}
                onChange={e => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="low">Низкий (Low)</option>
                <option value="medium">Средний (Medium)</option>
                <option value="high">Высокий (High)</option>
                <option value="urgent">Срочный (Urgent)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Колонка / Статус</label>
              <select 
                value={status}
                onChange={e => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="backlog">Бэклог</option>
                <option value="todo">К выполнению</option>
                <option value="in_progress">В работе</option>
                <option value="review">Проверка</option>
                <option value="done">Готово</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border text-xs font-bold">Отмена</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
              <Check className="w-4 h-4" />
              <span>Создать Задачу</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
