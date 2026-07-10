const SHEET_TESTS = "Результаты тестов";
const SHEET_CRM = "CRM Менеджеров";

const ANSWER_KEYS = {
  "7": {
    "russian": {
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
        "ans": "100 см2",
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
        "ans": "в 60 раз.",
        "pts": 1
      },
      "logic_2": {
        "ans": "6",
        "pts": 1
      },
      "logic_3": {
        "ans": "30",
        "pts": 1
      },
      "logic_4": {
        "ans": "петру — 30 рублей, василию — 12 рублей.",
        "pts": 1
      },
      "logic_5": {
        "ans": "21",
        "pts": 1
      },
      "logic_6": {
        "ans": "301",
        "pts": 1
      },
      "logic_7": {
        "ans": "199",
        "pts": 1
      }
    }
  },
  "8": {
    "russian": {
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
        "ans": "6а2(3а+1)",
        "pts": 1
      },
      "math_4": {
        "ans": "n(0; - 5)",
        "pts": 1
      },
      "math_5": {
        "ans": "0,5",
        "pts": 1
      },
      "math_6": {
        "ans": "3040",
        "pts": 1
      },
      "math_7": {
        "ans": "4с2+25",
        "pts": 1
      },
      "math_8": {
        "ans": "1",
        "pts": 1
      },
      "math_9": {
        "ans": "7",
        "pts": 1
      },
      "math_10": {
        "ans": "t2 - 14t + 65",
        "pts": 1
      },
      "math_11": {
        "ans": "30°",
        "pts": 1
      }
    },
    "logic": {
      "logic_1": {
        "ans": "6 собак и 4 кошки",
        "pts": 1
      },
      "logic_2": {
        "ans": "в первой комнате",
        "pts": 1
      },
      "logic_3": {
        "ans": "он принадлежит к ночному племени и бодрствует",
        "pts": 1
      },
      "logic_4": {
        "ans": "по 140 монет",
        "pts": 1
      },
      "logic_5": {
        "ans": "одно — да, два — нет, все — нет",
        "pts": 1
      },
      "logic_6": {
        "ans": "11",
        "pts": 1
      }
    }
  },
  "9": {
    "russian": {
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
        "ans": "белов в черной. серов в белой. чернов в серой.",
        "pts": 1
      },
      "logic_2": {
        "ans": "1 - сахар, 2 - крупа, 3 - вермишель",
        "pts": 1
      },
      "logic_3": {
        "ans": "митя, толя, сеня/костя, костя/сеня, юра",
        "pts": 1
      },
      "logic_4": {
        "ans": "ваня — певец, олег — скрипач, коля — пианист",
        "pts": 1
      },
      "logic_5": {
        "ans": "в 2 раза меньше",
        "pts": 1
      },
      "logic_6": {
        "ans": "60 минут",
        "pts": 1
      },
      "logic_7": {
        "ans": "8",
        "pts": 1
      },
      "logic_8": {
        "ans": "240 скачков",
        "pts": 1
      }
    }
  },
  "10": {
    "russian": {
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
    "logic": {}
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
        "ans": "бессоюзное",
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
        "ans": "белов-черная, серов-белая, чернов-серая",
        "pts": 1
      },
      "logic_2": {
        "ans": "1 - сахар, 2 - крупа, 3 - вермишель",
        "pts": 1
      },
      "logic_3": {
        "ans": "толя",
        "pts": 1
      },
      "logic_4": {
        "ans": "ваня — певец, олег — скрипач, коля — пианист",
        "pts": 1
      },
      "logic_5": {
        "ans": "в 2 раза меньше",
        "pts": 1
      },
      "logic_6": {
        "ans": "60 минут",
        "pts": 1
      },
      "logic_7": {
        "ans": "8",
        "pts": 1
      },
      "logic_8": {
        "ans": "240 скачков",
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
      testSheet.appendRow(["Дата", "ФИО Ученика", "Класс", "Русский язык", "Математика", "Логика", "Общий балл", "Уникальный ID теста", "Timestamp", "Читерство", "Short ID"]);
    }
    if (crmSheet.getLastRow() === 0) {
      crmSheet.appendRow(["Дата", "Менеджер", "ФИО Родителя", "Номер телефона", "ID Теста (ученика)", "Стадия работы", "Оплата до.инфо", "Взнос", "Общая стоимость", "Оплата -1-месяц", "К психологу?", "Вердикт", "Комментарий психолога", "Финальное решение", "Причина отказа", "Имя ребенка", "Русский", "Математика", "Логика", "Комментарий менеджера"]);
    }

    if (action === "submitTest") {
      const { testId, shortId, studentName, grade, answers, cheated } = data;
      
      const dataRange = testSheet.getDataRange().getValues();
      const safeName = sanitize(studentName || "Без имени");
      const now = new Date().getTime();
      
      for (let i = 1; i < dataRange.length; i++) {
        if (dataRange[i][7] === testId || dataRange[i][10] === shortId) {
          return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Test already submitted" })).setMimeType(ContentService.MimeType.JSON);
        }
        
        // Prevent same name from submitting within 1 hour
        const rowName = dataRange[i][1];
        const rowTime = dataRange[i][8];
        if (rowName === safeName && (now - Number(rowTime)) < 60 * 60 * 1000) {
           return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Вы уже сдавали тест в течение последнего часа." })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      let scores = { russian: 0, math: 0, logic: 0 };
      if (!cheated) {
        scores = calculateScores(grade, answers);
      }
      const totalScore = scores.russian + scores.math + scores.logic;
      
      const ts = new Date().getTime();
      testSheet.appendRow([new Date(ts).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }), safeName, grade, scores.russian, scores.math, scores.logic, totalScore, testId, ts, cheated ? "ДА" : "НЕТ", shortId]);
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, totalScore, cheated: !!cheated })).setMimeType(ContentService.MimeType.JSON);
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
      
      // Build testData map for quick cheating check
      let testMap = {};
      for (let i = 1; i < testData.length; i++) {
        testMap[String(testData[i][10])] = (testData[i][9] === "ДА");
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
          cheated: !!testMap[sid]
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
            cheated: testData[i][9] === "ДА"
          });
        }
      }
      // Sort newest first
      students.reverse();
      return ContentService.createTextOutput(JSON.stringify({ success: true, students })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "updateFinalDecision") {
      const { shortId, finalDecision, paymentInfo, initialFee, totalCost, firstMonthPayment, rejectReason } = data;
      const crmStudent = getCrmByShortId(crmSheet, shortId, testSheet);
      if (crmStudent) {
        crmSheet.getRange(crmStudent.row, 14).setValue(sanitize(finalDecision));
        
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
