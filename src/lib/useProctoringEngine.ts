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
  decodedGestureOption: string;       // E.g. "Ответ Б (2 пальца)"
  decodedGestureStream: string;       // Rolling history: "Б -> В -> А"
  facesDetected: number;
  phoneDetected: boolean;
  bookDetected: boolean;
  detectedObjects: DetectedObject[];
  lightAnomaly: boolean;
  isViolating: boolean;
  isDraftWork: boolean;
  fps: number;

  // Lip Reading & VSR Micro-Motion Decoder Telemetry
  mouthAspectRatio: number;          // MAR (0.0 - 1.0)
  isSilentLipSpeaking: boolean;
  currentViseme: 'RESTING' | 'CLOSED_P_B_M' | 'OPEN_A_E' | 'STRETCH_I_E' | 'ROUND_O_U' | 'DENTAL_F_V';
  visemeLabel: string;
  decodedLipWord: string;            // Continuous Transcribed Text from Lips
  decodedLipOption: string;          // Decoded option e.g. "B"
  lipFeatureVector: number[];        // 6D kinematic vector

  // Audio Telemetry
  audioLevel: number;                // 0 - 100 RMS volume
  audioStatus: 'SILENT' | 'NORMAL' | 'WHISPER' | 'TALKING';
  zeroCrossingRate: number;          // ZCR (0.0 - 1.0)
  lastTranscript: string;            // Real-time transcribed text
  speechProbability: number;         // 0 - 100% probability of cheating/prompts
  speechIntentCategory: 'NORMAL_READING' | 'EXAM_HELP_REQUEST' | 'DICTATION' | 'AI_PROMPT' | 'BENIGN';
}

