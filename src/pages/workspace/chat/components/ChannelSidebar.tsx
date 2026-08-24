import React from 'react';
import { Hash, Lock, MessageSquare, Plus } from 'lucide-react';
import { ChatChannel } from '../../../../types/chat';

interface Props {
  channels: ChatChannel[];
  activeChannelId?: string;
  onSelectChannel: (id: string) => void;
}

export default function ChannelSidebar({ channels, activeChannelId, onSelectChannel }: Props) {
  const publicChannels = channels.filter(c => c.type === 'public_channel');
  const privateChannels = channels.filter(c => c.type === 'private_channel');
  const dms = channels.filter(c => c.type === 'direct_message');

  const renderSection = (title: string, list: ChatChannel[], icon: React.ReactNode) => (
    <div className="mb-6">
      <div className="flex items-center justify-between px-4 mb-2">
        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{title}</h3>
        <button className="p-1 hover:bg-[var(--bg-surface)] rounded text-[var(--text-muted)] transition">
          <Plus className="w-3 h-3" />
        </button>
      </div>
      <div className="space-y-0.5">
        {list.map(c => (
          <button
            key={c.id}
            onClick={() => onSelectChannel(c.id)}
            className={`w-full flex items-center gap-2 px-4 py-1.5 text-sm font-medium transition ${
              activeChannelId === c.id 
                ? 'bg-[var(--accent)] text-white' 
                : 'text-[var(--text-main)] hover:bg-[var(--bg-surface)]'
            } rounded-lg mx-2 w-[calc(100%-16px)]`}
          >
            <span className="opacity-70">{icon}</span>
            <span className="truncate">{c.name}</span>
            {c.activeCallSessionId && (
              <span className={`w-2 h-2 rounded-full ml-auto animate-pulse ${activeChannelId === c.id ? 'bg-white' : 'bg-emerald-500'}`}></span>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="w-64 border-r border-[var(--border-color)] bg-[var(--bg-panel)] flex flex-col shrink-0">
      <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
        <h2 className="font-black text-lg">Команда</h2>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        {renderSection('Каналы', publicChannels, <Hash className="w-4 h-4" />)}
        {renderSection('Приватные', privateChannels, <Lock className="w-4 h-4" />)}
        {renderSection('Личные сообщения', dms, <MessageSquare className="w-4 h-4" />)}
      </div>
    </div>
  );
}
