const fs = require('fs');
const code = fs.readFileSync('scratch/Code_final.gs', 'utf8');

// I want to see exactly what getCrmByShortId does if crmSheet is missing or something
const match = code.match(/function submitTest[\s\S]*?(?=function )/);
console.log(match ? "Found submitTest" : "Not found submitTest");

