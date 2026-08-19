const fs = require('fs');
const code = fs.readFileSync('scratch/Code_final.gs', 'utf8');

const keysMatch = code.match(/const ANSWER_KEYS = {([\s\S]*?)\n};\n/);
const calcMatch = code.match(/function calculateScores\([\s\S]*?\n\}/);
const normMatch = code.match(/function normalizeString\([\s\S]*?\n\}/);

const script = `
const ANSWER_KEYS = {${keysMatch[1]}\n};
${normMatch[0]}
${calcMatch[0]}

const grade = "10";
const answers = {
  "russian_1": "газопровод",
  "ru_2_new": "лесной",
  "russian_3": "туманы здесь бывают если не каждый день то через день непременно.",
  "russian_4": "молитва",
  "russian_5": "предъявить, съезд;",
  "russian_6": "заболевать",
  "russian_7": "ирина андреевна говорила негромко, но очень выразительно.",
  "ru_8_new": "такжепоэтому",
  "russian_9": JSON.stringify(["1","2","3","4","5"]),
  "russian_10": JSON.stringify(["3","4"]),
  "ma_1_10": "1/2",
  "logic_1": "13"
};

const scores = calculateScores(grade, answers);
console.log("SCORES:", scores);
`;

fs.writeFileSync('scratch/run_calc_10.cjs', script);
