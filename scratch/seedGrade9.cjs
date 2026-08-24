const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let serviceAccount;
const keyPath = path.join(__dirname, '../serviceAccountKey.json');

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else if (fs.existsSync(keyPath)) {
  serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
} else {
  console.error("No service account key found");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const TENANT_ID = "org_future_leaders";

const ruQuestions = [
  {
    id: "ru_9_q1",
    type: "multiple_choice",
    points: 1,
    text: "Задание №1. Найдите словосочетание со связью примыкание:",
    options: ["1) Деревянный стол", "2) Быстро бежать", "3) Читать книгу", "4) Встреча с другом"]
  },
  {
    id: "ru_9_q2",
    type: "multiple_choice",
    points: 1,
    text: "Задание №2. Объясни постановку скобок в предложении: «В жаркое летнее утро (это было в исходе июля) разбудили нас ранее обыкновенного.»",
    options: ["1) Причастный оборот", "2) Вставная конструкция", "3) Вводная конструкция"]
  },
  {
    id: "ru_9_q3",
    type: "multiple_choice",
    points: 1,
    text: "Задание №3. Найдите определенно-личное предложение:",
    options: ["1) Мне не спится.", "2) Иду по лесной тропинке.", "3) В дверь стучат."]
  },
  {
    id: "ru_9_q4",
    type: "multiple_choice",
    points: 1,
    text: "Задание №4. Укажите подлежащее в предложении: «Три ученика опоздали на урок».",
    options: ["1) три", "2) урок", "3) три ученика"]
  },
  {
    id: "ru_9_q5",
    type: "inline_inputs",
    points: 1,
    text: "Задание №5. Вставьте пропущенные буквы (н или нн):",
    inlineSegments: [
      { type: "text", text: "1) Неслыха" },
      { type: "input", id: "input1" },
      { type: "text", text: "ая дерзость\n2) Задача реше" },
      { type: "input", id: "input2" },
      { type: "text", text: "а." }
    ]
  },
  {
    id: "ru_9_q6",
    type: "multiple_choice",
    points: 1,
    text: "Задание №6. Найдите предложение с причастным оборотом, который не обособляется (знаки не расставлены):",
    options: ["1) Утомленные долгим путем туристы отдыхали.", "2) Туристы утомленные долгим путем отдыхали"]
  },
  {
    id: "ru_9_q7",
    type: "clickable_text",
    points: 1,
    text: "Задание №7. Расставьте знаки препинания (кликните в места, где нужны запятые):",
    clickableSegments: [
      { text: "Ветер" }, { text: " [,] ", id: "1", isTarget: true },
      { text: "дующий" }, { text: " [,] ", id: "2", isTarget: false },
      { text: "с" }, { text: " [,] ", id: "3", isTarget: false },
      { text: "моря" }, { text: " [,] ", id: "4", isTarget: true },
      { text: "принес" }, { text: " [,] ", id: "5", isTarget: false },
      { text: "прохладу." }
    ]
  },
  {
    id: "ru_9_q8",
    type: "multiple_choice",
    points: 1,
    text: "Задание №8. НЕ пишется раздельно:",
    options: ["1) (не) навидящий ложь", "2) (не) смолкающие разговоры", "3) (не) закрыв дверь", "4) (не) греющее солнце"]
  },
  {
    id: "ru_9_q9",
    type: "multiple_choice",
    points: 1,
    text: "Задание №9. НЕ пишется слитно:",
    options: ["1) Вовсе (не) освещенное окно", "2) (не) навидевший", "3) (не) закончив", "4) (не) покрытая снегом"]
  },
  {
    id: "ru_9_q10",
    type: "multiple_choice",
    points: 1,
    text: "Задание №10. Выберите предложение с деепричастным оборотом (знаки не расставлены):",
    options: ["1) Он сидел молча.", "2) Закончив работу я пошел гулять.", "3) Прилетевшая птица села на ветку."]
  },
  {
    id: "ru_9_q11",
    type: "multiple_choice",
    points: 1,
    text: "Задание №11. Найдите предложение с вводным словом (знаки не расставлены):",
    options: ["1) Кажется дождь начинается.", "2) Он кажется мне знакомым.", "3) Он кажется усталым"]
  },
  {
    id: "ru_9_q12",
    type: "multiple_choice",
    points: 1,
    text: "Задание №12. Определите вид сказуемого: «Он хотел научится танцевать».",
    options: ["1) Простое глагольное.", "2) Составное именное.", "3) Составное глагольное"]
  },
  {
    id: "ru_9_q13",
    type: "multiple_choice",
    points: 1,
    text: "Задание №13. Определите тип первой части сложного предложения:\n«На улице похолодало, и мы вернулись домой.»",
    options: ["1) Безличное предложение", "2) Определённо-личное предложение", "3) Неопределённо-личное предложение", "4) Двусоставное предложение"]
  },
  {
    id: "ru_9_q14",
    type: "multiple_choice",
    points: 1,
    text: "Задание №14. Пунктуация в сложном предложении. Объясните постановку знаков:\n«Я понимал: если не потороплюсь, то опоздаю, и все пропадет.»",
    options: [
      "1) Двоеточие между частями БСП, запятая на стыке союзов не ставится из-за ТО, запятые обособляют придаточное",
      "2) Запятые при однородных членах предложения",
      "3) Двоеточие при прямой речи"
    ]
  }
];

const maQuestions = [
  { id: "ma_9_q1", type: "multiple_choice", points: 1, text: "1. Выполните деление:", options: ["А) 4/9", "Б) 9/4", "В) 2/3", "Г) 3/2"] },
  { id: "ma_9_q2", type: "multiple_choice", points: 1, text: "2. Подберите два последовательных целых числа, между которыми заключено число √45:", options: ["А) 36 и 38", "Б) 6 и 7", "В) 7 и 8", "Г) нет таких значений"] },
  { id: "ma_9_q3", type: "multiple_choice", points: 1, text: "3. Найдите значение выражения - 7 ˑ (-2,4):", options: ["А) 17", "Б) 0,8", "В) 16,8", "Г) 4"] },
  { id: "ma_9_q4", type: "multiple_choice", points: 1, text: "4. Выберите неверное равенство:", options: ["А) √16 = 4", "Б) √0,04 = 0,2", "В) 7 - √25 = 2", "Г) √(-9)² = -9"] },
  { id: "ma_9_q5", type: "multiple_choice", points: 1, text: "5. Найти корни уравнения х² + 7х – 18 = 0:", options: ["А) – 2 и 9", "Б) – 9 и 2", "В) корней нет", "Г) 2 и 9"] },
  { id: "ma_9_q6", type: "multiple_choice", points: 1, text: "6. Графиком какой из функций является гипербола?", options: ["А) у = 4/х", "Б) у = -4х", "В) у = х²/4", "Г) у = 4х²"] },
  { id: "ma_9_q7", type: "multiple_choice", points: 1, text: "7. В прямоугольном треугольнике АВС угол В равен 90°, АВ = 5 см, АС = 7 см. Найдите ВС.", options: ["А) 24 см", "Б) 12 см", "В) 2 см", "Г) √24 см"] },
  { id: "ma_9_q8", type: "multiple_choice", points: 1, text: "8. Хорды АВ и СD пересекаются в точке Е. Найдите ЕD, если АЕ = 5, ВЕ = 2, СЕ = ЕD.", options: ["А) 10", "Б) √10", "В) 7", "Г) 2,5"] },
  { id: "ma_9_q9", type: "multiple_choice", points: 1, text: "9. Сумма двух противоположных сторон описанного четырехугольника равна 12 см, а радиус вписанной в него окружности равен 5 см. Найдите площадь четырехугольника.", options: ["А) 120 см²", "Б) 60 см²", "В) 30 см²", "Г) 17 см"] },
  { id: "ma_9_q10", type: "multiple_choice", points: 1, text: "10. (*) Мотоциклист проехал 40 км от дома до реки. Возвращаясь обратно со скоростью на 10 км/ч меньшей первоначальной, он затратил на этот путь на 20 мин больше. Составьте уравнение:", options: ["А) 40/x + 40/(x-10) = 20", "Б) 40/(x-10) - 40/x = 1/3", "В) 40/x + 40/(x-10) = 1/3", "Г) х + 3(х - 10) = 40"] }
];

const russianKeys = {
  "ru_9_q1": { ans: "2", pts: 1, topic: "Словосочетание и связь примыкание" },
  "ru_9_q2": { ans: "2", pts: 1, topic: "Вставные конструкции" },
  "ru_9_q3": { ans: "2", pts: 1, topic: "Односоставные предложения" },
  "ru_9_q4": { ans: "3", pts: 1, topic: "Подлежащее и синтаксис" },
  "ru_9_q5": { ans: "нн, н", pts: 1, topic: "Орфография: Н и НН" },
  "ru_9_q6": { ans: "1", pts: 1, topic: "Причастный оборот" },
  "ru_9_q7": { ans: "1, 4", pts: 1, topic: "Обособление причастного оборота" },
  "ru_9_q8": { ans: "3", pts: 1, topic: "НЕ с деепричастиями" },
  "ru_9_q9": { ans: "2", pts: 1, topic: "НЕ с глаголами/причастиями" },
  "ru_9_q10": { ans: "2", pts: 1, topic: "Деепричастный оборот" },
  "ru_9_q11": { ans: "1", pts: 1, topic: "Вводные слова" },
  "ru_9_q12": { ans: "3", pts: 1, topic: "Составное глагольное сказуемое" },
  "ru_9_q13": { ans: "1", pts: 1, topic: "Безличные предложения" },
  "ru_9_q14": { ans: "1", pts: 1, topic: "Пунктуация в сложном предложении" }
};

const mathKeys = {
  "ma_9_q1": { ans: "А", pts: 1, topic: "Деление дробей" },
  "ma_9_q2": { ans: "Б", pts: 1, topic: "Иррациональные числа" },
  "ma_9_q3": { ans: "В", pts: 1, topic: "Арифметические вычисления" },
  "ma_9_q4": { ans: "Г", pts: 1, topic: "Свойства квадратного корня" },
  "ma_9_q5": { ans: "Б", pts: 1, topic: "Теорема Виета и квадратные уравнения" },
  "ma_9_q6": { ans: "А", pts: 1, topic: "Графики функций и гипербола" },
  "ma_9_q7": { ans: "Г", pts: 1, topic: "Теорема Пифагора" },
  "ma_9_q8": { ans: "Б", pts: 1, topic: "Пересекающиеся хорды окружности" },
  "ma_9_q9": { ans: "Б", pts: 1, topic: "Площадь описанного четырехугольника" },
  "ma_9_q10": { ans: "Б", pts: 1, topic: "Составление уравнений к текстовым задачам" }
};

async function seed() {
  console.log("🚀 Starting seeding of Grade 9 questions and answer keys into Firestore...");

  const testData = {
    id: "test_grade_9",
    tenantId: TENANT_ID,
    grade: 9,
    title: "Вступительный тест за 9 класс",
    description: "Официальный академический тест за 9 класс",
    questions: {
      russian: ruQuestions,
      math: maQuestions,
      logic: [],
      english: []
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const answerKeyData = {
    id: "test_grade_9",
    tenantId: TENANT_ID,
    grade: 9,
    keys: {
      russian: russianKeys,
      math: mathKeys,
      logic: {},
      english: {}
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const batch = db.batch();

  batch.set(db.collection("tests").doc("test_grade_9"), testData, { merge: true });
  batch.set(db.collection("tests").doc(`test_grade_9_${TENANT_ID}`), testData, { merge: true });
  batch.set(db.collection("tests").doc("9"), testData, { merge: true });

  batch.set(db.collection("test_answer_keys").doc("test_grade_9"), answerKeyData, { merge: true });
  batch.set(db.collection("test_answer_keys").doc(`test_grade_9_${TENANT_ID}`), answerKeyData, { merge: true });
  batch.set(db.collection("test_answer_keys").doc("9"), answerKeyData, { merge: true });

  await batch.commit();
  console.log("✅ Successfully seeded Grade 9 tests & answer keys into Firestore!");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seeding error:", err);
  process.exit(1);
});
