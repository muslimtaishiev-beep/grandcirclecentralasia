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
    id: "ru_11_q1",
    type: "multiple_choice",
    points: 1,
    text: "Задание №1. Отметьте слово, в котором НЕВЕРНО выделен ударный гласный звук:",
    options: ["1) вероисповедАние", "2) заперлА", "3) оптОвый", "4) красИвее"]
  },
  {
    id: "ru_11_q2",
    type: "multiple_choice",
    points: 1,
    text: "Задание №2. Исправьте лексическую ошибку в одном из предложений, подобрав к выделенному слову пароним. Запишите подобранное слово:",
    options: [
      "1) На прогулку Катя НАДЕЛА тёплую шапку.",
      "2) Нужны сведения о НАЛИЧНОСТИ в фондах библиотеки новых поступлений.",
      "3) Многие женщины посмотрели на новую гостью с завистью и НЕДОБРОЖЕЛАТЕЛЬНОСТЬЮ.",
      "4) Из радиоприёмника доносился НЕМУДРЁНЫЙ, однообразный мотивчик."
    ]
  },
  {
    id: "ru_11_q3",
    type: "multiple_choice",
    points: 1,
    text: "Задание №3. Укажите верную характеристику предложения:\n«Пока мы переходили через поляну, турки успели сделать несколько выстрелов.»",
    options: ["1) сложносочиненное", "2) сложноподчиненное", "3) бессоюзное"]
  },
  {
    id: "ru_11_q4",
    type: "multiple_choice",
    points: 1,
    text: "Задание №4. Выделите слово, в котором пропущена безударная проверяемая гласная корня:",
    options: ["1) ф..олетовый", "2) переб..рать", "3) пр..стодушный", "4) выт..реть", "5) прик..сновение"]
  },
  {
    id: "ru_11_q5",
    type: "multiple_choice",
    points: 1,
    text: "Задание №5. Выпишите ряд, в котором в обоих словах пропущена одна и та же буква:",
    options: [
      "1) пр..мета, пр…красный",
      "2) под..брать, поз..вчерашний",
      "3) и..пользовать, во..рождение",
      "4) о..дача, пре..теча",
      "5) под..грать, из..мать"
    ]
  },
  {
    id: "ru_11_q6",
    type: "multiple_choice",
    points: 1,
    text: "Задание №6. Выпишите слово, в котором на месте пропуска пишется буква Е:",
    options: ["1) подстра…ваться", "2) эмал…вый", "3) проста…вать", "4) изменч..вый"]
  },
  {
    id: "ru_11_q7",
    type: "multiple_choice",
    points: 1,
    text: "Задание №7. Выделите слово, в котором НЕ со словом пишется СЛИТНО:",
    options: [
      "1) Дворник наш (не)способен и муху обидеть.",
      "2) Без дружбы никакое общение (не)имеет смысла.",
      "3) (Не)каждый способен на благородные поступки.",
      "4) (Не)лестный отзыв о способностях Лизы покоробил Петрова.",
      "5) Никто (не) дерзал отказываться от его (Троекурова) приглашения."
    ]
  },
  {
    id: "ru_11_q8",
    type: "multiple_choice",
    points: 1,
    text: "Задание №8. В каком предложении оба выделенных слова пишутся СЛИТНО:",
    options: [
      "1) (НЕ)СМОТРЯ на то что большинство стихотворений Жуковского является переводными, в них мы ВСЁ(ТАКИ) видим русский пейзаж.",
      "2) Я хочу поговорить с вами (НА)СЧЁТ квартиры, (В)СВЯЗИ с чем прошу уделить мне внимание.",
      "3) Студент выбрал эту тему реферата, ЧТО(БЫ) лучше узнать историю музыки, и В(ТЕЧЕНИЕ) месяца изучал полученные в библиотеке книги.",
      "4) Тихо опустилось солнце за горы, выбросило (К)ВЕРХУ прощальный зелёный луч, и Байкал (ТОТ)ЧАС отразил в себе нежную зелень.",
      "5) А вечером он сидел опять ЗА (ТЕМ) же столом и, положив голову на руку, слушал Настасью Петровну и пытался понять, ПО (ЧЕМУ) ему так хорошо в этом доме."
    ]
  },
  {
    id: "ru_11_q9",
    type: "multiple_choice",
    points: 1,
    text: "Задание №9. Укажите все цифры, на месте которых пишется НН:\n«Точная дата основания города Баку не установле(1)а. Первые письме(2)ые упоминания о Баку датирова(3)ы V веком. Армянский историк Гевонд упоминает разруше(4)ую хазарами крепость Атши-Багуан.»",
    options: ["1) 2, 4", "2) 1, 3", "3) 2, 3, 4", "4) Все цифры"]
  },
  {
    id: "ru_11_q10",
    type: "multiple_choice",
    points: 1,
    text: "Задание №10. Укажите все цифры, на месте которых в предложении должны стоять запятые:\n«Солнце (1) не спеша (2) поднималось над горизонтом (3) озаряя первыми лучами (4) поля (5) засеянные пшеницей.»",
    options: ["1) 1, 2, 3, 5", "2) 3, 5", "3) 1, 2, 3, 4, 5", "4) 3, 4, 5"]
  }
];

