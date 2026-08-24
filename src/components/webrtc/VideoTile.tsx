import React, { useEffect, useRef } from 'react';
import { CallParticipant } from '../../types/webrtc';
import { MicOff, Hand } from 'lucide-react';

interface Props {
  participant: CallParticipant;
  isMainPanel?: boolean;
}

export default function VideoTile({ participant, isMainPanel = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  return (
    <div 
      className={`relative rounded-2xl overflow-hidden bg-slate-900 shadow-xl transition-all duration-300 ${
        participant.isSpeaking ? 'ring-2 ring-emerald-400' : 'ring-1 ring-slate-800'
      } ${isMainPanel ? 'w-full h-full' : 'w-full h-full'}`}
    >
      {participant.stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.id === 'local'} // Usually local streams shouldn't echo, but stream is handled by PC
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800">
          {participant.avatarUrl ? (
            <img src={participant.avatarUrl} alt={participant.name} className="w-24 h-24 rounded-full shadow-lg" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center text-3xl font-bold text-slate-300">
              {participant.name.charAt(0)}
            </div>
          )}
        </div>
      )}

      {/* Overlays */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-white font-medium text-sm shadow-sm">
          <span>{participant.name}</span>
          {participant.role && <span className="text-emerald-400 text-xs">({participant.role})</span>}
        </div>
        
        <div className="flex items-center gap-2">
          {participant.isHandRaised && (
            <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-white shadow-lg animate-bounce">
              <Hand className="w-4 h-4" />
            </div>
          )}
          {participant.stream?.getAudioTracks()[0]?.enabled === false && (
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg">
              <MicOff className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
