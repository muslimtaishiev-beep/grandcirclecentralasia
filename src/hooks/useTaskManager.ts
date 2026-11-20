import { useState, useEffect, useMemo, useCallback } from 'react';
import { taskService, TaskMember } from '../services/taskService';
import { WorkspaceTask, TaskStatus, TaskPriority } from '../types/tasks';
import { toast } from '../components/ui';

export interface TaskFilters {
  assigneeId?: string;
  departmentId?: string;
  priority?: TaskPriority;
  search?: string;
  archived?: boolean;
}

export function useTaskManager(tenantId: string) {
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [members, setMembers] = useState<TaskMember[]>([]);
  const [filters, setFilters] = useState<TaskFilters>({});

  useEffect(() => {
    if (!tenantId) return;
    setLoaded(false);
    const unsub = taskService.subscribeToTasks(tenantId, data => { setTasks(data); setLoaded(true); }, () => { setLoaded(true); toast.error('Не удалось загрузить задачи'); });
    return () => unsub();
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    let off = false;
    taskService.listMembers(tenantId).then(m => { if (!off) setMembers(m); }).catch(() => {});
    return () => { off = true; };
  }, [tenantId]);

  const nameOf = useCallback((id: string) => members.find(m => m.id === id)?.name || 'Сотрудник', [members]);

  const filteredTasks = useMemo(() => {
    const q = filters.search?.trim().toLowerCase();
    return tasks.filter(task => {
      if (!!task.archived !== !!filters.archived) return false;
      if (filters.assigneeId && !(task.assigneeStaffIds || []).includes(filters.assigneeId)) return false;
      if (filters.departmentId && task.departmentId !== filters.departmentId) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      if (q && !task.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, filters]);

  const moveTask = async (taskId: string, newStatus: TaskStatus) => {
    const prev = tasks;
    setTasks(p => p.map(t => (t.id === taskId ? { ...t, status: newStatus } : t)));
    try { await taskService.updateTaskStatus(tenantId, taskId, newStatus); }
    catch { setTasks(prev); toast.error('Не удалось переместить задачу'); }
  };

  return { tasks: filteredTasks, allTasks: tasks, loaded, members, nameOf, filters, setFilters, moveTask };
}
