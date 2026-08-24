/**
 * Server-Side TypeScript Scoring Engine
 * 
 * Performs 100% accurate score calculation and topic diagnostics
 * matching the original Google Apps Script implementation.
 */

export type SubjectKey = "russian" | "math" | "logic" | "english";

export interface AnswerKeyEntry {
  ans: string;
  pts: number;
  topic: string;
}

export interface MacroCategory {
  macro: string;
  keywords: string[];
}

export interface ScoresResult {
  russian: number;
  math: number;
  logic: number;
  english: number;
  total: number;
}

export interface DiagnosticItem {
  earned: number;
  possible: number;
  subject: SubjectKey;
}

export type DiagnosticsRaw = Record<string, DiagnosticItem>;

export interface ScoringEngineOutput {
  scores: ScoresResult;
  diagnosticsRaw: DiagnosticsRaw;
  summaryText: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MACRO TOPIC MAPPINGS
// ─────────────────────────────────────────────────────────────────────────────

export const MACRO_MAP: Record<SubjectKey, MacroCategory[]> = {
  russian: [
    { macro: "Орфография: НЕ/НИ, слитное и раздельное", keywords: ["написание не", "написание ни", "не/ни", "слитно", "раздельно", "частиц", "дефис", "слитное", "написание союзов"] },
    { macro: "Орфография: Суффиксы и окончания", keywords: ["суффикс", "окончани", "причасти", "глаголов", "о/ё", "шипящих", "правописание суффикс"] },
    { macro: "Орфография: Корни и приставки", keywords: ["корни и приставки", "безударн", "чередующ", "гласна", "разделительные", "орфографи"] },
    { macro: "Пунктуация: Сложное предложение", keywords: ["бсп", "ссп", "спп", "сложное предложение", "подчинител", "бессоюзн"] },
    { macro: "Пунктуация: Осложненное предложение", keywords: ["оборот", "вводн", "обращени", "однородн", "обособлен", "причастн", "деепричастн", "пунктуация"] },
    { macro: "Синтаксис и Грамматика", keywords: ["синтаксис", "основа", "сказуем", "односостав", "связи", "словосочетан", "числительн", "склонени", "примыкани", "грамматич"] }
  ],
  math: [
    { macro: "Алгебра: Вычисления и преобразования", keywords: ["дроби", "степен", "выражен", "значения", "деление", "многочлены", "вычитание", "умножения", "множител", "делимост", "смешанн", "пропорци", "алгебра", "рациональные", "квадратных корней", "вычисления с", "десятичн"] },
    { macro: "Алгебра: Уравнения и неравенства", keywords: ["уравнен", "неравенств", "системы уравнений", "корень уравнения", "интервал"] },
    { macro: "Функции и графики", keywords: ["функци", "график", "парабол", "гипербол", "производная", "касательная", "координатн"] },
    { macro: "Геометрия", keywords: ["геометрия", "пифагор", "вектор", "площадь", "угол", "треугольник", "хорд", "периметр", "планиметрия", "стереометрия"] },
    { macro: "Текстовые задачи и Прогрессии", keywords: ["текстовые задачи", "движение", "работу", "мотоциклист", "прогресси", "проценты", "единицы измерения", "задачи на движение"] }
  ],
  logic: [
    { macro: "Анализ данных и множества", keywords: ["логические матрицы", "утверждения", "ложные", "истинн", "ящик", "рубашки", "множества"] },
    { macro: "Алгоритмы и последовательности", keywords: ["очереди", "упорядочивание", "закономерност", "обратные вычисления"] },
    { macro: "Логико-математические задачи", keywords: ["логико-математические", "доли", "совместн", "скачк", "раза", "совместную работу", "проценты и доли"] }
  ],
  english: [
    { macro: "Grammar: Basic Tenses (Present/Past)", keywords: ["present simple", "past simple", "present continuous", "past continuous", "basic tenses", "continuous tenses"] },
    { macro: "Grammar: Advanced Tenses (Perfect/Future)", keywords: ["perfect tenses", "future simple", "advanced tenses", "future continuous", "future perfect"] },
    { macro: "Grammar: Conditionals & Modals", keywords: ["conditionals", "modal verbs", "modals", "future & conditionals"] },
    { macro: "Vocabulary & Prepositions", keywords: ["prepositions", "quantifiers", "vocabulary", "linking words", "reading & comprehension"] },
    { macro: "Syntax & Error Correction", keywords: ["correction", "reordering", "structure", "comparatives", "superlatives", "mistake", "error correction"] }
  ]
};

function getFallbackSubjectCategory(subjectKey: SubjectKey): string {
  switch (subjectKey) {
    case "russian": return "Синтаксис и Грамматика";
    case "math": return "Алгебра: Вычисления и преобразования";
    case "logic": return "Логико-математические задачи";
    case "english": return "Vocabulary & Prepositions";
    default: return "Синтаксис и Грамматика";
  }
}

export function getMacroCategory(topicText: string, subjectKey: SubjectKey): string {
  if (!topicText) return getFallbackSubjectCategory(subjectKey);
  const map = MACRO_MAP[subjectKey] || [];
  const lowerTopic = String(topicText).toLowerCase().trim();

  for (const item of map) {
    if (item.keywords.some(kw => lowerTopic.includes(kw))) {
      return item.macro;
    }
  }

  for (const item of map) {
    const macroWords = item.macro.toLowerCase().split(/[\s:,&]+/);
    if (macroWords.some(word => word.length > 3 && lowerTopic.includes(word))) {
      return item.macro;
    }
  }

  return getFallbackSubjectCategory(subjectKey);
}

export function normalizeString(str: any): string {
  if (typeof str !== 'string') return "";
  let s = str.toLowerCase().replace(/\s+/g, "");
  s = s.replace(/,/g, "."); // Convert decimal comma to dot
  s = s.replace(/ё/g, "е").replace(/…/g, ".");
  s = s.replace(/²/g, "^2").replace(/³/g, "^3").replace(/⁴/g, "^4").replace(/⁵/g, "^5").replace(/⁶/g, "^6");
  s = s.replace(/≤/g, "<=").replace(/\\le/g, "<=");
  s = s.replace(/≥/g, ">=").replace(/\\ge/g, ">=");
  s = s.replace(/±/g, "+-").replace(/\\pm/g, "+-");
  s = s.replace(/π/g, "pi").replace(/\\pi/g, "pi");
  s = s.replace(/√/g, "sqrt").replace(/\\sqrt/g, "sqrt");
  s = s.replace(/∈/g, "in").replace(/\\in/g, "in");
  s = s.replace(/∞/g, "infty").replace(/\\infty/g, "infty");
  s = s.replace(/log₃/g, "log_3").replace(/\\log_3/g, "log_3");
  s = s.replace(/log₅/g, "log_5").replace(/\\log_5/g, "log_5");
  s = s.replace(/\\text/g, "").replace(/[{}]/g, "");
  s = s.replace(/∪/g, "u");
  s = s.replace(/α/g, "alpha").replace(/\\alpha/g, "alpha");
  return s;
}

export function isAnswerCorrect(userAnsRaw: any, targetAnsRaw: any): boolean {
  if (userAnsRaw === undefined || userAnsRaw === null) return false;
  const userStr = String(userAnsRaw).trim();
  const targetStr = typeof targetAnsRaw === 'object' && targetAnsRaw?.ans !== undefined ? String(targetAnsRaw.ans).trim() : String(targetAnsRaw).trim();
  if (!userStr || !targetStr) return false;

  const normUser = normalizeString(userStr);
  const normTarget = normalizeString(targetStr);

  if (!normUser) return false;

  // 1. Direct match (normalized)
  if (normUser === normTarget) return true;

  // 2. Multiple choice prefix match (e.g. user chose "2) Текст", target is "2" or "2)")
  // Or user chose "А) 4/9", target is "А" or "A"
  const prefixMatch = userStr.match(/^([1-9A-Za-zА-Яа-яЁё]+)[\)\.\s]/);
  if (prefixMatch) {
    const prefixNorm = normalizeString(prefixMatch[1]);
    if (prefixNorm === normTarget) return true;
  }

