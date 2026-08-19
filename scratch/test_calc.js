const fs = require('fs');

let code = fs.readFileSync('scratch/Code_Fixed.gs', 'utf8');

// We need to evaluate the code to get calculateScores and ANSWER_KEYS
const sandbox = {
  console: console,
  JSON: JSON,
  String: String,
  Number: Number,
  Array: Array,
  Object: Object
};

const script = `
${code}
module.exports = { calculateScores, ANSWER_KEYS };
`;

fs.writeFileSync('scratch/test_calc_runner.cjs', script);
