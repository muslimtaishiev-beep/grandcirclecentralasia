const fs = require('fs');
const content = fs.readFileSync('src/data/testsData.ts', 'utf8');

// I need to extract Grade 9 and 10 Russian to see what is currently there.
const g9Match = content.match(/9:\s*\{\s*russian:\s*\[([\s\S]*?)\]\s*,\s*math:/);
if (g9Match) console.log("GRADE 9 RUSSIAN:", g9Match[1]);

const g10Match = content.match(/10:\s*\{\s*russian:\s*\[([\s\S]*?)\]\s*,\s*math:/);
if (g10Match) console.log("GRADE 10 RUSSIAN:", g10Match[1]);
