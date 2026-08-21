import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface AppNotification {
  id: string;
  tenantId: string;
  userId: string; // The user receiving the notification
  title: string;
  body: string;
  type: 'task' | 'chat' | 'crm' | 'system' | 'mention';
  read: boolean;
  actionUrl?: string;
  createdAt: any;
}

export function useNotifications(tenantId: string | undefined, userId: string | undefined) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!tenantId || !userId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('tenantId', '==', tenantId),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: AppNotification[] = [];
      let unread = 0;
      
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.read) unread++;
        notifs.push({ id: docSnap.id, ...data } as AppNotification);
      });
      
      setNotifications(notifs);
      setUnreadCount(unread);
    });

    return () => unsubscribe();
  }, [tenantId, userId]);

  const markAsRead = async (notificationId: string) => {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  };

  const markAllAsRead = async () => {
    const unreadNotifs = notifications.filter(n => !n.read);
    const promises = unreadNotifs.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true }));
    await Promise.all(promises);
  };

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}

export const createNotification = async (notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => {
  await addDoc(collection(db, 'notifications'), {
    ...notification,
    read: false,
    createdAt: serverTimestamp()
  });
};
