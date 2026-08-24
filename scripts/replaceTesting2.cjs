const fs = require('fs');
const code = fs.readFileSync('src/pages/Testing.tsx', 'utf8');
const lines = code.split('\n');

const startIdx = lines.findIndex(l => l.includes('<QuestionFactory'));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes('/>'));

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `                <QuestionFactory 
                  key={q.id}
                  question={q}
                  value={
                    (q.type === 'MATRIX_GRID' || q.type === 'ORDERING') && typeof answers[q.id] === 'string'
                      ? (() => { try { return JSON.parse(answers[q.id]); } catch { return answers[q.id]; } })()
                      : answers[q.id]
                  }
                  onChange={(val: any) => {
                    const stringified = typeof val === 'object' ? JSON.stringify(val) : val;
                    setAnswers({...answers, [q.id]: stringified});
                  }}
                />`;
  lines.splice(startIdx, endIdx - startIdx + 1, replacement);
  fs.writeFileSync('src/pages/Testing.tsx', lines.join('\n'));
  console.log("Successfully replaced QuestionFactory parsing logic in Testing.tsx");
} else {
  console.error("Could not find QuestionFactory block");
}
