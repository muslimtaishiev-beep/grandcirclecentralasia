const fs = require('fs');

let code = fs.readFileSync('scratch/Code.gs', 'utf8');

const correctLogicKeys = `    "logic": {
      "logic_1": {
        "ans": JSON.stringify({ "Белов": "Чёрная рубашка", "Серов": "Белая рубашка", "Чернов": "Серая рубашка" }),
        "pts": 1
      },
      "logic_2": {
        "ans": JSON.stringify({ "Ящик 1 (надпись «крупа»)": "Сахар", "Ящик 2 (надпись «вермишель»)": "Крупа", "Ящик 3 (надпись «крупа или сахар»)": "Вермишель" }),
        "pts": 1
      },
      "logic_3": {
        "ans": "",
        "pts": 1
      },
      "logic_4": {
        "ans": JSON.stringify({ "Олег": "Скрипач", "Коля": "Пианист", "Ваня": "Певец" }),
        "pts": 1
      },
      "logic_5": {
        "ans": "Уменьшилась в 2 раза",
        "pts": 1
      },
      "logic_6": {
        "ans": "60",
        "pts": 1
      },
      "logic_7": {
        "ans": "8",
        "pts": 1
      },
      "logic_8": {
        "ans": "240",
        "pts": 1
      }
    }`;

// We need to replace all instances of "logic": { ... } within the grades "7", "8", "9", "10", "11"
// The block ends right before the next grade or at the end of the keys object.
// A simpler way is to use a regex to match "logic": { ... } up to the next outer brace.
// But regex might fail if there are nested braces.
// Let's just find "logic": { and match braces manually.

let result = "";
let i = 0;
while (i < code.length) {
  let idx = code.indexOf('"logic": {', i);
  if (idx === -1) {
    result += code.substring(i);
    break;
  }
  result += code.substring(i, idx);
  
  // Find matching brace for the block
  let braceCount = 0;
  let j = idx + '"logic": {'.length - 1; // j points to '{'
  let started = false;
  while (j < code.length) {
    if (code[j] === '{') {
      braceCount++;
      started = true;
    } else if (code[j] === '}') {
      braceCount--;
    }
    if (started && braceCount === 0) {
      break;
    }
    j++;
  }
  
  // Replace the old logic block with correctLogicKeys
  result += correctLogicKeys;
  i = j + 1; // skip past the closing brace
}

fs.writeFileSync('scratch/Code.gs', result);
console.log("Updated logic keys for all grades in Code.gs!");
