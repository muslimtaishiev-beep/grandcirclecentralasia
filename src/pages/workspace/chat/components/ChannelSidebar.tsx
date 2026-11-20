import React, { useState } from 'react';
import { Hash, Lock, MessageSquare, Plus, UserPlus, Check, Search } from 'lucide-react';
import { ChatChannel } from '../../../../types/chat';
import { OrgStaffMember } from '../../../../services/chatService';

type ChannelType = 'public_channel' | 'private_channel' | 'direct_message';

interface Props {
  channels: ChatChannel[];
  staffList: OrgStaffMember[];
  currentUserId?: string;
  activeChannelId?: string;
  onSelectChannel: (id: string) => void;
  onCreateChannel: (name: string, type: ChannelType, memberStaffIds: string[]) => void;
}

/** Название личного диалога — имена собеседников, а не то, что увидел создатель. */
export function dmTitle(c: ChatChannel, staff: OrgStaffMember[], me?: string): string {
  const others = (c.memberStaffIds || []).filter(id => id !== me);
  const names = others.map(id => staff.find(s => s.id === id)?.name).filter(Boolean) as string[];
  return names.length ? names.join(', ') : (others.length ? c.name : 'Заметки');
}

const lastTs = (c: ChatChannel) => c.lastMessage?.timestamp || c.createdAt || 0;

