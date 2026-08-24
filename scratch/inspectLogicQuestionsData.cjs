const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/data/testsData.ts');
const content = fs.readFileSync(file, 'utf-8');

// Find all occurrences of questions with logic_ id or in logic section
const lines = content.split('\n');
let currentQuestion = null;
let capture = false;
let logicQuestions = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('id:') && line.includes('logic_')) {
    capture = true;
    currentQuestion = [line];
  } else if (capture) {
    currentQuestion.push(line);
    if (line.trim().startsWith('}') && (lines[i+1]?.includes('id:') || lines[i+1]?.includes(']'))) {
      capture = false;
      logicQuestions.push(currentQuestion.join('\n'));
    }
  }
}

console.log(`Found ${logicQuestions.length} logic questions in testsData.ts:`);
logicQuestions.forEach((q, idx) => {
  console.log(`\n--- QUESTION ${idx + 1} ---`);
  console.log(q);
});
