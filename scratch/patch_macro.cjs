const fs = require('fs');

let code = fs.readFileSync('scratch/Code.js', 'utf8');

// Find the calculateScores function
const getMacroFn = `
const MACRO_MAP = {
  "russian": [
    { macro: "Орфография", keywords: ["Орфография", "суффикс", "Гласная", "НН", "НЕ", "приставк", "корень", "слитное", "дефисное", "раздельное"] },
    { macro: "Пунктуация", keywords: ["Пунктуация", "запятые", "оборот", "Вводные", "БСП", "ССП", "СПО", "обособлен", "однородн"] },
    { macro: "Синтаксис и Грамматика", keywords: ["Синтаксис", "Грамматика", "основа", "односостав", "сказуем", "связи", "словосочетан", "морфология", "склонение"] },
    { macro: "Лексика и Речь", keywords: ["Лексика", "Пароним", "Фразеологизм", "Ударение", "Орфоэпия", "смыслов", "значение", "обращения"] }
  ],
  "math": [
    { macro: "Алгебра и Вычисления", keywords: ["дроби", "корни", "выражен", "числа", "степен", "многочлен", "прогресси", "умножения"] },
    { macro: "Уравнения и Неравенства", keywords: ["уравнен", "неравенств", "систем", "интервал"] },
    { macro: "Функции и Графики", keywords: ["Функци", "график", "парабол", "гипербол", "производная", "логарифм", "тригонометр"] },
    { macro: "Геометрия", keywords: ["Геометрия", "Пифагор", "треугольник", "вектор", "площадь", "угол", "углы", "стереометрия", "планиметрия"] },
    { macro: "Текстовые задачи", keywords: ["Текстовые", "движение", "работу", "проценты", "вероятность", "доли", "совместную"] }
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
`;

