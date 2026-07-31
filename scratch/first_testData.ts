import { TestData } from '../types';

export const testsData: Record<number, TestData> = {
  "7": {
    "grade": 7,
    "russian": [
      {
        "id": "ru_1",
        "type": "multiple_choice",
        "points": 1,
        "text": "Найди предложение, в котором есть фразеологизм:",
        "options": [
          "узел на веревке",
          "первая скрипка",
          "гвоздь программы",
          "рука в мешке"
        ],
        "correctAnswer": "гвоздь программы"
      },
      {
        "id": "ru_2",
        "type": "multiple_choice",
        "points": 1,
        "text": "Какое слово образовано приставочным способом?",
        "options": [
          "Заплыв",
          "Безрукавка",
          "Бесполезный",
          "Водный"
        ],
        "correctAnswer": "Заплыв"
      },
      {
        "id": "ru_3",
        "type": "multiple_choice",
        "points": 1,
        "text": "В каком варианте в обоих словах пропущена буква О?",
        "options": [
          "бельч…нок, ш…пот",
          "ч…рный, морозц…м",
          "крыж…вник, вещ…вой",
          "девч…нка, плащ…м"
        ],
        "correctAnswer": "девч…нка, плащ…м"
      },
      {
        "id": "ru_4",
        "type": "multiple_choice",
        "points": 1,
        "text": "Со всеми словами какого ряда НЕ пишется слитно?",
        "options": [
          "нерешительность, неподвижная вода",
          "не знал, не выучил",
          "не друг, а враг",
          "недоделанный, не прочитав"
        ],
        "correctAnswer": "нерешительность, неподвижная вода"
      },
      {
        "id": "ru_5",
        "type": "multiple_choice",
        "points": 1,
        "text": "В каком ряду во всех словах пропущена одна и та же буква? (приставки ПРЕ-/ПРИ-)",
        "options": [
          "премудрый, преграда",
          "припаять, приобрести, приусадебный",
          "приоткрыть, прервать",
          "президент, природа"
        ],
        "correctAnswer": "припаять, приобрести, приусадебный"
      },
      {
        "id": "ru_6",
        "type": "free_text",
        "points": 1,
        "text": "Укажите предложение с ошибкой в употреблении числительного",
        "correctAnswer": "К четырехстам"
      },
      {
        "id": "ru_7",
        "type": "free_text",
        "points": 1,
        "text": "Где знаки расставлены ВЕРНО (предложения с союзом И)",
        "correctAnswer": "запятая перед союзом И в сложном предложении"
      }
    ],
    "math": [
      {
        "id": "math_1",
        "type": "free_text",
        "points": 2,
        "text": "Разложение числа 42 на простые множители",
        "correctAnswer": "2*3*7"
      },
      {
        "id": "math_2",
        "type": "free_text",
        "points": 2,
        "text": "Какое из чисел делится на 5?",
        "correctAnswer": "133050"
      },
      {
        "id": "math_3",
        "type": "free_text",
        "points": 2,
        "text": "Вычислите разность дробей: 10 60/19 и 4 37/5",
        "correctAnswer": "6 7/30"
      },
      {
        "id": "math_4",
        "type": "free_text",
        "points": 2,
        "text": "Сколько натуральных чисел между -4 и 5?",
        "correctAnswer": "4"
      },
      {
        "id": "math_5",
        "type": "free_text",
        "points": 2,
        "text": "Вычислите: 4−… (при условии вычитания 3/8)",
        "correctAnswer": "3 5/8"
      },
      {
        "id": "math_6",
        "type": "free_text",
        "points": 2,
        "text": "Найдите 1/8 часть от 32000",
        "correctAnswer": "4000"
      },
      {
        "id": "math_7",
        "type": "free_text",
        "points": 2,
        "text": "Сравните: 8м 6дм 4см – 763 см … 8м – 6м 98см",
        "correctAnswer": "Меньше"
      },
      {
        "id": "math_8",
        "type": "free_text",
        "points": 2,
        "text": "Решением какого уравнения является число 9?",
        "correctAnswer": "63 : 9 = 7"
      },
      {
        "id": "math_9",
        "type": "free_text",
        "points": 2,
        "text": "Найдите площадь квадрата, если его периметр равен периметру прямоугольника со сторонами 16 и 4 см",
        "correctAnswer": "100"
      },
      {
        "id": "math_10",
        "type": "free_text",
        "points": 2,
        "text": "Задача на встречное движение (скорости 60 и 80 км/ч, расстояние 280 км)",
        "correctAnswer": "2"
      },
      {
        "id": "math_11",
        "type": "free_text",
        "points": 2,
        "text": "Задача про ткань в ателье (320 метров, блузки и рубашки)",
        "correctAnswer": "59"
      }
    ],
    "logic": [
      {
        "id": "log_1",
        "type": "free_text",
        "points": 3,
        "text": "Во сколько раз секундная стрелка быстрее минутной?",
        "correctAnswer": "60"
      },
      {
        "id": "log_2",
        "type": "free_text",
        "points": 3,
        "text": "Задача про Гришу в тире (17 выстрелов)",
        "correctAnswer": "6"
      },
      {
        "id": "log_3",
        "type": "free_text",
        "points": 3,
        "text": "Кенгуру и сынишка (дистанция 180 м)",
        "correctAnswer": "30"
      },
      {
        "id": "log_4",
        "type": "free_text",
        "points": 3,
        "text": "Рыбалка Петра, Василия и Семёна (дележ 42 рублей)",
        "correctAnswer": "Петру 30, Василию 12"
      },
      {
        "id": "log_5",
        "type": "free_text",
        "points": 3,
        "text": "Математические задачи Вовочки",
        "correctAnswer": "21"
      },
      {
        "id": "log_6",
        "type": "free_text",
        "points": 3,
        "text": "100 карандашей четырех цветов. Сколько достать, чтобы был красный и фиолетовый?",
        "correctAnswer": "301"
      },
      {
        "id": "log_7",
        "type": "free_text",
        "points": 3,
        "text": "Выпавшие листы из книги (страницы 387 и обратный порядок)",
        "correctAnswer": "199"
      }
    ]
  },
  "8": {
    "grade": 8,
    "russian": [
      {
        "id": "ru_1",
        "type": "free_text",
        "points": 1,
        "text": "Укажите словосочетание со страдательным причастием",
        "correctAnswer": "Расколотый орех"
      },
      {
        "id": "ru_2",
        "type": "free_text",
        "points": 1,
        "text": "Словосочетание с деепричастием совершенного вида",
        "correctAnswer": "Купив продукты"
      },
      {
        "id": "ru_3",
        "type": "free_text",
        "points": 1,
        "text": "Причастие с суффиксом –АЩ-(-ЯЩ-)",
        "correctAnswer": "Строящийся"
      },
      {
        "id": "ru_4",
        "type": "free_text",
        "points": 1,
        "text": "Причастие с суффиксом –ИМ-",
        "correctAnswer": "Видимый"
      },
      {
        "id": "ru_5",
        "type": "multiple_choice",
        "points": 1,
        "text": "Слово с орфографической ошибкой",
        "options": [
          "Построенный",
          "Обидев",
          "Растаив",
          "Запаянный"
        ],
        "correctAnswer": "Растаив"
      },
      {
        "id": "ru_6",
        "type": "free_text",
        "points": 1,
        "text": "Ряд, где во всех словах пишется одна Н",
        "correctAnswer": "Кованый, пожарена"
      },
      {
        "id": "ru_7",
        "type": "free_text",
        "points": 1,
        "text": "Где НЕ пишется раздельно?",
        "correctAnswer": "не закрыв"
      },
      {
        "id": "ru_8",
        "type": "free_text",
        "points": 1,
        "text": "Номер предложения с правильной пунктуацией",
        "correctAnswer": "предложение с деепричастным оборотом"
      },
      {
        "id": "ru_9",
        "type": "free_text",
        "points": 1,
        "text": "Пунктуация в предложении про фонарь",
        "correctAnswer": "1, 3"
      },
      {
        "id": "ru_10",
        "type": "free_text",
        "points": 1,
        "text": "Пунктуация в предложении про залы музеев",
        "correctAnswer": "2, 4"
      }
    ],
    "math": [
      {
        "id": "math_1",
        "type": "free_text",
        "points": 2,
        "text": "Вычислите: 3^3 ⋅ 3^4",
        "correctAnswer": "2187"
      },
      {
        "id": "math_2",
        "type": "free_text",
        "points": 2,
        "text": "Упростите: 5(2а+1)−3",
        "correctAnswer": "10а + 2"
      },
      {
        "id": "math_3",
        "type": "free_text",
        "points": 2,
        "text": "Вынесите за скобки (задание «вычислите»): 18а^3 + 6а^2",
        "correctAnswer": "6а^2(3а + 1)"
      },
      {
        "id": "math_4",
        "type": "free_text",
        "points": 2,
        "text": "Точка на графике у=3х–5",
        "correctAnswer": "N(0; -5)"
      },
      {
        "id": "math_5",
        "type": "free_text",
        "points": 2,
        "text": "Решите уравнение: 3х–1=7х+1",
        "correctAnswer": "-0.5"
      },
      {
        "id": "math_6",
        "type": "free_text",
        "points": 2,
        "text": "Цена товара 3200 р. после снижения на 5%",
        "correctAnswer": "3040"
      },
      {
        "id": "math_7",
        "type": "free_text",
        "points": 2,
        "text": "Упростите: (с+5)^2 − с(10−3с)",
        "correctAnswer": "4с^2 + 25"
      },
      {
        "id": "math_8",
        "type": "free_text",
        "points": 2,
        "text": "Значение выражения при а=0,25",
        "correctAnswer": "10"
      },
      {
        "id": "math_9",
        "type": "free_text",
        "points": 2,
        "text": "Параллельность графиков: у=7х−3 и у=∗х+0,5",
        "correctAnswer": "7"
      },
      {
        "id": "math_10",
        "type": "free_text",
        "points": 2,
        "text": "Упростите: (t−5)^2 + 4(10−t)",
        "correctAnswer": "t^2 - 14t + 65"
      },
      {
        "id": "math_11",
        "type": "free_text",
        "points": 2,
        "text": "Разность смежных углов (пропорция 5 и 7)",
        "correctAnswer": "30"
      }
    ],
    "logic": [
      {
        "id": "log_1",
        "type": "free_text",
        "points": 3,
        "text": "Задание №1: Собаки и кошки (10 питомцев, 56 конфет)",
        "correctAnswer": "6 собак и 4 кошки"
      },
      {
        "id": "log_2",
        "type": "free_text",
        "points": 3,
        "text": "Задание №2: Три комнаты (дракон и принцесса)",
        "correctAnswer": "В первой комнате"
      },
      {
        "id": "log_3",
        "type": "free_text",
        "points": 3,
        "text": "Задание №3: Житель сонного царства (дневное/ночное племена)",
        "correctAnswer": "Житель из ночного племени"
      },
      {
        "id": "log_4",
        "type": "free_text",
        "points": 3,
        "text": "Задание №4: Монеты в кошельке (1000 рублей, 300 монет)",
        "correctAnswer": "140"
      },
      {
        "id": "log_5",
        "type": "free_text",
        "points": 3,
        "text": "Задание №5: Три утверждения о лживости друг друга",
        "correctAnswer": "Одно"
      },
      {
        "id": "log_6",
        "type": "free_text",
        "points": 3,
        "text": "Задание №6: Турнир по теннису (рыцари и лжецы)",
        "correctAnswer": "25"
      },
      {
        "id": "log_7",
        "type": "free_text",
        "points": 3,
        "text": "Задание №7: Задуманное двузначное число (алгоритм с числом 20 и 59)",
        "correctAnswer": "2"
      },
      {
        "id": "log_8",
        "type": "free_text",
        "points": 3,
        "text": "Задание №8: Вес бидона с молоком",
        "correctAnswer": "1"
      }
    ]
  },
  "9": {
    "grade": 9,
    "russian": [
      {
        "id": "ru_1",
        "type": "free_text",
        "points": 1,
        "text": "Связь примыкание в словосочетании",
        "correctAnswer": "Быстро бежать"
      },
      {
        "id": "ru_2",
        "type": "free_text",
        "points": 1,
        "text": "Объясни постановку скобок в предложении",
        "correctAnswer": "Вставная конструкция"
      },
      {
        "id": "ru_3",
        "type": "free_text",
        "points": 1,
        "text": "Определенно-личное предложение",
        "correctAnswer": "Иду по лесной тропинке"
      },
      {
        "id": "ru_4",
        "type": "free_text",
        "points": 1,
        "text": "Подлежащее в предложении «Три ученика опоздали...»",
        "correctAnswer": "Три ученика"
      },
      {
        "id": "ru_5",
        "type": "free_text",
        "points": 1,
        "text": "Н и НН: «Не(…) слыха(н\\нн)ая дерзость», «Задача реше(н/нн)ая»",
        "correctAnswer": "нн, нн"
      },
      {
        "id": "ru_6",
        "type": "free_text",
        "points": 1,
        "text": "Причастный оборот, который не обособляется",
        "correctAnswer": "Утомленные долгим путем туристы"
      },
      {
        "id": "ru_7",
        "type": "free_text",
        "points": 1,
        "text": "Пунктуация: «Ветер дующий с моря принес прохладу»",
        "correctAnswer": "Ветер, дующий с моря, принес прохладу."
      },
      {
        "id": "ru_8",
        "type": "free_text",
        "points": 1,
        "text": "Где НЕ пишется раздельно",
        "correctAnswer": "не закрыв"
      },
      {
        "id": "ru_9",
        "type": "free_text",
        "points": 1,
        "text": "Где НЕ пишется слитно",
        "correctAnswer": "ненавидевший"
      },
      {
        "id": "ru_10",
        "type": "free_text",
        "points": 1,
        "text": "Предложение с деепричастным оборотом",
        "correctAnswer": "Закончив работу, я пошел гулять"
      },
      {
        "id": "ru_11",
        "type": "free_text",
        "points": 1,
        "text": "Предложение с вводным словом",
        "correctAnswer": "Кажется, дождь начинается"
      },
      {
        "id": "ru_12",
        "type": "free_text",
        "points": 1,
        "text": "Вид сказуемого в «Он хотел научится танцевать»",
        "correctAnswer": "Составное глагольное"
      },
      {
        "id": "ru_13",
        "type": "free_text",
        "points": 1,
        "text": "Синтаксический разбор и тип односоставного предложения",
        "correctAnswer": "1-е: безличное; 2-е: двусоставное"
      },
      {
        "id": "ru_14",
        "type": "free_text",
        "points": 1,
        "text": "Объяснение знаков в сложном предложении",
        "correctAnswer": "Вторая часть поясняет первую"
      }
    ],
    "math": [
      {
        "id": "math_1",
        "type": "free_text",
        "points": 2,
        "text": "Корни уравнения −х^2 + 3х + 4 = 0",
        "correctAnswer": "4, -1"
      },
      {
        "id": "math_2",
        "type": "free_text",
        "points": 2,
        "text": "Абсциссы точек пересечения у=(х−1)^2 и у=2х−2х^2",
        "correctAnswer": "1, 1/3"
      },
      {
        "id": "math_3",
        "type": "free_text",
        "points": 2,
        "text": "Свойства уравнения при отрицательном дискриминанте",
        "correctAnswer": "Не имеет корней"
      },
      {
        "id": "math_4",
        "type": "free_text",
        "points": 2,
        "text": "Произведение корней −х^2 − 78564х + 24661 = 0",
        "correctAnswer": "-24661"
      },
      {
        "id": "math_5",
        "type": "free_text",
        "points": 2,
        "text": "Корни уравнения с дробью (числитель 1−4х^2)",
        "correctAnswer": "-0.5"
      },
      {
        "id": "math_6",
        "type": "free_text",
        "points": 2,
        "text": "Решите уравнение: (х−2)/х – (х+2)/7 = (х^2−4)/8",
        "correctAnswer": "3"
      },
      {
        "id": "math_7",
        "type": "free_text",
        "points": 2,
        "text": "Периметр прямоугольника (площадь 36, длина на 5 больше ширины)",
        "correctAnswer": "26"
      },
      {
        "id": "math_8",
        "type": "free_text",
        "points": 2,
        "text": "Скорость велосипедиста (дистанция 120 км)",
        "correctAnswer": "12"
      },
      {
        "id": "math_9",
        "type": "free_text",
        "points": 2,
        "text": "Оценка выражения −2х+1, если 2≤а≤3",
        "correctAnswer": "-5 ≤ -2х+1 ≤ -3"
      },
      {
        "id": "math_10",
        "type": "free_text",
        "points": 2,
        "text": "Оценка разности a–b",
        "correctAnswer": "-6 ≤ a – b ≤ 2"
      },
      {
        "id": "math_11",
        "type": "free_text",
        "points": 2,
        "text": "Запись промежутка по рисунку",
        "correctAnswer": "[-3; 0)"
      },
      {
        "id": "math_12",
        "type": "free_text",
        "points": 2,
        "text": "Система неравенств",
        "correctAnswer": "(1,4; 2]"
      },
      {
        "id": "math_13",
        "type": "free_text",
        "points": 2,
        "text": "Упростите: 3а^4 b^5 ⋅(−2)⋅(a^-2 b)^-4",
        "correctAnswer": "-6a^12b"
      }
    ],
    "logic": [
      {
        "id": "log_1",
        "type": "free_text",
        "points": 3,
        "text": "Белов, Серов, Чернов",
        "correctAnswer": "Белов в серой, Серов в черной, Чернов в белой"
      },
      {
        "id": "log_2",
        "type": "free_text",
        "points": 3,
        "text": "Ящики с крупой, сахаром, вермишелью",
        "correctAnswer": "1 сахар, 2 крупа, 3 вермишель"
      },
      {
        "id": "log_3",
        "type": "free_text",
        "points": 3,
        "text": "Очередь на концерт",
        "correctAnswer": "Митя, Сеня, Толя, Костя, Юра"
      },
      {
        "id": "log_4",
        "type": "free_text",
        "points": 3,
        "text": "Музыканты (Олег, Коля, Ваня)",
        "correctAnswer": "Олег скрипка, Коля пианино, Ваня пение"
      },
      {
        "id": "log_5",
        "type": "free_text",
        "points": 3,
        "text": "Черника и вода (доля изменилась)",
        "correctAnswer": "Уменьшилась в 2 раза"
      },
      {
        "id": "log_6",
        "type": "free_text",
        "points": 3,
        "text": "Доктора Ай и Ой",
        "correctAnswer": "60"
      },
      {
        "id": "log_7",
        "type": "free_text",
        "points": 3,
        "text": "Задуманное число",
        "correctAnswer": "2"
      },
      {
        "id": "log_8",
        "type": "free_text",
        "points": 3,
        "text": "Охотник и собака",
        "correctAnswer": "240"
      }
    ]
  },
  "10": {
    "grade": 10,
    "russian": [
      {
        "id": "ru_1",
        "type": "free_text",
        "points": 1,
        "text": "Ударение: цепОчка, газопрОвод, прозорлИва, донЕльзя",
        "correctAnswer": "газопровОд"
      },
      {
        "id": "ru_2",
        "type": "free_text",
        "points": 1,
        "text": "Паронимы: лесистая чащоба, информативная статья и др.",
        "correctAnswer": "Лесной"
      },
      {
        "id": "ru_3",
        "type": "free_text",
        "points": 1,
        "text": "Предложение с одной запятой",
        "correctAnswer": "если не каждый день, то через день"
      },
      {
        "id": "ru_4",
        "type": "free_text",
        "points": 1,
        "text": "Проверяемая гласная в корне (оз..рить, м..литва и др.)",
        "correctAnswer": "молитва"
      },
      {
        "id": "ru_5",
        "type": "free_text",
        "points": 1,
        "text": "Ряд с одинаковой буквой (бе..защитный, пред..явить и др.)",
        "correctAnswer": "предъявить, съезд"
      },
      {
        "id": "ru_6",
        "type": "free_text",
        "points": 1,
        "text": "Буква Е на месте пропуска (забол…ва, выпяч…вать и др.)",
        "correctAnswer": "заболева"
      },
      {
        "id": "ru_7",
        "type": "free_text",
        "points": 1,
        "text": "Где НЕ слитно",
        "correctAnswer": "Неумолкающие"
      },
      {
        "id": "ru_8",
        "type": "free_text",
        "points": 1,
        "text": "Оба слова СЛИТНО (ЧТО(БЫ), ТАК(ЖЕ), (В)ЗАКЛЮЧЕНИЕ и др.)",
        "correctAnswer": "также, поэтому"
      },
      {
        "id": "ru_9",
        "type": "free_text",
        "points": 1,
        "text": "Где пишется НН (текст про городскую улицу)",
        "correctAnswer": "1, 2, 3, 4, 5"
      },
      {
        "id": "ru_10",
        "type": "free_text",
        "points": 1,
        "text": "Запятые в предложении с причастным и деепричастным оборотами",
        "correctAnswer": "3, 4"
      }
    ],
    "math": [
      {
        "id": "math_1",
        "type": "free_text",
        "points": 2,
        "text": "Упростите выражение (со степенями и корнями)",
        "correctAnswer": "1 + √8"
      },
      {
        "id": "math_2",
        "type": "free_text",
        "points": 2,
        "text": "Вычислите значение выражения при х=π",
        "correctAnswer": "0"
      },
      {
        "id": "math_3",
        "type": "free_text",
        "points": 2,
        "text": "Тригонометрическое уравнение (равно 0,5)",
        "correctAnswer": "±π/3 + 2πn"
      },
      {
        "id": "math_4",
        "type": "free_text",
        "points": 2,
        "text": "Множество значений y=11cosx",
        "correctAnswer": "[-11; 11]"
      },
      {
        "id": "math_5",
        "type": "free_text",
        "points": 2,
        "text": "Производная y=3x^2 cosx",
        "correctAnswer": "6x cos x - 3x^2 sin x"
      },
      {
        "id": "math_6",
        "type": "free_text",
        "points": 2,
        "text": "Момент времени, когда скорость точки будет равна 5 (X(t)=3+2t+t^2)",
        "correctAnswer": "1.5"
      },
      {
        "id": "math_7",
        "type": "free_text",
        "points": 2,
        "text": "Уравнение: 7tanx+⋯+3sin2x=1",
        "correctAnswer": "x = π/4 + πn"
      },
      {
        "id": "math_8",
        "type": "free_text",
        "points": 2,
        "text": "Задание №8 (выбор из чисел)",
        "correctAnswer": "2"
      },
      {
        "id": "math_9",
        "type": "free_text",
        "points": 2,
        "text": "Задание №9 (выбор из чисел 222, 240, 264, 286)",
        "correctAnswer": "240"
      },
      {
        "id": "math_10",
        "type": "free_text",
        "points": 2,
        "text": "Задание №10 (выбор из чисел 16, 18, 20, 36)",
        "correctAnswer": "20"
      }
    ],
    "logic": [
      {
        "id": "log_1",
        "type": "free_text",
        "points": 3,
        "text": "Белов, Серов, Чернов",
        "correctAnswer": "Белов в серой, Серов в черной, Чернов в белой"
      },
      {
        "id": "log_2",
        "type": "free_text",
        "points": 3,
        "text": "Ящики с крупой, сахаром, вермишелью",
        "correctAnswer": "1 сахар, 2 крупа, 3 вермишель"
      },
      {
        "id": "log_3",
        "type": "free_text",
        "points": 3,
        "text": "Очередь на концерт",
        "correctAnswer": "Митя, Сеня, Толя, Костя, Юра"
      },
      {
        "id": "log_4",
        "type": "free_text",
        "points": 3,
        "text": "Музыканты (Олег, Коля, Ваня)",
        "correctAnswer": "Олег скрипка, Коля пианино, Ваня пение"
      },
      {
        "id": "log_5",
        "type": "free_text",
        "points": 3,
        "text": "Черника и вода (доля изменилась)",
        "correctAnswer": "Уменьшилась в 2 раза"
      },
      {
        "id": "log_6",
        "type": "free_text",
        "points": 3,
        "text": "Доктора Ай и Ой",
        "correctAnswer": "60"
      },
      {
        "id": "log_7",
        "type": "free_text",
        "points": 3,
        "text": "Задуманное число",
        "correctAnswer": "2"
      },
      {
        "id": "log_8",
        "type": "free_text",
        "points": 3,
        "text": "Охотник и собака",
        "correctAnswer": "240"
      }
    ]
  },
  "11": {
    "grade": 11,
    "russian": [
      {
        "id": "ru_1",
        "type": "free_text",
        "points": 1,
        "text": "Ударение: вероисповедАние, заперлА, оптОвый, красИвее",
        "correctAnswer": "вероисповедание"
      },
      {
        "id": "ru_2",
        "type": "free_text",
        "points": 1,
        "text": "Паронимы: НАДЕЛА шапку, НАЛИЧНОСТИ в фондах и др.",
        "correctAnswer": "Наличии"
      },
      {
        "id": "ru_3",
        "type": "free_text",
        "points": 1,
        "text": "Характеристика предложения «Пока мы переходили...»",
        "correctAnswer": "Сложноподчиненное"
      },
      {
        "id": "ru_4",
        "type": "free_text",
        "points": 1,
        "text": "Проверяемая гласная корня",
        "correctAnswer": "прост"
      },
      {
        "id": "ru_5",
        "type": "free_text",
        "points": 1,
        "text": "Ряд с одинаковой буквой (включая Н/НН и приставки)",
        "correctAnswer": "подыграть, изымать"
      },
      {
        "id": "ru_6",
        "type": "free_text",
        "points": 1,
        "text": "Буква Е в суффиксе (подстра…ваться, эмал…вый и др.)",
        "correctAnswer": "эмалевый"
      },
      {
        "id": "ru_7",
        "type": "free_text",
        "points": 1,
        "text": "Где НЕ слитно",
        "correctAnswer": "Нелестный"
      },
      {
        "id": "ru_8",
        "type": "free_text",
        "points": 1,
        "text": "Оба слова СЛИТНО ((НЕ)СМОТРЯ, (НА)СЧЁТ, (ТОТ)ЧАС и др.)",
        "correctAnswer": "вверху, тотчас"
      },
      {
        "id": "ru_9",
        "type": "free_text",
        "points": 1,
        "text": "Где пишется НН (текст про город Баку)",
        "correctAnswer": "письменные"
      },
      {
        "id": "ru_10",
        "type": "free_text",
        "points": 1,
        "text": "Запятые в предложении про солнце и поля пшеницы",
        "correctAnswer": "1, 2, 3, 5"
      }
    ],
    "math": [
      {
        "id": "math_1",
        "type": "free_text",
        "points": 2,
        "text": "Выберите верные равенства (с корнями и степенями)",
        "correctAnswer": "a^n * a^m = a^(n+m)"
      },
      {
        "id": "math_2",
        "type": "free_text",
        "points": 2,
        "text": "Область определения функции",
        "correctAnswer": "[0; +∞)"
      },
      {
        "id": "math_3",
        "type": "free_text",
        "points": 2,
        "text": "Определите верное равенство (логарифмы/тригонометрия)",
        "correctAnswer": "log_a(1) = 0"
      },
      {
        "id": "math_4",
        "type": "free_text",
        "points": 2,
        "text": "Точка на графике функции y=2^x",
        "correctAnswer": "(1; 2)"
      },
      {
        "id": "math_5",
        "type": "free_text",
        "points": 2,
        "text": "Производная функции",
        "correctAnswer": "nx^(n-1)"
      },
      {
        "id": "math_6",
        "type": "free_text",
        "points": 2,
        "text": "Значение угла α при заданном синусе/косинусе",
        "correctAnswer": "π/6"
      },
      {
        "id": "math_7",
        "type": "free_text",
        "points": 2,
        "text": "У призмы 12 вершин. Сколько у нее граней?",
        "correctAnswer": "8"
      },
      {
        "id": "math_8",
        "type": "free_text",
        "points": 2,
        "text": "Радиус шара, если диаметр сферы равен d",
        "correctAnswer": "d/2"
      },
      {
        "id": "math_9",
        "type": "free_text",
        "points": 2,
        "text": "Корень логарифмического или показательного уравнения",
        "correctAnswer": "2"
      },
      {
        "id": "math_10",
        "type": "free_text",
        "points": 2,
        "text": "Выразите угол в радианах",
        "correctAnswer": "π/3"
      }
    ],
    "logic": [
      {
        "id": "log_1",
        "type": "free_text",
        "points": 3,
        "text": "Белов, Серов, Чернов",
        "correctAnswer": "Белов в серой, Серов в черной, Чернов в белой"
      },
      {
        "id": "log_2",
        "type": "free_text",
        "points": 3,
        "text": "Ящики с крупой, сахаром, вермишелью",
        "correctAnswer": "1 сахар, 2 крупа, 3 вермишель"
      },
      {
        "id": "log_3",
        "type": "free_text",
        "points": 3,
        "text": "Очередь на концерт",
        "correctAnswer": "Митя, Сеня, Толя, Костя, Юра"
      },
      {
        "id": "log_4",
        "type": "free_text",
        "points": 3,
        "text": "Музыканты (Олег, Коля, Ваня)",
        "correctAnswer": "Олег скрипка, Коля пианино, Ваня пение"
      },
      {
        "id": "log_5",
        "type": "free_text",
        "points": 3,
        "text": "Черника и вода (доля изменилась)",
        "correctAnswer": "Уменьшилась в 2 раза"
      },
      {
        "id": "log_6",
        "type": "free_text",
        "points": 3,
        "text": "Доктора Ай и Ой",
        "correctAnswer": "60"
      },
      {
        "id": "log_7",
        "type": "free_text",
        "points": 3,
        "text": "Задуманное число",
        "correctAnswer": "2"
      },
      {
        "id": "log_8",
        "type": "free_text",
        "points": 3,
        "text": "Охотник и собака",
        "correctAnswer": "240"
      }
    ]
  }
};
