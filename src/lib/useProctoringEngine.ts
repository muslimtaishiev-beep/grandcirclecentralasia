import { useState, useEffect, useRef, useCallback, RefObject } from 'react';
import { FilesetResolver, FaceLandmarker, HandLandmarker, ObjectDetector } from '@mediapipe/tasks-vision';

export interface DetectedObject {
  categoryName: string;
  score: number;
  boundingBox: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  };
}

export type HandGestureType = 'NONE' | 'ONE_FINGER' | 'TWO_FINGERS' | 'THREE_FINGERS' | 'FOUR_FINGERS' | 'THUMBS_UP' | 'THUMBS_DOWN' | 'PHONE_HAND_SIGNAL';

export interface HandGestureResult {
  gesture: HandGestureType;
  label: string;
  extendedFingers: number;
  signaledOption?: string;
}

export interface ProctoringTelemetry {
  headPose: { pitch: number; yaw: number; roll: number };
  gazeDirection: 'CENTER' | 'LEFT' | 'RIGHT' | 'DOWN';
  gazeRatio: number;
  handsDetected: number;
  handStatus: 'IN_FRAME' | 'BELOW_DESK' | 'NO_HANDS';
  currentGesture: HandGestureResult;
  facesDetected: number;
  phoneDetected: boolean;
  bookDetected: boolean;
  detectedObjects: DetectedObject[];
  lightAnomaly: boolean;
  isViolating: boolean;
  isDraftWork: boolean;
  fps: number;

  // Lip Reading Telemetry
  mouthAspectRatio: number;     // MAR (0.0 - 1.0)
  isSilentLipSpeaking: boolean;
  currentViseme: 'RESTING' | 'OPEN_A' | 'ROUND_O_U' | 'WIDE_I' | 'SPEAKING_CADENCE';
  visemeLabel: string;

  // Audio Telemetry
  audioLevel: number;           // 0 - 100 RMS volume
  audioStatus: 'SILENT' | 'NORMAL' | 'WHISPER' | 'TALKING';
  zeroCrossingRate: number;     // ZCR (0.0 - 1.0)
  lastTranscript: string;       // Real-time transcribed text
  speechProbability: number;    // 0 - 100% probability of cheating/prompts
  speechIntentCategory: 'NORMAL_READING' | 'EXAM_HELP_REQUEST' | 'DICTATION' | 'AI_PROMPT' | 'BENIGN';
}

export interface ProctoringEvent {
  id: string;
  timestamp: number;
  type: 'GAZE_LEFT' | 'GAZE_RIGHT' | 'EXTRA_FACE' | 'HAND_BELOW' | 'SWIPE' | 'LIGHT_ANOMALY' | 'FAST_ANSWER' | 'PASTE_DETECTED' | 'TAB_SWITCH' | 'FACE_LOST' | 'PHONE_DETECTED' | 'BOOK_DETECTED' | 'SPEECH_CHEAT_DETECTED' | 'GESTURE_SIGNAL_DETECTED' | 'SILENT_LIP_SPEAKING_DETECTED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

// ── 1. LIP READING & VISEME ANALYZER (MediaPipe 478 Face Mesh) ──
function classifyVisemeAndLipMotion(landmarks: { x: number; y: number; z: number }[]): {
  mar: number;
  viseme: ProctoringTelemetry['currentViseme'];
  label: string;
} {
  if (!landmarks || landmarks.length < 468) {
    return { mar: 0, viseme: 'RESTING', label: 'Покой' };
  }

  // Landmark 13: Upper inner lip, 14: Lower inner lip
  // Landmark 61: Left mouth corner, 291: Right mouth corner
  const upperLip = landmarks[13];
  const lowerLip = landmarks[14];
  const leftCorner = landmarks[61];
  const rightCorner = landmarks[291];

  if (!upperLip || !lowerLip || !leftCorner || !rightCorner) {
    return { mar: 0, viseme: 'RESTING', label: 'Покой' };
  }

  const lipDistance = Math.hypot(upperLip.x - lowerLip.x, upperLip.y - lowerLip.y);
  const lipWidth = Math.hypot(leftCorner.x - rightCorner.x, leftCorner.y - rightCorner.y);
  const mar = lipWidth > 0 ? lipDistance / lipWidth : 0;

  if (mar > 0.50 && lipWidth < 0.22) {
    return { mar, viseme: 'ROUND_O_U', label: '😮 Губы: О / У (Вариант 1)' };
  }
  if (mar > 0.42) {
    return { mar, viseme: 'OPEN_A', label: '😃 Губы: А / Э' };
  }
  if (mar < 0.20 && lipWidth > 0.26) {
    return { mar, viseme: 'WIDE_I', label: '😬 Губы: И / Е (Вариант 2)' };
  }
  if (mar > 0.16) {
    return { mar, viseme: 'SPEAKING_CADENCE', label: '👄 Губы: Артикуляция' };
  }

  return { mar, viseme: 'RESTING', label: 'Покой' };
}

// ── 2. FINGER GESTURE CLASSIFIER (MediaPipe 3D Hand Landmarks) ──
function classifyHandGesture(landmarks: { x: number; y: number; z: number }[]): HandGestureResult {
  if (!landmarks || landmarks.length < 21) {
    return { gesture: 'NONE', label: 'Нет жеста', extendedFingers: 0 };
  }

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];

