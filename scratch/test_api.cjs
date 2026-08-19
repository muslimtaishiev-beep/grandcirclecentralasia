const http = require('http');

const payload = {
  action: "submitTest",
  testId: "TEST_123",
  shortId: "TEST_123",
  studentName: "Тестовый Ученик",
  grade: "10",
  answers: {
    "russian_1": "газопровод",
    "ru_2_new": "1|лесной",
    "russian_3": "туманы здесь бывают если не каждый день то через день непременно.",
    "russian_4": "м..литва",
    "russian_5": "пред..явить, с..езд;",
    "russian_6": "забол…вать",
    "russian_7": "ирина андреевна говорила (не)громко, но очень выразительно.",
    "ru_8_new": "5|такжепоэтому",
    "russian_9": "[\"1\",\"2\",\"3\",\"4\",\"5\"]",
    "russian_10": "[\"3\",\"4\"]",
    "ma_1_10": "1/2",
    "logic_1": "13"
  },
  cheated: false,
  isRetake: true
};

const req = http.request({
  hostname: 'localhost',
  port: 3000, // assuming server.ts runs on 3000 or I can just hit the GAS URL directly
  path: '/api/gas',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
});

req.on('error', (e) => console.error(e));
req.write(JSON.stringify(payload));
req.end();
