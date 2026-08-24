import { useState, useEffect, useRef, useCallback } from 'react';
import { CallParticipant, SignalingMessage, MediaDeviceSettings } from '../types/webrtc';
import { webRtcSignalingService, ICE_SERVERS } from '../services/webrtcSignaling';

export function useWebRtcRoom(tenantId: string, roomId: string, currentUser: CallParticipant) {
  const [participants, setParticipants] = useState<Map<string, CallParticipant>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [deviceSettings, setDeviceSettings] = useState<MediaDeviceSettings>({
    isAudioMuted: false,
    isVideoMuted: false,
    isScreenSharing: false,
  });
  
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioContext = useRef<AudioContext | null>(null);
  const analyserNodes = useRef<Map<string, AnalyserNode>>(new Map());
  const speakerInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const initLocalStream = useCallback(async (video: boolean = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: video ? { width: 1280, height: 720 } : false 
      });
      setLocalStream(stream);
      streamRef.current = stream;
      
      setParticipants(prev => {
        const next = new Map(prev);
        next.set(currentUser.id, { ...currentUser, stream, connectionState: 'connected' });
        return next;
      });

      return stream;
    } catch (e) {
      console.error('Failed to get media devices', e);
      return null;
    }
  }, [currentUser]);

  const toggleScreenShare = async () => {
    try {
      if (deviceSettings.isScreenSharing) {
        // Stop screen share, revert to camera
        const newStream = await initLocalStream(true);
        if (newStream) {
          replaceVideoTrack(newStream);
          setDeviceSettings(s => ({ ...s, isScreenSharing: false }));
        }
      } else {
        // Start screen share
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        
        screenStream.getVideoTracks()[0].onended = async () => {
          const newStream = await initLocalStream(true);
          if (newStream) {
            replaceVideoTrack(newStream);
            setDeviceSettings(s => ({ ...s, isScreenSharing: false }));
          }
        };

        setLocalStream(screenStream);
        streamRef.current = screenStream;
        replaceVideoTrack(screenStream);
        setDeviceSettings(s => ({ ...s, isScreenSharing: true }));
        
        setParticipants(prev => {
          const next = new Map(prev);
          const p = next.get(currentUser.id);
          if (p) {
            next.set(currentUser.id, { ...p, stream: screenStream, isScreenSharing: true });
          }
          return next;
        });
      }
    } catch (e) {
      console.error('Screen sharing error', e);
    }
  };

  const replaceVideoTrack = (newStream: MediaStream) => {
    const newVideoTrack = newStream.getVideoTracks()[0];
    if (!newVideoTrack) return;
    
    peerConnections.current.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(newVideoTrack).catch(console.error);
      }
    });
  };

  const createPeerConnection = (peerId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current.set(peerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        webRtcSignalingService.sendSignal(tenantId, roomId, {
          type: 'ice-candidate',
          fromUserId: currentUser.id,
          toUserId: peerId,
          payload: event.candidate.toJSON()
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      setParticipants(prev => {
        const next = new Map(prev);
        const p = next.get(peerId);
        if (p) {
          next.set(peerId, { ...p, stream });
        }
        return next;
      });
      setupActiveSpeakerDetection(peerId, stream);
    };

    pc.onconnectionstatechange = () => {
      setParticipants(prev => {
        const next = new Map(prev);
        const p = next.get(peerId);
        if (p) {
          const stateMap: Record<string, any> = {
            'new': 'connecting',
            'connecting': 'connecting',
            'connected': 'connected',
            'disconnected': 'disconnected',
            'failed': 'failed',
            'closed': 'disconnected'
          };
          next.set(peerId, { ...p, connectionState: stateMap[pc.connectionState] || 'disconnected' });
        }
        return next;
      });
    };

    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    return pc;
  };

  const setupActiveSpeakerDetection = (peerId: string, stream: MediaStream) => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    try {
      const source = audioContext.current.createMediaStreamSource(stream);
      const analyser = audioContext.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserNodes.current.set(peerId, analyser);
    } catch (e) {
      console.error('AudioContext setup failed', e);
    }
  };

  const handleOffer = async (signal: SignalingMessage) => {
    const pc = createPeerConnection(signal.fromUserId);
    await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    webRtcSignalingService.sendSignal(tenantId, roomId, {
      type: 'answer',
      fromUserId: currentUser.id,
      toUserId: signal.fromUserId,
      payload: answer
    });
  };

  const handleAnswer = async (signal: SignalingMessage) => {
    const pc = peerConnections.current.get(signal.fromUserId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
    }
  };

  const handleIceCandidate = async (signal: SignalingMessage) => {
    const pc = peerConnections.current.get(signal.fromUserId);
    if (pc && pc.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(signal.payload as RTCIceCandidateInit));
    }
  };

  useEffect(() => {
    let unmounted = false;
    
    const init = async () => {
      await webRtcSignalingService.createOrJoinRoom(tenantId, roomId, { ...currentUser, connectionState: 'connecting' });
      await initLocalStream(true);
      if (unmounted) return;

      const unsubSignals = webRtcSignalingService.subscribeToIncomingSignals(tenantId, roomId, currentUser.id, (signal) => {
        if (signal.type === 'offer') handleOffer(signal);
        else if (signal.type === 'answer') handleAnswer(signal);
        else if (signal.type === 'ice-candidate') handleIceCandidate(signal);
      });

      const unsubParticipants = webRtcSignalingService.subscribeToParticipants(tenantId, roomId, (dbParticipants) => {
        setParticipants(prev => {
          const next = new Map(prev);
          dbParticipants.forEach(p => {
            if (p.id !== currentUser.id) {
              const existing = next.get(p.id);
              if (!existing) {
                // New participant, initiate offer
                next.set(p.id, { ...p, connectionState: 'connecting' });
                const pc = createPeerConnection(p.id);
                pc.createOffer().then(offer => {
                  pc.setLocalDescription(offer);
                  webRtcSignalingService.sendSignal(tenantId, roomId, {
                    type: 'offer',
                    fromUserId: currentUser.id,
                    toUserId: p.id,
                    payload: offer
                  });
                });
              } else {
                next.set(p.id, { ...existing, ...p, stream: existing.stream });
              }
            }
          });
          return next;
        });
      });

      // Active Speaker polling
      speakerInterval.current = setInterval(() => {
        if (!audioContext.current) return;
        const dataArray = new Uint8Array(128);
        
        setParticipants(prev => {
          let changed = false;
          const next = new Map(prev);
          
          analyserNodes.current.forEach((analyser, peerId) => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const average = sum / dataArray.length;
            const isSpeaking = average > 15; // Threshold
            
            const p = next.get(peerId);
            if (p && p.isSpeaking !== isSpeaking) {
              next.set(peerId, { ...p, isSpeaking });
              changed = true;
            }
          });
          
          return changed ? next : prev;
        });
      }, 500);

      // Cleanup
      return () => {
        unmounted = true;
        unsubSignals();
        unsubParticipants();
      };
    };

    const cleanupFn = init();

    return () => {
      cleanupFn.then(fn => fn && fn());
      if (speakerInterval.current) clearInterval(speakerInterval.current);
      if (audioContext.current) audioContext.current.close();
      peerConnections.current.forEach(pc => pc.close());
      streamRef.current?.getTracks().forEach(t => t.stop());
      webRtcSignalingService.cleanupSignals(tenantId, roomId, currentUser.id);
    };
  }, []);

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setDeviceSettings(s => ({ ...s, isAudioMuted: !audioTrack.enabled }));
        webRtcSignalingService.updateParticipantInfo(tenantId, roomId, currentUser.id, { isSpeaking: false });
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setDeviceSettings(s => ({ ...s, isVideoMuted: !videoTrack.enabled }));
      }
    }
  };

  const toggleHand = () => {
    const isHandRaised = !currentUser.isHandRaised;
    webRtcSignalingService.updateParticipantInfo(tenantId, roomId, currentUser.id, { isHandRaised });
    setParticipants(prev => {
      const next = new Map(prev);
      const p = next.get(currentUser.id);
      if (p) next.set(currentUser.id, { ...p, isHandRaised });
      return next;
    });
  };

  return {
    participants: Array.from(participants.values()),
    deviceSettings,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    toggleHand,
  };
}