export interface ProctoringEvent {
  id: string;
  timestamp: number;
  type: 'GAZE_LEFT' | 'GAZE_RIGHT' | 'EXTRA_FACE' | 'HAND_BELOW' | 'SWIPE' | 'LIGHT_ANOMALY' | 'FAST_ANSWER' | 'PASTE_DETECTED' | 'TAB_SWITCH' | 'FACE_LOST' | 'PHONE_DETECTED' | 'BOOK_DETECTED' | 'SPEECH_CHEAT_DETECTED' | 'GESTURE_SIGNAL_DETECTED' | 'SILENT_LIP_SPEAKING_DETECTED' | 'CAMERA_OFF';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

// ── WARNING MESSAGE MAPPER ──
// Maps event types to user-facing animated overlay messages.
// Consumed by ProctoringWarningOverlay component.
export interface WarningMessage {
  title: string;
  body: string;
  icon: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export const PROCTORING_WARNING_MESSAGES: Record<ProctoringEvent['type'], WarningMessage> = {
  GAZE_LEFT:  { icon: '👀', title: 'А куда это мы смотрим?', body: 'Взгляд ушёл в сторону. Смотри на экран.', severity: 'MEDIUM' },
  GAZE_RIGHT: { icon: '👀', title: 'А куда это мы смотрим?', body: 'Взгляд ушёл в сторону. Смотри на экран.', severity: 'MEDIUM' },
  EXTRA_FACE: { icon: '😠', title: 'Мне вам оценку на двоих делить?', body: 'В кадре второй человек. Тест проходят в одиночку.', severity: 'HIGH' },
  FACE_LOST:  { icon: '🫥', title: 'Вернись в кадр', body: 'Лицо не видно. Сядь перед камерой.', severity: 'HIGH' },
  HAND_BELOW: { icon: '✋', title: 'Держи руки на виду', body: 'Руки должны быть видны на столе.', severity: 'MEDIUM' },
  SWIPE:      { icon: '😠', title: 'Без подсказок!', body: 'Жесты руками запрещены.', severity: 'HIGH' },
  PHONE_DETECTED:    { icon: '📱', title: 'УБЕРИ ТЕЛЕФОН', body: 'Телефон в кадре. Устройства запрещены.', severity: 'HIGH' },
  BOOK_DETECTED:     { icon: '📖', title: 'Убери конспект', body: 'Книга или конспект в кадре.', severity: 'HIGH' },
  SPEECH_CHEAT_DETECTED:   { icon: '🤫', title: 'Не разговаривай', body: 'Разговоры и просьбы о помощи запрещены.', severity: 'HIGH' },
  GESTURE_SIGNAL_DETECTED: { icon: '😠', title: 'Без подсказок!', body: 'Сигнал пальцами зафиксирован.', severity: 'HIGH' },
  CAMERA_OFF: { icon: '📷', title: 'Эй, камеру включи', body: 'Камера отключена во время теста.', severity: 'HIGH' },
  PASTE_DETECTED:    { icon: '📋', title: 'Вставка текста запрещена', body: 'Обнаружена вставка из буфера обмена.', severity: 'HIGH' },
  // Suppressed inside the real exam: Testing.tsx runs its own blur/tab budget
  // with a suspend flow, and two systems punishing the same action confused
  // students who had already been warned once.
  TAB_SWITCH:        { icon: '🔀', title: 'Вернись на страницу теста', body: 'Смена вкладки зафиксирована.', severity: 'HIGH' },
  // Light anomaly is telemetry-only now — kept for type completeness.
  LIGHT_ANOMALY:     { icon: '💡', title: '', body: '', severity: 'LOW' },
  // Lip reading is disabled — telemetry runs but never warns.
  SILENT_LIP_SPEAKING_DETECTED: { icon: '👄', title: '', body: 'Нарушений не выявлено', severity: 'LOW' },
  FAST_ANSWER: { icon: '⚡', title: '', body: '', severity: 'LOW' }, // disabled
};

// ── 1. DISTANCE-INDEPENDENT MAR (MOUTH ASPECT RATIO) VISEME CLASSIFIER ──
function classifyMicroViseme(landmarks: { x: number; y: number; z: number }[]): {
  mar: number;
  outerMar: number;
  lipWidth: number;
  viseme: ProctoringTelemetry['currentViseme'];
  label: string;
  phonemeChar: string;
  kinematicVector: number[];
} {
  if (!landmarks || landmarks.length < 468) {
    return { mar: 0, outerMar: 0, lipWidth: 0, viseme: 'RESTING', label: 'Покой', phonemeChar: '', kinematicVector: [0,0,0,0,0,0] };
  }

  const upperInner = landmarks[13];
  const lowerInner = landmarks[14];
  const upperOuter = landmarks[0];
  const lowerOuter = landmarks[17];
  const leftCorner = landmarks[61];
  const rightCorner = landmarks[291];

  if (!upperInner || !lowerInner || !leftCorner || !rightCorner) {
    return { mar: 0, outerMar: 0, lipWidth: 0, viseme: 'RESTING', label: 'Покой', phonemeChar: '', kinematicVector: [0,0,0,0,0,0] };
  }

  const lipHeight = Math.hypot(upperInner.x - lowerInner.x, upperInner.y - lowerInner.y);
  const lipWidth = Math.hypot(leftCorner.x - rightCorner.x, leftCorner.y - rightCorner.y);
  const outerDist = upperOuter && lowerOuter ? Math.hypot(upperOuter.x - lowerOuter.x, upperOuter.y - lowerOuter.y) : lipHeight * 1.5;
  
  // MAR - ключевой показатель. При разговоре он обычно от 0.05 до 0.3+
  const mar = lipWidth > 0 ? lipHeight / lipWidth : 0;
  const outerMar = lipWidth > 0 ? outerDist / lipWidth : 0;

  const kinematicVector = [
    parseFloat(mar.toFixed(3)),
    parseFloat(outerMar.toFixed(3)),
    parseFloat(lipWidth.toFixed(3)),
    0, 0, 0
  ];

  // 1. Смыкание губ (П, Б, М) — высота почти нулевая
  if (mar < 0.03) {
    return { mar, outerMar, lipWidth, viseme: 'CLOSED_P_B_M', label: '👄 Смыкание [П, Б, М]', phonemeChar: 'П', kinematicVector };
  }
  // 2. Широкое открытие (А, Э) — рот сильно открыт
  if (mar > 0.35) {
    return { mar, outerMar, lipWidth, viseme: 'OPEN_A_E', label: '👄 Открытие рта [А, Э]', phonemeChar: 'А', kinematicVector };
  }
  // 3. Улыбка / Растяжение (И, Е, В, С, З) — рот приоткрыт, но очень широкий
  if (mar > 0.03 && mar < 0.15 && lipWidth > 0.18) {
    return { mar, outerMar, lipWidth, viseme: 'STRETCH_I_E', label: '👄 Растяжение [И, Е, С]', phonemeChar: 'С', kinematicVector };
  }
  // 4. Овал / Трубка (О, У) — высота средняя, ширина сужена
  if (mar > 0.20 && mar < 0.35 && lipWidth < 0.15) {
    return { mar, outerMar, lipWidth, viseme: 'ROUND_O_U', label: '👄 Овал/Трубка [О, У]', phonemeChar: 'О', kinematicVector };
  }
  // 5. Зубной шепот (Ф, В) — минимальное открытие
  if (mar >= 0.15 && mar <= 0.20) {
    return { mar, outerMar, lipWidth, viseme: 'DENTAL_F_V', label: '👄 Шепот [В, Ф, Т]', phonemeChar: 'В', kinematicVector };
  }

  return { mar, outerMar, lipWidth, viseme: 'RESTING', label: 'Покой', phonemeChar: '', kinematicVector };
}

// ── 2. FUZZY MATCHING VSR STREAM SYNTHESIZER (REGEX PATTERNS) ──
export interface VSRDecodedPhrase {
  text: string;
  signaledOption?: string;
  confidence: number;
  reasoning: string;
}

function synthesizeLipPhonemesToText(visemeHistory: string[]): VSRDecodedPhrase {
  // 1. Словарь конвертации длинных названий в простые буквы (якоря)
  const vMap: Record<string, string> = {
    'CLOSED_P_B_M': 'П', // Смыкание
    'STRETCH_I_E': 'И',  // Растяжение (Улыбка)
    'ROUND_O_U': 'О',    // Трубочка / Овал
    'OPEN_A_E': 'А',     // Широко открыт
    'DENTAL_F_V': 'В',   // Шепот / Зубной
    'RESTING': '_'       // Покой
  };

  // 2. Превращаем историю (45 кадров) в массив букв и выкидываем паузы ('_')
  const rawStream = visemeHistory.map(v => vMap[v] || '_').filter(char => char !== '_');

  // 3. Сжимаем дубликаты (например, ['П', 'П', 'П', 'О', 'О'] превращается в "ПО")
  const compressedStream = rawStream.filter((char, index, arr) => index === 0 || char !== arr[index - 1]).join('');

  if (compressedStream.length < 2) {
    return { text: '', confidence: 0, reasoning: 'Недостаточно кинематических движений' };
  }

  // 4. НЕЧЕТКИЙ ПОИСК (Fuzzy Matching через Regex)
  // .* означает "любые другие микро-движения между нужными звуками"

  // Паттерн "Первый вариант (А)" (П -> И/Е -> В/Ф)
  if (/П.*И.*В/.test(compressedStream) || /П.*О.*В/.test(compressedStream)) {
    return { text: 'первый вариант (А)', signaledOption: 'A', confidence: 85, reasoning: 'Якоря "П-И-В": первый вариант (А)' };
  }

  // Паттерн "Второй вариант (Б)" (В/Ф -> О -> И)
  if (/В.*О.*И/.test(compressedStream) || /В.*А.*О/.test(compressedStream)) {
    return { text: 'второй вариант (Б)', signaledOption: 'B', confidence: 85, reasoning: 'Якоря "В-О-И": второй вариант (Б)' };
  }

  // Паттерн "Третий вариант (В)" (В/Т -> И -> И)
  if (/В.*И.*И/.test(compressedStream) || /И.*В.*И/.test(compressedStream)) {
    return { text: 'третий вариант (В)', signaledOption: 'C', confidence: 80, reasoning: 'Якоря "В-И-И": третий вариант (В)' };
  }

  // Паттерн "Четвертый вариант (Г)" (Ч/О/А -> В -> О)
  if (/О.*В.*О/.test(compressedStream) || /А.*В.*О/.test(compressedStream)) {
    return { text: 'четвертый вариант (Г)', signaledOption: 'D', confidence: 80, reasoning: 'Якоря "О-В-О": четвертый вариант (Г)' };
  }

  // Паттерн "Сири / Гугл / Помоги"
  if (/О.*У.*О/.test(compressedStream)) {
    return { text: 'окей гугл', confidence: 90, reasoning: 'Якоря "О-У-О": окей гугл' };
  }

  if (/П.*О.*П/.test(compressedStream) || /П.*О.*В/.test(compressedStream)) {
    return { text: 'помоги что во втором', signaledOption: 'B', confidence: 90, reasoning: 'Якоря "П-О-П": помоги что во втором' };
  }

  if (/И.*И/.test(compressedStream) && compressedStream.length <= 4) {
    return { text: 'сири', confidence: 70, reasoning: 'Якоря "И-И": сири' };
  }

  // Если ни одно слово не подошло, возвращаем сжатый поток букв для живой отладки
  return { text: `бормочет: [${compressedStream}]`, confidence: 50, reasoning: `Поток висем: [${compressedStream}]` };
}

// ── 3. FINGER GESTURE CLASSIFIER ──
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