  const indexPip = landmarks[6];
  const middlePip = landmarks[10];
  const ringPip = landmarks[14];
  const pinkyPip = landmarks[18];
  const thumbMcp = landmarks[2];

  const isIndexUp = indexTip.y < indexPip.y;
  const isMiddleUp = middleTip.y < middlePip.y;
  const isRingUp = ringTip.y < ringPip.y;
  const isPinkyUp = pinkyTip.y < pinkyPip.y;

  const isThumbOut = Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y) > Math.hypot(thumbMcp.x - wrist.x, thumbMcp.y - wrist.y) * 1.20;

  let count = 0;
  if (isIndexUp) count++;
  if (isMiddleUp) count++;
  if (isRingUp) count++;
  if (isPinkyUp) count++;

  if (isThumbOut && !isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
    if (thumbTip.y < wrist.y - 0.08) {
      return { gesture: 'THUMBS_UP', label: '👍 Большой палец вверх', extendedFingers: 1 };
    } else if (thumbTip.y > wrist.y + 0.08) {
      return { gesture: 'THUMBS_DOWN', label: '👎 Большой палец вниз', extendedFingers: 1 };
    }
  }

  if (isThumbOut && isPinkyUp && !isIndexUp && !isMiddleUp && !isRingUp) {
    return { gesture: 'PHONE_HAND_SIGNAL', label: '🤙 Жест "Телефон"', extendedFingers: 2 };
  }

  if (count === 1 && isIndexUp) {
    return { gesture: 'ONE_FINGER', label: '☝️ 1 палец (Вариант А)', extendedFingers: 1, signaledOption: 'A' };
  }

  if (count === 2 && isIndexUp && isMiddleUp) {
    return { gesture: 'TWO_FINGERS', label: '✌️ 2 пальца (Вариант B)', extendedFingers: 2, signaledOption: 'B' };
  }

  if (count === 3 && isIndexUp && isMiddleUp && isRingUp) {
    return { gesture: 'THREE_FINGERS', label: '🤟 3 пальца (Вариант C)', extendedFingers: 3, signaledOption: 'C' };
  }

  if (count === 4 && isIndexUp && isMiddleUp && isRingUp && isPinkyUp) {
    return { gesture: 'FOUR_FINGERS', label: '🖐 4 пальца (Вариант D)', extendedFingers: 4, signaledOption: 'D' };
  }

  return { gesture: 'NONE', label: 'Ладонь', extendedFingers: count + (isThumbOut ? 1 : 0) };
}

