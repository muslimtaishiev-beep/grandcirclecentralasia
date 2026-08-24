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

const commonLogicQuestions = [
  {
    id: "logic_1",
    type: "logic_matrix",
    points: 1,
    text: "Задание №1. Встретились три друга: Белов, Серов, Чернов. На них были белая, серая и черная рубашки. Одетый в белую рубашку сказал Чернову: «Интересно, что цвет рубашки на каждом из нас не соответствует фамилии». Какой цвет рубашки у каждого?",
    matrixRows: ["Белов", "Серов", "Чернов"],
    matrixCols: ["Белая рубашка", "Серая рубашка", "Чёрная рубашка"]
  },
  {
    id: "logic_2",
    type: "dropdown_multiple",
    points: 1,
    text: "Задание №2. В трех ящиках находятся крупа, вермишель и сахар. На первом ящике написано «крупа», на втором – «вермишель», на третьем – «крупа или сахар». Что в каком ящике находится, если содержимое каждого из ящиков не соответствует надписи на нем?",
    dropdownItems: [
      { label: "Ящик 1 (надпись «крупа»)", options: ["Крупа", "Вермишель", "Сахар"] },
      { label: "Ящик 2 (надпись «вермишель»)", options: ["Крупа", "Вермишель", "Сахар"] },
      { label: "Ящик 3 (надпись «крупа или сахар»)", options: ["Крупа", "Вермишель", "Сахар"] }
    ]
  },
  {
    id: "logic_3",
    type: "drag_and_drop",
    points: 1,
    text: "Задание №3. Митя, Сеня, Толя, Юра и Костя пошли на концерт и встали в очередь. Если бы Митя встал посередине очереди, то он бы оказался между Сеней и Костей, а если бы Митя встал в конец очереди, то рядом с ним мог быть Юра, но Митя встал впереди всех своих товарищей. Кто за кем стоит?",
    dragItems: ["Толя", "Юра", "Митя", "Костя", "Сеня"]
  },
  {
    id: "logic_4",
    type: "logic_matrix",
    points: 1,
    text: "Задание №4. Олег, Коля, Ваня живут в одном доме. Каждый из них занимается музыкой: пением, игрой на скрипке или пианино. Известно, что: Коля живет на том этаже, что и певец; Пианист и Олег ходят в разные классы; Олег и певец родились в одном месяце. Кто чем занимается?",
    matrixRows: ["Олег", "Коля", "Ваня"],
    matrixCols: ["Певец", "Скрипач", "Пианист"]
  },
  {
    id: "logic_5",
    type: "multiple_choice",
    points: 1,
    text: "Задание №5. Свежесобранные ягоды черники содержат 99% воды. Через некоторое время эти же ягоды стали содержать 98% воды. Как изменилась масса ягод?",
    options: ["Уменьшилась на 1%", "Уменьшилась в 98/99 раз", "Уменьшилась в 2 раза"]
  },
  {
    id: "logic_6",
    type: "number_input",
    points: 1,
    text: "Задание №6. Доктор Ай вырывает зуб за 10 минут, а доктор Ой — за 15 минут. Если они начнут работать одновременно, сколько времени им потребуется, чтобы вырвать 10 зубов?"
  },
  {
    id: "logic_7",
    type: "number_input",
    points: 1,
    text: "Задание №7. Я задумал двузначное число, большее 10, потом сумму его цифр поделил пополам и взял целую часть; к ней я приписал слева — 20, потом прибавил 59, после чего, вычеркнув последнюю цифру, вновь посчитал сумму цифр полученного числа. Сколько у меня получилось?"
  },
  {
    id: "logic_8",
    type: "number_input",
    points: 1,
    text: "Задание №8. Пошел охотник на охоту с собакой. Идут они лесом, и вдруг собака увидала зайца. За сколько скачков собака догонит зайца, если расстояние от собаки до зайца равно 40 скачкам собаки и расстояние, которое пробегает собака за 5 скачков, заяц пробегает за 6 скачков? (В задаче подразумевается, что скачки делаются одновременно и зайцем и собакой.)"
  }
];

