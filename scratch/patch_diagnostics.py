import re

with open('scratch/Code_final.gs', 'r') as f:
    code = f.read()

# Add MACRO_MAP if not exists
macro_map_code = """
const MACRO_MAP = {
  "russian": [
    { macro: "Лексика и Орфоэпия", keywords: ["Орфоэпия", "Ударени", "Лексика", "Пароним", "Фразеологизм"] },
    { macro: "Орфография: НЕ/НИ, слитное и раздельное", keywords: ["НЕ", "НИ", "слитно", "раздельно", "частиц", "деепричастиями", "союзов"] },
    { macro: "Орфография: Суффиксы и окончания", keywords: ["суффикс", "окончани", "НН", "причасти", "глаголов"] },
    { macro: "Орфография: Корни и приставки", keywords: ["корень", "приставк", "безударн", "чередующ", "гласн", "согласн"] },
    { macro: "Пунктуация", keywords: ["пунктуация", "бсп", "ссп", "запятые", "оборот", "вводные", "обособленных", "однородных", "тире", "двоеточие", "кавычки", "обращения", "междометия", "сложное предложение", "придаточная"] },
    { macro: "Грамматика и Синтаксис", keywords: ["Грамматика", "Синтаксис", "подлежащее", "сказуемое", "ошибка", "речевые", "основа", "предложение"] },
    { macro: "Морфология", keywords: ["Морфология", "часть речи", "существительное", "прилагательное", "глагол", "местоимение", "наречие"] },
    { macro: "Работа с текстом", keywords: ["Текст", "смысл", "тема", "микротема", "выразительности"] }
  ],
  "math": [
    { macro: "Алгебра", keywords: ["Алгебра", "уравнения", "неравенства", "система", "функции", "графики", "корни", "степени", "дроби", "логарифмы"] },
    { macro: "Геометрия", keywords: ["Геометрия", "площадь", "периметр", "треугольник", "окружность", "угол", "объем"] },
    { macro: "Текстовые задачи", keywords: ["Задача", "движение", "работа", "проценты", "смеси"] },
    { macro: "Арифметика", keywords: ["Арифметика", "вычисления", "числа", "пропорции"] }
  ],
  "logic": [
    { macro: "Логическое мышление", keywords: ["Логика", "матрицы", "очереди", "утверждения", "загадки", "вычисления", "работу"] }
  ],
  "english": [
    { macro: "Grammar: Tenses", keywords: ["Tense", "Present", "Past", "Future", "Perfect", "Continuous"] },
    { macro: "Grammar: Conditionals & Modals", keywords: ["Conditionals", "Modal", "If"] },
    { macro: "Vocabulary & Structure", keywords: ["Prepositions", "Vocabulary", "Order", "Correction", "Words", "Quantifiers", "Comparatives", "Phrasal", "Linking", "Reading", "Comprehension", "Reordering"] }
  ]
};

function getMacroCategory(topicText, subjectKey) {
  if (!topicText) return "Основные навыки";
  let map = MACRO_MAP[subjectKey] || [];
  for (let item of map) {
    if (item.keywords.some(kw => topicText.toLowerCase().includes(kw.toLowerCase()))) {
      return item.macro;
    }
  }
  return "Основные навыки";
}
"""

if "MACRO_MAP" not in code:
    code = code.replace("function calculateScores(grade, answers) {", macro_map_code + "\nfunction calculateScores(grade, answers) {")

diagnostics_init = """
  let diagnosticsRaw = {};
  
  function initPossible(subject, keyMap) {
    Object.keys(keyMap).forEach(qId => {
      let qData = keyMap[qId];
      if (!qData.topic || qData.topic === "Общая тема") return;
      let macro = getMacroCategory(qData.topic, subject);
      if (!diagnosticsRaw[macro]) diagnosticsRaw[macro] = { earned: 0, possible: 0, subject: subject };
      diagnosticsRaw[macro].possible += (qData.pts || 1);
    });
  }
  
  function addEarned(subject, qId, keyMap) {
    let qData = keyMap[qId];
    if (!qData.topic || qData.topic === "Общая тема") return;
    let macro = getMacroCategory(qData.topic, subject);
    if (diagnosticsRaw[macro]) {
      diagnosticsRaw[macro].earned += (qData.pts || 1);
    }
  }

  initPossible("russian", keys.russian || {});
  initPossible("math", keys.math || {});
  initPossible("logic", keys.logic || {});
  initPossible("english", keys.english || {});
"""

# Inject diagnostics init
code = code.replace("let ru = 0, ma = 0, lo = 0, en = 0;", "let ru = 0, ma = 0, lo = 0, en = 0;\n" + diagnostics_init)

# Replace all ru += pts with ru += pts; addEarned("russian", qId, keys.russian)
code = re.sub(r'ru \+= keys\.russian\[qId\]\.pts;', r'ru += keys.russian[qId].pts; addEarned("russian", qId, keys.russian);', code)
code = re.sub(r'ru \+= pts;', r'ru += pts; addEarned("russian", qId, keys.russian);', code)
code = re.sub(r'ma \+= pts;', r'ma += pts; addEarned("math", qId, keys.math);', code)
code = re.sub(r'lo \+= pts;', r'lo += pts; addEarned("logic", qId, keys.logic);', code)
code = re.sub(r'en \+= pts;', r'en += pts; addEarned("english", qId, keys.english);', code)

# Change return of calculateScores
code = code.replace("return { russian: ru, math: ma, logic: lo, english: en };", "return { scores: { russian: ru, math: ma, logic: lo, english: en }, diagnosticsRaw };")

# Change submitTest to extract scores
code = re.sub(
    r'scores = calculateScores\(grade, answers\);',
    r'let result = calculateScores(grade, answers);\n        scores = result.scores;',
    code
)

# Change recheckScores to extract and return diagnosticsRaw
recheck_pattern = r'const newScores = calculateScores\(student\.grade, answersObj\);\n\s*const totalScore = newScores\.russian \+ newScores\.math \+ newScores\.logic;\n\s*safeSetValue\(testSheet, student\.row, 4, newScores\.russian\);\n\s*safeSetValue\(testSheet, student\.row, 5, newScores\.math\);\n\s*safeSetValue\(testSheet, student\.row, 6, newScores\.logic\);\n\s*safeSetValue\(testSheet, student\.row, 7, totalScore\);\n\s*safeSetValue\(testSheet, student\.row, 13, newScores\.english\);'
recheck_replacement = """const result = calculateScores(student.grade, answersObj);
      const newScores = result.scores;
      const diagnosticsRaw = result.diagnosticsRaw;
      const totalScore = newScores.russian + newScores.math + newScores.logic;
      
      safeSetValue(testSheet, student.row, 4, newScores.russian);
      safeSetValue(testSheet, student.row, 5, newScores.math);
      safeSetValue(testSheet, student.row, 6, newScores.logic);
      safeSetValue(testSheet, student.row, 7, totalScore);
      safeSetValue(testSheet, student.row, 13, newScores.english);"""

code = re.sub(recheck_pattern, recheck_replacement, code)

# Update return statement for recheckScores
code = code.replace(
    'return ContentService.createTextOutput(JSON.stringify({ success: true, scores: newScores })).setMimeType(ContentService.MimeType.JSON);',
    'return ContentService.createTextOutput(JSON.stringify({ success: true, scores: newScores, diagnosticsRaw })).setMimeType(ContentService.MimeType.JSON);'
)

with open('scratch/Code_Fixed.gs', 'w') as f:
    f.write(code)

print("Code_Fixed.gs has been updated safely.")
