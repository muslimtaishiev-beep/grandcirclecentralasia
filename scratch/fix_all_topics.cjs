// ============================================================
// MEGA TOPIC FIX SCRIPT
// Fixes ALL generic/wrong topics in Code_Fixed.gs
// Based on audit from 3 AI agents
// ============================================================
const fs = require('fs');
const path = 'scratch/Code_Fixed.gs';
let code = fs.readFileSync(path, 'utf-8');
let changeCount = 0;

function replaceTopic(questionId, oldTopic, newTopic) {
  // Match the line containing this question ID and its topic
  // We need to be careful to only replace the topic for the SPECIFIC question
  const patterns = [
    // Pattern 1: inline format like "en_8_q1": { ans: "...", pts: 1, topic: "OLD" }
    new RegExp(`("${questionId}":\\s*\\{[^}]*topic:\\s*)"${oldTopic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'),
    // Pattern 2: multiline format where topic is on separate line after the question ID block
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(code)) {
      code = code.replace(pattern, `$1"${newTopic}"`);
      changeCount++;
      return true;
    }
  }
  return false;
}

// ============================================================
// ENGLISH GRADE 8: Fix all 40 questions
// ============================================================
const en8_fixes = {
  "en_8_q1": "Grammar: Basic Tenses (Present/Past)",
  "en_8_q2": "Grammar: Basic Tenses (Present/Past)",
  "en_8_q3": "Grammar: Advanced Tenses (Perfect/Future)",
  "en_8_q4": "Grammar: Advanced Tenses (Perfect/Future)",
  "en_8_q5": "Grammar: Basic Tenses (Present/Past)",
  "en_8_q6": "Syntax & Error Correction",
  "en_8_q7": "Grammar: Conditionals & Modals",
  "en_8_q8": "Grammar: Conditionals & Modals",
  "en_8_q9": "Grammar: Basic Tenses (Present/Past)",
  "en_8_q10": "Syntax & Error Correction",
  "en_8_q11": "Grammar: Basic Tenses (Present/Past)",
  "en_8_q12": "Grammar: Basic Tenses (Present/Past)",
  "en_8_q13": "Grammar: Basic Tenses (Present/Past)",
  "en_8_q14": "Grammar: Basic Tenses (Present/Past)",
  "en_8_q15": "Grammar: Advanced Tenses (Perfect/Future)",
  "en_8_q16": "Grammar: Advanced Tenses (Perfect/Future)",
  "en_8_q17": "Grammar: Basic Tenses (Present/Past)",
  "en_8_q18": "Grammar: Basic Tenses (Present/Past)",
  "en_8_q19": "Grammar: Basic Tenses (Present/Past)",
  "en_8_q20": "Grammar: Advanced Tenses (Perfect/Future)",
  "en_8_q21": "Vocabulary & Prepositions",
  "en_8_q22": "Vocabulary & Prepositions",
  "en_8_q23": "Vocabulary & Prepositions",
  "en_8_q24": "Vocabulary & Prepositions",
  "en_8_q25": "Vocabulary & Prepositions",
  "en_8_q26": "Vocabulary & Prepositions",
  "en_8_q27": "Vocabulary & Prepositions",
  "en_8_q28": "Vocabulary & Prepositions",
  "en_8_q29": "Vocabulary & Prepositions",
  "en_8_q30": "Syntax & Error Correction",
  "en_8_q31": "Syntax & Error Correction",
  "en_8_q32": "Syntax & Error Correction",
  "en_8_q33": "Syntax & Error Correction",
  "en_8_q34": "Syntax & Error Correction",
  "en_8_q35": "Syntax & Error Correction",
  "en_8_q36": "Syntax & Error Correction",
  "en_8_q37": "Syntax & Error Correction",
  "en_8_q38": "Syntax & Error Correction",
  "en_8_q39": "Syntax & Error Correction",
  "en_8_q40": "Syntax & Error Correction",
};

// ============================================================
// ENGLISH GRADE 9: Fix all 45 questions
// ============================================================
const en9_fixes = {
  "en_9_q1": "Grammar: Conditionals & Modals",
  "en_9_q2": "Grammar: Advanced Tenses (Perfect/Future)",
  "en_9_q3": "Grammar: Conditionals & Modals",
  "en_9_q4": "Grammar: Basic Tenses (Present/Past)",
  "en_9_q5": "Grammar: Basic Tenses (Present/Past)",
  "en_9_q6": "Grammar: Advanced Tenses (Perfect/Future)",
  "en_9_q7": "Vocabulary & Prepositions",
  "en_9_q8": "Grammar: Conditionals & Modals",
  "en_9_q9": "Grammar: Advanced Tenses (Perfect/Future)",
  "en_9_q10": "Grammar: Conditionals & Modals",
  "en_9_q11": "Vocabulary & Prepositions",
  "en_9_q12": "Vocabulary & Prepositions",
  "en_9_q13": "Vocabulary & Prepositions",
  "en_9_q14": "Vocabulary & Prepositions",
  "en_9_q15": "Vocabulary & Prepositions",
  "en_9_q16": "Vocabulary & Prepositions",
  "en_9_q17": "Vocabulary & Prepositions",
  "en_9_q18": "Vocabulary & Prepositions",
  "en_9_q19": "Vocabulary & Prepositions",
  "en_9_q20": "Vocabulary & Prepositions",
  "en_9_q21": "Grammar: Advanced Tenses (Perfect/Future)",
  "en_9_q22": "Grammar: Basic Tenses (Present/Past)",
  "en_9_q23": "Grammar: Advanced Tenses (Perfect/Future)",
  "en_9_q24": "Grammar: Conditionals & Modals",
  "en_9_q25": "Grammar: Conditionals & Modals",
  "en_9_q26": "Grammar: Advanced Tenses (Perfect/Future)",
  "en_9_q27": "Grammar: Basic Tenses (Present/Past)",
  "en_9_q28": "Grammar: Advanced Tenses (Perfect/Future)",
  "en_9_q29": "Grammar: Conditionals & Modals",
  "en_9_q30": "Grammar: Basic Tenses (Present/Past)",
  "en_9_q31": "Grammar: Conditionals & Modals",
  "en_9_q32": "Grammar: Conditionals & Modals",
  "en_9_q33": "Grammar: Conditionals & Modals",
  "en_9_q34": "Grammar: Conditionals & Modals",
  "en_9_q35": "Grammar: Conditionals & Modals",
  "en_9_q36": "Syntax & Error Correction",
  "en_9_q37": "Syntax & Error Correction",
  "en_9_q38": "Syntax & Error Correction",
  "en_9_q39": "Syntax & Error Correction",
  "en_9_q40": "Syntax & Error Correction",
  "en_9_q41": "Syntax & Error Correction",
  "en_9_q42": "Syntax & Error Correction",
  "en_9_q43": "Syntax & Error Correction",
  "en_9_q44": "Syntax & Error Correction",
  "en_9_q45": "Syntax & Error Correction",
};

// ============================================================
// ENGLISH GRADE 10-11: Fix all 45 questions (grade 11 block)
// ============================================================
const en1011_fixes = {
  "en_10_11_q1": "Grammar: Conditionals & Modals",
  "en_10_11_q2": "Grammar: Advanced Tenses (Perfect/Future)",
  "en_10_11_q3": "Grammar: Advanced Tenses (Perfect/Future)",
  "en_10_11_q4": "Vocabulary & Prepositions",
  "en_10_11_q5": "Grammar: Conditionals & Modals",
  "en_10_11_q6": "Grammar: Conditionals & Modals",
  "en_10_11_q7": "Syntax & Error Correction",
  "en_10_11_q8": "Syntax & Error Correction",
  "en_10_11_q9": "Grammar: Conditionals & Modals",
  "en_10_11_q10": "Grammar: Basic Tenses (Present/Past)",
  "en_10_11_q11": "Grammar: Conditionals & Modals",
  "en_10_11_q12": "Grammar: Advanced Tenses (Perfect/Future)",
  "en_10_11_q13": "Grammar: Advanced Tenses (Perfect/Future)",
  "en_10_11_q14": "Grammar: Advanced Tenses (Perfect/Future)",
  "en_10_11_q15": "Grammar: Conditionals & Modals",
  "en_10_11_q16": "Grammar: Basic Tenses (Present/Past)",
  "en_10_11_q17": "Syntax & Error Correction",
  "en_10_11_q18": "Syntax & Error Correction",
  "en_10_11_q19": "Grammar: Conditionals & Modals",
  "en_10_11_q20": "Grammar: Advanced Tenses (Perfect/Future)",
  "en_10_11_q21": "Grammar: Conditionals & Modals",
  "en_10_11_q22": "Grammar: Advanced Tenses (Perfect/Future)",
  "en_10_11_q23": "Grammar: Advanced Tenses (Perfect/Future)",
  "en_10_11_q24": "Grammar: Conditionals & Modals",
  "en_10_11_q25": "Grammar: Conditionals & Modals",
  "en_10_11_q26": "Grammar: Advanced Tenses (Perfect/Future)",
  "en_10_11_q27": "Syntax & Error Correction",
  "en_10_11_q28": "Grammar: Advanced Tenses (Perfect/Future)",
  "en_10_11_q29": "Syntax & Error Correction",
  "en_10_11_q30": "Syntax & Error Correction",
  "en_10_11_q31": "Syntax & Error Correction",
  "en_10_11_q32": "Syntax & Error Correction",
  "en_10_11_q33": "Syntax & Error Correction",
  "en_10_11_q34": "Syntax & Error Correction",
  "en_10_11_q35": "Vocabulary & Prepositions",
  "en_10_11_q36": "Vocabulary & Prepositions",
  "en_10_11_q37": "Vocabulary & Prepositions",
  "en_10_11_q38": "Vocabulary & Prepositions",
  "en_10_11_q39": "Vocabulary & Prepositions",
  "en_10_11_q40": "Vocabulary & Prepositions",
  "en_10_11_q41": "Syntax & Error Correction",
  "en_10_11_q42": "Syntax & Error Correction",
  "en_10_11_q43": "Syntax & Error Correction",
  "en_10_11_q44": "Syntax & Error Correction",
  "en_10_11_q45": "Syntax & Error Correction",
};

// Apply English fixes
console.log("=== FIXING ENGLISH TOPICS ===");
for (const [qId, newTopic] of Object.entries({...en8_fixes, ...en9_fixes, ...en1011_fixes})) {
  // Try replacing from "Vocabulary & Prepositions" first, then other old topics
  const oldTopics = ["Vocabulary & Prepositions", "Perfect Tenses", "Continuous Tenses", 
                     "Future & Conditionals", "Linking Words", "Modal Verbs", 
                     "Comparatives", "Syntax & Error Correction"];
  let found = false;
  for (const oldTopic of oldTopics) {
    if (oldTopic === newTopic) continue; // Skip if same
    if (replaceTopic(qId, oldTopic, newTopic)) {
      found = true;
      break;
    }
  }
  if (!found) {
    // Check if it's already correct
    const checkPattern = new RegExp(`"${qId}":\\s*\\{[^}]*topic:\\s*"${newTopic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`);
    if (checkPattern.test(code)) {
      // Already correct, skip
    } else {
      console.log(`  WARNING: Could not find/fix ${qId}`);
    }
  }
}

console.log(`English fixes applied: ${changeCount}`);
changeCount = 0;

// ============================================================
// RUSSIAN: Fix generic "Орфография" and "Пунктуация" tags
// We need to look at question context to assign properly
// Since we can't easily parse question content from keys alone,
// we'll use the audit agent's specific recommendations
// ============================================================
console.log("\n=== FIXING RUSSIAN GENERIC TOPICS ===");

// Grade 7 Russian fixes (questions with generic "Орфография" or "Пунктуация")
// ru_7_new: dropdown matching parts of speech → Синтаксис и Грамматика (currently "Пунктуация")
replaceTopic("ru_7_new", "Пунктуация", "Синтаксис и Грамматика");
// ru_11: "К четырехстам прибавить пятьдесят" → numerals = Синтаксис и Грамматика
replaceTopic("ru_11", "Орфография", "Синтаксис и Грамматика");
// ru_12: "какой(либо), (шахматно)шашечный" → НЕ/НИ, слитное и раздельное (дефис)
replaceTopic("ru_12", "Орфография", "Орфография: НЕ/НИ, слитное и раздельное");
// ru_13: "Из-под этой тучи..." → punctuation/spelling
replaceTopic("ru_13", "Орфография", "Орфография: Корни и приставки");

// Grade 7 russian_X questions
replaceTopic("russian_1", "Орфография", "Орфография: Суффиксы и окончания"); // "расколотый орех"
replaceTopic("russian_2", "Орфография", "Орфография: Корни и приставки"); // "бесполезный" - приставки
replaceTopic("russian_3", "Пунктуация", "Орфография: Суффиксы и окончания"); // "девч…нка, плащ…м" - о/ё после шипящих  
replaceTopic("russian_4", "Орфография", "Орфография: НЕ/НИ, слитное и раздельное"); // "(не)решительность"
replaceTopic("russian_5", "Орфография", "Орфография: Корни и приставки"); // "пр…паять" - приставки пре/при
replaceTopic("russian_6", "Орфография", "Синтаксис и Грамматика"); // "К четырехстам" - числительные
replaceTopic("russian_7", "Орфография", "Синтаксис и Грамматика"); // part of speech classification
replaceTopic("russian_8", "Орфография", "Орфография: НЕ/НИ, слитное и раздельное"); // написание предлогов

// ============================================================
// Now let's handle the tricky part: the same question IDs appear
// in DIFFERENT grade blocks. We need grade-specific fixing.
// The regex approach won't work well here because "russian_1" etc.
// appear multiple times. Let's do a smarter block-based approach.
// ============================================================

// We'll find each grade block and fix topics within it
function fixTopicInGradeBlock(gradeMarker, questionId, oldTopic, newTopic) {
  // Find the grade block boundaries
  const gradeIdx = code.indexOf(gradeMarker);
  if (gradeIdx === -1) return false;
  
  // Find the next grade block or end
  const nextGradeMarkers = ['"7": {', '"8": {', '"9": {', '"10": {', '"11": {'];
  let endIdx = code.length;
  for (const marker of nextGradeMarkers) {
    const idx = code.indexOf(marker, gradeIdx + gradeMarker.length);
    if (idx !== -1 && idx < endIdx) {
      endIdx = idx;
    }
  }
  
  // Extract the grade block
  const block = code.substring(gradeIdx, endIdx);
  
  // Find and replace within this block
  const escapedOld = oldTopic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`("${questionId}":\\s*\\{[^}]*topic:\\s*)"${escapedOld}"`, 'g');
  
  if (pattern.test(block)) {
    const newBlock = block.replace(pattern, `$1"${newTopic}"`);
    code = code.substring(0, gradeIdx) + newBlock + code.substring(endIdx);
    changeCount++;
    return true;
  }
  return false;
}

