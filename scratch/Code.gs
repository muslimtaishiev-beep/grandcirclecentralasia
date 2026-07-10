const SHEET_TESTS = "Результаты тестов";
const SHEET_CRM = "CRM Менеджеров";

const ANSWER_KEYS = {
  "7": {
    "russian": {
      "ru_1": {
        "ans": "гвоздь программы",
        "pts": 1
      },
      "ru_2": {
        "ans": "заплыв",
        "pts": 1
      },
      "ru_3": {
        "ans": "девч…нка, плащ…м",
        "pts": 1
      },
      "ru_4": {
        "ans": "нерешительность, неподвижная вода",
        "pts": 1
      },
      "ru_5": {
        "ans": "припаять, приобрести, приусадебный",
        "pts": 1
      },
      "ru_6": {
        "ans": "к четырехстам",
        "pts": 1
      },
      "ru_7": {
        "ans": "запятая перед союзом и в сложном предложении",
        "pts": 1
      }
    },
    "math": {
      "math_1": {
        "ans": "2*3*7",
        "pts": 2
      },
      "math_2": {
        "ans": "133050",
        "pts": 2
      },
      "math_3": {
        "ans": "6 7/30",
        "pts": 2
      },
      "math_4": {
        "ans": "4",
        "pts": 2
      },
      "math_5": {
        "ans": "3 5/8",
        "pts": 2
      },
      "math_6": {
        "ans": "4000",
        "pts": 2
      },
      "math_7": {
        "ans": "меньше",
        "pts": 2
      },
      "math_8": {
        "ans": "63 : 9 = 7",
        "pts": 2
      },
      "math_9": {
        "ans": "100",
        "pts": 2
      },
      "math_10": {
        "ans": "2",
        "pts": 2
      },
      "math_11": {
        "ans": "59",
        "pts": 2
      }
    },
    "logic": {
      "log_1": {
        "ans": "60",
        "pts": 3
      },
      "log_2": {
        "ans": "6",
        "pts": 3
      },
      "log_3": {
        "ans": "30",
        "pts": 3
      },
      "log_4": {
        "ans": "петру 30, василию 12",
        "pts": 3
      },
      "log_5": {
        "ans": "21",
        "pts": 3
      },
      "log_6": {
        "ans": "301",
        "pts": 3
      },
      "log_7": {
        "ans": "199",
        "pts": 3
      }
    }
  },
  "8": {
    "russian": {
      "ru_1": {
        "ans": "расколотый орех",
        "pts": 1
      },
      "ru_2": {
        "ans": "купив продукты",
        "pts": 1
      },
      "ru_3": {
        "ans": "строящийся",
        "pts": 1
      },
      "ru_4": {
        "ans": "видимый",
        "pts": 1
      },
      "ru_5": {
        "ans": "растаив",
        "pts": 1
      },
      "ru_6": {
        "ans": "кованый, пожарена",
        "pts": 1
      },
      "ru_7": {
        "ans": "не закрыв",
        "pts": 1
      },
      "ru_8": {
        "ans": "предложение с деепричастным оборотом",
        "pts": 1
      },
      "ru_9": {
        "ans": "1, 3",
        "pts": 1
      },
      "ru_10": {
        "ans": "2, 4",
        "pts": 1
      }
    },
    "math": {
      "math_1": {
        "ans": "2187",
        "pts": 2
      },
      "math_2": {
        "ans": "10а + 2",
        "pts": 2
      },
      "math_3": {
        "ans": "6а^2(3а + 1)",
        "pts": 2
      },
      "math_4": {
        "ans": "n(0; -5)",
        "pts": 2
      },
      "math_5": {
        "ans": "-0.5",
        "pts": 2
      },
      "math_6": {
        "ans": "3040",
        "pts": 2
      },
      "math_7": {
        "ans": "4с^2 + 25",
        "pts": 2
      },
      "math_8": {
        "ans": "10",
        "pts": 2
      },
      "math_9": {
        "ans": "7",
        "pts": 2
      },
      "math_10": {
        "ans": "t^2 - 14t + 65",
        "pts": 2
      },
      "math_11": {
        "ans": "30",
        "pts": 2
      }
    },
    "logic": {
      "log_1": {
        "ans": "6 собак и 4 кошки",
        "pts": 3
      },
      "log_2": {
        "ans": "в первой комнате",
        "pts": 3
      },
      "log_3": {
        "ans": "житель из ночного племени",
        "pts": 3
      },
      "log_4": {
        "ans": "140",
        "pts": 3
      },
      "log_5": {
        "ans": "одно",
        "pts": 3
      },
      "log_6": {
        "ans": "25",
        "pts": 3
      },
      "log_7": {
        "ans": "2",
        "pts": 3
      },
      "log_8": {
        "ans": "1",
        "pts": 3
      }
    }
  },
  "9": {
    "russian": {
      "ru_1": {
        "ans": "быстро бежать",
        "pts": 1
      },
      "ru_2": {
        "ans": "вставная конструкция",
        "pts": 1
      },
      "ru_3": {
        "ans": "иду по лесной тропинке",
        "pts": 1
      },
      "ru_4": {
        "ans": "три ученика",
        "pts": 1
      },
      "ru_5": {
        "ans": "нн, нн",
        "pts": 1
      },
      "ru_6": {
        "ans": "утомленные долгим путем туристы",
        "pts": 1
      },
      "ru_7": {
        "ans": "ветер, дующий с моря, принес прохладу.",
        "pts": 1
      },
      "ru_8": {
        "ans": "не закрыв",
        "pts": 1
      },
      "ru_9": {
        "ans": "ненавидевший",
        "pts": 1
      },
      "ru_10": {
        "ans": "закончив работу, я пошел гулять",
        "pts": 1
      },
      "ru_11": {
        "ans": "кажется, дождь начинается",
        "pts": 1
      },
      "ru_12": {
        "ans": "составное глагольное",
        "pts": 1
      },
      "ru_13": {
        "ans": "1-е: безличное; 2-е: двусоставное",
        "pts": 1
      },
      "ru_14": {
        "ans": "вторая часть поясняет первую",
        "pts": 1
      }
    },
    "math": {
      "math_1": {
        "ans": "4, -1",
        "pts": 2
      },
      "math_2": {
        "ans": "1, 1/3",
        "pts": 2
      },
      "math_3": {
        "ans": "не имеет корней",
        "pts": 2
      },
      "math_4": {
        "ans": "-24661",
        "pts": 2
      },
      "math_5": {
        "ans": "-0.5",
        "pts": 2
      },
      "math_6": {
        "ans": "3",
        "pts": 2
      },
      "math_7": {
        "ans": "26",
        "pts": 2
      },
      "math_8": {
        "ans": "12",
        "pts": 2
      },
      "math_9": {
        "ans": "-5 ≤ -2х+1 ≤ -3",
        "pts": 2
      },
      "math_10": {
        "ans": "-6 ≤ a – b ≤ 2",
        "pts": 2
      },
      "math_11": {
        "ans": "[-3; 0)",
        "pts": 2
      },
      "math_12": {
        "ans": "(1,4; 2]",
        "pts": 2
      },
      "math_13": {
        "ans": "-6a^12b",
        "pts": 2
      }
    },
    "logic": {
      "log_1": {
        "ans": "белов в серой, серов в черной, чернов в белой",
        "pts": 3
      },
      "log_2": {
        "ans": "1 сахар, 2 крупа, 3 вермишель",
        "pts": 3
      },
      "log_3": {
        "ans": "митя, сеня, толя, костя, юра",
        "pts": 3
      },
      "log_4": {
        "ans": "олег скрипка, коля пианино, ваня пение",
        "pts": 3
      },
      "log_5": {
        "ans": "уменьшилась в 2 раза",
        "pts": 3
      },
      "log_6": {
        "ans": "60",
        "pts": 3
      },
      "log_7": {
        "ans": "2",
        "pts": 3
      },
      "log_8": {
        "ans": "240",
        "pts": 3
      }
    }
  },
  "10": {
    "russian": {
      "ru_1": {
        "ans": "газопровод",
        "pts": 1
      },
      "ru_2": {
        "ans": "лесной",
        "pts": 1
      },
      "ru_3": {
        "ans": "если не каждый день, то через день",
        "pts": 1
      },
      "ru_4": {
        "ans": "молитва",
        "pts": 1
      },
      "ru_5": {
        "ans": "предъявить, съезд",
        "pts": 1
      },
      "ru_6": {
        "ans": "заболева",
        "pts": 1
      },
      "ru_7": {
        "ans": "неумолкающие",
        "pts": 1
      },
      "ru_8": {
        "ans": "также, поэтому",
        "pts": 1
      },
      "ru_9": {
        "ans": "1, 2, 3, 4, 5",
        "pts": 1
      },
      "ru_10": {
        "ans": "3, 4",
        "pts": 1
      }
    },
    "math": {
      "math_1": {
        "ans": "1 + √8",
        "pts": 2
      },
      "math_2": {
        "ans": "0",
        "pts": 2
      },
      "math_3": {
        "ans": "±π/3 + 2πn",
        "pts": 2
      },
      "math_4": {
        "ans": "[-11; 11]",
        "pts": 2
      },
      "math_5": {
        "ans": "6x cos x - 3x^2 sin x",
        "pts": 2
      },
      "math_6": {
        "ans": "1.5",
        "pts": 2
      },
      "math_7": {
        "ans": "x = π/4 + πn",
        "pts": 2
      },
      "math_8": {
        "ans": "2",
        "pts": 2
      },
      "math_9": {
        "ans": "240",
        "pts": 2
      },
      "math_10": {
        "ans": "20",
        "pts": 2
      }
    },
    "logic": {
      "log_1": {
        "ans": "белов в серой, серов в черной, чернов в белой",
        "pts": 3
      },
      "log_2": {
        "ans": "1 сахар, 2 крупа, 3 вермишель",
        "pts": 3
      },
      "log_3": {
        "ans": "митя, сеня, толя, костя, юра",
        "pts": 3
      },
      "log_4": {
        "ans": "олег скрипка, коля пианино, ваня пение",
        "pts": 3
      },
      "log_5": {
        "ans": "уменьшилась в 2 раза",
        "pts": 3
      },
      "log_6": {
        "ans": "60",
        "pts": 3
      },
      "log_7": {
        "ans": "2",
        "pts": 3
      },
      "log_8": {
        "ans": "240",
        "pts": 3
      }
    }
  },
  "11": {
    "russian": {
      "ru_1": {
        "ans": "вероисповедание",
        "pts": 1
      },
      "ru_2": {
        "ans": "наличии",
        "pts": 1
      },
      "ru_3": {
        "ans": "сложноподчиненное",
        "pts": 1
      },
      "ru_4": {
        "ans": "прост",
        "pts": 1
      },
      "ru_5": {
        "ans": "подыграть, изымать",
        "pts": 1
      },
      "ru_6": {
        "ans": "эмалевый",
        "pts": 1
      },
      "ru_7": {
        "ans": "нелестный",
        "pts": 1
      },
      "ru_8": {
        "ans": "вверху, тотчас",
        "pts": 1
      },
      "ru_9": {
        "ans": "письменные",
        "pts": 1
      },
      "ru_10": {
        "ans": "1, 2, 3, 5",
        "pts": 1
      }
    },
    "math": {
      "math_1": {
        "ans": "a^n * a^m = a^(n+m)",
        "pts": 2
      },
      "math_2": {
        "ans": "[0; +∞)",
        "pts": 2
      },
      "math_3": {
        "ans": "log_a(1) = 0",
        "pts": 2
      },
      "math_4": {
        "ans": "(1; 2)",
        "pts": 2
      },
      "math_5": {
        "ans": "nx^(n-1)",
        "pts": 2
      },
      "math_6": {
        "ans": "π/6",
        "pts": 2
      },
      "math_7": {
        "ans": "8",
        "pts": 2
      },
      "math_8": {
        "ans": "d/2",
        "pts": 2
      },
      "math_9": {
        "ans": "2",
        "pts": 2
      },
      "math_10": {
        "ans": "π/3",
        "pts": 2
      }
    },
    "logic": {
      "log_1": {
        "ans": "белов в серой, серов в черной, чернов в белой",
        "pts": 3
      },
      "log_2": {
        "ans": "1 сахар, 2 крупа, 3 вермишель",
        "pts": 3
      },
      "log_3": {
        "ans": "митя, сеня, толя, костя, юра",
        "pts": 3
      },
      "log_4": {
        "ans": "олег скрипка, коля пианино, ваня пение",
        "pts": 3
      },
      "log_5": {
        "ans": "уменьшилась в 2 раза",
        "pts": 3
      },
      "log_6": {
        "ans": "60",
        "pts": 3
      },
      "log_7": {
        "ans": "2",
        "pts": 3
      },
      "log_8": {
        "ans": "240",
        "pts": 3
      }
    }
  }
};

