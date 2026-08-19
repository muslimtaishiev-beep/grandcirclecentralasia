const fs = require('fs');
let code = fs.readFileSync('scratch/Code_final.gs', 'utf8');

code = code.replace(
  'scores = calculateScores(grade, answers);',
  'scores = calculateScores(grade, answers);\n        // Override russian, math, logic from spreadsheet so frontend doesn\\'t show 0\n        scores.russian = Number(testData[testRowIdx-1][3]) || 0;\n        scores.math = Number(testData[testRowIdx-1][4]) || 0;\n        scores.logic = Number(testData[testRowIdx-1][5]) || 0;'
);

fs.writeFileSync('scratch/Code_final.gs', code);
