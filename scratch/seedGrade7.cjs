const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
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
    id: "ru_7_q1",
    type: "multiple_choice",
    points: 1,
    text: "Задание №1. Какое слово соответствует схеме: приставка + корень + суффикс + суффикс + окончание?",
    options: ["1) Спутник", "2) Надумал", "3) Удивить", "4) Расстилается"]
  },
  {
    id: "ru_7_q2",
    type: "multiple_choice",
    points: 1,
    text: "Задание №2. Найдите верный ответ в определении грамматических признаков.",
    options: ["1) прочитать – глагол несовершенного вида", "2) море – нарицательное существительное", "3) глубока (река) – прилагательное в полной форме", "4) дышать – глагол первого спряжения"]
  },
  {
    id: "ru_7_q3",
    type: "multiple_choice",
    points: 1,
    text: "Задание №3. В каком ряду буквы пропущены только в словах с чередующимися гласными в корне?",
    options: ["1) р..сли, заст..лать, б..рюзовый", "2) зам..реть, прол..жили, проб..ваю", "3) заб..рать, р..сток, зам..рзать", "4) бл..стеть, зап..реть, р..стение"]
  },
  {
    id: "ru_7_q4",
    type: "multiple_choice",
    points: 1,
    text: "Задание №4. В каком случае дано неправильное объяснение выбора орфограммы?",
    options: ["1) ш..пот – в корне пишется Ё, т.к. можно проверить шепчет", "2) ц..ркач – в корне слова пишется буква И", "3) ..бежать – пишется приставка З, т.к. она находится перед звонкой Б.", "4) водор..сли – в корне с чередованием перед С пишется буква О"]
  },
  {
    id: "ru_7_q5",
    type: "multiple_choice",
    points: 1,
    text: "Задание №5. Найдите ошибку в характеристике предложения:\n«Лес зазеленеет, когда пригреет весеннее солнышко.»",
    options: ["1) повествовательное", "2) сложное", "3) бессоюзное", "4) грамматическая основа первого П. – лес зазеленеет; второго – пригреет солнышко"]
  },
  {
    id: "ru_7_q6",
    type: "multiple_choice",
    points: 1,
    text: "Задание №6. В каком предложении допущена пунктуационная ошибка?",
    options: ["1) В нашем лесу обитают разные звери, зайцы, лисы и даже волки.", "2) Уважаемые родители, собрание состоится в субботу в три часа.", "3) Она проснулась окончательно, когда её лица коснулся луч солнца.", "4) Дорожка выбежала на берег и пошла вдоль него."]
  },
  {
    id: "ru_7_q7",
    type: "multiple_choice",
    points: 1,
    text: "Задание №7. Укажите сложное предложение (знаки препинания не расставлены):",
    options: ["1) Исчезают последние клочки снега и появляется трава.", "2) Ещё зелёный стоит старый развесистый дуб и роняет жёлуди.", "3) Кружатся падают с берёз лёгкие жёлтые листья.", "4) В лесу водилось множество разных птиц иволги кукушки дятлы поползни"]
  },
  {
    id: "ru_7_q8",
    type: "multiple_choice",
    points: 1,
    text: "Задание №8. В каком слове ударение падает на второй слог?",
    options: ["1) Звонишь", "2) Алфавит", "3) Километр", "4) Документ"]
  },
  {
    id: "ru_7_q9",
    type: "multiple_choice",
    points: 1,
    text: "Задание №9. В каком слове не совпадает количество букв и звуков?",
    options: ["1) Щетка", "2) Яркий", "3) Семья"]
  }
];

