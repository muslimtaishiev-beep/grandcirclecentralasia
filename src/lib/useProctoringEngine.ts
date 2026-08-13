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

// Dedicated offscreen canvas for light anomaly sampling
let _lightCanvas: HTMLCanvasElement | null = null;
let _lightCtx: CanvasRenderingContext2D | null = null;
function getLightCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (!_lightCanvas) {
    _lightCanvas = document.createElement('canvas');
    _lightCanvas.width = 160;
    _lightCanvas.height = 120;
    _lightCtx = _lightCanvas.getContext('2d', { willReadFrequently: true });
  }
  return _lightCtx ? { canvas: _lightCanvas, ctx: _lightCtx } : null;
}

export function useProctoringEngine(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  isActive: boolean
) {
  const [telemetry, setTelemetry] = useState<ProctoringTelemetry>({
    headPose: { pitch: 0, yaw: 0, roll: 0 },
    gazeDirection: 'CENTER',
    gazeRatio: 0.5,
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
  const [loadingProgress, setLoadingProgress] = useState('Initializing ML models...');
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

  // Anomaly duration tracking
  const gazeViolationStart = useRef<number | null>(null);
  const handBelowStart = useRef<number | null>(null);
  const lightAnomalyStart = useRef<number | null>(null);
  const faceLostStart = useRef<number | null>(null);
  
  // Cooldown refs (prevent event spam)
  const lastExtraFaceEvent = useRef<number>(0);
  const lastFaceLostEvent = useRef<number>(0);
  const lastGazeEvent = useRef<number>(0);
  const lastHandBelowEvent = useRef<number>(0);
  const lastSwipeEvent = useRef<number>(0);
  const lastLightEvent = useRef<number>(0);
  const EVENT_COOLDOWN = 3000; // 3 seconds between duplicate event logs

  // Hand tracking
  const previousWristX = useRef<number | null>(null);
  const lastWristTime = useRef<number>(0);
  
  // Face landmarks for canvas overlay
  const faceLandmarksRef = useRef<any[][] | null>(null);

  const addEvent = useCallback((eventInit: Omit<ProctoringEvent, 'id' | 'timestamp'>) => {
    const newEvent: ProctoringEvent = {
      ...eventInit,
      id: crypto.randomUUID(),
      timestamp: Date.now() - sessionStartTime,
    };
    
    setEvents(prev => [...prev, newEvent]);
    
    setHonestyIndex(prev => {
      let deduction = 0;
      if (newEvent.severity === 'HIGH') deduction = 8;
      else if (newEvent.severity === 'MEDIUM') deduction = 4;
      else if (newEvent.severity === 'LOW') deduction = 2;
      return Math.max(0, prev - deduction);
    });
  }, [sessionStartTime]);

  const addEventRef = useRef(addEvent);
  addEventRef.current = addEvent;

  // Initialize MediaPipe Models
  useEffect(() => {
    let active = true;

    async function initModels() {
      try {
        setIsLoading(true);
        setLoadingProgress('Загрузка движка WebAssembly...');
        
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        setLoadingProgress('Загрузка нейросети лица (Face Mesh)...');
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
          console.warn('GPU fallback to CPU for face landmarker:', e);
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

        setLoadingProgress('Загрузка нейросети рук (Hand Tracking)...');
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
          console.warn('GPU fallback to CPU for hand landmarker:', e);
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
          setLoadingProgress('Модели готовы');
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || ' Ошибка инициализации ML-моделей');
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

  // Processing loop - completely ref-based with zero re-render triggers in requestAnimationFrame
  const processFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const now = performance.now();
    
    // FPS counter
    fpsFrameCount.current++;
    let currentFps: number | undefined;
    if (now - lastFpsTime.current >= 1000) {
      currentFps = fpsFrameCount.current;
      fpsFrameCount.current = 0;
      lastFpsTime.current = now;
    }

    const updates: Partial<ProctoringTelemetry> = {};
    let isViolatingThisFrame = false;

    // ── 1. FACE PROCESSING (~20 FPS / every ~50ms) ──
    if (now - lastFaceProcessTime.current >= 50 && faceLandmarkerRef.current) {
      try {
        const faceResult = faceLandmarkerRef.current.detectForVideo(video, now);
        lastFaceProcessTime.current = now;

        const facesDetected = faceResult.faceLandmarks.length;
        updates.facesDetected = facesDetected;
        faceLandmarksRef.current = faceResult.faceLandmarks;

        if (facesDetected > 1) {
          // Multiple faces
          if (now - lastExtraFaceEvent.current > EVENT_COOLDOWN) {
            addEventRef.current({
              type: 'EXTRA_FACE',
              severity: 'HIGH',
              description: `Обнаружено ${facesDetected} лица в кадре!`
            });
            lastExtraFaceEvent.current = now;
          }
          isViolatingThisFrame = true;
        } else if (facesDetected === 0) {
          // Face lost
          if (!faceLostStart.current) faceLostStart.current = now;
          else if (now - faceLostStart.current > 1500) {
            if (now - lastFaceLostEvent.current > EVENT_COOLDOWN) {
              addEventRef.current({
                type: 'FACE_LOST',
                severity: 'HIGH',
                description: 'Ученик покинул кадр (лицо не обнаружено > 1.5с).'
              });
              lastFaceLostEvent.current = now;
            }
            isViolatingThisFrame = true;
          }
        } else {
          faceLostStart.current = null;
          
          const landmarks = faceResult.faceLandmarks[0];
          const matrices = faceResult.facialTransformationMatrixes?.[0];

          // Head Pose (Yaw / Pitch / Roll)
          if (matrices) {
            const m = matrices.data;
            const pitch = Math.atan2(m[9], m[10]) * (180 / Math.PI);
            const yaw = Math.atan2(-m[8], Math.sqrt(m[9] * m[9] + m[10] * m[10])) * (180 / Math.PI);
            const roll = Math.atan2(m[4], m[0]) * (180 / Math.PI);
            
            updates.headPose = { pitch, yaw, roll };
            // Draft work: pitch between -15° and -40°
            updates.isDraftWork = pitch >= -40 && pitch <= -15;

            // Gaze deviation check (Yaw > 20° or Yaw < -20°) — 2 seconds continuous
            if (Math.abs(yaw) > 20) {
              if (!gazeViolationStart.current) gazeViolationStart.current = now;
              else if (now - gazeViolationStart.current > 2000) {
                if (now - lastGazeEvent.current > EVENT_COOLDOWN) {
                  const dirText = yaw > 0 ? 'вправо' : 'влево';
                  const type = yaw > 0 ? 'GAZE_RIGHT' : 'GAZE_LEFT';
                  addEventRef.current({
                    type,
                    severity: 'MEDIUM',
                    description: `Взгляд отвлекся ${dirText} (угол ${Math.abs(yaw).toFixed(0)}°)`
                  });
                  lastGazeEvent.current = now;
                }
                isViolatingThisFrame = true;
              }
            } else {
              gazeViolationStart.current = null;
            }
          }

          // Iris Gaze Direction (Ratio)
          if (landmarks[468] && landmarks[33] && landmarks[133]) {
            const leftIris = landmarks[468];
            const leftOuter = landmarks[33];
            const leftInner = landmarks[133];
            const leftTop = landmarks[159];
            const leftBottom = landmarks[145];

            const irisToOuter = calculateDistance(leftIris, leftOuter);
            const outerToInner = calculateDistance(leftOuter, leftInner);
            const ratio = outerToInner > 0 ? irisToOuter / outerToInner : 0.5;
            updates.gazeRatio = ratio;

            let gazeDir: ProctoringTelemetry['gazeDirection'] = 'CENTER';
            if (ratio < 0.40) gazeDir = 'LEFT';
            else if (ratio > 0.60) gazeDir = 'RIGHT';

            if (leftTop && leftBottom) {
              const eyeHeight = leftBottom.y - leftTop.y;
              if (eyeHeight > 0 && leftIris.y > leftTop.y + eyeHeight * 0.60) {
                gazeDir = 'DOWN';
              }
            }

            updates.gazeDirection = gazeDir;
          }

          // Light Anomaly Detection (using offscreen 160x120 canvas)
          const lc = getLightCanvas();
          if (lc) {
            lc.ctx.drawImage(video, 0, 0, 160, 120);
            
            let minX = 1, minY = 1, maxX = 0, maxY = 0;
            for (const l of landmarks) {
              if (l.x < minX) minX = l.x;
              if (l.y < minY) minY = l.y;
              if (l.x > maxX) maxX = l.x;
              if (l.y > maxY) maxY = l.y;
            }

            const boxHeight = maxY - minY;
            const sx = Math.max(0, Math.floor(minX * 160));
            const topY = Math.max(0, Math.floor(minY * 120));
            const w = Math.max(1, Math.floor((maxX - minX) * 160));
            const h3 = Math.max(1, Math.floor((boxHeight / 3) * 120));
            const bottomY = Math.max(0, Math.floor((maxY - boxHeight / 3) * 120));

            const safeW = Math.min(w, 160 - sx);
            const safeH3Top = Math.min(h3, 120 - topY);
            const safeH3Bot = Math.min(h3, 120 - bottomY);

            if (safeW > 0 && safeH3Top > 0 && safeH3Bot > 0) {
              try {
                const topData = lc.ctx.getImageData(sx, topY, safeW, safeH3Top).data;
                const bottomData = lc.ctx.getImageData(sx, bottomY, safeW, safeH3Bot).data;
                
                let topSum = 0;
                const topPixels = topData.length / 4;
                for (let i = 0; i < topData.length; i += 4) {
                  topSum += 0.299 * topData[i] + 0.587 * topData[i+1] + 0.114 * topData[i+2];
                }
                
                let bottomSum = 0;
                const bottomPixels = bottomData.length / 4;
                for (let i = 0; i < bottomData.length; i += 4) {
                  bottomSum += 0.299 * bottomData[i] + 0.587 * bottomData[i+1] + 0.114 * bottomData[i+2];
                }
                
                const topAvg = topPixels > 0 ? topSum / topPixels : 1;
                const bottomAvg = bottomPixels > 0 ? bottomSum / bottomPixels : 0;

                if (topAvg > 0 && bottomAvg > topAvg * 1.30) {
                  updates.lightAnomaly = true;
                  if (!lightAnomalyStart.current) lightAnomalyStart.current = now;
                  else if (now - lightAnomalyStart.current > 1500) {
                    if (now - lastLightEvent.current > EVENT_COOLDOWN) {
                      addEventRef.current({
                        type: 'LIGHT_ANOMALY',
                        severity: 'HIGH',
                        description: 'Свечение от смартфона/планшета снизу (подсветка подбородка).'
                      });
                      lastLightEvent.current = now;
                    }
                  }
                } else {
                  updates.lightAnomaly = false;
                  lightAnomalyStart.current = null;
                }
              } catch (e) {
                // Ignore offscreen canvas crop error
              }
            }
          }
        }
      } catch (e) {
        console.warn('Face landmarker error:', e);
      }
    }

    // ── 2. HAND PROCESSING (~5 FPS / every ~200ms) ──
    if (now - lastHandProcessTime.current >= 200 && handLandmarkerRef.current) {
      try {
        const handResult = handLandmarkerRef.current.detectForVideo(video, now);
        lastHandProcessTime.current = now;

        const handsCount = handResult.handLandmarks.length;
        updates.handsDetected = handsCount;

        if (handsCount === 0) {
          updates.handStatus = 'NO_HANDS';
          handBelowStart.current = null;
          previousWristX.current = null;
        } else {
          let isBelow = false;
          
          for (const handLandmarks of handResult.handLandmarks) {
            const wrist = handLandmarks[0]; // Landmark 0: wrist
            
            // If wrist Y is > 0.72 (chest/desk boundary)
            if (wrist.y > 0.72) {
              isBelow = true;
            }

            // Fast swipe detection
            if (previousWristX.current !== null) {
              const dt = now - lastWristTime.current;
              if (dt > 0 && dt <= 300) {
                const dx = Math.abs(wrist.x - previousWristX.current);
                if (dx > 0.20 && now - lastSwipeEvent.current > EVENT_COOLDOWN) {
                  addEventRef.current({
                    type: 'SWIPE',
                    severity: 'HIGH',
                    description: 'Резкий свайп-жест рукой (переключение на смартфоне).'
                  });
                  lastSwipeEvent.current = now;
                  previousWristX.current = null;
                }
              }
            }
            previousWristX.current = wrist.x;
            lastWristTime.current = now;
          }

          if (isBelow) {
            updates.handStatus = 'BELOW_DESK';
            if (!handBelowStart.current) handBelowStart.current = now;
            else if (now - handBelowStart.current > 1500) {
              if (now - lastHandBelowEvent.current > EVENT_COOLDOWN) {
                addEventRef.current({
                  type: 'HAND_BELOW',
                  severity: 'MEDIUM',
                  description: 'Руки ушли под стол (подозрение на работу с телефоном).'
                });
                lastHandBelowEvent.current = now;
              }
              isViolatingThisFrame = true;
            }
          } else {
            updates.handStatus = 'IN_FRAME';
            handBelowStart.current = null;
          }
        }
      } catch (e) {
        console.warn('Hand landmarker error:', e);
      }
    }

    updates.isViolating = isViolatingThisFrame;
    if (currentFps !== undefined) {
      updates.fps = currentFps;
    }

    // Update state
    if (Object.keys(updates).length > 0) {
      setTelemetry(prev => ({ ...prev, ...updates }));
    }

    requestRef.current = requestAnimationFrame(processFrame);
  }, [videoRef]);

  // Tab switch monitoring
  useEffect(() => {
    if (!isActive) return;

    let lastTabEvent = 0;
    const handleVisibilityChange = () => {
      if (document.hidden && Date.now() - lastTabEvent > 2000) {
        lastTabEvent = Date.now();
        addEvent({ type: 'TAB_SWITCH', severity: 'HIGH', description: 'Пользователь сменил вкладку браузера.' });
      }
    };

    const handleBlur = () => {
      if (Date.now() - lastTabEvent > 2000) {
        lastTabEvent = Date.now();
        addEvent({ type: 'TAB_SWITCH', severity: 'HIGH', description: 'Окно браузера потеряло фокус.' });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isActive, addEvent]);

  // Animation frame loop control
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
