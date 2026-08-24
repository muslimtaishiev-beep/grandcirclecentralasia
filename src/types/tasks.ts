export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';

export interface TaskSubItem {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface TaskComment {
  id: string;
  authorStaffId: string;
  authorName: string;
  authorAvatarUrl?: string;
  text: string;
  createdAt: number;
}

export interface WorkspaceTask {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  departmentId?: string;
  creatorStaffId: string;
  assigneeStaffIds: string[];
  relatedDealId?: string;
  relatedContactId?: string;
  subtasks: TaskSubItem[];
  commentsCount: number;
  dueDate?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}
