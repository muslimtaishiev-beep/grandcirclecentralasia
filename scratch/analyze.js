const fs = require('fs');
const path = require('path');

// Read files
const gsCode = fs.readFileSync(path.join(__dirname, 'Code_final.gs'), 'utf8');
const tsCode = fs.readFileSync(path.join(__dirname, '../src/data/testsData.ts'), 'utf8');

// We can extract ANSWER_KEYS and calculateScores and normalizeString from gsCode
// and compile them into a VM / node script
const vm = require('vm');

const sandbox = {
  console: console,
  JSON: JSON,
  String: String,
  Array: Array,
  Object: Object,
  exports: {}
};

// Clean tsCode to make it runnable in JS environment
// Remove TypeScript imports and type annotations
let cleanedTs = tsCode
  .replace(/import\s+.*?;/g, '')
  .replace(/:\s*Question\[\]/g, '')
  .replace(/:\s*Record<number,\s*TestData>/g, '')
  .replace(/export\s+const\s+testsData/g, 'const testsData');

// Combine cleaned code
const fullScript = `
${cleanedTs}

${gsCode}

module.exports = { testsData, ANSWER_KEYS, calculateScores, normalizeString };
`;

try {
  const script = new vm.Script(fullScript);
  const context = vm.createContext(sandbox);
  script.runInContext(context);
} catch (e) {
  console.error("VM Execution Error:", e);
}

const { testsData, ANSWER_KEYS, calculateScores, normalizeString } = sandbox.exports || {};

console.log("ANSWER_KEYS grades:", Object.keys(sandbox.ANSWER_KEYS || {}));
console.log("testsData grades:", Object.keys(sandbox.testsData || {}));
