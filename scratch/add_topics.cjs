const fs = require('fs');

function getTopic(key, ansStr) {
  ansStr = ansStr.toLowerCase();
  
  // LOGIC
  if (key.includes("logic_1") || key.includes("logic_4")) return "Логические матрицы";
  if (key.includes("logic_2")) return "Задачи с ложными утверждениями";
  if (key.includes("logic_3")) return "Упорядочивание и очереди";
  if (key.includes("logic_5")) return "Проценты и доли";
  if (key.includes("logic_6")) return "Задачи на совместную работу";
  if (key.includes("logic_7")) return "Обратные вычисления";
  if (key.includes("logic_8")) return "Задачи на движение";
  
  // MATH
  if (key.includes("ma_") || key.includes("math_")) {
    if (ansStr.includes("x") || ansStr.includes("х") || ansStr.includes("=")) return "Алгебра (Уравнения)";
    if (ansStr.includes("/") && !ansStr.includes("см")) return "Дроби и пропорции";
    if (ansStr.includes("см") || ansStr.includes("мм") || ansStr.includes("м²")) return "Геометрия";
    if (ansStr.includes("часа") || ansStr.includes("минут") || ansStr.includes("км")) return "Текстовые задачи (Движение и Время)";
    if (ansStr.includes(":") || ansStr.includes("*") || ansStr.includes("∙")) return "Арифметические выражения";
    return "Основы математики";
  }
  
  // RUSSIAN
  if (key.includes("ru_") || key.includes("russian_")) {
    if (ansStr.includes("прилагательное") || ansStr.includes("сказуемое") || ansStr.includes("часть речи") || ansStr.includes("член предложения")) return "Морфология и Синтаксис";
    if (ansStr.includes(",") || ansStr.includes("-") || key.includes("ru_7_new") || key.includes("ru_9")) return "Пунктуация";
    if (ansStr.includes("нн") || ansStr.includes("не") || ansStr.includes("пр")) return "Орфография (Приставки, Суффиксы, НЕ/НИ)";
    if (ansStr.includes("четырехстам") || ansStr.includes("пятьдесят")) return "Числительные (Склонение)";
    return "Лексика и Грамматика";
  }
  
  // ENGLISH
  if (key.includes("en_")) {
    if (ansStr.includes("have") || ansStr.includes("has") || ansStr.includes("had")) return "Perfect Tenses";
    if (ansStr.includes("will") || ansStr.includes("would")) return "Future & Conditionals";
    if (ansStr.includes("ing") || ansStr.includes("was") || ansStr.includes("were")) return "Continuous Tenses";
    if (ansStr.includes("however") || ansStr.includes("despite") || ansStr.includes("although")) return "Linking Words";
    if (ansStr.split(" ").length > 3) return "Reading & Comprehension";
    return "Basic Grammar & Vocabulary";
  }
  
  return "Общая тема";
}

let content = fs.readFileSync('scratch/Code.js', 'utf8');

let lines = content.split('\n');
let insideAnswerKeys = false;
let currentKey = null;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  
  if (line.includes('const ANSWER_KEYS = {')) {
    insideAnswerKeys = true;
  }
  
  if (insideAnswerKeys) {
    let keyMatch = line.match(/"([^"]+)"\s*:\s*\{/);
    if (keyMatch) {
      let keyName = keyMatch[1];
      if (!["7", "8", "9", "10", "11", "russian", "math", "logic", "english"].includes(keyName)) {
        currentKey = keyName;
      }
    }
    
    // Check if line contains pts: 1 or "pts": 1 and DOES NOT ALREADY HAVE topic:
    if (currentKey && line.match(/"?pts"?\s*:\s*\d+/) && !line.includes("topic:")) {
      let ansStr = "";
      if (line.includes('ans:')) {
        ansStr = line;
      } else if (i > 0 && lines[i-1].includes('ans')) {
        ansStr = lines[i-1];
      }
      
      let topic = getTopic(currentKey, ansStr);
      
      if (line.endsWith('},')) {
        line = line.replace('},', `, "topic": "${topic}" },`);
      } else if (line.endsWith('}')) {
        line = line.replace('}', `, "topic": "${topic}" }`);
      } else {
        // multiline like "pts": 1
        // we can safely append `, "topic": "..."` to the line if it doesn't end with }
        // replace the `pts: 1` or `"pts": 1` with `... , "topic": "..."`
        line = line.replace(/("?pts"?\s*:\s*\d+)/, `$1, "topic": "${topic}"`);
      }
      lines[i] = line;
      currentKey = null; // reset
    } else if (line.includes("topic:")) {
      currentKey = null; // skip if already tagged
    }
  }
}

fs.writeFileSync('scratch/Code.js', lines.join('\n'));
console.log("Fixed Topics in scratch/Code.js");
