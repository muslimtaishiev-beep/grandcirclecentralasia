const fs = require('fs');
let code = fs.readFileSync('scratch/Code.js', 'utf8');
code = code.replace(
  'row: i + 1,',
  'row: i + 1,\n        shortId: shortId,'
);
fs.writeFileSync('scratch/Code.js', code);
