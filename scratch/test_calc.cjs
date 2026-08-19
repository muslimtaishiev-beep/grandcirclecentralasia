const fs = require('fs');

let code = fs.readFileSync('scratch/Code_Fixed.gs', 'utf8');

const script = `
${code}
module.exports = { calculateScores, ANSWER_KEYS };
`;

fs.writeFileSync('scratch/test_calc_runner.cjs', script);
