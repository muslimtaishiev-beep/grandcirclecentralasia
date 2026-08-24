import React, { useState } from 'react';
import { Send, Smile, Paperclip, Video, Reply, X } from 'lucide-react';
import { ChatAttachment } from '../../../../types/chat';

interface Props {
  replyingTo?: { senderName: string; text: string } | null;
  onCancelReply?: () => void;
  onSendMessage: (text: string, attachments: ChatAttachment[], replySnapshot?: { senderName: string; text: string }) => void;
  onStartCall: () => void;
}

export default function MessageComposer({ replyingTo, onCancelReply, onSendMessage, onStartCall }: Props) {
  const [text, setText] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim(), [], replyingTo || undefined);
    setText('');
    if (onCancelReply) onCancelReply();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-4 bg-[var(--bg-panel)] border-t border-[var(--border-color)]">
      {/* Reply Preview Bar */}
      {replyingTo && (
        <div className="mb-2 p-2.5 bg-emerald-500/10 border-l-4 border-emerald-500 rounded-r-xl flex items-center justify-between animate-fade-in text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Reply className="w-4 h-4 text-emerald-500 shrink-0" />
            <div className="truncate">
              <span className="font-bold text-[var(--text-main)]">Ответ на сообщение {replyingTo.senderName}: </span>
              <span className="text-[var(--text-muted)] italic truncate">"{replyingTo.text}"</span>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onCancelReply} 
            className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full text-slate-400 shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form 
        onSubmit={handleSubmit}
        className="flex items-end gap-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-2 focus-within:border-emerald-500 transition-colors shadow-sm"
      >
        <button type="button" className="p-2 text-[var(--text-muted)] hover:text-emerald-500 transition rounded-xl hover:bg-[var(--bg-app)]">
          <Paperclip className="w-5 h-5" />
        </button>
        
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={replyingTo ? `Ваш ответ пользователю ${replyingTo.senderName}...` : "Написать сообщение..."}
          className="flex-1 bg-transparent resize-none max-h-32 min-h-[40px] py-2 focus:outline-none text-[var(--text-main)] text-sm"
          rows={1}
        />

        <div className="flex items-center gap-1">
          <button type="button" className="p-2 text-[var(--text-muted)] hover:text-emerald-500 transition rounded-xl hover:bg-[var(--bg-app)]">
            <Smile className="w-5 h-5" />
          </button>
          <button 
            type="button" 
            onClick={onStartCall}
            title="Начать видеозвонок"
            className="p-2 text-indigo-500 hover:text-white hover:bg-indigo-500 transition rounded-xl"
          >
            <Video className="w-5 h-5" />
          </button>
          <button 
            type="submit" 
            disabled={!text.trim()}
            className="p-2 bg-emerald-600 text-white rounded-xl shadow-md hover:bg-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
      <div className="text-center mt-2 text-xs font-medium text-[var(--text-muted)]">
        <strong>Enter</strong> для отправки, <strong>Shift + Enter</strong> для переноса строки
      </div>
    </div>
  );
}
