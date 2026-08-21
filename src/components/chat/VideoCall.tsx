import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, Maximize2, Users, Radio, Sparkles } from 'lucide-react';

interface VideoCallProps {
  channelName: string;
  userName: string;
  onClose: () => void;
}

export default function VideoCall({ channelName, userName, onClose }: VideoCallProps) {
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [callMode, setCallMode] = useState<'p2p' | 'conference'>('p2p');
  const [stream, setStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    if (callMode === 'p2p') {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then((s) => {
          activeStream = s;
          setStream(s);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = s;
          }
        })
        .catch((err) => {
          console.warn('Camera access denied or unavailable:', err);
          setVideoOn(false);
        });
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [callMode]);

  // Toggle Mic
  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !micOn;
      });
    }
    setMicOn(!micOn);
  };

  // Toggle Video
  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !videoOn;
      });
    }
    setVideoOn(!videoOn);
  };

  // Toggle Screen Share
  const toggleScreenShare = async () => {
    if (screenSharing) {
      setScreenSharing(false);
      // Revert to camera
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(s);
      if (localVideoRef.current) localVideoRef.current.srcObject = s;
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setStream(screenStream);
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
        setScreenSharing(true);
      } catch (err) {
        console.warn('Screen share cancelled:', err);
      }
    }
  };

  const roomSlug = `GrandCircle-${channelName.replace(/[^a-zA-Z0-9]/g, '') || 'Room'}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col justify-between p-4 sm:p-6 animate-fade-in">
      
      {/* Header */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-blue-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-white font-bold text-base flex items-center gap-2">
              Видеозвонок: #{channelName}
              <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-medium">
                LIVE HD
              </span>
            </h2>
            <p className="text-xs text-white/60">Участники: {userName} (Вы) + Команда</p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/10 text-xs">
          <button
            onClick={() => setCallMode('p2p')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${callMode === 'p2p' ? 'bg-blue-600 text-white font-bold' : 'text-white/70 hover:text-white'}`}
          >
            P2P Камера
          </button>
          <button
            onClick={() => setCallMode('conference')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1 ${callMode === 'conference' ? 'bg-blue-600 text-white font-bold' : 'text-white/70 hover:text-white'}`}
          >
            <Users className="w-3.5 h-3.5" /> Групповой Jitsi
          </button>
        </div>
      </div>

      {/* Main Stream Area */}
      <div className="flex-1 my-4 relative rounded-2xl overflow-hidden border border-white/10 bg-slate-900 flex items-center justify-center">
        
        {callMode === 'conference' ? (
          <iframe
            src={`https://meet.jit.si/${roomSlug}#userInfo.displayName="${encodeURIComponent(userName)}"`}
            className="w-full h-full border-0 rounded-2xl"
            allow="camera; microphone; display-capture; autoplay; clipboard-write; self; fullscreen"
            title="Group Video Call"
          />
        ) : (
          <>
            {videoOn ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover rounded-2xl"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-white/40">
                <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold text-white mb-2">
                  {userName[0]?.toUpperCase()}
                </div>
                <span className="text-sm font-medium">Камера отключена</span>
              </div>
            )}

            {/* Overlays */}
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>{screenSharing ? 'Демонстрация экрана' : userName}</span>
            </div>
          </>
        )}
      </div>

      {/* Control Bar */}
      <div className="flex items-center justify-center gap-3 z-10 py-2">
        <button
          onClick={toggleMic}
          className={`p-4 rounded-2xl border transition ${
            micOn
              ? 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
              : 'bg-red-600/80 hover:bg-red-600 border-red-500 text-white'
          }`}
          title={micOn ? 'Отключить микрофон' : 'Включить микрофон'}
        >
          {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleVideo}
          className={`p-4 rounded-2xl border transition ${
            videoOn
              ? 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
              : 'bg-red-600/80 hover:bg-red-600 border-red-500 text-white'
          }`}
          title={videoOn ? 'Отключить камеру' : 'Включить камеру'}
        >
          {videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {callMode === 'p2p' && (
          <button
            onClick={toggleScreenShare}
            className={`p-4 rounded-2xl border transition ${
              screenSharing
                ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-500 text-white'
                : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
            }`}
            title="Поделиться экраном"
          >
            <Monitor className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={onClose}
          className="p-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white border border-red-500 shadow-lg hover:shadow-red-600/50 transition cursor-pointer"
          title="Завершить звонок"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

    </div>
  );
}
