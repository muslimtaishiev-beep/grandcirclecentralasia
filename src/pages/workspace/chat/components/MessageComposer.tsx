import React, { useState } from 'react';
import { Send, Smile, Paperclip, Video } from 'lucide-react';
import { ChatAttachment } from '../../../../types/chat';

interface Props {
  onSendMessage: (text: string, attachments: ChatAttachment[]) => void;
  onStartCall: () => void;
}

export default function MessageComposer({ onSendMessage, onStartCall }: Props) {
  const [text, setText] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim(), []);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-4 bg-[var(--bg-panel)] border-t border-[var(--border-color)]">
      <form 
        onSubmit={handleSubmit}
        className="flex items-end gap-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-2 focus-within:border-[var(--accent)] transition-colors shadow-sm"
      >
        <button type="button" className="p-2 text-[var(--text-muted)] hover:text-[var(--accent)] transition rounded-xl hover:bg-[var(--bg-app)]">
          <Paperclip className="w-5 h-5" />
        </button>
        
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Написать сообщение..."
          className="flex-1 bg-transparent resize-none max-h-32 min-h-[40px] py-2 focus:outline-none text-[var(--text-main)]"
          rows={1}
        />

        <div className="flex items-center gap-1">
          <button type="button" className="p-2 text-[var(--text-muted)] hover:text-[var(--accent)] transition rounded-xl hover:bg-[var(--bg-app)]">
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
            className="p-2 bg-[var(--accent)] text-white rounded-xl shadow-md hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
