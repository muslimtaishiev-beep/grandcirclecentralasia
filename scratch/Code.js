const SHEET_TESTS = "Результаты тестов";
const SHEET_CRM = "CRM Менеджеров";

const ANSWER_KEYS = {
  "7": {
    "russian": {

      "ru_7_new": { ans: JSON.stringify({"Прилагательное":"Часть речи","Сказуемое":"Член предложения","Союз":"Часть речи","Определение":"Член предложения","Существительное":"Часть речи"}), pts: 1 , topic: "Морфология" },
      "ru_9": { ans: "Гвоздем программы было выступление известного актера.", pts: 1 , topic: "Фразеологизмы" },
      "ru_10": { ans: "Аккуратный, точный", pts: 1 , topic: "Лексика (Значение слова)" },
      "ru_11": { ans: "К четырехстам прибавить пятьдесят.", pts: 1 , topic: "Склонение числительных" },
      "ru_12": { ans: "какой(либо), (шахматно)шашечный, ярко(красный)", pts: 1 , topic: "Дефисное написание слов" },
      "ru_13": { ans: "Из-под этой тучи вырвались яркие лучи, и мокрые леса и поля засверкали.", pts: 1 , topic: "Пунктуация в ССП" },
      "russian_1": {
        "ans": "гвоздем программы было выступление известного актера.",
        "pts": 1, "topic": "Фразеологизмы"
        },
      "russian_2": {
        "ans": "бесполезный",
        "pts": 1, "topic": "Словообразование"
        },
      "russian_3": {
        "ans": "девч…нка, плащ…м",
        "pts": 1, "topic": "Правописание О/Ё после шипящих"
        },
      "russian_4": {
        "ans": "(не) решительность, (не) подвижная вода",
        "pts": 1, "topic": "Слитное и раздельное написание НЕ"
        },
      "russian_5": {
        "ans": "пр…паять, пр…обрести, пр…усадебный",
        "pts": 1, "topic": "Правописание приставок ПРЕ- и ПРИ-"
        },
      "russian_6": {
        "ans": "к четырехстам прибавить пятьдесят.",
        "pts": 1, "topic": "Склонение числительных"
        },
      "russian_7": {
        "ans": "часть речи сказуемое —",
        "pts": 1, "topic": "Морфология"
        },
      "russian_8": {
        "ans": "из-под этой тучи вырвались яркие лучи, и мокрые леса и поля засверкали.",
        "pts": 1, "topic": "Пунктуация в ССП"
      }
      },
    "math": {

      "ma_3_new": { ans: "60/19", pts: 1 , topic: "Вычитание дробей" },
      "math_1": {
        "ans": "2∙3∙7",
        "pts": 1, "topic": "Простые множители"
        },
      "math_2": {
        "ans": "133050",
        "pts": 1, "topic": "Признаки делимости"
        },
      "math_3": {
        "ans": "19/60",
        "pts": 1, "topic": "Вычитание дробей"
        },
      "math_4": {
        "ans": "9",
        "pts": 1, "topic": "Координатная прямая (целые числа)"
        },
      "math_5": {
        "ans": "2 1/3",
        "pts": 1, "topic": "Действия со смешанными числами"
        },
      "math_6": {
        "ans": "4000",
        "pts": 1, "topic": "Дроби (Нахождение части от числа)"
        },
      "math_7": {
        "ans": "меньше",
        "pts": 1, "topic": "Единицы измерения и сравнение"
        },
      "math_8": {
        "ans": "63 : х = 7",
        "pts": 1, "topic": "Линейные уравнения"
        },
      "math_9": {
        "ans": "100 см²",
        "pts": 1, "topic": "Периметр и площадь"
        },
      "math_10": {
        "ans": "2 часа",
        "pts": 1, "topic": "Задачи на движение"
        },
      "math_11": {
        "ans": "59",
        "pts": 1, "topic": "Текстовые задачи"
      }
          },
        "logic": {
      "logic_1": {
        "ans": JSON.stringify({ "Белов": "Чёрная рубашка", "Серов": "Белая рубашка", "Чернов": "Серая рубашка" }),
        "pts": 1, "topic": "Логические матрицы"
        },
      "logic_2": {
        "ans": JSON.stringify({ "Ящик 1 (надпись «крупа»)": "Сахар", "Ящик 2 (надпись «вермишель»)": "Крупа", "Ящик 3 (надпись «крупа или сахар»)": "Вермишель" }),
        "pts": 1, "topic": "Задачи с ложными утверждениями"
        },
      "logic_3": {
        "ans": "",
        "pts": 1, "topic": "Упорядочивание и очереди"
        },
      "logic_4": {
        "ans": JSON.stringify({ "Олег": "Скрипач", "Коля": "Пианист", "Ваня": "Певец" }),
        "pts": 1, "topic": "Логические матрицы"
        },
      "logic_5": {
        "ans": "Уменьшилась в 2 раза",
        "pts": 1, "topic": "Проценты и доли"
        },
      "logic_6": {
        "ans": "60",
        "pts": 1, "topic": "Задачи на совместную работу"
        },
      "logic_7": {
        "ans": "8",
        "pts": 1, "topic": "Обратные вычисления"
        },
      "logic_8": {
        "ans": "240",
        "pts": 1, "topic": "Задачи на движение"
      }
    }
    },
  "8": {
    "russian": {

      "ru_8_new": { ans: "3) Посетитель кафе, зевая, заказал на обед рыбу жаренную в тесте.", pts: 1 , topic: "Пунктуация при обособленных членах" },
      "ru_9": { ans: JSON.stringify(["1", "5"]), pts: 1 , topic: "Пунктуация при обособленных членах" },
      "ru_10": { ans: JSON.stringify(["4", "12"]), pts: 1 , topic: "Пунктуация при обособленных членах" },
      "russian_1": {
        "ans": "расколотый орех",
        "pts": 1, "topic": "Причастие (Отличие от прилагательного)"
        },
      "russian_2": {
        "ans": "купив продукты",
        "pts": 1, "topic": "Деепричастие (Образование)"
        },
      "russian_3": {
        "ans": "стро…щийся дом",
        "pts": 1, "topic": "Правописание суффиксов причастий"
        },
      "russian_4": {
        "ans": "вид…мый свет",
        "pts": 1, "topic": "Правописание суффиксов причастий"
        },
      "russian_5": {
        "ans": "растаив",
        "pts": 1, "topic": "Правописание суффиксов деепричастий"
        },
      "russian_6": {
        "ans": "кова….ый сундук, картошка пожаре….а",
        "pts": 1, "topic": "Н и НН в причастиях"
        },
      "russian_7": {
        "ans": "(не) закрыв дверь",
        "pts": 1, "topic": "Правописание НЕ с деепричастиями"
        },
      "russian_8": {
        "ans": "3",
        "pts": 1, "topic": "Пунктуация при обособленных членах"
        },
      "russian_9": {
        "ans": "1, 3",
        "pts": 1, "topic": "Пунктуация при причастном обороте"
        },
      "russian_10": {
        "ans": "2, 4",
        "pts": 1, "topic": "Пунктуация при деепричастном обороте"
      }
      },
        "math": {
      "ma_1_8": { ans: "17x + 2", pts: 1 , topic: "Упрощение выражений" },
      "ma_2_8": { ans: "4n^4 + 19n^2 - 5", pts: 1 , topic: "Многочлены" },
      "ma_3_8": { ans: "39°", pts: 1 , topic: "Геометрия (Углы)" },
      "ma_4_8": { ans: "117°", pts: 1 , topic: "Геометрия (Углы)" },
      "ma_5_8": { ans: "(2a + c^2)(2a - c^2)(4a^2 - 2ac^2 + c^4)(4a^2 + 2ac^2 + c^4)", pts: 1 , topic: "Формулы сокращенного умножения" },
      "ma_6_8": { ans: "1/8", pts: 1 , topic: "Дроби и пропорции" },
      "ma_7_8": { ans: "10 ч", pts: 1 , topic: "Текстовые задачи" },
      "ma_8_8": { ans: "0", pts: 1 , topic: "Уравнения" },
      "ma_9_8": { ans: "11; 6; 6", pts: 1 , topic: "Геометрия (Треугольники)" },
      "ma_10_8": { ans: "100°", pts: 1 , topic: "Геометрия (Углы)" },
      "ma_11_8": { ans: "5; 9", pts: 1 , topic: "Системы уравнений" },
      "ma_12_8": { ans: "(-∞; -3)", pts: 1 , topic: "Неравенства" },
      "ma_13_8": { ans: "68°", pts: 1 , topic: "Геометрия (Углы)" },
      "ma_14_8": { ans: "соответственные углы равны", pts: 1 , topic: "Геометрия (Углы)" },
      "ma_15_8": { ans: "(a - b)(x - y)", pts: 1 , topic: "Разложение на множители" },
      "ma_16_8": { ans: "180°", pts: 1 , topic: "Геометрия (Углы)" },
      "ma_17_8": { ans: "AB = BC < AC", pts: 1 , topic: "Неравенство треугольника" },
      "ma_18_8": { ans: "2/5", pts: 1 , topic: "Дроби" },
      "ma_19_8": { ans: "8a^6 b^3", pts: 1 , topic: "Свойства степеней" },
      "ma_20_8": { ans: "-4", pts: 1 , topic: "Линейные уравнения" },
      "ma_21_8": { ans: "(4; 4)", pts: 1 , topic: "Системы уравнений" },
      "ma_22_8": { ans: "156000", pts: 1 , topic: "Задачи на проценты" },
    },
    "english": {
      "en_8_q1": { ans: "goes", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q2": { ans: "were watching", pts: 1 , topic: "Continuous Tenses" },
      "en_8_q3": { ans: "have / eaten", pts: 1 , topic: "Perfect Tenses" },
      "en_8_q4": { ans: "have lived", pts: 1 , topic: "Perfect Tenses" },
      "en_8_q5": { ans: "isn’t", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q6": { ans: "taller", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q7": { ans: "mustn’t", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q8": { ans: "might", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q9": { ans: "didn’t do", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q10": { ans: "the best", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q11": { ans: "wake up", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q12": { ans: "doesn’t like", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q13": { ans: "visited", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q14": { ans: "are playing", pts: 1 , topic: "Continuous Tenses" },
      "en_8_q15": { ans: "has already finished", pts: 1 , topic: "Perfect Tenses" },
      "en_8_q16": { ans: "have never been", pts: 1 , topic: "Perfect Tenses" },
      "en_8_q17": { ans: "was studying", pts: 1 , topic: "Continuous Tenses" },
      "en_8_q18": { ans: "are going", pts: 1 , topic: "Continuous Tenses" },
      "en_8_q19": { ans: "doesn’t understand", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q20": { ans: "have lived", pts: 1 , topic: "Perfect Tenses" },
      "en_8_q21": { ans: "of", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q22": { ans: "in", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q23": { ans: "at", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q24": { ans: "at", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q25": { ans: "at", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q26": { ans: "any", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q27": { ans: "much", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q28": { ans: "too", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q29": { ans: "many", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q30": { ans: "most", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q31": { ans: "easier", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q32": { ans: "the tallest", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q33": { ans: "smaller", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q34": { ans: "the worst", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q35": { ans: "more interesting", pts: 1 , topic: "Continuous Tenses" },
      "en_8_q36": { ans: "They didn't go to the party.", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q37": { ans: "There are many people in the room.", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q38": { ans: "I saw him yesterday.", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q39": { ans: "She can drive a car.", pts: 1 , topic: "Reading & Comprehension" },
      "en_8_q40": { ans: "We agree with you.", pts: 1 , topic: "Reading & Comprehension" },
    },
        "logic": {
      "logic_1": {
        "ans": JSON.stringify({ "Белов": "Чёрная рубашка", "Серов": "Белая рубашка", "Чернов": "Серая рубашка" }),
        "pts": 1, "topic": "Логические матрицы"
        },
      "logic_2": {
        "ans": JSON.stringify({ "Ящик 1 (надпись «крупа»)": "Сахар", "Ящик 2 (надпись «вермишель»)": "Крупа", "Ящик 3 (надпись «крупа или сахар»)": "Вермишель" }),
        "pts": 1, "topic": "Задачи с ложными утверждениями"
        },
      "logic_3": {
        "ans": "",
        "pts": 1, "topic": "Упорядочивание и очереди"
        },
      "logic_4": {
        "ans": JSON.stringify({ "Олег": "Скрипач", "Коля": "Пианист", "Ваня": "Певец" }),
        "pts": 1, "topic": "Логические матрицы"
        },
      "logic_5": {
        "ans": "Уменьшилась в 2 раза",
        "pts": 1, "topic": "Проценты и доли"
        },
      "logic_6": {
        "ans": "60",
        "pts": 1, "topic": "Задачи на совместную работу"
        },
      "logic_7": {
        "ans": "8",
        "pts": 1, "topic": "Обратные вычисления"
        },
      "logic_8": {
        "ans": "240",
        "pts": 1, "topic": "Задачи на движение"
      }
    }
    },
  "9": {
    "russian": {

      "ru_5_new": { ans: JSON.stringify({"input1":"НН","input2":"Н"}), pts: 1 , topic: "Н и НН в суффиксах" },
      "ru_7_new": { ans: JSON.stringify(["1", "4"]), pts: 1 , topic: "Вводные слова и обращения" },
      "ru_13_new": { ans: "Безличное предложение", pts: 1 , topic: "Типы односоставных предложений" },
      "ru_14_new": { ans: "2) Вторая часть указывает на причину того, о чём говорится в первой (можно вставить «потому что»).", pts: 1 , topic: "Смысловые отношения в БСП" },
      "russian_1": {
        "ans": "быстро бежать",
        "pts": 1, "topic": "Виды подчинительной связи (Примыкание)"
        },
      "russian_2": {
        "ans": "вставная конструкция",
        "pts": 1, "topic": "Осложняющие члены предложения (Вставные конструкции)"
        },
      "russian_3": {
        "ans": "иду по лесной тропинке.",
        "pts": 1, "topic": "Типы односоставных предложений (Определенно-личное)"
        },
      "russian_4": {
        "ans": "три ученика",
        "pts": 1, "topic": "Грамматическая основа"
        },
      "russian_5": {
        "ans": "неслыханная, решена",
        "pts": 1, "topic": "Н и НН в причастиях"
        },
      "russian_6": {
        "ans": "утомленные долгим путем туристы отдыхали.",
        "pts": 1, "topic": "Обособленные определения"
        },
      "russian_7": {
        "ans": "ветер, дующий с моря, принес прохладу.",
        "pts": 1, "topic": "Причастный оборот"
        },
      "russian_8": {
        "ans": "(не) закрыв дверь",
        "pts": 1, "topic": "Правописание НЕ с деепричастиями"
        },
      "russian_9": {
        "ans": "(не) навидевший",
        "pts": 1, "topic": "Правописание НЕ с причастиями"
        },
      "russian_10": {
        "ans": "закончив работу я пошел гулять.",
        "pts": 1, "topic": "Пунктуация при деепричастном обороте"
        },
      "russian_11": {
        "ans": "кажется дождь начинается.",
        "pts": 1, "topic": "Вводные слова"
        },
      "russian_12": {
        "ans": "составное глагольное.",
        "pts": 1, "topic": "Типы сказуемых"
        },
      "russian_13": {
        "ans": "ссп, 1-я часть безличная, 2-я двусоставная.",
        "pts": 1, "topic": "Синтаксический анализ сложного предложения"
        },
      "russian_14": {
        "ans": "двоеточие между частями бсп, запятая перед если не ставится из-за то",
        "pts": 1, "topic": "Пунктуация в бессоюзном и сложноподчиненном предложении"
      }
      },
        "math": {
      "ma_1_9": { ans: "6x/(x - y)", pts: 1 , topic: "Рациональные дроби" },
      "ma_2_9": { ans: "6 и 7", pts: 1 , topic: "Оценка значения выражений" },
      "ma_3_9": { ans: "0,8", pts: 1 , topic: "Преобразование выражений" },
      "ma_4_9": { ans: "√0,4 = 0,2", pts: 1 , topic: "Квадратные корни" },
      "ma_5_9": { ans: "-9 и 2", pts: 1 , topic: "Квадратные уравнения" },
      "ma_6_9": { ans: "y = 4/x", pts: 1 , topic: "Функции и графики" },
      "ma_7_9": { ans: "√24 см", pts: 1 , topic: "Геометрия (Теорема Пифагора)" },
      "ma_8_9": { ans: "√10", pts: 1 , topic: "Геометрия (Длина вектора)" },
      "ma_9_9": { ans: "120 см^2", pts: 1 , topic: "Геометрия (Площадь фигур)" },
      "ma_10_9": { ans: "40/(x-10) - 40/x = 1/3", pts: 1 , topic: "Текстовые задачи (Дробно-рациональные уравнения)" },
    },
    "english": {
      "en_9_q1": { ans: "had", pts: 1 , topic: "Perfect Tenses" },
      "en_9_q2": { ans: "had been", pts: 1 , topic: "Perfect Tenses" },
      "en_9_q3": { ans: "would call", pts: 1 , topic: "Future & Conditionals" },
      "en_9_q4": { ans: "was built", pts: 1 , topic: "Continuous Tenses" },
      "en_9_q5": { ans: "is going", pts: 1 , topic: "Continuous Tenses" },
      "en_9_q6": { ans: "have lost", pts: 1 , topic: "Perfect Tenses" },
      "en_9_q7": { ans: "whose", pts: 1 , topic: "Reading & Comprehension" },
      "en_9_q8": { ans: "rains", pts: 1 , topic: "Reading & Comprehension" },
      "en_9_q9": { ans: "had / left", pts: 1 , topic: "Perfect Tenses" },
      "en_9_q10": { ans: "had worked", pts: 1 , topic: "Perfect Tenses" },
      "en_9_q11": { ans: "to", pts: 1 , topic: "Reading & Comprehension" },
      "en_9_q12": { ans: "for", pts: 1 , topic: "Reading & Comprehension" },
      "en_9_q13": { ans: "on", pts: 1 , topic: "Reading & Comprehension" },
      "en_9_q14": { ans: "to", pts: 1 , topic: "Reading & Comprehension" },
      "en_9_q15": { ans: "from", pts: 1 , topic: "Reading & Comprehension" },
      "en_9_q16": { ans: "of", pts: 1 , topic: "Reading & Comprehension" },
      "en_9_q17": { ans: "of", pts: 1 , topic: "Reading & Comprehension" },
      "en_9_q18": { ans: "in", pts: 1 , topic: "Reading & Comprehension" },
      "en_9_q19": { ans: "in", pts: 1 , topic: "Reading & Comprehension" },
      "en_9_q20": { ans: "in", pts: 1 , topic: "Reading & Comprehension" },
      "en_9_q21": { ans: "have been waiting", pts: 1 , topic: "Perfect Tenses" },
      "en_9_q22": { ans: "was working", pts: 1 , topic: "Continuous Tenses" },
      "en_9_q23": { ans: "haven't finished", pts: 1 , topic: "Perfect Tenses" },
      "en_9_q24": { ans: "would come", pts: 1 , topic: "Future & Conditionals" },
      "en_9_q25": { ans: "were", pts: 1 , topic: "Continuous Tenses" },
      "en_9_q26": { ans: "had already eaten", pts: 1 , topic: "Perfect Tenses" },
      "en_9_q27": { ans: "was written", pts: 1 , topic: "Continuous Tenses" },
      "en_9_q28": { ans: "has been trying", pts: 1 , topic: "Perfect Tenses" },
      "en_9_q29": { ans: "was able to", pts: 1 , topic: "Continuous Tenses" },
      "en_9_q30": { ans: "were playing", pts: 1 , topic: "Continuous Tenses" },
      "en_9_q31": { ans: "mustn't", pts: 1 , topic: "Reading & Comprehension" },
      "en_9_q32": { ans: "might", pts: 1 , topic: "Reading & Comprehension" },
      "en_9_q33": { ans: "should", pts: 1 , topic: "Reading & Comprehension" },
      "en_9_q34": { ans: "could", pts: 1 , topic: "Reading & Comprehension" },
      "en_9_q35": { ans: "have to", pts: 1 , topic: "Perfect Tenses" },
      "en_9_q36": { ans: "She doesn't enjoy watching TV in the evening.", pts: 1 , topic: "Continuous Tenses" },
      "en_9_q37": { ans: "I saw him yesterday at the cinema.", pts: 1 , topic: "Reading & Comprehension" },
      "en_9_q38": { ans: "He was driving when the accident happened.", pts: 1 , topic: "Continuous Tenses" },
      "en_9_q39": { ans: "We didn't go to school yesterday.", pts: 1 , topic: "Reading & Comprehension" },
      "en_9_q40": { ans: "They have known each other for years.", pts: 1 , topic: "Perfect Tenses" },
      "en_9_q41": { ans: "If I see her, I will tell her.", pts: 1 , topic: "Future & Conditionals" },
      "en_9_q42": { ans: "She suggested going out for dinner.", pts: 1 , topic: "Continuous Tenses" },
      "en_9_q43": { ans: "If I knew about the problem, I would help you.", pts: 1 , topic: "Future & Conditionals" },
      "en_9_q44": { ans: "He said that he was busy.", pts: 1 , topic: "Continuous Tenses" },
      "en_9_q45": { ans: "I didn’t use to like coffee, but now I do.", pts: 1 , topic: "Reading & Comprehension" },
    },
        "logic": {
      "logic_1": {
        "ans": JSON.stringify({ "Белов": "Чёрная рубашка", "Серов": "Белая рубашка", "Чернов": "Серая рубашка" }),
        "pts": 1, "topic": "Логические матрицы"
        },
      "logic_2": {
        "ans": JSON.stringify({ "Ящик 1 (надпись «крупа»)": "Сахар", "Ящик 2 (надпись «вермишель»)": "Крупа", "Ящик 3 (надпись «крупа или сахар»)": "Вермишель" }),
        "pts": 1, "topic": "Задачи с ложными утверждениями"
        },
      "logic_3": {
        "ans": "",
        "pts": 1, "topic": "Упорядочивание и очереди"
        },
      "logic_4": {
        "ans": JSON.stringify({ "Олег": "Скрипач", "Коля": "Пианист", "Ваня": "Певец" }),
        "pts": 1, "topic": "Логические матрицы"
        },
      "logic_5": {
        "ans": "Уменьшилась в 2 раза",
        "pts": 1, "topic": "Проценты и доли"
        },
      "logic_6": {
        "ans": "60",
        "pts": 1, "topic": "Задачи на совместную работу"
        },
      "logic_7": {
        "ans": "8",
        "pts": 1, "topic": "Обратные вычисления"
        },
      "logic_8": {
        "ans": "240",
        "pts": 1, "topic": "Задачи на движение"
      }
    }
    },
  "10": {
    "russian": {

      "ru_2_new": { ans: "ПРОСВЕТИТЕЛЬСКИЙ", pts: 1 , topic: "Лексика (Паронимы)" },
      "ru_8_new": { ans: "ПОЭТОМУ ТАКЖЕ", pts: 1 , topic: "Слитное/раздельное написание союзов" },
      "russian_1": {
        "ans": "газопровод",
        "pts": 1, "topic": "Орфоэпия (Ударения)"
        },
      "russian_2": {
        "ans": "лесной",
        "pts": 1, "topic": "Словообразование"
        },
      "russian_3": {
        "ans": "туманы здесь бывают если не каждый день то через день непременно.",
        "pts": 1, "topic": "Пунктуация при однородных членах"
        },
      "russian_4": {
        "ans": "м..литва",
        "pts": 1, "topic": "Безударные гласные в корне"
        },
      "russian_5": {
        "ans": "пред..явить, с..езд;",
        "pts": 1, "topic": "Разделительные Ъ и Ь"
        },
      "russian_6": {
        "ans": "забол…ва",
        "pts": 1, "topic": "Правописание суффиксов глаголов"
        },
      "russian_7": {
        "ans": "ирина андреевна говорила (не)громко, но очень выразительно.",
        "pts": 1, "topic": "Слитное и раздельное написание НЕ"
        },
      "russian_8": {
        "ans": "5",
        "pts": 1, "topic": "Пунктуация в сложном предложении"
        },
      "russian_9": {
        "ans": "1, 2, 3, 4, 5",
        "pts": 1, "topic": "Обособленные члены предложения"
        },
      "russian_10": {
        "ans": "3, 4",
        "pts": 1, "topic": "Пунктуация в сложном предложении"
      }
      },
        "math": {
      "ma_1_10": { ans: "1/2", pts: 1 , topic: "Вычисления с дробями" },
      "ma_2_10": { ans: "6,2", pts: 1 , topic: "Текстовые задачи" },
      "ma_3_10": { ans: "41,82", pts: 1 , topic: "Текстовые задачи (Проценты)" },
      "ma_4_10": { ans: "98т", pts: 1 , topic: "Текстовые задачи" },
      "ma_5_10": { ans: "1,34", pts: 1 , topic: "Вычисления (Десятичные дроби)" },
      "ma_6_10": { ans: "25√2", pts: 1 , topic: "Свойства квадратных корней" },
      "ma_7_10": { ans: "x^5", pts: 1 , topic: "Свойства степеней" },
      "ma_8_10": { ans: "-26a^2 + 23a + 9", pts: 1 , topic: "Многочлены" },
      "ma_9_10": { ans: "(a+b)/ab", pts: 1 , topic: "Рациональные дроби" },
      "ma_10_10": { ans: "a^9", pts: 1 , topic: "Свойства степеней" },
      "ma_11_10": { ans: "-3", pts: 1 , topic: "Квадратные уравнения" },
      "ma_12_10": { ans: "(-3; 0)", pts: 1 , topic: "Графики функций (Парабола)" },
      "ma_13_10": { ans: "-1,5", pts: 1 , topic: "Системы уравнений" },
      "ma_14_10": { ans: "ни одного", pts: 1 , topic: "Линейные уравнения" },
      "ma_15_10": { ans: "-4", pts: 1 , topic: "Квадратные уравнения" },
      "ma_16_10": { ans: "-6", pts: 1 , topic: "Системы уравнений" },
      "ma_17_10": { ans: "(3; +∞)", pts: 1 , topic: "Линейные неравенства" },
      "ma_18_10": { ans: "6", pts: 1 , topic: "Системы неравенств" },
      "ma_19_10": { ans: "(-∞; 15]", pts: 1 , topic: "Линейные неравенства" },
      "ma_20_10": { ans: "y = -x^2 + 4x - 3", pts: 1 , topic: "Графики функций (Квадратичная)" },
      "ma_21_10": { ans: "2", pts: 1 , topic: "Прогрессии" },
        },
    "english": {
      "en_10_11_q1": { ans: "had left", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q2": { ans: "had finished", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q3": { ans: "had been", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q4": { ans: "told", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q5": { ans: "told", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q6": { ans: "can’t", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q7": { ans: "better", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q8": { ans: "taking", pts: 1 , topic: "Continuous Tenses" },
      "en_10_11_q9": { ans: "had", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q10": { ans: "was using", pts: 1 , topic: "Continuous Tenses" },
      "en_10_11_q11": { ans: "worked", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q12": { ans: "has been", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q13": { ans: "will be lying", pts: 1 , topic: "Future & Conditionals" },
      "en_10_11_q14": { ans: "will be having", pts: 1 , topic: "Future & Conditionals" },
      "en_10_11_q15": { ans: "boils", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q16": { ans: "is said", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q17": { ans: "got", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q18": { ans: "waking", pts: 1 , topic: "Continuous Tenses" },
      "en_10_11_q19": { ans: "had known", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q20": { ans: "had worked", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q21": { ans: "hadn’t said", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q22": { ans: "has been fixing", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q23": { ans: "will have built", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q24": { ans: "would finish", pts: 1 , topic: "Future & Conditionals" },
      "en_10_11_q25": { ans: "were", pts: 1 , topic: "Continuous Tenses" },
      "en_10_11_q26": { ans: "haven’t completed", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q27": { ans: "breaking", pts: 1 , topic: "Continuous Tenses" },
      "en_10_11_q28": { ans: "had been waiting", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q29": { ans: "If I had known, I would have helped you.", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q30": { ans: "He told me that he would come later.", pts: 1 , topic: "Future & Conditionals" },
      "en_10_11_q31": { ans: "I have already seen this film.", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q32": { ans: "She suggested taking a break.", pts: 1 , topic: "Continuous Tenses" },
      "en_10_11_q33": { ans: "The project was completed by them.", pts: 1 , topic: "Continuous Tenses" },
      "en_10_11_q34": { ans: "I look forward to hearing from you.", pts: 1 , topic: "Continuous Tenses" },
      "en_10_11_q35": { ans: "however", pts: 1 , topic: "Linking Words" },
      "en_10_11_q36": { ans: "despite", pts: 1 , topic: "Linking Words" },
      "en_10_11_q37": { ans: "nevertheless", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q38": { ans: "whereas", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q39": { ans: "while", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q40": { ans: "in spite of", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q41": { ans: "She has been looking for a job for six months.", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q42": { ans: "I remember to lock the door before leaving.", pts: 1 , topic: "Continuous Tenses" },
      "en_10_11_q43": { ans: "I would rather stay at home than go out.", pts: 1 , topic: "Future & Conditionals" },
      "en_10_11_q44": { ans: "Despite the heavy rain, they went out.", pts: 1 , topic: "Linking Words" },
      "en_10_11_q45": { ans: "Try pressing this button to see if it works.", pts: 1 , topic: "Continuous Tenses" },
    },
        "logic": {
      "logic_1": {
        "ans": JSON.stringify({ "Белов": "Чёрная рубашка", "Серов": "Белая рубашка", "Чернов": "Серая рубашка" }),
        "pts": 1, "topic": "Логические матрицы"
        },
      "logic_2": {
        "ans": JSON.stringify({ "Ящик 1 (надпись «крупа»)": "Сахар", "Ящик 2 (надпись «вермишель»)": "Крупа", "Ящик 3 (надпись «крупа или сахар»)": "Вермишель" }),
        "pts": 1, "topic": "Задачи с ложными утверждениями"
        },
      "logic_3": {
        "ans": "",
        "pts": 1, "topic": "Упорядочивание и очереди"
        },
      "logic_4": {
        "ans": JSON.stringify({ "Олег": "Скрипач", "Коля": "Пианист", "Ваня": "Певец" }),
        "pts": 1, "topic": "Логические матрицы"
        },
      "logic_5": {
        "ans": "Уменьшилась в 2 раза",
        "pts": 1, "topic": "Проценты и доли"
        },
      "logic_6": {
        "ans": "60",
        "pts": 1, "topic": "Задачи на совместную работу"
        },
      "logic_7": {
        "ans": "8",
        "pts": 1, "topic": "Обратные вычисления"
        },
      "logic_8": {
        "ans": "240",
        "pts": 1, "topic": "Задачи на движение"
      }
    }
    },
  "11": {
    "russian": {
      "russian_1": {
        "ans": "заперла",
        "pts": 1, "topic": "Орфоэпия (Ударения)"
        },
      "russian_2": {
        "ans": "наличии",
        "pts": 1, "topic": "Морфологические нормы"
        },
      "russian_3": {
        "ans": "сложноподчиненное",
        "pts": 1, "topic": "Синтаксический анализ предложения"
        },
      "russian_4": {
        "ans": "выт..реть",
        "pts": 1, "topic": "Чередующиеся гласные в корне"
        },
      "russian_5": {
        "ans": "6",
        "pts": 1, "topic": "Пунктуация в сложном предложении"
        },
      "russian_6": {
        "ans": "проста…вать",
        "pts": 1, "topic": "Правописание суффиксов глаголов"
        },
      "russian_7": {
        "ans": "(не) дерзал",
        "pts": 1, "topic": "Слитное и раздельное написание НЕ"
        },
      "russian_8": {
        "ans": "4",
        "pts": 1, "topic": "Слитное, дефисное, раздельное написание"
        },
      "russian_9": {
        "ans": "2, 4",
        "pts": 1, "topic": "Пунктуация в сложноподчиненном предложении"
        },
      "russian_10": {
        "ans": "3, 5",
        "pts": 1, "topic": "Пунктуация в сложном предложении с разными видами связи"
      }
      },
        "math": {
      "ma_1_11": { ans: "1", pts: 1 , topic: "Логарифмические выражения" },
      "ma_2_11": { ans: "2", pts: 1 , topic: "Свойства степеней и корней" },
      "ma_3_11": { ans: "±π/6 + πn, n ∈ Z", pts: 1 , topic: "Тригонометрические уравнения" },
      "ma_4_11": { ans: "[-2;-1,5]u(1,75;+infty)", pts: 1 , topic: "Решение неравенств (Метод интервалов)" },
      "ma_5_11": { ans: "[-11; 11]", pts: 1 , topic: "Область определения функции / Неравенства" },
      "ma_6_11": { ans: "6xcosx-3x^2sinx", pts: 1 , topic: "Производная функции" },
      "ma_7_11": { ans: "1.5", pts: 1 , topic: "Стереометрия / Планиметрия" },
      "ma_8_11": { ans: "6", pts: 1 , topic: "Текстовые задачи" },
    },
    "english": {
      "en_10_11_q1": { ans: "had left", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q2": { ans: "had finished", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q3": { ans: "had been", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q4": { ans: "told", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q5": { ans: "told", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q6": { ans: "can’t", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q7": { ans: "better", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q8": { ans: "taking", pts: 1 , topic: "Continuous Tenses" },
      "en_10_11_q9": { ans: "had", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q10": { ans: "was using", pts: 1 , topic: "Continuous Tenses" },
      "en_10_11_q11": { ans: "worked", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q12": { ans: "has been", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q13": { ans: "will be lying", pts: 1 , topic: "Future & Conditionals" },
      "en_10_11_q14": { ans: "will be having", pts: 1 , topic: "Future & Conditionals" },
      "en_10_11_q15": { ans: "boils", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q16": { ans: "is said", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q17": { ans: "got", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q18": { ans: "waking", pts: 1 , topic: "Continuous Tenses" },
      "en_10_11_q19": { ans: "had known", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q20": { ans: "had worked", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q21": { ans: "hadn’t said", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q22": { ans: "has been fixing", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q23": { ans: "will have built", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q24": { ans: "would finish", pts: 1 , topic: "Future & Conditionals" },
      "en_10_11_q25": { ans: "were", pts: 1 , topic: "Continuous Tenses" },
      "en_10_11_q26": { ans: "haven’t completed", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q27": { ans: "breaking", pts: 1 , topic: "Continuous Tenses" },
      "en_10_11_q28": { ans: "had been waiting", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q29": { ans: "If I had known, I would have helped you.", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q30": { ans: "He told me that he would come later.", pts: 1 , topic: "Future & Conditionals" },
      "en_10_11_q31": { ans: "I have already seen this film.", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q32": { ans: "She suggested taking a break.", pts: 1 , topic: "Continuous Tenses" },
      "en_10_11_q33": { ans: "The project was completed by them.", pts: 1 , topic: "Continuous Tenses" },
      "en_10_11_q34": { ans: "I look forward to hearing from you.", pts: 1 , topic: "Continuous Tenses" },
      "en_10_11_q35": { ans: "however", pts: 1 , topic: "Linking Words" },
      "en_10_11_q36": { ans: "despite", pts: 1 , topic: "Linking Words" },
      "en_10_11_q37": { ans: "nevertheless", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q38": { ans: "whereas", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q39": { ans: "while", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q40": { ans: "in spite of", pts: 1 , topic: "Reading & Comprehension" },
      "en_10_11_q41": { ans: "She has been looking for a job for six months.", pts: 1 , topic: "Perfect Tenses" },
      "en_10_11_q42": { ans: "I remember to lock the door before leaving.", pts: 1 , topic: "Continuous Tenses" },
      "en_10_11_q43": { ans: "I would rather stay at home than go out.", pts: 1 , topic: "Future & Conditionals" },
      "en_10_11_q44": { ans: "Despite the heavy rain, they went out.", pts: 1 , topic: "Linking Words" },
      "en_10_11_q45": { ans: "Try pressing this button to see if it works.", pts: 1 , topic: "Continuous Tenses" },
    },
        "logic": {
      "logic_1": {
        "ans": JSON.stringify({ "Белов": "Чёрная рубашка", "Серов": "Белая рубашка", "Чернов": "Серая рубашка" }),
        "pts": 1, "topic": "Логические матрицы"
        },
      "logic_2": {
        "ans": JSON.stringify({ "Ящик 1 (надпись «крупа»)": "Сахар", "Ящик 2 (надпись «вермишель»)": "Крупа", "Ящик 3 (надпись «крупа или сахар»)": "Вермишель" }),
        "pts": 1, "topic": "Задачи с ложными утверждениями"
        },
      "logic_3": {
        "ans": "",
        "pts": 1, "topic": "Упорядочивание и очереди"
        },
      "logic_4": {
        "ans": JSON.stringify({ "Олег": "Скрипач", "Коля": "Пианист", "Ваня": "Певец" }),
        "pts": 1, "topic": "Логические матрицы"
        },
      "logic_5": {
        "ans": "Уменьшилась в 2 раза",
        "pts": 1, "topic": "Проценты и доли"
        },
      "logic_6": {
        "ans": "60",
        "pts": 1, "topic": "Задачи на совместную работу"
        },
      "logic_7": {
        "ans": "8",
        "pts": 1, "topic": "Обратные вычисления"
        },
      "logic_8": {
        "ans": "240",
        "pts": 1, "topic": "Задачи на движение"
      }
    }
  }
};

function sanitize(input) {
  if (typeof input !== 'string') return input;
  let sanitized = input.replace(/[<>]/g, ''); 
  if (/^[=+\-@]/.test(sanitized)) {
    sanitized = "'" + sanitized;
  }
  return sanitized;
}

function normalizeString(str) {
  if (typeof str !== 'string') return "";
  let s = str.toLowerCase().replace(/\s+/g, "");
  // Replace Cyrillic / Text issues
  s = s.replace(/ё/g, "е").replace(/…/g, ".");
  // Map exponents
  s = s.replace(/²/g, "^2").replace(/³/g, "^3").replace(/⁴/g, "^4").replace(/⁵/g, "^5").replace(/⁶/g, "^6");
  // Normalize Math Symbols / LaTeX
  s = s.replace(/≤/g, "<=").replace(/\\le/g, "<=");
  s = s.replace(/≥/g, ">=").replace(/\\ge/g, ">=");
  s = s.replace(/±/g, "+-").replace(/\\pm/g, "+-");
  s = s.replace(/π/g, "pi").replace(/\\pi/g, "pi");
  s = s.replace(/√/g, "sqrt").replace(/\\sqrt/g, "sqrt");
  s = s.replace(/∈/g, "in").replace(/\\in/g, "in");
  s = s.replace(/∞/g, "infty").replace(/\\infty/g, "infty");
  // Specific Logs
  s = s.replace(/log₃/g, "log_3").replace(/\\log_3/g, "log_3");
  s = s.replace(/log₅/g, "log_5").replace(/\\log_5/g, "log_5");
  // Remove formatting braces and text
  s = s.replace(/\\text/g, "").replace(/[{}]/g, "");
  s = s.replace(/∪/g, "u");
  // Greek letters
  s = s.replace(/α/g, "alpha").replace(/\\alpha/g, "alpha");
  return s;
}

function calculateScores(grade, answers) {
  const keys = ANSWER_KEYS[String(grade)];
  if (!keys) return { scores: { russian: 0, math: 0, logic: 0, english: 0 }, diagnosticsRaw: {} };
  
  

const MACRO_MAP = {
  "russian": [
    { macro: "Орфография", keywords: ["Орфография", "суффикс", "Гласная", "НН", "НЕ", "приставк", "корень", "слитное", "дефисное", "раздельное"] },
    { macro: "Пунктуация", keywords: ["Пунктуация", "запятые", "оборот", "Вводные", "БСП", "ССП", "СПО", "обособлен", "однородн"] },
    { macro: "Синтаксис и Грамматика", keywords: ["Синтаксис", "Грамматика", "основа", "односостав", "сказуем", "связи", "словосочетан", "морфология", "склонение"] },
    { macro: "Лексика и Речь", keywords: ["Лексика", "Пароним", "Фразеологизм", "Ударение", "Орфоэпия", "смыслов", "значение", "обращения"] }
  ],
  "math": [
    { macro: "Алгебра и Вычисления", keywords: ["дроби", "корни", "выражен", "числа", "степен", "многочлен", "прогресси", "умножения"] },
    { macro: "Уравнения и Неравенства", keywords: ["уравнен", "неравенств", "систем", "интервал"] },
    { macro: "Функции и Графики", keywords: ["Функци", "график", "парабол", "гипербол", "производная", "логарифм", "тригонометр"] },
    { macro: "Геометрия", keywords: ["Геометрия", "Пифагор", "треугольник", "вектор", "площадь", "угол", "углы", "стереометрия", "планиметрия"] },
    { macro: "Текстовые задачи", keywords: ["Текстовые", "движение", "работу", "проценты", "вероятность", "доли", "совместную"] }
  ],
  "logic": [
    { macro: "Логическое мышление", keywords: ["Логика", "матрицы", "очереди", "утверждения", "загадки", "вычисления", "работу"] }
  ],
  "english": [
    { macro: "Grammar: Tenses", keywords: ["Tense", "Present", "Past", "Future", "Perfect", "Continuous"] },
    { macro: "Grammar: Conditionals & Modals", keywords: ["Conditionals", "Modal", "If"] },
    { macro: "Vocabulary & Structure", keywords: ["Prepositions", "Vocabulary", "Order", "Correction", "Words", "Quantifiers", "Comparatives", "Phrasal", "Linking", "Reading", "Comprehension", "Reordering"] }
  ]
};

function getMacroCategory(topicText, subjectKey) {
  if (!topicText) return "Основные навыки";
  let map = MACRO_MAP[subjectKey] || [];
  for (let item of map) {
    if (item.keywords.some(kw => topicText.toLowerCase().includes(kw.toLowerCase()))) {
      return item.macro;
    }
  }
  return "Основные навыки";
}


  let ru = 0, ma = 0, lo = 0, en = 0;
  let diagnosticsRaw = {};
  
  function initPossible(subject, keyMap) {
    Object.keys(keyMap).forEach(qId => {
      let qData = keyMap[qId];
      if (!qData.topic || qData.topic === "Общая тема") return;
      let macro = getMacroCategory(qData.topic, subject);
      if (!diagnosticsRaw[macro]) diagnosticsRaw[macro] = { earned: 0, possible: 0, subject: subject };
      diagnosticsRaw[macro].possible += (qData.pts || 1);
    });
  }
  
  function addEarned(subject, qId, keyMap, isCorrect) {
    if (!isCorrect) return;
    let qData = keyMap[qId];
    if (!qData.topic || qData.topic === "Общая тема") return;
    let macro = getMacroCategory(qData.topic, subject);
    if (diagnosticsRaw[macro]) {
      diagnosticsRaw[macro].earned += (qData.pts || 1);
    }
  }

  initPossible("russian", keys.russian || {});
  initPossible("math", keys.math || {});
  initPossible("logic", keys.logic || {});
  initPossible("english", keys.english || {});

  if (answers && typeof answers === 'object') {
    Object.keys(keys.russian || {}).forEach(qId => {
      let userAnsStr = answers[qId] ? String(answers[qId]).trim() : "";
      let userAnsLower = userAnsStr.toLowerCase();
      let pts = keys.russian[qId].pts || 1;
      let isCorrect = false;
      
      if (String(grade) === "11" && qId === "russian_2") {
        let parts = userAnsLower.split("|");
        let optChoice = parts[0] ? parts[0].trim() : "";
        let wordChoice = parts[1] ? parts[1].trim() : "";
        if (optChoice === "2" && (wordChoice === "наличие" || wordChoice === "наличии")) isCorrect = true;
      } else if (String(grade) === "11" && qId === "russian_8") {
        let parts = userAnsLower.split("|");
        let optChoice = parts[0] ? parts[0].trim() : "";
        let wordChoice = parts[1] ? parts[1].replace(/\s+/g, '').trim() : "";
        if (optChoice === "4" && (wordChoice === "кверхутотчас" || wordChoice === "тотчаскверху")) isCorrect = true;
      } else if (qId === "ru_5_new") {
        try {
          let userObj = JSON.parse(userAnsStr);
          let val1 = String(userObj["input1"] || "").trim().toLowerCase();
          let val2 = String(userObj["input2"] || "").trim().toLowerCase();
          if (val1 === "нн" && val2 === "н") isCorrect = true;
        } catch(e) {}
      } else if (qId === "ru_8_new" && String(grade) === "10") {
        let val = userAnsLower.replace(/\s+/g, "");
        if (val === "такжепоэтому" || val === "поэтомутакже") isCorrect = true;
      } else if (qId === "ru_7_new" && String(grade) === "7") {
        try {
          let userObj = JSON.parse(userAnsStr);
          let correctObj = JSON.parse(keys.russian[qId].ans);
          isCorrect = true;
          for (let k in correctObj) { if (userObj[k] !== correctObj[k]) isCorrect = false; }
          for (let k in userObj) { if (userObj[k] !== correctObj[k]) isCorrect = false; }
          if (Object.keys(correctObj).length === 0) isCorrect = false;
        } catch(e) {}
      } else if ((qId === "ru_9" || qId === "ru_10" || qId === "ru_7_new") && keys.russian[qId].ans.startsWith("[")) {
        try {
          let userArr = JSON.parse(userAnsStr);
          let correctArr = JSON.parse(keys.russian[qId].ans);
          if (Array.isArray(userArr) && Array.isArray(correctArr)) {
            userArr.sort();
            correctArr.sort();
            if (userArr.join(",") === correctArr.join(",")) isCorrect = true;
          }
        } catch(e) {}
      } else {
        if (userAnsLower === keys.russian[qId].ans.toLowerCase()) isCorrect = true;
      }
      
      if (isCorrect) {
        ru += pts;
        addEarned("russian", qId, keys.russian, true);
      }
    });

    Object.keys(keys.math || {}).forEach(qId => {
      let userAns = answers[qId] ? String(answers[qId]).trim() : "";
      let pts = keys.math[qId].pts || 1;
      let isCorrect = normalizeString(userAns) === normalizeString(keys.math[qId].ans);
      
      if (isCorrect) {
        ma += pts;
        addEarned("math", qId, keys.math, true);
      }
    });

    Object.keys(keys.logic || {}).forEach(qId => {
      let userAnsStr = answers[qId] ? String(answers[qId]).trim() : "";
      let userAnsLower = userAnsStr.toLowerCase();
      let pts = keys.logic[qId].pts || 1;
      let isCorrect = false;
      
      if (keys.logic[qId].ans.startsWith("{")) {
        try {
          let userObj = JSON.parse(userAnsStr);
          let correctObj = JSON.parse(keys.logic[qId].ans);
          isCorrect = true;
          for (let k in correctObj) {
            if (String(userObj[k] || "").toLowerCase() !== String(correctObj[k]).toLowerCase()) {
              isCorrect = false;
            }
          }
        } catch(e) {}
      } else if (qId === "logic_3") {
        let val = userAnsLower.replace(/\s+/g, "");
        if (val === "митя,толя" || val === "митя, толя" || val === "митя толя") isCorrect = true;
      } else {
        if (userAnsLower === keys.logic[qId].ans.toLowerCase()) isCorrect = true;
      }
      
      if (isCorrect) {
        lo += pts;
        addEarned("logic", qId, keys.logic, true);
      }
    });

    Object.keys(keys.english || {}).forEach(qId => {
      let userAnsStr = answers[qId] ? String(answers[qId]).trim() : "";
      let pts = keys.english[qId].pts || 1;
      let isCorrect = false;
      
      if (keys.english[qId].ans.startsWith("{")) {
        try {
          let userObj = JSON.parse(userAnsStr);
          let correctObj = JSON.parse(keys.english[qId].ans);
          isCorrect = true;
          for (let k in correctObj) {
            if (String(userObj[k] || "").trim().toLowerCase() !== String(correctObj[k]).trim().toLowerCase()) {
              isCorrect = false;
            }
          }
        } catch(e) {}
      } else {
        if (userAnsStr.toLowerCase() === keys.english[qId].ans.toLowerCase()) isCorrect = true;
      }

      if (isCorrect) {
        en += pts;
        addEarned("english", qId, keys.english, true);
      }
    });
  }

  return { scores: { russian: ru, math: ma, logic: lo, english: en }, diagnosticsRaw };
}

function generateDiagnosticReport(diagnosticsRaw) {
  let strengths = [];
  let average = [];
  let weaknesses = [];

  for (const [topic, stats] of Object.entries(diagnosticsRaw)) {
    if (stats.possible === 0) continue;
    const percentage = (stats.earned / stats.possible) * 100;
    
    if (percentage >= 70) strengths.push(topic);
    else if (percentage >= 50) average.push(topic);
    else weaknesses.push(topic);
  }

  let reportText = "";
  if (strengths.length > 0) reportText += "🟢 СИЛЬНЫЕ СТОРОНЫ:\n" + strengths.join(", ") + "\n\n";
  if (average.length > 0) reportText += "🟡 СРЕДНИЙ УРОВЕНЬ:\n" + average.join(", ") + "\n\n";
  if (weaknesses.length > 0) reportText += "🔴 ЗОНА РОСТА (Нужно подтянуть):\n" + weaknesses.join(", ");

  return reportText.trim() || "Недостаточно данных для анализа.";
}

function getTestByShortId(testSheet, shortId) {
  const data = testSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    // shortId is in column 10 (index 10)
    if (String(data[i][10]) === String(shortId)) {
      return {
        row: i + 1,
        shortId: shortId,
        studentName: data[i][1],
        grade: data[i][2],
        russian: data[i][3],
        math: data[i][4],
        logic: data[i][5],
        english: data[i][12],
        diagnosticsReport: data[i][13],
        totalScore: data[i][6],
        testId: data[i][7],
        timestamp: data[i][8],
        cheated: data[i][9] === "ДА",
        diagnosticsRaw: (() => { try { return JSON.parse(data[i][14] || "{}"); } catch(e) { return {}; } })()
      };
    }
  }
  return null;
}

  function getCrmByShortId(crmSheet, shortId, testSheet) {
    const data = crmSheet.getDataRange().getValues();
    let crmStudent = null;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][4]) === String(shortId)) {
        crmStudent = {
          row: i + 1,
          date: data[i][0],
          managerName: data[i][1],
          parentName: data[i][2],
          phone: data[i][3],
          shortId: data[i][4],
          stage: data[i][5],
          paymentInfo: data[i][6],
          initialFee: data[i][7],
          totalCost: data[i][8],
          firstMonthPayment: data[i][9],
          sentToPsych: data[i][10],
          psychVerdict: data[i][11],
          psychComment: data[i][12],
          finalDecision: data[i][13],
          rejectReason: data[i][14],
          childName: data[i][15],
          ru: data[i][16],
          ma: data[i][17],
          lo: data[i][18],
          managerComment: data[i][19],
          cheated: false
        };
        break;
      }
    }
    
    // Cross-reference testSheet for cheated flag
    if (crmStudent && testSheet) {
      const testStudent = getTestByShortId(testSheet, shortId);
      if (testStudent) {
        crmStudent.cheated = testStudent.cheated;
      }
    }
    
    return crmStudent;
  }


function safeSetValue(sheet, row, col, value) {
  if (sheet.getMaxColumns() < col) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), col - sheet.getMaxColumns());
  }
  sheet.getRange(row, col).setValue(value);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    // Вставьте сюда тот же ключ, что и в VITE_GAS_API_KEY на Vercel
    const VALID_API_KEY = "GRAND_CIRCLE_SECURE_API_KEY_2026";
    
    // Validate API Key for all actions except maybe some strictly public ones, 
    // but since we proxy EVERYTHING through Vercel, everything must have the API key!
    if (data.apiKey !== VALID_API_KEY) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unauthorized: Invalid API Key" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let testSheet = ss.getSheetByName(SHEET_TESTS);
    let crmSheet = ss.getSheetByName(SHEET_CRM);
    
    if (testSheet.getLastRow() === 0) {
      testSheet.appendRow(["Дата", "ФИО Ученика", "Класс", "Русский язык", "Математика", "Логика", "Общий балл", "Уникальный ID теста", "Timestamp", "Читерство", "Short ID", "Ответы ученика (JSON)", "Английский язык", "Диагностика", "Аналитика JSON"]);
    }
    if (crmSheet.getLastRow() === 0) {
      crmSheet.appendRow(["Дата", "Менеджер", "ФИО Родителя", "Номер телефона", "ID Теста (ученика)", "Стадия работы", "Оплата до.инфо", "Взнос", "Общая стоимость", "Оплата -1-месяц", "К психологу?", "Вердикт", "Комментарий психолога", "Финальное решение", "Причина отказа", "Имя ребенка", "Русский", "Математика", "Логика", "Комментарий менеджера", "Английский"]);
    }

    if (action === "submitTest") {
      const { testId, shortId, studentName, grade, answers, cheated, isTester } = data;
      
      const dataRange = testSheet.getDataRange().getValues();
      const safeName = sanitize(studentName || "Без имени");
      const finalName = isTester ? `[ТЕСТ] ${safeName}` : safeName;
      const now = new Date().getTime();
      
      for (let i = 1; i < dataRange.length; i++) {
        if (String(dataRange[i][7]) === String(testId) || String(dataRange[i][10]) === String(shortId)) {
          return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Test already submitted" })).setMimeType(ContentService.MimeType.JSON);
        }
        
        // Prevent same name from submitting within 1 hour, UNLESS manager already processed them
        if (!isTester) {
          const rowName = dataRange[i][1];
          const rowTime = dataRange[i][8];
          const rowShortId = dataRange[i][10];
          
          if (rowName === safeName && (now - Number(rowTime)) < 60 * 60 * 1000) {
             const crmStudent = getCrmByShortId(crmSheet, rowShortId, null);
             const isProcessed = crmStudent && (crmStudent.finalDecision === "ПРИНЯТ" || crmStudent.finalDecision === "ОТКЛОНЕН");
             
             if (!isProcessed) {
               return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Вы уже сдавали тест в течение последнего часа." })).setMimeType(ContentService.MimeType.JSON);
             }
          }
        }
      }

      let scores = { russian: 0, math: 0, logic: 0, english: 0 };
      let diagnosticsReport = "";
      let diagnosticsRawStr = "{}";
      if (!cheated) {
        const calc = calculateScores(grade, answers);
        scores = calc.scores;
        diagnosticsReport = generateDiagnosticReport(calc.diagnosticsRaw);
        diagnosticsRawStr = JSON.stringify(calc.diagnosticsRaw || {});
      }
      const totalScore = scores.russian + scores.math + scores.logic;
      
      const ts = new Date().getTime();
      const answersStr = JSON.stringify(answers || {});
      testSheet.appendRow([new Date(ts).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }), finalName, grade, scores.russian, scores.math, scores.logic, totalScore, testId, ts, cheated ? "ДА" : "НЕТ", shortId, answersStr, scores.english, diagnosticsReport, diagnosticsRawStr]);
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, totalScore, scores, diagnosticsReport, cheated: !!cheated })).setMimeType(ContentService.MimeType.JSON);
    }
    
    
    if (action === "submitEnglishTest") {
      const { shortId, grade, answers, cheated } = data;
      
      const testData = testSheet.getDataRange().getValues();
      let testRowIdx = -1;
      let previousAnswersStr = "{}";
      
      for (let i = 1; i < testData.length; i++) {
        if (String(testData[i][10]) === String(shortId)) {
          testRowIdx = i + 1;
          previousAnswersStr = testData[i][11] || "{}"; // assuming answers is col 12 (idx 11)
          break;
        }
      }
      
      if (testRowIdx === -1) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Основной тест не найден по этому ID" })).setMimeType(ContentService.MimeType.JSON);
      }
      
      let allAnswers = {};
      try { allAnswers = JSON.parse(previousAnswersStr); } catch(e) {}
      // merge english answers
      Object.assign(allAnswers, answers);
      
      let scores = { english: 0 };
      let diagnosticsReport = "";
      let diagnosticsRawStr = "{}";
      if (!cheated) {
        const calc = calculateScores(grade, allAnswers);
        scores = calc.scores;
        diagnosticsReport = generateDiagnosticReport(calc.diagnosticsRaw);
        diagnosticsRawStr = JSON.stringify(calc.diagnosticsRaw || {});
      }
      
      // Update English score in testSheet (Column 13 - M)
      safeSetValue(testSheet, testRowIdx, 13, scores.english);
      
      // Update Diagnostics Report in testSheet (Column 14 - N)
      safeSetValue(testSheet, testRowIdx, 14, diagnosticsReport);

      // Update Diagnostics JSON in testSheet (Column 15 - O)
      safeSetValue(testSheet, testRowIdx, 15, diagnosticsRawStr);
      
      // Also update CRM sheet if the manager has already created a row
      const crmData = crmSheet.getDataRange().getValues();
      for (let i = 1; i < crmData.length; i++) {
        if (String(crmData[i][4]) === String(shortId)) {
          safeSetValue(crmSheet, i + 1, 21, scores.english);
          break;
        }
      }
      
      // Save merged answers back to testSheet (Column 12 - L)
      safeSetValue(testSheet, testRowIdx, 12, JSON.stringify(allAnswers));
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, scores, diagnosticsReport, cheated: !!cheated })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "getStudentByShortId") {
      const { shortId } = data;
      const student = getTestByShortId(testSheet, shortId);
      if (!student) {
         return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Ученик не найден" })).setMimeType(ContentService.MimeType.JSON);
      }
      // Check if already in CRM
      const crmStudent = getCrmByShortId(crmSheet, shortId, testSheet);
      if (crmStudent) {
         return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Этот ученик уже обработан менеджером" })).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, student })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "submitManagerForm") {
      const { shortId, childName, parentName, phone, managerName, managerComment, sentToPsych } = data;
      
      const student = getTestByShortId(testSheet, shortId);
      if (!student) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Ученик не найден в базе тестов" })).setMimeType(ContentService.MimeType.JSON);
      }
      if (getCrmByShortId(crmSheet, shortId, testSheet)) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Этот ученик уже в CRM" })).setMimeType(ContentService.MimeType.JSON);
      }

      // Appending to the new 20-column layout
      // ["Дата", "Менеджер", "ФИО Родителя", "Номер телефона", "ID Теста (ученика)", "Стадия работы", "Оплата до.инфо", "Взнос", "Общая стоимость", "Оплата -1-месяц", "К психологу?", "Вердикт", "Комментарий психолога", "Финальное решение", "Причина отказа", "Имя ребенка", "Русский", "Математика", "Логика", "Комментарий менеджера"]
      
      let newRow = new Array(21).fill("");
      newRow[0] = new Date().toLocaleString("ru-RU", { timeZone: "Asia/Almaty" });
      newRow[1] = sanitize(managerName);
      newRow[2] = sanitize(parentName);
      newRow[3] = sanitize(phone);
      newRow[4] = shortId;
      newRow[5] = "В РАБОТЕ"; // Стадия работы
      newRow[10] = sentToPsych ? "ДА" : "НЕТ";
      newRow[15] = sanitize(childName);
      newRow[16] = student.russian;
      newRow[17] = student.math;
      newRow[18] = student.logic;
      newRow[19] = sanitize(managerComment);
      newRow[20] = student.english;

      crmSheet.appendRow(newRow);
      return ContentService.createTextOutput(JSON.stringify({ success: true, student })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "getPsychologistStudent") {
      const { shortId } = data;
      const crmStudent = getCrmByShortId(crmSheet, shortId, testSheet);
      if (!crmStudent) {
         return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Ученик не найден в CRM" })).setMimeType(ContentService.MimeType.JSON);
      }
      if (crmStudent.sentToPsych !== "ДА") {
         return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Этого ученика не направляли к психологу" })).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, student: crmStudent })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "submitPsychologistForm") {
      const { shortId, verdict, comment } = data;
      const crmStudent = getCrmByShortId(crmSheet, shortId, testSheet);
      if (!crmStudent) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Ученик не найден в CRM" })).setMimeType(ContentService.MimeType.JSON);
      }
      crmSheet.getRange(crmStudent.row, 12).setValue(sanitize(verdict)); // Вердикт
      crmSheet.getRange(crmStudent.row, 13).setValue(sanitize(comment)); // Комментарий психолога
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "getAllStudents") {
      const crmData = crmSheet.getDataRange().getValues();
      const testData = testSheet.getDataRange().getValues();
      
      // Build testData map for quick cheating check and grade retrieval
      let testMap = {};
      for (let i = 1; i < testData.length; i++) {
        let rawStr = testData[i][14] || "{}";
        let rawObj = {};
        try { rawObj = JSON.parse(rawStr); } catch(e) {}
        
        testMap[String(testData[i][10])] = {
          cheated: (testData[i][9] === "ДА"),
          grade: testData[i][2],
          diagnosticsRaw: rawObj
        };
      }
      
      let students = [];
      for (let i = 1; i < crmData.length; i++) {
        const sid = String(crmData[i][4]);
        students.push({
          date: crmData[i][0],
          managerName: crmData[i][1],
          parentName: crmData[i][2],
          phone: crmData[i][3],
          shortId: sid,
          stage: crmData[i][5],
          paymentInfo: crmData[i][6],
          initialFee: crmData[i][7],
          totalCost: crmData[i][8],
          firstMonthPayment: crmData[i][9],
          sentToPsych: crmData[i][10],
          psychVerdict: crmData[i][11],
          psychComment: crmData[i][12],
          finalDecision: crmData[i][13],
          rejectReason: crmData[i][14],
          childName: crmData[i][15],
          ru: crmData[i][16],
          ma: crmData[i][17],
          lo: crmData[i][18],
          en: crmData[i][20],
          cheated: testMap[sid] ? testMap[sid].cheated : false,
          grade: testMap[sid] ? String(testMap[sid].grade) : "",
          diagnosticsRaw: testMap[sid] ? testMap[sid].diagnosticsRaw : {}
        });
      }
      
      // Also get students that took the test but are NOT in CRM yet
      let crmIds = new Set(students.map(s => String(s.shortId)));
      
      for (let i = 1; i < testData.length; i++) {
        const shortId = String(testData[i][10]);
        if (!crmIds.has(shortId) && shortId && shortId !== "undefined") {
          students.push({
            date: testData[i][0],
            managerName: "Не назначен",
            parentName: "",
            phone: "",
            shortId: shortId,
            stage: "",
            paymentInfo: "",
            initialFee: "",
            totalCost: "",
            firstMonthPayment: "",
            sentToPsych: "НЕТ",
            psychVerdict: "",
            psychComment: "",
            finalDecision: "НЕ ОБРАБОТАН",
            rejectReason: "",
            childName: testData[i][1],
            ru: testData[i][3],
            ma: testData[i][4],
            lo: testData[i][5],
            en: testData[i][12],
            cheated: testData[i][9] === "ДА",
            grade: String(testData[i][2]),
            diagnosticsRaw: testMap[shortId] ? testMap[shortId].diagnosticsRaw : {}
          });
        }
      }
      // Sort newest first
      students.reverse();
      return ContentService.createTextOutput(JSON.stringify({ success: true, students })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "updateFinalDecision") {
      const { shortId, finalDecision, paymentInfo, initialFee, totalCost, firstMonthPayment, rejectReason, feedback } = data;
      const crmStudent = getCrmByShortId(crmSheet, shortId, testSheet);
      if (crmStudent) {
        crmSheet.getRange(crmStudent.row, 14).setValue(sanitize(finalDecision));
        if (feedback) {
          crmSheet.getRange(crmStudent.row, 16).setValue(sanitize(feedback)); // Обратная связь (для ученика)
        }
        
        if (finalDecision === "ПРИНЯТ") {
           crmSheet.getRange(crmStudent.row, 7).setValue(sanitize(paymentInfo)); // Оплата до.инфо
           crmSheet.getRange(crmStudent.row, 8).setValue(sanitize(initialFee)); // Взнос
           crmSheet.getRange(crmStudent.row, 9).setValue(sanitize(totalCost)); // Общая стоимость
           crmSheet.getRange(crmStudent.row, 10).setValue(sanitize(firstMonthPayment)); // Оплата -1-месяц
           crmSheet.getRange(crmStudent.row, 6).setValue("ПРИНЯТ"); // Стадия работы
        } else if (finalDecision === "ОТКЛОНЕН") {
           crmSheet.getRange(crmStudent.row, 15).setValue(sanitize(rejectReason)); // Причина отказа
           crmSheet.getRange(crmStudent.row, 6).setValue("ОТКЛОНЕН"); // Стадия работы
        }

        return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Студент не найден в CRM" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "uploadPdf") {
      const { shortId, childName, base64Data } = data;
      const FOLDER_NAME = "Аналитика Академия Будущих Лидеров";
      let folders = DriveApp.getFoldersByName(FOLDER_NAME);
      let folder;
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder(FOLDER_NAME);
      }
      
      let base64String = base64Data;
      if (base64String.indexOf("base64,") !== -1) {
        base64String = base64String.split("base64,")[1];
      }
      
      const decoded = Utilities.base64Decode(base64String);
      const safeName = sanitize(childName || shortId);
      const blob = Utilities.newBlob(decoded, "application/pdf", `Аналитика_${safeName}_${shortId}.pdf`);
      
      const file = folder.createFile(blob);
      const fileUrl = file.getUrl();
      
      // Update CRM sheet with the PDF link (Column 22 - V)
      const crmData = crmSheet.getDataRange().getValues();
      for (let i = 1; i < crmData.length; i++) {
        if (String(crmData[i][4]) === String(shortId)) {
          safeSetValue(crmSheet, i + 1, 22, fileUrl);
          break;
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, url: fileUrl })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unknown action" })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.message })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doOptions(e) {
  return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.JSON).setHeaders({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
}
