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

const grades = [7, 8, 9, 10, 11];

const fullReportData = {
  denominators: {},
  samplePayloads: {},
  questionVsKeyTable: [],
  orphanKeys: []
};

for (const grade of grades) {
  const feGradeObj = testsData[grade] || {};
  const beGradeObj = ANSWER_KEYS[grade] || {};

  const corePayload = {};
  const englishPayload = {};

  const subjects = ['russian', 'math', 'logic', 'english'];

  let totalFeCorePts = 0;
  let totalFeEngPts = 0;
  let totalBeCorePts = 0;
  let totalBeEngPts = 0;

  const subjDenoms = {};

  for (const subj of subjects) {
    const feQuestions = feGradeObj[subj] || [];
    const beKeys = beGradeObj[subj] || {};

    let feSubjPts = 0;
    feQuestions.forEach(q => { feSubjPts += (q.points || 1); });

    let beSubjPts = 0;
    Object.keys(beKeys).forEach(k => { beSubjPts += (beKeys[k].pts || 1); });

    if (subj === 'english') {
      totalFeEngPts += feSubjPts;
      totalBeEngPts += beSubjPts;
    } else {
      totalFeCorePts += feSubjPts;
      totalBeCorePts += beSubjPts;
    }

    subjDenoms[subj] = {
      feCount: feQuestions.length,
      fePoints: feSubjPts,
      beCount: Object.keys(beKeys).length,
      bePoints: beSubjPts
    };

    for (const q of feQuestions) {
      const qId = q.id;
      const keyObj = beKeys[qId];
      let val = null;

      if (keyObj) {
        const keyAns = keyObj.ans;
        if (q.type === 'multiple_choice') {
          val = keyAns;
        } else if (q.type === 'two_step') {
          if (qId === 'ru_2_new' || qId === 'russian_2') {
            if (grade === 10) val = "1|лесной";
            if (grade === 11) val = "2|наличие";
          } else if (qId === 'ru_8_new' || qId === 'russian_8') {
            if (grade === 10) val = "5|такжепоэтому";
            if (grade === 11) val = "4|кверхутотчас";
          } else {
            val = keyAns;
          }
        } else if (q.type === 'inline_inputs') {
          val = JSON.stringify({ input1: "НН", input2: "Н" });
        } else if (q.type === 'clickable_text' || q.type === 'logic_matrix' || q.type === 'dropdown_multiple') {
          val = keyAns;
        } else if (q.type === 'drag_and_drop') {
          if (subj === 'english') {
            const words = keyAns.replace(/[.,!?]/g, '').split(/\s+/);
            val = JSON.stringify(words);
          } else {
            val = JSON.stringify(["митя", "толя", "сеня", "костя", "юра"]);
          }
        } else {
          val = keyAns;
        }
      }

      if (subj === 'english') {
        if (val !== null) englishPayload[qId] = val;
      } else {
        if (val !== null) corePayload[qId] = val;
      }

      fullReportData.questionVsKeyTable.push({
        grade,
        subject: subj,
        id: qId,
        type: q.type || 'multiple_choice',
        fePoints: q.points || 1,
        bePoints: keyObj ? keyObj.pts : 0,
        keyAns: keyObj ? keyObj.ans : 'MISSING IN BE',
        sampleValue: val,
        status: keyObj ? 'MATCH' : 'MISSING_KEY'
      });
    }

    // Check orphan BE keys
    const feIds = feQuestions.map(q => q.id);
    Object.keys(beKeys).forEach(kId => {
      if (!feIds.includes(kId)) {
        fullReportData.orphanKeys.push({
          grade,
          subject: subj,
          id: kId,
          bePoints: beKeys[kId].pts,
          keyAns: beKeys[kId].ans
        });
      }
    });
  }

  fullReportData.denominators[grade] = {
    subjDenoms,
    totalFeCorePts,
    totalBeCorePts,
    totalFeEngPts,
    totalBeEngPts
  };

  fullReportData.samplePayloads[grade] = {
    corePayloadStr: JSON.stringify(corePayload),
    englishPayloadStr: JSON.stringify(englishPayload)
  };
}

fs.writeFileSync(path.join(__dirname, 'report_data.json'), JSON.stringify(fullReportData, null, 2), 'utf8');
console.log("report_data.json written successfully!");
