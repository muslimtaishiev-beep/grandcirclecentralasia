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

async function patch8And9() {
  console.log("=== PATCHING MISSING ENGLISH KEYS FOR GRADES 8 & 9 ===");

  const eng8Patches = {
    "en_8_q19": "doesn’t understand",
    "en_8_q20": "have lived",
    "en_8_q21": "of",
    "en_8_q22": "in",
    "en_8_q23": "at",
    "en_8_q24": "at",
    "en_8_q25": "at",
    "en_8_q26": "any",
    "en_8_q27": "much",
    "en_8_q28": "too",
    "en_8_q29": "many",
    "en_8_q30": "most",
    "en_8_q31": "easier",
    "en_8_q32": "the tallest",
    "en_8_q33": "smaller",
    "en_8_q34": "the worst",
    "en_8_q35": "more interesting"
  };

  const eng9Patches = {
    "en_9_q11": "to",
    "en_9_q12": "for",
    "en_9_q13": "on",
    "en_9_q14": "to",
    "en_9_q15": "from",
    "en_9_q16": "of",
    "en_9_q17": "of",
    "en_9_q18": "in",
    "en_9_q19": "in",
    "en_9_q20": "in",
    "en_9_q21": "have been waiting",
    "en_9_q22": "was working",
    "en_9_q23": "haven't finished",
    "en_9_q24": "would come",
    "en_9_q25": "were",
    "en_9_q26": "had already eaten",
    "en_9_q27": "was written",
    "en_9_q28": "has been trying",
    "en_9_q29": "was able to",
    "en_9_q30": "were playing",
    "en_9_q31": "mustn't",
    "en_9_q32": "might",
    "en_9_q33": "should",
    "en_9_q34": "could",
    "en_9_q35": "have to"
  };

  for (const docId of ['test_grade_8', 'test_grade_8_org_future_leaders', 'key_grade_8_org_future_leaders', 'key_grade_8_GLOBAL', '8']) {
    const ref = db.collection("test_answer_keys").doc(docId);
    const snap = await ref.get();
    if (snap.exists) {
      const keys = snap.data()?.keys || {};
      if (!keys.english) keys.english = {};
      Object.keys(eng8Patches).forEach(k => {
        keys.english[k] = { ans: eng8Patches[k], topic: "Грамматика и лексика английского языка", pts: 1 };
      });
      await ref.set({ keys }, { merge: true });
      console.log(`✅ Patched Grade 8 English in doc: ${docId}`);
    }
  }

  for (const docId of ['test_grade_9', 'test_grade_9_org_future_leaders', 'key_grade_9_org_future_leaders', 'key_grade_9_GLOBAL', '9']) {
    const ref = db.collection("test_answer_keys").doc(docId);
    const snap = await ref.get();
    if (snap.exists) {
      const keys = snap.data()?.keys || {};
      if (!keys.english) keys.english = {};
      Object.keys(eng9Patches).forEach(k => {
        keys.english[k] = { ans: eng9Patches[k], topic: "Грамматика и лексика английского языка", pts: 1 };
      });
      await ref.set({ keys }, { merge: true });
      console.log(`✅ Patched Grade 9 English in doc: ${docId}`);
    }
  }

  process.exit(0);
}

patch8And9().catch(err => {
  console.error(err);
  process.exit(1);
});
