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
    id: "ru_8_q1",
    type: "multiple_choice",
    points: 1,
    text: "Задание №1. Найди предложение, в котором есть фразеологизм:",
    options: [
      "1) Мы не могли распутать этот узел на веревке, пришлось его разрубить.",
      "2) Первая скрипка, которую подарили в детстве родители, хранится у меня и сегодня.",
      "3) Гвоздем программы было выступление известного актера.",
      "4) Он запустил руку в мешок и вытащил оттуда зайчонка."
    ]
  },
  {
    id: "ru_8_q2",
    type: "multiple_choice",
    points: 1,
    text: "Задание №2. Укажите верное толкование слова ПУНКТУАЛЬНЫЙ:",
    options: [
      "1) Местный",
      "2) Аккуратный, точный",
      "3) Медлительный",
      "4) Безвестный"
    ]
  },
  {
    id: "ru_8_q3",
    type: "multiple_choice",
    points: 1,
    text: "Задание №3. Какое слово образовано приставочным способом?",
    options: [
      "1) Заплыть",
      "2) Безрукавка",
      "3) Бесполезный",
      "4) Водный"
    ]
  },
  {
    id: "ru_8_q4",
    type: "multiple_choice",
    points: 1,
    text: "Задание №4. В каком варианте ответа в обоих словах пропущена буква О?",
    options: [
      "1) бельч…нок, ш…пот",
      "2) ч…рный, морозц…м",
      "3) крыж…вник, вещ…вой",
      "4) девч…нка, плащ…м"
    ]
  },
  {
    id: "ru_8_q5",
    type: "multiple_choice",
    points: 1,
    text: "Задание №5. Со всеми словами какого ряда НЕ пишется слитно?",
    options: [
      "1) (не) решительность, (не) подвижная вода",
      "2) явная (не) лепица, (не)знаю ответа",
      "3) вовсе (не) трудная задача, (не) высокие горы",
      "4) (не) внимателен, а рассеян, погода (не) летняя"
    ]
  },
  {
    id: "ru_8_q6",
    type: "multiple_choice",
    points: 1,
    text: "Задание №6. Обозначьте строчку, где во всех словах пишется Н:",
    options: [
      "1) карма…ый фонарик, сви…ая котлета",
      "2) ю…ый натуралист, иностра…ый язык",
      "3) тополи…ый пух, серебря…ый медальон",
      "4) дли…ная дорога, ветре…ый день"
    ]
  },
  {
    id: "ru_8_q7",
    type: "multiple_choice",
    points: 1,
    text: "Задание №7. В каком ряду в обоих словах пропущена буква А?",
    options: [
      "1) прик…саться, з…ря",
      "2) изл…жение, заг…р",
      "3) сл…гаемое, р…сток",
      "4) выр…щивать, г…рит"
    ]
  },
  {
    id: "ru_8_q8",
    type: "multiple_choice",
    points: 1,
    text: "Задание №8. Определите, где неверно указано значение фразеологизма:",
    options: [
      "1) золотые руки – мастер своего дела",
      "2) водить за нос – обманывать",
      "3) рукой подать – далеко"
    ]
  },
  {
    id: "ru_8_q9",
    type: "multiple_choice",
    points: 1,
    text: "Задание №9. В каком ряду во всех словах пропущена одна и та же буква?",
    options: [
      "1) Пр...морье, пр…мудрый, пр…милый",
      "2) Пр…паять, пр…обрести, пр…усадебный",
      "3) Пр…брежный, пр…забавный, пр…неприятный",
      "4) Пр...клеить, пр…одолеть, пр…лечь"
    ]
  },
  {
    id: "ru_8_q10",
    type: "multiple_choice",
    points: 1,
    text: "Задание №10. Укажите предложение с ошибкой в употреблии числительного:",
    options: [
      "1) Нет с собой девятисот рублей.",
      "2) Я встретил троих друзей.",
      "3) Мы живем в триста двенадцатой квартире.",
      "4) К четырехстам прибавить пятьдесят."
    ]
  },
  {
    id: "ru_8_q11",
    type: "multiple_choice",
    points: 1,
    text: "Задание №11. В каком варианте указаны все слова, которые пишутся через дефис?",
    options: [
      "1) (восточно) европейский, горько (соленый), (кое) с чем",
      "2) (желто) зеленый, (темно)волосый, (западно) сибирский",
      "3) (древне)русский, (железно)дорожный, (официально)деловой",
      "4) какой(либо), (шахматно)шашечный, ярко(красный)"
    ]
  },
  {
    id: "ru_8_q12",
    type: "dropdown_multiple",
    points: 1,
    text: "Задание №12. Соотнесите термины с их функцией:",
    dropdownItems: [
      { label: "Прилагательное", options: ["часть речи", "член предложения"] },
      { label: "Сказуемое", options: ["часть речи", "член предложения"] },
      { label: "Союз", options: ["часть речи", "член предложения"] },
      { label: "Определение", options: ["часть речи", "член предложения"] },
      { label: "Существительное", options: ["часть речи", "член предложения"] }
    ]
  },
  {
    id: "ru_8_q13",
    type: "multiple_choice",
    points: 1,
    text: "Задание №13. Отметьте, где знаки расставлены ВЕРНО:",
    options: [
      "1) Из-под этой тучи вырвались яркие лучи, и мокрые леса и поля засверкали.",
      "2) Из-под этой тучи вырвались яркие лучи, и мокрые леса, и поля засверкали.",
      "3) Из-под этой тучи вырвались яркие лучи и мокрые леса, и поля засверкали."
    ]
  }
];

