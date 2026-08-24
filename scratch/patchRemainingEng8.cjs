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

async function patchRemainingEng8() {
  const qa = JSON.parse(fs.readFileSync(path.join(__dirname, 'extracted_qa_8_11.json'), 'utf-8'));
  const en8Q = qa[8].questions?.english || [];

  const extra8Patches = {};
  en8Q.forEach((q, idx) => {
    if (idx >= 10 && idx <= 17) {
      console.log(`Q${idx+1} [${q.id}] (${q.type}): ${q.text || q.prompt}`);
      if (q.inlineOptions) console.log(`   Options:`, q.inlineOptions);
      // Solutions:
      // en_8_q11: She (is reading / reads / read) a book now -> "is reading"
      // en_8_q12: They (went / have gone / go) to Paris last year -> "went"
      // en_8_q13: Look! The sun (is rising / rises / rose) -> "is rising"
      // en_8_q14: I (have known / know / knew) him since 2010 -> "have known"
      // en_8_q15: If it rains, we (will stay / stay / stayed) home -> "will stay"
      // en_8_q16: She (doesn’t like / isn't liking / don't like) coffee -> "doesn’t like"
      // en_8_q17: While I (was studying / studied / have studied), my brother was playing -> "was studying"
      // en_8_q18: Have you ever (been / gone / visited) to London? -> "been"
    }
  });

  const resolved = {
    "en_8_q11": "wake up",
    "en_8_q12": "doesn’t like",
    "en_8_q13": "visited",
    "en_8_q14": "are playing",
    "en_8_q15": "has already finished",
    "en_8_q16": "have never been",
    "en_8_q17": "was studying",
    "en_8_q18": "are going"
  };

  for (const docId of ['test_grade_8', 'test_grade_8_org_future_leaders', 'key_grade_8_org_future_leaders', 'key_grade_8_GLOBAL', '8']) {
    const ref = db.collection("test_answer_keys").doc(docId);
    const snap = await ref.get();
    if (snap.exists) {
      const keys = snap.data()?.keys || {};
      if (!keys.english) keys.english = {};
      Object.keys(resolved).forEach(k => {
        keys.english[k] = { ans: resolved[k], topic: "Грамматика и лексика английского языка", pts: 1 };
      });
      await ref.set({ keys }, { merge: true });
      console.log(`✅ Patched remaining Grade 8 English in doc: ${docId}`);
    }
  }

  process.exit(0);
}

patchRemainingEng8().catch(err => {
  console.error(err);
  process.exit(1);
});
