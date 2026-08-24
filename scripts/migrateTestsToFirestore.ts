import admin from 'firebase-admin';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import * as fs from 'fs';

// @ts-ignore
import { testsData } from '../src/data/testsData.js';
// @ts-ignore
import { ANSWER_KEYS } from '../src/lib/scoringEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

try {
  let serviceAccount;
  const keyPath = path.join(__dirname, '../serviceAccountKey.json');
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else if (fs.existsSync(keyPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
  } else {
    throw new Error("No service account found");
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
} catch (e) {
  console.error("Error initializing Firebase Admin:", e);
  process.exit(1);
}

const db = admin.firestore();
const TENANT_ID = "org_future_leaders";

async function migrate() {
  console.log("🚀 Starting secure migration of tests to Firestore...");

  const grades = Object.keys(testsData);

  for (const grade of grades) {
    const testId = `test_grade_${grade}`;
    const gradeData = testsData[grade as any];
    const answerKeyData = ANSWER_KEYS[grade] || { russian: {}, math: {}, logic: {}, english: {} };

    // 1. Build public test document (NO ANSWERS)
    const publicTestDoc = {
      id: testId,
      tenantId: TENANT_ID,
      grade: Number(grade),
      title: `Вступительный тест за ${grade} класс`,
      description: "Тест для проверки базовых знаний",
      subjects: ["russian", "math", "logic", "english"],
      questions: {
        russian: (gradeData.russian || []).map((q: any) => ({ ...q })),
        math: (gradeData.math || []).map((q: any) => ({ ...q })),
        logic: (gradeData.logic || []).map((q: any) => ({ ...q })),
        english: (gradeData.english || []).map((q: any) => ({ ...q }))
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Ensure we don't accidentally leak correct answers if they were somehow in testsData
    const stripAnswers = (qList: any[]) => {
      return qList.map(q => {
        const safeQ = { ...q };
        delete safeQ.correctAnswer;
        delete safeQ.correctAnswers;
        delete safeQ.answer;
        return safeQ;
      });
    };

    publicTestDoc.questions.russian = stripAnswers(publicTestDoc.questions.russian);
    publicTestDoc.questions.math = stripAnswers(publicTestDoc.questions.math);
    publicTestDoc.questions.logic = stripAnswers(publicTestDoc.questions.logic);
    publicTestDoc.questions.english = stripAnswers(publicTestDoc.questions.english);

    // 2. Build protected answer keys document
    // We already have it from ANSWER_KEYS imported from scoringEngine.ts
    const protectedAnswerKeyDoc = {
      id: testId,
      tenantId: TENANT_ID,
      grade: Number(grade),
      keys: {
        russian: answerKeyData.russian || {},
        math: answerKeyData.math || {},
        logic: answerKeyData.logic || {},
        english: answerKeyData.english || {}
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // 3. Write to Firestore in a batch
    const batch = db.batch();
    const testRef = db.collection("tests").doc(testId);
    const keyRef = db.collection("test_answer_keys").doc(testId);

    batch.set(testRef, publicTestDoc);
    batch.set(keyRef, protectedAnswerKeyDoc);

    await batch.commit();
    console.log(`✅ Migrated grade ${grade} -> tests/${testId} & test_answer_keys/${testId}`);
  }

  console.log("🎉 Migration completed successfully!");
  process.exit(0);
}

migrate().catch(console.error);
