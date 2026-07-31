import fs from 'fs';

let content = fs.readFileSync('src/data/testsData.ts', 'utf8');

const grades = ['7', '8', '9', '10', '11'];

grades.forEach(g => {
  const startIdx = content.indexOf(`"${g}": {`);
  if (startIdx === -1) return;
  
  const endIdx = g === '11' ? content.length : content.indexOf(`"${parseInt(g)+1}": {`);
  const block = content.substring(startIdx, endIdx);
  
  const ruStart = block.indexOf('russian: [');
  const maStart = block.indexOf('math: [');
  if (ruStart === -1 || maStart === -1) return;
  
  const ruBlock = block.substring(ruStart, maStart);
  
  // We need to parse the array elements and sort them.
  // It's a bit tricky to parse raw TS code. We can extract each object.
  // Let's use a regex to capture each top-level object in the russian array.
  
  const objects = [];
  let depth = 0;
  let currentObj = '';
  let inString = false;
  let startObj = false;
  
  const arrayContentStart = ruBlock.indexOf('[') + 1;
  const arrayContentEnd = ruBlock.lastIndexOf(']');
  const arrayContent = ruBlock.substring(arrayContentStart, arrayContentEnd);
  
  for (let i = 0; i < arrayContent.length; i++) {
    const char = arrayContent[i];
    if (char === '"' && arrayContent[i-1] !== '\\') {
      inString = !inString;
    }
    
    if (!inString) {
      if (char === '{') {
        depth++;
        startObj = true;
      } else if (char === '}') {
        depth--;
      }
    }
    
    if (startObj) {
      currentObj += char;
      if (depth === 0) {
        objects.push(currentObj);
        currentObj = '';
        startObj = false;
      }
    }
  }
  
  objects.sort((a, b) => {
    const getNum = (str) => {
      const match = str.match(/Задание №(\d+)/);
      return match ? parseInt(match[1]) : 999;
    };
    return getNum(a) - getNum(b);
  });
  
  const newRuBlock = 'russian: [\n' + objects.join(',\n') + '\n    ],\n    ';
  content = content.substring(0, startIdx + ruStart) + newRuBlock + content.substring(startIdx + maStart);
});

fs.writeFileSync('src/data/testsData.ts', content);
console.log('Sorted testsData.ts');
