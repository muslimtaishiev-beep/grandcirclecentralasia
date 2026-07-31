const fs = require('fs');
let code = fs.readFileSync('src/data/testsData.ts', 'utf8');

code = code.replace(
  /7: \{\s*russian:/,
  '7: {\n    english: [],\n    russian:'
);

code = code.replace(
  /8: \{\s*russian:/,
  '8: {\n    english: english_grade_8,\n    russian:'
);

code = code.replace(
  /9: \{\s*russian:/,
  '9: {\n    english: english_grade_9,\n    russian:'
);

code = code.replace(
  /10: \{\s*russian:/,
  '10: {\n    english: english_grade_10_11,\n    russian:'
);

code = code.replace(
  /11: \{\s*russian:/,
  '11: {\n    english: english_grade_10_11,\n    russian:'
);

fs.writeFileSync('src/data/testsData.ts', code);
console.log("Patched testsData.ts");
