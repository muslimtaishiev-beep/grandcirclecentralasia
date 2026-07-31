const fs = require('fs');
let code = fs.readFileSync('src/data/testsData.ts', 'utf8');

// For grade 7
code = code.replace(
  '7: {\n    russian:',
  '7: {\n    english: [],\n    russian:'
);
// For grade 8
code = code.replace(
  '8: {\n    russian:',
  '8: {\n    english: english_grade_8,\n    russian:'
);
// For grade 9
code = code.replace(
  '9: {\n    russian:',
  '9: {\n    english: english_grade_9,\n    russian:'
);
// For grade 10
code = code.replace(
  '10: {\n    russian:',
  '10: {\n    english: english_grade_10_11,\n    russian:'
);
// For grade 11
code = code.replace(
  '11: {\n    russian:',
  '11: {\n    english: english_grade_10_11,\n    russian:'
);

fs.writeFileSync('src/data/testsData.ts', code);
console.log("Patched testsData.ts again");
