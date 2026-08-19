const fs = require('fs');
const code = fs.readFileSync('scratch/Code_final.gs', 'utf8');

// Extract ANSWER_KEYS and calculateScores
const keysMatch = code.match(/const ANSWER_KEYS = (\{[\s\S]*?\n\};)/);
const keysStr = keysMatch[1];
eval("var ANSWER_KEYS = " + keysStr);

const funcMatch = code.match(/function calculateScores[\s\S]*?\n\}/);
eval(funcMatch[0]);

const normalizeMatch = code.match(/function normalizeString[\s\S]*?\n\}/);
if(normalizeMatch) eval(normalizeMatch[0]);

const grade = "9";
const answers = {
  "ru_9": ["оконным", "переполненные", "гружёные"],
  "ru_10": "аккуратный",
  "russian_1": "156",
  "russian_2": "оконным",
  "russian_3": "утренней",
  "russian_4": "обыкновенная",
  "russian_5": "асфальтированная",
  "russian_6": "переполненные",
  "russian_7": "гружёные",
  "russian_8": "15"
};

try {
  const result = calculateScores(grade, answers);
  console.log("SUCCESS:", result);
} catch(e) {
  console.log("ERROR:", e);
}
