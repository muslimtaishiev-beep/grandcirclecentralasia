const SHEET_TESTS = "Результаты тестов";
const SHEET_CRM = "CRM Менеджеров";

const ANSWER_KEYS = {
  "7": {
    "russian": {

      "ru_7_new": { ans: JSON.stringify({"Прилагательное":"Часть речи","Сказуемое":"Член предложения","Союз":"Часть речи","Определение":"Член предложения","Существительное":"Часть речи"}), pts: 1 },
      "ru_9": { ans: "Гвоздем программы было выступление известного актера.", pts: 1 },
      "ru_10": { ans: "Аккуратный, точный", pts: 1 },
      "ru_11": { ans: "К четырехстам прибавить пятьдесят.", pts: 1 },
      "ru_12": { ans: "какой(либо), (шахматно)шашечный, ярко(красный)", pts: 1 },
      "ru_13": { ans: "Из-под этой тучи вырвались яркие лучи, и мокрые леса и поля засверкали.", pts: 1 },
      "russian_1": {
        "ans": "гвоздем программы было выступление известного актера.",
        "pts": 1
      },
      "russian_2": {
        "ans": "бесполезный",
        "pts": 1
      },
      "russian_3": {
        "ans": "девч…нка, плащ…м",
        "pts": 1
      },
      "russian_4": {
        "ans": "(не) решительность, (не) подвижная вода",
        "pts": 1
      },
      "russian_5": {
        "ans": "пр…паять, пр…обрести, пр…усадебный",
        "pts": 1
      },
      "russian_6": {
        "ans": "к четырехстам прибавить пятьдесят.",
        "pts": 1
      },
      "russian_7": {
        "ans": "часть речи сказуемое —",
        "pts": 1
      },
      "russian_8": {
        "ans": "из-под этой тучи вырвались яркие лучи, и мокрые леса и поля засверкали.",
        "pts": 1
      }
    },
    "math": {

      "ma_3_new": { ans: "60/19", pts: 1 },
      "math_1": {
        "ans": "2∙3∙7",
        "pts": 1
      },
      "math_2": {
        "ans": "133050",
        "pts": 1
      },
      "math_3": {
        "ans": "19/60",
        "pts": 1
      },
      "math_4": {
        "ans": "9",
        "pts": 1
      },
      "math_5": {
        "ans": "2 1/3",
        "pts": 1
      },
      "math_6": {
        "ans": "4000",
        "pts": 1
      },
      "math_7": {
        "ans": "меньше",
        "pts": 1
      },
      "math_8": {
        "ans": "63 : х = 7",
        "pts": 1
      },
      "math_9": {
        "ans": "100 см²",
        "pts": 1
      },
      "math_10": {
        "ans": "2 часа",
        "pts": 1
      },
      "math_11": {
        "ans": "59",
        "pts": 1
      }
    },
        "logic": {
      "logic_1": {
        "ans": JSON.stringify({ "Белов": "Чёрная рубашка", "Серов": "Белая рубашка", "Чернов": "Серая рубашка" }),
        "pts": 1
      },
      "logic_2": {
        "ans": JSON.stringify({ "Ящик 1 (надпись «крупа»)": "Сахар", "Ящик 2 (надпись «вермишель»)": "Крупа", "Ящик 3 (надпись «крупа или сахар»)": "Вермишель" }),
        "pts": 1
      },
      "logic_3": {
        "ans": "",
        "pts": 1
      },
      "logic_4": {
        "ans": JSON.stringify({ "Олег": "Скрипач", "Коля": "Пианист", "Ваня": "Певец" }),
        "pts": 1
      },
      "logic_5": {
        "ans": "Уменьшилась в 2 раза",
        "pts": 1
      },
      "logic_6": {
        "ans": "60",
        "pts": 1
      },
      "logic_7": {
        "ans": "8",
        "pts": 1
      },
      "logic_8": {
        "ans": "240",
        "pts": 1
      }
    }
  },
  "8": {
    "russian": {

      "ru_8_new": { ans: "3) Посетитель кафе, зевая, заказал на обед рыбу жаренную в тесте.", pts: 1 },
      "ru_9": { ans: JSON.stringify(["1", "5"]), pts: 1 },
      "ru_10": { ans: JSON.stringify(["4", "12"]), pts: 1 },
      "russian_1": {
        "ans": "расколотый орех",
        "pts": 1
      },
      "russian_2": {
        "ans": "купив продукты",
        "pts": 1
      },
      "russian_3": {
        "ans": "стро…щийся дом",
        "pts": 1
      },
      "russian_4": {
        "ans": "вид…мый свет",
        "pts": 1
      },
      "russian_5": {
        "ans": "растаив",
        "pts": 1
      },
      "russian_6": {
        "ans": "кова….ый сундук, картошка пожаре….а",
        "pts": 1
      },
      "russian_7": {
        "ans": "(не) закрыв дверь",
        "pts": 1
      },
      "russian_8": {
        "ans": "3",
        "pts": 1
      },
      "russian_9": {
        "ans": "1, 3",
        "pts": 1
      },
      "russian_10": {
        "ans": "2, 4",
        "pts": 1
      }
    },
    "math": {
      "math_1": {
        "ans": "другой ответ",
        "pts": 1
      },
      "math_2": {
        "ans": "10а+2",
        "pts": 1
      },
      "math_3": {
        "ans": "6а²(3а+1)",
        "pts": 1
      },
      "math_4": {
        "ans": "n(0; - 5)",
        "pts": 1
      },
      "math_5": {
        "ans": "-0,5",
        "pts": 1
      },
      "math_6": {
        "ans": "3040",
        "pts": 1
      },
      "math_7": {
        "ans": "4с²+25",
        "pts": 1
      },
      "math_8": {
        "ans": "-1",
        "pts": 1
      },
      "math_9": {
        "ans": "7",
        "pts": 1
      },
      "math_10": {
        "ans": "t² - 14t + 65",
        "pts": 1
      },
      "math_11": {
        "ans": "30°",
        "pts": 1
      }
    },
        "logic": {
      "logic_1": {
        "ans": JSON.stringify({ "Белов": "Чёрная рубашка", "Серов": "Белая рубашка", "Чернов": "Серая рубашка" }),
        "pts": 1
      },
      "logic_2": {
        "ans": JSON.stringify({ "Ящик 1 (надпись «крупа»)": "Сахар", "Ящик 2 (надпись «вермишель»)": "Крупа", "Ящик 3 (надпись «крупа или сахар»)": "Вермишель" }),
        "pts": 1
      },
      "logic_3": {
        "ans": "",
        "pts": 1
      },
      "logic_4": {
        "ans": JSON.stringify({ "Олег": "Скрипач", "Коля": "Пианист", "Ваня": "Певец" }),
        "pts": 1
      },
      "logic_5": {
        "ans": "Уменьшилась в 2 раза",
        "pts": 1
      },
      "logic_6": {
        "ans": "60",
        "pts": 1
      },
      "logic_7": {
        "ans": "8",
        "pts": 1
      },
      "logic_8": {
        "ans": "240",
        "pts": 1
      }
    }
  },
  "9": {
    "russian": {

      "ru_5_new": { ans: JSON.stringify({"input1":"НН","input2":"Н"}), pts: 1 },
      "ru_7_new": { ans: JSON.stringify(["1", "4"]), pts: 1 },
      "ru_13_new": { ans: "Безличное предложение", pts: 1 },
      "ru_14_new": { ans: "1) Вторая часть раскрывает содержание первой (можно вставить «а именно»).", pts: 1 },
      "russian_1": {
        "ans": "быстро бежать",
        "pts": 1
      },
      "russian_2": {
        "ans": "вставная конструкция",
        "pts": 1
      },
      "russian_3": {
        "ans": "иду по лесной тропинке.",
        "pts": 1
      },
      "russian_4": {
        "ans": "три ученика",
        "pts": 1
      },
      "russian_5": {
        "ans": "неслыханная, решена",
        "pts": 1
      },
      "russian_6": {
        "ans": "утомленные долгим путем туристы отдыхали.",
        "pts": 1
      },
      "russian_7": {
        "ans": "ветер, дующий с моря, принес прохладу.",
        "pts": 1
      },
      "russian_8": {
        "ans": "(не) закрыв дверь",
        "pts": 1
      },
      "russian_9": {
        "ans": "(не) навидевший",
        "pts": 1
      },
      "russian_10": {
        "ans": "закончив работу я пошел гулять.",
        "pts": 1
      },
      "russian_11": {
        "ans": "кажется дождь начинается.",
        "pts": 1
      },
      "russian_12": {
        "ans": "составное глагольное.",
        "pts": 1
      },
      "russian_13": {
        "ans": "ссп, 1-я часть безличная, 2-я двусоставная.",
        "pts": 1
      },
      "russian_14": {
        "ans": "двоеточие между частями бсп, запятая перед если не ставится из-за то",
        "pts": 1
      }
    },
    "math": {
      "math_1": {
        "ans": "x_1=4; x_2=-1",
        "pts": 1
      },
      "math_2": {
        "ans": "x_1=1; x_2=1/3",
        "pts": 1
      },
      "math_3": {
        "ans": "не имеет корней",
        "pts": 1
      },
      "math_4": {
        "ans": "24661",
        "pts": 1
      },
      "math_5": {
        "ans": "0,5",
        "pts": 1
      },
      "math_6": {
        "ans": "x=6",
        "pts": 1
      },
      "math_7": {
        "ans": "26",
        "pts": 1
      },
      "math_8": {
        "ans": "12",
        "pts": 1
      },
      "math_9": {
        "ans": "-5 \\le -2x+1 \\le -3",
        "pts": 1
      },
      "math_10": {
        "ans": "-6 \\le a - b \\le 6",
        "pts": 1
      },
      "math_11": {
        "ans": "[-3; 0)",
        "pts": 1
      },
      "math_12": {
        "ans": "(1,8; 4]",
        "pts": 1
      },
      "math_13": {
        "ans": "b^6/9",
        "pts": 1
      }
    },
        "logic": {
      "logic_1": {
        "ans": JSON.stringify({ "Белов": "Чёрная рубашка", "Серов": "Белая рубашка", "Чернов": "Серая рубашка" }),
        "pts": 1
      },
      "logic_2": {
        "ans": JSON.stringify({ "Ящик 1 (надпись «крупа»)": "Сахар", "Ящик 2 (надпись «вермишель»)": "Крупа", "Ящик 3 (надпись «крупа или сахар»)": "Вермишель" }),
        "pts": 1
      },
      "logic_3": {
        "ans": "",
        "pts": 1
      },
      "logic_4": {
        "ans": JSON.stringify({ "Олег": "Скрипач", "Коля": "Пианист", "Ваня": "Певец" }),
        "pts": 1
      },
      "logic_5": {
        "ans": "Уменьшилась в 2 раза",
        "pts": 1
      },
      "logic_6": {
        "ans": "60",
        "pts": 1
      },
      "logic_7": {
        "ans": "8",
        "pts": 1
      },
      "logic_8": {
        "ans": "240",
        "pts": 1
      }
    }
  },
  "10": {
    "russian": {

      "ru_2_new": { ans: "ПРОСВЕТИТЕЛЬСКИЙ", pts: 1 },
      "ru_8_new": { ans: "ПОЭТОМУ ТАКЖЕ", pts: 1 },
      "russian_1": {
        "ans": "газопровод",
        "pts": 1
      },
      "russian_2": {
        "ans": "лесной",
        "pts": 1
      },
      "russian_3": {
        "ans": "туманы здесь бывают если не каждый день то через день непременно.",
        "pts": 1
      },
      "russian_4": {
        "ans": "м..литва",
        "pts": 1
      },
      "russian_5": {
        "ans": "пред..явить, с..езд;",
        "pts": 1
      },
      "russian_6": {
        "ans": "забол…ва",
        "pts": 1
      },
      "russian_7": {
        "ans": "ирина андреевна говорила (не)громко, но очень выразительно.",
        "pts": 1
      },
      "russian_8": {
        "ans": "5",
        "pts": 1
      },
      "russian_9": {
        "ans": "1, 2, 3, 4, 5",
        "pts": 1
      },
      "russian_10": {
        "ans": "3, 4",
        "pts": 1
      }
    },
    "math": {
      "math_1": {
        "ans": "1",
        "pts": 1
      },
      "math_2": {
        "ans": "2",
        "pts": 1
      },
      "math_3": {
        "ans": "\\pm \\pi/6 + \\pi n, n \\in z",
        "pts": 1
      },
      "math_4": {
        "ans": "[-11; 11]",
        "pts": 1
      },
      "math_5": {
        "ans": "6x\\cos(x) - 3x^2\\sin(x)",
        "pts": 1
      },
      "math_6": {
        "ans": "1,5",
        "pts": 1
      },
      "math_7": {
        "ans": "\\pi n",
        "pts": 1
      },
      "math_8": {
        "ans": "2\\sqrt{3}",
        "pts": 1
      },
      "math_9": {
        "ans": "222",
        "pts": 1
      },
      "math_10": {
        "ans": "20",
        "pts": 1
      }
    },
        "logic": {
      "logic_1": {
        "ans": JSON.stringify({ "Белов": "Чёрная рубашка", "Серов": "Белая рубашка", "Чернов": "Серая рубашка" }),
        "pts": 1
      },
      "logic_2": {
        "ans": JSON.stringify({ "Ящик 1 (надпись «крупа»)": "Сахар", "Ящик 2 (надпись «вермишель»)": "Крупа", "Ящик 3 (надпись «крупа или сахар»)": "Вермишель" }),
        "pts": 1
      },
      "logic_3": {
        "ans": "",
        "pts": 1
      },
      "logic_4": {
        "ans": JSON.stringify({ "Олег": "Скрипач", "Коля": "Пианист", "Ваня": "Певец" }),
        "pts": 1
      },
      "logic_5": {
        "ans": "Уменьшилась в 2 раза",
        "pts": 1
      },
      "logic_6": {
        "ans": "60",
        "pts": 1
      },
      "logic_7": {
        "ans": "8",
        "pts": 1
      },
      "logic_8": {
        "ans": "240",
        "pts": 1
      }
    }
  },
  "11": {
    "russian": {
      "russian_1": {
        "ans": "заперла",
        "pts": 1
      },
      "russian_2": {
        "ans": "наличии",
        "pts": 1
      },
      "russian_3": {
        "ans": "сложноподчиненное",
        "pts": 1
      },
      "russian_4": {
        "ans": "выт..реть",
        "pts": 1
      },
      "russian_5": {
        "ans": "6",
        "pts": 1
      },
      "russian_6": {
        "ans": "проста…вать",
        "pts": 1
      },
      "russian_7": {
        "ans": "(не) дерзал",
        "pts": 1
      },
      "russian_8": {
        "ans": "4",
        "pts": 1
      },
      "russian_9": {
        "ans": "2, 4",
        "pts": 1
      },
      "russian_10": {
        "ans": "3, 5",
        "pts": 1
      }
    },
    "math": {
      "math_1": {
        "ans": "корень 5-й степени из (-3)^5 = -3",
        "pts": 1
      },
      "math_2": {
        "ans": "(1; +\\infty)",
        "pts": 1
      },
      "math_3": {
        "ans": "\\text{arcctg}(-\\alpha) = \\pi - \\text{arcctg}(\\alpha)",
        "pts": 1
      },
      "math_4": {
        "ans": "a(27; 3)",
        "pts": 1
      },
      "math_5": {
        "ans": "6x^5",
        "pts": 1
      },
      "math_6": {
        "ans": "-180 градусов",
        "pts": 1
      },
      "math_7": {
        "ans": "8",
        "pts": 1
      },
      "math_8": {
        "ans": "3\\sqrt{3}",
        "pts": 1
      },
      "math_9": {
        "ans": "\\log_3(5)",
        "pts": 1
      },
      "math_10": {
        "ans": "\\pi/4",
        "pts": 1
      }
    },
        "logic": {
      "logic_1": {
        "ans": JSON.stringify({ "Белов": "Чёрная рубашка", "Серов": "Белая рубашка", "Чернов": "Серая рубашка" }),
        "pts": 1
      },
      "logic_2": {
        "ans": JSON.stringify({ "Ящик 1 (надпись «крупа»)": "Сахар", "Ящик 2 (надпись «вермишель»)": "Крупа", "Ящик 3 (надпись «крупа или сахар»)": "Вермишель" }),
        "pts": 1
      },
      "logic_3": {
        "ans": "",
        "pts": 1
      },
      "logic_4": {
        "ans": JSON.stringify({ "Олег": "Скрипач", "Коля": "Пианист", "Ваня": "Певец" }),
        "pts": 1
      },
      "logic_5": {
        "ans": "Уменьшилась в 2 раза",
        "pts": 1
      },
      "logic_6": {
        "ans": "60",
        "pts": 1
      },
      "logic_7": {
        "ans": "8",
        "pts": 1
      },
      "logic_8": {
        "ans": "240",
        "pts": 1
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
  // Greek letters
  s = s.replace(/α/g, "alpha").replace(/\\alpha/g, "alpha");
  return s;
}

function calculateScores(grade, answers) {
  const keys = ANSWER_KEYS[String(grade)];
  if (!keys) return { russian: 0, math: 0, logic: 0 };
  
  let ru = 0, ma = 0, lo = 0;
  
  if (answers && typeof answers === 'object') {
    Object.keys(keys.russian).forEach(qId => {
      let userAnsStr = answers[qId] ? String(answers[qId]).trim() : "";
      let userAnsLower = userAnsStr.toLowerCase();
      
      if (String(grade) === "11" && qId === "russian_2") {
        let parts = userAnsLower.split("|");
        let optChoice = parts[0] ? parts[0].trim() : "";
        let wordChoice = parts[1] ? parts[1].trim() : "";
        if (optChoice === "2" && (wordChoice === "наличие" || wordChoice === "наличии")) ru += keys.russian[qId].pts;
      } else if (String(grade) === "11" && qId === "russian_8") {
        let parts = userAnsLower.split("|");
        let optChoice = parts[0] ? parts[0].trim() : "";
        let wordChoice = parts[1] ? parts[1].replace(/\s+/g, '').trim() : "";
        if (optChoice === "4" && (wordChoice === "кверхутотчас" || wordChoice === "тотчаскверху")) ru += keys.russian[qId].pts;
      } else if (qId === "ru_5_new") {
        try {
          let userObj = JSON.parse(userAnsStr);
          let val1 = String(userObj["input1"] || "").trim().toLowerCase();
          let val2 = String(userObj["input2"] || "").trim().toLowerCase();
          if (val1 === "нн" && val2 === "н") ru += keys.russian[qId].pts;
        } catch(e) {}
      } else if (qId === "ru_8_new" && String(grade) === "10") {
        let val = userAnsLower.replace(/\s+/g, "");
        if (val === "такжепоэтому" || val === "поэтомутакже") ru += keys.russian[qId].pts;
      } else if (qId === "ru_7_new" && String(grade) === "7") {
        try {
          let userObj = JSON.parse(userAnsStr);
          let correctObj = JSON.parse(keys.russian[qId].ans);
          let isCorrect = true;
          for (let k in correctObj) { if (userObj[k] !== correctObj[k]) isCorrect = false; }
          for (let k in userObj) { if (userObj[k] !== correctObj[k]) isCorrect = false; }
          if (isCorrect && Object.keys(correctObj).length > 0) ru += keys.russian[qId].pts;
        } catch(e) {}
      } else if ((qId === "ru_9" || qId === "ru_10" || qId === "ru_7_new") && keys.russian[qId].ans.startsWith("[")) {
        // These are clickable arrays — only parse as JSON if the key is a JSON array
        try {
          let userArr = JSON.parse(userAnsStr);
          let correctArr = JSON.parse(keys.russian[qId].ans);
          if (Array.isArray(userArr) && Array.isArray(correctArr)) {
            userArr.sort();
            correctArr.sort();
            if (userArr.join(",") === correctArr.join(",")) ru += keys.russian[qId].pts;
          }
        } catch(e) {}
      } else {
        if (normalizeString(userAnsStr) === normalizeString(keys.russian[qId].ans)) ru += keys.russian[qId].pts;
      }
    });
    Object.keys(keys.math).forEach(qId => {
      let userAns = answers[qId] ? String(answers[qId]) : "";
      if (normalizeString(userAns) === normalizeString(keys.math[qId].ans)) ma += keys.math[qId].pts;
    });
    Object.keys(keys.logic).forEach(qId => {
      let userAns = answers[qId] ? String(answers[qId]).trim() : "";
      
      if (qId === "logic_3") {
        let ansArray;
        try { ansArray = JSON.parse(userAns); } catch(e) { ansArray = []; }
        let ansStr = ansArray.join(",");
        if (ansStr === "Митя,Толя,Сеня,Юра,Костя" || ansStr === "Митя,Толя,Костя,Юра,Сеня") {
          lo += keys.logic[qId].pts;
        }
      } else if (qId === "logic_1" || qId === "logic_2" || qId === "logic_4") {
        let userObj, correctObj;
        try { 
          userObj = JSON.parse(userAns); 
          correctObj = JSON.parse(keys.logic[qId].ans);
          let isCorrect = true;
          for (let k in correctObj) {
            if (userObj[k] !== correctObj[k]) isCorrect = false;
          }
          for (let k in userObj) {
            if (userObj[k] !== correctObj[k]) isCorrect = false;
          }
          if (isCorrect && Object.keys(correctObj).length > 0) lo += keys.logic[qId].pts;
        } catch(e) {}
      } else {
        if (normalizeString(userAns) === normalizeString(keys.logic[qId].ans)) lo += keys.logic[qId].pts;
      }
    });
  }
  return { russian: ru, math: ma, logic: lo };
}

function getTestByShortId(testSheet, shortId) {
  const data = testSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    // shortId is in column 10 (index 10)
    if (String(data[i][10]) === String(shortId)) {
      return {
        row: i + 1,
        studentName: data[i][1],
        grade: data[i][2],
        russian: data[i][3],
        math: data[i][4],
        logic: data[i][5],
        totalScore: data[i][6],
        testId: data[i][7],
        timestamp: data[i][8],
        cheated: data[i][9] === "ДА"
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
      testSheet.appendRow(["Дата", "ФИО Ученика", "Класс", "Русский язык", "Математика", "Логика", "Общий балл", "Уникальный ID теста", "Timestamp", "Читерство", "Short ID", "Ответы ученика (JSON)"]);
    }
    if (crmSheet.getLastRow() === 0) {
      crmSheet.appendRow(["Дата", "Менеджер", "ФИО Родителя", "Номер телефона", "ID Теста (ученика)", "Стадия работы", "Оплата до.инфо", "Взнос", "Общая стоимость", "Оплата -1-месяц", "К психологу?", "Вердикт", "Комментарий психолога", "Финальное решение", "Причина отказа", "Имя ребенка", "Русский", "Математика", "Логика", "Комментарий менеджера"]);
    }

    if (action === "submitTest") {
      const { testId, shortId, studentName, grade, answers, cheated, isTester } = data;
      
      const dataRange = testSheet.getDataRange().getValues();
      const safeName = sanitize(studentName || "Без имени");
      const finalName = isTester ? `[ТЕСТ] ${safeName}` : safeName;
      const now = new Date().getTime();
      
      for (let i = 1; i < dataRange.length; i++) {
        if (dataRange[i][7] === testId || dataRange[i][10] === shortId) {
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

      let scores = { russian: 0, math: 0, logic: 0 };
      if (!cheated) {
        scores = calculateScores(grade, answers);
      }
      const totalScore = scores.russian + scores.math + scores.logic;
      
      const ts = new Date().getTime();
      const answersStr = JSON.stringify(answers || {});
      testSheet.appendRow([new Date(ts).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }), finalName, grade, scores.russian, scores.math, scores.logic, totalScore, testId, ts, cheated ? "ДА" : "НЕТ", shortId, answersStr]);
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, totalScore, scores, cheated: !!cheated })).setMimeType(ContentService.MimeType.JSON);
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
      
      let newRow = new Array(20).fill("");
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
        testMap[String(testData[i][10])] = {
          cheated: (testData[i][9] === "ДА"),
          grade: testData[i][2]
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
          cheated: testMap[sid] ? testMap[sid].cheated : false,
          grade: testMap[sid] ? String(testMap[sid].grade) : ""
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
            cheated: testData[i][9] === "ДА",
            grade: String(testData[i][2])
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
