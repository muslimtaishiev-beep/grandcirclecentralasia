import json
import re

with open("src/data/testsData.ts", "r", encoding="utf-8") as f:
    content = f.read()

json_str = content.split("export const testsData: Record<number, TestData> = ")[1]
json_str = json_str.strip()
if json_str.endswith(";"):
    json_str = json_str[:-1]

data = json.loads(json_str)

answer_keys = {}
for grade_str, test in data.items():
    grade = str(test["grade"])
    answer_keys[grade] = {"russian": {}, "math": {}, "logic": {}}
    
    for q in test.get("russian", []):
        answer_keys[grade]["russian"][q["id"]] = {"ans": q["correctAnswer"].strip().lower(), "pts": q["points"]}
    for q in test.get("math", []):
        answer_keys[grade]["math"][q["id"]] = {"ans": q["correctAnswer"].strip().lower(), "pts": q["points"]}
    for q in test.get("logic", []):
        answer_keys[grade]["logic"][q["id"]] = {"ans": q["correctAnswer"].strip().lower(), "pts": q["points"]}

gas_code = """const SHEET_TESTS = "Результаты тестов";
const SHEET_CRM = "CRM Менеджеров";

const ANSWER_KEYS = """ + json.dumps(answer_keys, ensure_ascii=False, indent=2) + """;

function sanitize(input) {
  if (typeof input !== 'string') return input;
  let sanitized = input.replace(/[<>]/g, ''); 
  if (/^[=+\\-@]/.test(sanitized)) {
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

function getCrmByShortId(crmSheet, shortId) {
  const data = crmSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    // shortId is in column 1 (index 1)
    if (String(data[i][1]) === String(shortId)) {
      return {
        row: i + 1,
        date: data[i][0],
        shortId: data[i][1],
        childName: data[i][2],
        parentName: data[i][3],
        phone: data[i][4],
        managerName: data[i][5],
        managerComment: data[i][6],
        ru: data[i][7],
        ma: data[i][8],
        lo: data[i][9],
        sentToPsych: data[i][10],
        psychVerdict: data[i][11],
        psychComment: data[i][12],
        finalDecision: data[i][13]
      };
    }
  }
  return null;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let testSheet = ss.getSheetByName(SHEET_TESTS);
    let crmSheet = ss.getSheetByName(SHEET_CRM);
    
    if (testSheet.getLastRow() === 0) {
      testSheet.appendRow(["Дата", "ФИО Ученика", "Класс", "Русский язык", "Математика", "Логика", "Общий балл", "Уникальный ID теста", "Timestamp", "Читерство", "Short ID"]);
    }
    if (crmSheet.getLastRow() === 0) {
      crmSheet.appendRow(["Дата", "Short ID", "Имя ребенка", "ФИО Родителя", "Телефон", "Менеджер", "Комментарий менеджера", "Русский", "Математика", "Логика", "К психологу?", "Вердикт", "Комментарий психолога", "Финальное решение"]);
    }

    if (action === "submitTest") {
      const { testId, shortId, studentName, grade, answers, cheated } = data;
      
      const dataRange = testSheet.getDataRange().getValues();
      for (let i = 1; i < dataRange.length; i++) {
        if (dataRange[i][7] === testId || dataRange[i][10] === shortId) {
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
      const crmStudent = getCrmByShortId(crmSheet, shortId);
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
      if (getCrmByShortId(crmSheet, shortId)) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Этот ученик уже в CRM" })).setMimeType(ContentService.MimeType.JSON);
      }

      crmSheet.appendRow([
        new Date().toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }), 
        shortId, 
        sanitize(childName), 
        sanitize(parentName), 
        sanitize(phone), 
        sanitize(managerName), 
        sanitize(managerComment), 
        student.russian, 
        student.math, 
        student.logic, 
        sentToPsych ? "ДА" : "НЕТ", 
        "", 
        "", 
        ""
      ]);
      return ContentService.createTextOutput(JSON.stringify({ success: true, student })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "getPsychologistStudent") {
      const { shortId } = data;
      const crmStudent = getCrmByShortId(crmSheet, shortId);
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
      const crmStudent = getCrmByShortId(crmSheet, shortId);
      if (!crmStudent) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Ученик не найден в CRM" })).setMimeType(ContentService.MimeType.JSON);
      }
      crmSheet.getRange(crmStudent.row, 12).setValue(sanitize(verdict));
      crmSheet.getRange(crmStudent.row, 13).setValue(sanitize(comment));
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "getAllStudents") {
      const crmData = crmSheet.getDataRange().getValues();
      let students = [];
      for (let i = 1; i < crmData.length; i++) {
        students.push({
          date: crmData[i][0],
          shortId: crmData[i][1],
          childName: crmData[i][2],
          parentName: crmData[i][3],
          phone: crmData[i][4],
          managerName: crmData[i][5],
          ru: crmData[i][7],
          ma: crmData[i][8],
          lo: crmData[i][9],
          sentToPsych: crmData[i][10],
          psychVerdict: crmData[i][11],
          finalDecision: crmData[i][13]
        });
      }
      // Also get students that took the test but are NOT in CRM yet
      const testData = testSheet.getDataRange().getValues();
      let crmIds = new Set(students.map(s => String(s.shortId)));
      
      for (let i = 1; i < testData.length; i++) {
        const shortId = String(testData[i][10]);
        if (!crmIds.has(shortId) && shortId && shortId !== "undefined") {
          students.push({
            date: testData[i][0],
            shortId: shortId,
            childName: testData[i][1],
            parentName: "",
            phone: "",
            managerName: "Не назначен",
            ru: testData[i][3],
            ma: testData[i][4],
            lo: testData[i][5],
            sentToPsych: "НЕТ",
            psychVerdict: "",
            finalDecision: "НЕ ОБРАБОТАН"
          });
        }
      }
      // Sort newest first
      students.reverse();
      return ContentService.createTextOutput(JSON.stringify({ success: true, students })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "updateFinalDecision") {
      const { shortId, finalDecision } = data;
      const crmStudent = getCrmByShortId(crmSheet, shortId);
      if (crmStudent) {
        crmSheet.getRange(crmStudent.row, 14).setValue(sanitize(finalDecision));
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
"""

with open("scratch/Code.gs", "w", encoding="utf-8") as f:
    f.write(gas_code)
