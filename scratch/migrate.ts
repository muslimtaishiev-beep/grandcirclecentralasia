import admin from "firebase-admin";
import path from "path";
import { readFileSync, existsSync } from "fs";
import { testsData } from "../src/data/testsData";

const keyPath = path.join(process.cwd(), "serviceAccountKey.json");
if (existsSync(keyPath)) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}

const tenantsToSeed = ["org_future_leaders", "GLOBAL"];

async function run() {
  const db = admin.firestore();
  const grades = [5, 6, 7, 8, 9, 10, 11];

  for (const tenantId of tenantsToSeed) {
    console.log(`\n--- Seeding Tests for Tenant: ${tenantId} ---`);

    for (const grade of grades) {
      const rawData = (testsData as any)[grade] || (testsData as any)[`grade_${grade}`];
      if (!rawData) {
        console.warn(`No test data found in testsData for grade ${grade}`);
        continue;
      }

      const docId = tenantId === "org_future_leaders" ? `future_leaders_grade_${grade}` : `test_grade_${grade}_${tenantId}`;
      const title = rawData.title || `Вступительный экзамен — ${grade} класс`;

      const questionsGrouped = rawData.questions || {
        russian: rawData.russian || [],
        math: rawData.math || [],
        logic: rawData.logic || [],
        english: rawData.english || []
      };

      const ruCount = (questionsGrouped.russian || []).length;
      const maCount = (questionsGrouped.math || []).length;
      const loCount = (questionsGrouped.logic || []).length;
      const enCount = (questionsGrouped.english || []).length;
      const totalCount = ruCount + maCount + loCount + enCount;

      const testDocData = {
        id: docId,
        tenantId,
        grade: Number(grade),
        title,
        status: "Active",
        timeLimit: 90,
        questionsCount: totalCount,
        details: `Русский язык (${ruCount}), Математика (${maCount}), Логика (${loCount}), Английский (${enCount})`,
        questions: questionsGrouped,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // Save main test doc in Firestore
      await db.collection("tests").doc(docId).set(testDocData, { merge: true });
      console.log(`Saved test doc: ${docId} (${totalCount} questions)`);

      // Save subcollection questions for fast granular queries
      const questionsBatch = db.batch();
      let qIndex = 0;
      for (const section of ["russian", "math", "logic", "english"]) {
        const qList = questionsGrouped[section] || [];
        for (const q of qList) {
          qIndex++;
          const qRef = db.collection("tests").doc(docId).collection("questions").doc(q.id || `q_${section}_${qIndex}`);
          questionsBatch.set(qRef, {
            ...q,
            section,
            orderIndex: qIndex,
            tenantId
          }, { merge: true });
        }
      }
      await questionsBatch.commit();
      console.log(`Saved ${qIndex} questions to subcollection tests/${docId}/questions`);

      // Save answer key in Firestore `test_answer_keys`
      const answerKeyDocId = `key_grade_${grade}_${tenantId}`;
      await db.collection("test_answer_keys").doc(answerKeyDocId).set({
        id: answerKeyDocId,
        tenantId,
        grade: Number(grade),
        keys: questionsGrouped,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log(`Saved answer key: ${answerKeyDocId}`);
    }
  }

  console.log("\n✅ ALL 7 ENTRANCE TESTS (GRADES 5-11) FULLY SEEDED TO FIRESTORE!");
  process.exit(0);
}

run();
