import React from 'react';
import { Hash, Lock, MessageSquare, Plus } from 'lucide-react';
import { ChatChannel } from '../../../../types/chat';

interface Props {
  channels: ChatChannel[];
  activeChannelId?: string;
  onSelectChannel: (id: string) => void;
}

export default function ChannelSidebar({ channels, activeChannelId, onSelectChannel, onCreateChannel }: Props & { onCreateChannel?: (name: string, type: 'public_channel' | 'private_channel' | 'direct_message') => void }) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [newChannelName, setNewChannelName] = React.useState('');
  const [newChannelType, setNewChannelType] = React.useState<'public_channel' | 'private_channel' | 'direct_message'>('public_channel');

  const publicChannels = channels.filter(c => c.type === 'public_channel');
  const privateChannels = channels.filter(c => c.type === 'private_channel');
  const dms = channels.filter(c => c.type === 'direct_message');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim() || !onCreateChannel) return;
    onCreateChannel(newChannelName.trim(), newChannelType);
    setNewChannelName('');
    setIsModalOpen(false);
  };

  const renderSection = (title: string, list: ChatChannel[], icon: React.ReactNode, typeKey: 'public_channel' | 'private_channel' | 'direct_message') => (
    <div className="mb-6">
      <div className="flex items-center justify-between px-4 mb-2">
        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{title}</h3>
        <button 
          onClick={() => { setNewChannelType(typeKey); setIsModalOpen(true); }}
          className="p-1 hover:bg-[var(--bg-surface)] rounded text-[var(--text-muted)] hover:text-emerald-500 transition cursor-pointer"
          title="Создать чат"
        >
          <Plus className="w-3.5 h-3.5" />
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
            } rounded-lg mx-2 w-[calc(100%-16px)] cursor-pointer`}
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
        <button 
          onClick={() => setIsModalOpen(true)}
          className="p-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 rounded-lg transition text-xs font-bold flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Новый чат
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        {renderSection('Каналы', publicChannels, <Hash className="w-4 h-4" />, 'public_channel')}
        {renderSection('Приватные', privateChannels, <Lock className="w-4 h-4" />, 'private_channel')}
        {renderSection('Личные сообщения', dms, <MessageSquare className="w-4 h-4" />, 'direct_message')}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="font-bold text-sm text-[var(--text-main)]">Создать новый чат/канал</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Название чата *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Например: Отдел продаж или Общий чат"
                  value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Тип канала</label>
                <select 
                  value={newChannelType}
                  onChange={e => setNewChannelType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
                >
                  <option value="public_channel">Публичный канал (доступен всем)</option>
                  <option value="private_channel">Приватный канал</option>
                  <option value="direct_message">Личное сообщение (DM)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-3 py-1.5 rounded-xl border text-xs font-bold">Отмена</button>
                <button type="submit" className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold">Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
