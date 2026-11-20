import React, { useEffect, useState } from 'react';
import { Archive, ArchiveRestore, Plus, Send, Trash2, X } from 'lucide-react';
import { Modal, btn, btnPrimary, input, label, toast, confirmDialog } from '../../../../components/ui';
import { WorkspaceTask, TaskComment, TaskPriority, TaskStatus } from '../../../../types/tasks';
import { taskService, TaskMember } from '../../../../services/taskService';
import { useAuth } from '../../../../contexts/AuthContext';
import { PRIORITIES, STATUSES, initials } from './taskLabels';

interface Props {
  /** Живая задача из подписки — окно обновляется вместе с ней. */
  task: WorkspaceTask;
  members: TaskMember[];
  nameOf: (id: string) => string;
  isAdmin: boolean;
  onClose: () => void;
}

const run = async (fn: () => Promise<unknown>, fail: string) => { try { await fn(); } catch (e: any) { toast.error(e?.message || fail); } };

export default function TaskModal({ task, members, nameOf, isAdmin, onClose }: Props) {
  const { user } = useAuth();
  const tid = task.tenantId;
  const canDelete = !!user && (task.creatorStaffId === user.uid || isAdmin);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [newItem, setNewItem] = useState('');

  // Чужая правка приходит вживую; не затираем то, что человек сейчас печатает.
  useEffect(() => { if (document.activeElement?.id !== 'task-title') setTitle(task.title); }, [task.title]);
  useEffect(() => { if (document.activeElement?.id !== 'task-desc') setDescription(task.description || ''); }, [task.description]);
  useEffect(() => taskService.subscribeToComments(tid, task.id, setComments), [tid, task.id]);

  const patch = (p: Parameters<typeof taskService.updateTask>[2]) => run(() => taskService.updateTask(tid, task.id, p), 'Не удалось сохранить');
  const subs = task.subtasks || [];
  const assignees = task.assigneeStaffIds || [];
  const toggleAssignee = (id: string) => patch({ assigneeStaffIds: assignees.includes(id) ? assignees.filter(x => x !== id) : [...assignees, id] });

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !user) return;
    const text = commentText.trim();
    setCommentText('');
    await run(() => taskService.addTaskComment(tid, task.id, { authorStaffId: user.uid, authorName: user.displayName || user.email || 'Сотрудник', text }), 'Не удалось отправить комментарий');
  };

  const remove = async () => {
    if (!(await confirmDialog({ title: 'Удалить задачу?', message: 'Вместе с комментариями. Восстановить будет нельзя.', confirmLabel: 'Удалить', danger: true }))) return;
    try { await taskService.deleteTask(tid, task.id); onClose(); } catch (e: any) { toast.error(e?.message || 'Не удалось удалить'); }
  };
  const archive = () => run(async () => { await taskService.archiveTask(tid, task.id, !task.archived); if (!task.archived) onClose(); }, 'Не удалось выполнить');

  return (
    <Modal title="Задача" onClose={onClose} wide>
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 min-w-0 space-y-5">
          <input id="task-title" className={`${input} text-lg font-bold`} value={title} onChange={e => setTitle(e.target.value)}
            onBlur={() => { if (title.trim() && title.trim() !== task.title) patch({ title: title.trim() }); else setTitle(task.title); }} />
          <div>
            <label className={label}>Описание</label>
            <textarea id="task-desc" className={`${input} resize-none`} rows={4} value={description} onChange={e => setDescription(e.target.value)}
              onBlur={() => { if (description !== (task.description || '')) patch({ description }); }} />
          </div>

          <div>
            <label className={label}>Чеклист{subs.length ? ` · ${subs.filter(s => s.isCompleted).length}/${subs.length}` : ''}</label>
            <div className="space-y-1.5">
              {subs.map(s => (
                <div key={s.id} className="flex items-center gap-2 p-2 border border-[var(--border-color)] rounded-lg">
                  <input type="checkbox" checked={s.isCompleted} className="w-4 h-4 cursor-pointer" onChange={() => run(() => taskService.toggleSubtask(tid, task.id, s.id), 'Не удалось отметить')} />
                  <span className={`flex-1 text-sm ${s.isCompleted ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-main)]'}`}>{s.title}</span>
                  <button type="button" className="p-1 text-[var(--text-muted)] hover:text-rose-600 cursor-pointer" title="Убрать" onClick={() => run(() => taskService.removeSubtask(tid, task.id, s.id), 'Не удалось убрать')}><X className="w-4 h-4" /></button>
                </div>
              ))}
              <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (!newItem.trim()) return; const t = newItem; setNewItem(''); run(() => taskService.addSubtask(tid, task.id, t), 'Не удалось добавить'); }}>
                <input className={input} placeholder="Пункт" value={newItem} onChange={e => setNewItem(e.target.value)} />
                <button type="submit" className={btn} disabled={!newItem.trim()} title="Добавить"><Plus className="w-4 h-4" /></button>
              </form>
            </div>
          </div>

          <div>
            <label className={label}>Комментарии ({comments.length})</label>
            <div className="space-y-2 mb-3">
              {comments.map(c => (
                <div key={c.id} className="p-3 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
                    <span className="font-bold text-[var(--text-main)]">{c.authorName}</span>
                    <span className="flex items-center gap-2">
                      {new Date(c.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {(c.authorStaffId === user?.uid || isAdmin) && (
                        <button type="button" className="hover:text-rose-600 cursor-pointer" title="Удалить" onClick={() => run(() => taskService.deleteTaskComment(tid, task.id, c.id), 'Не удалось удалить')}><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </span>
                  </div>
                  <div className="text-sm text-[var(--text-main)] whitespace-pre-wrap">{c.text}</div>
                </div>
              ))}
            </div>
            <form onSubmit={addComment} className="flex gap-2">
              <input className={input} value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Комментарий" />
              <button type="submit" className={btnPrimary} disabled={!commentText.trim()} title="Отправить"><Send className="w-4 h-4" /></button>
            </form>
          </div>
        </div>

        <div className="w-full md:w-60 shrink-0 space-y-4">
          <div><label className={label}>Статус</label><select className={input} value={task.status} onChange={e => patch({ status: e.target.value as TaskStatus })}>{STATUSES.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></div>
          <div><label className={label}>Приоритет</label><select className={input} value={task.priority} onChange={e => patch({ priority: e.target.value as TaskPriority })}>{PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
          <div><label className={label}>Срок</label><input className={input} type="date" value={task.dueDate || ''} onChange={e => patch({ dueDate: e.target.value })} /></div>
          <div>
            <label className={label}>Исполнители</label>
            <div className="flex flex-wrap gap-1.5">
              {members.map(m => (
                <button key={m.id} type="button" onClick={() => toggleAssignee(m.id)} title={m.name}
                  className={`px-2 py-1 rounded-lg text-xs border cursor-pointer ${assignees.includes(m.id) ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]'}`}>
                  {initials(m.name)} {m.name}
                </button>
              ))}
              {assignees.filter(id => !members.some(m => m.id === id)).map(id => <span key={id} className="px-2 py-1 rounded-lg text-xs border border-[var(--border-color)] text-[var(--text-muted)]">{nameOf(id)}</span>)}
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <button type="button" className={btn} onClick={archive}>{task.archived ? <><ArchiveRestore className="w-4 h-4" /> Восстановить</> : <><Archive className="w-4 h-4" /> В архив</>}</button>
            {canDelete && <button type="button" className={`${btn} text-rose-600`} onClick={remove}><Trash2 className="w-4 h-4" /> Удалить</button>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
