import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import ChannelSidebar from './components/ChannelSidebar';
import MessageFeed from './components/MessageFeed';
import MessageComposer from './components/MessageComposer';
import { useChatRoom } from '../../../hooks/useChatRoom';
import { useAuth } from '../../../contexts/AuthContext';
import { Hash, Lock, Search, UserPlus, Users, Video } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ChatLayout() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const { user } = useAuth();
  
  const [activeChannelId, setActiveChannelId] = useState<string>();
  const [isAddMembersOpen, setIsAddMembersOpen] = useState(false);
  const [selectedAddStaffIds, setSelectedAddStaffIds] = useState<string[]>([]);

  const {
    channels,
    messages,
    staffList,
    activeChannel,
    sendMessage,
    createChannel,
    addMembersToActiveChannel,
    startCall,
    toggleReaction
  } = useChatRoom(activeTenant?.id, activeChannelId);

  // Auto-select first channel
  React.useEffect(() => {
    if (!activeChannelId && channels.length > 0) {
      setActiveChannelId(channels[0].id);
    }
  }, [channels, activeChannelId]);

  const handleCreateChannel = async (
    name: string, 
    type: 'public_channel' | 'private_channel' | 'direct_message',
    memberStaffIds: string[]
  ) => {
    const newId = await createChannel(name, type, memberStaffIds);
    if (newId) {
      setActiveChannelId(newId);
      toast.success(`Канал "${name}" создан!`);
    }
  };

  const handleAddMembersSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAddStaffIds.length === 0) return;
    await addMembersToActiveChannel(selectedAddStaffIds);
    toast.success(`Участники добавлены в канал!`);
    setSelectedAddStaffIds([]);
    setIsAddMembersOpen(false);
  };

  const toggleAddStaff = (id: string) => {
    setSelectedAddStaffIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden bg-[var(--bg-app)]">
      <ChannelSidebar 
        channels={channels}
        staffList={staffList}
        activeChannelId={activeChannelId}
        onSelectChannel={setActiveChannelId}
        onCreateChannel={handleCreateChannel}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        {activeChannel ? (
          <>
            {/* Active Channel Header */}
            <div className="h-16 border-b border-[var(--border-color)] bg-[var(--bg-panel)] flex items-center justify-between px-6 shrink-0 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                  {activeChannel.type === 'public_channel' ? <Hash className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-base font-black text-[var(--text-main)] leading-tight">{activeChannel.name}</h2>
                  <div className="text-xs text-[var(--text-muted)] font-medium flex items-center gap-2">
                    <span>{activeChannel.type === 'public_channel' ? 'Публичный канал' : 'Приватная группа'}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-bold text-emerald-500">
                      <Users className="w-3.5 h-3.5" />
                      {activeChannel.type === 'public_channel' ? `${staffList.length} уч.` : `${activeChannel.memberStaffIds?.length || 1} уч.`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Tools */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsAddMembersOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 rounded-xl text-xs font-bold transition cursor-pointer"
                  title="Добавить сотрудников в чат"
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">+ Участники</span>
                </button>

                <button 
                  onClick={startCall}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 transition shadow-sm cursor-pointer"
                  title="Начать звонок"
                >
                  <Video className="w-4 h-4" />
                  <span className="hidden sm:inline">Звонок</span>
                </button>
              </div>
            </div>

            {/* Messages Feed */}
            <MessageFeed 
              messages={messages}
              currentUserId={user?.uid}
              activeCallSessionId={activeChannel.activeCallSessionId}
              onJoinCall={() => alert('Комната группового звонка: ' + activeChannel.activeCallSessionId)}
              onToggleReaction={toggleReaction}
            />

            {/* Message Composer */}
            <MessageComposer 
              onSendMessage={sendMessage}
              onStartCall={startCall}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] font-medium">
            Выберите канал или свяжитесь с коллегой
          </div>
        )}
      </div>

      {/* Modal: Add Members to Current Channel */}
      {isAddMembersOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h3 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-500" />
                <span>Добавить сотрудников</span>
              </h3>
              <button onClick={() => setIsAddMembersOpen(false)} className="p-1 hover:bg-black/10 rounded text-slate-400">✕</button>
            </div>

            <form onSubmit={handleAddMembersSubmit} className="space-y-3">
              <p className="text-xs text-[var(--text-muted)]">Выберите коллег для приглашения в канал <b>#{activeChannel?.name}</b>:</p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl">
                {staffList.map(st => {
                  const isAlreadyMember = activeChannel?.memberStaffIds?.includes(st.id);
                  const isSelected = selectedAddStaffIds.includes(st.id);

                  return (
                    <div 
                      key={st.id}
                      onClick={() => !isAlreadyMember && toggleAddStaff(st.id)}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition ${
                        isAlreadyMember 
                          ? 'opacity-50 cursor-not-allowed bg-black/5 dark:bg-white/5' 
                          : isSelected 
                          ? 'bg-emerald-500/15 border border-emerald-500/30' 
                          : 'hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-[var(--text-main)]">{st.name}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">{st.role}</div>
                      </div>
                      {isAlreadyMember ? (
                        <span className="text-[10px] font-bold text-emerald-500">В чате</span>
                      ) : (
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'}`}>
                          {isSelected && '✓'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
                <button type="button" onClick={() => setIsAddMembersOpen(false)} className="px-3.5 py-1.5 rounded-xl border text-xs font-bold text-[var(--text-muted)]">Отмена</button>
                <button type="submit" className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition">Пригласить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
