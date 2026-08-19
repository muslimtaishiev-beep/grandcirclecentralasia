const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Read files
const gsCode = fs.readFileSync(path.join(__dirname, 'Code_final.gs'), 'utf8');
const tsCode = fs.readFileSync(path.join(__dirname, '../src/data/testsData.ts'), 'utf8');

// Clean tsCode to make it runnable in JS environment
// Remove TypeScript imports and type annotations
let cleanedTs = tsCode
  .replace(/import\s+.*?;/g, '')
  .replace(/:\s*Question\[\]/g, '')
  .replace(/:\s*Record<number,\s*TestData>/g, '')
  .replace(/export\s+const\s+testsData/g, 'const testsData');

// In gsCode, convert `const ANSWER_KEYS = ...` into global variable
const fullScript = `
${cleanedTs}

${gsCode}

globalThis.testsData = testsData;
globalThis.ANSWER_KEYS = ANSWER_KEYS;
globalThis.calculateScores = calculateScores;
globalThis.normalizeString = normalizeString;
`;

try {
  const script = new vm.Script(fullScript);
  const context = vm.createContext(globalThis);
  script.runInContext(context);
} catch (e) {
  console.error("VM Execution Error:", e);
}

const ANSWER_KEYS = globalThis.ANSWER_KEYS;
const testsData = globalThis.testsData;
const calculateScores = globalThis.calculateScores;

console.log("ANSWER_KEYS grades:", Object.keys(ANSWER_KEYS || {}));
console.log("testsData grades:", Object.keys(testsData || {}));
