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
    id: "ru_10_q1",
    type: "multiple_choice",
    points: 1,
    text: "Задание №1. Укажите слово, в котором НЕВЕРНО выделен ударный гласный звук:",
    options: ["1) цепОчка", "2) газопрОвод", "3) прозорлИва", "4) донЕльзя"]
  },
  {
    id: "ru_10_q2",
    type: "multiple_choice",
    points: 1,
    text: "Задание №2. Укажите предложение с лексической ошибкой (неверным употреблением паронима):",
    options: [
      "1) Летом в ЛЕСИСТОЙ чащобе появляются полчища комаров.",
      "2) Статья оказалась полезной и ИНФОРМАТИВНОЙ.",
      "3) В Российской империи высшим судебным органом был ВЕРХОВНЫЙ уголовный суд.",
      "4) Буду вам крайне, очень, бесконечно ПРИЗНАТЕЛЬНА."
    ]
  },
  {
    id: "ru_10_q3",
    type: "multiple_choice",
    points: 1,
    text: "Задание №3. Укажите предложение, в котором нужно поставить одну запятую:",
    options: [
      "1) В природе ни лист ни соломинка ни дерево не повторяются.",
      "2) Туманы здесь бывают если не каждый день то через день непременно.",
      "3) Мы увидели заросли земляники и лесной малины и решили наполнить наши корзинки.",
      "4) Молчали берег и море и лес."
    ]
  },
  {
    id: "ru_10_q4",
    type: "multiple_choice",
    points: 1,
    text: "Задание №4. Укажите слово, в котором пропущена безударная проверяемая гласная корня:",
    options: ["1) оз..рить", "2) м..литва", "3) заг..рать", "4) соч..тание", "5) к…ллекция"]
  },
  {
    id: "ru_10_q5",
    type: "multiple_choice",
    points: 1,
    text: "Задание №5. Укажите ряд, в котором в обоих словах пропущена одна и та же буква:",
    options: [
      "1) бе..защитный, во…произведение;",
      "2) пред..явить, с..езд;",
      "3) пр..близить, пр..старелый;",
      "4) н..мерение, вз..браться;",
      "5) и..подтишка, ра..жалобить."
    ]
  },
  {
    id: "ru_10_q6",
    type: "multiple_choice",
    points: 1,
    text: "Задание №6. Укажите слово, в котором на месте пропуска пишется буква Е:",
    options: [
      "1) забол…вать",
      "2) выпяч…вать",
      "3) достра..вать",
      "4) привередл..вый"
    ]
  },
  {
    id: "ru_10_q7",
    type: "multiple_choice",
    points: 1,
    text: "Задание №7. Определите предложение, в котором НЕ со словом пишется СЛИТНО:",
    options: [
      "1) Ирина Андреевна говорила (не)громко, но очень выразительно.",
      "2) Я был (не)готов к такому повороту событий и в растерянности остановился.",
      "3) (Не)умолкающие до глубокой ночи звуки музыки напоминали о близости парка аттракционов.",
      "4) Конечно, это был далеко (не)лучший поступок.",
      "5) (Не) полученная вовремя телеграмма заставила нас изменить планы."
    ]
  },
  {
    id: "ru_10_q8",
    type: "multiple_choice",
    points: 1,
    text: "Задание №8. В каком предложении оба выделенных слова пишутся СЛИТНО:",
    options: [
      "1) Трудно представить, ЧТО(БЫ) случилось, если бы не помощь родителей, а ТАК(ЖЕ) поддержка друзей.",
      "2) (В)ЗАКЛЮЧЕНИЕ оратор повысил голос (И)ТАК торжественно закончил речь, что зал взорвался аплодисментами.",
      "3) Матрёна Филимоновна (ТОТ) ЧАС сошлась с приказчицей и в ПЕРВЫЙ(ЖЕ) день пила с нею и с приказчиком чай под акациями и обсуждала дела.",
      "4) И молодые, и старые работали КАК(БЫ) (НА) ПЕРЕГОНКИ.",
      "5) Мудрый Кутузов, свободный от страсти, тщеславия, а ТАК(ЖЕ) честолюбия, легко прозревал «высшие законы» и (ПО) ЭТОМУ стал представителем народной освободительной войны."
    ]
  },
  {
    id: "ru_10_q9",
    type: "multiple_choice",
    points: 1,
    text: "Задание №9. Укажите все цифры, на месте которых пишется НН:\n«За око(1)ым стеклом жила своей утре(2)ей жизнью обыкнове(3)ая городская асфальтирова(4)ая улица, по которой мчались переполне(5)ые маршрутные такси и гружё(6)ые самосвалы.»",
    options: ["1) 1, 2, 3, 4, 5", "2) 1, 2, 3", "3) 1, 3, 5, 6", "4) Все цифры"]
  },
  {
    id: "ru_10_q10",
    type: "multiple_choice",
    points: 1,
    text: "Задание №10. Укажите все цифры, на месте которых в предложении должны стоять запятые:\n«Привлечённые запахом (1) цветущей в парке (2) акации (3) мы остановились (4) наслаждаясь ароматом.»",
    options: ["1) 3, 4", "2) 1, 3", "3) 2, 4", "4) 1, 2, 3, 4"]
  }
];

