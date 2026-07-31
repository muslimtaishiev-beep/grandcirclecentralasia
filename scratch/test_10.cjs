const fs = require('fs');
const gsCode = fs.readFileSync('scratch/Code.gs', 'utf-8');

// Extract ANSWER_KEYS
const keysMatch = gsCode.match(/const ANSWER_KEYS = (\{[\s\S]*?^};\n)/m);
if (!keysMatch) {
  console.log("Could not extract ANSWER_KEYS");
  process.exit(1);
}
eval("var ANSWER_KEYS = " + keysMatch[1]);

// Extract normalizeString
const normMatch = gsCode.match(/function normalizeString\([\s\S]*?\n\}/m);
eval(normMatch[0]);

// Simulate frontend payload
const mathKeys = ANSWER_KEYS["10"].math;
let studentAnswers = {};
let totalCorrect = 0;

console.log("--- 10th Grade Math Simulation ---");
for (const [qId, qData] of Object.entries(mathKeys)) {
  const correctAnsText = qData.ans;
  // This is what the frontend sends (the raw text of the option)
  studentAnswers[qId] = correctAnsText;
  
  const userAnsData = studentAnswers[qId];
  const normalizedKey = normalizeString(correctAnsText);
  const normalizedUser = normalizeString(userAnsData);
  
  if (normalizedKey === normalizedUser) {
    totalCorrect += qData.pts;
    console.log(`✅ ${qId}: Passed (Client sent: "${userAnsData}", Normalized: "${normalizedUser}")`);
  } else {
    console.log(`❌ ${qId}: Failed`);
    console.log(`   Expected (normalized): "${normalizedKey}"`);
    console.log(`   Got      (normalized): "${normalizedUser}"`);
  }
}

console.log(`\nTotal Math Points for 10th grade: ${totalCorrect} / ${Object.keys(mathKeys).length}`);
