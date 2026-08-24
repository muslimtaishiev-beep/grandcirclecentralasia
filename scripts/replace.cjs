const fs = require('fs');
const code = fs.readFileSync('src/pages/Testing.tsx', 'utf8');
const lines = code.split('\n');

const startLine = 1196; // 0-indexed for line 1197
const endLine = 1507; // 0-indexed for line 1508

const replacement = `              {section.q.map((q: any) => (
                <QuestionFactory 
                  key={q.id}
                  question={q}
                  value={answers[q.id]}
                  onChange={(val: any) => setAnswers({...answers, [q.id]: val})}
                />
              ))}`;

lines.splice(startLine, endLine - startLine + 1, replacement);
fs.writeFileSync('src/pages/Testing.tsx', lines.join('\n'));
