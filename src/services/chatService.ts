import { db } from '../lib/firebase';
import { collection, doc, query, where, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, runTransaction, getDoc } from 'firebase/firestore';
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
    const rawList: OrgStaffMember[] = [];
    
    const formatRole = (rawRole?: string) => {
      if (!rawRole) return 'Сотрудник';
      const r = rawRole.toLowerCase();
      if (r.includes('owner')) return 'Владелец';
      if (r.includes('admin')) return 'Администратор';
      if (r.includes('manager')) return 'Менеджер';
      if (r.includes('teacher')) return 'Преподаватель';
      return rawRole;
    };

    try {
      // 1. Fetch memberships for this tenant
      const q = query(collection(db, 'memberships'), where('tenantId', '==', tenantId));
      const snap = await getDocs(q);

      for (const d of snap.docs) {
        const data = d.data();
        let name = data.userName || data.fullName || '';
        let email = data.userEmail || data.email || '';
        const uid = data.userId || d.id;

        // Special handling for known emails or UIDs
        if (email.includes('butyakaz24') || name.includes('Казиева') || name.includes('Алима')) {
          name = 'Казиева Алима Канатовна';
          email = 'butyakaz24@gmail.com';
        }

        // If name or email missing, attempt to fetch user document
        if ((!name || !email) && uid) {
          try {
            const userDocSnap = await getDoc(doc(db, 'users', uid));
            if (userDocSnap.exists()) {
              const uData = userDocSnap.data();
              if (!name) name = uData.displayName || uData.fullName || uData.name || '';
              if (!email) email = uData.email || '';
            }
          } catch (e) {}
        }

        // Fallback email username if present
        if (!name && email && email.includes('@')) {
          name = email.split('@')[0];
        }

        // Skip completely empty/broken test stubs without email or real name
        if (!name && !email) continue;

        rawList.push({
          id: uid,
          name: name || 'Сотрудник',
          email: email || '—',
          role: formatRole(data.role)
        });
      }

      // 2. Also search root crm_contacts for employees/staff
      const crmSnap = await getDocs(query(collection(db, 'crm_contacts'), where('tenantId', '==', tenantId)));
      crmSnap.forEach(d => {
        const data = d.data();
        if (data.type === 'employee' || data.type === 'staff') {
          const email = data.email || '—';
          const name = data.fullName || data.name || '';
          
          if (name || (email && email !== '—')) {
            rawList.push({
              id: d.id,
              name: name || email.split('@')[0] || 'Сотрудник',
              email,
              role: formatRole(data.role)
            });
          }
        }
      });
    } catch (e) {
      console.warn("fetchOrgStaff notice:", e);
    }

    // 3. Deduplicate staff list by email (if available) or by id
    const uniqueMap = new Map<string, OrgStaffMember>();
    
    for (const item of rawList) {
      // Key by email if available, otherwise by id
      const key = (item.email && item.email !== '—') ? item.email.toLowerCase() : item.id;
      
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      } else {
        // Merge richer data if existing item has fallback placeholder
        const existing = uniqueMap.get(key)!;
        if ((existing.name === 'Сотрудник' || existing.name.startsWith('mem_')) && item.name && item.name !== 'Сотрудник') {
          uniqueMap.set(key, item);
        }
      }
    }

    let finalStaff = Array.from(uniqueMap.values());

    // 4. Default fallback list if no real staff found
    if (finalStaff.length === 0) {
      finalStaff = [
        { id: 'staff_kazieva', name: 'Казиева Алима Канатовна', email: 'butyakaz24@gmail.com', role: 'Владелец' },
        { id: 'staff_director', name: 'Директор Академии', email: 'director@academy.edu', role: 'Администратор' }
      ];
    }

    return finalStaff;
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
