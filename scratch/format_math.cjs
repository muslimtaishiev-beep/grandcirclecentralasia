const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '../src/data/testsData.ts');
let content = fs.readFileSync(filePath, 'utf8');

// replace only specific LaTeX powers
content = content.replace(/\\\\\^/g, '^'); // if there is any escaped caret
content = content.replace(/\^2/g, '²');
content = content.replace(/\^3/g, '³');
content = content.replace(/\^4/g, '⁴');
content = content.replace(/\^5/g, '⁵');
content = content.replace(/\^6/g, '⁶');
content = content.replace(/\{-2\}/g, '⁻²');
content = content.replace(/\{-4\}/g, '⁻⁴');
content = content.replace(/\{14\}/g, '¹⁴');
content = content.replace(/\{16\}/g, '¹⁶');

// Russian variables with digits attached (instead of ^)
content = content.replace(/6а2\(/g, '6а²(');
content = content.replace(/18а3/g, '18а³');
content = content.replace(/6а2/g, '6а²');
content = content.replace(/4с2\+/g, '4с²+');
content = content.replace(/2с2\+/g, '2с²+');
content = content.replace(/4с2-/g, '4с²-');
content = content.replace(/t2 -/g, 't² -');
content = content.replace(/4t2 \+/g, '4t² +');
content = content.replace(/t2 \+/g, 't² +');
content = content.replace(/см2/g, 'см²');

// specific LaTeX macros in source code (they are double escaped like \\pi)
content = content.replace(/\\\\cdot/g, '·');
content = content.replace(/\\\\le/g, '≤');
content = content.replace(/\\\\pm/g, '±');
content = content.replace(/\\\\pi/g, 'π');
content = content.replace(/\\\\infty/g, '∞');
content = content.replace(/\\\\in/g, '∈');
content = content.replace(/\\\\alpha/g, 'α');
content = content.replace(/\\\\text\{arcctg\}/g, 'arcctg');
content = content.replace(/\\\\text\{tg\}/g, 'tg');
content = content.replace(/\\\\cos/g, 'cos');
content = content.replace(/\\\\sin/g, 'sin');
content = content.replace(/\\\\log_2/g, 'log₂');
content = content.replace(/\\\\log_3/g, 'log₃');
content = content.replace(/\\\\log_5/g, 'log₅');
content = content.replace(/\\\\sqrt\{3\}/g, '√3');
content = content.replace(/\\\\sqrt\[5\]\{3\}/g, '⁵√3');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Math symbols formatted safely.');
