const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let serviceAccount;
const keyPath = path.join(__dirname, '../serviceAccountKey.json');

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else if (fs.existsSync(keyPath)) {
  serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
} else {
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const { calculateScoresTs, isAnswerCorrect } = require('../src/lib/scoringEngine.ts');

async function runFullAudit() {
  console.log("===============================================================================");
  console.log("🔍 AUTONOMOUS ACADEMIC AUDIT & SIMULATION FOR GRADES 8, 9, 10, 11");
  console.log("===============================================================================\n");

  const summary = [];
  const bugList = [];

  for (const grade of [8, 9, 10, 11]) {
    // 1. Fetch merged questions for grade
    const candidateDocIds = [
      `test_grade_${grade}_org_future_leaders`,
      `test_grade_${grade}`,
      `${grade}`
    ];

    let questionsObj = {};
    for (const docId of candidateDocIds) {
      const qSnap = await db.collection("tests").doc(docId).get();
      if (qSnap.exists) {
        questionsObj = qSnap.data()?.questions || {};
        if (Object.keys(questionsObj).length > 0) break;
      }
    }

    // 2. Fetch merged keys for grade
    const candidateKeyDocIds = [
      `test_grade_${grade}_org_future_leaders`,
      `test_grade_${grade}`,
      `key_grade_${grade}_org_future_leaders`,
      `key_grade_${grade}_GLOBAL`,
      `${grade}`
    ];

    const keysObj = { russian: {}, math: {}, logic: {}, english: {} };
    for (const docId of candidateKeyDocIds) {
      const kSnap = await db.collection("test_answer_keys").doc(docId).get();
      if (kSnap.exists) {
        const kData = kSnap.data()?.keys || {};
        if (kData.russian) keysObj.russian = { ...kData.russian, ...keysObj.russian };
        if (kData.math) keysObj.math = { ...kData.math, ...keysObj.math };
        if (kData.logic) keysObj.logic = { ...kData.logic, ...keysObj.logic };
        if (kData.english) keysObj.english = { ...kData.english, ...keysObj.english };
      }
    }

    for (const subj of ['russian', 'math', 'logic', 'english']) {
      const qList = questionsObj[subj] || [];
      const kMap = keysObj[subj] || {};

      let totalQ = qList.length;
      let syncedCount = 0;
      let errorCount = 0;

      qList.forEach(q => {
        const keyEntry = kMap[q.id];
        if (!keyEntry || keyEntry.ans === undefined || keyEntry.ans === null || keyEntry.ans === "") {
          errorCount++;
          bugList.push({
            grade,
            subject: subj,
            questionId: q.id,
            type: "MISSING_KEY",
            current: keyEntry ? String(keyEntry.ans) : "MISSING",
            expected: "Valid answer string",
            description: `Question ${q.id} in ${subj} (Grade ${grade}) has no key entry in test_answer_keys!`
          });
        } else {
          syncedCount++;
          // Check option mismatch
          if (q.type === 'multiple_choice' && q.options) {
            const targetAns = String(keyEntry.ans).trim();
            // Check if key is a index/letter like "1" or "A" or text
            const matchesOptionPrefix = q.options.some((opt, idx) => {
              const prefix1 = `${idx + 1}`; // "1"
              const prefix2 = `${idx + 1})`; // "1)"
              const prefix3 = String.fromCharCode(65 + idx); // "A"
              return targetAns === prefix1 || targetAns === prefix2 || targetAns === prefix3 || isAnswerCorrect(opt, targetAns);
            });
            if (!matchesOptionPrefix) {
              errorCount++;
              bugList.push({
                grade,
                subject: subj,
                questionId: q.id,
                type: "OPTION_KEY_MISMATCH",
                current: targetAns,
                expected: `One of 1..${q.options.length} or option text`,
                description: `Question ${q.id} key "${targetAns}" doesn't match options list: ${JSON.stringify(q.options)}`
              });
            }
          }
        }
      });

      summary.push({
        Grade: grade,
        Subject: subj.toUpperCase(),
        TotalQuestions: totalQ,
        Synced: syncedCount,
        Errors: errorCount
      });
    }

    // SIMULATION TESTS FOR THIS GRADE
    console.log(`\n--- SIMULATION TESTS FOR GRADE ${grade} ---`);

    // Profile 1: Perfect Student
    const perfectAnswers = {};
    Object.keys(keysObj).forEach(subj => {
      Object.keys(keysObj[subj]).forEach(qId => {
        const kEntry = keysObj[subj][qId];
        perfectAnswers[qId] = String(kEntry.ans);
      });
    });
    const perfRes = calculateScoresTs(grade, perfectAnswers, keysObj);
    console.log(`  [Profile 1 Perfect] Grade ${grade} Total Score: ${perfRes.scores.total}`);

    // Profile 2: Stress Student (comma decimal, extra space, UPPERCASE)
    const stressAnswers = {};
    Object.keys(perfectAnswers).forEach(qId => {
      let val = perfectAnswers[qId];
      if (val.includes('.')) val = val.replace('.', ',');
      val = `   ${val.toUpperCase()}   `;
      stressAnswers[qId] = val;
    });
    const stressRes = calculateScoresTs(grade, stressAnswers, keysObj);
    console.log(`  [Profile 2 Stress ] Grade ${grade} Total Score: ${stressRes.scores.total}`);

    // Profile 3: Chaos (null, empty, invalid types)
    const chaosAnswers = {
      "invalid_1": null,
      "invalid_2": undefined,
      "invalid_3": "",
      "invalid_4": {},
      "invalid_5": []
    };
    const chaosRes = calculateScoresTs(grade, chaosAnswers, keysObj);
    console.log(`  [Profile 3 Chaos  ] Grade ${grade} Total Score: ${chaosRes.scores.total}`);
  }

  console.log("\n===============================================================================");
  console.log("📊 SUMMARY MATRIX:");
  console.log("===============================================================================");
  console.table(summary);

  console.log("\n===============================================================================");
  console.log(`🐛 DISCOVERED BUGS (${bugList.length} total):`);
  console.log("===============================================================================");
  console.table(bugList);

  process.exit(0);
}

runFullAudit().catch(err => {
  console.error("Full audit error:", err);
  process.exit(1);
});
