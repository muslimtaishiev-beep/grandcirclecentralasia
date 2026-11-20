import React, { useState } from 'react';
import { Modal, btn, btnPrimary, input, label, toast } from '../../../../components/ui';
import { taskService, TaskMember } from '../../../../services/taskService';
import { TaskPriority, TaskStatus } from '../../../../types/tasks';
import { PRIORITIES, STATUSES } from './taskLabels';

interface Props {
  onClose: () => void;
  tenantId: string;
  members: TaskMember[];
  defaultAssigneeId?: string;
}

export default function CreateTaskModal({ onClose, tenantId, members, defaultAssigneeId }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [dueDate, setDueDate] = useState('');
  const [assignees, setAssignees] = useState<string[]>(defaultAssigneeId ? [defaultAssigneeId] : []);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !tenantId) return;
    setBusy(true);
    try {
      await taskService.createTask(tenantId, {
        tenantId, title: title.trim(), description: description.trim(), priority, status,
        assigneeStaffIds: assignees, tags: [], subtasks: [], ...(dueDate ? { dueDate } : {}),
      });
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось создать задачу');
    } finally { setBusy(false); }
  };

  const toggle = (id: string) => setAssignees(a => (a.includes(id) ? a.filter(x => x !== id) : [...a, id]));

  return (
    <Modal title="Новая задача" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div><label className={label}>Название</label><input className={input} required autoFocus value={title} onChange={e => setTitle(e.target.value)} /></div>
        <div><label className={label}>Описание</label><textarea className={`${input} resize-none`} rows={3} value={description} onChange={e => setDescription(e.target.value)} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={label}>Приоритет</label><select className={input} value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}>{PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
          <div><label className={label}>Колонка</label><select className={input} value={status} onChange={e => setStatus(e.target.value as TaskStatus)}>{STATUSES.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></div>
          <div><label className={label}>Срок</label><input className={input} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
        </div>
        <div>
          <label className={label}>Исполнители</label>
          <div className="flex flex-wrap gap-1.5">
            {members.map(m => (
              <button key={m.id} type="button" onClick={() => toggle(m.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer ${assignees.includes(m.id) ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]'}`}>
                {m.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className={btn} onClick={onClose}>Отмена</button>
          <button type="submit" className={btnPrimary} disabled={busy}>Создать</button>
        </div>
      </form>
    </Modal>
  );
}
