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

async function patchAllKeys() {
  console.log("===============================================================================");
  console.log("🛠️ APPLYING ACADEMIC FACTCHECK FIXES AND PATCHING FIRESTORE ANSWER KEYS");
  console.log("===============================================================================\n");

  const eng10_11_patches = {
    // Phase 1 missing keys + Phase 2 grammar fixes
    "en_10_11_q19": "had known",
    "en_10_11_q20": "had worked",
    "en_10_11_q21": "hadn’t said",
    "en_10_11_q22": "has been fixing",
    "en_10_11_q23": "will have built",
    "en_10_11_q24": "would finish",
    "en_10_11_q25": "were",
    "en_10_11_q26": "haven’t completed",
    "en_10_11_q27": "breaking",
    "en_10_11_q28": "had been waiting",
    
    // Academic Factcheck Fixes for Grade 10 & 11 English distractor errors
    "en_10_11_q30": "He told me that he would come later.",
    "en_10_11_q32": "She suggested taking a break.",
    "en_10_11_q34": "I look forward to hearing from you.",

    // Gap filling passage
    "en_10_11_q35": "however",
    "en_10_11_q36": "despite",
    "en_10_11_q37": "nevertheless",
    "en_10_11_q38": "while",
    "en_10_11_q39": "whereas",
    "en_10_11_q40": "in spite of",

    // Sentence Ordering
    "en_10_11_q41": "she,has,been,looking,for,a,job,for,six,months",
    "en_10_11_q42": "I,remember,to,lock,the,door,before,leaving",
    "en_10_11_q43": "I,would,rather,stay,at,home,than,go,out",
    "en_10_11_q44": "they,went,out,despite,the,heavy,rain",
    "en_10_11_q45": "try,pressing,this,button,to,see,if,it,works"
  };

  for (const grade of [10, 11]) {
    const docIds = [
      `test_grade_${grade}`,
      `test_grade_${grade}_org_future_leaders`,
      `key_grade_${grade}_org_future_leaders`,
      `key_grade_${grade}_GLOBAL`,
      `${grade}`
    ];

    for (const docId of docIds) {
      const docRef = db.collection("test_answer_keys").doc(docId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const existingKeys = docSnap.data()?.keys || {};
        if (!existingKeys.english) existingKeys.english = {};

        Object.keys(eng10_11_patches).forEach(qId => {
          existingKeys.english[qId] = {
            ans: eng10_11_patches[qId],
            topic: "Грамматика и лексика английского языка",
            pts: 1
          };
        });

        await docRef.set({ keys: existingKeys }, { merge: true });
        console.log(`✅ Patched Grade ${grade} English keys in doc: ${docId}`);
      }
    }
  }

  console.log("\n===============================================================================");
  console.log("🎉 ALL ACADEMIC FACTCHECK PATCHES SUCCESSFULLY APPLIED TO FIRESTORE!");
  console.log("===============================================================================");

  process.exit(0);
}

patchAllKeys().catch(err => {
  console.error("Patching error:", err);
  process.exit(1);
});