  // A finger counts as extended only if its tip is farther from the wrist than
  // its own middle joint. The previous rule was `tip.y < pip.y`, which only
  // holds for an upright hand: a hand resting flat on the desk or rotated
  // sideways read as two extended fingers and fired a HIGH "gesture signal"
  // violation at a student who was simply sitting still.
  const middleMcp = landmarks[9];
  const palmSpan = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y) || 0.0001;
  const distFromWrist = (p: { x: number; y: number }) => Math.hypot(p.x - wrist.x, p.y - wrist.y);
  const isExtended = (tip: { x: number; y: number }, pip: { x: number; y: number }) =>
    distFromWrist(tip) > distFromWrist(pip) * 1.15;

  const isIndexUp = isExtended(indexTip, indexPip);
  const isMiddleUp = isExtended(middleTip, middlePip);
  const isRingUp = isExtended(ringTip, ringPip);
  const isPinkyUp = isExtended(pinkyTip, pinkyPip);

  // Only trust finger counting when the palm is roughly upright and fully in
  // view. A tilted/edge-on hand gives unreliable landmarks, and misreading it
  // as a "signal to a helper" is exactly the false positive we're removing.
  const palmVerticality = Math.abs(wrist.y - middleMcp.y) / palmSpan;
  const isPalmUpright = palmVerticality > 0.55 && middleMcp.y < wrist.y;