function sanitize(input) {
  if (typeof input !== 'string') return input;
  // Prevent CSV injection
  let sanitized = input.replace(/[<>]/g, ''); // Strip obvious HTML tags
  if (/^[=+\-@]/.test(sanitized)) {
    sanitized = "'" + sanitized;
  }
  return sanitized;
}

function calculateScores(grade, answers) {
  const keys = ANSWER_KEYS[String(grade)];
  if (!keys) return { russian: 0, math: 0, logic: 0 };
  
  let ru = 0, ma = 0, lo = 0;
  
  if (answers && typeof answers === 'object') {
    Object.keys(keys.russian).forEach(qId => {
      if (answers[qId] && answers[qId].trim().toLowerCase() === keys.russian[qId].ans) ru += keys.russian[qId].pts;
    });
    Object.keys(keys.math).forEach(qId => {
      if (answers[qId] && answers[qId].trim().toLowerCase() === keys.math[qId].ans) ma += keys.math[qId].pts;
    });
    Object.keys(keys.logic).forEach(qId => {
      if (answers[qId] && answers[qId].trim().toLowerCase() === keys.logic[qId].ans) lo += keys.logic[qId].pts;
    });
  }
  return { russian: ru, math: ma, logic: lo };
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Wait up to 5 seconds for other processes to finish.
    lock.waitLock(5000);
    
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let testSheet = ss.getSheetByName(SHEET_TESTS);
    let crmSheet = ss.getSheetByName(SHEET_CRM);
    
    if (testSheet.getLastRow() === 0) {
      testSheet.appendRow(["Дата", "ФИО Ученика", "Класс", "Русский язык", "Математика", "Логика", "Общий балл", "Уникальный ID теста", "Timestamp", "Читерство"]);
    }
    if (crmSheet.getLastRow() === 0) {
      crmSheet.appendRow(["Дата", "Менеджер", "ФИО Родителя", "Номер телефона", "ID Теста (ученика)", "Стадия работы", "Оплата до.инфо", "Взнос", "Общая стоимость", "Оплата -1-месяц"]);
    }

    if (action === "submitTest") {
      const { testId, studentName, grade, answers, cheated } = data;
      
      // Check if testId already exists to prevent duplicate submissions
      const dataRange = testSheet.getDataRange().getValues();
      for (let i = 1; i < dataRange.length; i++) {
        if (dataRange[i][7] === testId) {
          return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Test already submitted" })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      let scores = { russian: 0, math: 0, logic: 0 };
      if (!cheated) {
        scores = calculateScores(grade, answers);
      }
      const totalScore = scores.russian + scores.math + scores.logic;
      const safeName = sanitize(studentName || "Без имени");
      
      const ts = new Date().getTime();
      testSheet.appendRow([new Date(ts).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }), safeName, grade, scores.russian, scores.math, scores.logic, totalScore, testId, ts, cheated ? "ДА" : "НЕТ"]);
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, totalScore, cheated: !!cheated })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "submitManagerForm") {
      const { manager, parentName, phone, testId, stage, paymentPreInfo, deposit, totalCost, paymentMinus1Month } = data;
      
      // Validation 1: Does testId exist in tests sheet?
      const testData = testSheet.getDataRange().getValues();
      let testFound = false;
      let testTimestamp = 0;
      for (let i = 1; i < testData.length; i++) {
        if (testData[i][7] === testId) {
          testFound = true;
          testTimestamp = testData[i][8] || 0; // Timestamp column
          break;
        }
      }
      
      if (!testFound) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Неверный QR-код. Тест не найден в базе данных." })).setMimeType(ContentService.MimeType.JSON);
      }
      
      // Validation 2: Is the test too old? (e.g., > 12 hours)
      const now = new Date().getTime();
      const MAX_AGE_MS = 12 * 60 * 60 * 1000;
      if (now - testTimestamp > MAX_AGE_MS) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Срок действия QR-кода истек (прошло более 12 часов с момента сдачи теста)." })).setMimeType(ContentService.MimeType.JSON);
      }

      // Validation 3: Is it already in CRM?
      const crmData = crmSheet.getDataRange().getValues();
      for (let i = 1; i < crmData.length; i++) {
        if (crmData[i][4] === testId) {
          return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Этот ученик уже зарегистрирован в CRM другим менеджером!" })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      const safeManager = sanitize(manager);
      const safeParent = sanitize(parentName);
      const safePhone = sanitize(phone);
      
      crmSheet.appendRow([new Date().toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }), safeManager, safeParent, safePhone, testId, stage, paymentPreInfo, deposit, totalCost, paymentMinus1Month]);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
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