const maQuestions = [
  { id: "ma_8_q1", type: "multiple_choice", points: 1, text: "1. Упростите выражение: 12х - 5(1– х) + 7", options: ["A) 17x – 12", "B) 17х + 2", "C) 7(х – 1)", "D) 17х + 12", "E) 7х + 2"] },
  { id: "ma_8_q2", type: "multiple_choice", points: 1, text: "2. Запишите в виде многочлена: (4n² - 1)(n² + 5)", options: ["A) -4n² + 5 – 20n⁴", "B) 20n⁴ + 4n² – 5", "C) 4n⁴ + 19n² – 5", "D) n⁴ + n² + 5", "E) 2n + 20n² – 5"] },
  { id: "ma_8_q3", type: "multiple_choice", points: 1, text: "3. В треугольнике МКЕ угол К равен 42°, угол М на 57° больше. Вычислите градусную меру угла Е.", options: ["А) 101°", "B) 82°", "C) 39°", "D) 27°", "E) 49°"] },
  { id: "ma_8_q4", type: "multiple_choice", points: 1, text: "4. Один из смежных углов на 54° больше другого. Найдите больший угол.", options: ["А) 117°", "B) 108°", "C) 84°", "D) 78°", "E) 107°"] },
  { id: "ma_8_q5", type: "multiple_choice", points: 1, text: "5. Разложите на множители: 64a⁶ – c¹²", options: ["A) (8a³ + c⁶)(8a³ – c⁶)", "B) (2a + c²)(2a – c²)(4а² – 2ас² + с⁴)", "C) (2a + c²)(2a – c²)(4а² + 2ас² + с⁴)", "D) (4a² + c⁴)(4a² - c⁴)", "E) (2a + c²)(2a – c²)(4а² – 2ас² + с⁴)(4а² + 2ас² + с⁴)"] },
  { id: "ma_8_q6", type: "multiple_choice", points: 1, text: "6. Найдите корни уравнения: 7 + 2х² = 2(х + 1)(х + 3)", options: ["A) 1/8", "B) 1/6", "C) 1/9", "D) 2/5", "E) 1/7"] },
  { id: "ma_8_q7", type: "multiple_choice", points: 1, text: "7. 5 кондитеров выполнят заказ за 12 часов. За сколько часов выполнят этот заказ 6 кондитеров?", options: ["A) 14 ч", "B) 10 ч", "C) 12 ч", "D) 13 ч", "E) 11 ч"] },
  { id: "ma_8_q8", type: "multiple_choice", points: 1, text: "8. Укажите число, имеющее наименьший модуль.", options: ["A) 4,7", "B) – 135", "C) 0", "D) – 0,28", "E) 14,3"] },
  { id: "ma_8_q9", type: "multiple_choice", points: 1, text: "9. Треугольник, с какими сторонами можно изобразить?", options: ["А) 2; 2; 4", "B) 8; 11; 2", "C) 11; 6; 6", "D) 18; 9; 8", "E) 3; 2; 6"] },
  { id: "ma_8_q10", type: "multiple_choice", points: 1, text: "10. Углы треугольника АВС относятся как 5:3:1. Вычислите самый большой угол этого треугольника.", options: ["А) 140°", "B) 130°", "C) 100°", "D) 80°", "E) 90°"] },
  { id: "ma_8_q11", type: "multiple_choice", points: 1, text: "11. Решите уравнение: |x - 7| = 2", options: ["A) 5; 9", "B) 9; 6", "C) 10; 1", "D) -5; 6", "E) 6; 8"] },
  { id: "ma_8_q12", type: "multiple_choice", points: 1, text: "12. Решить неравенство: 4у + 4 < y - 5", options: ["А) (-∞; -3)", "В) (- ∞; 3)", "С) (-∞; -9)", "D) (3; + ∞)", "Е) (-3; + ∞)"] },
  { id: "ma_8_q13", type: "multiple_choice", points: 1, text: "13. Сумма вертикальных углов равна 136°. Вычислите один из вертикальных углов.", options: ["А) 56°", "B) 102°", "C) 284°", "D) 68°", "E) 86°"] },
  { id: "ma_8_q14", type: "multiple_choice", points: 1, text: "14. Выберите верное утверждение. Если две параллельные прямые пересечены секущей, то", options: ["А) накрест лежащие углы в сумме дают 180°", "B) смежные углы равны", "C) соответственные углы равны", "D) односторонние углы равны", "E) сумма соответственных углов равна 180°"] },
  { id: "ma_8_q15", type: "multiple_choice", points: 1, text: "15. Представьте в виде произведения: х(a – b) + y(b – a)", options: ["A) (а – в)(х – у)", "B) (в – а)(х – у)", "C) – (х + у)(а + в)", "D) (х + у)(в – а)", "E) (а – в)(х + у)"] },
  { id: "ma_8_q16", type: "multiple_choice", points: 1, text: "16. Найдите сумму углов 1 + 2 + 3, изображенных на рисунке.", options: ["1) 90°", "2) 150°", "3) 180°", "4) 360°", "5) 200°"] },
  { id: "ma_8_q17", type: "multiple_choice", points: 1, text: "17. В прямоугольном треугольнике АВС угол В равен 90°, угол С равен 45°. Сравните стороны треугольника.", options: ["А) АВ < АС < ВС", "B) АВ > АС > ВС", "C) АВ = ВС < АС", "D) СА = АВ = ВС", "E) AB > BC = АС"] },
  { id: "ma_8_q18", type: "multiple_choice", points: 1, text: "18. Айман купила для братика упаковку воздушных шариков. Оказалось, что из 20 шариков 12 красные, а остальные - зеленые. Какова вероятность того, что брат наугад достанет из упаковки зеленый шарик?", options: ["A) 3/5", "B) 2/5", "C) 1/12", "D) 1/20", "E) 1/8"] },
  { id: "ma_8_q19", type: "multiple_choice", points: 1, text: "19. Выполните действия: (2а² в)³", options: ["A) 2а6в3", "B) 8а6в3", "C) 2 в", "D) 8 в³", "E) 16a4b3"] },
  { id: "ma_8_q20", type: "multiple_choice", points: 1, text: "20. При каких значениях m графики функций у=mx + 12 и у= - 4х +3 параллельны?", options: ["A) - 4", "B) 4", "C) 3", "D) - 3", "E) 12"] },
  { id: "ma_8_q21", type: "multiple_choice", points: 1, text: "21. Решите систему уравнений: -2x + 5y = 12 и 3x - y = 8", options: ["A) (4; - 4)", "B) (2; 2)", "C) (4; 4)", "D) (- 4; 4)", "E) (1; 3)"] },
  { id: "ma_8_q22", type: "multiple_choice", points: 1, text: "22. Самир положил в банк 12000 сом под 10% годовых. Какая общая сумма денег будет на его счету через 3 года?", options: ["A) 120360", "B) 123600", "C) 156000", "D) 120120", "E) 123060"] }
];

