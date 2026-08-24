export type ChannelType = 'public_channel' | 'private_channel' | 'direct_message';

export interface ChatMessageReaction {
  emoji: string;
  staffUserIds: string[];
}

export interface ChatAttachment {
  id: string;
  name: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
}

export interface ChatMessage {
  id: string;
  tenantId: string;
  channelId: string;
  senderStaffId: string;
  senderName: string;
  senderAvatarUrl?: string;
  text: string;
  attachments?: ChatAttachment[];
  reactions?: Record<string, string[]>;
  replyToMessageId?: string;
  isCallAnnouncement?: boolean;
  webrtcRoomId?: string;
  readByStaffIds: string[];
  createdAt: number;
  updatedAt?: number;
}

export interface ChatChannel {
  id: string;
  tenantId: string;
  name: string;
  type: ChannelType;
  departmentId?: string;
  memberStaffIds: string[];
  lastMessage?: {
    text: string;
    senderName: string;
    timestamp: number;
  };
  activeCallSessionId?: string;
  createdAt: number;
}
