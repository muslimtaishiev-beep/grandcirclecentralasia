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

console.log("=== SCORING VERIFICATION FOR EVERY QUESTION ===");

const samplePayloads = {};
const questionTable = [];

for (const grade of grades) {
  samplePayloads[grade] = {
    coreAnswers: {},
    englishAnswers: {}
  };

  const feGradeObj = testsData[grade] || {};
  const beGradeObj = ANSWER_KEYS[grade] || {};

  const subjects = ['russian', 'math', 'logic', 'english'];

  for (const subj of subjects) {
    const feQuestions = feGradeObj[subj] || [];
    const beKeys = beGradeObj[subj] || {};

    for (const q of feQuestions) {
      const qId = q.id;
      const keyObj = beKeys[qId];
      let correctPayloadValue = null;
      let expectedPts = keyObj ? (keyObj.pts || 1) : 0;
      let actualScore = 0;
      let status = "OK";
      let note = "";

      if (!keyObj) {
        status = "BUG_MISSING_BE_KEY";
        note = "Question rendered on FE but missing in ANSWER_KEYS";
      } else {
        const keyAns = keyObj.ans;

        if (q.type === 'multiple_choice') {
          correctPayloadValue = keyAns;
        } else if (q.type === 'two_step') {
          if (qId === 'ru_2_new' || qId === 'russian_2') {
            if (grade === 10) correctPayloadValue = "1|лесной";
            if (grade === 11) correctPayloadValue = "2|наличие";
          } else if (qId === 'ru_8_new' || qId === 'russian_8') {
            if (grade === 10) correctPayloadValue = "5|такжепоэтому";
            if (grade === 11) correctPayloadValue = "4|кверхутотчас";
          } else {
            correctPayloadValue = keyAns;
          }
        } else if (q.type === 'inline_inputs') {
          correctPayloadValue = JSON.stringify({ input1: "НН", input2: "Н" });
        } else if (q.type === 'clickable_text') {
          correctPayloadValue = keyAns;
        } else if (q.type === 'logic_matrix' || q.type === 'dropdown_multiple') {
          correctPayloadValue = keyAns;
        } else if (q.type === 'drag_and_drop') {
          if (subj === 'english') {
            correctPayloadValue = keyAns;
            if (!keyAns.startsWith('[')) {
              correctPayloadValue = JSON.stringify(keyAns.split(' '));
            }
          } else {
            correctPayloadValue = JSON.stringify(["митя", "толя", "сеня", "костя", "юра"]);
          }
        } else if (q.type === 'inline_dropdown' || q.type === 'number_input' || q.type === 'free_text') {
          correctPayloadValue = keyAns;
        } else {
          correctPayloadValue = keyAns;
        }

        if (subj === 'english') {
          samplePayloads[grade].englishAnswers[qId] = correctPayloadValue;
        } else {
          samplePayloads[grade].coreAnswers[qId] = correctPayloadValue;
        }

        const testAnsDict = { [qId]: correctPayloadValue };
        const isEng = (subj === 'english');
        const res = calculateScores(grade, testAnsDict, false, isEng);

        if (!res || !res.scores) {
          console.error("DEBUG res is invalid:", res, "for", qId, subj, grade);
          actualScore = 0;
        } else {
          actualScore = res.scores[subj] || 0;
        }

        if (actualScore !== expectedPts) {
          status = "BUG_SCORE_MISMATCH";
          note = `Expected ${expectedPts} pts, got ${actualScore} pts. Key: ${keyAns}, Payload: ${correctPayloadValue}`;
        }
      }

      questionTable.push({
        grade,
        subject: subj,
        id: qId,
        type: q.type || 'multiple_choice',
        fePoints: q.points || 1,
        bePoints: expectedPts,
        keyAns: keyObj ? keyObj.ans : 'N/A',
        samplePayload: correctPayloadValue,
        status,
        note
      });
    }
  }
}

console.log("\n=== FULL PAYLOAD SCORING TESTS ===");
for (const grade of grades) {
  const coreRes = calculateScores(grade, samplePayloads[grade].coreAnswers, false, false);
  const engRes = calculateScores(grade, samplePayloads[grade].englishAnswers, false, true);

  console.log(`Grade ${grade} Core Score:`, coreRes ? coreRes.scores : null, "Total:", coreRes ? coreRes.totalScore : null);
  console.log(`Grade ${grade} English Score:`, engRes ? engRes.scores : null);
}

const failures = questionTable.filter(q => q.status !== 'OK');
console.log("\n=== FAILED / MISMATCHED QUESTIONS COUNT ===", failures.length);
console.log(JSON.stringify(failures, null, 2));