const russianKeys = {
  "ru_8_q1": { ans: "3", pts: 1, topic: "Фразеологизмы" },
  "ru_8_q2": { ans: "2", pts: 1, topic: "Лексика и значения слов" },
  "ru_8_q3": { ans: "1", pts: 1, topic: "Словообразование" },
  "ru_8_q4": { ans: "4", pts: 1, topic: "Орфография: О/Ё после шипящих" },
  "ru_8_q5": { ans: "1", topic: "Орфография: НЕ с разными частями речи", pts: 1 },
  "ru_8_q6": { ans: "3", topic: "Орфография: Н и НН", pts: 1 },
  "ru_8_q7": { ans: "1", topic: "Орфография: чередующиеся гласные", pts: 1 },
  "ru_8_q8": { ans: "3", topic: "Фразеология и значения", pts: 1 },
  "ru_8_q9": { ans: "2", topic: "Орфография: приставки ПРЕ/ПРИ", pts: 1 },
  "ru_8_q10": { ans: "3", topic: "Морфология: числительные", pts: 1 },
  "ru_8_q11": { ans: "4", topic: "Орфография: дефисное написание", pts: 1 },
  "ru_8_q12": { ans: "часть речи, член предложения, часть речи, член предложения, часть речи", topic: "Морфология и синтаксис", pts: 1 },
  "ru_8_q13": { ans: "1", topic: "Пунктуация в сложном предложении", pts: 1 }
};

