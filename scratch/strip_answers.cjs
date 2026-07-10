const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '../src/data/testsData.ts');

let content = fs.readFileSync(filePath, 'utf8');

// Regex to remove "correctAnswer": "...",
content = content.replace(/\s*"correctAnswer":\s*".*?",?\n?/g, '\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Stripped correct answers from testsData.ts');