const logicKeys = {
  "logic_1": { ans: "Белов-Чёрная,Серов-Белая,Чернов-Серая", pts: 1, topic: "Логические матрицы" },
  "logic_2": { ans: "Сахар,Крупа,Вермишель", pts: 1, topic: "Логическое рассуждение" },
  "logic_3": { ans: "Митя,Сеня,Толя,Костя,Юра", pts: 1, topic: "Последовательности и порядок" },
  "logic_4": { ans: "Олег-Скрипач,Коля-Пианист,Ваня-Певец", pts: 1, topic: "Логическое соответствие" },
  "logic_5": { ans: "Уменьшилась в 2 раза", pts: 1, topic: "Логические задачи на концентрацию" },
  "logic_6": { ans: "60", pts: 1, topic: "Совместная работа" },
  "logic_7": { ans: "7", pts: 1, topic: "Числовая логика" },
  "logic_8": { ans: "240", pts: 1, topic: "Задачи на движение и скачки" }
};

const english_grade_8 = [
  { id: "en_8_q1", text: "She ___ to school every day.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["go", "goes", "going", "went"] },
  { id: "en_8_q2", text: "We ___ TV when you called.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["watched", "were watching", "watch", "watching"] },
  { id: "en_8_q3", text: "I ___ never ___ sushi before.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["did / eat", "have / eaten", "am / eating", "was / eating"] },
  { id: "en_8_q4", text: "They ___ in this city since 2020.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["live", "lived", "have lived", "living"] },
  { id: "en_8_q5", text: "There ___ any milk in the fridge.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["isn’t", "aren’t", "don’t", "doesn’t"] }
];

const english_grade_9 = [
  { id: "en_9_q1", text: "If I ___ more time, I would learn another language.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["have", "had", "will have", "would have"] },
  { id: "en_9_q2", text: "She ___ working here for five years before she moved abroad.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["has been", "had been", "was", "is"] }
];

const english_grade_10_11 = [
  { id: "en_10_11_q1", text: "If I ___ earlier, I wouldn’t have missed the train.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["left", "had left", "would leave", "have left"] },
  { id: "en_10_11_q2", text: "By the time we arrived, they ___ dinner.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["finished", "have finished", "had finished", "were finishing"] }
];

async function updateLogicAndEnglish() {
  console.log("🚀 Executing batch update for Logic & English questions...");

  const batch = db.batch();
  const grades = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  for (const grade of grades) {
    let engList = english_grade_8;
    if (grade === 9) engList = english_grade_9;
    if (grade >= 10) engList = english_grade_10_11;

    const docId1 = `test_grade_${grade}`;
    const docId2 = `test_grade_${grade}_${TENANT_ID}`;
    const docId3 = `${grade}`;

    batch.set(db.collection("tests").doc(docId1), {
      "questions.logic": commonLogicQuestions,
      "questions.english": engList,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    batch.set(db.collection("tests").doc(docId2), {
      "questions.logic": commonLogicQuestions,
      "questions.english": engList
    }, { merge: true });

    batch.set(db.collection("tests").doc(docId3), {
      "questions.logic": commonLogicQuestions,
      "questions.english": engList
    }, { merge: true });

    batch.set(db.collection("test_answer_keys").doc(docId1), {
      "keys.logic": logicKeys,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    batch.set(db.collection("test_answer_keys").doc(docId2), {
      "keys.logic": logicKeys
    }, { merge: true });

    batch.set(db.collection("test_answer_keys").doc(docId3), {
      "keys.logic": logicKeys
    }, { merge: true });
  }

  await batch.commit();
  console.log("⚡ Batch update of Logic & English questions completed successfully!");
  process.exit(0);
}

updateLogicAndEnglish().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
