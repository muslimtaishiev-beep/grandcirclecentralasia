import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { 
  Hash, 
  Plus, 
  Search, 
  Phone, 
  Video, 
  Sidebar, 
  Send, 
  Paperclip, 
  Smile, 
  CheckCheck,
  Edit,
  Pin,
  Loader2
} from 'lucide-react';
import { useChatChannels, useChatMessages } from '../../../lib/useChat';
import { useAuth } from '../../../contexts/AuthContext';
import VideoCall from '../../../components/chat/VideoCall';

export default function ChatLayout() {
  const { activeTenant } = useOutletContext<any>() || {};
  const { orgId } = useParams();
  const { user } = useAuth();
  
  const { channels, loading: channelsLoading, addChannel } = useChatChannels(orgId);
  const [activeChannelId, setActiveChannelId] = useState<string | undefined>();
  const { messages, loading: messagesLoading, sendMessage } = useChatMessages(activeChannelId);

  const [newMessage, setNewMessage] = useState('');
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-select first channel when loaded
  useEffect(() => {
    if (!channelsLoading && channels.length > 0 && !activeChannelId) {
      setActiveChannelId(channels[0].id);
    }
  }, [channels, channelsLoading, activeChannelId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeChannel = channels.find(c => c.id === activeChannelId);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeChannelId) return;
    
    await sendMessage({
      senderId: user.uid,
      senderName: user.displayName || user.email?.split('@')[0] || 'User',
      content: newMessage
    });
    setNewMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const createTestChannel = async () => {
    await addChannel({
      type: 'public',
      name: 'Общий чат',
      subtitle: 'Для всех сотрудников'
    });
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] -m-4 sm:-m-6 bg-[var(--bg-surface)] overflow-hidden rounded-xl">
      
      {/* Left Chat List Panel */}
      <div className="w-80 border-r border-[var(--border-color)] flex flex-col bg-[var(--bg-surface)] z-10 shrink-0">
        
        {/* Header Search */}
        <div className="p-3 border-b border-[var(--border-color)] flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input 
              type="text" 
              placeholder="Найти сотрудника или чат"
              className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-full pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text-main)] transition-colors"
            />
          </div>
          <button onClick={createTestChannel} className="p-1.5 text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-md transition" title="Создать чат">
            <Edit className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {channelsLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : channels.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--text-muted)]">
              Нет активных чатов. <button onClick={createTestChannel} className="text-[var(--accent)] underline">Создать</button>
            </div>
          ) : (
            channels.map(channel => (
              <div 
                key={channel.id} 
                onClick={() => setActiveChannelId(channel.id)}
                className={`px-4 py-3 flex gap-3 cursor-pointer transition border-b border-transparent ${
                  activeChannelId === channel.id 
                    ? 'bg-[var(--accent)] text-white shadow-[0_2px_10px_rgba(37,99,235,0.2)]' 
                    : 'hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shrink-0 shadow-sm ${channel.color || 'bg-blue-500'}`}>
                  {channel.avatar || <Hash className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className={`font-semibold text-sm truncate ${activeChannelId === channel.id ? 'text-white' : 'text-[var(--text-main)]'}`}>
                      {channel.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-xs truncate ${activeChannelId === channel.id ? 'text-white/90' : 'text-[var(--text-muted)]'}`}>
                      {channel.subtitle || '...'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div 
        className="flex-1 flex flex-col relative"
        style={{
          backgroundColor: '#dbeafe',
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4) 0%, rgba(219, 234, 254, 1) 100%)'
        }}
      >
        <div className="absolute inset-0 bg-black/40 dark:block hidden pointer-events-none"></div>

        {activeChannel ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-[var(--border-color)] flex items-center justify-between px-4 sm:px-6 bg-[var(--bg-surface)]/90 backdrop-blur-sm z-10 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${activeChannel.color || 'bg-blue-500'} flex items-center justify-center shadow-sm`}>
                  <Hash className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-[var(--text-main)] flex items-center gap-2">
                    {activeChannel.name}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsVideoCallOpen(true)}
                  className="hidden sm:flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-full text-sm font-medium transition shadow-sm cursor-pointer"
                >
                  <Video className="w-4 h-4" />
                  Видеозвонок
                </button>
                <div className="w-px h-6 bg-[var(--border-color)] mx-1"></div>
                <button className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] transition"><Search className="w-5 h-5" /></button>
                <button className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] transition"><Sidebar className="w-5 h-5" /></button>
              </div>
            </div>

            {/* Video Call Modal */}
            {isVideoCallOpen && activeChannel && (
              <VideoCall
                channelName={activeChannel.name}
                userName={user.displayName || user.email?.split('@')[0] || 'User'}
                onClose={() => setIsVideoCallOpen(false)}
              />
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 relative z-10">
              {messagesLoading ? (
                <div className="flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-white/70" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex justify-center text-sm text-[var(--text-muted)] bg-[var(--bg-surface)]/50 backdrop-blur px-4 py-2 rounded-full w-fit mx-auto">
                  Здесь пока нет сообщений
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isOwn = msg.senderId === user.uid;
                  
                  // Extract time from timestamp (if exists, else just now)
                  let timeString = '';
                  if (msg.timestamp && msg.timestamp.toDate) {
                    timeString = msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  } else {
                    timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  }

                  return (
                    <div key={msg.id} className={`flex gap-3 w-full ${isOwn ? 'justify-end' : ''}`}>
                      {!isOwn && <div className="w-8 h-8 rounded-full bg-orange-400 shrink-0 mt-1 flex items-center justify-center text-white text-xs font-bold">{msg.senderName[0].toUpperCase()}</div>}
                      
                      <div className="max-w-[85%]">
                        {!isOwn && <div className="text-xs font-medium text-[#c05621] dark:text-[#fbd38d] mb-1">{msg.senderName}</div>}
                        {isOwn && <div className="text-xs font-medium text-[var(--accent)] mb-1 text-right">{msg.senderName}</div>}
                        
                        <div className={`p-3 rounded-2xl shadow-sm text-sm ${
                          isOwn 
                            ? 'bg-[#e3f2fd] dark:bg-[#1e3a8a] rounded-tr-sm border border-[#bbdefb] dark:border-[#1e40af] text-gray-800 dark:text-gray-200' 
                            : 'bg-white dark:bg-[#1a1a1a] rounded-tl-sm border border-black/5 dark:border-white/5 text-gray-800 dark:text-gray-200'
                        }`}>
                          {msg.content}
                          <div className={`flex items-center gap-1 text-[10px] mt-1 ${isOwn ? 'justify-end text-blue-500/70 dark:text-blue-300' : 'text-gray-400 text-right'}`}>
                            {timeString} {isOwn && <CheckCheck className="w-3 h-3" />}
                          </div>
                        </div>
                      </div>

                      {isOwn && <div className="w-8 h-8 rounded-full bg-blue-600 shrink-0 mt-1 flex items-center justify-center text-white text-xs font-bold">{msg.senderName[0].toUpperCase()}</div>}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 z-10 bg-transparent shrink-0">
              <div className="bg-white dark:bg-[#1a1a1a] border border-[var(--border-color)] rounded-2xl p-2 flex items-end gap-2 shadow-sm focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_2px_rgba(37,99,235,0.1)] transition-all">
                <button className="p-2.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition shrink-0">
                  <Paperclip className="w-5 h-5" />
                </button>
                <textarea 
                  placeholder="Написать сообщение..."
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-transparent resize-none max-h-32 focus:outline-none text-sm text-[var(--text-main)] py-3 px-1 scrollbar-thin"
                  rows={1}
                />
                <div className="flex items-center gap-1 shrink-0 mb-1">
                  <button className="p-2.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition">
                    <Smile className="w-5 h-5" />
                  </button>
                  <button onClick={handleSendMessage} disabled={!newMessage.trim()} className="p-2.5 bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 rounded-full transition ml-1 shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center">
                    <Send className="w-4 h-4 ml-0.5 mt-0.5" />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-white/80 z-10">
            Выберите чат слева
          </div>
        )}
      </div>

    </div>
  );
}
