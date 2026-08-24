export interface MediaDeviceSettings {
  selectedAudioInputId?: string;
  selectedVideoInputId?: string;
  selectedAudioOutputId?: string;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
}

export interface CallParticipant {
  id: string; // userId
  tenantId: string;
  name: string;
  role: string;
  avatarUrl?: string;
  isHandRaised: boolean;
  isSpeaking: boolean;
  stream?: MediaStream;
  connectionState: 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'disconnected';
  isScreenSharing?: boolean;
}

export interface CallRoomSession {
  id: string;
  tenantId: string;
  title: string;
  hostId: string;
  isLocked: boolean;
  createdAt: number;
  activeParticipantsCount: number;
}

export interface SignalingMessage {
  id?: string;
  type: 'offer' | 'answer' | 'ice-candidate' | 'hand-raise' | 'room-event' | 'chat-message';
  fromUserId: string;
  toUserId: string;
  payload: any; // RTCSessionDescriptionInit | RTCIceCandidateInit | Record<string, unknown>
  timestamp: number;
}

export interface InCallChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystemMessage?: boolean;
}
