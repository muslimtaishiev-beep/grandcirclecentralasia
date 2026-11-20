import { TaskPriority, TaskStatus } from '../../../../types/tasks';

export const STATUSES: { id: TaskStatus; title: string }[] = [
  { id: 'backlog', title: 'Бэклог' },
  { id: 'todo', title: 'К выполнению' },
  { id: 'in_progress', title: 'В работе' },
  { id: 'review', title: 'Проверка' },
  { id: 'done', title: 'Готово' },
];
export const PRIORITIES: { id: TaskPriority; title: string }[] = [
  { id: 'low', title: 'Низкий' },
  { id: 'medium', title: 'Средний' },
  { id: 'high', title: 'Высокий' },
  { id: 'urgent', title: 'Срочный' },
];
export const statusTitle = (s: string) => STATUSES.find(x => x.id === s)?.title || s;
export const priorityTitle = (p: string) => PRIORITIES.find(x => x.id === p)?.title || p;
export const initials = (name: string) => (name.trim()[0] || '?').toUpperCase();
