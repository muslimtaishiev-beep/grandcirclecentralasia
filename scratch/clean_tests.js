import fs from 'fs';

let content = fs.readFileSync('src/data/testsData.ts', 'utf8');

// We need to clean up old tasks:
// If a grade has ru_X_new or ru_X, we should delete russian_X.
const grades = ['7', '8', '9', '10', '11'];

grades.forEach(g => {
  const startIdx = content.indexOf(`"${g}": {`);
  if (startIdx === -1) return;
  
  const endIdx = g === '11' ? content.length : content.indexOf(`"${parseInt(g)+1}": {`);
  const block = content.substring(startIdx, endIdx);
  
  const ruStart = block.indexOf('russian: [');
  const maStart = block.indexOf('math: [');
  if (ruStart === -1 || maStart === -1) return;
  
  let ruBlock = block.substring(ruStart, maStart);
  
  // Find all new tasks
  const newIds = [...ruBlock.matchAll(/id:\s*"(ru_\d+(_new)?)"/g)].map(m => m[1]);
  
  newIds.forEach(newId => {
    // Extract the number
    const match = newId.match(/ru_(\d+)/);
    if (match) {
      const taskNum = match[1];
      const oldId = `russian_${taskNum}`;
      
      // Remove the old object
      const oldObjRegex = new RegExp(`\\{\\s*id:\\s*"${oldId}",[\\s\\S]*?(?=\\{[\\s\\S]*?id:|\\],\\s*math:)`, 'g');
      ruBlock = ruBlock.replace(oldObjRegex, '');
    }
  });
  
  content = content.substring(0, startIdx + ruStart) + ruBlock + content.substring(startIdx + maStart);
});

fs.writeFileSync('src/data/testsData.ts', content);
console.log('Cleaned testsData.ts');
