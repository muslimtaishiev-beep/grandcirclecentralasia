const fs = require('fs');
const path = require('path');

const qa = JSON.parse(fs.readFileSync(path.join(__dirname, 'extracted_qa_8_11.json'), 'utf-8'));

[8, 9].forEach(g => {
  console.log(`\n=================== GRADE ${g} ENGLISH ===================`);
  const enQ = qa[g].questions?.english || [];
  const enK = qa[g].keys?.english || {};

  enQ.forEach((q, idx) => {
    const k = enK[q.id];
    if (!k || k.ans === undefined) {
      console.log(`\n[MISSING KEY] Q${idx+1} (${q.id}) Type: ${q.type}`);
      console.log(`  Text/Prompt: ${q.text || q.prompt}`);
      if (q.options) console.log(`  Options:`, q.options);
      if (q.inlineOptions) console.log(`  InlineOptions:`, q.inlineOptions);
      if (q.dragItems) console.log(`  DragItems:`, q.dragItems);
    }
  });
});
