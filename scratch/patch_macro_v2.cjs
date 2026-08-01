const fs = require('fs');

let code = fs.readFileSync('scratch/Code.js', 'utf8');

const newMacroMap = `
const MACRO_MAP = {
  "russian": [
    { macro: "Орфография: НЕ/НИ, слитное и раздельное", keywords: ["НЕ", "НИ", "слитно", "раздельно", "частиц", "деепричастиями"] },
    { macro: "Орфография: Суффиксы и окончания", keywords: ["суффикс", "окончани", "НН", "причасти"] },
    { macro: "Орфография: Корни и приставки", keywords: ["корень", "приставк", "безударн", "чередующ", "гласна"] },
    { macro: "Пунктуация: Сложное предложение", keywords: ["БСП", "ССП", "СПП", "сложное", "подчинител"] },
    { macro: "Пунктуация: Осложненное предложение", keywords: ["оборот", "вводн", "обращени", "однородн", "обособлен", "причастн", "деепричастн"] },
    { macro: "Синтаксис и Грамматика", keywords: ["Синтаксис", "основа", "сказуем", "односостав", "связи", "словосочетан"] }
  ],
  "math": [
    { macro: "Алгебра: Вычисления и преобразования", keywords: ["дроби", "корни", "степен", "выражен", "значения", "деление"] },
    { macro: "Алгебра: Уравнения и неравенства", keywords: ["уравнен", "неравенств", "систем", "корень уравнения"] },
    { macro: "Функции и графики", keywords: ["Функци", "график", "парабол", "гипербол"] },
    { macro: "Геометрия", keywords: ["Геометрия", "Пифагор", "вектор", "площадь", "угол", "треугольник", "хорд"] },
    { macro: "Текстовые задачи", keywords: ["Текстовые", "движение", "работу", "мотоциклист"] }
  ],
  "logic": [
    { macro: "Анализ данных и множества", keywords: ["матрицы", "утверждения", "ложные", "истинн", "ящик", "рубашки"] },
    { macro: "Алгоритмы и последовательности", keywords: ["очереди", "упорядочивание", "закономерност"] },
    { macro: "Логико-математические задачи", keywords: ["вычисления", "доли", "совместн", "скачк", "раза"] }
  ],
  "english": [
    { macro: "Grammar: Basic Tenses (Present/Past)", keywords: ["Present Simple", "Past Simple", "Present Continuous", "Past Continuous", "Basic Tenses"] },
    { macro: "Grammar: Advanced Tenses (Perfect/Future)", keywords: ["Perfect", "Future", "Advanced Tenses"] },
    { macro: "Grammar: Conditionals & Modals", keywords: ["Conditionals", "Modal", "If", "can", "must"] },
    { macro: "Vocabulary & Prepositions", keywords: ["Prepositions", "Quantifiers", "Much", "Many", "Vocabulary"] },
    { macro: "Syntax & Error Correction", keywords: ["Correction", "Reordering", "Structure", "Comparatives", "Superlatives", "Mistake"] }
  ]
};`;

code = code.replace(/const MACRO_MAP = \{[\s\S]*?\n\};\n/g, newMacroMap + "\n");
fs.writeFileSync('scratch/Code.js', code);
console.log("Updated Code.js");
