import admin from "firebase-admin";
import fs from "fs";
import path from "path";
// Ignore TS errors for module since we execute with tsx
// @ts-ignore
import { testsData } from "../src/data/testsData.ts";

const keyPath = path.join(process.cwd(), "serviceAccountKey.json");
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Helper to map old question types to new architecture types
function mapQuestionType(oldType: string): string {
  switch (oldType) {
    case "multiple_choice":
      return "MULTIPLE_CHOICE";
    case "free_text":
    case "number_input":
      return "TEXT_INPUT";
    case "drag_and_drop":
      return "ORDERING";
    case "logic_matrix":
    case "dropdown_multiple":
    case "inline_dropdown":
    case "two_step":
      return "MATRIX_GRID"; // We will adapt MatrixGrid or custom types for these
    default:
      return "TEXT_INPUT";
  }
}

function mapContent(question: any): any {
  const content: any = {};
  if (question.options) content.options = question.options;
  if (question.dragItems) content.items = question.dragItems.map((text: string, i: number) => ({ id: String(i+1), text }));
  if (question.matrixRows) content.rows = question.matrixRows.map((label: string, i: number) => ({ id: "r"+i, label }));
  if (question.matrixCols) content.columns = question.matrixCols;
  if (question.dropdownItems) content.dropdownItems = question.dropdownItems;
  if (question.inlineOptions) content.inlineOptions = question.inlineOptions;
  if (question.step2Text) content.step2Text = question.step2Text;
  if (question.html) content.html = question.html;
  if (question.instruction) content.instruction = question.instruction;
  return content;
}

async function migrate() {
  const tenantId = "org_future_leaders";
  
  for (const [testKey, testData] of Object.entries(testsData)) {
    console.log(`Migrating test: ${testKey}`);
    const testSlug = testKey; // e.g. future_leaders_grade_8
    const testDoc = db.collection("tests").doc(testSlug);
    
    // Save test metadata
    await testDoc.set({
      id: testSlug,
      tenantId: tenantId,
      slug: testSlug,
      title: testData.title || `Test ${testKey}`,
      timeLimit: testData.duration || 60,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const questionsRef = testDoc.collection("questions");
    let globalIndex = 0;

    // Iterate sections (english, math, logic, russian, physics, etc)
    const sections = ["english", "math", "logic", "russian", "physics", "chemistry", "biology", "history", "geography", "literature", "computer_science"];
    
    for (const section of sections) {
      // @ts-ignore
      const questionsArray = testData[section];
      if (questionsArray && Array.isArray(questionsArray)) {
        for (const q of questionsArray) {
          const type = mapQuestionType(q.type);
          const content = mapContent(q);
          const points = q.points || 1;
          
          await questionsRef.doc(q.id).set({
            id: q.id,
            section: section,
            type: type,
            prompt: q.text,
            orderIndex: globalIndex++,
            points: points,
            content: content,
            // In a real prod we'd put this in test_answers, but for the MVP factory it stays here
            correctAnswer: q.correctAnswer || {} 
          });
        }
      }
    }
    console.log(`Finished migrating test: ${testKey} (${globalIndex} questions)`);
  }
}

migrate().then(() => {
  console.log("Migration complete!");
  process.exit(0);
}).catch(e => {
  console.error("Migration failed:", e);
  process.exit(1);
});
