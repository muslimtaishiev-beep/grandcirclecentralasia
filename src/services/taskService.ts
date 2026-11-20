import { auth, db } from '../lib/firebase';
import {
  collection, doc, onSnapshot, query, setDoc, serverTimestamp, updateDoc, deleteDoc, getDocs, where,
  runTransaction, writeBatch, increment, orderBy,
} from 'firebase/firestore';
import { WorkspaceTask, TaskStatus, TaskComment, TaskSubItem } from '../types/tasks';

export interface TaskMember { id: string; name: string }

type NewTask = Omit<WorkspaceTask, 'id' | 'createdAt' | 'updatedAt' | 'commentsCount' | 'creatorStaffId'>;
type TaskPatch = Partial<Pick<WorkspaceTask, 'title' | 'description' | 'priority' | 'status' | 'assigneeStaffIds' | 'dueDate' | 'tags'>>;

const taskRef = (tenantId: string, taskId: string) => doc(db, 'tenants', tenantId, 'workspace_tasks', taskId);

class TaskService {
  subscribeToTasks(tenantId: string, onUpdate: (tasks: WorkspaceTask[]) => void, onError?: (e: Error) => void) {
    const q = query(collection(db, 'tenants', tenantId, 'workspace_tasks'));
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as WorkspaceTask)));
    }, e => onError?.(e));
  }

  /** Сотрудники организации — для выбора исполнителя. */
  async listMembers(tenantId: string): Promise<TaskMember[]> {
    const snap = await getDocs(query(collection(db, 'memberships'), where('tenantId', '==', tenantId)));
    const seen = new Map<string, TaskMember>();
    for (const d of snap.docs) {
      const m = d.data();
      if ((m.status && m.status !== 'active') || !m.userId) continue;
      const email: string = m.userEmail || m.email || '';
      const name = m.displayName || m.userName || m.fullName || (email.includes('@') ? email.split('@')[0] : '') || 'Сотрудник';
      seen.set(m.userId, { id: m.userId, name });
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async createTask(tenantId: string, task: NewTask) {
    const ref = doc(collection(db, 'tenants', tenantId, 'workspace_tasks'));
    const data: Record<string, unknown> = {
      ...task,
      // Автор задачи: правила базы дают ему удалить задачу.
      creatorStaffId: auth.currentUser?.uid || null,
      commentsCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];
    await setDoc(ref, data);
    return ref.id;
  }

  async updateTask(tenantId: string, taskId: string, patch: TaskPatch) {
    const data: Record<string, unknown> = { ...patch, updatedAt: serverTimestamp() };
    for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];
    await updateDoc(taskRef(tenantId, taskId), data);
  }

  async updateTaskStatus(tenantId: string, taskId: string, newStatus: TaskStatus) {
    await updateDoc(taskRef(tenantId, taskId), { status: newStatus, updatedAt: serverTimestamp() });
  }

  async archiveTask(tenantId: string, taskId: string, archived: boolean) {
    await updateDoc(taskRef(tenantId, taskId), archived
      ? { archived: true, archivedAt: Date.now(), updatedAt: serverTimestamp() }
      : { archived: false, updatedAt: serverTimestamp() });
  }

  /** Удалить может автор или администратор — это проверяют правила базы. */
  async deleteTask(tenantId: string, taskId: string) {
    const comments = await getDocs(collection(db, 'tenants', tenantId, 'workspace_tasks', taskId, 'comments'));
    const batch = writeBatch(db);
    comments.docs.forEach(c => batch.delete(c.ref));
    batch.delete(taskRef(tenantId, taskId));
    try { await batch.commit(); }
    catch { await deleteDoc(taskRef(tenantId, taskId)); } // чужие комментарии могли не дать стереть пачкой
  }

  /** Отметка пункта чеклиста читает свежий документ в транзакции — одновременные отметки не затирают друг друга. */
  async toggleSubtask(tenantId: string, taskId: string, subtaskId: string) {
    await runTransaction(db, async tx => {
      const ref = taskRef(tenantId, taskId);
      const snap = await tx.get(ref);
      const subs: TaskSubItem[] = snap.data()?.subtasks || [];
      tx.update(ref, { subtasks: subs.map(s => (s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s)), updatedAt: serverTimestamp() });
    });
  }

  async addSubtask(tenantId: string, taskId: string, title: string) {
    await runTransaction(db, async tx => {
      const ref = taskRef(tenantId, taskId);
      const snap = await tx.get(ref);
      const subs: TaskSubItem[] = snap.data()?.subtasks || [];
      tx.update(ref, { subtasks: [...subs, { id: crypto.randomUUID(), title: title.trim(), isCompleted: false }], updatedAt: serverTimestamp() });
    });
  }

  async removeSubtask(tenantId: string, taskId: string, subtaskId: string) {
    await runTransaction(db, async tx => {
      const ref = taskRef(tenantId, taskId);
      const snap = await tx.get(ref);
      const subs: TaskSubItem[] = snap.data()?.subtasks || [];
      tx.update(ref, { subtasks: subs.filter(s => s.id !== subtaskId), updatedAt: serverTimestamp() });
    });
  }

  subscribeToComments(tenantId: string, taskId: string, onUpdate: (c: TaskComment[]) => void) {
    const q = query(collection(db, 'tenants', tenantId, 'workspace_tasks', taskId, 'comments'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as TaskComment))), () => onUpdate([]));
  }

  async addTaskComment(tenantId: string, taskId: string, comment: Omit<TaskComment, 'id' | 'createdAt'>) {
    const cRef = doc(collection(db, 'tenants', tenantId, 'workspace_tasks', taskId, 'comments'));
    const batch = writeBatch(db);
    batch.set(cRef, { ...comment, id: cRef.id, createdAt: Date.now() });
    batch.update(taskRef(tenantId, taskId), { commentsCount: increment(1) });
    await batch.commit();
  }

  async deleteTaskComment(tenantId: string, taskId: string, commentId: string) {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'tenants', tenantId, 'workspace_tasks', taskId, 'comments', commentId));
    batch.update(taskRef(tenantId, taskId), { commentsCount: increment(-1) });
    await batch.commit();
  }
}

export const taskService = new TaskService();
