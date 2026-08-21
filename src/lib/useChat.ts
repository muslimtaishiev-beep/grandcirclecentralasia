import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc } from 'firebase/firestore';
import { db } from './firebase';

export interface ChatChannel {
  id: string;
  tenantId: string;
  type: 'public' | 'private' | 'dm';
  name: string;
  subtitle?: string;
  color?: string;
  avatar?: string;
  createdAt: any;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: any;
}

export function useChatChannels(tenantId: string | undefined) {
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setChannels([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'chat_channels'),
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: ChatChannel[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as ChatChannel));
      setChannels(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tenantId]);

  const addChannel = async (channel: Omit<ChatChannel, 'id' | 'createdAt' | 'tenantId'>) => {
    if (!tenantId) return;
    await addDoc(collection(db, 'chat_channels'), {
      ...channel,
      tenantId,
      createdAt: serverTimestamp()
    });
  };

  return { channels, loading, addChannel };
}

export function useChatMessages(channelId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!channelId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    
    // In a flat structure, messages are directly under 'chat_messages' with a 'channelId' where clause
    const q = query(
      collection(db, 'chat_messages'),
      where('channelId', '==', channelId),
      orderBy('timestamp', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: ChatMessage[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as ChatMessage));
      setMessages(data);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [channelId]);

  const sendMessage = async (message: Omit<ChatMessage, 'id' | 'timestamp' | 'channelId'>) => {
    if (!channelId) return;
    await addDoc(collection(db, 'chat_messages'), {
      ...message,
      channelId,
      timestamp: serverTimestamp()
    });
  };

  return { messages, loading, sendMessage };
}
