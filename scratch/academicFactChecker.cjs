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

async function extractQuestionsAndAnswers() {
  const resultData = {};

  for (const grade of [8, 9, 10, 11]) {
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

    resultData[grade] = {
      questions: questionsObj,
      keys: keysObj
    };
  }

  fs.writeFileSync(path.join(__dirname, 'extracted_qa_8_11.json'), JSON.stringify(resultData, null, 2), 'utf-8');
  console.log("Successfully extracted QA to scratch/extracted_qa_8_11.json");
  process.exit(0);
}

extractQuestionsAndAnswers().catch(err => {
  console.error(err);
  process.exit(1);
});