const mathKeys = {
  "ma_8_q1": { ans: "B", pts: 1, topic: "Выражения и многочлены" },
  "ma_8_q2": { ans: "C", pts: 1, topic: "Умножение многочленов" },
  "ma_8_q3": { ans: "C", pts: 1, topic: "Геометрия: углы треугольника" },
  "ma_8_q4": { ans: "A", pts: 1, topic: "Геометрия: смежные углы" },
  "ma_8_q5": { ans: "C", pts: 1, topic: "Разложение на множители" },
  "ma_8_q6": { ans: "A", pts: 1, topic: "Квадратные уравнения" },
  "ma_8_q7": { ans: "B", pts: 1, topic: "Пропорции и работа" },
  "ma_8_q8": { ans: "C", pts: 1, topic: "Модуль числа" },
  "ma_8_q9": { ans: "C", pts: 1, topic: "Геометрия: неравенство треугольника" },
  "ma_8_q10": { ans: "C", pts: 1, topic: "Углы треугольника и пропорции" },
  "ma_8_q11": { ans: "A", pts: 1, topic: "Уравнения с модулем" },
  "ma_8_q12": { ans: "A", pts: 1, topic: "Линейные неравенства" },
  "ma_8_q13": { ans: "D", pts: 1, topic: "Геометрия: вертикальные углы" },
  "ma_8_q14": { ans: "C", pts: 1, topic: "Параллельные прямые и секущая" },
  "ma_8_q15": { ans: "A", pts: 1, topic: "Разложение на множители" },
  "ma_8_q16": { ans: "4", pts: 1, topic: "Сумма углов" },
  "ma_8_q17": { ans: "C", pts: 1, topic: "Прямоугольный треугольник" },
  "ma_8_q18": { ans: "B", pts: 1, topic: "Теория вероятностей" },
  "ma_8_q19": { ans: "B", pts: 1, topic: "Степени и многочлены" },
  "ma_8_q20": { ans: "A", pts: 1, topic: "Параллельные графики функций" },
  "ma_8_q21": { ans: "C", pts: 1, topic: "Системы линейных уравнений" },
  "ma_8_q22": { ans: "C", pts: 1, topic: "Проценты и вклады" }
};

async function seed() {
  console.log("🚀 Starting seeding of Grade 8 questions and answer keys into Firestore...");

  const testData = {
    id: "test_grade_8",
    tenantId: TENANT_ID,
    grade: 8,
    title: "Вступительный тест за 8 класс",
    description: "Официальный академический тест за 8 класс",
    questions: {
      russian: ruQuestions,
      math: maQuestions,
      logic: [],
      english: []
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const answerKeyData = {
    id: "test_grade_8",
    tenantId: TENANT_ID,
    grade: 8,
    keys: {
      russian: russianKeys,
      math: mathKeys,
      logic: {},
      english: {}
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const batch = db.batch();

  batch.set(db.collection("tests").doc("test_grade_8"), testData, { merge: true });
  batch.set(db.collection("tests").doc(`test_grade_8_${TENANT_ID}`), testData, { merge: true });
  batch.set(db.collection("tests").doc("8"), testData, { merge: true });

  batch.set(db.collection("test_answer_keys").doc("test_grade_8"), answerKeyData, { merge: true });
  batch.set(db.collection("test_answer_keys").doc(`test_grade_8_${TENANT_ID}`), answerKeyData, { merge: true });
  batch.set(db.collection("test_answer_keys").doc("8"), answerKeyData, { merge: true });

  await batch.commit();
  console.log("✅ Successfully seeded Grade 8 tests & answer keys into Firestore!");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seeding error:", err);
  process.exit(1);
});
