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
  { id: "en_8_q5", text: "There ___ any milk in the fridge.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["isn’t", "aren’t", "don’t", "doesn’t"] },
  { id: "en_8_q6", text: "He is ___ than his brother.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["tall", "taller", "tallest", "more tall"] },
  { id: "en_8_q7", text: "You ___ smoke here. It’s forbidden.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["must", "mustn’t", "can", "should"] },
  { id: "en_8_q8", text: "I ___ go to the party tonight. I’m not sure.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["must", "might", "can’t", "should"] },
  { id: "en_8_q9", text: "She ___ her homework yesterday.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["didn’t do", "doesn’t do", "isn’t doing", "hasn’t do"] },
  { id: "en_8_q10", text: "This is ___ book I’ve ever read.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["good", "better", "the best", "more good"] },
  { id: "en_8_q11", text: "I usually [gap] at 7 a.m.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["wake up", "woke up", "am waking up"] },
  { id: "en_8_q12", text: "She [gap] coffee.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["doesn’t like", "don't like", "didn't liked"] },
  { id: "en_8_q13", text: "We [gap] our grandparents last weekend.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["visit", "visited", "have visited"] },
  { id: "en_8_q14", text: "They [gap] football now.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["play", "played", "are playing"] },
  { id: "en_8_q15", text: "He [gap] his work.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["has already finished", "already finished", "is already finishing"] },
  { id: "en_8_q16", text: "I [gap] to London.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["have never been", "never was", "am never being"] },
  { id: "en_8_q17", text: "She [gap] when I called her.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["studied", "was studying", "is studying"] },
  { id: "en_8_q18", text: "We [gap] to the cinema tomorrow.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["went", "go", "are going"] },
  { id: "en_8_q19", text: "He [gap] the question.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["doesn’t understand", "isn't understanding", "don't understand"] },
  { id: "en_8_q20", text: "They [gap] here for five years.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["live", "are living", "have lived"] },
  { id: "en_8_q21", text: "I’m afraid [gap] spiders.", instruction: "Fill in the gaps with the correct preposition or quantifier", points: 1, type: "inline_dropdown", inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"] },
  { id: "en_8_q22", text: "She is interested [gap] music.", instruction: "Fill in the gaps with the correct preposition or quantifier", points: 1, type: "inline_dropdown", inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"] },
  { id: "en_8_q23", text: "We arrived [gap] the airport at 6 p.m.", instruction: "Fill in the gaps with the correct preposition or quantifier", points: 1, type: "inline_dropdown", inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"] },
  { id: "en_8_q24", text: "He’s good [gap] maths.", instruction: "Fill in the gaps with the correct preposition or quantifier", points: 1, type: "inline_dropdown", inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"] },
  { id: "en_8_q25", text: "I usually go to bed [gap] midnight.", instruction: "Fill in the gaps with the correct preposition or quantifier", points: 1, type: "inline_dropdown", inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"] },
  { id: "en_8_q26", text: "There isn’t [gap] sugar left.", instruction: "Fill in the gaps with the correct preposition or quantifier", points: 1, type: "inline_dropdown", inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"] },
  { id: "en_8_q27", text: "How [gap] money do you need?", instruction: "Fill in the gaps with the correct preposition or quantifier", points: 1, type: "inline_dropdown", inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"] },
  { id: "en_8_q28", text: "This bag is [gap] heavy for me.", instruction: "Fill in the gaps with the correct preposition or quantifier", points: 1, type: "inline_dropdown", inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"] },
  { id: "en_8_q29", text: "I don’t have [gap] friends here.", instruction: "Fill in the gaps with the correct preposition or quantifier", points: 1, type: "inline_dropdown", inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"] },
  { id: "en_8_q30", text: "She’s the [gap] intelligent student in the class.", instruction: "Fill in the gaps with the correct preposition or quantifier", points: 1, type: "inline_dropdown", inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"] },
  { id: "en_8_q31", text: "This test is [gap] than the last one.", instruction: "Comparatives & Superlatives", points: 1, type: "inline_dropdown", inlineOptions: ["easier", "more easy", "the easiest"] },
  { id: "en_8_q32", text: "Who is [gap] student in your class?", instruction: "Comparatives & Superlatives", points: 1, type: "inline_dropdown", inlineOptions: ["the tallest", "tallest", "taller"] },
  { id: "en_8_q33", text: "My room is [gap] than yours.", instruction: "Comparatives & Superlatives", points: 1, type: "inline_dropdown", inlineOptions: ["smaller", "more small", "the smallest"] },
  { id: "en_8_q34", text: "That’s [gap] pizza I’ve ever eaten.", instruction: "Comparatives & Superlatives", points: 1, type: "inline_dropdown", inlineOptions: ["worse", "the worst", "baddest"] },
  { id: "en_8_q35", text: "English is [gap] than Maths for me.", instruction: "Comparatives & Superlatives", points: 1, type: "inline_dropdown", inlineOptions: ["more interesting", "most interesting", "interestinger"] },
  { id: "en_8_q36", text: "Incorrect: They didn’t went to the party.", instruction: "Find and correct the mistake. Choose the correct sentence.", points: 1, type: "multiple_choice", options: ["They don't went to the party.", "They didn't go to the party.", "They didn't goes to the party."] },
  { id: "en_8_q37", text: "Incorrect: There is many people in the room.", instruction: "Find and correct the mistake. Choose the correct sentence.", points: 1, type: "multiple_choice", options: ["There are many people in the room.", "There is much people in the room.", "There was many people in the room."] },
  { id: "en_8_q38", text: "Incorrect: I have seen him yesterday.", instruction: "Find and correct the mistake. Choose the correct sentence.", points: 1, type: "multiple_choice", options: ["I see him yesterday.", "I saw him yesterday.", "I had seen him yesterday."] },
  { id: "en_8_q39", text: "Incorrect: She can to drive a car.", instruction: "Find and correct the mistake. Choose the correct sentence.", points: 1, type: "multiple_choice", options: ["She can drive a car.", "She cans drive a car.", "She can driving a car."] },
  { id: "en_8_q40", text: "Incorrect: We are agree with you.", instruction: "Find and correct the mistake. Choose the correct sentence.", points: 1, type: "multiple_choice", options: ["We agreeing with you.", "We is agree with you.", "We agree with you."] }
];

const english_grade_9 = [
  { id: "en_9_q1", text: "If I ___ more time, I would learn another language.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["have", "had", "will have", "would have"] },
  { id: "en_9_q2", text: "She ___ working here for five years before she moved abroad.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["has been", "had been", "was", "is"] },
  { id: "en_9_q3", text: "He told me he ___ me later.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["calls", "called", "would call", "will call"] },
  { id: "en_9_q4", text: "This house ___ in the 18th century.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["built", "was built", "is building", "has build"] },
  { id: "en_9_q5", text: "She ___ to the gym regularly these days.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["goes", "is going", "go", "went"] },
  { id: "en_9_q6", text: "I ___ my keys. I can’t find them anywhere.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["lose", "lost", "have lost", "had lost"] },
  { id: "en_9_q7", text: "That’s the man ___ car was stolen.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["who", "which", "whose", "that"] },
  { id: "en_9_q8", text: "If it ___ tomorrow, we will stay at home.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["rains", "will rain", "raining", "rained"] },
  { id: "en_9_q9", text: "When I arrived, they ___ already ___.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["have / left", "had / left", "did / leave", "were / leaving"] },
  { id: "en_9_q10", text: "If I ___ harder, I would have got a promotion.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["work", "worked", "had worked", "have worked"] },
  { id: "en_9_q11", text: "I’m really looking forward [gap] my vacation.", instruction: "Fill in the gaps with the correct preposition", points: 1, type: "inline_dropdown", inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"] },
  { id: "en_9_q12", text: "She apologized [gap] being late.", instruction: "Fill in the gaps with the correct preposition", points: 1, type: "inline_dropdown", inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"] },
  { id: "en_9_q13", text: "He insisted [gap] paying for dinner.", instruction: "Fill in the gaps with the correct preposition", points: 1, type: "inline_dropdown", inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"] },
  { id: "en_9_q14", text: "I’m not used [gap] getting up early.", instruction: "Fill in the gaps with the correct preposition", points: 1, type: "inline_dropdown", inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"] },
  { id: "en_9_q15", text: "This exercise is different [gap] the previous one.", instruction: "Fill in the gaps with the correct preposition", points: 1, type: "inline_dropdown", inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"] },
  { id: "en_9_q16", text: "We ran out [gap] milk.", instruction: "Fill in the gaps with the correct preposition", points: 1, type: "inline_dropdown", inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"] },
  { id: "en_9_q17", text: "She’s afraid [gap] losing her job.", instruction: "Fill in the gaps with the correct preposition", points: 1, type: "inline_dropdown", inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"] },
  { id: "en_9_q18", text: "He succeeded [gap] passing the exam.", instruction: "Fill in the gaps with the correct preposition", points: 1, type: "inline_dropdown", inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"] },
  { id: "en_9_q19", text: "I’m interested [gap] improving my English.", instruction: "Fill in the gaps with the correct preposition", points: 1, type: "inline_dropdown", inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"] },
  { id: "en_9_q20", text: "There’s no point [gap] arguing.", instruction: "Fill in the gaps with the correct preposition", points: 1, type: "inline_dropdown", inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"] },
  { id: "en_9_q21", text: "I [gap] for you for over an hour!", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["wait", "have been waiting", "was waiting"] },
  { id: "en_9_q22", text: "She [gap] when the phone rang.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["worked", "was working", "has worked"] },
  { id: "en_9_q23", text: "They [gap] the project yet.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["didn't finish", "haven't finished", "aren't finishing"] },
  { id: "en_9_q24", text: "He said he [gap] later.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["will come", "would come", "comes"] },
  { id: "en_9_q25", text: "If I [gap] you, I wouldn’t do that.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["am", "was", "were"] },
  { id: "en_9_q26", text: "We [gap] when they arrived.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["already ate", "had already eaten", "were already eating"] },
  { id: "en_9_q27", text: "This book [gap] by a famous author.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["was written", "wrote", "is writing"] },
  { id: "en_9_q28", text: "She [gap] to improve her English recently.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["tries", "has been trying", "was trying"] },
  { id: "en_9_q29", text: "She [gap] speak three languages when she was 10.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["can", "was able to", "could to"] },
  { id: "en_9_q30", text: "They [gap] football when it started to rain.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["played", "were playing", "have played"] },
  { id: "en_9_q31", text: "You [gap] smoke here. It’s prohibited.", instruction: "Complete the sentences with the correct modal verb", points: 1, type: "inline_dropdown", inlineOptions: ["can", "could", "must", "mustn't", "might", "should", "have to"] },
  { id: "en_9_q32", text: "I’m not sure, but she [gap] be at home – let’s call her.", instruction: "Complete the sentences with the correct modal verb", points: 1, type: "inline_dropdown", inlineOptions: ["can", "could", "must", "mustn't", "might", "should", "have to"] },
  { id: "en_9_q33", text: "You look tired. You [gap] take a break.", instruction: "Complete the sentences with the correct modal verb", points: 1, type: "inline_dropdown", inlineOptions: ["can", "could", "must", "mustn't", "might", "should", "have to"] },
  { id: "en_9_q34", text: "He [gap] speak three languages when he was five years old.", instruction: "Complete the sentences with the correct modal verb", points: 1, type: "inline_dropdown", inlineOptions: ["can", "could", "must", "mustn't", "might", "should", "have to"] },
  { id: "en_9_q35", text: "In England, you [gap] drive on the left.", instruction: "Complete the sentences with the correct modal verb", points: 1, type: "inline_dropdown", inlineOptions: ["can", "could", "must", "mustn't", "might", "should", "have to"] },
  { id: "en_9_q36", text: "Incorrect: She don’t enjoy watching TV in the evening.", instruction: "Find and correct ONE mistake in each sentence.", points: 1, type: "multiple_choice", options: ["She aren't enjoy watching TV in the evening.", "She doesn't enjoy watching TV in the evening.", "She hasn't enjoy watching TV in the evening."] },
  { id: "en_9_q37", text: "Incorrect: I have seen him yesterday at the cinema.", instruction: "Find and correct ONE mistake in each sentence.", points: 1, type: "multiple_choice", options: ["I saw him yesterday at the cinema.", "I had seen him yesterday at the cinema.", "I was seeing him yesterday at the cinema."] },
  { id: "en_9_q38", text: "Incorrect: He was drive when the accident happened.", instruction: "Find and correct ONE mistake in each sentence.", points: 1, type: "multiple_choice", options: ["He was driven when the accident happened.", "He was driving when the accident happened.", "He driving when the accident happened."] },
  { id: "en_9_q39", text: "Incorrect: We didn’t went to school yesterday.", instruction: "Find and correct ONE mistake in each sentence.", points: 1, type: "multiple_choice", options: ["We didn't go to school yesterday.", "We don't went to school yesterday.", "We didn't goes to school yesterday."] },
  { id: "en_9_q40", text: "Incorrect: They have been know each other for years.", instruction: "Find and correct ONE mistake in each sentence.", points: 1, type: "multiple_choice", options: ["They have known each other for years.", "They have knowing each other for years.", "They knowed each other for years."] },
  { id: "en_9_q41", text: "Incorrect: If I will see her, I will tell her.", instruction: "Find and correct ONE mistake in each sentence.", points: 1, type: "multiple_choice", options: ["If I saw her, I will tell her.", "If I seeing her, I will tell her.", "If I see her, I will tell her."] },
  { id: "en_9_q42", text: "Incorrect: She suggested to go out for dinner.", instruction: "Find and correct ONE mistake in each sentence.", points: 1, type: "multiple_choice", options: ["She suggested going out for dinner.", "She suggested go out for dinner.", "She suggested went out for dinner."] },
  { id: "en_9_q43", text: "Incorrect: If I knew about the problem, I will help you.", instruction: "Find and correct ONE mistake in each sentence.", points: 1, type: "multiple_choice", options: ["If I knew about the problem, I can help you.", "If I knew about the problem, I would help you.", "If I knew about the problem, I had helped you."] },
  { id: "en_9_q44", text: "Incorrect: He said “I am busy” → He said that he is busy.", instruction: "Find and correct ONE mistake in each sentence.", points: 1, type: "multiple_choice", options: ["He said that he was busy.", "He said that he will be busy.", "He said that he has been busy."] },
  { id: "en_9_q45", text: "Incorrect: I didn’t use to liked coffee, but now I do.", instruction: "Find and correct ONE mistake in each sentence.", points: 1, type: "multiple_choice", options: ["I didn’t use to liking coffee, but now I do.", "I didn’t used to like coffee, but now I do.", "I didn’t use to like coffee, but now I do."] }
];

const english_grade_10_11 = [
  { id: "en_10_11_q1", text: "If I ___ earlier, I wouldn’t have missed the train.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["left", "had left", "would leave", "have left"] },
  { id: "en_10_11_q2", text: "By the time we arrived, they ___ dinner.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["finished", "have finished", "had finished", "were finishing"] },
  { id: "en_10_11_q3", text: "She ___ working here for ten years before she finally quit.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["has been", "had been", "was", "is"] },
  { id: "en_10_11_q4", text: "He ___ me he would call, but he didn’t.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["said", "told", "spoke", "talked"] },
  { id: "en_10_11_q5", text: "I’d rather you ___ me the truth.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["tell", "told", "have told", "telling"] },
  { id: "en_10_11_q6", text: "She ___ have forgotten about the meeting — she’s usually very organized.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["must", "might", "can’t", "should"] },
  { id: "en_10_11_q7", text: "The more you practice, the ___ you become.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["better", "best", "good", "well"] },
  { id: "en_10_11_q8", text: "He denied ___ the money.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["to take", "taking", "take", "taken"] },
  { id: "en_10_11_q9", text: "I wish I ___ more time to finish the project.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["have", "had", "will have", "have had"] },
  { id: "en_10_11_q10", text: "She ___ her phone when I saw her.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["was using", "used", "has used", "had used"] },
  { id: "en_10_11_q11", text: "If he ___ harder, he would be more successful now.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["works", "worked", "had worked", "would work"] },
  { id: "en_10_11_q12", text: "He ___ living here since 2015.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["is", "was", "has been", "had been"] },
  { id: "en_10_11_q13", text: "By this time tomorrow, I ___ on the beach.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["will lie", "will be lying", "lie", "am lying"] },
  { id: "en_10_11_q14", text: "Don’t call me at 8 — I ___ dinner then.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["will have", "will be having", "have", "am having"] },
  { id: "en_10_11_q15", text: "If you heat water to 100°C, it ___.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["boils", "will boil", "would boil", "is boiling"] },
  { id: "en_10_11_q16", text: "This book ___ to be one of the best of the year.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["says", "is said", "is saying", "said"] },
  { id: "en_10_11_q17", text: "He ___ his car repaired last week.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["made", "did", "had", "got"] },
  { id: "en_10_11_q18", text: "I’m slowly getting used to ___ up early.", instruction: "Choose the correct answer", points: 1, type: "multiple_choice", options: ["wake", "waking", "woke", "be waking"] },
  { id: "en_10_11_q19", text: "If I [gap] about the problem, I would have helped you.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["knew", "know", "had known"] },
  { id: "en_10_11_q20", text: "She [gap] there for five years before she left.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["worked", "had worked", "has worked"] },
  { id: "en_10_11_q21", text: "I wish I [gap] that yesterday.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["didn't say", "haven't said", "hadn’t said"] },
  { id: "en_10_11_q22", text: "He [gap] his car all morning, so he’s tired now.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["is fixing", "had fixed", "has been fixing"] },
  { id: "en_10_11_q23", text: "By next month, they [gap] the new bridge.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["will build", "will have built", "are building"] },
  { id: "en_10_11_q24", text: "She said she [gap] the report by the next day.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["would finish", "will finish", "finished"] },
  { id: "en_10_11_q25", text: "If I [gap] you, I would accept the offer.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["am", "was", "were"] },
  { id: "en_10_11_q26", text: "They [gap] the task yet.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["didn't complete", "haven’t completed", "aren't completing"] },
  { id: "en_10_11_q27", text: "He admitted [gap] the window.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["breaking", "to break", "broke"] },
  { id: "en_10_11_q28", text: "We [gap] for over two hours when the bus finally arrived.", instruction: "Put the verb in the correct form", points: 1, type: "inline_dropdown", inlineOptions: ["were waiting", "had been waiting", "have waited"] },
  { id: "en_10_11_q29", text: "Incorrect: If I would have known, I would have helped you.", instruction: "Error Correction: Find and correct ONE mistake", points: 1, type: "multiple_choice", options: ["If I knew, I would have helped you.", "If I had known, I would have helped you.", "If I have known, I would have helped you."] },
  { id: "en_10_11_q30", text: "Incorrect: He told me that he will come later.", instruction: "Error Correction: Find and correct ONE mistake", points: 1, type: "multiple_choice", options: ["He told me that he would come later.", "He told me that he comes later.", "He told me that he has come later."] },
  { id: "en_10_11_q31", text: "Incorrect: I have been seeing this film already.", instruction: "Error Correction: Find and correct ONE mistake", points: 1, type: "multiple_choice", options: ["I had seen this film already.", "I have already seen this film.", "I was seeing this film already."] },
  { id: "en_10_11_q32", text: "Incorrect: She suggested to take a break.", instruction: "Error Correction: Find and correct ONE mistake", points: 1, type: "multiple_choice", options: ["She suggested taking a break.", "She suggested take a break.", "She suggested took a break."] },
  { id: "en_10_11_q33", text: "Incorrect: The project was completed by they.", instruction: "Error Correction: Find and correct ONE mistake", points: 1, type: "multiple_choice", options: ["The project was completed by their.", "The project was completed by them.", "The project was completed by theirs."] },
  { id: "en_10_11_q34", text: "Incorrect: I look forward to hear from you.", instruction: "Error Correction: Find and correct ONE mistake", points: 1, type: "multiple_choice", options: ["I look forward to hearing from you.", "I look forward for hear from you.", "I look forward heard from you."] },
  { id: "en_10_11_q35", text: "Many people believe that working from home is more productive. [gap], recent studies suggest the opposite is sometimes true.", instruction: "Complete the text with ONE word in each gap (Clauses of contrast).", points: 1, type: "inline_dropdown", inlineOptions: ["despite", "although", "however", "whereas", "nevertheless", "in spite of", "while"] },
  { id: "en_10_11_q36", text: "[gap] the flexibility it offers, some employees struggle with focus.", instruction: "Complete the text with ONE word in each gap (Clauses of contrast).", points: 1, type: "inline_dropdown", inlineOptions: ["despite", "although", "however", "whereas", "nevertheless", "in spite of", "while"] },
  { id: "en_10_11_q37", text: "[gap], others thrive without office distractions.", instruction: "Complete the text with ONE word in each gap (Clauses of contrast).", points: 1, type: "inline_dropdown", inlineOptions: ["despite", "although", "however", "whereas", "nevertheless", "in spite of", "while"] },
  { id: "en_10_11_q38", text: "[gap] a home environment may suit introverts...", instruction: "Complete the text with ONE word in each gap (Clauses of contrast).", points: 1, type: "inline_dropdown", inlineOptions: ["despite", "although", "however", "whereas", "nevertheless", "in spite of", "while"] },
  { id: "en_10_11_q39", text: "...[gap] extroverts often miss social interaction.", instruction: "Complete the text with ONE word in each gap (Clauses of contrast).", points: 1, type: "inline_dropdown", inlineOptions: ["despite", "although", "however", "whereas", "nevertheless", "in spite of", "while"] },
  { id: "en_10_11_q40", text: "[gap] these differences, most companies now adopt hybrid models.", instruction: "Complete the text with ONE word in each gap (Clauses of contrast).", points: 1, type: "inline_dropdown", inlineOptions: ["despite", "although", "however", "whereas", "nevertheless", "in spite of", "while"] },
  { id: "en_10_11_q41", text: "for / been / has / she / looking / job / a / months / six / for", instruction: "Reordering: Put the words in the correct order to make a grammatical sentence.", points: 1, type: "drag_and_drop", dragItems: ["for", "been", "has", "she", "looking", "job", "a", "months", "six", "for"] },
  { id: "en_10_11_q42", text: "remember / I / lock / door / the / to / before / leaving", instruction: "Reordering: Put the words in the correct order to make a grammatical sentence.", points: 1, type: "drag_and_drop", dragItems: ["remember", "I", "lock", "door", "the", "to", "before", "leaving"] },
  { id: "en_10_11_q43", text: "at / would / I / rather / home / stay / than / go / out", instruction: "Reordering: Put the words in the correct order to make a grammatical sentence.", points: 1, type: "drag_and_drop", dragItems: ["at", "would", "I", "rather", "home", "stay", "than", "go", "out"] },
  { id: "en_10_11_q44", text: "the / despite / rain / heavy / went / they / out", instruction: "Reordering: Put the words in the correct order to make a grammatical sentence.", points: 1, type: "drag_and_drop", dragItems: ["the", "despite", "rain", "heavy", "went", "they", "out"] },
  { id: "en_10_11_q45", text: "try / button / pressing / this / to / see / if / works / it", instruction: "Reordering: Put the words in the correct order to make a grammatical sentence.", points: 1, type: "drag_and_drop", dragItems: ["try", "button", "pressing", "this", "to", "see", "if", "works", "it"] }
];

async function updateLogicAndEnglish() {
  console.log("🚀 Seeding logic & english questions across all grades in Firestore...");

  const grades = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  for (const grade of grades) {
    let engList = [];
    if (grade === 8) engList = english_grade_8;
    else if (grade === 9) engList = english_grade_9;
    else if (grade >= 10) engList = english_grade_10_11;
    else engList = english_grade_8; // default fallback for lower grades if taken

    const docRef = db.collection("tests").doc(`test_grade_${grade}`);
    const keyRef = db.collection("test_answer_keys").doc(`test_grade_${grade}`);

    const existingSnap = await docRef.get();
    let currentQuestions = existingSnap.exists ? (existingSnap.data().questions || {}) : {};

    currentQuestions.logic = commonLogicQuestions;
    currentQuestions.english = engList;

    await docRef.set({
      questions: currentQuestions,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Also update candidate alias docs (e.g., test_grade_7_org_future_leaders and 7)
    await db.collection("tests").doc(`test_grade_${grade}_${TENANT_ID}`).set({ questions: currentQuestions }, { merge: true });
    await db.collection("tests").doc(`${grade}`).set({ questions: currentQuestions }, { merge: true });

    // Update keys
    const existingKeySnap = await keyRef.get();
    let currentKeys = existingKeySnap.exists ? (existingKeySnap.data().keys || {}) : {};
    currentKeys.logic = logicKeys;
    
    await keyRef.set({
      keys: currentKeys,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await db.collection("test_answer_keys").doc(`test_grade_${grade}_${TENANT_ID}`).set({ keys: currentKeys }, { merge: true });
    await db.collection("test_answer_keys").doc(`${grade}`).set({ keys: currentKeys }, { merge: true });
  }

  console.log("✅ Successfully updated Logic & English questions and keys for all grades in Firestore!");
  process.exit(0);
}

updateLogicAndEnglish().catch(err => {
  console.error("Error seeding logic/english:", err);
  process.exit(1);
});
