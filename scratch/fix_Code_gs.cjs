const fs = require('fs');

let code = fs.readFileSync('scratch/Code.gs', 'utf-8');

// The corrupted pattern is:
//     }\n        },\n        "logic": {
// Let's replace all occurrences of this with:
//     },\n        "logic": {

code = code.replace(/    \}\n        \},\n        "logic": \{/g, '    },\n        "logic": {');

// Also for other grades it might be:
code = code.replace(/    \}\n  \},\n        "logic": \{/g, '    },\n        "logic": {');

// Let's print out if it parsed
const keysMatch = code.match(/const ANSWER_KEYS = (\{[\s\S]*?^};\n)/m);
if (keysMatch) {
  try {
    eval('var a = ' + keysMatch[1]);
    console.log("Parse successful!");
    fs.writeFileSync('scratch/Code.gs', code, 'utf-8');
  } catch (e) {
    console.log("Still failed:", e.message);
  }
} else {
  console.log("Could not find ANSWER_KEYS");
}
