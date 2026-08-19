const fs = require('fs');

const code = fs.readFileSync('scratch/Code_final.gs', 'utf8');
const testData = fs.readFileSync('src/data/testsData.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');

let errors = [];

if (code.includes('rowName === safeName')) errors.push('Anti-spam block still exists in Code_final.gs');
if (!code.includes('safeSetValue(testSheet, testRowIdx, 14, "ЗАВЕРШЕН");')) errors.push('Missing ЗАВЕРШЕН update in submitEnglishTest');
if (!code.includes('totalScore = Number(testData[testRowIdx-1][6])')) errors.push('Missing totalScore return in submitEnglishTest');
if (server.includes('уже сдавали')) errors.push('уже сдавали still in server.ts');
if (testData.includes('options: [\n          "1, 2, 3, 4, 5",\n          "1, 2, 3, 4, 5, 6"')) errors.push('Grade 10 Q9 is still multiple_choice');

if (errors.length) {
    console.error('VERIFICATION FAILED:');
    errors.forEach(e => console.error(e));
    process.exit(1);
} else {
    console.log('VERIFICATION PASSED');
}