export default function ChannelSidebar({ channels, staffList, currentUserId, activeChannelId, onSelectChannel, onCreateChannel }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<ChannelType>('public_channel');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [q, setQ] = useState('');

  const match = (s: string) => !q.trim() || s.toLowerCase().includes(q.trim().toLowerCase());
  const publicChannels = channels.filter(c => c.type === 'public_channel' && match(c.name)).sort((a, b) => a.name.localeCompare(b.name));
  const privateChannels = channels.filter(c => c.type === 'private_channel' && match(c.name)).sort((a, b) => lastTs(b) - lastTs(a));
  const dms = channels.filter(c => c.type === 'direct_message' && match(dmTitle(c, staffList, currentUserId))).sort((a, b) => lastTs(b) - lastTs(a));
  const colleagues = staffList.filter(s => s.id !== currentUserId && match(s.name));
  const pickable = staffList.filter(s => s.id !== currentUserId);

  const toggleStaffSelection = (id: string) => setSelectedStaffIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const open = (type: ChannelType) => { setNewChannelType(type); setNewChannelName(''); setSelectedStaffIds([]); setIsModalOpen(true); };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newChannelType === 'direct_message' ? !selectedStaffIds.length : !newChannelName.trim()) return;
    let finalName = newChannelName.trim();
    if (newChannelType === 'direct_message' && !finalName) {
      finalName = staffList.filter(s => selectedStaffIds.includes(s.id)).map(s => s.name).join(', ') || 'Диалог';
    }
    onCreateChannel(finalName, newChannelType, selectedStaffIds);
    setIsModalOpen(false);
  };

  const startDmWithColleague = (staff: OrgStaffMember) => {
    const existing = channels.find(c => c.type === 'direct_message' && c.memberStaffIds?.length === 2
      && c.memberStaffIds.includes(staff.id) && (!currentUserId || c.memberStaffIds.includes(currentUserId)));
    if (existing) onSelectChannel(existing.id);
    else onCreateChannel(staff.name, 'direct_message', [staff.id]);
  };

  const item = (active: boolean) => `w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition rounded-lg cursor-pointer ${
    active ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]'}`;
  const head = (title: string, action?: React.ReactNode) => (
    <div className="flex items-center justify-between px-4 mb-1.5">
      <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{title}</h3>
      {action}
    </div>
  );
  const addBtn = (type: ChannelType, title: string) => (
    <button onClick={() => open(type)} className="p-1 text-[var(--text-muted)] hover:text-[var(--accent)] rounded cursor-pointer" title={title}>
      <Plus className="w-4 h-4" />
    </button>
  );

  return (
    <div className="w-72 border-r border-[var(--border-color)] bg-[var(--bg-panel)] flex flex-col shrink-0">
      <div className="p-3 border-b border-[var(--border-color)]">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск"
            className="w-full pl-8 pr-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-5">
        <div>
          {head('Каналы', addBtn('public_channel', 'Новый канал'))}
          <div className="space-y-0.5 px-2">
            {publicChannels.map(c => (
              <button key={c.id} onClick={() => onSelectChannel(c.id)} className={item(activeChannelId === c.id)}>
                <Hash className="w-4 h-4 shrink-0 opacity-70" />
                <span className="truncate">{c.name}</span>
                {c.activeCallSessionId && <span className="w-2 h-2 rounded-full bg-emerald-400 ml-auto" />}
              </button>
            ))}
          </div>
        </div>

        <div>
          {head('Группы', addBtn('private_channel', 'Новая группа'))}
          <div className="space-y-0.5 px-2">
            {privateChannels.map(c => (
              <button key={c.id} onClick={() => onSelectChannel(c.id)} className={item(activeChannelId === c.id)}>
                <Lock className="w-4 h-4 shrink-0 opacity-70" />
                <span className="truncate">{c.name}</span>
                <span className="text-[10px] opacity-75 ml-auto tabular-nums">{c.memberStaffIds?.length || 1}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          {head('Личные сообщения', addBtn('direct_message', 'Новый диалог'))}
          <div className="space-y-0.5 px-2">
            {dms.map(c => {
              const title = dmTitle(c, staffList, currentUserId);
              return (
                <button key={c.id} onClick={() => onSelectChannel(c.id)} className={item(activeChannelId === c.id)}>
                  <div className="w-6 h-6 rounded-full bg-[var(--bg-surface-hover)] text-[var(--text-main)] font-semibold text-[11px] flex items-center justify-center shrink-0">{title[0]?.toUpperCase()}</div>
                  <div className="min-w-0 text-left">
                    <div className="truncate">{title}</div>
                    {c.lastMessage?.text && <div className={`text-[11px] truncate ${activeChannelId === c.id ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>{c.lastMessage.text}</div>}
                  </div>
                  {c.activeCallSessionId && <span className="w-2 h-2 rounded-full bg-emerald-400 ml-auto shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          {head(`Сотрудники · ${colleagues.length}`)}
          <div className="space-y-0.5 px-2">
            {colleagues.map(st => (
              <button key={st.id} onClick={() => startDmWithColleague(st)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-sm text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] rounded-lg transition cursor-pointer group">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-[var(--bg-surface-hover)] font-semibold text-[11px] flex items-center justify-center shrink-0">{st.name[0]?.toUpperCase()}</div>
                  <div className="truncate text-left">
                    <div className="text-xs font-medium truncate">{st.name}</div>
                    <div className="text-[10px] text-[var(--text-muted)] truncate">{st.role || st.email}</div>
                  </div>
                </div>
                <MessageSquare className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base text-[var(--text-main)] flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[var(--accent)]" />
                {newChannelType === 'public_channel' ? 'Новый канал' : newChannelType === 'private_channel' ? 'Новая группа' : 'Новый диалог'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-[var(--bg-surface-hover)] rounded-lg text-[var(--text-muted)]">✕</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="inline-flex rounded-lg border border-[var(--border-color)] p-0.5 w-full">
                {([['public_channel', 'Канал'], ['private_channel', 'Группа'], ['direct_message', 'Диалог']] as const).map(([t, l]) => (
                  <button key={t} type="button" onClick={() => setNewChannelType(t)}
                    className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition ${newChannelType === t ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]'}`}>{l}</button>
                ))}
              </div>

              {newChannelType !== 'direct_message' && (
                <input type="text" required autoFocus placeholder="Название" value={newChannelName} onChange={e => setNewChannelName(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]" />
              )}

              {newChannelType !== 'public_channel' && (
                <div className="max-h-56 overflow-y-auto space-y-1 p-1.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg">
                  {pickable.map(st => {
                    const isSelected = selectedStaffIds.includes(st.id);
                    return (
                      <div key={st.id} onClick={() => toggleStaffSelection(st.id)}
                        className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition text-xs ${isSelected ? 'bg-[var(--accent)]/15' : 'hover:bg-[var(--bg-surface-hover)]'}`}>
                        <div>
                          <div className="font-medium text-[var(--text-main)]">{st.name}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">{st.role}</div>
                        </div>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'border-[var(--border-color)]'}`}>
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-main)]">Отмена</button>
                <button type="submit" disabled={newChannelType === 'direct_message' ? !selectedStaffIds.length : !newChannelName.trim()}
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium disabled:opacity-50">Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
