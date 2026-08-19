const fs = require('fs');
const path = require('path');
const vm = require('vm');

const gsCode = fs.readFileSync(path.join(__dirname, 'Code_final.gs'), 'utf8');
const tsCode = fs.readFileSync(path.join(__dirname, '../src/data/testsData.ts'), 'utf8');

// Strip TypeScript annotations from testsData.ts
let cleanedTs = tsCode
  .replace(/import\s+.*?;/g, '')
  .replace(/:\s*Question\[\]/g, '')
  .replace(/:\s*Record<number,\s*TestData>/g, '')
  .replace(/export\s+const\s+testsData/g, 'const testsData');

// Combine
const fullScript = `
${cleanedTs}

${gsCode}

module.exports = { testsData, ANSWER_KEYS, calculateScores };
`;

try {
  const sandbox = {
    console: console,
    JSON: JSON,
    String: String,
    Array: Array,
    Object: Object,
    Math: Math,
    Date: Date,
    module: { exports: {} },
    exports: {}
  };
  
  vm.createContext(sandbox);
  vm.runInContext(fullScript, sandbox);

  const { testsData, ANSWER_KEYS, calculateScores } = sandbox.module.exports;
  
  console.log("=== COMPREHENSIVE KEY & PAYLOAD AUDIT REPORT ===");
  const grades = [7, 8, 9, 10, 11];
  
  const report = {
    mismatches: [],
    missingKeys: [],
    questionCounts: {},
    samplePayloads: {}
  };

  grades.forEach(grade => {
    const test = testsData[grade];
    const keys = ANSWER_KEYS[String(grade)];
    
    if (!test) {
      console.error(`Grade ${grade} missing in testsData!`);
      return;
    }
    if (!keys) {
      console.error(`Grade ${grade} missing in ANSWER_KEYS!`);
      return;
    }

    const subjects = ['russian', 'math', 'logic', 'english'];
    report.questionCounts[grade] = {};
    const samplePayload = {};

    subjects.forEach(subj => {
      const qList = test[subj] || [];
      const keyMap = keys[subj] || {};
      
      report.questionCounts[grade][subj] = {
        feCount: qList.length,
        beCount: Object.keys(keyMap).length,
        feMaxPts: qList.reduce((s, q) => s + (q.points || 1), 0),
        beMaxPts: Object.values(keyMap).reduce((s, k) => s + (k.pts || 1), 0)
      };

      qList.forEach(q => {
        const keyObj = keyMap[q.id];
        if (!keyObj) {
          report.missingKeys.push({ grade, subject: subj, qId: q.id, type: q.type });
        } else {
          // Construct sample perfect answer
          let sampleAns = keyObj.ans;
          if (q.type === 'two_step') {
            sampleAns = "1|" + keyObj.ans;
          }
          samplePayload[q.id] = sampleAns;
        }
      });
    });

    // Test calculateScores on sample perfect payload
    try {
      const scores = calculateScores(grade, samplePayload);
      console.log(`Grade ${grade} Perfect Answer Score Calculation:`, scores);
    } catch(err) {
      console.error(`Grade ${grade} calculateScores THREW ERROR:`, err.message);
    }

    report.samplePayloads[grade] = samplePayload;
  });

  console.log("\n--- MISMATCHES / MISSING KEYS ---");
  console.log(JSON.stringify(report.missingKeys, null, 2));

  console.log("\n--- QUESTION COUNTS & MAX POINTS ---");
  console.log(JSON.stringify(report.questionCounts, null, 2));

  fs.writeFileSync(path.join(__dirname, 'audit_output.json'), JSON.stringify(report, null, 2));
  console.log("\nWrote audit_output.json");

} catch(e) {
  console.error("VM Execution Error:", e);
}