  // 3. Substring match for list answers like "нн, н", inline inputs, drag-and-drop, dropdowns
  if (normUser.includes(normTarget) || normTarget.includes(normUser)) {
    // If target is just a single character prefix like "1", "2", "a", "b",
    // only match via prefix to avoid false positives on words containing 'a'
    if (/^[a-z0-9а-я]$/i.test(normTarget)) {
      return prefixMatch ? normalizeString(prefixMatch[1]) === normTarget : normUser.startsWith(normTarget);
    }
    return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORE CALCULATOR FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

export function calculateScoresTs(grade: number | string, answersInput: any, keys: Record<SubjectKey, Record<string, AnswerKeyEntry>>): ScoringEngineOutput {
  if (!keys || Object.keys(keys).length === 0) {
    return {
      scores: { russian: 0, math: 0, logic: 0, english: 0, total: 0 },
      diagnosticsRaw: {},
      summaryText: ""
    };
  }

  let answers: Record<string, any> = {};
  if (typeof answersInput === "string") {
    try {
      answers = JSON.parse(answersInput);
    } catch {
      answers = {};
    }
  } else if (answersInput && typeof answersInput === "object") {
    answers = answersInput;
  }

  let ru = 0, ma = 0, lo = 0, en = 0;
  const diagnosticsRaw: DiagnosticsRaw = {};

  function initPossible(subject: SubjectKey, keyMap: Record<string, AnswerKeyEntry>) {
    if (!keyMap) return;
    Object.keys(keyMap).forEach(qId => {
      const qData = keyMap[qId];
      if (!qData) return;
      const topicText = qData.topic || "";
      const macro = getMacroCategory(topicText, subject);
      if (!diagnosticsRaw[macro]) {
        diagnosticsRaw[macro] = { earned: 0, possible: 0, subject };
      }
      diagnosticsRaw[macro].possible += (qData.pts || 1);
    });
  }

  function addEarned(subject: SubjectKey, qId: string, keyMap: Record<string, AnswerKeyEntry>) {
    const qData = keyMap[qId];
    if (!qData) return;
    const topicText = qData.topic || "";
    const macro = getMacroCategory(topicText, subject);
    if (diagnosticsRaw[macro]) {
      diagnosticsRaw[macro].earned += (qData.pts || 1);
    }
  }

  initPossible("russian", keys.russian || {});
  initPossible("math", keys.math || {});
  initPossible("logic", keys.logic || {});
  initPossible("english", keys.english || {});

  // 1. Russian
  if (keys.russian) {
    Object.keys(keys.russian).forEach(qId => {
      const qEntry = keys.russian[qId];
      if (qEntry && isAnswerCorrect(answers[qId], qEntry)) {
        ru += (qEntry.pts || 1);
        addEarned("russian", qId, keys.russian);
      }
    });
  }

  // 2. Math
  if (keys.math) {
    Object.keys(keys.math).forEach(qId => {
      const qEntry = keys.math[qId];
      if (qEntry && isAnswerCorrect(answers[qId], qEntry)) {
        ma += (qEntry.pts || 1);
        addEarned("math", qId, keys.math);
      }
    });
  }

  // 3. Logic
  if (keys.logic) {
    Object.keys(keys.logic).forEach(qId => {
      const qEntry = keys.logic[qId];
      if (qEntry && isAnswerCorrect(answers[qId], qEntry)) {
        lo += (qEntry.pts || 1);
        addEarned("logic", qId, keys.logic);
      }
    });
  }

  // 4. English
  if (keys.english) {
    Object.keys(keys.english).forEach(qId => {
      const qEntry = keys.english[qId];
      if (qEntry && isAnswerCorrect(answers[qId], qEntry)) {
        en += (qEntry.pts || 1);
        addEarned("english", qId, keys.english);
      }
    });
  }

  const total = ru + ma + lo;

  // Build Diagnostic Summary Text
  const strong: string[] = [];
  const medium: string[] = [];
  const weak: string[] = [];

  Object.entries(diagnosticsRaw).forEach(([macro, data]) => {
    if (data.possible === 0) return;
    const pct = (data.earned / data.possible) * 100;
    if (pct >= 80) strong.push(macro);
    else if (pct >= 40) medium.push(macro);
    else weak.push(macro);
  });

  let summaryText = "";
  if (strong.length > 0) summaryText += `🟢 СИЛЬНЫЕ СТОРОНЫ:\n${strong.join(", ")}\n\n`;
  if (medium.length > 0) summaryText += `🟡 СРЕДНИЙ УРОВЕНЬ:\n${medium.join(", ")}\n\n`;
  if (weak.length > 0) summaryText += `🔴 ЗОНА РОСТА (Нужно подтянуть):\n${weak.join(", ")}`;

  return {
    scores: { russian: ru, math: ma, logic: lo, english: en, total },
    diagnosticsRaw,
    summaryText: summaryText.trim()
  };
}
