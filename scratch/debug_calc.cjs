const fs = require('fs');

const code = fs.readFileSync('scratch/Code_final.gs', 'utf8');

const keysMatch = code.match(/const ANSWER_KEYS = {([\s\S]*?)\n};\n/);
const calcMatch = code.match(/function calculateScores\([\s\S]*?\n\}/);
const normMatch = code.match(/function normalizeString\([\s\S]*?\n\}/);

const script = `
const ANSWER_KEYS = {${keysMatch[1]}\n};
${normMatch[0]}
${calcMatch[0]}

const grade = "9";
const answers = {
  "russian_1": "быстро бежать",
  "russian_2": "вставная конструкция",
  "ru_5_new": JSON.stringify({"input1":"НН","input2":"Н"}),
  "ru_7_new": JSON.stringify(["1", "4"]),
  "ma_1_9": "6x/(x - y)",
  "logic_1": "13",
  "russian_9": JSON.stringify(["1","2","3","4","5"])
};

const scores = calculateScores(grade, answers);
console.log("SCORES:", scores);
`;

fs.writeFileSync('scratch/run_calc.cjs', script);
