import React from 'react';
import { Video, Users } from 'lucide-react';

interface Props {
  sessionId: string;
  onJoin: () => void;
}

export default function InChatCallBanner({ sessionId, onJoin }: Props) {
  return (
    <div className="bg-indigo-600 text-white p-3 flex items-center justify-between shadow-md shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
          <Video className="w-5 h-5" />
        </div>
        <div>
          <div className="font-bold flex items-center gap-2">
            Идет групповой видеозвонок
            <span className="flex items-center gap-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">
              <Users className="w-3 h-3" /> 3
            </span>
          </div>
          <div className="text-xs text-indigo-200">Присоединяйтесь к обсуждению</div>
        </div>
      </div>
      <button 
        onClick={onJoin}
        className="px-4 py-2 bg-white text-indigo-600 font-bold rounded-xl shadow-sm hover:bg-indigo-50 transition"
      >
        Присоединиться
      </button>
    </div>
  );
}
