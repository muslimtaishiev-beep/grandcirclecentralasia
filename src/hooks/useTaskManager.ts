import { useState, useEffect, useMemo } from 'react';
import { taskService } from '../services/taskService';
import { WorkspaceTask, TaskStatus, TaskPriority } from '../types/tasks';

export interface TaskFilters {
  assigneeId?: string;
  departmentId?: string;
  priority?: TaskPriority;
  search?: string;
}

export function useTaskManager(tenantId: string) {
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [filters, setFilters] = useState<TaskFilters>({});

  useEffect(() => {
    if (!tenantId) return;
    const unsub = taskService.subscribeToTasks(tenantId, (data) => {
      setTasks(data);
    });
    return () => unsub();
  }, [tenantId]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filters.assigneeId && !task.assigneeStaffIds.includes(filters.assigneeId)) return false;
      if (filters.departmentId && task.departmentId !== filters.departmentId) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.search && !task.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });
  }, [tasks, filters]);

  const moveTask = async (taskId: string, newStatus: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    await taskService.updateTaskStatus(tenantId, taskId, newStatus);
  };

  return {
    tasks: filteredTasks,
    allTasks: tasks,
    filters,
    setFilters,
    moveTask
  };
}
