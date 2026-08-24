import { db } from '../lib/firebase';
import { collection, doc, query, where, orderBy, limit, getDocs, setDoc, updateDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { ChatChannel, ChatMessage } from '../types/chat';

class ChatService {
  subscribeToChannels(tenantId: string, staffId: string, onUpdate: (channels: ChatChannel[]) => void) {
    const q = query(
      collection(db, 'tenants', tenantId, 'chat_channels'),
      where('memberStaffIds', 'array-contains', staffId)
    );
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as ChatChannel)));
    });
  }

  subscribeToMessages(tenantId: string, channelId: string, onUpdate: (messages: ChatMessage[]) => void) {
    const q = query(
      collection(db, 'tenants', tenantId, 'chat_messages'),
      where('channelId', '==', channelId),
      orderBy('createdAt', 'asc') // Firestore index required
    );
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as ChatMessage)));
    });
  }

  async sendMessage(tenantId: string, channelId: string, message: Omit<ChatMessage, 'id' | 'createdAt' | 'readByStaffIds' | 'tenantId' | 'channelId'>) {
    const ref = doc(collection(db, 'tenants', tenantId, 'chat_messages'));
    const now = Date.now();
    
    await setDoc(ref, {
      ...message,
      tenantId,
      channelId,
      readByStaffIds: [message.senderStaffId],
      createdAt: now
    });

    const channelRef = doc(db, 'tenants', tenantId, 'chat_channels', channelId);
    await updateDoc(channelRef, {
      lastMessage: {
        text: message.isCallAnnouncement ? '📞 Звонок начат' : message.text,
        senderName: message.senderName,
        timestamp: now
      }
    });

    return ref.id;
  }

  async toggleMessageReaction(tenantId: string, channelId: string, messageId: string, emoji: string, staffId: string) {
    const ref = doc(db, 'tenants', tenantId, 'chat_messages', messageId);
    
    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(ref);
      if (!docSnap.exists()) return;
      const data = docSnap.data() as ChatMessage;
      
      const reactions = data.reactions || {};
      const staffList = reactions[emoji] || [];
      const hasReacted = staffList.includes(staffId);
      
      if (hasReacted) {
        reactions[emoji] = staffList.filter(id => id !== staffId);
        if (reactions[emoji].length === 0) {
          delete reactions[emoji];
        }
      } else {
        reactions[emoji] = [...staffList, staffId];
      }
      
      transaction.update(ref, { reactions });
    });
  }

  async startChannelCall(tenantId: string, channelId: string, hostStaffId: string, hostName: string) {
    const roomId = `call_${Date.now()}`;
    
    // Update channel state
    const channelRef = doc(db, 'tenants', tenantId, 'chat_channels', channelId);
    await updateDoc(channelRef, { activeCallSessionId: roomId });

    // Send announcement message
    await this.sendMessage(tenantId, channelId, {
      senderStaffId: hostStaffId,
      senderName: hostName,
      text: 'В этом канале запущен групповой видеозвонок.',
      isCallAnnouncement: true,
      webrtcRoomId: roomId
    });

    return roomId;
  }

  async endChannelCall(tenantId: string, channelId: string) {
    const channelRef = doc(db, 'tenants', tenantId, 'chat_channels', channelId);
    await updateDoc(channelRef, { activeCallSessionId: null });
  }
}

export const chatService = new ChatService();
