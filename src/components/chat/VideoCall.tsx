import { useEffect, useState } from 'react';
import { PhoneOff, Video } from 'lucide-react';

interface VideoCallProps {
  channelName: string;
  /** Организация и канал: из них строится имя комнаты, название канала не участвует. */
  tenantId: string;
  channelId: string;
  userName: string;
  /** Выйти из звонка самому. */
  onClose: () => void;
  /** Завершить звонок для всех (снять отметку «идёт звонок» в канале). */
  onEndForAll?: () => void;
}

/**
 * Комната Jitsi — хэш организации и канала. id канала случайный (Firestore),
 * поэтому имя не угадать по названию и не пересечь с другой организацией.
 */
async function callRoomName(tenantId: string, channelId: string): Promise<string> {
  const data = new TextEncoder().encode(`studyfree-call:${tenantId}:${channelId}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return `sf-${hex.slice(0, 40)}`;
}

/** Групповой звонок: микрофон, камера и экран — внутри комнаты Jitsi. */
export default function VideoCall({ channelName, tenantId, channelId, userName, onClose, onEndForAll }: VideoCallProps) {
  const [roomSlug, setRoomSlug] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setRoomSlug(null);
    callRoomName(tenantId, channelId).then(r => { if (alive) setRoomSlug(r); }).catch(() => { if (alive) setRoomSlug(null); });
    return () => { alive = false; };
  }, [tenantId, channelId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col p-3 sm:p-5 gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-white font-semibold text-sm sm:text-base flex items-center gap-2 min-w-0">
          <Video className="w-5 h-5 shrink-0" />
          <span className="truncate">{channelName}</span>
        </h2>
        <div className="flex items-center gap-2 shrink-0">
          {onEndForAll && (
            <button onClick={onEndForAll} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold">
              Завершить для всех
            </button>
          )}
          <button onClick={onClose} className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5">
            <PhoneOff className="w-4 h-4" /> Выйти
          </button>
        </div>
      </div>
      <div className="flex-1 rounded-2xl overflow-hidden border border-white/10 bg-slate-900 flex items-center justify-center">
        {!roomSlug ? <div className="text-white/60 text-sm">Подключение…</div> : (
          <iframe
            src={`https://meet.jit.si/${roomSlug}#userInfo.displayName="${encodeURIComponent(userName)}"&config.prejoinPageEnabled=false`}
            className="w-full h-full border-0"
            allow="camera; microphone; display-capture; autoplay; clipboard-write; fullscreen"
            title="Видеозвонок"
          />
        )}
      </div>
    </div>
  );
}
