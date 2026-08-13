import { useState, useEffect, useRef, useCallback, RefObject } from 'react';
import { FilesetResolver, FaceLandmarker, HandLandmarker } from '@mediapipe/tasks-vision';

export interface ProctoringTelemetry {
  headPose: { pitch: number; yaw: number; roll: number };
  gazeDirection: 'CENTER' | 'LEFT' | 'RIGHT' | 'DOWN';
  gazeRatio: number;
  handsDetected: number;
  handStatus: 'IN_FRAME' | 'BELOW_DESK' | 'NO_HANDS';
  facesDetected: number;
  lightAnomaly: boolean;
  isViolating: boolean;
  isDraftWork: boolean;
  fps: number;
}

export interface ProctoringEvent {
  id: string;
  timestamp: number;
  type: 'GAZE_LEFT' | 'GAZE_RIGHT' | 'EXTRA_FACE' | 'HAND_BELOW' | 'SWIPE' | 'LIGHT_ANOMALY' | 'FAST_ANSWER' | 'PASTE_DETECTED' | 'TAB_SWITCH' | 'FACE_LOST';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

export function useProctoringEngine(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  isActive: boolean
) {
  const [telemetry, setTelemetry] = useState<ProctoringTelemetry>({
    headPose: { pitch: 0, yaw: 0, roll: 0 },
    gazeDirection: 'CENTER',
    gazeRatio: 0,
    handsDetected: 0,
    handStatus: 'NO_HANDS',
    facesDetected: 0,
    lightAnomaly: false,
    isViolating: false,
    isDraftWork: false,
    fps: 0,
  });

  const [events, setEvents] = useState<ProctoringEvent[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState('Initializing models...');
  const [error, setError] = useState<string | null>(null);
  const [honestyIndex, setHonestyIndex] = useState(100);
  const sessionStartTime = useRef(Date.now()).current;

  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);

  // Throttling refs
  const lastFaceProcessTime = useRef(0);
  const lastHandProcessTime = useRef(0);
  const fpsFrameCount = useRef(0);
  const lastFpsTime = useRef(0);

  // Continuous anomaly tracking refs
  const gazeViolationStart = useRef<number | null>(null);
  const handBelowStart = useRef<number | null>(null);
  const lightAnomalyStart = useRef<number | null>(null);
  const faceLostStart = useRef<number | null>(null);
  
  // Hand tracking for swipe
  const previousWristX = useRef<number | null>(null);
  const lastWristTime = useRef<number>(0);
  const faceLandmarksRef = useRef<any[][] | null>(null);

  const addEvent = useCallback((eventInit: Omit<ProctoringEvent, 'id' | 'timestamp'>) => {
    const newEvent: ProctoringEvent = {
      ...eventInit,
      id: crypto.randomUUID(),
      timestamp: Date.now() - sessionStartTime,
    };
    
    setEvents(prev => [...prev, newEvent]);
    
    // Update honesty index
    setHonestyIndex(prev => {
      let deduction = 0;
      if (newEvent.severity === 'HIGH') deduction = 8;
      else if (newEvent.severity === 'MEDIUM') deduction = 4;
      else if (newEvent.severity === 'LOW') deduction = 2;
      return Math.max(0, prev - deduction);
    });
  }, [sessionStartTime]);

  useEffect(() => {
    let active = true;

    async function initModels() {
      try {
        setIsLoading(true);
        setLoadingProgress('Loading WebAssembly...');
        
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        setLoadingProgress('Loading Face Model...');
        try {
          faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
              delegate: 'GPU'
            },
            numFaces: 2,
            outputFacialTransformationMatrixes: true,
            outputFaceBlendshapes: false,
            runningMode: 'VIDEO'
          });
        } catch (e) {
          // Fallback to CPU
          faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
              delegate: 'CPU'
            },
            numFaces: 2,
            outputFacialTransformationMatrixes: true,
            outputFaceBlendshapes: false,
            runningMode: 'VIDEO'
          });
        }

        setLoadingProgress('Loading Hand Model...');
        try {
          handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
              delegate: 'GPU'
            },
            numHands: 2,
            runningMode: 'VIDEO'
          });
        } catch (e) {
          handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
              delegate: 'CPU'
            },
            numHands: 2,
            runningMode: 'VIDEO'
          });
        }

        if (active) {
          setIsReady(true);
          setIsLoading(false);
          setLoadingProgress('Ready');
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Failed to initialize models');
          setIsLoading(false);
        }
      }
    }

    initModels();

    return () => {
      active = false;
      if (faceLandmarkerRef.current) faceLandmarkerRef.current.close();
      if (handLandmarkerRef.current) handLandmarkerRef.current.close();
    };
  }, []);

  const calculateDistance = (p1: { x: number, y: number }, p2: { x: number, y: number }) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  };

  const processFrame = useCallback(() => {
    if (!isActive || !isReady || !videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth === 0) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const now = performance.now();
    
    // FPS calculation
    fpsFrameCount.current++;
    if (now - lastFpsTime.current >= 1000) {
      setTelemetry(prev => ({ ...prev, fps: fpsFrameCount.current }));
      fpsFrameCount.current = 0;
      lastFpsTime.current = now;
    }

    let currentTelemetry: Partial<ProctoringTelemetry> = {};
    let isViolating = false;

    // -- FACE PROCESSING (~15 FPS / every ~66ms) --
    if (now - lastFaceProcessTime.current >= 66 && faceLandmarkerRef.current) {
      const faceResult = faceLandmarkerRef.current.detectForVideo(video, now);
      lastFaceProcessTime.current = now;

      const facesDetected = faceResult.faceLandmarks.length;
      currentTelemetry.facesDetected = facesDetected;
      faceLandmarksRef.current = faceResult.faceLandmarks;

      if (facesDetected > 1) {
        addEvent({ type: 'EXTRA_FACE', severity: 'HIGH', description: 'Multiple faces detected in frame.' });
        isViolating = true;
      } else if (facesDetected === 0) {
        if (!faceLostStart.current) faceLostStart.current = now;
        else if (now - faceLostStart.current > 2000) {
          addEvent({ type: 'FACE_LOST', severity: 'HIGH', description: 'Face not detected for over 2 seconds.' });
          faceLostStart.current = null;
          isViolating = true;
        }
      } else {
        faceLostStart.current = null;
        
        // Single face analysis
        const landmarks = faceResult.faceLandmarks[0];
        const matrices = faceResult.facialTransformationMatrixes?.[0];

        // 1. Head Pose
        if (matrices) {
          const m = matrices.data;
          const pitch = Math.atan2(m[9], m[10]) * (180 / Math.PI);
          const yaw = Math.atan2(-m[8], Math.sqrt(m[9] * m[9] + m[10] * m[10])) * (180 / Math.PI);
          const roll = Math.atan2(m[4], m[0]) * (180 / Math.PI);
          
          currentTelemetry.headPose = { pitch, yaw, roll };

          // Draft work detection
          currentTelemetry.isDraftWork = pitch >= -40 && pitch <= -15;

          // Gaze violation checking (yaw > 25 or yaw < -25)
          if (Math.abs(yaw) > 25) {
            if (!gazeViolationStart.current) gazeViolationStart.current = now;
            else if (now - gazeViolationStart.current > 3000) {
              const direction = yaw > 25 ? 'GAZE_LEFT' : 'GAZE_RIGHT';
              addEvent({ type: direction, severity: 'MEDIUM', description: `Sustained gaze deviation (${direction}).` });
              gazeViolationStart.current = null;
              isViolating = true;
            }
          } else {
            gazeViolationStart.current = null;
          }
        }

        // 2. Gaze Direction (Iris ratio)
        const leftIris = landmarks[468];
        const leftOuter = landmarks[33];
        const leftInner = landmarks[133];
        const leftTop = landmarks[159];
        const leftBottom = landmarks[145];

        if (leftIris && leftOuter && leftInner) {
          const irisToOuter = calculateDistance(leftIris, leftOuter);
          const outerToInner = calculateDistance(leftOuter, leftInner);
          const ratio = irisToOuter / outerToInner;
          currentTelemetry.gazeRatio = ratio;

          let gazeDir: ProctoringTelemetry['gazeDirection'] = 'CENTER';
          if (ratio < 0.38) gazeDir = 'LEFT';
          else if (ratio > 0.62) gazeDir = 'RIGHT';

          const eyeHeight = leftBottom.y - leftTop.y;
          if (leftIris.y > leftTop.y + eyeHeight * 0.65) {
            gazeDir = 'DOWN';
          }

          currentTelemetry.gazeDirection = gazeDir;
        }

        // 3. Light Anomaly Detection (using Canvas)
        const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          // Draw video frame to canvas to read pixels
          ctx.drawImage(video, 0, 0, canvasRef.current.width, canvasRef.current.height);
          
          // Find face bounding box
          let minX = 1, minY = 1, maxX = 0, maxY = 0;
          for (const l of landmarks) {
            if (l.x < minX) minX = l.x;
            if (l.y < minY) minY = l.y;
            if (l.x > maxX) maxX = l.x;
            if (l.y > maxY) maxY = l.y;
          }

          const boxWidth = maxX - minX;
          const boxHeight = maxY - minY;
          const cw = canvasRef.current.width;
          const ch = canvasRef.current.height;

          // Sample top 1/3 and bottom 1/3
          const sx = Math.floor(minX * cw);
          const topY = Math.floor(minY * ch);
          const w = Math.floor(boxWidth * cw);
          const h3 = Math.floor((boxHeight / 3) * ch);
          const bottomY = Math.floor((maxY - boxHeight / 3) * ch);

          if (w > 0 && h3 > 0 && sx >= 0 && topY >= 0 && bottomY >= 0) {
            try {
              const topData = ctx.getImageData(sx, topY, w, h3).data;
              const bottomData = ctx.getImageData(sx, bottomY, w, h3).data;
              
              let topSum = 0;
              for (let i = 0; i < topData.length; i += 4) {
                // Luminance
                topSum += 0.299 * topData[i] + 0.587 * topData[i+1] + 0.114 * topData[i+2];
              }
              
              let bottomSum = 0;
              for (let i = 0; i < bottomData.length; i += 4) {
                bottomSum += 0.299 * bottomData[i] + 0.587 * bottomData[i+1] + 0.114 * bottomData[i+2];
              }
              
              const topAvg = topSum / (w * h3);
              const bottomAvg = bottomSum / (w * h3);

              if (bottomAvg > topAvg * 1.35) {
                currentTelemetry.lightAnomaly = true;
                if (!lightAnomalyStart.current) lightAnomalyStart.current = now;
                else if (now - lightAnomalyStart.current > 2000) {
                  addEvent({ type: 'LIGHT_ANOMALY', severity: 'HIGH', description: 'Suspicious lighting condition detected (possible secondary screen).' });
                  lightAnomalyStart.current = null;
                }
              } else {
                currentTelemetry.lightAnomaly = false;
                lightAnomalyStart.current = null;
              }
            } catch (e) {
              // Ignore canvas out of bounds
            }
          }
        }
      }
    }

    // -- HAND PROCESSING (~3-5 FPS / every ~250ms) --
    if (now - lastHandProcessTime.current >= 250 && handLandmarkerRef.current) {
      const handResult = handLandmarkerRef.current.detectForVideo(video, now);
      lastHandProcessTime.current = now;

      const handsCount = handResult.handLandmarks.length;
      currentTelemetry.handsDetected = handsCount;

      if (handsCount === 0) {
        currentTelemetry.handStatus = 'NO_HANDS';
        handBelowStart.current = null;
        previousWristX.current = null;
      } else {
        let isBelow = false;
        
        for (const landmarks of handResult.handLandmarks) {
          const wrist = landmarks[0]; // Landmark 0 is wrist
          
          if (wrist.y > 0.85) {
            isBelow = true;
          }

          // Swipe detection
          if (previousWristX.current !== null) {
            const dt = now - lastWristTime.current;
            if (dt > 0 && dt <= 300) {
              const dx = Math.abs(wrist.x - previousWristX.current);
              if (dx > 0.25) {
                addEvent({ type: 'SWIPE', severity: 'HIGH', description: 'Fast swipe gesture detected.' });
                previousWristX.current = null; // reset
              }
            }
          }
          previousWristX.current = wrist.x;
          lastWristTime.current = now;
        }

        if (isBelow) {
          currentTelemetry.handStatus = 'BELOW_DESK';
          if (!handBelowStart.current) handBelowStart.current = now;
          else if (now - handBelowStart.current > 2000) {
            addEvent({ type: 'HAND_BELOW', severity: 'MEDIUM', description: 'Hand detected below desk level.' });
            handBelowStart.current = null;
            isViolating = true;
          }
        } else {
          currentTelemetry.handStatus = 'IN_FRAME';
          handBelowStart.current = null;
        }
      }
    }

    currentTelemetry.isViolating = isViolating || telemetry.isViolating;

    // Batch update state
    if (Object.keys(currentTelemetry).length > 0) {
      setTelemetry(prev => ({ ...prev, ...currentTelemetry }));
    }

    requestRef.current = requestAnimationFrame(processFrame);
  }, [isActive, isReady, videoRef, canvasRef, telemetry.isViolating, addEvent]);

  // Handle Tab Switch
  useEffect(() => {
    if (!isActive) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        addEvent({ type: 'TAB_SWITCH', severity: 'HIGH', description: 'User switched away from the active tab.' });
      }
    };

    const handleBlur = () => {
      addEvent({ type: 'TAB_SWITCH', severity: 'HIGH', description: 'Window lost focus.' });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isActive, addEvent]);

  useEffect(() => {
    if (isActive && isReady) {
      requestRef.current = requestAnimationFrame(processFrame);
    } else {
      cancelAnimationFrame(requestRef.current);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isActive, isReady, processFrame]);

  return {
    telemetry,
    events,
    isReady,
    isLoading,
    loadingProgress,
    error,
    addEvent,
    sessionStartTime,
    honestyIndex,
    faceLandmarks: faceLandmarksRef.current
  };
}