const maQuestions = [
  { id: "ma_7_q1", type: "multiple_choice", points: 1, text: "1. Какое из следующих чисел самое большое?", options: ["1) 0,0052", "2) 0,0794", "3) 0,15", "4) 0,106"] },
  { id: "ma_7_q2", type: "multiple_choice", points: 1, text: "2. Нацело на 18 делится число:", options: ["1) 364", "2) 328", "3) 339", "4) 342"] },
  { id: "ma_7_q3", type: "multiple_choice", points: 1, text: "3. Сократите:", options: ["1) 1/2", "2) 2/3", "3) 3/4", "4) 4/5"] },
  { id: "ma_7_q4", type: "multiple_choice", points: 1, text: "4. Брусок длиной 5 м распилили на части по 5/8 м в каждой. Таких частей получилось:", options: ["1) 8", "2) 6", "3) 7", "4) 9"] },
  { id: "ma_7_q5", type: "multiple_choice", points: 1, text: "5. Длина прямоугольника равна 22 см, а ширина составляет 3/11 его длины. Найдите периметр прямоугольника.", options: ["1) 26 см", "2) 46 см", "3) 52 см", "4) 56 см"] },
  { id: "ma_7_q6", type: "multiple_choice", points: 1, text: "6. Какая из координатных точек расположена на координатной прямой левее других?", options: ["1) А (-7)", "2) В (10)", "3) С (-11)", "4) Д (4)"] },
  { id: "ma_7_q7", type: "multiple_choice", points: 1, text: "7. Решите уравнение: 2х = - 6,2", options: ["1) 6,2", "2) - 6,2", "3) - 3,1", "4) 3,1"] },
  { id: "ma_7_q8", type: "multiple_choice", points: 1, text: "8. Выполните сложение: - 6,4 + (- 12)", options: ["1) - 5,6", "2) – 18,4", "3) – 6,6", "4) 18,4"] },
  { id: "ma_7_q9", type: "multiple_choice", points: 1, text: "9. У какого из данных чисел наименьший модуль?", options: ["1) - 21,39", "2) – 21,4", "3) 21,305", "4) 25,5"] },
  { id: "ma_7_q10", type: "multiple_choice", points: 1, text: "10. Решите уравнение: х – 8,31 = - 5,76", options: ["1) 2,55", "2) – 13,07", "3) – 10,52", "4) 14,07"] },
  { id: "ma_7_q11", type: "multiple_choice", points: 1, text: "11. Выполните вычитание: 3 - 5", options: ["1) - 2", "2) - 1", "3) - 8", "4) 8"] },
  { id: "ma_7_q12", type: "multiple_choice", points: 1, text: "12. Округлите число 37,285 до десятых:", options: ["1) 37,3", "2) 37,2", "3) 37,29", "4) 37"] },
  { id: "ma_7_q13", type: "multiple_choice", points: 1, text: "13. Вычислите: -8 + 11 – 6 - 9", options: ["1) -10", "2) -11", "3) -12", "4) -13"] },
  { id: "ma_7_q14", type: "multiple_choice", points: 1, text: "14. В сберегательном банке денежный вклад за один год увеличивается на 5%. Если вкладчик положил 200 000 сом, то через год у него будет:", options: ["1) 10 000 сом.", "2) 20 000 сом.", "3) 210 000 сом.", "4) 202 000 сом."] },
  { id: "ma_7_q15", type: "multiple_choice", points: 1, text: "15. Найдите значение выражения 18,18a – 28,18a + 10 при a = - 9", options: ["1) - 100", "2) 100", "3) 19", "4) 80"] },
  { id: "ma_7_q16", type: "multiple_choice", points: 1, text: "16. Вычислите: - 2,5 ∙ (- 1,6) + 41,6 : (-40)", options: ["1) 3,6", "2) – 4,04", "3) 4,04", "4) 2,96."] },
  { id: "ma_7_q17", type: "multiple_choice", points: 1, text: "17. Найдите сумму корней уравнений: 12,4 - х = 2,6 и х : 1,9 = - 3", options: ["1) 9,3", "2) 4,1", "3) – 15,5", "4) нет правильного ответа"] },
  { id: "ma_7_q18", type: "multiple_choice", points: 1, text: "18. В таблице приведены оценки по математике у 25 учеников: «5» - 6 учеников, «4» - 9 учеников, «3» - 7 учеников, «2» - 3 ученика. Найдите моду и размах этих данных.", options: ["1) мода = 9, размах = 6", "2) мода = 5, размах = 3", "3) мода = 4, размах = 2"] },
  { id: "ma_7_q19", type: "multiple_choice", points: 1, text: "19. В классе 24 ученика. На кружки по рисованию ходят 9 человек, на кружок по шахматам – 7 человек, на оба кружка – 3 человека. Сколько учеников не посещают ни один из этих кружков?", options: ["1) 5 учеников", "2) 8 учеников", "3) 11 учеников", "4) определить нельзя."] },
  { id: "ma_7_q20", type: "multiple_choice", points: 1, text: "20. На прямой даны три точки А, В, С. Какова длина отрезка АС, если расстояние между точками А и В равно 23 см, а расстояние между точками В и С равно 3дм?", options: ["1) 7 см", "2) 27 дм", "3) 53 см", "4) 7 см или 53 см."] }
];

