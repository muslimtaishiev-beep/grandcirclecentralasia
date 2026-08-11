const fs = require('fs');
let code = fs.readFileSync('scratch/Code_Fixed.gs', 'utf-8');

const newMacro = `const MACRO_MAP = {
  "russian": [
    { 
      macro: "Лексика и Орфоэпия", 
      keywords: ["орфоэпия", "ударени", "лексика", "пароним", "фразеологизм", "значение слова", "словообразование", "морфолог"] 
    },
    { 
      macro: "Орфография: НЕ/НИ, слитное и раздельное", 
      keywords: ["не", "ни", "слитно", "раздельно", "частиц", "деепричастиями", "союзов", "дефис", "слитное"] 
    },
    { 
      macro: "Орфография: Суффиксы и окончания", 
      keywords: ["суффикс", "окончани", "нн", "причасти", "глаголов", "о/ё", "шипящих"] 
    },
    { 
      macro: "Орфография: Корни и приставки", 
      keywords: ["корень", "приставк", "безударн", "чередующ", "гласна", "ъ", "ь", "пре-", "при-", "орфографи"] 
    },
    { 
      macro: "Пунктуация: Сложное предложение", 
      keywords: ["бсп", "ссп", "спп", "сложное", "подчинител", "бессоюзн"] 
    },
    { 
      macro: "Пунктуация: Осложненное предложение", 
      keywords: ["оборот", "вводн", "обращени", "однородн", "обособлен", "причастн", "деепричастн", "пунктуация"] 
    },
    { 
      macro: "Синтаксис и Грамматика", 
      keywords: ["синтаксис", "основа", "сказуем", "односостав", "связи", "словосочетан", "числительн", "склонени", "примыкани", "грамматич"] 
    }
  ],
  "math": [
    { 
      macro: "Алгебра: Вычисления и преобразования", 
      keywords: ["дроби", "корни", "степен", "выражен", "значения", "деление", "многочлены", "вычитание", "умножения", "множител", "делимост", "смешанн", "пропорци", "алгебра"] 
    },
    { 
      macro: "Алгебра: Уравнения и неравенства", 
      keywords: ["уравнен", "неравенств", "систем", "корень уравнения", "интервал"] 
    },
    { 
      macro: "Функции и графики", 
      keywords: ["функци", "график", "парабол", "гипербол", "производная", "касательная", "координатн"] 
    },
    { 
      macro: "Геометрия", 
      keywords: ["геометрия", "пифагор", "вектор", "площадь", "угол", "треугольник", "хорд", "периметр", "планиметрия", "стереометрия"] 
    },
    { 
      macro: "Текстовые задачи и Прогрессии", 
      keywords: ["текстовые", "задачи", "задача", "движение", "работу", "мотоциклист", "прогресси", "проценты", "единицы измерения"] 
    }
  ],
  "logic": [
    { 
      macro: "Анализ данных и множества", 
      keywords: ["матрицы", "утверждения", "ложные", "истинн", "ящик", "рубашки", "множества"] 
    },
    { 
      macro: "Алгоритмы и последовательности", 
      keywords: ["очереди", "упорядочивание", "закономерност", "обратные"] 
    },
    { 
      macro: "Логико-математические задачи", 
      keywords: ["вычисления", "доли", "совместн", "скачк", "раза", "задачи"] 
    }
  ],
  "english": [
    { 
      macro: "Grammar: Basic Tenses (Present/Past)", 
      keywords: ["present simple", "past simple", "present continuous", "past continuous", "basic tenses", "continuous tenses", "continuous"] 
    },
    { 
      macro: "Grammar: Advanced Tenses (Perfect/Future)", 
      keywords: ["perfect", "future", "advanced tenses", "perfect tenses"] 
    },
    { 
      macro: "Grammar: Conditionals & Modals", 
      keywords: ["conditionals", "modal", "modals", "if", "can", "must", "future & conditionals"] 
    },
    { 
      macro: "Vocabulary & Prepositions", 
      keywords: ["prepositions", "quantifiers", "much", "many", "vocabulary", "linking words", "reading & comprehension", "reading"] 
    },
    { 
      macro: "Syntax & Error Correction", 
      keywords: ["correction", "reordering", "structure", "comparatives", "superlatives", "mistake", "syntax"] 
    }
  ]
};`;

const newFunc = `function getMacroCategory(topicText, subjectKey) {
  if (!topicText) return getFallbackSubjectCategory(subjectKey);
  
  let map = MACRO_MAP[subjectKey] || [];
  let lowerTopic = String(topicText).toLowerCase().trim();

  // 1. Поиск по ключевым словам
  for (let item of map) {
    if (item.keywords.some(kw => lowerTopic.includes(kw))) {
      return item.macro;
    }
  }

  // 2. Проверка по совпадению корней слов макро-категории
  for (let item of map) {
    let macroWords = item.macro.toLowerCase().split(/[\\s:,&]+/);
    if (macroWords.some(word => word.length > 3 && lowerTopic.includes(word))) {
      return item.macro;
    }
  }

  // 3. Строгий предметный фоллбек (гарантирует отсутствие "Основных навыков")
  return getFallbackSubjectCategory(subjectKey);
}

function getFallbackSubjectCategory(subjectKey) {
  switch (subjectKey) {
    case "russian": return "Синтаксис и Грамматика";
    case "math": return "Алгебра: Вычисления и преобразования";
    case "logic": return "Логико-математические задачи";
    case "english": return "Vocabulary & Prepositions";
    default: return "Синтаксис и Грамматика";
  }
}`;

let macroRegex = /const MACRO_MAP = \{[\s\S]*?\n\};\n\nconst ANSWER_KEYS = \{/;
if(macroRegex.test(code)) {
    code = code.replace(macroRegex, newMacro + '\n\nconst ANSWER_KEYS = {');
} else {
    // If we can't find it easily with regex, let's just do a manual string split
    console.error("Could not replace MACRO_MAP");
}

let funcRegex = /function getMacroCategory\(topicText, subjectKey\) \{[\s\S]*?return "Основные навыки";\n\}/;
if(funcRegex.test(code)) {
    code = code.replace(funcRegex, newFunc);
} else {
    console.error("Could not replace getMacroCategory");
}

fs.writeFileSync('scratch/Code_Fixed.gs', code);
console.log("Replaced successfully!");
