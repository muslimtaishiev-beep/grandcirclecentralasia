const fs = require('fs');
const path = 'scratch/Code_final.gs';
let code = fs.readFileSync(path, 'utf8');

// 1. Fix Grade 8 missing key
const g8_q7 = `"russian_7": {
        "ans": "(не) закрыв дверь",
        "pts": 1
        },`;
const g8_q7_new = `"russian_7": {
        "ans": "(не) закрыв дверь",
        "pts": 1
        },
      "ru_7_new": {
        "ans": "3",
        "pts": 1
        },`;
code = code.replace(g8_q7, g8_q7_new);

// 2. Fix English answers not saving
const engUpdate = `      // Update English score in testSheet (Column 13 - M)
      safeSetValue(testSheet, testRowIdx, 13, scores.english);`;
const engUpdateNew = `      // Update English score and save English answers
      let existingAnswers = {};
      try { existingAnswers = JSON.parse(String(testData[testRowIdx-1][14]) || "{}"); } catch(e) {}
      if (Object.keys(existingAnswers).length === 0) {
        try { existingAnswers = JSON.parse(String(testData[testRowIdx-1][11]) || "{}"); } catch(e) {}
      }
      const mergedAnswers = { ...existingAnswers, ...answers };
      const mergedStr = JSON.stringify(mergedAnswers);
      
      safeSetValue(testSheet, testRowIdx, 13, scores.english);
      safeSetValue(testSheet, testRowIdx, 12, mergedStr);
      safeSetValue(testSheet, testRowIdx, 15, mergedStr);`;
code = code.replace(engUpdate, engUpdateNew);

fs.writeFileSync(path, code, 'utf8');
console.log("Patched Code_final.gs with Grade 8 and English fixes.");
