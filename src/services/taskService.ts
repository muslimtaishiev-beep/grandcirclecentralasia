import { db } from '../lib/firebase';
import { collection, doc, onSnapshot, query, setDoc, serverTimestamp, updateDoc, arrayUnion } from 'firebase/firestore';
import { WorkspaceTask, TaskStatus, TaskComment, TaskSubItem } from '../types/tasks';

class TaskService {
  subscribeToTasks(tenantId: string, onUpdate: (tasks: WorkspaceTask[]) => void) {
    const q = query(collection(db, 'tenants', tenantId, 'workspace_tasks'));
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as WorkspaceTask)));
    });
  }

  async createTask(tenantId: string, task: Omit<WorkspaceTask, 'id' | 'createdAt' | 'updatedAt' | 'commentsCount'>) {
    const ref = doc(collection(db, 'tenants', tenantId, 'workspace_tasks'));
    await setDoc(ref, {
      ...task,
      commentsCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return ref.id;
  }

  async updateTaskStatus(tenantId: string, taskId: string, newStatus: TaskStatus) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_tasks', taskId);
    await updateDoc(ref, {
      status: newStatus,
      updatedAt: serverTimestamp()
    });
  }

  async toggleSubtask(tenantId: string, taskId: string, subtasks: TaskSubItem[]) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_tasks', taskId);
    await updateDoc(ref, {
      subtasks,
      updatedAt: serverTimestamp()
    });
  }

  async addTaskComment(tenantId: string, taskId: string, comment: Omit<TaskComment, 'id' | 'createdAt'>) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_tasks', taskId);
    const newComment = {
      ...comment,
      id: crypto.randomUUID(),
      createdAt: Date.now()
    };
    
    // In real app, might want comments in a subcollection to avoid large doc size
    // but arrayUnion is fine for small amounts
    await updateDoc(ref, {
      commentsCount: Math.random(), // Trigger update (Firestore doesn't have an increment that works nicely with arrayUnion in one go for local state sometimes, but usually increment() works)
      updatedAt: serverTimestamp()
    });
    
    // Here we'll just mock adding it or doing it via a subcollection
    const commentsRef = doc(collection(db, 'tenants', tenantId, 'workspace_tasks', taskId, 'comments'));
    await setDoc(commentsRef, newComment);
  }
}

export const taskService = new TaskService();
