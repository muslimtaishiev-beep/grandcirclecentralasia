import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import ChannelSidebar from './components/ChannelSidebar';
import MessageFeed from './components/MessageFeed';
import MessageComposer from './components/MessageComposer';
import { useChatRoom } from '../../../hooks/useChatRoom';
import { useAuth } from '../../../contexts/AuthContext';
import { Hash, Lock, Search } from 'lucide-react';

export default function ChatLayout() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const { user } = useAuth();
  
  // In a real app, this would come from URL params (/workspace/:orgId/chat/:channelId)
  const [activeChannelId, setActiveChannelId] = useState<string>();
  
  const {
    channels,
    messages,
    activeChannel,
    sendMessage,
    createChannel,
    startCall,
    toggleReaction
  } = useChatRoom(activeTenant?.id, activeChannelId);

  // If no channel is selected but channels exist, select the first one automatically
  React.useEffect(() => {
    if (!activeChannelId && channels.length > 0) {
      setActiveChannelId(channels[0].id);
    }
  }, [channels, activeChannelId]);

  const handleCreateChannel = async (name: string, type: 'public_channel' | 'private_channel' | 'direct_message') => {
    const newId = await createChannel(name, type);
    if (newId) setActiveChannelId(newId);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden bg-[var(--bg-app)]">
      <ChannelSidebar 
        channels={channels}
        activeChannelId={activeChannelId}
        onSelectChannel={setActiveChannelId}
        onCreateChannel={handleCreateChannel}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        {activeChannel ? (
          <>
            <div className="h-16 border-b border-[var(--border-color)] bg-[var(--bg-panel)] flex items-center justify-between px-6 shrink-0">
              <div className="flex items-center gap-2">
                {activeChannel.type === 'public_channel' ? <Hash className="w-5 h-5 text-[var(--text-muted)]" /> : <Lock className="w-5 h-5 text-[var(--text-muted)]" />}
                <h2 className="text-lg font-black text-[var(--text-main)]">{activeChannel.name}</h2>
              </div>
              <div className="flex items-center gap-3">
                <button className="p-2 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] rounded-full transition">
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>

            <MessageFeed 
              messages={messages}
              currentUserId={user?.uid}
              activeCallSessionId={activeChannel.activeCallSessionId}
              onJoinCall={() => alert('Открытие WebRTC комнаты: ' + activeChannel.activeCallSessionId)}
              onToggleReaction={toggleReaction}
            />

            <MessageComposer 
              onSendMessage={sendMessage}
              onStartCall={startCall}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] font-medium">
            Выберите канал или чат
          </div>
        )}
      </div>
    </div>
  );
}
