import React, { useRef, useEffect } from 'react';
import { ChatMessage } from '../../../../types/chat';
import { FileIcon } from 'lucide-react';
import InChatCallBanner from './InChatCallBanner';

interface Props {
  messages: ChatMessage[];
  currentUserId?: string;
  activeCallSessionId?: string;
  onJoinCall: () => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
}

export default function MessageFeed({ messages, currentUserId, activeCallSessionId, onJoinCall, onToggleReaction }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-app)] relative flex flex-col">
      {activeCallSessionId && (
        <InChatCallBanner 
          sessionId={activeCallSessionId}
          onJoin={onJoinCall}
        />
      )}

      <div className="p-6 space-y-6 flex-1">
        {messages.map((msg, index) => {
          const isMe = msg.senderStaffId === currentUserId;
          const showHeader = index === 0 || messages[index - 1].senderStaffId !== msg.senderStaffId || (msg.createdAt - messages[index - 1].createdAt > 5 * 60 * 1000);

          return (
            <div key={msg.id} className={`flex gap-3 group ${isMe ? 'flex-row-reverse' : ''}`}>
              {showHeader ? (
                <div className="w-10 h-10 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold shrink-0">
                  {msg.senderName.charAt(0).toUpperCase()}
                </div>
              ) : (
                <div className="w-10 shrink-0"></div>
              )}
              
              <div className={`flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                {showHeader && (
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-bold text-sm text-[var(--text-main)]">{msg.senderName}</span>
                    <span className="text-xs text-[var(--text-muted)] font-medium">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}

                <div className={`px-4 py-2.5 rounded-2xl relative text-[15px] leading-relaxed ${
                  msg.isCallAnnouncement 
                    ? 'bg-indigo-50 border border-indigo-200 text-indigo-800' 
                    : isMe ? 'bg-[var(--accent)] text-white rounded-tr-sm' : 'bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-main)] rounded-tl-sm'
                }`}>
                  {msg.text}
                  
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {msg.attachments.map(att => (
                        <div key={att.id} className="flex items-center gap-2 p-2 bg-black/10 rounded-lg">
                          <FileIcon className="w-4 h-4 opacity-70" />
                          <span className="text-sm font-medium truncate max-w-[200px]">{att.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {Object.entries(msg.reactions).map(([emoji, staffIds]) => (
                        <button
                          key={emoji}
                          onClick={() => onToggleReaction(msg.id, emoji)}
                          className={`px-1.5 py-0.5 rounded-full text-xs flex items-center gap-1 transition ${
                            staffIds.includes(currentUserId || '') ? 'bg-white/20' : 'bg-black/5 hover:bg-black/10'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="font-bold opacity-80">{staffIds.length}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Invisible hover area for reaction button (simplified) */}
                <div className={`opacity-0 group-hover:opacity-100 transition flex gap-1 mt-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <button onClick={() => onToggleReaction(msg.id, '👍')} className="text-sm hover:scale-125 transition">👍</button>
                  <button onClick={() => onToggleReaction(msg.id, '🔥')} className="text-sm hover:scale-125 transition">🔥</button>
                  <button onClick={() => onToggleReaction(msg.id, '👀')} className="text-sm hover:scale-125 transition">👀</button>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
