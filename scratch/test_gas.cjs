const https = require('https');

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzQn-C_L8s3CqO9ZfS8vM2T8mF2W5q0h7E_1g5D9M7D4R4kK8s-3j9Y7P1J4Z4M8Q4Z/exec";
// Wait, I need the actual script URL from server.ts
const fs = require('fs');
const serverTs = fs.readFileSync('server.ts', 'utf8');
const match = serverTs.match(/const SCRIPT_URL = "(.*?)";/);
if (!match) {
  console.error("Could not find SCRIPT_URL");
  process.exit(1);
}
const scriptUrl = match[1];

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

const req = https.request(scriptUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
    // follow redirect
    https.request(res.headers.location, { method: 'GET' }, (redirectRes) => {
      let data = '';
      redirectRes.on('data', chunk => data += chunk);
      redirectRes.on('end', () => console.log('Redirect Response:', data));
    }).end();
  } else {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Response:', data));
  }
});

req.on('error', (e) => console.error(e));
req.write(JSON.stringify(payload));
req.end();
