import { Video } from 'lucide-react';

interface Props {
  onJoin: () => void;
  onEnd?: () => void;
}

export default function InChatCallBanner({ onJoin, onEnd }: Props) {
  return (
    <div className="bg-indigo-600 text-white px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <Video className="w-5 h-5 shrink-0" />
        <span className="font-semibold text-sm truncate">Идёт звонок</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onEnd && <button onClick={onEnd} className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold">Завершить</button>}
        <button onClick={onJoin} className="px-3 py-1.5 bg-white text-indigo-700 text-xs font-semibold rounded-lg hover:bg-indigo-50">Присоединиться</button>
      </div>
    </div>
  );
}
