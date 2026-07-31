const fs = require('fs');

let code = fs.readFileSync('scratch/Code.gs', 'utf8');

// Replace Russian 8, 9, 10
code = code.replace(
  /"ru_8_new":\s*{\s*ans:\s*"НАВЕРХ ЗАЧАСТУЮ",\s*pts:\s*1\s*}/,
  '"ru_8_new": { ans: "3) Посетитель кафе, зевая, заказал на обед рыбу жаренную в тесте.", pts: 1 }'
);
code = code.replace(
  /"ru_9":\s*{\s*ans:\s*JSON\.stringify\(\["2",\s*"3"\]\),\s*pts:\s*1\s*}/,
  '"ru_9": { ans: JSON.stringify(["1", "5"]), pts: 1 }'
);
code = code.replace(
  /"ru_10":\s*{\s*ans:\s*JSON\.stringify\(\["1",\s*"3",\s*"4"\]\),\s*pts:\s*1\s*}/,
  '"ru_10": { ans: JSON.stringify(["4", "12"]), pts: 1 }'
);

// Replace Math 3, 5, 7, 8, 10
code = code.replace(
  /"math_3":\s*{\s*"ans":\s*"6а2\(3а\+1\)",\s*"pts":\s*1\s*}/,
  '"math_3": {\n        "ans": "6а²(3а+1)",\n        "pts": 1\n      }'
);
code = code.replace(
  /"math_5":\s*{\s*"ans":\s*"0,5",\s*"pts":\s*1\s*}/,
  '"math_5": {\n        "ans": "-0,5",\n        "pts": 1\n      }'
);
code = code.replace(
  /"math_7":\s*{\s*"ans":\s*"4с2\+25",\s*"pts":\s*1\s*}/,
  '"math_7": {\n        "ans": "4с²+25",\n        "pts": 1\n      }'
);
code = code.replace(
  /"math_8":\s*{\s*"ans":\s*"1",\s*"pts":\s*1\s*}/,
  '"math_8": {\n        "ans": "-1",\n        "pts": 1\n      }'
);
code = code.replace(
  /"math_10":\s*{\s*"ans":\s*"t2 - 14t \+ 65",\s*"pts":\s*1\s*}/,
  '"math_10": {\n        "ans": "t² - 14t + 65",\n        "pts": 1\n      }'
);

fs.writeFileSync('scratch/Code.gs', code);
console.log("Fixed 8th grade keys!");
