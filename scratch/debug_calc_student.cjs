const fs = require('fs');
const code = fs.readFileSync('scratch/Code_final.gs', 'utf8');

const keysMatch = code.match(/const ANSWER_KEYS = {([\s\S]*?)\n};\n/);
const calcMatch = code.match(/function calculateScores\([\s\S]*?\n\}/);
const normMatch = code.match(/function normalizeString\([\s\S]*?\n\}/);

const script = `
const ANSWER_KEYS = {${keysMatch[1]}\n};
${normMatch[0]}
${calcMatch[0]}

const grade = "9";
const answers = {"russian_1":"Быстро бежать","russian_2":"Вставная конструкция","russian_3":"Иду по лесной тропинке.","russian_4":"ученика","ru_5_new":"{\\"input1\\":\\"Н\\",\\"input2\\":\\"НН\\"}","russian_6":"Туристы утомленные долгим путем отдыхали.","ru_7_new":"[\\"5\\"]","russian_8":"(не)навидящий","russian_9":"(не) заглядывая","russian_10":"Прилетевшая птица села на ветку.","russian_11":"Солнце светит ярко.","russian_12":"Простое глагольное.","ru_13_new":"Двусоставное предложение","ru_14_new":"3) Вторая часть указывает на следствие.","ma_1_9":"6x/(x - y)","ma_2_9":"6 и 7","ma_3_9":"0,8","ma_4_9":"√0,4 = 0,2","ma_5_9":"-9 и 2","ma_6_9":"y = 4/x","ma_7_9":"√24 см","ma_8_9":"10","ma_9_9":"60 см^2","ma_10_9":"40/x + 40/(x-10) = 20","logic_1":"{\\"Белов\\":\\"Чёрная рубашка\\",\\"Серов\\":\\"Белая рубашка\\",\\"Чернов\\":\\"Серая рубашка\\"}","logic_2":"{\\"Ящик 1 (надпись «крупа»)\\":\\"Сахар\\",\\"Ящик 2 (надпись «вермишель»)\\":\\"Крупа\\",\\"Ящик 3 (надпись «крупа или сахар»)\\":\\"Вермишель\\"}","logic_3":"[\\"митя\\",\\"толя\\",\\"сеня\\",\\"костя\\",\\"юра\\"]","logic_4":"{\\"Олег\\":\\"Певец\\",\\"Коля\\":\\"Скрипач\\",\\"Ваня\\":\\"Пианист\\"}","logic_5":"Уменьшилась на 1%","logic_6":"125","logic_7":"12","logic_8":"46"};

const scores = calculateScores(grade, answers);
console.log("SCORES:", scores);

// Let's debug which ones matched
let ruMatch = {};
Object.keys(ANSWER_KEYS["9"].russian).forEach(qId => {
  const normUser = normalizeString(String(answers[qId] || ""));
  const normKey = normalizeString(ANSWER_KEYS["9"].russian[qId].ans);
  ruMatch[qId] = { user: normUser, key: normKey, matched: normUser === normKey };
});
console.log("RU MATCHES:", ruMatch);
`;

fs.writeFileSync('scratch/run_calc_student.cjs', script);
