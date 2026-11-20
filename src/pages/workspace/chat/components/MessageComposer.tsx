import React, { useState } from 'react';
import { Send, Video, Reply, X, Loader2 } from 'lucide-react';
import { ChatAttachment } from '../../../../types/chat';

interface Props {
  replyingTo?: { senderName: string; text: string } | null;
  onCancelReply?: () => void;
  /** Отказ (ошибка) — текст остаётся в поле, чтобы отправить ещё раз. */
  onSendMessage: (text: string, attachments: ChatAttachment[], replySnapshot?: { senderName: string; text: string }) => Promise<void>;
  onStartCall: () => void;
  disabled?: boolean;
}

export default function MessageComposer({ replyingTo, onCancelReply, onSendMessage, onStartCall, disabled }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError('');
    try {
      await onSendMessage(value, [], replyingTo || undefined);
      setText('');
      onCancelReply?.();
    } catch (err: any) {
      setError(err?.code === 'permission-denied' ? 'Нет доступа к этому каналу' : 'Не отправлено — проверьте связь и повторите');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-3 sm:p-4 bg-[var(--bg-panel)] border-t border-[var(--border-color)]">
      {replyingTo && (
        <div className="mb-2 p-2 bg-[var(--bg-surface-hover)] border-l-4 border-[var(--accent)] rounded-r-lg flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Reply className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <div className="truncate">
              <span className="font-semibold text-[var(--text-main)]">{replyingTo.senderName}: </span>
              <span className="text-[var(--text-muted)] truncate">{replyingTo.text}</span>
            </div>
          </div>
          <button type="button" onClick={onCancelReply} className="p-1 hover:bg-[var(--bg-surface)] rounded-full text-[var(--text-muted)] shrink-0 ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}
        className="flex items-end gap-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-1.5 focus-within:border-[var(--accent)] transition-colors">
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); if (error) setError(''); }}
          onKeyDown={handleKeyDown}
          placeholder="Сообщение"
          disabled={disabled}
          className="flex-1 bg-transparent resize-none max-h-32 min-h-[40px] px-2 py-2 focus:outline-none text-[var(--text-main)] text-sm"
          rows={1}
        />
        <button type="button" onClick={onStartCall} title="Видеозвонок" className="p-2 text-[var(--text-muted)] hover:text-[var(--accent)] transition rounded-lg">
          <Video className="w-5 h-5" />
        </button>
        <button type="submit" disabled={!text.trim() || sending || disabled} title="Отправить"
          className="p-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed">
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </form>
      {error && <div className="mt-1.5 text-xs text-rose-600">{error}</div>}
    </div>
  );
}
