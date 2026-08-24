const { calculateScoresTs, isAnswerCorrect } = require('../src/lib/scoringEngine.ts');
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

async function testLogicScoringDetails() {
  const keyDoc = await db.collection("test_answer_keys").doc(`test_grade_10`).get();
  const keys = keyDoc.exists ? keyDoc.data()?.keys || {} : {};

  const answers = {
    "logic_1": "Белов-Чёрная рубашка,Серов-Белая рубашка,Чернов-Серая рубашка",
    "logic_2": "Сахар,Крупа,Вермишель",
    "logic_3": "Митя,Сеня,Толя,Костя,Юра",
    "logic_4": "Олег-Скрипач,Коля-Пианист,Ваня-Певец",
    "logic_5": "Уменьшилась в 2 раза",
    "logic_6": "60",
    "logic_7": "7",
    "logic_8": "240"
  };

  const logicKeys = keys.logic || {};
  Object.keys(logicKeys).forEach(qId => {
    const userVal = answers[qId];
    const keyVal = logicKeys[qId].ans;
    const ok = isAnswerCorrect(userVal, keyVal);
    console.log(`${qId}: Correct? ${ok ? '✅ YES' : '❌ NO'}`);
    console.log(`   User: "${userVal}"`);
    console.log(`   Target: "${keyVal}"`);
  });

  process.exit(0);
}

testLogicScoringDetails().catch(err => {
  console.error(err);
  process.exit(1);
});
