const https = require('https');

const scriptUrl = "https://script.google.com/macros/s/AKfycbymI1U53npCYIscbcWG-0Cflkop2u7KocPvXY_yUSjJlDscQ8FkoYDXOTh2uNlpQHPr/exec";

const payload = {
  action: "submitTest",
  testId: "TEST_999",
  shortId: "TEST_999",
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