const calculateScoresReplacement = `
  let ru = 0, ma = 0, lo = 0, en = 0;
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
  
  function addEarned(subject, qId, keyMap, isCorrect) {
    if (!isCorrect) return;
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

  if (answers && typeof answers === 'object') {
    Object.keys(keys.russian || {}).forEach(qId => {
      let userAnsStr = answers[qId] ? String(answers[qId]).trim() : "";
      let userAnsLower = userAnsStr.toLowerCase();
      let pts = keys.russian[qId].pts || 1;
      let isCorrect = false;
      
      if (String(grade) === "11" && qId === "russian_2") {
        let parts = userAnsLower.split("|");
        let optChoice = parts[0] ? parts[0].trim() : "";
        let wordChoice = parts[1] ? parts[1].trim() : "";
        if (optChoice === "2" && (wordChoice === "наличие" || wordChoice === "наличии")) isCorrect = true;
      } else if (String(grade) === "11" && qId === "russian_8") {
        let parts = userAnsLower.split("|");
        let optChoice = parts[0] ? parts[0].trim() : "";
        let wordChoice = parts[1] ? parts[1].replace(/\\s+/g, '').trim() : "";
        if (optChoice === "4" && (wordChoice === "кверхутотчас" || wordChoice === "тотчаскверху")) isCorrect = true;
      } else if (qId === "ru_5_new") {
        try {
          let userObj = JSON.parse(userAnsStr);
          let val1 = String(userObj["input1"] || "").trim().toLowerCase();
          let val2 = String(userObj["input2"] || "").trim().toLowerCase();
          if (val1 === "нн" && val2 === "н") isCorrect = true;
        } catch(e) {}
      } else if (qId === "ru_8_new" && String(grade) === "10") {
        let val = userAnsLower.replace(/\\s+/g, "");
        if (val === "такжепоэтому" || val === "поэтомутакже") isCorrect = true;
      } else if (qId === "ru_7_new" && String(grade) === "7") {
        try {
          let userObj = JSON.parse(userAnsStr);
          let correctObj = JSON.parse(keys.russian[qId].ans);
          isCorrect = true;
          for (let k in correctObj) { if (userObj[k] !== correctObj[k]) isCorrect = false; }
          for (let k in userObj) { if (userObj[k] !== correctObj[k]) isCorrect = false; }
          if (Object.keys(correctObj).length === 0) isCorrect = false;
        } catch(e) {}
      } else if ((qId === "ru_9" || qId === "ru_10" || qId === "ru_7_new") && keys.russian[qId].ans.startsWith("[")) {
        try {
          let userArr = JSON.parse(userAnsStr);
          let correctArr = JSON.parse(keys.russian[qId].ans);
          if (Array.isArray(userArr) && Array.isArray(correctArr)) {
            userArr.sort();
            correctArr.sort();
            if (userArr.join(",") === correctArr.join(",")) isCorrect = true;
          }
        } catch(e) {}
      } else {
        if (userAnsLower === keys.russian[qId].ans.toLowerCase()) isCorrect = true;
      }
      
      if (isCorrect) {
        ru += pts;
        addEarned("russian", qId, keys.russian, true);
      }
    });

    Object.keys(keys.math || {}).forEach(qId => {
      let userAns = answers[qId] ? String(answers[qId]).trim() : "";
      let pts = keys.math[qId].pts || 1;
      let isCorrect = normalizeString(userAns) === normalizeString(keys.math[qId].ans);
      
      if (isCorrect) {
        ma += pts;
        addEarned("math", qId, keys.math, true);
      }
    });

    Object.keys(keys.logic || {}).forEach(qId => {
      let userAnsStr = answers[qId] ? String(answers[qId]).trim() : "";
      let userAnsLower = userAnsStr.toLowerCase();
      let pts = keys.logic[qId].pts || 1;
      let isCorrect = false;
      
      if (keys.logic[qId].ans.startsWith("{")) {
        try {
          let userObj = JSON.parse(userAnsStr);
          let correctObj = JSON.parse(keys.logic[qId].ans);
          isCorrect = true;
          for (let k in correctObj) {
            if (String(userObj[k] || "").toLowerCase() !== String(correctObj[k]).toLowerCase()) {
              isCorrect = false;
            }
          }
        } catch(e) {}
      } else if (qId === "logic_3") {
        let val = userAnsLower.replace(/\\s+/g, "");
        if (val === "митя,толя" || val === "митя, толя" || val === "митя толя") isCorrect = true;
      } else {
        if (userAnsLower === keys.logic[qId].ans.toLowerCase()) isCorrect = true;
      }
      
      if (isCorrect) {
        lo += pts;
        addEarned("logic", qId, keys.logic, true);
      }
    });

    Object.keys(keys.english || {}).forEach(qId => {
      let userAnsStr = answers[qId] ? String(answers[qId]).trim() : "";
      let pts = keys.english[qId].pts || 1;
      let isCorrect = false;
      
      if (keys.english[qId].ans.startsWith("{")) {
        try {
          let userObj = JSON.parse(userAnsStr);
          let correctObj = JSON.parse(keys.english[qId].ans);
          isCorrect = true;
          for (let k in correctObj) {
            if (String(userObj[k] || "").trim().toLowerCase() !== String(correctObj[k]).trim().toLowerCase()) {
              isCorrect = false;
            }
          }
        } catch(e) {}
      } else {
        if (userAnsStr.toLowerCase() === keys.english[qId].ans.toLowerCase()) isCorrect = true;
      }

      if (isCorrect) {
        en += pts;
        addEarned("english", qId, keys.english, true);
      }
    });
  }
`;

let newCode = code.replace(
  /let ru = 0, ma = 0, lo = 0, en = 0;[\s\S]*?addEarned\("english", qId, keys\.english, true\);\s*\}\s*\n\s*\/\/ Wait, logic requires replacing up to here... we should be careful./g,
  "" 
);

// We'll just replace the body of calculateScores from `let ru = 0, ma = 0, lo = 0, en = 0;` up to the end of the `if (answers)` block.
const startIndex = code.indexOf("let ru = 0, ma = 0, lo = 0, en = 0;");
const endText = "return { scores: { russian: ru, math: ma, logic: lo, english: en }, diagnosticsRaw };";
const endIndex = code.indexOf(endText);

if (startIndex !== -1 && endIndex !== -1) {
  const finalCode = code.substring(0, startIndex) + "\n" + getMacroFn + "\n" + calculateScoresReplacement + "\n  " + code.substring(endIndex);
  fs.writeFileSync('scratch/Code.js', finalCode);
  console.log("Successfully patched calculateScores");
} else {
  console.log("Failed to find indexes");
}
