import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from './firebase'; // Adjust this import based on where your initialized db is

export interface Task {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  column: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  createdAt: any;
}

export function useTasks(tenantId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'tasks'),
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const taskData: Task[] = [];
        snapshot.forEach((doc) => {
          taskData.push({ id: doc.id, ...doc.data() } as Task);
        });
        setTasks(taskData);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching tasks:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [tenantId]);

  const addTask = async (task: Omit<Task, 'id' | 'createdAt' | 'tenantId'>) => {
    if (!tenantId) return;
    try {
      await addDoc(collection(db, 'tasks'), {
        ...task,
        tenantId,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error adding task:", err);
      throw err;
    }
  };

  const updateTaskColumn = async (taskId: string, newColumn: Task['column']) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        column: newColumn
      });
    } catch (err) {
      console.error("Error updating task column:", err);
      throw err;
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await deleteDoc(taskRef);
    } catch (err) {
      console.error("Error deleting task:", err);
      throw err;
    }
  };

  return { tasks, loading, error, addTask, updateTaskColumn, deleteTask };
}
