import { db } from '../lib/firebase';
import { collection, doc, query, where, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { ChatChannel, ChatMessage } from '../types/chat';

function sanitizeData(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) => (value === undefined ? null : value)));
}

export interface OrgStaffMember {
  id: string;
  name: string;
  email: string;
  role?: string;
  avatarUrl?: string;
}

class ChatService {
  subscribeToChannels(tenantId: string, staffId: string, onUpdate: (channels: ChatChannel[]) => void) {
    const q = query(
      collection(db, 'tenants', tenantId, 'chat_channels')
    );
    return onSnapshot(q, async (snap) => {
      let allChannels = snap.docs.map(d => ({ ...d.data(), id: d.id } as ChatChannel));
      
      // Auto-seed default channels if empty
      if (allChannels.length === 0) {
        await this.seedDefaultChannels(tenantId, staffId);
        return;
      }

      const filtered = allChannels.filter(c => 
        c.type === 'public_channel' || 
        (c.memberStaffIds || []).includes(staffId)
      );
      onUpdate(filtered);
    }, (err) => {
      console.warn("Chat channels listener notice:", err);
    });
  }

  async seedDefaultChannels(tenantId: string, initialStaffId: string) {
    const defaults = [
      { name: 'общий-чат', type: 'public_channel' as const, memberStaffIds: [initialStaffId] },
      { name: 'объявления', type: 'public_channel' as const, memberStaffIds: [initialStaffId] },
      { name: 'вопросы-и-идеи', type: 'public_channel' as const, memberStaffIds: [initialStaffId] }
    ];

    for (const d of defaults) {
      const ref = doc(collection(db, 'tenants', tenantId, 'chat_channels'));
      await setDoc(ref, {
        ...d,
        id: ref.id,
        tenantId,
        createdAt: Date.now()
      });
    }
  }

  async fetchOrgStaff(tenantId: string): Promise<OrgStaffMember[]> {
    const staffList: OrgStaffMember[] = [];
    try {
      const q = query(collection(db, 'memberships'), where('tenantId', '==', tenantId));
      const snap = await getDocs(q);
      
      snap.forEach(d => {
        const data = d.data();
        staffList.push({
          id: data.userId || d.id,
          name: data.userName || data.userEmail?.split('@')[0] || 'Сотрудник ' + d.id.substring(0, 4),
          email: data.userEmail || '—',
          role: data.role || 'Коллега'
        });
      });

      // Also search root crm_contacts for employees/staff
      const crmSnap = await getDocs(query(collection(db, 'crm_contacts'), where('tenantId', '==', tenantId)));
      crmSnap.forEach(d => {
        const data = d.data();
        if (data.type === 'employee' || data.type === 'staff') {
          if (!staffList.some(s => s.id === d.id || s.email === data.email)) {
            staffList.push({
              id: d.id,
              name: data.fullName || data.name || 'Сотрудник',
              email: data.email || '—',
              role: data.role || 'Коллега'
            });
          }
        }
      });
    } catch (e) {
      console.warn("fetchOrgStaff notice:", e);
    }

    // Fallback default colleagues if list is empty
    if (staffList.length === 0) {
      staffList.push(
        { id: 'staff_kazieva', name: 'Казиева Алима Канатовна', email: 'butyakaz24@gmail.com', role: 'Руководитель' },
        { id: 'staff_director', name: 'Директор Организации', email: 'director@academy.edu', role: 'Владелец' },
        { id: 'staff_admin', name: 'Администратор WSP', email: 'admin@academy.edu', role: 'Администратор' }
      );
    }

    return staffList;
  }

  subscribeToMessages(tenantId: string, channelId: string, onUpdate: (messages: ChatMessage[]) => void) {
    const q = query(
      collection(db, 'tenants', tenantId, 'chat_messages'),
      where('channelId', '==', channelId)
    );
    return onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ ...d.data(), id: d.id } as ChatMessage));
      msgs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      onUpdate(msgs);
    }, (err) => {
      console.warn("Chat messages listener notice:", err);
    });
  }

  async sendMessage(tenantId: string, channelId: string, message: Omit<ChatMessage, 'id' | 'createdAt' | 'readByStaffIds' | 'tenantId' | 'channelId'>) {
    const ref = doc(collection(db, 'tenants', tenantId, 'chat_messages'));
    const now = Date.now();
    
    const payload = sanitizeData({
      ...message,
      tenantId,
      channelId,
      readByStaffIds: [message.senderStaffId],
      createdAt: now
    });

    await setDoc(ref, payload);

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

  async deleteMessage(tenantId: string, channelId: string, messageId: string) {
    const ref = doc(db, 'tenants', tenantId, 'chat_messages', messageId);
    await deleteDoc(ref);
  }

  async addMembersToChannel(
    tenantId: string, 
    channelId: string, 
    newStaffIds: string[], 
    senderStaffId?: string, 
    senderName?: string, 
    addedStaffNames?: string
  ) {
    const channelRef = doc(db, 'tenants', tenantId, 'chat_channels', channelId);
    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(channelRef);
      if (!docSnap.exists()) return;
      const data = docSnap.data() as ChatChannel;
      const existingMembers = data.memberStaffIds || [];
      const updatedMembers = Array.from(new Set([...existingMembers, ...newStaffIds]));
      transaction.update(channelRef, { memberStaffIds: updatedMembers });
    });

    if (senderStaffId && senderName) {
      const details = addedStaffNames ? `: ${addedStaffNames}` : '';
      await this.sendMessage(tenantId, channelId, {
        senderStaffId,
        senderName,
        text: `👤 ${senderName} добавил(а) участников в чат${details}`,
        isSystemMessage: true
      });
    }
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
    
    const channelRef = doc(db, 'tenants', tenantId, 'chat_channels', channelId);
    await updateDoc(channelRef, { activeCallSessionId: roomId });

    await this.sendMessage(tenantId, channelId, {
      senderStaffId: hostStaffId,
      senderName: hostName,
      text: `📞 ${hostName} начал(а) групповой видеозвонок`,
      isCallAnnouncement: true,
      webrtcRoomId: roomId
    });

    return roomId;
  }

  async createChannel(
    tenantId: string, 
    channelData: { 
      name: string; 
      type: 'public_channel' | 'private_channel' | 'direct_message'; 
      memberStaffIds: string[];
      creatorStaffId?: string;
      creatorName?: string;
    }
  ) {
    const ref = doc(collection(db, 'tenants', tenantId, 'chat_channels'));
    const id = ref.id;
    await setDoc(ref, {
      id,
      tenantId,
      name: channelData.name,
      type: channelData.type,
      memberStaffIds: channelData.memberStaffIds,
      createdAt: Date.now()
    });

    if (channelData.creatorStaffId && channelData.creatorName) {
      await this.sendMessage(tenantId, id, {
        senderStaffId: channelData.creatorStaffId,
        senderName: channelData.creatorName,
        text: `🎉 ${channelData.creatorName} создал(а) чат "${channelData.name}"`,
        isSystemMessage: true
      });
    }

    return id;
  }

  async endChannelCall(tenantId: string, channelId: string) {
    const channelRef = doc(db, 'tenants', tenantId, 'chat_channels', channelId);
    await updateDoc(channelRef, { activeCallSessionId: null });
  }
}

export const chatService = new ChatService();
