const fs = require('fs');

// Read files
const testsDataContent = fs.readFileSync('src/data/testsData.ts', 'utf8');
const codeGsContent = fs.readFileSync('scratch/Code_final.gs', 'utf8');

// Extract ANSWER_KEYS JSON from Code_final.gs
const answerKeysMatch = codeGsContent.match(/const ANSWER_KEYS = ({[\s\S]*?\n\};)/);
if (!answerKeysMatch) {
  console.error("Could not find ANSWER_KEYS in Code_final.gs");
  process.exit(1);
}

let answerKeys;
try {
  // Use Function to safely evaluate JS object
  answerKeys = new Function(`return ${answerKeysMatch[1]}`)();
} catch (e) {
  console.error("Error parsing ANSWER_KEYS:", e);
  process.exit(1);
}

console.log("Successfully loaded ANSWER_KEYS for grades:", Object.keys(answerKeys));