const maQuestions = [
  { id: "ma_10_q1", type: "multiple_choice", points: 1, text: "1. Найдите значение выражения: (2 ∙ 10⁻²)² ∙ (12 ∙ 10³)", options: ["1) 0,48", "2) 4,8", "3) 48", "4) 480"] },
  { id: "ma_10_q2", type: "multiple_choice", points: 1, text: "2. Найдите значение выражения: (√3 ∙ √15) / √5", options: ["1) 3", "2) √3", "3) 9", "4) 5"] },
  { id: "ma_10_q3", type: "multiple_choice", points: 1, text: "3. Решите уравнение: x² - 9 = 0", options: ["1) 3 и -3", "2) 3", "3) -3", "4) 9"] },
  { id: "ma_10_q4", type: "multiple_choice", points: 1, text: "4. Из 2,5 кг ржаной муки получается 3,5 кг хлеба. Сколько хлеба можно испечь из 70 т ржаной муки?", options: ["1) 98т", "2) 50 т", "3) 108т", "4) 86т"] },
  { id: "ma_10_q5", type: "multiple_choice", points: 1, text: "5. Найдите значение выражения: -3,4 + 4,74", options: ["1) -7,4", "2) 1,34", "3) – 1,34", "4) 12,04"] },
  { id: "ma_10_q6", type: "multiple_choice", points: 1, text: "6. Вычислите: (2/3)³", options: ["1) 8/27", "2) 4/9", "3) 6/9", "4) 2/9"] },
  { id: "ma_10_q7", type: "multiple_choice", points: 1, text: "7. Найдите наибольшее из чисел:", options: ["1) 0,5", "2) 0,25", "3) 0,49", "4) 0,1"] },
  { id: "ma_10_q8", type: "multiple_choice", points: 1, text: "8. Упростите выражение: (a - b)² + 2ab", options: ["1) a² + b²", "2) a² - b²", "3) a² + 4ab", "4) b²"] },
  { id: "ma_10_q9", type: "multiple_choice", points: 1, text: "9. Упростите выражение: (x² - y²) / (x + y)", options: ["1) x - y", "2) x + y", "3) x", "4) y"] },
  { id: "ma_10_q10", type: "multiple_choice", points: 1, text: "10. Упростите выражение: 2⁴ ∙ 2³ / 2⁵", options: ["1) 4", "2) 2", "3) 8", "4) 1"] },
  { id: "ma_10_q11", type: "multiple_choice", points: 1, text: "11. Последовательность aₙ задана следующим образом: a₁ = 3, aₙ₊₁ = aₙ - 5. Чему равно a₃?", options: ["1) -10", "2) 3", "3) -7", "4) -3"] },
  { id: "ma_10_q12", type: "multiple_choice", points: 1, text: "12. В каком промежутке находится корень уравнения 2x - 7 = 3?", options: ["1) (4; 6)", "2) (0; 3)", "3) (6; 10)", "4) (-5; 0)"] },
  { id: "ma_10_q13", type: "multiple_choice", points: 1, text: "13. Найдите сумму корней уравнения: (x - 3)(x + 1,5) = 0", options: ["1) -1,5", "2) 3", "3) 1,5", "4) -3"] },
  { id: "ma_10_q14", type: "multiple_choice", points: 1, text: "14. Сколько корней имеет уравнение: x² + 5 = 0?", options: ["1) 2", "2) ни одного", "3) 4", "4) 1"] },
  { id: "ma_10_q15", type: "multiple_choice", points: 1, text: "15. Найдите решение (x₀, y₀) системы уравнений x + y = 2 и x - y = 4 и вычислите значение произведения x₀ ∙ y₀:", options: ["1) -1", "2) 0", "3) -2", "4) -3"] },
  { id: "ma_10_q16", type: "multiple_choice", points: 1, text: "16. Решите неравенство 2x - 8 ≤ 0. В ответе укажите наибольшее число:", options: ["1) 0", "2) -6", "3) -5", "4) 4"] },
  { id: "ma_10_q17", type: "multiple_choice", points: 1, text: "17. Решите систему неравенств x > 2 и x < 5:", options: ["1) (2; 5)", "2) [2; 5]", "3) (-∞; 2)", "4) нет решений"] },
  { id: "ma_10_q18", type: "multiple_choice", points: 1, text: "18. Найдите количество целых решений неравенства x² < 9:", options: ["1) 3", "2) 6", "3) 5", "4) 4"] },
  { id: "ma_10_q19", type: "multiple_choice", points: 1, text: "19. Найдите область определения функции y = √(x - 4):", options: ["1) [4; +∞)", "2) (-∞; 4]", "3) (0; +∞)", "4) (-∞; +∞)"] },
  { 
    id: "ma_10_q20", 
    type: "multiple_choice", 
    points: 1, 
    text: "20. График какой функции изображен на рисунке?", 
    html: "<div><p class='font-bold mb-3'>20. График какой функции изображен на рисунке?</p><img src='/math10_20.png' alt='График функции №20' class='max-w-md my-4 rounded-xl border shadow-sm'/></div>",
    options: ["1) y = x²", "2) y = 2x", "3) y = -x + 3", "4) y = 4/x"] 
  },
  { 
    id: "ma_10_q21", 
    type: "multiple_choice", 
    points: 1, 
    text: "21. На рисунке изображена зависимость температуры вещества Т от времени t. Укажите, в течение какого времени температура вещества была постоянна.", 
    html: "<div><p class='font-bold mb-3'>21. На рисунке изображена зависимость температуры вещества Т от времени t. Укажите, в течение какого времени температура вещества была постоянна.</p><img src='/math10_21.png' alt='График зависимости №21' class='max-w-md my-4 rounded-xl border shadow-sm'/></div>",
    options: ["1) 2", "2) 3", "3) 1", "4) 4"] 
  }
];

