const fs = require('fs');

let code = fs.readFileSync('scratch/Code.js', 'utf8');
code = code.replace(
  'cheated: data[i][9] === "ДА"',
  'cheated: data[i][9] === "ДА",\n        diagnosticsRaw: (() => { try { return JSON.parse(data[i][14] || "{}"); } catch(e) { return {}; } })()'
);
fs.writeFileSync('scratch/Code.js', code);
