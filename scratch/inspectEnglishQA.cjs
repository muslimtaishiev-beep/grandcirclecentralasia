const fs = require('fs');
const path = require('path');

const qa = JSON.parse(fs.readFileSync(path.join(__dirname, 'extracted_qa_8_11.json'), 'utf-8'));

for (const g of [8, 9, 10, 11]) {
  console.log(`\n=== GRADE ${g} ENGLISH QUESTIONS & KEYS ===`);
  const enQ = qa[g].questions?.english || [];
  const enK = qa[g].keys?.english || {};

  enQ.forEach((q, idx) => {
    const k = enK[q.id];
    console.log(`Q${idx+1} [${q.id}] (${q.type}): Key="${k?.ans}"`);
    console.log(`   Prompt: ${q.text || q.prompt}`);
    if (q.inlineOptions) console.log(`   inlineOptions:`, q.inlineOptions);
    if (q.dragItems) console.log(`   dragItems:`, q.dragItems);
    if (q.options) console.log(`   options:`, q.options);
  });
}
