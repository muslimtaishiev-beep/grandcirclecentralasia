import React, { useRef, useEffect } from 'react';
import { ChatMessage } from '../../../../types/chat';
import { FileIcon, PhoneCall, Sparkles, Reply, Trash2 } from 'lucide-react';
import InChatCallBanner from './InChatCallBanner';

interface Props {
  messages: ChatMessage[];
  currentUserId?: string;
  activeCallSessionId?: string;
  onJoinCall: () => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onReplyMessage?: (msg: ChatMessage) => void;
  onDeleteMessage?: (messageId: string) => void;
}

export default function MessageFeed({ 
  messages, 
  currentUserId, 
  activeCallSessionId, 
  onJoinCall, 
  onToggleReaction,
  onReplyMessage,
  onDeleteMessage 
}: Props) {
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

      <div className="p-6 space-y-5 flex-1">
        {messages.map((msg, index) => {
          const isMe = msg.senderStaffId === currentUserId;
          const senderName = msg.senderName?.trim() || 'Сотрудник';
          const avatarChar = senderName.charAt(0).toUpperCase() || '👤';

          // 1. System Messages
          if (msg.isSystemMessage) {
            return (
              <div key={msg.id} className="flex justify-center my-3">
                <div className="px-4 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-xs font-bold text-[var(--text-muted)] border border-[var(--border-color)] shadow-xs flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>{msg.text}</span>
                  <span className="text-[10px] opacity-60 font-normal">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          }

          // 2. Call Announcements
          if (msg.isCallAnnouncement) {
            return (
              <div key={msg.id} className="flex justify-center my-4">
                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 max-w-sm w-full shadow-sm flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                      <PhoneCall className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <div className="text-xs font-black">{msg.text}</div>
                      <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">Инициатор: {senderName}</div>
                    </div>
                  </div>
                  <button 
                    onClick={onJoinCall}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer shrink-0"
                  >
                    Войти
                  </button>
                </div>
              </div>
            );
          }

          // 3. Normal Messages
          const showHeader = index === 0 || messages[index - 1].senderStaffId !== msg.senderStaffId || (msg.createdAt - messages[index - 1].createdAt > 5 * 60 * 1000);

          return (
            <div key={msg.id} className={`flex gap-3 group relative ${isMe ? 'flex-row-reverse' : ''}`}>
              {showHeader ? (
                <div className="w-9 h-9 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  {avatarChar}
                </div>
              ) : (
                <div className="w-9 shrink-0"></div>
              )}
              
              <div className={`flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                {showHeader && (
                  <div className="flex items-baseline gap-2 mb-1 px-1">
                    <span className="font-bold text-xs text-[var(--text-main)]">{senderName}</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-medium">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}

                {/* Quoted Message Preview if replying */}
                {msg.replyToMessageSnapshot && (
                  <div className={`mb-1 px-3 py-1.5 rounded-lg border-l-4 border-emerald-500 bg-black/5 dark:bg-white/10 text-xs text-[var(--text-muted)] max-w-full ${isMe ? 'text-right' : 'text-left'}`}>
                    <div className="font-bold text-[11px] text-emerald-500">{msg.replyToMessageSnapshot.senderName}</div>
                    <div className="truncate italic">{msg.replyToMessageSnapshot.text}</div>
                  </div>
                )}

                <div className={`px-4 py-2.5 rounded-2xl relative text-sm leading-relaxed shadow-xs ${
                  isMe 
                    ? 'bg-emerald-600 text-white rounded-tr-xs font-medium' 
                    : 'bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-main)] rounded-tl-xs font-medium'
                }`}>
                  {msg.text}
                  
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {msg.attachments.map(att => (
                        <div key={att.id} className="flex items-center gap-2 p-2 bg-black/10 rounded-lg">
                          <FileIcon className="w-4 h-4 opacity-70" />
                          <span className="text-xs font-medium truncate max-w-[200px]">{att.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className={`flex flex-wrap gap-1 mt-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {Object.entries(msg.reactions).map(([emoji, staffIds]) => (
                        <button
                          key={emoji}
                          onClick={() => onToggleReaction(msg.id, emoji)}
                          className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition ${
                            staffIds.includes(currentUserId || '') ? 'bg-white/25 text-white font-bold' : 'bg-black/5 dark:bg-white/10 hover:bg-black/10'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="font-bold opacity-90 text-[11px]">{staffIds.length}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Action Bar on Hover: Reactions, Reply, Delete */}
                <div className={`opacity-0 group-hover:opacity-100 transition flex items-center gap-2 mt-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <div className="flex items-center gap-1">
                    <button onClick={() => onToggleReaction(msg.id, '👍')} className="text-xs hover:scale-125 transition cursor-pointer">👍</button>
                    <button onClick={() => onToggleReaction(msg.id, '🔥')} className="text-xs hover:scale-125 transition cursor-pointer">🔥</button>
                    <button onClick={() => onToggleReaction(msg.id, '👀')} className="text-xs hover:scale-125 transition cursor-pointer">👀</button>
                    <button onClick={() => onToggleReaction(msg.id, '❤️')} className="text-xs hover:scale-125 transition cursor-pointer">❤️</button>
                  </div>

                  <span className="text-[10px] text-slate-300">•</span>

                  {onReplyMessage && (
                    <button 
                      onClick={() => onReplyMessage(msg)}
                      className="text-xs font-bold text-emerald-500 hover:underline flex items-center gap-1 cursor-pointer"
                      title="Ответить на сообщение"
                    >
                      <Reply className="w-3.5 h-3.5" />
                      <span>Ответить</span>
                    </button>
                  )}

                  {onDeleteMessage && (
                    <button 
                      onClick={() => {
                        if (window.confirm("Удалить это сообщение?")) {
                          onDeleteMessage(msg.id);
                        }
                      }}
                      className="text-xs font-bold text-red-400 hover:text-red-600 flex items-center gap-1 cursor-pointer ml-1"
                      title="Удалить сообщение"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Удалить</span>
                    </button>
                  )}
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
