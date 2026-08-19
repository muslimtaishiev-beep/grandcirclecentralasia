const fs = require('fs');
let code = fs.readFileSync('scratch/Code_final.gs', 'utf8');

code = code.replace(
  'const keys = ANSWER_KEYS[String(grade)];',
  'const match = String(grade).match(/\\d+/);\n  const cleanGrade = match ? match[0] : String(grade);\n  const keys = ANSWER_KEYS[cleanGrade];'
);

fs.writeFileSync('scratch/Code_final.gs', code);
