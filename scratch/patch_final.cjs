const fs = require('fs');
let code = fs.readFileSync('scratch/Code_final.gs', 'utf8');

// Fix submitTest
code = code.replace(
  /scores = calculateScores\(grade, answers\);/g,
  "let result = calculateScores(grade, answers);\n        scores = result.scores;"
);

// Fix recheckScores
code = code.replace(
  /const newScores = calculateScores\(student\.grade, answersObj\);\n      const totalScore = newScores\.russian \+ newScores\.math \+ newScores\.logic;\n      \n      safeSetValue\(testSheet, student\.row, 4, newScores\.russian\);\n      safeSetValue\(testSheet, student\.row, 5, newScores\.math\);\n      safeSetValue\(testSheet, student\.row, 6, newScores\.logic\);\n      safeSetValue\(testSheet, student\.row, 7, totalScore\);\n      safeSetValue\(testSheet, student\.row, 13, newScores\.english\);/g,
  `const result = calculateScores(student.grade, answersObj);
      const newScores = result.scores;
      const diagnosticsRaw = result.diagnosticsRaw;
      const totalScore = newScores.russian + newScores.math + newScores.logic;
      
      safeSetValue(testSheet, student.row, 4, newScores.russian);
      safeSetValue(testSheet, student.row, 5, newScores.math);
      safeSetValue(testSheet, student.row, 6, newScores.logic);
      safeSetValue(testSheet, student.row, 7, totalScore);
      safeSetValue(testSheet, student.row, 13, newScores.english);`
);

code = code.replace(
  /return ContentService\.createTextOutput\(JSON\.stringify\(\{ success: true, scores: newScores \}\)\)\.setMimeType\(ContentService\.MimeType\.JSON\);/g,
  `return ContentService.createTextOutput(JSON.stringify({ success: true, scores: newScores, diagnosticsRaw: diagnosticsRaw })).setMimeType(ContentService.MimeType.JSON);`
);

fs.writeFileSync('scratch/Code_final.gs', code);
console.log("Patched Code_final.gs");