// Exact answer keys from official image provided by user
const russianKeys = {
  "ru_7_q1": { ans: "2", pts: 1, topic: "Морфемика и словообразование" },
  "ru_7_q2": { ans: "2", pts: 1, topic: "Морфология и грамматика" },
  "ru_7_q3": { ans: "4", pts: 1, topic: "Орфография: чередующиеся гласные" },
  "ru_7_q4": { ans: "3", pts: 1, topic: "Орфография и правила" },
  "ru_7_q5": { ans: "3", pts: 1, topic: "Синтаксис и пунктуация" },
  "ru_7_q6": { ans: "1", pts: 1, topic: "Пунктуация в предложении" },
  "ru_7_q7": { ans: "1", pts: 1, topic: "Сложное предложение" },
  "ru_7_q8": { ans: "1", pts: 1, topic: "Орфоэпия и ударение" },
  "ru_7_q9": { ans: "2", pts: 1, topic: "Фонетика и звуки" }
};

const mathKeys = {
  "ma_7_q1": { ans: "3", pts: 1, topic: "Сравнение чисел" },
  "ma_7_q2": { ans: "3", pts: 1, topic: "Делимость чисел" },
  "ma_7_q3": { ans: "1", pts: 1, topic: "Сокращение дробей" },
  "ma_7_q4": { ans: "4", pts: 1, topic: "Текстовые задачи на деление" },
  "ma_7_q5": { ans: "3", pts: 1, topic: "Геометрия: периметр" },
  "ma_7_q6": { ans: "3", pts: 1, topic: "Координатная прямая" },
  "ma_7_q7": { ans: "3", pts: 1, topic: "Линейные уравнения" },
  "ma_7_q8": { ans: "2", pts: 1, topic: "Сложение отрицательных чисел" },
  "ma_7_q9": { ans: "3", pts: 1, topic: "Модуль числа" },
  "ma_7_q10": { ans: "1", pts: 1, topic: "Решение уравнений" },
  "ma_7_q11": { ans: "1", pts: 1, topic: "Вычитание чисел" },
  "ma_7_q12": { ans: "1", pts: 1, topic: "Округление дробей" },
  "ma_7_q13": { ans: "3", pts: 1, topic: "Арифметические вычисления" },
  "ma_7_q14": { ans: "3", pts: 1, topic: "Проценты и вклады" },
  "ma_7_q15": { ans: "2", pts: 1, topic: "Буквенные выражения" },
  "ma_7_q16": { ans: "4", pts: 1, topic: "Вычисления со скобками" },
  "ma_7_q17": { ans: "2", pts: 1, topic: "Сумма корней уравнений" },
  "ma_7_q18": { ans: "3", pts: 1, topic: "Статистика: мода и размах" },
  "ma_7_q19": { ans: "3", pts: 1, topic: "Логические задачи" },
  "ma_7_q20": { ans: "4", pts: 1, topic: "Геометрия: отрезки" }
};

async function seed() {
  console.log("🚀 Starting seeding of Grade 7 questions and answer keys into Firestore...");

  // Write public test document to `tests`
  const testData = {
    id: "test_grade_7",
    tenantId: TENANT_ID,
    grade: 7,
    title: "Вступительный тест за 7 класс",
    description: "Официальный диагностический тест за 7 класс",
    questions: {
      russian: ruQuestions,
      math: maQuestions,
      logic: [],
      english: []
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const answerKeyData = {
    id: "test_grade_7",
    tenantId: TENANT_ID,
    grade: 7,
    keys: {
      russian: russianKeys,
      math: mathKeys,
      logic: {},
      english: {}
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const batch = db.batch();

  // Save to standard doc IDs
  batch.set(db.collection("tests").doc("test_grade_7"), testData, { merge: true });
  batch.set(db.collection("tests").doc(`test_grade_7_${TENANT_ID}`), testData, { merge: true });
  batch.set(db.collection("tests").doc("7"), testData, { merge: true });

  batch.set(db.collection("test_answer_keys").doc("test_grade_7"), answerKeyData, { merge: true });
  batch.set(db.collection("test_answer_keys").doc(`test_grade_7_${TENANT_ID}`), answerKeyData, { merge: true });
  batch.set(db.collection("test_answer_keys").doc("7"), answerKeyData, { merge: true });

  await batch.commit();
  console.log("✅ Successfully seeded Grade 7 tests & answer keys into Firestore!");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seeding error:", err);
  process.exit(1);
});
