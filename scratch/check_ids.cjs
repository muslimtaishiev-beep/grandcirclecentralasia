const fs = require('fs');

const data = fs.readFileSync('src/data/testsData.ts', 'utf8');

// Parse out 9th grade
const grade9Start = data.indexOf('9: {');
const grade10Start = data.indexOf('10: {');
const grade9Str = data.substring(grade9Start, grade10Start);

const g9RuStart = grade9Str.indexOf('russian: [');
const g9MaStart = grade9Str.indexOf('math: [');
const g9RuStr = grade9Str.substring(g9RuStart, g9MaStart);

const ids9 = [...g9RuStr.matchAll(/id:\s*"([^"]+)"/g)].map(m => m[1]);
console.log('Grade 9 Russian IDs:', ids9);

// Parse out 11th grade
const grade11Start = data.indexOf('11: {');
const grade11Str = data.substring(grade11Start);
const g11RuStart = grade11Str.indexOf('russian: [');
const g11MaStart = grade11Str.indexOf('math: [');
const g11RuStr = grade11Str.substring(g11RuStart, g11MaStart);
const ids11 = [...g11RuStr.matchAll(/id:\s*"([^"]+)"/g)].map(m => m[1]);
console.log('Grade 11 Russian IDs:', ids11);