// ── 3. DYNAMIC SEMANTIC INTENT CLASSIFIER (With Question Text Overlap Verification) ──
function evaluateSemanticIntent(text: string, currentQuestionText?: string): {
  probability: number;
  intentCategory: ProctoringTelemetry['speechIntentCategory'];
  reasoning: string;
} {
  if (!text || text.trim().length === 0) {
    return { probability: 0, intentCategory: 'BENIGN', reasoning: 'Речь не обнаружена' };
  }

  const clean = text.toLowerCase().trim();
  const words = clean.split(/\s+/).filter(w => w.length > 2);
  const wordCount = words.length;

  if (currentQuestionText && currentQuestionText.trim().length > 0) {
    const qClean = currentQuestionText.toLowerCase();
    
    let matchedInQuestionCount = 0;
    for (const word of words) {
      if (qClean.includes(word)) {
        matchedInQuestionCount++;
      }
    }

    const overlapRatio = wordCount > 0 ? matchedInQuestionCount / wordCount : 0;

    if (overlapRatio > 0.45 && !/(?:сири|siri|эй чувак|чувак|эй брат|гугл|яндекс|алиса|гпт|gpt)/i.test(clean)) {
      return {
        probability: 5,
        intentCategory: 'NORMAL_READING',
        reasoning: `Ученик читает текст текущего задания на экране (Совпадение слов ${Math.round(overlapRatio * 100)}%)`
      };
    }
  }

  const hasAiOrDeviceCall = /(?:сири|siri|эй чувак|чувак|эй|эй брат|гугл|яндекс|алиса|сафари|гпт|gpt|chat|джипити|поиск|найди)/i.test(clean);
  if (hasAiOrDeviceCall) {
    return {
      probability: 95,
      intentCategory: 'AI_PROMPT',
      reasoning: 'Обращение к ИИ-ассистенту или помощнику ("сири", "эй чувак", "гугл")'
    };
  }

  const hasConversationalAnswerPrompt = /(?:что в|что во|какой|какая|какое|че там|чо там|подскажи|помоги|скажи|выбери)\s*(?:первом|втором|третьем|четвертом|пятом|шестом|седьмом|восьмом|варианте|букве|ответ)?/i.test(clean)
    || /(?:первое|второе|третье|четвертое|пятое|первый|второй|третий|четвертый|пятый)\b/i.test(clean);

  if (hasConversationalAnswerPrompt) {
    return {
      probability: 90,
      intentCategory: 'EXAM_HELP_REQUEST',
      reasoning: 'Разговорный запрос ответа на вопрос ("что во втором", "третье")'
    };
  }

  const isQuestionOrRequest = /(?:кто|что|где|когда|как|сколько|почему|зачем|верно|правильно)/i.test(clean);
  const hasDictationPointers = /(?:вопрос|уравнение|текст|задача|пример|читать|напиши|сфотай|смотри)/i.test(clean);

  if (isQuestionOrRequest && hasDictationPointers) {
    return {
      probability: 80,
      intentCategory: 'DICTATION',
      reasoning: 'Надиктовка текста вопроса третьим лицом'
    };
  }

  if (wordCount >= 4 && !hasConversationalAnswerPrompt && !hasAiOrDeviceCall) {
    return {
      probability: 15,
      intentCategory: 'NORMAL_READING',
      reasoning: 'Чтение задания вслух (безвредное размышление)'
    };
  }

  return {
    probability: 10,
    intentCategory: 'BENIGN',
    reasoning: 'Обычная речь / беседа'
  };
}

