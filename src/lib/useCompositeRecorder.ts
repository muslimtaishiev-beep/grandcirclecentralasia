import { useState, useRef, useEffect, useCallback } from 'react';

const MAX_RECORDING_TIME_MS = 90 * 60 * 1000; // 90 minutes

/**
 * Hook to record a Canvas stream (optionally composited with audio).
 * The resulting blob is uploaded to Firebase Storage for the manager — it is
 * never handed to the student.
 * 
 * @param canvasRef - Reference to the HTMLCanvasElement to record
 */
export function useCompositeRecorder(canvasRef: React.RefObject<HTMLCanvasElement | null>): {
  isRecording: boolean;
  recordingDuration: number;
  startRecording: (audioStream?: MediaStream) => void;
  stopRecording: () => Promise<Blob | null>;
  downloadRecording: (filename?: string) => void;
} {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<number | ReturnType<typeof setInterval> | null>(null);
  const maxTimeTimeoutRef = useRef<number | ReturnType<typeof setTimeout> | null>(null);
  const finalBlobRef = useRef<Blob | null>(null);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(finalBlobRef.current);
        return;
      }

      const recorder = mediaRecorderRef.current;
      
      // Cleanup timers
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      if (maxTimeTimeoutRef.current) {
        clearTimeout(maxTimeTimeoutRef.current);
        maxTimeTimeoutRef.current = null;
      }

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        finalBlobRef.current = blob;
        
        // Memory safety: clear chunks after creating blob
        chunksRef.current = [];
        setIsRecording(false);
        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  const downloadRecording = useCallback((filename?: string) => {
    if (!finalBlobRef.current) {
      console.warn('No recording available to download.');
      return;
    }
    
    const url = URL.createObjectURL(finalBlobRef.current);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    
    const shortId = Math.random().toString(36).substring(2, 8);
    const timestamp = Date.now();
    // Use .mp4 if the blob's MIME type contains mp4, else default to .webm
    const extension = finalBlobRef.current.type.includes('mp4') ? 'mp4' : 'webm';
    const defaultFilename = `proctoring_${shortId}_${timestamp}.${extension}`;
    
    a.download = filename || defaultFilename;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  }, []);

  const startRecording = useCallback((audioStream?: MediaStream) => {
    if (!canvasRef.current) {
      console.error('Canvas ref is not attached.');
      return;
    }
    
    // Reset state and previous recordings
    chunksRef.current = [];
    finalBlobRef.current = null;
    setRecordingDuration(0);
    
    try {
      // Get canvas stream at 30fps
      const canvas = canvasRef.current as HTMLCanvasElement & { captureStream(fps?: number): MediaStream };
      const canvasStream = canvas.captureStream(30);
      
      // Composite stream
      const tracks = [...canvasStream.getTracks()];
      if (audioStream) {
        tracks.push(...audioStream.getAudioTracks());
      }
      const stream = new MediaStream(tracks);

      // Codec auto-detection
      const candidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/mp4;codecs=avc1,mp4a.40.2'
      ];
      
      let options: MediaRecorderOptions = {};
      for (const codec of candidates) {
        if (MediaRecorder.isTypeSupported(codec)) {
          options = { mimeType: codec };
          break;
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      // Start recording, harvesting data every 1 second
      mediaRecorder.start(1000);
      setIsRecording(true);

      // Track duration
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // 90 minute auto-stop. Deliberately does NOT download: handing the
      // student a copy of their own proctoring footage defeats the point of
      // recording it, and on the exam page a surprise file download mid-test
      // is alarming. The blob stays in memory for the uploader.
      maxTimeTimeoutRef.current = setTimeout(() => {
        void stopRecording();
      }, MAX_RECORDING_TIME_MS);
      
    } catch (err) {
      console.error('Failed to start composite recording:', err);
    }
  }, [canvasRef, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (maxTimeTimeoutRef.current) {
        clearTimeout(maxTimeTimeoutRef.current);
      }
    };
  }, []);

  return {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    downloadRecording
  };
}
