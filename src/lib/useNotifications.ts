import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, updateDoc, doc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface AppNotification {
  id: string;
  tenantId: string;
  userId: string; // The user receiving the notification
  title: string;
  body: string;
  type: 'task' | 'chat' | 'crm' | 'system' | 'mention' | 'admission' | 'email' | 'form' | 'exam';
  /** Ключ действия из NOTIFY_EVENTS (уведомления сервера). */
  event?: string;
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
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    // Подписка не должна молча умирать: обрыв — переподключение с паузой;
    // вкладка вернулась из фона, компьютер проснулся, появилась сеть —
    // подписка пересоздаётся (длинные опросы после сна часто «висят»).
    let unsub: (() => void) | null = null;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hiddenAt = 0;
    let stopped = false;
    const connect = () => {
      if (stopped) return;
      unsub?.();
      unsub = onSnapshot(q, (snapshot) => {
        retry = 0;
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
      }, err => {
        console.warn('notifications:', err.message);
        unsub = null;
        clearTimeout(timer);
        timer = setTimeout(connect, [2_000, 5_000, 15_000, 30_000][Math.min(retry++, 3)]);
      });
    };
    const reconnect = () => { clearTimeout(timer); retry = 0; connect(); };
    const onVisible = () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      if (!unsub || (hiddenAt && Date.now() - hiddenAt > 60_000)) reconnect();
      hiddenAt = 0;
    };
    connect();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', reconnect);
    return () => {
      stopped = true;
      clearTimeout(timer);
      unsub?.();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', reconnect);
    };
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