const maQuestions = [
  { id: "ma_11_q1", type: "multiple_choice", points: 1, text: "А1. Упростите выражение: -4√x + 5√x - 4√x", options: ["1) -3√x", "2) 9√x", "3) √x + 8", "4) 1 - 3√x"] },
  { id: "ma_11_q2", type: "multiple_choice", points: 1, text: "А2. Вычислить: 4 ∙ cos(π/3)", options: ["1) 0", "2) 2", "3) -1", "4) -2"] },
  { id: "ma_11_q3", type: "multiple_choice", points: 1, text: "А3. Решите тригонометрическое уравнение: cos²x - sin²x = 0,5", options: ["1) ± π/6 + πn, n ∈ Z", "2) ± π/6 + 2πn, n ∈ Z", "3) ± π/3 + πn, n ∈ Z", "4) ± π/3 + 2πn, n ∈ Z"] },
  { id: "ma_11_q4", type: "multiple_choice", points: 1, text: "А4. Решите неравенство: log₂(x - 1) > 1", options: ["1) (-∞; 3)", "2) (3; +∞)", "3) (1,75; +∞)", "4) (-∞; -2)"] },
  { id: "ma_11_q5", type: "multiple_choice", points: 1, text: "A5. Найдите множество значений функции: y = 11 cos x", options: ["1) [-11; 11]", "2) [0; 11]", "3) (-∞; +∞)", "4) [-1; 1]"] },
  { id: "ma_11_q6", type: "multiple_choice", points: 1, text: "А6. Найдите производную функции: y = 3x² ∙ cos x", options: ["1) -6x sin x", "2) 6x cos x - 3x² sin x", "3) cos x + 3 sin x", "4) 6x cos x + 3 sin x"] },
  { id: "ma_11_q7", type: "number_input", points: 1, text: "B1. Точка движется по координатной прямой согласно закону X(t) = 3 + 2t + t², где X(t) - координаты точки в момент времени t. В какой момент времени скорость точки будет равна 5?" },
  { id: "ma_11_q8", type: "number_input", points: 1, text: "В2. Определите абсциссу точки, в которой угловой коэффициент касательной к графику функции h(x) = 1 - 2x² равен -4." }
];

const russianKeys = {
  "ru_11_q1": { ans: "1", pts: 1, topic: "Орфоэпия и ударение" },
  "ru_11_q2": { ans: "2", pts: 1, topic: "Паронимы и лексика" },
  "ru_11_q3": { ans: "2", pts: 1, topic: "Сложноподчиненные предложения" },
  "ru_11_q4": { ans: "3", pts: 1, topic: "Безударные проверяемые гласные" },
  "ru_11_q5": { ans: "2", pts: 1, topic: "Правописание приставок" },
  "ru_11_q6": { ans: "2", pts: 1, topic: "Суффиксы прилагательных" },
  "ru_11_q7": { ans: "4", pts: 1, topic: "Слитное написание НЕ" },
  "ru_11_q8": { ans: "4", pts: 1, topic: "Слитное написание наречий" },
  "ru_11_q9": { ans: "1", pts: 1, topic: "Правописание НН в причастиях" },
  "ru_11_q10": { ans: "1", pts: 1, topic: "Пунктуация: деепричастные и причастные обороты" }
};

const mathKeys = {
  "ma_11_q1": { ans: "1", pts: 1, topic: "Преобразование радикалов" },
  "ma_11_q2": { ans: "2", pts: 1, topic: "Тригонометрические значения" },
  "ma_11_q3": { ans: "1", pts: 1, topic: "Тригонометрические уравнения" },
  "ma_11_q4": { ans: "2", pts: 1, topic: "Логарифмические неравенства" },
  "ma_11_q5": { ans: "1", pts: 1, topic: "Область значений тригонометрической функции" },
  "ma_11_q6": { ans: "2", pts: 1, topic: "Производная произведения функций" },
  "ma_11_q7": { ans: "1.5", pts: 1, topic: "Физический смысл производной" },
  "ma_11_q8": { ans: "1", pts: 1, topic: "Геометрический смысл производной" }
};

async function seed() {
  console.log("🚀 Starting seeding of Grade 11 questions and answer keys into Firestore...");

  const testData = {
    id: "test_grade_11",
    tenantId: TENANT_ID,
    grade: 11,
    title: "Вступительный тест за 11 класс",
    description: "Официальный академический тест за 11 класс",
    questions: {
      russian: ruQuestions,
      math: maQuestions,
      logic: [],
      english: []
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const answerKeyData = {
    id: "test_grade_11",
    tenantId: TENANT_ID,
    grade: 11,
    keys: {
      russian: russianKeys,
      math: mathKeys,
      logic: {},
      english: {}
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const batch = db.batch();

  batch.set(db.collection("tests").doc("test_grade_11"), testData, { merge: true });
  batch.set(db.collection("tests").doc(`test_grade_11_${TENANT_ID}`), testData, { merge: true });
  batch.set(db.collection("tests").doc("11"), testData, { merge: true });

  batch.set(db.collection("test_answer_keys").doc("test_grade_11"), answerKeyData, { merge: true });
  batch.set(db.collection("test_answer_keys").doc(`test_grade_11_${TENANT_ID}`), answerKeyData, { merge: true });
  batch.set(db.collection("test_answer_keys").doc("11"), answerKeyData, { merge: true });

  await batch.commit();
  console.log("✅ Successfully seeded Grade 11 tests & answer keys into Firestore!");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seeding error:", err);
  process.exit(1);
});
