import React, { useState } from 'react';
import { Hash, Lock, MessageSquare, Plus, Users, UserPlus, Check } from 'lucide-react';
import { ChatChannel } from '../../../../types/chat';
import { OrgStaffMember } from '../../../../services/chatService';

interface Props {
  channels: ChatChannel[];
  staffList: OrgStaffMember[];
  activeChannelId?: string;
  onSelectChannel: (id: string) => void;
  onCreateChannel: (name: string, type: 'public_channel' | 'private_channel' | 'direct_message', memberStaffIds: string[]) => void;
}

export default function ChannelSidebar({ 
  channels, 
  staffList, 
  activeChannelId, 
  onSelectChannel, 
  onCreateChannel 
}: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'public_channel' | 'private_channel' | 'direct_message'>('public_channel');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);

  const publicChannels = channels.filter(c => c.type === 'public_channel');
  const privateChannels = channels.filter(c => c.type === 'private_channel');
  const dms = channels.filter(c => c.type === 'direct_message');

  const toggleStaffSelection = (id: string) => {
    setSelectedStaffIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim() && newChannelType !== 'direct_message') return;

    let finalName = newChannelName.trim();
    if (newChannelType === 'direct_message' && !finalName) {
      const pickedNames = staffList.filter(s => selectedStaffIds.includes(s.id)).map(s => s.name);
      finalName = pickedNames.join(', ') || 'Диалог';
    }

    onCreateChannel(finalName, newChannelType, selectedStaffIds);
    setNewChannelName('');
    setSelectedStaffIds([]);
    setIsModalOpen(false);
  };

  const startDmWithColleague = (staff: OrgStaffMember) => {
    const existingDm = dms.find(c => c.memberStaffIds?.includes(staff.id));
    if (existingDm) {
      onSelectChannel(existingDm.id);
    } else {
      onCreateChannel(`Чат с ${staff.name}`, 'direct_message', [staff.id]);
    }
  };

  return (
    <div className="w-72 border-r border-[var(--border-color)] bg-[var(--bg-panel)] flex flex-col shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
        <h2 className="font-black text-base flex items-center gap-2 text-[var(--text-main)]">
          <Users className="w-5 h-5 text-emerald-500" />
          <span>Командные Чаты</span>
        </h2>
        <button 
          onClick={() => { setNewChannelType('public_channel'); setIsModalOpen(true); }}
          className="p-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 rounded-lg transition text-xs font-bold flex items-center gap-1 cursor-pointer"
          title="Создать группу или канал"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Channel Lists */}
      <div className="flex-1 overflow-y-auto py-4 space-y-6">
        
        {/* 1. Public Channels */}
        <div>
          <div className="flex items-center justify-between px-4 mb-2">
            <h3 className="text-xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider">Публичные Каналы</h3>
            <button 
              onClick={() => { setNewChannelType('public_channel'); setIsModalOpen(true); }}
              className="text-[var(--text-muted)] hover:text-emerald-500 text-xs font-bold cursor-pointer"
            >
              + Канал
            </button>
          </div>
          <div className="space-y-1 px-2">
            {publicChannels.map(c => (
              <button
                key={c.id}
                onClick={() => onSelectChannel(c.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold transition rounded-xl cursor-pointer ${
                  activeChannelId === c.id 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <Hash className="w-4 h-4 shrink-0 opacity-70" />
                <span className="truncate">{c.name}</span>
                {c.activeCallSessionId && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 ml-auto animate-ping"></span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Private Groups */}
        <div>
          <div className="flex items-center justify-between px-4 mb-2">
            <h3 className="text-xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider">Приватные Группы</h3>
            <button 
              onClick={() => { setNewChannelType('private_channel'); setIsModalOpen(true); }}
              className="text-[var(--text-muted)] hover:text-emerald-500 text-xs font-bold cursor-pointer"
            >
              + Группа
            </button>
          </div>
          <div className="space-y-1 px-2">
            {privateChannels.length === 0 ? (
              <div className="px-3 py-1.5 text-xs text-[var(--text-muted)]">Приватных групп нет</div>
            ) : privateChannels.map(c => (
              <button
                key={c.id}
                onClick={() => onSelectChannel(c.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold transition rounded-xl cursor-pointer ${
                  activeChannelId === c.id 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <Lock className="w-4 h-4 shrink-0 opacity-70" />
                <span className="truncate">{c.name}</span>
                <span className="text-[10px] opacity-75 ml-auto">({c.memberStaffIds?.length || 1})</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Direct Messages with Team Members */}
        <div>
          <div className="flex items-center justify-between px-4 mb-2">
            <h3 className="text-xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider">Сотрудники ({staffList.length})</h3>
          </div>
          <div className="space-y-1 px-2">
            {staffList.map(st => (
              <button
                key={st.id}
                onClick={() => startDmWithColleague(st)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-xs flex items-center justify-center shrink-0">
                    {st.name[0]}
                  </div>
                  <div className="truncate text-left">
                    <div className="text-xs font-bold text-[var(--text-main)] truncate">{st.name}</div>
                    <div className="text-[10px] text-[var(--text-muted)] truncate">{st.role || st.email}</div>
                  </div>
                </div>
                <MessageSquare className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition shrink-0" />
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Modal: Create Channel / Group with Member Selector */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h3 className="font-bold text-base text-[var(--text-main)] flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-500" />
                <span>Создать чат или группу</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-black/10 rounded-lg text-slate-400">✕</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Тип канала</label>
                <select 
                  value={newChannelType}
                  onChange={e => setNewChannelType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
                >
                  <option value="public_channel">🌐 Публичный канал (Доступен всей организации)</option>
                  <option value="private_channel">🔒 Приватная группа (Только вы и выбранные люди)</option>
                  <option value="direct_message">💬 Личное сообщение (DM 1-на-1 или диалог)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Название группы / чата *</label>
                <input 
                  type="text" 
                  required={newChannelType !== 'direct_message'}
                  placeholder="Например: Продажи, Учителя 8-го класса..."
                  value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              {/* Employee Selector */}
              {newChannelType !== 'public_channel' && (
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] mb-2">Выберите участников из списка сотрудников ({selectedStaffIds.length} выбр.):</label>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl">
                    {staffList.map(st => {
                      const isSelected = selectedStaffIds.includes(st.id);
                      return (
                        <div 
                          key={st.id}
                          onClick={() => toggleStaffSelection(st.id)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs ${
                            isSelected ? 'bg-emerald-500/15 border border-emerald-500/30' : 'hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          <div>
                            <div className="font-bold text-[var(--text-main)]">{st.name}</div>
                            <div className="text-[10px] text-[var(--text-muted)]">{st.role} • {st.email}</div>
                          </div>
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'}`}>
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl border text-xs font-bold text-[var(--text-muted)] hover:bg-black/5">Отмена</button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition">Создать канал</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