const russianKeys = {
  "ru_10_q1": { ans: "2", pts: 1, topic: "Орфоэпия и ударение" },
  "ru_10_q2": { ans: "1", pts: 1, topic: "Паронимы и лексические ошибки" },
  "ru_10_q3": { ans: "2", pts: 1, topic: "Пунктуация в предложениях" },
  "ru_10_q4": { ans: "2", pts: 1, topic: "Безударные проверяемые гласные" },
  "ru_10_q5": { ans: "2", pts: 1, topic: "Правописание приставок и Ъ/Ь" },
  "ru_10_q6": { ans: "1", pts: 1, topic: "Суффиксы глаголов" },
  "ru_10_q7": { ans: "1", pts: 1, topic: "Слитное написание НЕ" },
  "ru_10_q8": { ans: "5", pts: 1, topic: "Слитное написание союзов и наречий" },
  "ru_10_q9": { ans: "1", pts: 1, topic: "Правописание НН в причастиях и прилагательных" },
  "ru_10_q10": { ans: "1", pts: 1, topic: "Обособление причастных и деепричастных оборотов" }
};

const mathKeys = {
  "ma_10_q1": { ans: "2", pts: 1, topic: "Степени и выражения" }, // Corrected to option 2 (4.8)
  "ma_10_q2": { ans: "1", pts: 1, topic: "Квадратные корни" },
  "ma_10_q3": { ans: "1", pts: 1, topic: "Квадратные уравнения" },
  "ma_10_q4": { ans: "1", pts: 1, topic: "Пропорции и задачи" },
  "ma_10_q5": { ans: "2", pts: 1, topic: "Десятичные дроби" },
  "ma_10_q6": { ans: "1", pts: 1, topic: "Возведение в степень" },
  "ma_10_q7": { ans: "1", pts: 1, topic: "Сравнение чисел" },
  "ma_10_q8": { ans: "1", pts: 1, topic: "Формулы сокращенного умножения" },
  "ma_10_q9": { ans: "1", pts: 1, topic: "Сокращение дробей" },
  "ma_10_q10": { ans: "1", pts: 1, topic: "Свойства степеней" },
  "ma_10_q11": { ans: "3", pts: 1, topic: "Числовые последовательности" },
  "ma_10_q12": { ans: "1", pts: 1, topic: "Линейные уравнения" },
  "ma_10_q13": { ans: "3", pts: 1, topic: "Корни уравнений" },
  "ma_10_q14": { ans: "2", pts: 1, topic: "Количество корней уравнения" },
  "ma_10_q15": { ans: "4", pts: 1, topic: "Системы уравнений" },
  "ma_10_q16": { ans: "4", pts: 1, topic: "Линейные неравенства" },
  "ma_10_q17": { ans: "1", pts: 1, topic: "Системы неравенств" },
  "ma_10_q18": { ans: "3", pts: 1, topic: "Квадратичные неравенства" },
  "ma_10_q19": { ans: "1", pts: 1, topic: "Область определения функции" },
  "ma_10_q20": { ans: "1", pts: 1, topic: "Графики функций" },
  "ma_10_q21": { ans: "2", pts: 1, topic: "Чтение графиков функций" }
};