  const isThumbOut = Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y) > Math.hypot(thumbMcp.x - wrist.x, thumbMcp.y - wrist.y) * 1.20;

  let count = 0;
  if (isIndexUp) count++;
  if (isMiddleUp) count++;
  if (isRingUp) count++;
  if (isPinkyUp) count++;

  if (!isPalmUpright) {
    // Hand present but not in a readable orientation — report it as a neutral
    // palm so telemetry still shows the hand, without accusing anyone.
    return { gesture: 'NONE', label: 'Ладонь', extendedFingers: count };
  }

  if (isThumbOut && !isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
    if (thumbTip.y < wrist.y - 0.08) {
      return { gesture: 'THUMBS_UP', label: '👍 Палец вверх (Да / Верно)', extendedFingers: 1 };
    } else if (thumbTip.y > wrist.y + 0.08) {
      return { gesture: 'THUMBS_DOWN', label: '👎 Палец вниз (Нет / Ошибка)', extendedFingers: 1 };
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

// ── 4. DYNAMIC SEMANTIC INTENT CLASSIFIER ──
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

  // Note the bare "эй" is gone: it matched the interjection on its own, so a
  // student muttering "эй, ну ладно" was scored 95% "talking to an AI
  // assistant" and got a HIGH violation. Wake-words must now be the actual
  // assistant names, or "эй" bound to one of them.
  const hasAiOrDeviceCall = /(?:сири|siri|окей гугл|эй гугл|гугл|яндекс|алиса|сафари|гпт|gpt|chatgpt|джипити|эй чувак|эй брат)/i.test(clean);
  if (hasAiOrDeviceCall) {
    return {
      probability: 95,
      intentCategory: 'AI_PROMPT',
      reasoning: 'Обращение к ИИ-ассистенту или помощнику ("сири", "эй чувак", "гугл")'
    };
  }

  // A bare ordinal ("первое", "второй") no longer counts on its own — students
  // routinely read the numbered options aloud while thinking, and that alone
  // was scored 90%. An ordinal now only matters when paired with an explicit
  // ask ("подскажи второе", "какой ответ").
  const hasAskVerb = /(?:что в|что во|какой|какая|какое|че там|чо там|подскажи|помоги|скажи|выбери|ответ)/i.test(clean);
  const hasOrdinalReference = /(?:перв(?:ое|ый|ом)|втор(?:ое|ой|ом)|треть(?:е|ий|ем)|четверт(?:ое|ый|ом)|пят(?:ое|ый|ом)|вариант|букв)/i.test(clean);
  const hasConversationalAnswerPrompt = hasAskVerb && hasOrdinalReference;

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

// ── 5. ACOUSTIC WHISPER & DSP CLASSIFIER ──
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

/** Which detectors a tenant has switched on. Absent flags default to enabled. */
export interface ProctoringDetectorFlags {
  gazeAway?: boolean;
  faceCount?: boolean;
  handTracking?: boolean;
  audioAnalysis?: boolean;
  phoneDetection?: boolean;
}

/** Event types each tenant-facing detector flag governs. */
const DETECTOR_EVENT_MAP: Record<keyof ProctoringDetectorFlags, ProctoringEvent['type'][]> = {
  gazeAway: ['GAZE_LEFT', 'GAZE_RIGHT'],
  faceCount: ['EXTRA_FACE', 'FACE_LOST'],
  handTracking: ['HAND_BELOW', 'SWIPE', 'GESTURE_SIGNAL_DETECTED'],
  audioAnalysis: ['SPEECH_CHEAT_DETECTED'],
  phoneDetection: ['PHONE_DETECTED', 'BOOK_DETECTED'],
};

export function useProctoringEngine(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  isActive: boolean,
  currentQuestionText?: string,
  options?: {
    /** Per-tenant detector switches from the superadmin console. */
    detectors?: ProctoringDetectorFlags;
    /** Event types to drop entirely (the exam suppresses TAB_SWITCH). */
    suppressEvents?: ProctoringEvent['type'][];
    /**
     * Обновлять ли телеметрию в состоянии React.
     *
     * По умолчанию НЕТ. Раньше setTelemetry вызывался на каждом кадре
     * анимации — 60 раз в секунду перерисовывалась вся страница экзамена
     * со всеми вопросами. Ученик физически не мог печатать: каретка прыгала,
     * символы терялись. При этом экзамен телеметрию не читает вообще —
     * она нужна только демо-странице /sandbox/proctor, которая и включает
     * этот флаг.
     */
    liveTelemetry?: boolean;
  }
) {
  const liveTelemetry = options?.liveTelemetry === true;
  // Актуальные значения живут в ref: детекторы читают их между кадрами без
  // участия React. В состояние они попадают, только когда их показывают.
  const liveTelemetryRef = useRef(false);
  liveTelemetryRef.current = liveTelemetry;
  const telemetryRef = useRef<ProctoringTelemetry | null>(null);
  /**
   * Обновление телеметрии. В ref — всегда (дёшево), в состояние React —
   * только если её показывают на экране. На экзамене это убирает 60
   * перерисовок страницы в секунду.
   */
  const setTelemetry = useCallback((updater: (prev: ProctoringTelemetry) => ProctoringTelemetry) => {
    telemetryRef.current = updater(telemetryRef.current || ({} as ProctoringTelemetry));
    if (liveTelemetryRef.current) setTelemetryState(telemetryRef.current);
  }, []);
  const [telemetry, setTelemetryState] = useState<ProctoringTelemetry>({
    headPose: { pitch: 0, yaw: 0, roll: 0 },
    gazeDirection: 'CENTER',
    gazeRatio: 0.5,
    handsDetected: 0,
    handStatus: 'NO_HANDS',
    currentGesture: { gesture: 'NONE', label: 'Нет жеста', extendedFingers: 0 },
    decodedGestureOption: '',
    decodedGestureStream: '',
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
    decodedLipWord: '',
    decodedLipOption: '',
    lipFeatureVector: [0,0,0,0,0,0],
    audioLevel: 0,
    audioStatus: 'SILENT',
    zeroCrossingRate: 0,
    lastTranscript: '',
    speechProbability: 0,
    speechIntentCategory: 'BENIGN',
  });
  if (telemetryRef.current === null) telemetryRef.current = telemetry;

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

  // Lip & Gesture sequence buffers
  const visemeSequenceRef = useRef<string[]>([]);
  const phonemeStreamRef = useRef<string[]>([]);
  const gestureStreamHistoryRef = useRef<string[]>([]);
  const marHistoryRef = useRef<number[]>([]);

  // Anomaly duration tracking
  const gazeViolationStart = useRef<number | null>(null);
  const handBelowStart = useRef<number | null>(null);
  const lightAnomalyStart = useRef<number | null>(null);
  const faceLostStart = useRef<number | null>(null);
  const silentLipStart = useRef<number | null>(null);
  
  // Event cooldown refs
  const lastExtraFaceEvent = useRef<number>(0);
  const lastFaceLostEvent = useRef<number>(0);
  const lastGazeEvent = useRef<number>(0);
  const lastHandBelowEvent = useRef<number>(0);
  const lastSwipeEvent = useRef<number>(0);
  const lastLightEvent = useRef<number>(0);
  const lastPhoneEvent = useRef<number>(0);
  const lastBookEvent = useRef<number>(0);
  // Сколько кадров подряд детектор видит предмет. Одиночного срабатывания
  // недостаточно: EfficientDet на 30% уверенности принимает за телефон
  // тёмный прямоугольник — край монитора, чехол, тень на столе. Обвинить
  // ученика в телефоне по одному такому кадру нельзя.
  const phoneStreak = useRef<number>(0);
  const bookStreak = useRef<number>(0);
  const lastSpeechEvent = useRef<number>(0);
  const lastGestureEvent = useRef<number>(0);
  const lastSilentLipEvent = useRef<number>(0);
  const EVENT_COOLDOWN = 3000;

  // Hand tracking
  const previousWristX = useRef<number | null>(null);
  const swipeConfirmCount = useRef<number>(0);
  const lastWristTime = useRef<number>(0);
  const gestureHoldStart = useRef<number | null>(null);
  const activeGestureNameRef = useRef<string | null>(null);
  
  // Overlay refs
  const faceLandmarksRef = useRef<any[][] | null>(null);
  const detectedObjectsRef = useRef<DetectedObject[]>([]);
  const handLandmarksRef = useRef<any[][] | null>(null);

  // Speech & Audio refs
  const speechRecognitionRef = useRef<any | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentQuestionTextRef = useRef<string | undefined>(currentQuestionText);
  currentQuestionTextRef.current = currentQuestionText;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const addEvent = useCallback((eventInit: Omit<ProctoringEvent, 'id' | 'timestamp'>) => {
    // Single choke point for tenant detector switches and exam-level
    // suppression, so a disabled detector costs no honesty points and never
    // reaches the student's screen or the manager's report.
    const opts = optionsRef.current;
    if (opts?.suppressEvents?.includes(eventInit.type)) return;
    const detectors = opts?.detectors;
    if (detectors) {
      for (const [flag, types] of Object.entries(DETECTOR_EVENT_MAP)) {
        if (types.includes(eventInit.type) && detectors[flag as keyof ProctoringDetectorFlags] === false) {
          return;
        }
      }
    }

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

  // Speech Recognition & AudioContext
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

            // 75, not 60: the classifier's mid band is where innocent thinking
            // aloud lands, and a false accusation of cheating is far costlier
            // here than a missed whisper.
            if (probability >= 75 && Date.now() - lastSpeechEvent.current > EVENT_COOLDOWN) {
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
          if (e.error === 'network' || e.error === 'aborted' || e.error === 'audio-capture') {
            setTimeout(() => {
              try { speechRecognitionRef.current?.start(); } catch (err) {}
            }, 500);
          }
        };

        recognition.onend = () => {
          if (speechRecognitionRef.current) {
            setTimeout(() => {
              try { speechRecognitionRef.current?.start(); } catch (err) {}
            }, 300);
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

  // MediaPipe initialization
  useEffect(() => {
    let active = true;

    async function initModels() {
      try {
        setIsLoading(true);
        setLoadingProgress('1/3 Загрузка движка WebAssembly...');
        
        // Served from our own origin (public/mediapipe-wasm, copied from the
        // installed @mediapipe/tasks-vision package). The 11.7 MB WASM runtime
        // took 23-53s from jsdelivr on a real connection — the exam ran
        // unsupervised that whole time.
        const vision = await FilesetResolver.forVisionTasks('/mediapipe-wasm');

        setLoadingProgress('2/3 Загрузка нейросетей лица и рук...');
        try {
          faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: '/mediapipe-models/face_landmarker.task',
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
              modelAssetPath: '/mediapipe-models/face_landmarker.task',
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
              modelAssetPath: '/mediapipe-models/hand_landmarker.task',
              delegate: 'GPU'
            },
            numHands: 2,
            runningMode: 'VIDEO'
          });
        } catch (e) {
          handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: '/mediapipe-models/hand_landmarker.task',
              delegate: 'CPU'
            },
            numHands: 2,
            runningMode: 'VIDEO'
          });
        }

        // Start analysing the moment face and hands exist. Even served from
        // our own origin the four model files are ~30 MB, which measured 53s
        // on a real connection — and the object detector is the last 13s of
        // that. Waiting for it meant the exam ran unsupervised throughout,
        // silently. Phone detection simply joins a few seconds later.
        //
        // Deliberately NOT guarded by a timeout or per-run ownership: an
        // earlier attempt did both, and under StrictMode (the init effect runs
        // twice, sharing these refs) the cancellation logic closed models the
        // surviving run was still using, killing detection outright.
        if (active) {
          setIsReady(true);
        }

        setLoadingProgress('3/3 Загрузка нейросети предмета (EfficientDet)...');
        try {
          objectDetectorRef.current = await ObjectDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: '/mediapipe-models/efficientdet_lite0.tflite',
              delegate: 'GPU'
            },
            scoreThreshold: 0.30,
            runningMode: 'VIDEO'
          });
        } catch (e) {
          try {
            objectDetectorRef.current = await ObjectDetector.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: '/mediapipe-models/efficientdet_lite0.tflite',
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

  // Processing Loop
  const processFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const now = performance.now();
    
    fpsFrameCount.current++;
    let currentFps: number | undefined;
    if (now - lastFpsTime.current >= 1000) {
      currentFps = fpsFrameCount.current;
      fpsFrameCount.current = 0;
      lastFpsTime.current = now;
    }

    const updates: Partial<ProctoringTelemetry> = {};
    let isViolatingThisFrame = false;

    // ── 1. FACE PROCESSING & VSR CONTINUOUS LIP TRANSCRIPTER (~20 FPS) ──
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

          // HIGH-PRECISION VSR MICRO-MOTION VISEME & FUZZY REGEX SYNTHESIZER
          const microRes = classifyMicroViseme(landmarks);
          updates.mouthAspectRatio = microRes.mar;
          updates.currentViseme = microRes.viseme;
          updates.visemeLabel = microRes.label;
          updates.lipFeatureVector = microRes.kinematicVector;

          // 1. Добавляем в буфер истории
          visemeSequenceRef.current.push(microRes.viseme);

          // 🔴 ВАЖНО: Скользящее окно! Удаляем старые кадры, оставляем только последние 45 (~1.5 сек)
          if (visemeSequenceRef.current.length > 45) {
            visemeSequenceRef.current.shift();
          }

          if (microRes.phonemeChar) {
            const lastPh = phonemeStreamRef.current[phonemeStreamRef.current.length - 1];
            if (lastPh !== microRes.phonemeChar) {
              phonemeStreamRef.current.push(microRes.phonemeChar);
              if (phonemeStreamRef.current.length > 10) phonemeStreamRef.current.shift();
            }
          }

          marHistoryRef.current.push(microRes.mar);
          if (marHistoryRef.current.length > 10) marHistoryRef.current.shift();

          const maxMar = Math.max(...marHistoryRef.current);
          const minMar = Math.min(...marHistoryRef.current);
          const marDelta = maxMar - minMar;

          // Lip reading (Chaplin VSR) removed.
          // It POSTed a 1.5s webm clip of the student's mouth to a hardcoded
          // *.trycloudflare.com tunnel — a dead ephemeral address — on nearly
          // every frame where the mouth moved at all, so it burned bandwidth
          // and CPU for nothing. It also never raised a violation by product
          // decision, so no detection capability is lost. Talking is already
          // caught by the microphone. Mouth telemetry below is kept.
          updates.isSilentLipSpeaking = false;

          // LIGHT ANOMALY DETECTION
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

                // Telemetry only — this no longer raises a violation.
                // The heuristic compares forehead brightness against chin
                // brightness, so a desk lamp, a window below eye level or even a
                // light-coloured shirt reflecting upward made the chin >1.75x
                // brighter and produced a HIGH violation reading "Уберите
                // телефон!" at students who had no phone. It fired on almost
                // everything, so the signal was worthless and actively unfair.
                updates.lightAnomaly = topAvg > 0 && bottomAvg > topAvg * 1.75 && diff > 45;
                lightAnomalyStart.current = null;
              } catch (e) {}
            }
          }
        }
      } catch (e) {
        console.warn('Face landmarker error:', e);
      }
    }

    // ── 2. HAND PROCESSING & GESTURE STREAM DECODER (~5 FPS) ──
    if (now - lastHandProcessTime.current >= 200 && handLandmarkerRef.current) {
      try {
        const handResult = handLandmarkerRef.current.detectForVideo(video, now);
        lastHandProcessTime.current = now;

        const handLandmarksList = (handResult as any)?.landmarks || (handResult as any)?.handLandmarks || [];
        const handsCount = handLandmarksList.length;
        updates.handsDetected = handsCount;
        handLandmarksRef.current = handLandmarksList;

        if (handsCount === 0) {
          updates.handStatus = 'NO_HANDS';
          updates.currentGesture = { gesture: 'NONE', label: 'Нет жеста', extendedFingers: 0 };
          updates.decodedGestureOption = '';
          handBelowStart.current = null;
          previousWristX.current = null;
        } else {
          let isBelow = false;
          let activeGesture: HandGestureResult = { gesture: 'NONE', label: 'Ладонь', extendedFingers: 0 };

          for (const handLandmarks of handLandmarksList) {
            const wrist = handLandmarks[0];
            
            // 0.88, not 0.72: at 0.72 a hand simply resting on the desk falls
            // into the "below desk" band of a normal webcam frame and every
            // student got flagged for sitting still. Only a hand that has
            // genuinely dropped out of frame counts now.
            if (wrist.y > 0.88) {
              isBelow = true;
            }

            const gestureRes = classifyHandGesture(handLandmarks);
            if (gestureRes.gesture !== 'NONE') {
              activeGesture = gestureRes;
              
              if ((gestureRes.signaledOption || gestureRes.gesture === 'PHONE_HAND_SIGNAL') && wrist.y < 0.65) {
                const optText = gestureRes.signaledOption ? `Вариант ${gestureRes.signaledOption}` : 'Телефон';
                updates.decodedGestureOption = optText;

                // Require holding the gesture continuously for at least 1.5 seconds before triggering violation
                if (!gestureHoldStart.current || activeGestureNameRef.current !== gestureRes.gesture) {
                  gestureHoldStart.current = now;
                  activeGestureNameRef.current = gestureRes.gesture;
                } else if (now - gestureHoldStart.current >= 1500) {
                  const lastStreamOpt = gestureStreamHistoryRef.current[gestureStreamHistoryRef.current.length - 1];
                  if (gestureRes.signaledOption && lastStreamOpt !== gestureRes.signaledOption) {
                    gestureStreamHistoryRef.current.push(gestureRes.signaledOption);
                    if (gestureStreamHistoryRef.current.length > 5) gestureStreamHistoryRef.current.shift();
                  }
                  updates.decodedGestureStream = gestureStreamHistoryRef.current.join(' ➔ ');

                  if (now - lastGestureEvent.current > EVENT_COOLDOWN) {
                    addEventRef.current({
                      type: 'GESTURE_SIGNAL_DETECTED',
                      severity: 'HIGH',
                      description: `✋ Удержание жеста (1.5с): Передан сигнал "${optText}" (${gestureRes.label})`
                    });
                    lastGestureEvent.current = now;
                  }
                  isViolatingThisFrame = true;
                }
              } else {
                gestureHoldStart.current = null;
                activeGestureNameRef.current = null;
              }
            } else {
              gestureHoldStart.current = null;
              activeGestureNameRef.current = null;
            }

            if (previousWristX.current !== null) {
              const dt = now - lastWristTime.current;
              if (dt > 0 && dt <= 300) {
                const dx = Math.abs(wrist.x - previousWristX.current);
                // Require the fast motion on two consecutive frames. A single
                // frame over the threshold is usually a tracking jump or the
                // student reaching for the mouse, and it fired instantly with
                // no hold at all.
                if (dx > 0.20) {
                  swipeConfirmCount.current += 1;
                } else {
                  swipeConfirmCount.current = 0;
                }
                if (swipeConfirmCount.current >= 2 && now - lastSwipeEvent.current > EVENT_COOLDOWN) {
                  addEventRef.current({
                    type: 'SWIPE',
                    severity: 'HIGH',
                    description: 'Резкий свайп-жест рукой (переключение на смартфоне).'
                  });
                  lastSwipeEvent.current = now;
                  swipeConfirmCount.current = 0;
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
            else if (now - handBelowStart.current > 3000) {
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

    // ── 3. OBJECT DETECTION (~4 FPS) ──
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
              // 55% уверенности и три кадра подряд: настоящий телефон в руке
              // держится в кадре секундами, случайная тень — нет.
              phoneStreak.current = cat.score >= 0.55 ? phoneStreak.current + 1 : 0;
              if (phoneStreak.current >= 3 && now - lastPhoneEvent.current > EVENT_COOLDOWN) {
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
              // То же для конспекта: на срезе перед человеком лежит черновик,
              // и белый лист бумаги не должен становиться обвинением.
              bookStreak.current = cat.score >= 0.55 ? bookStreak.current + 1 : 0;
              if (bookStreak.current >= 3 && now - lastBookEvent.current > EVENT_COOLDOWN) {
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

        // Предмет ушёл из кадра — серия прерывается. Без этого счётчик копил
        // бы разрозненные срабатывания за весь экзамен и однажды выстрелил.
        if (!hasPhone) phoneStreak.current = 0;
        if (!hasBook) bookStreak.current = 0;

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

  // Camera cut detection. Previously there was none: covering the lens or
  // unplugging the webcam only surfaced as FACE_LOST, and killing the track
  // outright made detectForVideo throw into a silent catch — so a student could
  // simply switch the camera off and the session looked normal.
  useEffect(() => {
    if (!isActive) return;
    const video = videoRef.current;
    const stream = video && (video.srcObject as MediaStream | null);
    if (!stream) return;

    const tracks = stream.getVideoTracks();
    if (tracks.length === 0) return;

    let reported = false;
    const report = (reason: string) => {
      if (reported) return;
      reported = true;
      addEventRef.current({ type: 'CAMERA_OFF', severity: 'HIGH', description: `Камера отключена во время теста (${reason}).` });
    };

    const onEnded = () => report('поток завершён');
    const onMute = () => report('поток заглушен');
    tracks.forEach((t) => {
      t.addEventListener('ended', onEnded);
      t.addEventListener('mute', onMute);
    });

    // A track can go to readyState 'ended' without firing the event on some
    // browsers, so poll as a backstop.
    const poll = window.setInterval(() => {
      if (tracks.some((t) => t.readyState === 'ended')) report('камера недоступна');
      else if (tracks.every((t) => !t.enabled)) report('камера выключена');
    }, 2000);

    return () => {
      window.clearInterval(poll);
      tracks.forEach((t) => {
        t.removeEventListener('ended', onEnded);
        t.removeEventListener('mute', onMute);
      });
    };
  }, [isActive, videoRef]);

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
