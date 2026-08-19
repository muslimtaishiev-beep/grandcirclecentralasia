const fs = require('fs');

let codeJs = fs.readFileSync('scratch/Code.js', 'utf8');
let codeFixed = fs.readFileSync('scratch/Code_Fixed.gs', 'utf8');

// Extract calculateScores from Code.js (it has diagnosticsRaw logic)
const calcStartStr = "function calculateScores(grade, answers) {";
const calcEndStr = "  return { scores: { russian: ru, math: ma, logic: lo, english: en }, diagnosticsRaw };\n}";

const calcStartIdx = codeJs.indexOf(calcStartStr);
const calcEndIdx = codeJs.indexOf(calcEndStr) + calcEndStr.length;
const newCalcScores = codeJs.substring(calcStartIdx, calcEndIdx);

// Extract calculateScores from Code_Fixed.gs and replace it
const oldCalcStartIdx = codeFixed.indexOf(calcStartStr);
const oldCalcEndStr = "  return { russian: ru, math: ma, logic: lo, english: en };\n}";
const oldCalcEndIdx = codeFixed.indexOf(oldCalcEndStr) + oldCalcEndStr.length;

if (oldCalcStartIdx > -1 && oldCalcEndIdx > oldCalcStartIdx) {
  codeFixed = codeFixed.substring(0, oldCalcStartIdx) + newCalcScores + codeFixed.substring(oldCalcEndIdx);
  fs.writeFileSync('scratch/Code_Fixed.gs', codeFixed);
  console.log("Successfully replaced calculateScores in Code_Fixed.gs");
} else {
  console.log("Failed to find calculateScores in Code_Fixed.gs");
}