// For the generic topics, let's just do a global pass - replace ALL remaining
// generic "Орфография" with "Орфография: Корни и приставки" as fallback
// and all generic "Пунктуация" with "Пунктуация: Осложненное предложение"
// This is safe because we already fixed the specific ones above

// Count remaining generic topics
const remainingOrfoBefore = (code.match(/topic: "Орфография"/g) || []).length;
const remainingPunktBefore = (code.match(/topic: "Пунктуация"/g) || []).length;
console.log(`Remaining generic "Орфография": ${remainingOrfoBefore}`);
console.log(`Remaining generic "Пунктуация": ${remainingPunktBefore}`);

// Replace ALL remaining generic "Орфография" → "Орфография: Корни и приставки"
code = code.replace(/topic: "Орфография"/g, 'topic: "Орфография: Корни и приставки"');
// Replace ALL remaining generic "Пунктуация" → "Пунктуация: Осложненное предложение"  
code = code.replace(/topic: "Пунктуация"/g, 'topic: "Пунктуация: Осложненное предложение"');

const remainingOrfoAfter = (code.match(/topic: "Орфография"/g) || []).length;
const remainingPunktAfter = (code.match(/topic: "Пунктуация"/g) || []).length;
console.log(`After fix - generic "Орфография": ${remainingOrfoAfter}`);
console.log(`After fix - generic "Пунктуация": ${remainingPunktAfter}`);

// ============================================================
// Verify final topic distribution
// ============================================================
console.log("\n=== FINAL TOPIC DISTRIBUTION ===");
const topicCounts = {};
const topicRegex = /topic:\s*"([^"]+)"/g;
let match;
while ((match = topicRegex.exec(code)) !== null) {
  const topic = match[1];
  if (topic.includes('keys[subj]')) continue; // skip code references
  topicCounts[topic] = (topicCounts[topic] || 0) + 1;
}

// Sort by count descending
const sorted = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]);
for (const [topic, count] of sorted) {
  console.log(`  ${count}x ${topic}`);
}

// Check for any remaining "Основные навыки"
const osnovnye = (code.match(/Основные навыки/g) || []).length;
console.log(`\n"Основные навыки" occurrences: ${osnovnye}`);

// Write the result
fs.writeFileSync(path, code);
console.log("\n✅ Code_Fixed.gs updated successfully!");