async function seed() {
  console.log("🚀 Starting seeding of corrected Grade 10 questions & answer keys into Firestore...");

  const testData = {
    id: "test_grade_10",
    tenantId: TENANT_ID,
    grade: 10,
    title: "Вступительный тест за 10 класс",
    description: "Официальный академический тест за 10 класс",
    questions: {
      russian: ruQuestions,
      math: maQuestions
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const answerKeyData = {
    id: "test_grade_10",
    tenantId: TENANT_ID,
    grade: 10,
    keys: {
      russian: russianKeys,
      math: mathKeys
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const batch = db.batch();

  batch.set(db.collection("tests").doc("test_grade_10"), testData, { merge: true });
  batch.set(db.collection("tests").doc(`test_grade_10_${TENANT_ID}`), testData, { merge: true });
  batch.set(db.collection("tests").doc("10"), testData, { merge: true });

  batch.set(db.collection("test_answer_keys").doc("test_grade_10"), answerKeyData, { merge: true });
  batch.set(db.collection("test_answer_keys").doc(`test_grade_10_${TENANT_ID}`), answerKeyData, { merge: true });
  batch.set(db.collection("test_answer_keys").doc("10"), answerKeyData, { merge: true });

  await batch.commit();
  console.log("⚡ Successfully updated Grade 10 questions & answer keys in Firestore!");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seeding error:", err);
  process.exit(1);
});
