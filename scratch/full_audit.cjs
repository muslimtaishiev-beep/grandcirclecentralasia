const fs = require('fs');
const path = require('path');
const vm = require('vm');

const gsCode = fs.readFileSync(path.join(__dirname, 'Code_final.gs'), 'utf8');
const tsCode = fs.readFileSync(path.join(__dirname, '../src/data/testsData.ts'), 'utf8');

let cleanedTs = tsCode
  .replace(/import\s+.*?;/g, '')
  .replace(/:\s*Question\[\]/g, '')
  .replace(/:\s*Record<number,\s*TestData>/g, '')
  .replace(/export\s+const\s+testsData/g, 'const testsData');

const fullScript = `
${cleanedTs}

${gsCode}

globalThis.testsData = testsData;
globalThis.ANSWER_KEYS = ANSWER_KEYS;
globalThis.calculateScores = calculateScores;
globalThis.normalizeString = normalizeString;
`;

const script = new vm.Script(fullScript);
const context = vm.createContext(globalThis);
script.runInContext(context);

const ANSWER_KEYS = globalThis.ANSWER_KEYS;
const testsData = globalThis.testsData;
const calculateScores = globalThis.calculateScores;
const normalizeString = globalThis.normalizeString;

const grades = [7, 8, 9, 10, 11];

console.log("=== COMPREHENSIVE AUDIT REPORT ===");

const auditResults = {
  idMismatches: [],
  pointDenominators: {},
  typeTesting: [],
  payloadDumps: {},
  questionVsKeyTable: []
};

// 1. ID Matching & Denominators
for (const grade of grades) {
  const feGradeObj = testsData[grade] || {};
  const beGradeObj = ANSWER_KEYS[grade] || {};
  
  auditResults.pointDenominators[grade] = {
    fe: { russian: 0, math: 0, logic: 0, english: 0, totalCore: 0, totalEng: 0, counts: {} },
    be: { russian: 0, math: 0, logic: 0, english: 0, totalCore: 0, totalEng: 0, counts: {} }
  };

  const subjects = ['russian', 'math', 'logic', 'english'];
  
  for (const subj of subjects) {
    const feQuestions = feGradeObj[subj] || [];
    const beKeys = beGradeObj[subj] || {};

    const feIds = feQuestions.map(q => q.id);
    const beIds = Object.keys(beKeys);

    let fePoints = 0;
    feQuestions.forEach(q => { fePoints += (q.points || 1); });

    let bePoints = 0;
    beIds.forEach(id => { bePoints += (beKeys[id].pts || 1); });

    auditResults.pointDenominators[grade].fe.counts[subj] = feQuestions.length;
    auditResults.pointDenominators[grade].fe[subj] = fePoints;
    
    auditResults.pointDenominators[grade].be.counts[subj] = beIds.length;
    auditResults.pointDenominators[grade].be[subj] = bePoints;

    if (subj === 'english') {
      auditResults.pointDenominators[grade].fe.totalEng += fePoints;
      auditResults.pointDenominators[grade].be.totalEng += bePoints;
    } else {
      auditResults.pointDenominators[grade].fe.totalCore += fePoints;
      auditResults.pointDenominators[grade].be.totalCore += bePoints;
    }

    // Check ID mismatches
    feIds.forEach(id => {
      if (!beKeys[id]) {
        auditResults.idMismatches.push({
          grade, subject: subj, type: 'FE_QUESTION_MISSING_IN_BE_KEYS', id
        });
      }
    });

    beIds.forEach(id => {
      if (!feIds.includes(id)) {
        auditResults.idMismatches.push({
          grade, subject: subj, type: 'BE_KEY_NOT_RENDERED_ON_FE', id
        });
      }
    });
  }
}

console.log("\n--- Point Denominators Summary ---");
console.log(JSON.stringify(auditResults.pointDenominators, null, 2));

console.log("\n--- ID Mismatches Count ---", auditResults.idMismatches.length);
console.log(JSON.stringify(auditResults.idMismatches, null, 2));