// ── 4. ACOUSTIC WHISPER & DSP CLASSIFIER ──
function classifyAcousticState(timeData: Float32Array, freqData: Uint8Array, rmsVolume: number): {
  status: ProctoringTelemetry['audioStatus'];
  zcr: number;
} {
  if (rmsVolume < 6) {
    return { status: 'SILENT', zcr: 0 };
  }

  let zeroCrossings = 0;
  for (let i = 1; i < timeData.length; i++) {
    if ((timeData[i] >= 0 && timeData[i - 1] < 0) || (timeData[i] < 0 && timeData[i - 1] >= 0)) {
      zeroCrossings++;
    }
  }
  const zcr = zeroCrossings / timeData.length;

  let lowEnergy = 0;
  let highEnergy = 0;
  const binSize = freqData.length;
  const lowCut = Math.floor(binSize * 0.15);
  const highCut = Math.floor(binSize * 0.40);

  for (let i = 0; i < lowCut; i++) lowEnergy += freqData[i];
  for (let i = highCut; i < binSize; i++) highEnergy += freqData[i];

  const totalEnergy = lowEnergy + highEnergy;
  const highRatio = totalEnergy > 0 ? highEnergy / totalEnergy : 0;

  if (rmsVolume >= 10 && rmsVolume <= 38 && (zcr > 0.26 || highRatio > 0.42)) {
    return { status: 'WHISPER', zcr };
  }

  if (rmsVolume > 35) {
    return { status: 'TALKING', zcr };
  }

  return { status: 'NORMAL', zcr };
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
  isActive: boolean,
  currentQuestionText?: string
) {
  const [telemetry, setTelemetry] = useState<ProctoringTelemetry>({
    headPose: { pitch: 0, yaw: 0, roll: 0 },
    gazeDirection: 'CENTER',
    gazeRatio: 0.5,
    handsDetected: 0,
    handStatus: 'NO_HANDS',
    currentGesture: { gesture: 'NONE', label: 'Нет жеста', extendedFingers: 0 },
    facesDetected: 0,
    phoneDetected: false,
    bookDetected: false,
    detectedObjects: [],
    lightAnomaly: false,
    isViolating: false,
    isDraftWork: false,
    fps: 0,
    mouthAspectRatio: 0,
    isSilentLipSpeaking: false,
    currentViseme: 'RESTING',
    visemeLabel: 'Покой',
    audioLevel: 0,
    audioStatus: 'SILENT',
    zeroCrossingRate: 0,
    lastTranscript: '',
    speechProbability: 0,
    speechIntentCategory: 'BENIGN',
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
  const objectDetectorRef = useRef<ObjectDetector | null>(null);
  const requestRef = useRef<number>(0);

  // Throttling refs
  const lastFaceProcessTime = useRef(0);
  const lastHandProcessTime = useRef(0);
  const lastObjectProcessTime = useRef(0);
  const fpsFrameCount = useRef(0);
  const lastFpsTime = useRef(0);

  // Anomaly duration tracking
  const gazeViolationStart = useRef<number | null>(null);
  const handBelowStart = useRef<number | null>(null);
  const lightAnomalyStart = useRef<number | null>(null);
  const faceLostStart = useRef<number | null>(null);
  const silentLipStart = useRef<number | null>(null);
  const marHistoryRef = useRef<number[]>([]);
  
  // Event cooldown refs
  const lastExtraFaceEvent = useRef<number>(0);
  const lastFaceLostEvent = useRef<number>(0);
  const lastGazeEvent = useRef<number>(0);
  const lastHandBelowEvent = useRef<number>(0);
  const lastSwipeEvent = useRef<number>(0);
  const lastLightEvent = useRef<number>(0);
  const lastPhoneEvent = useRef<number>(0);
  const lastBookEvent = useRef<number>(0);
  const lastSpeechEvent = useRef<number>(0);
  const lastGestureEvent = useRef<number>(0);
  const lastSilentLipEvent = useRef<number>(0);
  const EVENT_COOLDOWN = 3000;

  // Hand tracking
  const previousWristX = useRef<number | null>(null);
  const lastWristTime = useRef<number>(0);
  
  // Overlay refs
  const faceLandmarksRef = useRef<any[][] | null>(null);
  const detectedObjectsRef = useRef<DetectedObject[]>([]);
  const handLandmarksRef = useRef<any[][] | null>(null);

  // Speech & Audio refs
  const speechRecognitionRef = useRef<any | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentQuestionTextRef = useRef<string | undefined>(currentQuestionText);
  currentQuestionTextRef.current = currentQuestionText;

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

  // Initialize Speech Recognition & AudioContext DSP
  useEffect(() => {
    if (!isActive) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'ru-RU';

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }

          if (currentTranscript.trim().length > 0) {
            const { probability, intentCategory, reasoning } = evaluateSemanticIntent(
              currentTranscript,
              currentQuestionTextRef.current
            );

            setTelemetry(prev => ({
              ...prev,
              lastTranscript: currentTranscript,
              speechProbability: probability,
              speechIntentCategory: intentCategory,
            }));

            if (probability >= 60 && Date.now() - lastSpeechEvent.current > EVENT_COOLDOWN) {
              addEventRef.current({
                type: 'SPEECH_CHEAT_DETECTED',
                severity: probability >= 85 ? 'HIGH' : 'MEDIUM',
                description: `🗣 [${intentCategory}] ${reasoning}: "${currentTranscript.slice(0, 55)}..." (${probability}%)`
              });
              lastSpeechEvent.current = Date.now();
            }
          }
        };

        recognition.onerror = (e: any) => {
          if (e.error !== 'no-speech') console.warn('Speech recognition error:', e.error);
        };

        recognition.onend = () => {
          if (speechRecognitionRef.current) {
            try { speechRecognitionRef.current.start(); } catch (err) {}
          }
        };

        recognition.start();
        speechRecognitionRef.current = recognition;
      } catch (err) {
        console.warn('Speech recognition init failed:', err);
      }
    }

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        audioContextRef.current = ctx;

        const freqData = new Uint8Array(analyser.frequencyBinCount);
        const timeData = new Float32Array(analyser.fftSize);

        const checkAudioDSP = () => {
          if (!audioContextRef.current) return;
          analyser.getByteFrequencyData(freqData);
          analyser.getFloatTimeDomainData(timeData);

          let sumSquares = 0;
          for (let i = 0; i < timeData.length; i++) {
            sumSquares += timeData[i] * timeData[i];
          }
          const rmsRaw = Math.sqrt(sumSquares / timeData.length);
          const rmsVolume = Math.min(100, Math.round(rmsRaw * 400));

          const { status, zcr } = classifyAcousticState(timeData, freqData, rmsVolume);

          setTelemetry(prev => ({
            ...prev,
            audioLevel: rmsVolume,
            audioStatus: status,
            zeroCrossingRate: parseFloat(zcr.toFixed(3)),
          }));
        };

        const interval = setInterval(checkAudioDSP, 200);
        return () => clearInterval(interval);
      } catch (e) {
        console.warn('Audio Context init error:', e);
      }
    }).catch(() => {});

    return () => {
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch (e) {}
        speechRecognitionRef.current = null;
      }
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (e) {}
        audioContextRef.current = null;
      }
    };
  }, [isActive]);

  // Initialize MediaPipe Models
  useEffect(() => {
    let active = true;

    async function initModels() {
      try {
        setIsLoading(true);
        setLoadingProgress('1/3 Загрузка движка WebAssembly...');
        
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        setLoadingProgress('2/3 Загрузка нейросетей лица и рук...');
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

        setLoadingProgress('3/3 Загрузка нейросети предмета (EfficientDet)...');
        try {
          objectDetectorRef.current = await ObjectDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite',
              delegate: 'GPU'
            },
            scoreThreshold: 0.30,
            runningMode: 'VIDEO'
          });
        } catch (e) {
          try {
            objectDetectorRef.current = await ObjectDetector.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite',
                delegate: 'CPU'
              },
              scoreThreshold: 0.30,
              runningMode: 'VIDEO'
            });
          } catch (e2) {}
        }

        if (active) {
          setIsReady(true);
          setIsLoading(false);
          setLoadingProgress('Все ML-модели готовы');
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Ошибка инициализации ML-моделей');
          setIsLoading(false);
        }
      }
    }

    initModels();

    return () => {
      active = false;
      if (faceLandmarkerRef.current) faceLandmarkerRef.current.close();
      if (handLandmarkerRef.current) handLandmarkerRef.current.close();
      if (objectDetectorRef.current) objectDetectorRef.current.close();
    };
  }, []);

  const calculateDistance = (p1: { x: number, y: number }, p2: { x: number, y: number }) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  };

  // Processing loop
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

    // ── 1. FACE PROCESSING & LIP READING (~20 FPS / every ~50ms) ──
    if (now - lastFaceProcessTime.current >= 50 && faceLandmarkerRef.current) {
      try {
        const faceResult = faceLandmarkerRef.current.detectForVideo(video, now);
        lastFaceProcessTime.current = now;

        const facesDetected = faceResult.faceLandmarks.length;
        updates.facesDetected = facesDetected;
        faceLandmarksRef.current = faceResult.faceLandmarks;

        if (facesDetected > 1) {
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

          // Head Pose
          if (matrices) {
            const m = matrices.data;
            const pitch = Math.atan2(m[9], m[10]) * (180 / Math.PI);
            const yaw = Math.atan2(-m[8], Math.sqrt(m[9] * m[9] + m[10] * m[10])) * (180 / Math.PI);
            const roll = Math.atan2(m[4], m[0]) * (180 / Math.PI);
            
            updates.headPose = { pitch, yaw, roll };
            updates.isDraftWork = pitch >= -40 && pitch <= -15;

            if (Math.abs(yaw) > 20) {
              if (!gazeViolationStart.current) gazeViolationStart.current = now;
              else if (now - gazeViolationStart.current > 2000) {
                if (now - lastGazeEvent.current > EVENT_COOLDOWN) {
                  const dirText = yaw > 0 ? 'вправо' : 'влево';
                  const type = yaw > 0 ? 'GAZE_RIGHT' : 'GAZE_LEFT';
                  addEventRef.current({
                    type,
                    severity: 'MEDIUM',
                    description: `Взгляд отвлёкся ${dirText} (угол ${Math.abs(yaw).toFixed(0)}°)`
                  });
                  lastGazeEvent.current = now;
                }
                isViolatingThisFrame = true;
              }
            } else {
              gazeViolationStart.current = null;
            }
          }

          // Iris gaze
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

          // LIP READING & VISEME ANALYZER
          const lipRes = classifyVisemeAndLipMotion(landmarks);
          updates.mouthAspectRatio = parseFloat(lipRes.mar.toFixed(3));
          updates.currentViseme = lipRes.viseme;
          updates.visemeLabel = lipRes.label;

          // Track MAR history over 500ms sliding window (10 samples)
          marHistoryRef.current.push(lipRes.mar);
          if (marHistoryRef.current.length > 10) marHistoryRef.current.shift();

          const maxMar = Math.max(...marHistoryRef.current);
          const minMar = Math.min(...marHistoryRef.current);
          const marDelta = maxMar - minMar;

          // Silent Lip Speaking Detection:
          // If audio is silent (level < 10 dB) BUT lips are oscillating dynamically (marDelta > 0.16) for > 1.2s
          if (marDelta > 0.16) {
            updates.isSilentLipSpeaking = true;
            if (!silentLipStart.current) silentLipStart.current = now;
            else if (now - silentLipStart.current > 1200) {
              if (now - lastSilentLipEvent.current > EVENT_COOLDOWN) {
                addEventRef.current({
                  type: 'SILENT_LIP_SPEAKING_DETECTED',
                  severity: 'HIGH',
                  description: `👄 Чтение по губам: Бесшумное артикулирование губами без звука микрофона (${lipRes.label})`
                });
                lastSilentLipEvent.current = now;
              }
              isViolatingThisFrame = true;
            }
          } else {
            updates.isSilentLipSpeaking = false;
            silentLipStart.current = null;
          }

          // STRICT LIGHT ANOMALY DETECTION
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
                const diff = bottomAvg - topAvg;

                if (topAvg > 0 && bottomAvg > topAvg * 1.75 && diff > 45) {
                  updates.lightAnomaly = true;
                  if (!lightAnomalyStart.current) lightAnomalyStart.current = now;
                  else if (now - lightAnomalyStart.current > 3500) {
                    if (now - lastLightEvent.current > EVENT_COOLDOWN) {
                      addEventRef.current({
                        type: 'LIGHT_ANOMALY',
                        severity: 'HIGH',
                        description: 'Свечение от смартфона/планшета снизу (яркий холодный свет).'
                      });
                      lastLightEvent.current = now;
                    }
                  }
                } else {
                  updates.lightAnomaly = false;
                  lightAnomalyStart.current = null;
                }
              } catch (e) {}
            }
          }
        }
      } catch (e) {
        console.warn('Face landmarker error:', e);
      }
    }

    // ── 2. HAND PROCESSING & GESTURE CLASSIFIER (~5 FPS / every ~200ms) ──
    if (now - lastHandProcessTime.current >= 200 && handLandmarkerRef.current) {
      try {
        const handResult = handLandmarkerRef.current.detectForVideo(video, now);
        lastHandProcessTime.current = now;

        const handsCount = handResult.handLandmarks.length;
        updates.handsDetected = handsCount;
        handLandmarksRef.current = handResult.handLandmarks;

        if (handsCount === 0) {
          updates.handStatus = 'NO_HANDS';
          updates.currentGesture = { gesture: 'NONE', label: 'Нет жеста', extendedFingers: 0 };
          handBelowStart.current = null;
          previousWristX.current = null;
        } else {
          let isBelow = false;
          let activeGesture: HandGestureResult = { gesture: 'NONE', label: 'Ладонь', extendedFingers: 0 };

          for (const handLandmarks of handResult.handLandmarks) {
            const wrist = handLandmarks[0];
            
            if (wrist.y > 0.72) {
              isBelow = true;
            }

            const gestureRes = classifyHandGesture(handLandmarks);
            if (gestureRes.gesture !== 'NONE') {
              activeGesture = gestureRes;
              
              if (gestureRes.signaledOption || gestureRes.gesture === 'PHONE_HAND_SIGNAL') {
                if (now - lastGestureEvent.current > EVENT_COOLDOWN) {
                  addEventRef.current({
                    type: 'GESTURE_SIGNAL_DETECTED',
                    severity: 'HIGH',
                    description: `✋ Сигнализирование пальцами: ${gestureRes.label}`
                  });
                  lastGestureEvent.current = now;
                }
                isViolatingThisFrame = true;
              }
            }

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

          updates.currentGesture = activeGesture;

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

    // ── 3. OBJECT DETECTION (~4 FPS / every ~250ms) ──
    if (now - lastObjectProcessTime.current >= 250 && objectDetectorRef.current) {
      try {
        const objResult = objectDetectorRef.current.detectForVideo(video, now);
        lastObjectProcessTime.current = now;

        let hasPhone = false;
        let hasBook = false;
        const validObjects: DetectedObject[] = [];

        if (objResult.detections && objResult.detections.length > 0) {
          for (const det of objResult.detections) {
            const cat = det.categories?.[0];
            if (!cat || cat.score < 0.30) continue;

            const label = cat.categoryName.toLowerCase();
            const bbox = det.boundingBox;

            if (!bbox) continue;

            validObjects.push({
              categoryName: cat.categoryName,
              score: cat.score,
              boundingBox: {
                originX: bbox.originX,
                originY: bbox.originY,
                width: bbox.width,
                height: bbox.height,
              }
            });

            if (label.includes('phone') || label.includes('mobile') || label.includes('cell')) {
              hasPhone = true;
              if (now - lastPhoneEvent.current > EVENT_COOLDOWN) {
                addEventRef.current({
                  type: 'PHONE_DETECTED',
                  severity: 'HIGH',
                  description: `В КАДРЕ ОБНАРУЖЕН МОБИЛЬНЫЙ ТЕЛЕФОН (${Math.round(cat.score * 100)}% уверенность)!`
                });
                lastPhoneEvent.current = now;
              }
              isViolatingThisFrame = true;
            } else if (label.includes('book') || label.includes('binder') || label.includes('paper')) {
              hasBook = true;
              if (now - lastBookEvent.current > EVENT_COOLDOWN) {
                addEventRef.current({
                  type: 'BOOK_DETECTED',
                  severity: 'MEDIUM',
                  description: `В кадре обнаружена книга/конспект (${Math.round(cat.score * 100)}% уверенность).`
                });
                lastBookEvent.current = now;
              }
            }
          }
        }

        updates.phoneDetected = hasPhone;
        updates.bookDetected = hasBook;
        updates.detectedObjects = validObjects;
        detectedObjectsRef.current = validObjects;

      } catch (e) {
        console.warn('Object detector error:', e);
      }
    }

    updates.isViolating = isViolatingThisFrame;
    if (currentFps !== undefined) {
      updates.fps = currentFps;
    }

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
    faceLandmarks: faceLandmarksRef.current,
    detectedObjects: detectedObjectsRef.current,
    handLandmarks: handLandmarksRef.current,
  };
}
