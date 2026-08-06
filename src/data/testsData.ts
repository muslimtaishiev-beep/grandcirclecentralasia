import { TestData, Question } from "../types";
const commonLogicQuestions: Question[] = [
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


const english_grade_8: Question[] = [
  {
    id: "en_8_q1",
    text: "She ___ to school every day.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["go", "goes", "going", "went"]
  },
  {
    id: "en_8_q2",
    text: "We ___ TV when you called.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["watched", "were watching", "watch", "watching"]
  },
  {
    id: "en_8_q3",
    text: "I ___ never ___ sushi before.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["did / eat", "have / eaten", "am / eating", "was / eating"]
  },
  {
    id: "en_8_q4",
    text: "They ___ in this city since 2020.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["live", "lived", "have lived", "living"]
  },
  {
    id: "en_8_q5",
    text: "There ___ any milk in the fridge.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["isn’t", "aren’t", "don’t", "doesn’t"]
  },
  {
    id: "en_8_q6",
    text: "He is ___ than his brother.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["tall", "taller", "tallest", "more tall"]
  },
  {
    id: "en_8_q7",
    text: "You ___ smoke here. It’s forbidden.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["must", "mustn’t", "can", "should"]
  },
  {
    id: "en_8_q8",
    text: "I ___ go to the party tonight. I’m not sure.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["must", "might", "can’t", "should"]
  },
  {
    id: "en_8_q9",
    text: "She ___ her homework yesterday.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["didn’t do", "doesn’t do", "isn’t doing", "hasn’t do"]
  },
  {
    id: "en_8_q10",
    text: "This is ___ book I’ve ever read.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["good", "better", "the best", "more good"]
  },
  {
    id: "en_8_q11",
    text: "I usually [gap] at 7 a.m.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["wake up", "woke up", "am waking up"]
  },
  {
    id: "en_8_q12",
    text: "She [gap] coffee.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["doesn’t like", "don't like", "didn't liked"]
  },
  {
    id: "en_8_q13",
    text: "We [gap] our grandparents last weekend.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["visit", "visited", "have visited"]
  },
  {
    id: "en_8_q14",
    text: "They [gap] football now.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["play", "played", "are playing"]
  },
  {
    id: "en_8_q15",
    text: "He [gap] his work.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["has already finished", "already finished", "is already finishing"]
  },
  {
    id: "en_8_q16",
    text: "I [gap] to London.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["have never been", "never was", "am never being"]
  },
  {
    id: "en_8_q17",
    text: "She [gap] when I called her.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["studied", "was studying", "is studying"]
  },
  {
    id: "en_8_q18",
    text: "We [gap] to the cinema tomorrow.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["went", "go", "are going"]
  },
  {
    id: "en_8_q19",
    text: "He [gap] the question.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["doesn’t understand", "isn't understanding", "don't understand"]
  },
  {
    id: "en_8_q20",
    text: "They [gap] here for five years.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["live", "are living", "have lived"]
  },
  {
    id: "en_8_q21",
    text: "I’m afraid [gap] spiders.",
    instruction: "Fill in the gaps with the correct preposition or quantifier",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"]
  },
  {
    id: "en_8_q22",
    text: "She is interested [gap] music.",
    instruction: "Fill in the gaps with the correct preposition or quantifier",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"]
  },
  {
    id: "en_8_q23",
    text: "We arrived [gap] the airport at 6 p.m.",
    instruction: "Fill in the gaps with the correct preposition or quantifier",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"]
  },
  {
    id: "en_8_q24",
    text: "He’s good [gap] maths.",
    instruction: "Fill in the gaps with the correct preposition or quantifier",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"]
  },
  {
    id: "en_8_q25",
    text: "I usually go to bed [gap] midnight.",
    instruction: "Fill in the gaps with the correct preposition or quantifier",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"]
  },
  {
    id: "en_8_q26",
    text: "There isn’t [gap] sugar left.",
    instruction: "Fill in the gaps with the correct preposition or quantifier",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"]
  },
  {
    id: "en_8_q27",
    text: "How [gap] money do you need?",
    instruction: "Fill in the gaps with the correct preposition or quantifier",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"]
  },
  {
    id: "en_8_q28",
    text: "This bag is [gap] heavy for me.",
    instruction: "Fill in the gaps with the correct preposition or quantifier",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"]
  },
  {
    id: "en_8_q29",
    text: "I don’t have [gap] friends here.",
    instruction: "Fill in the gaps with the correct preposition or quantifier",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"]
  },
  {
    id: "en_8_q30",
    text: "She’s the [gap] intelligent student in the class.",
    instruction: "Fill in the gaps with the correct preposition or quantifier",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"]
  },
  {
    id: "en_8_q31",
    text: "This test is [gap] than the last one.",
    instruction: "Comparatives & Superlatives",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["easier", "more easy", "the easiest"]
  },
  {
    id: "en_8_q32",
    text: "Who is [gap] student in your class?",
    instruction: "Comparatives & Superlatives",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["the tallest", "tallest", "taller"]
  },
  {
    id: "en_8_q33",
    text: "My room is [gap] than yours.",
    instruction: "Comparatives & Superlatives",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["smaller", "more small", "the smallest"]
  },
  {
    id: "en_8_q34",
    text: "That’s [gap] pizza I’ve ever eaten.",
    instruction: "Comparatives & Superlatives",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["worse", "the worst", "baddest"]
  },
  {
    id: "en_8_q35",
    text: "English is [gap] than Maths for me.",
    instruction: "Comparatives & Superlatives",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["more interesting", "most interesting", "interestinger"]
  },
  {
    id: "en_8_q36",
    text: "Incorrect: They didn’t went to the party.",
    instruction: "Find and correct the mistake. Choose the correct sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["They don't went to the party.", "They didn't go to the party.", "They didn't goes to the party."]
  },
  {
    id: "en_8_q37",
    text: "Incorrect: There is many people in the room.",
    instruction: "Find and correct the mistake. Choose the correct sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["There are many people in the room.", "There is much people in the room.", "There was many people in the room."]
  },
  {
    id: "en_8_q38",
    text: "Incorrect: I have seen him yesterday.",
    instruction: "Find and correct the mistake. Choose the correct sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["I see him yesterday.", "I saw him yesterday.", "I had seen him yesterday."]
  },
  {
    id: "en_8_q39",
    text: "Incorrect: She can to drive a car.",
    instruction: "Find and correct the mistake. Choose the correct sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["She can drive a car.", "She cans drive a car.", "She can driving a car."]
  },
  {
    id: "en_8_q40",
    text: "Incorrect: We are agree with you.",
    instruction: "Find and correct the mistake. Choose the correct sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["We agreeing with you.", "We is agree with you.", "We agree with you."]
  },
];

const english_grade_9: Question[] = [
  {
    id: "en_9_q1",
    text: "If I ___ more time, I would learn another language.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["have", "had", "will have", "would have"]
  },
  {
    id: "en_9_q2",
    text: "She ___ working here for five years before she moved abroad.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["has been", "had been", "was", "is"]
  },
  {
    id: "en_9_q3",
    text: "He told me he ___ me later.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["calls", "called", "would call", "will call"]
  },
  {
    id: "en_9_q4",
    text: "This house ___ in the 18th century.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["built", "was built", "is building", "has build"]
  },
  {
    id: "en_9_q5",
    text: "She ___ to the gym regularly these days.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["goes", "is going", "go", "went"]
  },
  {
    id: "en_9_q6",
    text: "I ___ my keys. I can’t find them anywhere.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["lose", "lost", "have lost", "had lost"]
  },
  {
    id: "en_9_q7",
    text: "That’s the man ___ car was stolen.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["who", "which", "whose", "that"]
  },
  {
    id: "en_9_q8",
    text: "If it ___ tomorrow, we will stay at home.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["rains", "will rain", "raining", "rained"]
  },
  {
    id: "en_9_q9",
    text: "When I arrived, they ___ already ___.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["have / left", "had / left", "did / leave", "were / leaving"]
  },
  {
    id: "en_9_q10",
    text: "If I ___ harder, I would have got a promotion.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["work", "worked", "had worked", "have worked"]
  },
  {
    id: "en_9_q11",
    text: "I’m really looking forward [gap] my vacation.",
    instruction: "Fill in the gaps with the correct preposition",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"]
  },
  {
    id: "en_9_q12",
    text: "She apologized [gap] being late.",
    instruction: "Fill in the gaps with the correct preposition",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"]
  },
  {
    id: "en_9_q13",
    text: "He insisted [gap] paying for dinner.",
    instruction: "Fill in the gaps with the correct preposition",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"]
  },
  {
    id: "en_9_q14",
    text: "I’m not used [gap] getting up early.",
    instruction: "Fill in the gaps with the correct preposition",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"]
  },
  {
    id: "en_9_q15",
    text: "This exercise is different [gap] the previous one.",
    instruction: "Fill in the gaps with the correct preposition",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"]
  },
  {
    id: "en_9_q16",
    text: "We ran out [gap] milk.",
    instruction: "Fill in the gaps with the correct preposition",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"]
  },
  {
    id: "en_9_q17",
    text: "She’s afraid [gap] losing her job.",
    instruction: "Fill in the gaps with the correct preposition",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"]
  },
  {
    id: "en_9_q18",
    text: "He succeeded [gap] passing the exam.",
    instruction: "Fill in the gaps with the correct preposition",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"]
  },
  {
    id: "en_9_q19",
    text: "I’m interested [gap] improving my English.",
    instruction: "Fill in the gaps with the correct preposition",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"]
  },
  {
    id: "en_9_q20",
    text: "There’s no point [gap] arguing.",
    instruction: "Fill in the gaps with the correct preposition",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"]
  },
  {
    id: "en_9_q21",
    text: "I [gap] for you for over an hour!",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["wait", "have been waiting", "was waiting"]
  },
  {
    id: "en_9_q22",
    text: "She [gap] when the phone rang.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["worked", "was working", "has worked"]
  },
  {
    id: "en_9_q23",
    text: "They [gap] the project yet.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["didn't finish", "haven't finished", "aren't finishing"]
  },
  {
    id: "en_9_q24",
    text: "He said he [gap] later.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["will come", "would come", "comes"]
  },
  {
    id: "en_9_q25",
    text: "If I [gap] you, I wouldn’t do that.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["am", "was", "were"]
  },
  {
    id: "en_9_q26",
    text: "We [gap] when they arrived.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["already ate", "had already eaten", "were already eating"]
  },
  {
    id: "en_9_q27",
    text: "This book [gap] by a famous author.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["was written", "wrote", "is writing"]
  },
  {
    id: "en_9_q28",
    text: "She [gap] to improve her English recently.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["tries", "has been trying", "was trying"]
  },
  {
    id: "en_9_q29",
    text: "She [gap] speak three languages when she was 10.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["can", "was able to", "could to"]
  },
  {
    id: "en_9_q30",
    text: "They [gap] football when it started to rain.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["played", "were playing", "have played"]
  },
  {
    id: "en_9_q31",
    text: "You [gap] smoke here. It’s prohibited.",
    instruction: "Complete the sentences with the correct modal verb",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["can", "could", "must", "mustn't", "might", "should", "have to"]
  },
  {
    id: "en_9_q32",
    text: "I’m not sure, but she [gap] be at home – let’s call her.",
    instruction: "Complete the sentences with the correct modal verb",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["can", "could", "must", "mustn't", "might", "should", "have to"]
  },
  {
    id: "en_9_q33",
    text: "You look tired. You [gap] take a break.",
    instruction: "Complete the sentences with the correct modal verb",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["can", "could", "must", "mustn't", "might", "should", "have to"]
  },
  {
    id: "en_9_q34",
    text: "He [gap] speak three languages when he was five years old.",
    instruction: "Complete the sentences with the correct modal verb",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["can", "could", "must", "mustn't", "might", "should", "have to"]
  },
  {
    id: "en_9_q35",
    text: "In England, you [gap] drive on the left.",
    instruction: "Complete the sentences with the correct modal verb",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["can", "could", "must", "mustn't", "might", "should", "have to"]
  },
  {
    id: "en_9_q36",
    text: "Incorrect: She don’t enjoy watching TV in the evening.",
    instruction: "Find and correct ONE mistake in each sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["She aren't enjoy watching TV in the evening.", "She doesn't enjoy watching TV in the evening.", "She hasn't enjoy watching TV in the evening."]
  },
  {
    id: "en_9_q37",
    text: "Incorrect: I have seen him yesterday at the cinema.",
    instruction: "Find and correct ONE mistake in each sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["I saw him yesterday at the cinema.", "I had seen him yesterday at the cinema.", "I was seeing him yesterday at the cinema."]
  },
  {
    id: "en_9_q38",
    text: "Incorrect: He was drive when the accident happened.",
    instruction: "Find and correct ONE mistake in each sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["He was driven when the accident happened.", "He was driving when the accident happened.", "He driving when the accident happened."]
  },
  {
    id: "en_9_q39",
    text: "Incorrect: We didn’t went to school yesterday.",
    instruction: "Find and correct ONE mistake in each sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["We didn't go to school yesterday.", "We don't went to school yesterday.", "We didn't goes to school yesterday."]
  },
  {
    id: "en_9_q40",
    text: "Incorrect: They have been know each other for years.",
    instruction: "Find and correct ONE mistake in each sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["They have known each other for years.", "They have knowing each other for years.", "They knowed each other for years."]
  },
  {
    id: "en_9_q41",
    text: "Incorrect: If I will see her, I will tell her.",
    instruction: "Find and correct ONE mistake in each sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["If I saw her, I will tell her.", "If I seeing her, I will tell her.", "If I see her, I will tell her."]
  },
  {
    id: "en_9_q42",
    text: "Incorrect: She suggested to go out for dinner.",
    instruction: "Find and correct ONE mistake in each sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["She suggested going out for dinner.", "She suggested go out for dinner.", "She suggested went out for dinner."]
  },
  {
    id: "en_9_q43",
    text: "Incorrect: If I knew about the problem, I will help you.",
    instruction: "Find and correct ONE mistake in each sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["If I knew about the problem, I can help you.", "If I knew about the problem, I would help you.", "If I knew about the problem, I had helped you."]
  },
  {
    id: "en_9_q44",
    text: "Incorrect: He said “I am busy” → He said that he is busy.",
    instruction: "Find and correct ONE mistake in each sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["He said that he was busy.", "He said that he will be busy.", "He said that he has been busy."]
  },
  {
    id: "en_9_q45",
    text: "Incorrect: I didn’t use to liked coffee, but now I do.",
    instruction: "Find and correct ONE mistake in each sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["I didn’t use to liking coffee, but now I do.", "I didn’t used to like coffee, but now I do.", "I didn’t use to like coffee, but now I do."]
  },
];

const english_grade_10_11: Question[] = [
  {
    id: "en_10_11_q1",
    text: "If I ___ earlier, I wouldn’t have missed the train.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["left", "had left", "would leave", "have left"]
  },
  {
    id: "en_10_11_q2",
    text: "By the time we arrived, they ___ dinner.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["finished", "have finished", "had finished", "were finishing"]
  },
  {
    id: "en_10_11_q3",
    text: "She ___ working here for ten years before she finally quit.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["has been", "had been", "was", "is"]
  },
  {
    id: "en_10_11_q4",
    text: "He ___ me he would call, but he didn’t.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["said", "told", "spoke", "talked"]
  },
  {
    id: "en_10_11_q5",
    text: "I’d rather you ___ me the truth.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["tell", "told", "have told", "telling"]
  },
  {
    id: "en_10_11_q6",
    text: "She ___ have forgotten about the meeting — she’s usually very organized.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["must", "might", "can’t", "should"]
  },
  {
    id: "en_10_11_q7",
    text: "The more you practice, the ___ you become.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["better", "best", "good", "well"]
  },
  {
    id: "en_10_11_q8",
    text: "He denied ___ the money.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["to take", "taking", "take", "taken"]
  },
  {
    id: "en_10_11_q9",
    text: "I wish I ___ more time to finish the project.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["have", "had", "will have", "have had"]
  },
  {
    id: "en_10_11_q10",
    text: "She ___ her phone when I saw her.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["was using", "used", "has used", "had used"]
  },
  {
    id: "en_10_11_q11",
    text: "If he ___ harder, he would be more successful now.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["works", "worked", "had worked", "would work"]
  },
  {
    id: "en_10_11_q12",
    text: "He ___ living here since 2015.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["is", "was", "has been", "had been"]
  },
  {
    id: "en_10_11_q13",
    text: "By this time tomorrow, I ___ on the beach.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["will lie", "will be lying", "lie", "am lying"]
  },
  {
    id: "en_10_11_q14",
    text: "Don’t call me at 8 — I ___ dinner then.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["will have", "will be having", "have", "am having"]
  },
  {
    id: "en_10_11_q15",
    text: "If you heat water to 100°C, it ___.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["boils", "will boil", "would boil", "is boiling"]
  },
  {
    id: "en_10_11_q16",
    text: "This book ___ to be one of the best of the year.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["says", "is said", "is saying", "said"]
  },
  {
    id: "en_10_11_q17",
    text: "He ___ his car repaired last week.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["made", "did", "had", "got"]
  },
  {
    id: "en_10_11_q18",
    text: "I’m slowly getting used to ___ up early.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["wake", "waking", "woke", "be waking"]
  },
  {
    id: "en_10_11_q19",
    text: "If I [gap] about the problem, I would have helped you.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["knew", "know", "had known"]
  },
  {
    id: "en_10_11_q20",
    text: "She [gap] there for five years before she left.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["worked", "had worked", "has worked"]
  },
  {
    id: "en_10_11_q21",
    text: "I wish I [gap] that yesterday.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["didn't say", "haven't said", "hadn’t said"]
  },
  {
    id: "en_10_11_q22",
    text: "He [gap] his car all morning, so he’s tired now.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["is fixing", "had fixed", "has been fixing"]
  },
  {
    id: "en_10_11_q23",
    text: "By next month, they [gap] the new bridge.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["will build", "will have built", "are building"]
  },
  {
    id: "en_10_11_q24",
    text: "She said she [gap] the report by the next day.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["would finish", "will finish", "finished"]
  },
  {
    id: "en_10_11_q25",
    text: "If I [gap] you, I would accept the offer.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["am", "was", "were"]
  },
  {
    id: "en_10_11_q26",
    text: "They [gap] the task yet.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["didn't complete", "haven’t completed", "aren't completing"]
  },
  {
    id: "en_10_11_q27",
    text: "He admitted [gap] the window.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["breaking", "to break", "broke"]
  },
  {
    id: "en_10_11_q28",
    text: "We [gap] for over two hours when the bus finally arrived.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["were waiting", "had been waiting", "have waited"]
  },
  {
    id: "en_10_11_q29",
    text: "Incorrect: If I would have known, I would have helped you.",
    instruction: "Error Correction: Find and correct ONE mistake",
    points: 1,
    type: "multiple_choice",
    options: ["If I knew, I would have helped you.", "If I had known, I would have helped you.", "If I have known, I would have helped you."]
  },
  {
    id: "en_10_11_q30",
    text: "Incorrect: He told me that he will come later.",
    instruction: "Error Correction: Find and correct ONE mistake",
    points: 1,
    type: "multiple_choice",
    options: ["He told me that he would come later.", "He told me that he comes later.", "He told me that he has come later."]
  },
  {
    id: "en_10_11_q31",
    text: "Incorrect: I have been seeing this film already.",
    instruction: "Error Correction: Find and correct ONE mistake",
    points: 1,
    type: "multiple_choice",
    options: ["I had seen this film already.", "I have already seen this film.", "I was seeing this film already."]
  },
  {
    id: "en_10_11_q32",
    text: "Incorrect: She suggested to take a break.",
    instruction: "Error Correction: Find and correct ONE mistake",
    points: 1,
    type: "multiple_choice",
    options: ["She suggested taking a break.", "She suggested take a break.", "She suggested took a break."]
  },
  {
    id: "en_10_11_q33",
    text: "Incorrect: The project was completed by they.",
    instruction: "Error Correction: Find and correct ONE mistake",
    points: 1,
    type: "multiple_choice",
    options: ["The project was completed by their.", "The project was completed by them.", "The project was completed by theirs."]
  },
  {
    id: "en_10_11_q34",
    text: "Incorrect: I look forward to hear from you.",
    instruction: "Error Correction: Find and correct ONE mistake",
    points: 1,
    type: "multiple_choice",
    options: ["I look forward to hearing from you.", "I look forward for hear from you.", "I look forward heard from you."]
  },
  {
    id: "en_10_11_q35",
    text: "Many people believe that working from home is more productive. [gap], recent studies suggest the opposite is sometimes true.",
    instruction: "Complete the text with ONE word in each gap (Clauses of contrast).",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["despite", "although", "however", "whereas", "nevertheless", "in spite of", "while"]
  },
  {
    id: "en_10_11_q36",
    text: "[gap] the flexibility it offers, some employees struggle with focus.",
    instruction: "Complete the text with ONE word in each gap (Clauses of contrast).",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["despite", "although", "however", "whereas", "nevertheless", "in spite of", "while"]
  },
  {
    id: "en_10_11_q37",
    text: "[gap], others thrive without office distractions.",
    instruction: "Complete the text with ONE word in each gap (Clauses of contrast).",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["despite", "although", "however", "whereas", "nevertheless", "in spite of", "while"]
  },
  {
    id: "en_10_11_q38",
    text: "[gap] a home environment may suit introverts...",
    instruction: "Complete the text with ONE word in each gap (Clauses of contrast).",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["despite", "although", "however", "whereas", "nevertheless", "in spite of", "while"]
  },
  {
    id: "en_10_11_q39",
    text: "...[gap] extroverts often miss social interaction.",
    instruction: "Complete the text with ONE word in each gap (Clauses of contrast).",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["despite", "although", "however", "whereas", "nevertheless", "in spite of", "while"]
  },
  {
    id: "en_10_11_q40",
    text: "[gap] these differences, most companies now adopt hybrid models.",
    instruction: "Complete the text with ONE word in each gap (Clauses of contrast).",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["despite", "although", "however", "whereas", "nevertheless", "in spite of", "while"]
  },
  {
    id: "en_10_11_q41",
    text: "for / been / has / she / looking / job / a / months / six / for",
    instruction: "Reordering: Put the words in the correct order to make a grammatical sentence.",
    points: 1,
    type: "drag_and_drop",
    dragItems: ["for", "been", "has", "she", "looking", "job", "a", "months", "six", "for "]
  },
  {
    id: "en_10_11_q42",
    text: "remember / I / lock / door / the / to / before / leaving",
    instruction: "Reordering: Put the words in the correct order to make a grammatical sentence.",
    points: 1,
    type: "drag_and_drop",
    dragItems: ["remember", "I", "lock", "door", "the", "to", "before", "leaving"]
  },
  {
    id: "en_10_11_q43",
    text: "at / would / I / rather / home / stay / than / go / out",
    instruction: "Reordering: Put the words in the correct order to make a grammatical sentence.",
    points: 1,
    type: "drag_and_drop",
    dragItems: ["at", "would", "I", "rather", "home", "stay", "than", "go", "out"]
  },
  {
    id: "en_10_11_q44",
    text: "the / despite / rain / heavy / went / they / out",
    instruction: "Reordering: Put the words in the correct order to make a grammatical sentence.",
    points: 1,
    type: "drag_and_drop",
    dragItems: ["the", "despite", "rain", "heavy", "went", "they", "out"]
  },
  {
    id: "en_10_11_q45",
    text: "try / button / pressing / this / to / see / if / works / it",
    instruction: "Reordering: Put the words in the correct order to make a grammatical sentence.",
    points: 1,
    type: "drag_and_drop",
    dragItems: ["try", "button", "pressing", "this", "to", "see", "if", "works", "it"]
  },
];

export const testsData: Record<number, TestData> = {
  "7": {
    grade: 7,
    english: [],
    russian: [
{
        id: "russian_1",
        type: "multiple_choice",
        points: 1,
        text: "Задание №1. Найди предложение, в котором есть фразеологизм:",
        options: [
          "Мы не могли распутать этот узел на веревке, пришлось его разрубить.",
          "Первая скрипка, которую подарили в детстве родители, хранится у меня и сегодня.",
          "Гвоздем программы было выступление известного актера.",
          "Он запустил руку в мешок и вытащил оттуда зайчонка.",
        ],
      },
{
        id: "russian_2",
        type: "multiple_choice",
        points: 1,
        text: "Задание №2. Какое слово образовано приставочным способом?",
        options: ["Заплыв", "Безрукавка", "Бесполезный", "Водный"],
      },
{
        id: "russian_3",
        type: "multiple_choice",
        points: 1,
        text: "Задание №3. В каком варианте ответа в обоих словах пропущена буква О?",
        options: [
          "бельч…нок, ш…пот",
          "ч…рный, морозц…м",
          "крыж…вник, вещ…вой",
          "девч…нка, плащ…м",
        ],
      },
{
        id: "russian_4",
        type: "multiple_choice",
        points: 1,
        text: "Задание №4. Со всеми словами какого ряда НЕ пишется слитно?",
        options: [
          "(не) решительность, (не) подвижная вода",
          "явная (не) лепица, (не)знаю ответа",
          "вовсе (не) трудная задача, (не) высокие горы",
          "(не) внимателен, а рассеян, погода (не) летняя",
        ],
      },
{
        id: "russian_5",
        type: "multiple_choice",
        points: 1,
        text: "Задание №5. В каком ряду во всех словах пропущена одна и та же буква?",
        options: [
          "Пр...морье, пр…мудрый, пр…милый",
          "Пр…паять, пр…обрести, пр…усадебный",
          "Пр…брежный, пр…забавный, пр…неприятный",
          "Пр...клеить, пр…одолеть, пр…лечь",
        ],
      },
{
        id: "russian_6",
        type: "multiple_choice",
        points: 1,
        text: "Задание №6. Укажите предложение с ошибкой в употреблении числительного:",
        options: [
          "Нет с собой девятисот рублей.",
          "Я встретил троих друзей.",
          "Мы живем в триста двенадцатой квартире.",
          "К четырехстам прибавить пятьдесят.",
        ],
      },
{
        id: "ru_7_new",
        type: "dropdown_multiple",
        points: 1,
        text: "Задание №7. Соотнесите языковые термины с их функцией (категорией).",
        dropdownItems: [
          { label: "Прилагательное", options: ["Часть речи", "Член предложения"] },
          { label: "Сказуемое", options: ["Часть речи", "Член предложения"] },
          { label: "Союз", options: ["Часть речи", "Член предложения"] },
          { label: "Определение", options: ["Часть речи", "Член предложения"] },
          { label: "Существительное", options: ["Часть речи", "Член предложения"] }
        ]
      },
{
        id: "russian_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №8. Отметьте, где знаки расставлены ВЕРНО:",
        options: [
          "Из-под этой тучи вырвались яркие лучи, и мокрые леса и поля засверкали.",
          "Из-под этой тучи вырвались яркие лучи, и мокрые леса, и поля засверкали.",
          "Из-под этой тучи вырвались яркие лучи и мокрые леса, и поля засверкали.",
        ],
      },
{
        id: "ru_9",
        type: "multiple_choice",
        points: 1,
        text: "Задание №9. Найдите предложение, в котором есть фразеологизм.",
        options: [
          "Мы не могли распутать этот узел на веревке, пришлось его разрубить.",
          "Первая скрипка, которую подарили в детстве родители, хранится у меня и сегодня.",
          "Гвоздем программы было выступление известного актера.",
          "Он запустил руку в мешок и вытащил оттуда зайчонка."
        ]
      },
{
        id: "ru_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №10. Укажите верное толкование слова ПУНКТУАЛЬНЫЙ:",
        options: ["Местный", "Аккуратный, точный", "Медлительный", "Безвестный"]
      },
{
        id: "ru_11",
        type: "multiple_choice",
        points: 1,
        text: "Задание №11. Укажите предложение с ошибкой в употреблении числительного:",
        options: [
          "Нет с собой девятисот рублей.",
          "Я встретил троих друзей.",
          "Мы живем в триста двенадцатой квартире.",
          "К четырехстам прибавить пятьдесят."
        ]
      },
{
        id: "ru_12",
        type: "multiple_choice",
        points: 1,
        text: "Задание №12. В каком варианте указаны все слова, которые пишутся через дефис?",
        options: [
          "(восточно)европейский, горько(соленый), (кое)с чем",
          "(желто)зеленый, (темно)волосый, (западно)сибирский",
          "(древне)русский, (железно)дорожный, (официально)деловой",
          "какой(либо), (шахматно)шашечный, ярко(красный)"
        ]
      },
{
        id: "ru_13",
        type: "multiple_choice",
        points: 1,
        text: "Задание №13. Отметьте вариант, где знаки препинания расставлены ВЕРНО:",
        options: [
          "Из-под этой тучи вырвались яркие лучи, и мокрые леса и поля засверкали.",
          "Из-под этой тучи вырвались яркие лучи, и мокрые леса, и поля засверкали.",
          "Из-под этой тучи вырвались яркие лучи и мокрые леса, и поля засверкали."
        ]
      }
    ],
    math: [

      {
        id: "ma_3_new",
        type: "multiple_choice",
        points: 1,
        text: "Задание №3. Чему равна разность чисел 15/7 и 20/3?",
        html: "Чему равна разность чисел <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 4px;'><span style='border-bottom:1px solid currentColor;'>15</span><span>7</span></span> и <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 4px;'><span style='border-bottom:1px solid currentColor;'>20</span><span>3</span></span> ?",
        options: ["35/10", "60/19", "5/4", "60/37"]
      },
      {
        id: "math_1",
        type: "multiple_choice",
        points: 1,
        text: "Задание №1. Разложение числа 42 на простые множители имеет вид.",
        options: ["4·2·7", "2∙3∙7", "2∙2∙3∙7", "6∙7"],
      },
      {
        id: "math_2",
        type: "multiple_choice",
        points: 1,
        text: "Задание №2. Какое из чисел делится на 5?",
        options: ["121333", "133050", "411148", "555554"],
      },
      {
        id: "math_3",
        type: "free_text",
        points: 1,
        text: "Задание №3. Чему равна разность чисел 7/15 и 3/20? (Исправлено по дополнению)",
      },
      {
        id: "math_4",
        type: "multiple_choice",
        points: 1,
        text: "Задание №4. Сколько натуральных чисел расположено на координатной прямой между числами −4 и 5?",
        options: ["4", "5", "6", "9"],
      },
      {
        id: "math_5",
        type: "free_text",
        points: 1,
        text: "Задание №5. Вычислите 4 - 1(2/3). (Исправлено по дополнению)",
      },
      {
        id: "math_6",
        type: "multiple_choice",
        points: 1,
        text: "Задание №6. Найдите одну восьмую часть от числа 32000.",
        options: ["300", "4000", "40", "1600"],
      },
      {
        id: "math_7",
        type: "multiple_choice",
        points: 1,
        text: "Задание №7. Сравни и поставь знак: 8м 6дм 4см – 763 см … 8м – 6м 98см",
        options: ["Больше", "Меньше", "Равно"],
      },
      {
        id: "math_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №8. Решением какого уравнения является число 9?",
        options: ["96 – Х = 85", "63 : Х = 7", "Х + 8 = 16"],
      },
      {
        id: "math_9",
        type: "multiple_choice",
        points: 1,
        text: "Задание №9. Найдите площадь квадрата, если его периметр равен периметру прямоугольника со сторонами 16 см и 4 см.",
        options: ["300 см²", "100 см²", "200 см²", "400 см²"],
      },
      {
        id: "math_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №10. Из двух городов навстречу друг другу выехали две машины. Скорость первой – 60 км/ч, скорость второй – 80 км/ч. Через сколько часов машины встретятся, если расстояние между городами 280 км?",
        options: ["1 час", "3 часа", "30 мин", "2 часа"],
      },
      {
        id: "math_11",
        type: "multiple_choice",
        points: 1,
        text: "Задание №11. В ателье привезли 320 метров ткани. Из этой ткани сшили 28 блузок, расходуя на каждую по 3 метра. Из остальной ткани сшили рубашки, расходуя на каждую по 4 метра. Сколько рубашек сшили?",
        options: ["39", "49", "59", "69"],
      },
    ],
    logic: commonLogicQuestions,
  },
  "8": {
    grade: 8,
    english: english_grade_8,
    russian: [
{
        id: "russian_1",
        type: "multiple_choice",
        points: 1,
        text: "Задание №1. Укажите словосочетание со страдательным причастием",
        options: [
          "Расколотый орех",
          "Игравший ребенок",
          "Колющий предмет",
          "Согнувший ветку",
        ],
      },
{
        id: "russian_2",
        type: "multiple_choice",
        points: 1,
        text: "Задание №2. Укажите словосочетание с деепричастием совершенного вида",
        options: [
          "Написанное письмо",
          "Зная о проблеме",
          "Найду ошибки",
          "Купив продукты",
        ],
      },
{
        id: "russian_3",
        type: "multiple_choice",
        points: 1,
        text: "Задание №3. Укажите причастие с суффиксом –АЩ-(-ЯЩ-)",
        options: [
          "Бре…щийся мужчина",
          "Плещ…щиеся волны",
          "Стро…щийся дом",
          "Реша…щий вопрос",
        ],
      },
{
        id: "russian_4",
        type: "multiple_choice",
        points: 1,
        text: "Задание №4. Укажите причастие с суффиксом –ИМ-.",
        options: [
          "Гоня…мые по полю",
          "Вид…мый свет",
          "Выполня…мые задания",
          "Заполня…мые бланки",
        ],
      },
{
        id: "russian_5",
        type: "multiple_choice",
        points: 1,
        text: "Задание №5. Укажите слово с орфографической ошибкой.",
        options: ["Построенный", "Обидев", "Растаив", "Запаянный"],
      },
{
        id: "russian_6",
        type: "multiple_choice",
        points: 1,
        text: "Задание №6. Отметьте ряд, в котором все слова пишутся с одной Н.",
        options: [
          "Распиле….ые дрова, пуга….ая ворона",
          "Неглаже….ое белье, избалова….ый ребенок",
          "Стриже….ый мамой, глиня….ая ваза",
          "Кова….ый сундук, картошка пожаре….а",
        ],
      },
{
        id: "russian_7",
        type: "multiple_choice",
        points: 1,
        text: "Задание №7. НЕ пишется раздельно",
        options: [
          "(не) навидящий ложь",
          "(не) смолкающие разговоры",
          "(не) закрыв дверь",
          "(не) греющее солнце",
        ],
      },
{
        id: "ru_8_new",
        type: "multiple_choice",
        points: 1,
        text: "Задание №8. Укажите номер предложения, в котором правильно расставлены знаки препинания:",
        options: [
          "1) Усыпанное яркими звездами небо, манило нас своей таинственностью.",
          "2) Комната, с утра прибранная сестрой сверкала чистотой.",
          "3) Посетитель кафе, зевая, заказал на обед рыбу жаренную в тесте.",
          "4) Убранное с лугов сено, крестьяне сложили в большие стога, укрыв от дождя."
        ]
      },
{
        id: "ru_9",
        type: "clickable_text",
        points: 1,
        text: "Задание №9. Нажмите на цифры, на месте которых должны стоять запятые:",
        clickableSegments: [
  { "text": "Фонарь" }, { "text": " [,] ", "id": "1", "isTarget": true },
  { "text": "одиноко" }, { "text": " [,] ", "id": "2", "isTarget": true },
  { "text": "стоявший" }, { "text": " [,] ", "id": "3", "isTarget": true },
  { "text": "на" }, { "text": " [,] ", "id": "4", "isTarget": true },
  { "text": "земле" }, { "text": " [,] ", "id": "5", "isTarget": true },
  { "text": "осветил" }, { "text": " [,] ", "id": "6", "isTarget": true },
  { "text": "издающее" }, { "text": " [,] ", "id": "7", "isTarget": true },
  { "text": "непонятные" }, { "text": " [,] ", "id": "8", "isTarget": true },
  { "text": "звуки" }, { "text": " [,] ", "id": "9", "isTarget": true },
  { "text": "создание." }
]
      },
{
        id: "ru_10",
        type: "clickable_text",
        points: 1,
        text: "Задание №10. Укажите все цифры, на месте которых ставятся запятые:",
        clickableSegments: [
  { "text": "Проходя" }, { "text": " [,] ", "id": "1", "isTarget": true },
  { "text": "по" }, { "text": " [,] ", "id": "2", "isTarget": true },
  { "text": "залам" }, { "text": " [,] ", "id": "3", "isTarget": true },
  { "text": "музеев" }, { "text": " [,] ", "id": "4", "isTarget": true },
  { "text": "люди" }, { "text": " [,] ", "id": "5", "isTarget": true },
  { "text": "останавливаются" }, { "text": " [,] ", "id": "6", "isTarget": true },
  { "text": "у" }, { "text": " [,] ", "id": "7", "isTarget": true },
  { "text": "прекрасных" }, { "text": " [,] ", "id": "8", "isTarget": true },
  { "text": "картин" }, { "text": " [,] ", "id": "9", "isTarget": true },
  { "text": "художника" }, { "text": " [,] ", "id": "10", "isTarget": true },
  { "text": "И." }, { "text": " [,] ", "id": "11", "isTarget": true },
  { "text": "Репина" }, { "text": " [,] ", "id": "12", "isTarget": true },
  { "text": "восхищаясь" }, { "text": " [,] ", "id": "13", "isTarget": true },
  { "text": "совершенством" }, { "text": " [,] ", "id": "14", "isTarget": true },
  { "text": "живописи." }
]
      },
{
        id: "russian_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №10. Укажите вариант ответа...\nПроходя (1) по залам музеев (2) люди (3) останавливаются у прекрасных картин художника И.Репина (4) восхищаясь (5) совершенством живописи.",
        options: ["1, 2", "1, 4", "2, 4", "2, 3, 4, 5"],
      }
    ],
                math: [
      {
        id: "ma_1_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №1. Упростите выражение: 12x - 5(1 - x) + 7",
        html: "Задание №1. Упростите выражение: 12x - 5(1 - x) + 7",
        options: ["17x - 12", "17x + 2", "7(x - 1)", "17x + 12", "7x + 2"]
      },      {
        id: "ma_2_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №2. Запишите в виде многочлена: (4n^2 - 1)(n^2 + 5)",
        html: "Задание №2. Запишите в виде многочлена: (4n<sup>2</sup> - 1)(n<sup>2</sup> + 5)",
        options: ["-4n^2 + 5 - 20n^4", "20n^4 + 4n^2 - 5", "4n^4 + 19n^2 - 5", "n^4 + n^2 + 5", "2n + 20n^2 - 5"]
      },      {
        id: "ma_3_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №3. В треугольнике MKE угол K равен 42°, угол M на 57° больше. Вычислите градусную меру угла E.",
        html: "Задание №3. В треугольнике MKE угол K равен 42&deg;, угол M на 57&deg; больше. Вычислите градусную меру угла E.",
        options: ["101°", "82°", "39°", "27°", "49°"]
      },      {
        id: "ma_4_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №4. Один из смежных углов на 54° больше другого. Найдите больший угол.",
        html: "Задание №4. Один из смежных углов на 54&deg; больше другого. Найдите больший угол.",
        options: ["117°", "108°", "84°", "78°", "107°"]
      },      {
        id: "ma_5_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №5. Разложите на множители: 64a^6 - c^12",
        html: "Задание №5. Разложите на множители: 64a<sup>6</sup> - c<sup>12</sup>",
        options: ["(8a^3 + c^6)(8a^3 - c^6)", "(2a + c^2)(2a - c^2)(4a^2 - 2ac^2 + c^4)", "(2a + c^2)(2a - c^2)(4a^2 + 2ac^2 + c^4)", "(4a^2 + c^4)(4a^2 - c^4)", "(2a + c^2)(2a - c^2)(4a^2 - 2ac^2 + c^4)(4a^2 + 2ac^2 + c^4)"]
      },      {
        id: "ma_6_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №6. Найдите корни уравнения: 7 + 2x^2 = 2(x + 1)(x + 3)",
        html: "Задание №6. Найдите корни уравнения: 7 + 2x<sup>2</sup> = 2(x + 1)(x + 3)",
        options: ["1/8", "1/6", "1/9", "2/5", "1/7"]
      },      {
        id: "ma_7_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №7. 5 кондитеров выполнят заказ за 12 часов. За сколько часов выполнят этот заказ 6 кондитеров?",
        html: "Задание №7. 5 кондитеров выполнят заказ за 12 часов. За сколько часов выполнят этот заказ 6 кондитеров?",
        options: ["14 ч", "10 ч", "12 ч", "13 ч", "11 ч"]
      },      {
        id: "ma_8_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №8. Укажите число, имеющее наименьший модуль.",
        html: "Задание №8. Укажите число, имеющее наименьший модуль.",
        options: ["4,7", "-135", "0", "-0,28", "14,3"]
      },      {
        id: "ma_9_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №9. Треугольник, с какими сторонами можно изобразить?",
        html: "Задание №9. Треугольник, с какими сторонами можно изобразить?",
        options: ["2; 2; 4", "8; 11; 2", "11; 6; 6", "18; 9; 8", "3; 2; 6"]
      },      {
        id: "ma_10_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №10. Углы треугольника ABC относятся как 5:3:1. Вычислите самый большой угол этого треугольника.",
        html: "Задание №10. Углы треугольника ABC относятся как 5:3:1. Вычислите самый большой угол этого треугольника.",
        options: ["140°", "130°", "100°", "80°", "90°"]
      },      {
        id: "ma_11_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №11. Решите уравнение: |x - 7| = 2",
        html: "Задание №11. Решите уравнение: |x - 7| = 2",
        options: ["5; 9", "9; 6", "10; 1", "-5; 6", "6 1/7; 8"]
      },      {
        id: "ma_12_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №12. Решите неравенство: 4y + 4 < y - 5",
        html: "Задание №12. Решите неравенство: 4y + 4 &lt; y - 5",
        options: ["(-∞; -3)", "(-∞; 3)", "(-∞; -9)", "(3; +∞)", "(-3; +∞)"]
      },      {
        id: "ma_13_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №13. Сумма вертикальных углов равна 136°. Вычислите один из вертикальных углов.",
        html: "Задание №13. Сумма вертикальных углов равна 136&deg;. Вычислите один из вертикальных углов.",
        options: ["56°", "102°", "284°", "68°", "86°"]
      },      {
        id: "ma_14_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №14. Выберите верное утверждение. Если две параллельные прямые пересечены секущей, то",
        html: "Задание №14. Выберите верное утверждение. Если две параллельные прямые пересечены секущей, то",
        options: ["накрест лежащие углы в сумме дают 180°", "смежные углы равны", "соответственные углы равны", "односторонние углы равны", "сумма соответственных углов равна 180°"]
      },      {
        id: "ma_15_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №15. Представьте в виде произведения: x(a - b) + y(b - a)",
        html: "Задание №15. Представьте в виде произведения: x(a - b) + y(b - a)",
        options: ["(a - b)(x - y)", "(b - a)(x - y)", "-(x + y)(a + b)", "(x + y)(b - a)", "(a - b)(x + y)"]
      },      {
        id: "ma_16_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №16. Найдите сумму углов 1 + 2 + 3, изображенных на рисунке.",
        html: "Задание №16. Найдите сумму углов 1 + 2 + 3, изображенных на рисунке.<br><br><img src='/math8_16.png' alt='Углы на рисунке' style='max-width:300px;display:block;margin:10px 0;' />",
        options: ["90°", "150°", "180°", "360°", "200°"]
      },      {
        id: "ma_17_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №17. В прямоугольном треугольнике ABC угол B равен 90°, угол C равен 45°. Сравните стороны треугольника.",
        html: "Задание №17. В прямоугольном треугольнике ABC угол B равен 90&deg;, угол C равен 45&deg;. Сравните стороны треугольника.",
        options: ["AB < AC < BC", "AB > AC > BC", "AB = BC < AC", "CA = AB = BC", "AB > BC = AC"]
      },      {
        id: "ma_18_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №18. Айман купила для братика упаковку воздушных шариков. Оказалось, что из 20 шариков 12 красные, а остальные - зеленые. Какова вероятность того, что брат наугад достанет из упаковки зеленый шарик?",
        html: "Задание №18. Айман купила для братика упаковку воздушных шариков. Оказалось, что из 20 шариков 12 красные, а остальные - зеленые. Какова вероятность того, что брат наугад достанет из упаковки зеленый шарик?",
        options: ["3/5", "1/20", "1/12", "2/5", "1/8"]
      },      {
        id: "ma_19_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №19. Выполните действия: (2a^2 b)^3",
        html: "Задание №19. Выполните действия: (2a<sup>2</sup> b)<sup>3</sup>",
        options: ["2a^6 b^3", "8a^6 b^3", "2 b", "8 b^3", "16a^4 b^3"]
      },      {
        id: "ma_20_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №20. При каких значениях m графики функций y = mx + 12 и y = -4x + 3 параллельны?",
        html: "Задание №20. При каких значениях m графики функций y = mx + 12 и y = -4x + 3 параллельны?",
        options: ["-4", "4", "3", "-3", "12"]
      },      {
        id: "ma_21_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №21. Решите систему уравнений: -2x + 5y = 12 и 3x - y = 8",
        html: "Задание №21. Решите систему уравнений:<br><div style='display:inline-block;border-left:1px solid;padding-left:5px;'>-2x + 5y = 12<br>3x - y = 8</div>",
        options: ["(4; -4)", "(2; 2)", "(4; 4)", "(-4; 4)", "(1; 3)"]
      },      {
        id: "ma_22_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №22. Самир положил в банк 12000 сом под 10% годовых. Какая общая сумма денег будет на его счету через 3 года?",
        html: "Задание №22. Самир положил в банк 12000 сом под 10% годовых. Какая общая сумма денег будет на его счету через 3 года?",
        options: ["120360", "123600", "156000", "120120", "123060"]
      },
    ],
    logic: commonLogicQuestions,
  },
  "9": {
    grade: 9,
    english: english_grade_9,
    russian: [
{
        id: "russian_1",
        type: "multiple_choice",
        points: 1,
        text: "Задание №1. Найдите словосочетание со связью примыкание:",
        options: [
          "Деревянный стол",
          "Быстро бежать",
          "Читать книгу",
          "Встреча с другом",
        ],
      },
{
        id: "russian_2",
        type: "multiple_choice",
        points: 1,
        text: "Задание №2. Объясни постановку скобок в предложении: «В жаркое летнее утро (это было в исходе июля) разбудили нас ранее обыкновенного.»",
        options: [
          "Причастный оборот",
          "Вставная конструкция",
          "Вводная конструкция",
        ],
      },
{
        id: "russian_3",
        type: "multiple_choice",
        points: 1,
        text: "Задание №3. Найдите определенно-личностный предложение:",
        options: [
          "Мне не спится.",
          "Иду по лесной тропинке.",
          "В дверь стучат.",
        ],
      },
{
        id: "russian_4",
        type: "multiple_choice",
        points: 1,
        text: "Задание №4. Укажите подлежащее в предложении: «Три ученика опоздали на урок».",
        options: ["три", "урок", "три ученика"],
      },
{
        id: "ru_5_new",
        type: "inline_inputs",
        points: 1,
        text: "Задание №5. Вставьте пропущенные буквы (н или нн):",
        inlineSegments: [
          { type: "text", text: "неслыха" },
          { type: "input", id: "input1" },
          { type: "text", text: "ая дерзость\nзадача реше" },
          { type: "input", id: "input2" },
          { type: "text", text: "а." }
        ]
      },
{
        id: "russian_6",
        type: "multiple_choice",
        points: 1,
        text: "Задание №6. Найдите предложение с причастным оборотом, который не обособляется:",
        options: [
          "Утомленные долгим путем туристы отдыхали.",
          "Туристы утомленные долгим путем отдыхали",
        ],
      },
{
        id: "ru_7_new",
        type: "clickable_text",
        points: 1,
        text: "Задание №7. Расставьте знаки препинания в предложении (кликните в места, где нужны запятые):",
        clickableSegments: [
  { "text": "Ветер" }, { "text": " [,] ", "id": "1", "isTarget": true },
  { "text": "дующий" }, { "text": " [,] ", "id": "2", "isTarget": true },
  { "text": "с" }, { "text": " [,] ", "id": "3", "isTarget": true },
  { "text": "моря" }, { "text": " [,] ", "id": "4", "isTarget": true },
  { "text": "принес" }, { "text": " [,] ", "id": "5", "isTarget": true },
  { "text": "прохладу." }
]
      },
{
        id: "russian_8",
        type: "multiple_choice",
        points: 1,
        text: "Задание №8. НЕ пишется раздельно:",
        options: [
          "(не) навидящий ложь",
          "(не) смолкающие разговоры",
          "(не) закрыв дверь",
          "(не) греющее солнце",
        ],
      },
{
        id: "russian_9",
        type: "multiple_choice",
        points: 1,
        text: "Задание №9. НЕ пишется слитно:",
        options: [
          "Вовсе (не) освещенное окно",
          "(не) навидевший",
          "(не) закончив",
          "(не) покрытая снегом",
        ],
      },
{
        id: "russian_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №10. Выберите предложение с деепричастным оборотом (знаки не расставлены):",
        options: [
          "Он сидел молча.",
          "Закончив работу я пошел гулять.",
          "Прилетевшая птица села на ветку.",
        ],
      },
{
        id: "russian_11",
        type: "multiple_choice",
        points: 1,
        text: "Задание №11. Найдите предложение с вводным словом (знаки не расставлены):",
        options: [
          "Кажется дождь начинается.",
          "Он кажется мне знакомым.",
          "Он кажется усталым.",
        ],
      },
{
        id: "russian_12",
        type: "multiple_choice",
        points: 1,
        text: "Задание №12. Определите вид сказуемого: «Он хотел научится танцевать».",
        options: [
          "Простое глагольное.",
          "Составное именное.",
          "Составное глагольное.",
        ],
      },
{
        id: "ru_13_new",
        type: "multiple_choice",
        points: 1,
        text: "Задание №13. Определите тип первой части сложного предложения («На улице похолодало...»):\nНа улице похолодало, и мы вернулись домой.",
        options: ["Безличное предложение", "Определённо-личное предложение", "Неопределённо-личное предложение", "Двусоставное предложение"]
      },
{
        id: "ru_14_new",
        type: "multiple_choice",
        points: 1,
        text: "Задание №14. Какое правило объясняет постановку двоеточия в предложении: «Я понимал: если не потороплюсь, то опоздаю, и все пропадет»?",
        options: [
          "1) Вторая часть раскрывает содержание первой (можно вставить «а именно»).",
          "2) Вторая часть указывает на причину того, о чём говорится в первой (можно вставить «потому что»).",
          "3) Первая часть указывает на условие совершения действия во второй части."
        ]
      }
    ],
                math: [
      {
        id: "ma_1_9",
        type: "multiple_choice",
        points: 1,
        text: "Задание №1. Выполните деление: (6x + 6y)/x : (x^2 - y^2)/x^2",
        html: "Задание №1. Выполните деление: <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>6x + 6y</span><span>x</span></span> : <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>x<sup>2</sup> - y<sup>2</sup></span><span>x<sup>2</sup></span></span>",
        options: ["6/(x - y)", "6x/(x + y)", "(x + y)/6x", "6x/(x - y)"],
        optionsHtml: ["<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>6</span><span>x - y</span></span>", "<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>6x</span><span>x + y</span></span>", "<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>x + y</span><span>6x</span></span>", "<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>6x</span><span>x - y</span></span>"]
      },      {
        id: "ma_2_9",
        type: "multiple_choice",
        points: 1,
        text: "Задание №2. Подберите два последовательных целых числа, между которыми заключено число √37.",
        html: "Задание №2. Подберите два последовательных целых числа, между которыми заключено число &radic;37.",
        options: ["36 и 38", "6 и 7", "7 и 8", "нет таких значений"]
      },      {
        id: "ma_3_9",
        type: "multiple_choice",
        points: 1,
        text: "Задание №3. Найдите значение выражения: √(0,04 · 81) - 7 · √(1/49)",
        html: "Задание №3. Найдите значение выражения: &radic;(0,04 &middot; 81) - 7 &middot; &radic;<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>1</span><span>49</span></span>",
        options: ["17", "0,8", "17 1/6", "4"],
        optionsHtml: ["17", "0,8", "17 <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>1</span><span>6</span></span>", "4"]
      },      {
        id: "ma_4_9",
        type: "multiple_choice",
        points: 1,
        text: "Задание №4. Выберите неверное равенство:",
        html: "Задание №4. Выберите неверное равенство:",
        options: ["√16 = 4", "√0,4 = 0,2", "7 - √25 = 2", "√((-15)^2) = 15"],
        optionsHtml: ["&radic;16 = 4", "&radic;0,4 = 0,2", "7 - &radic;25 = 2", "&radic;((-15)<sup>2</sup>) = 15"]
      },      {
        id: "ma_5_9",
        type: "multiple_choice",
        points: 1,
        text: "Задание №5. Найдите корни уравнения: x^2 + 7x - 18 = 0.",
        html: "Задание №5. Найдите корни уравнения: x<sup>2</sup> + 7x - 18 = 0.",
        options: ["-2 и 9", "-9 и 2", "корней нет", "2 и 9"]
      },      {
        id: "ma_6_9",
        type: "multiple_choice",
        points: 1,
        text: "Задание №6. Графиком какой из функций является гипербола?",
        html: "Задание №6. Графиком какой из функций является гипербола?",
        options: ["y = x/4", "y = -x/4", "y = 4/x", "y = 4x^2"],
        optionsHtml: ["y = <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>x</span><span>4</span></span>", "y = -<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>x</span><span>4</span></span>", "y = <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>4</span><span>x</span></span>", "y = 4x<sup>2</sup>"]
      },      {
        id: "ma_7_9",
        type: "multiple_choice",
        points: 1,
        text: "Задание №7. В прямоугольном треугольнике ABC угол B равен 90 градусов, AB = 5 см, AC = 7 см. Найдите BC.",
        html: "Задание №7. В прямоугольном треугольнике ABC угол B равен 90 градусов, AB = 5 см, AC = 7 см. Найдите BC.",
        options: ["24 см", "12 см", "2 см", "√24 см"],
        optionsHtml: ["24 см", "12 см", "2 см", "&radic;24 см"]
      },      {
        id: "ma_8_9",
        type: "multiple_choice",
        points: 1,
        text: "Задание №8. Хорды AB и CD пересекаются в точке E. Найдите ED, если AE = 5, BE = 2, CE = ED.",
        html: "Задание №8. Хорды AB и CD пересекаются в точке E. Найдите ED, если AE = 5, BE = 2, CE = ED.",
        options: ["10", "√10", "7", "√7"],
        optionsHtml: ["10", "&radic;10", "7", "&radic;7"]
      },      {
        id: "ma_9_9",
        type: "multiple_choice",
        points: 1,
        text: "Задание №9. Сумма двух противоположных сторон описанного четырехугольника равна 12 см, а радиус вписанной в него окружности равен 5 см. Найдите площадь четырехугольника.",
        html: "Задание №9. Сумма двух противоположных сторон описанного четырехугольника равна 12 см, а радиус вписанной в него окружности равен 5 см. Найдите площадь четырехугольника.",
        options: ["120 см^2", "60 см^2", "30 см^2", "17 см"],
        optionsHtml: ["120 см<sup>2</sup>", "60 см<sup>2</sup>", "30 см<sup>2</sup>", "17 см"]
      },      {
        id: "ma_10_9",
        type: "multiple_choice",
        points: 1,
        text: "Задание №10. Мотоциклист проехал 40 км от дома до реки. Возвращаясь обратно со скоростью на 10 км/ч меньшей первоначальной, он затратил на этот путь на 20 мин больше. Найдите первоначальную скорость мотоциклиста. Если эту скорость обозначить за х км/ч, то задача может быть решена с помощью уравнения:",
        html: "Задание №10. Мотоциклист проехал 40 км от дома до реки. Возвращаясь обратно со скоростью на 10 км/ч меньшей первоначальной, он затратил на этот путь на 20 мин больше. Найдите первоначальную скорость мотоциклиста. Если эту скорость обозначить за х км/ч, то задача может быть решена с помощью уравнения:",
        options: ["40/x + 40/(x-10) = 20 + 3(x-10) = 40", "40/(x-10) - 40/x = 1/3", "40/(x-10) + 40/x = 1/3", "х"],
        optionsHtml: ["<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>40</span><span>x</span></span> + <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>40</span><span>x - 10</span></span> = 20 + 3(x - 10) = 40", "<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>40</span><span>x - 10</span></span> - <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>40</span><span>x</span></span> = <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>1</span><span>3</span></span>", "<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>40</span><span>x - 10</span></span> + <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>40</span><span>x</span></span> = <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>1</span><span>3</span></span>", "х"]
      },
    ],
    logic: commonLogicQuestions,
  },
  "10": {
    grade: 10,
    english: english_grade_10_11,
    russian: [
{
        id: "russian_1",
        type: "multiple_choice",
        points: 1,
        text: "Задание №1. Выпишите слово, в котором НЕВЕРНО выделен ударный гласный звук.",
        options: ["цепОчка", "газопрОвод", "прозорлИва", "донЕльзя"],
      },
{
        id: "ru_2_new",
        type: "two_step",
        points: 1,
        text: "Задание №2. Исправьте лексическую ошибку в одном из предложений, подобрав к выделенному слову пароним.",
        step2Text: "Запишите подобранное слово в поле ниже.",
        options: [
          "1. Летом в ЛЕСИСТОЙ чащобе появляются полчища комаров.",
          "2. Статья оказалась полезной и ИНФОРМАТИВНОЙ.",
          "3. В Российской империи высшим судебным органом был ВЕРХОВНЫЙ уголовный суд.",
          "4. Буду вам крайне, очень, бесконечно ПРИЗНАТЕЛЬНА."
        ]
      },
{
        id: "russian_3",
        type: "multiple_choice",
        points: 1,
        text: "Задание №3. Укажите предложение, в котором нужно поставить одну запятую.",
        options: [
          "В природе ни лист ни соломинка ни дерево не повторяются.",
          "Туманы здесь бывают если не каждый день то через день непременно.",
          "Мы увидели заросли земляники и лесной малины и решили наполнить наши корзинки.",
          "Молчали берег и море и лес.",
        ],
      },
{
        id: "russian_4",
        type: "multiple_choice",
        points: 1,
        text: "Задание №4. Выделите слово, в котором пропущена безударная проверяемая гласная корня.",
        options: [
          "оз..рить",
          "м..литва",
          "заг..рать",
          "соч..тание",
          "к…ллекция",
        ],
      },
{
        id: "russian_5",
        type: "multiple_choice",
        points: 1,
        text: "Задание №5. Выпишите ряд, в котором в обоих словах пропущена одна и та же буква.",
        options: [
          "бе..защитный, во…произведение;",
          "пред..явить, с..езд;",
          "пр..близить, пр..старелый;",
          "н..мерение, вз..браться;",
          "и..подтишка, ра..жалобить.",
        ],
      },
{
        id: "russian_6",
        type: "multiple_choice",
        points: 1,
        text: "Задание №6. Выпишите слово, в котором на месте пропуска пишется буква Е.",
        options: [
          "забол…вать",
          "выпяч…вать",
          "насла…ваться",
          "достра..вать",
          "привередл..вый",
        ],
      },
{
        id: "russian_7",
        type: "multiple_choice",
        points: 1,
        text: "Задание №7. Определите предложение, в котором НЕ со словом пишется СЛИТНО.",
        options: [
          "Ирина Андреевна говорила (не)громко, но очень выразительно.",
          "Я был (не)готов...",
          "(Не)умолкающие до глубокой ночи звуки...",
          "Конечно, это был далеко (не)лучший...",
          "(Не) полученная вовремя телеграмма...",
        ],
      },
{
        id: "ru_8_new",
        type: "two_step",
        points: 1,
        text: "Задание №8. В каком предложении оба выделенных слова пишутся СЛИТНО?",
        step2Text: "Выпишите эти два слова из выбранного предложения. Пишите их слитно, без пробелов и знаков препинания, в том виде, в каком они должны быть в предложении.",
        options: [
          "1) ЧТО(БЫ) ... ТАК(ЖЕ)",
          "2) (В)ЗАКЛЮЧЕНИЕ ... (И)ТАК",
          "3) (ТОТ)ЧАС ... ПЕРВЫЙ(ЖЕ)",
          "4) КАК(БЫ) ... (НА)ПЕРЕГОНКИ",
          "5) ТАК(ЖЕ) ... (ПО)ЭТОМУ"
        ]
      },
      {
        id: "russian_9",
        type: "multiple_choice",
        points: 1,
        text: "Задание №9. Укажите все цифры, на месте которых пишется НН.\n\nЗа око(1)ым стеклом жила своей утре(2)ей жизнью обыкнове(3)ая городская асфальтирова(4)ая улица, по которой мчались переполне(5)ые маршрутные такси и гружё(6)ые самосвалы.",
        options: [
          "1, 2, 3, 4, 5",
          "1, 2, 3, 4, 5, 6",
          "2, 3, 4, 5",
          "1, 3, 4, 5"
        ]
      },
      {
        id: "russian_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №10. Укажите все цифры, на месте которых в предложении должны стоять запятые.\n\nПривлечённые запахом (1) цветущей в парке (2) акации (3) мы остановились (4) наслаждаясь ароматом.",
        options: [
          "3, 4",
          "1, 3, 4",
          "1, 2, 3, 4",
          "4"
        ]
      }
    ],
            math: [
      {
        id: "ma_1_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №1. Найдите значение выражения: (5/12 + 3/8) · 12/19",
        html: "Задание №1. Найдите значение выражения: ( <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>5</span><span>12</span></span> + <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>3</span><span>8</span></span> ) &middot; <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>12</span><span>19</span></span>",
        options: ["1/3", "1/19", "1/2", "5/19"]
      },      {
        id: "ma_2_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №2. Найдите значение выражения: 39,156 : 7,8 + 1,18",
        html: "Задание №2. Найдите значение выражения: 39,156 : 7,8 + 1,18",
        options: ["5,28", "6,28", "5,02", "6,2"]
      },      {
        id: "ma_3_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №3. Решите уравнение: 15,3 : 1,5 = 2x : 8,2",
        html: "Задание №3. Решите уравнение: 15,3 : 1,5 = 2x : 8,2",
        options: ["41,82", "41,62", "83,61", "83,64"]
      },      {
        id: "ma_4_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №4. Из 2,5 кг ржаной муки получается 3,5 кг хлеба. Сколько хлеба можно испечь из 70 т ржаной муки?",
        html: "Задание №4. Из 2,5 кг ржаной муки получается 3,5 кг хлеба. Сколько хлеба можно испечь из 70 т ржаной муки?",
        options: ["98т", "50 т", "108т", "86т"]
      },      {
        id: "ma_5_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №5. Найдите значение выражения: 3,8 · (-1,5) + (-35,2) : (-5)",
        html: "Задание №5. Найдите значение выражения: 3,8 &middot; (-1,5) + (-35,2) : (-5)",
        options: ["- 7,4", "1,34", "– 1,34", "12,04"]
      },      {
        id: "ma_6_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №6. Вычислите 2x / √(x - 12) при x = 12,5 (25/2)",
        html: "Задание №6. Вычислите <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 4px;'><span style='border-bottom:1px solid currentColor;'>2x</span><span>&radic;(x - 12)</span></span> при x = 12,5 (25/2)",
        options: ["12,5√2", "√2", "25√2", "2√2"]
      },      {
        id: "ma_7_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №7. Найдите наибольшее из чисел, если известно, что 0 < x < 1",
        html: "Задание №7. Найдите наибольшее из чисел, если известно, что 0 &lt; x &lt; 1",
        options: ["x^15", "x^13", "x^5", "x^16"],
        optionsHtml: ["x<sup>15</sup>", "x<sup>13</sup>", "x<sup>5</sup>", "x<sup>16</sup>"]
      },      {
        id: "ma_8_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №8. Упростите выражение (2a - 3)^2 - 5a(6a - 7)",
        html: "Задание №8. Упростите выражение (2a - 3)<sup>2</sup> - 5a(6a - 7)",
        options: ["-26a^2 - 23a + 9", "26a^2 + 23a + 9", "-26a^2 - 23a - 9", "-26a^2 + 23a + 9"],
        optionsHtml: ["-26a<sup>2</sup> - 23a + 9", "26a<sup>2</sup> + 23a + 9", "-26a<sup>2</sup> - 23a - 9", "-26a<sup>2</sup> + 23a + 9"]
      },      {
        id: "ma_9_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №9. Упростите выражение b / (a^2 - ab) : b^2 / (a^2 - b^2)",
        html: "Задание №9. Упростите выражение <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>b</span><span>a<sup>2</sup> - ab</span></span> : <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>b<sup>2</sup></span><span>a<sup>2</sup> - b<sup>2</sup></span></span>",
        options: ["(a+b)/a", "(a+b)/ab", "(a+b)/b", "ab/(a+b)"],
        optionsHtml: ["<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>a+b</span><span>a</span></span>", "<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>a+b</span><span>ab</span></span>", "<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>a+b</span><span>b</span></span>", "<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>ab</span><span>a+b</span></span>"]
      },      {
        id: "ma_10_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №10. Упростите выражение ((a^7 · a^-3) / a)^3",
        html: "Задание №10. Упростите выражение ( <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>a<sup>7</sup> &middot; a<sup>-3</sup></span><span>a</span></span> )<sup>3</sup>",
        options: ["a^11", "a^6", "a^9", "a^-1"],
        optionsHtml: ["a<sup>11</sup>", "a<sup>6</sup>", "a<sup>9</sup>", "a<sup>-1</sup>"]
      },      {
        id: "ma_11_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №11. Последовательность a_n задана следующим образом: a_1 = 2, a_n = a_(n-1) - 3. Чему равно a_5 - a_4?",
        html: "Задание №11. Последовательность a<sub>n</sub> задана следующим образом: a<sub>1</sub> = 2, a<sub>n</sub> = a<sub>n-1</sub> - 3. Чему равно a<sub>5</sub> - a<sub>4</sub>?",
        options: ["-10", "3", "-7", "-3"]
      },      {
        id: "ma_12_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №12. В каком промежутке находится корень уравнения (2x + 20) / 24 = (x + 12) / 15",
        html: "Задание №12. В каком промежутке находится корень уравнения <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>2x + 20</span><span>24</span></span> = <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>x + 12</span><span>15</span></span>",
        options: ["(-∞; -3)", "(0; 3)", "(-3; 0)", "(3; +∞)"]
      },      {
        id: "ma_13_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №13. Найдите сумму корней уравнения: 2x^2 + 3x - 5 = 0",
        html: "Задание №13. Найдите сумму корней уравнения: 2x<sup>2</sup> + 3x - 5 = 0",
        options: ["-1,5", "3", "1,5", "-3"]
      },      {
        id: "ma_14_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №14. Сколько корней имеет уравнение: x^4 + 4x^2 + 4 = 0",
        html: "Задание №14. Сколько корней имеет уравнение: x<sup>4</sup> + 4x<sup>2</sup> + 4 = 0",
        options: ["2", "ни одного", "4", "1"]
      },      {
        id: "ma_15_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №15. Найдите решение (x_0; y_0) системы уравнений |x - 3| - y = 3 и x - 2y = 6 и вычислите значение произведения x_0 · y_0",
        html: "Задание №15. Найдите решение (x<sub>0</sub>; y<sub>0</sub>) системы уравнений:<br><div style='display:inline-block;border-left:1px solid;padding-left:5px;'>|x - 3| - y = 3<br>x - 2y = 6</div><br>и вычислите значение произведения x<sub>0</sub> &middot; y<sub>0</sub>",
        options: ["-1", "0", "-2", "-4"]
      },      {
        id: "ma_16_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №16. Решите неравенство 7 - 2x < -23 - 5(x - 3). В ответе укажите наибольшее число.",
        html: "Задание №16. Решите неравенство 7 - 2x &lt; -23 - 5(x - 3). В ответе укажите наибольшее число.",
        options: ["0", "-6", "-5", "-4"]
      },      {
        id: "ma_17_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №17. Решите систему неравенств (x - 1)/2 > (x - 2)/3 и 2x - 5 < 3x - 8",
        html: "Задание №17. Решите систему неравенств:<br><div style='display:inline-block;border-left:1px solid;padding-left:5px;'><span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>x - 1</span><span>2</span></span> &gt; <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>x - 2</span><span>3</span></span><br><br>2x - 5 &lt; 3x - 8</div>",
        options: ["(-∞; -1) ∪ (3; +∞)", "(-1; -3)", "(3; +∞)", "нет решений"]
      },      {
        id: "ma_18_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №18. Найдите количество целых решений неравенства 2x^2 + 6x - 8 ≤ 0",
        html: "Задание №18. Найдите количество целых решений неравенства 2x<sup>2</sup> + 6x - 8 &le; 0",
        options: ["3", "6", "5", "4"]
      },      {
        id: "ma_19_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №19. Найдите область определения функции y = √(30 - 2x)",
        html: "Задание №19. Найдите область определения функции y = &radic;(30 - 2x)",
        options: ["(-∞; 15]", "(-∞; +∞)", "(-∞; 15)", "[15; +∞)"]
      },      {
        id: "ma_20_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №20. График какой функции изображен на рисунке?",
        html: "Задание №20. График какой функции изображен на рисунке?<br><br><img src='/math10_20.png' alt='График функции' style='max-width:300px;display:block;margin:10px 0;' />",
        options: ["y = -x^2 + 1", "y = -x^2 + 4x + 3", "y = -x^2 - 4x - 3", "y = -x^2 + 4x - 3"],
        optionsHtml: ["y = -x<sup>2</sup> + 1", "y = -x<sup>2</sup> + 4x + 3", "y = -x<sup>2</sup> - 4x - 3", "y = -x<sup>2</sup> + 4x - 3"]
      },      {
        id: "ma_21_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №21. На рисунке изображена зависимость температуры вещества Т от времени t. Укажите, в течение какого времени температура вещества была постоянна.",
        html: "Задание №21. На рисунке изображена зависимость температуры вещества Т от времени t. Укажите, в течение какого времени температура вещества была постоянна.<br><br><img src='/math10_21.png' alt='График температуры' style='max-width:300px;display:block;margin:10px 0;' />",
        options: ["2", "3", "1", "4"]
      },
    ],
    logic: commonLogicQuestions,
  },
  "11": {
    grade: 11,
    english: english_grade_10_11,
    russian: [
{
        id: "russian_1",
        type: "multiple_choice",
        points: 1,
        text: "Задание №1. Отметьте слово, в котором НЕВЕРНО выделен ударный гласный звук вероисповедАние",
        options: ["заперлА", "оптОвый", "красИвее"],
      },
{
        id: "russian_2",
        type: "two_step",
        points: 1,
        text: "Задание №2. В одном из предложений ниже допущена лексическая ошибка (неверно использовано выделенное слово).",
        step2Text: "Исправьте ошибку, подобрав к выделенному слову верный пароним. Запишите подобранное слово в поле ниже.",
        options: [
          "1. На прогулку Катя НАДЕЛА тёплую шапку.",
          "2. Нужны сведения о НАЛИЧНОСТИ в фондах библиотеки новых поступлений.",
          "3. Многие женщины посмотрели на новую гостью с завистью и НЕДОБРОЖЕЛАТЕЛЬНОСТЬЮ.",
          "4. Из радиоприёмника доносился НЕМУДРЁНЫЙ, однообразный мотивчик."
        ]
      },
{
        id: "russian_3",
        type: "multiple_choice",
        points: 1,
        text: "Задание №3. Укажите верную характеристику предложения: «Пока мы переходили через поляну, турки успели сделать несколько выстрелов.» сложносочиненное",
        options: ["сложноподчиненное", "бессоюзное"],
      },
{
        id: "russian_4",
        type: "multiple_choice",
        points: 1,
        text: "Задание №4. Выделите слово, в котором пропущена безударная проверяемая гласная корня. ф..олетовый",
        options: [
          "переб..рать",
          "пр..стодушный",
          "выт..реть",
          "прик..сновение",
        ],
      },
{
        id: "russian_6",
        type: "multiple_choice",
        points: 1,
        text: "Задание №6. Выпишите слово, в котором на месте пропуска пишется буква Е. подстра…ваться",
        options: ["эмал…вый", "проста…вать", "изменч..вый"],
      },
{
        id: "russian_8",
        type: "two_step",
        points: 1,
        text: "Задание №8. В каком предложении оба выделенных слова пишутся СЛИТНО?",
        step2Text: "Выпишите эти два слова из выбранного предложения. Пишите их слитно, без пробелов и знаков препинания, в том виде, в каком они должны быть в предложении.",
        options: [
          "1. (НЕ)СМОТРЯ на то что большинство стихотворений Жуковского является переводными, в них мы ВСЁ(ТАКИ) видим русский пейзаж.",
          "2. Я хочу поговорить с вами (НА)СЧЁТ квартиры, (В)СВЯЗИ с чем прошу уделить мне внимание.",
          "3. Студент выбрал эту тему реферата, ЧТО(БЫ) лучше узнать историю музыки, и В(ТЕЧЕНИЕ) месяца изучал полученные в библиотеке книги.",
          "4. Тихо опустилось солнце за горы, выбросило (К)ВЕРХУ прощальный зелёный луч, и Байкал (ТОТ)ЧАС отразил в себе нежную зелень.",
          "5. А вечером он сидел опять ЗА (ТЕМ) же столом и, положив голову на руку, слушал Настасью Петровну и пытался понять, ПО (ЧЕМУ) ему так хорошо в этом доме."
        ]
      },
{
        id: "russian_10",
        type: "multiple_choice",
        points: 1,
        text: "Задание №10. Укажите все цифры, на месте которых в предложении должны стоять запятые. Солнце (1) не спеша (2) поднималось над горизонтом (3) озаряя первыми лучами (4) поля (5) засеянные пшеницей.",
        options: ["1, 2, 3", "3, 5", "3, 4, 5", "1, 2, 3, 4, 5"],
      }
    ],
                math: [
      {
        id: "ma_1_11",
        type: "multiple_choice",
        points: 1,
        text: "Задание А1. Упростите выражение: -4sin^2 α + 5 - 4cos^2 α",
        html: "Задание А1. Упростите выражение: -4sin<sup>2</sup> &alpha; + 5 - 4cos<sup>2</sup> &alpha;",
        options: ["1", "9", "1 + 8sin^2 α", "1 + 8cos^2 α"],
        optionsHtml: ["1", "9", "1 + 8sin<sup>2</sup> &alpha;", "1 + 8cos<sup>2</sup> &alpha;"]
      },      {
        id: "ma_2_11",
        type: "multiple_choice",
        points: 1,
        text: "Задание А2. Вычислить: 4sin(x/7)cos(x/7) при x = 7/4π",
        html: "Задание А2. Вычислить: 4sin<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>x</span><span>7</span></span>cos<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>x</span><span>7</span></span> при x = <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>7</span><span>4</span></span>&pi;",
        options: ["0", "2", "-1", "-2"]
      },      {
        id: "ma_3_11",
        type: "multiple_choice",
        points: 1,
        text: "Задание А3. Решите уравнение: cos^2 x - sin^2 x = 0,5",
        html: "Задание А3. Решите уравнение: cos<sup>2</sup> x - sin<sup>2</sup> x = 0,5",
        options: ["±π/3 + πn, n ∈ Z", "±π/3 + 2πn, n ∈ Z", "±π/6 + πn, n ∈ Z", "±π/6 + 2πn, n ∈ Z"]
      },      {
        id: "ma_4_11",
        type: "multiple_choice",
        points: 1,
        text: "Задание А4. Решите неравенство: ((2x - 3)(6 + 3x)) / (7 - 4x) ≥ 0",
        html: "Задание А4. Решите неравенство: <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>(2x - 3)(6 + 3x)</span><span>7 - 4x</span></span> &ge; 0",
        options: ["(-∞; -2] ∪ [1,5; 0)", "[-2; -1,5] ∪ (1,75; +∞)", "(-2; -1,5) ∪ [1,75; +∞)", "(-∞; -2] ∪ [1,5; 1,75)"]
      },      {
        id: "ma_5_11",
        type: "multiple_choice",
        points: 1,
        text: "Задание А5. Найдите множество значений функции: y = 11cos x",
        html: "Задание А5. Найдите множество значений функции: y = 11cos x",
        options: ["[0; 11]", "[-1; 1]", "(-∞; +∞)", "[-11; 11]"]
      },      {
        id: "ma_6_11",
        type: "multiple_choice",
        points: 1,
        text: "Задание А6. Найдите производную функции: y = 3x^2 cos x",
        html: "Задание А6. Найдите производную функции: y = 3x<sup>2</sup> cos x",
        options: ["-6xsin x", "6xcos x - 3x^2sin x", "x^3cos x + 3x^2sin x", "6xcos x + 3x^2sin x"],
        optionsHtml: ["-6xsin x", "6xcos x - 3x<sup>2</sup>sin x", "x<sup>3</sup>cos x + 3x<sup>2</sup>sin x", "6xcos x + 3x<sup>2</sup>sin x"]
      },      {
        id: "ma_7_11",
        type: "free_text",
        points: 1,
        text: "Задание В1. Точка движется по координатной прямой согласно закону X(t) = 3 + 2t + t^2, где X(t) — координата точки в момент времени t. В какой момент времени скорость точки будет равна 5?",
        html: "Задание В1. Точка движется по координатной прямой согласно закону X(t) = 3 + 2t + t<sup>2</sup>, где X(t) — координата точки в момент времени t. В какой момент времени скорость точки будет равна 5?"
      },      {
        id: "ma_8_11",
        type: "free_text",
        points: 1,
        text: "Задание В2. Определите абсциссы точек, в которых угловой коэффициент касательной к графику функции h(x) = 1 - 2sin^2 x равен 2.",
        html: "Задание В2. Определите абсциссы точек, в которых угловой коэффициент касательной к графику функции h(x) = 1 - 2sin<sup>2</sup> x равен 2."
      },
    ],
    logic: commonLogicQuestions,
  },
};
