import React, { useState } from 'react';
import { X, Send, CheckSquare, AlignLeft, Calendar } from 'lucide-react';
import { WorkspaceTask, TaskSubItem } from '../../../../types/tasks';
import { taskService } from '../../../../services/taskService';
import { useAuth } from '../../../../contexts/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  task?: WorkspaceTask;
}

export default function TaskModal({ isOpen, onClose, task }: Props) {
  const { user } = useAuth();
  const [commentText, setCommentText] = useState('');

  if (!isOpen || !task) return null;

  const handleToggleSubtask = async (subtaskId: string) => {
    const newSubtasks = task.subtasks.map(s => s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s);
    await taskService.toggleSubtask(task.tenantId, task.id, newSubtasks);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !user) return;

    await taskService.addTaskComment(task.tenantId, task.id, {
      authorStaffId: user.uid,
      authorName: user.displayName || user.email || 'System',
      text: commentText.trim(),
    });
    setCommentText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[var(--bg-panel)] rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-2xl border border-[var(--border-color)] flex flex-col">
        <div className="flex justify-between items-start p-6 border-b border-[var(--border-color)] bg-[var(--bg-app)] rounded-t-2xl">
          <div className="pr-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-[var(--text-muted)]">
                {task.status}
              </span>
              <span className="text-xs text-[var(--text-muted)] font-medium font-mono">{task.id.split('-')[0]}</span>
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-main)] leading-tight">{task.title}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-6 border-r border-[var(--border-color)] space-y-8">
            {/* Description */}
            <section>
              <h4 className="flex items-center gap-2 font-bold mb-3 text-[var(--text-main)]">
                <AlignLeft className="w-5 h-5 text-[var(--text-muted)]" /> Описание
              </h4>
              <div className="text-sm text-[var(--text-muted)] leading-relaxed bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-color)]">
                {task.description || 'Описание отсутствует.'}
              </div>
            </section>

            {/* Subtasks */}
            {task.subtasks && task.subtasks.length > 0 && (
              <section>
                <h4 className="flex items-center gap-2 font-bold mb-3 text-[var(--text-main)]">
                  <CheckSquare className="w-5 h-5 text-[var(--text-muted)]" /> Чеклист
                </h4>
                <div className="space-y-2">
                  {task.subtasks.map(sub => (
                    <label key={sub.id} className="flex items-start gap-3 p-3 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl cursor-pointer hover:border-[var(--accent)] transition group">
                      <input 
                        type="checkbox" 
                        checked={sub.isCompleted} 
                        onChange={() => handleToggleSubtask(sub.id)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                      />
                      <span className={`text-sm font-medium transition ${sub.isCompleted ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-main)] group-hover:text-[var(--accent)]'}`}>
                        {sub.title}
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            )}

            {/* Comments */}
            <section>
              <h4 className="font-bold mb-4 text-[var(--text-main)]">Комментарии ({task.commentsCount || 0})</h4>
              {/* Mocking comments display since we didn't subscribe to the subcollection in useTaskManager for simplicity in this example */}
              <div className="text-sm text-[var(--text-muted)] italic mb-6">
                Комментарии загружаются... (В полной реализации здесь подписка на подколлекцию comments)
              </div>
            </section>
          </div>

          {/* Sidebar Area */}
          <div className="w-full md:w-64 bg-[var(--bg-surface)] p-6 overflow-y-auto flex flex-col gap-6">
            <div>
              <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Статус</div>
              <div className="font-medium text-sm px-3 py-2 bg-[var(--bg-panel)] rounded-lg border border-[var(--border-color)]">{task.status}</div>
            </div>
            
            <div>
              <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Дедлайн</div>
              <div className="flex items-center gap-2 font-medium text-sm px-3 py-2 bg-[var(--bg-panel)] rounded-lg border border-[var(--border-color)]">
                <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Не указан'}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Приоритет</div>
              <div className="font-medium text-sm px-3 py-2 bg-[var(--bg-panel)] rounded-lg border border-[var(--border-color)]">{task.priority}</div>
            </div>

            <div>
              <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Исполнители</div>
              <div className="flex flex-col gap-2">
                {task.assigneeStaffIds && task.assigneeStaffIds.map(id => (
                  <div key={id} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-[10px] font-bold">
                      {id.substring(0,2).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium">{id}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Comment Input Footer */}
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-app)] rounded-b-2xl">
          <form onSubmit={handleAddComment} className="flex items-center gap-3">
            <input 
              type="text" 
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Написать комментарий..."
              className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent)]"
            />
            <button 
              type="submit"
              disabled={!commentText.trim()}
              className="p-3 bg-[var(--accent)] text-white rounded-xl shadow-md disabled:opacity-50 hover:brightness-110 transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
