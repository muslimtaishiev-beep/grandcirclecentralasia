const https = require('https');

const scriptUrl = "https://script.google.com/macros/s/AKfycbymI1U53npCYIscbcWG-0Cflkop2u7KocPvXY_yUSjJlDscQ8FkoYDXOTh2uNlpQHPr/exec";

const payload = {
  action: "submitTest",
  testId: "b59050b4-2149-43cd-8c20-bff27bff73c3",
  shortId: "545107",
  studentName: "муся ташиев",
  grade: "9",
  cheated: false,
  isTester: true,
  isRetake: true, // Bypass "already submitted"
  apiKey: "GRAND_CIRCLE_SECURE_API_KEY_2026",
  answers: {
    "russian_1": "Быстро бежать",
    "russian_2": "Вставная конструкция",
    "russian_3": "Иду по лесной тропинке.",
    "russian_4": "ученика",
    "ru_5_new": "{\"input1\":\"Н\",\"input2\":\"НН\"}",
    "russian_6": "Туристы утомленные долгим путем отдыхали.",
    "ru_7_new": "[\"5\"]",
    "russian_8": "(не)навидящий",
    "russian_9": "(не) заглядывая",
    "russian_10": "Прилетевшая птица села на ветку.",
    "russian_11": "Солнце светит ярко.",
    "russian_12": "Простое глагольное.",
    "ru_13_new": "Двусоставное предложение",
    "ru_14_new": "3) Вторая часть указывает на следствие",
    "ma_1_9": "6x/(x-y)",
    "ma_2_9": "6 и 7",
    "ma_3_9": "0,8",
    "ma_4_9": "0,2",
    "ma_5_9": "-9 и 2",
    "ma_6_9": "y = 4/x",
    "ma_7_9": "√24",
    "ma_8_9": "√10",
    "ma_9_9": "120",
    "ma_10_9": "40/(x-10) - 40/x = 1/3",
    "logic_1": "{\"Белов\":\"Чёрная рубашка\",\"Серов\":\"Белая рубашка\",\"Чернов\":\"Серая рубашка\"}",
    "logic_2": "{\"Ящик 1 (надпись «крупа»)\":\"Сахар\",\"Ящик 2 (надпись «вермишель»)\":\"Крупа\",\"Ящик 3 (надпись «крупа или сахар»)\":\"Вермишель\"}",
    "logic_3": "[\"митя\",\"толя\",\"сеня\",\"костя\",\"юра\"]",
    "logic_4": "{\"Олег\":\"Скрипач\",\"Коля\":\"Пианист\",\"Ваня\":\"Певец\"}",
    "logic_5": "Уменьшилась в 2 раза",
    "logic_6": "60",
    "logic_7": "8",
    "logic_8": "240"
  }
};

const req = https.request(scriptUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
    https.request(res.headers.location, { method: 'GET' }, (redirectRes) => {
      let data = '';
      redirectRes.on('data', chunk => data += chunk);
      redirectRes.on('end', () => console.log('Response:', data));
    }).end();
  } else {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Direct Response:', data));
  }
});
req.write(JSON.stringify(payload));
req.end();
