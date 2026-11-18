import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface AppNotification {
  id: string;
  tenantId: string;
  userId: string; // The user receiving the notification
  title: string;
  body: string;
  type: 'task' | 'chat' | 'crm' | 'system' | 'mention' | 'admission' | 'email';
  read: boolean;
  actionUrl?: string;
  /** Приём: чья карточка — открытый список и карточка обновляются сами. */
  applicantId?: string;
  /** Письмо не ушло: запись журнала — для «Переотправить». */
  emailLogId?: string;
  createdAt: any;
}

export function useNotifications(tenantId: string | undefined, userId: string | undefined) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  /** Первый снимок пришёл: всё, что придёт после, — новое (для всплывашек). */
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
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
      setLoaded(true);
    }, err => console.warn('notifications:', err.message));

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

  return { notifications, unreadCount, loaded, markAsRead, markAllAsRead };
}

export const createNotification = async (notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => {
  await addDoc(collection(db, 'notifications'), {
    ...notification,
    read: false,
    createdAt: serverTimestamp()
  });
};
