import { useState, useEffect } from 'react';
import { chatService } from '../services/chatService';
import { ChatChannel, ChatMessage, ChatAttachment } from '../types/chat';
import { useAuth } from '../contexts/AuthContext';

export function useChatRoom(tenantId: string, channelId: string | undefined) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [channels, setChannels] = useState<ChatChannel[]>([]);

  useEffect(() => {
    if (!tenantId || !user?.uid) return;
    const unsub = chatService.subscribeToChannels(tenantId, user.uid, (data) => {
      setChannels(data);
    });
    return () => unsub();
  }, [tenantId, user?.uid]);

  useEffect(() => {
    if (!tenantId || !channelId) {
      setMessages([]);
      return;
    }
    const unsub = chatService.subscribeToMessages(tenantId, channelId, (data) => {
      setMessages(data);
    });
    return () => unsub();
  }, [tenantId, channelId]);

  const sendMessage = async (text: string, attachments: ChatAttachment[] = []) => {
    if (!tenantId || !channelId || !user) return;
    
    await chatService.sendMessage(tenantId, channelId, {
      senderStaffId: user.uid,
      senderName: user.displayName || 'Staff ' + user.uid.substring(0,4),
      senderAvatarUrl: user.photoURL || undefined,
      text,
      attachments
    });
  };

  const startCall = async () => {
    if (!tenantId || !channelId || !user) return;
    await chatService.startChannelCall(tenantId, channelId, user.uid, user.displayName || 'Staff ' + user.uid.substring(0,4));
  };

  const endCall = async () => {
    if (!tenantId || !channelId) return;
    await chatService.endChannelCall(tenantId, channelId);
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!tenantId || !channelId || !user) return;
    await chatService.toggleMessageReaction(tenantId, channelId, messageId, emoji, user.uid);
  };

  const activeChannel = channels.find(c => c.id === channelId);

  return {
    channels,
    messages,
    activeChannel,
    sendMessage,
    startCall,
    endCall,
    toggleReaction
  };
}
