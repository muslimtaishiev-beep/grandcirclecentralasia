import re

with open('scratch/Code.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Replace `function calculateScores(grade, answers) {` body
# It's better to find the start and end of `calculateScores` and replace it entirely.
start_idx = code.find('function calculateScores(grade, answers) {')
end_idx = code.find('function getTestByShortId', start_idx)

new_calculate_scores = """function calculateScores(grade, answers) {
  const keys = ANSWER_KEYS[String(grade)];
  if (!keys) return { scores: { russian: 0, math: 0, logic: 0, english: 0 }, diagnosticsRaw: {} };
  
  let ru = 0, ma = 0, lo = 0, en = 0;
  let diagnosticsRaw = {};
  
  function trackTopic(topic, pts, isCorrect) {
    if (!topic || topic === "Общая тема") return;
    if (!diagnosticsRaw[topic]) diagnosticsRaw[topic] = { earned: 0, possible: 0 };
    diagnosticsRaw[topic].possible += pts;
    if (isCorrect) diagnosticsRaw[topic].earned += pts;
  }
  
  if (answers && typeof answers === 'object') {
    Object.keys(keys.russian).forEach(qId => {
      let userAnsStr = answers[qId] ? String(answers[qId]).trim() : "";
      let userAnsLower = userAnsStr.toLowerCase();
      let pts = keys.russian[qId].pts || 1;
      let topic = keys.russian[qId].topic;
      let isCorrect = false;
      
      if (String(grade) === "11" && qId === "russian_2") {
        let parts = userAnsLower.split("|");
        let optChoice = parts[0] ? parts[0].trim() : "";
        let wordChoice = parts[1] ? parts[1].trim() : "";
        if (optChoice === "2" && (wordChoice === "наличие" || wordChoice === "наличии")) isCorrect = true;
      } else if (String(grade) === "11" && qId === "russian_8") {
        let parts = userAnsLower.split("|");
        let optChoice = parts[0] ? parts[0].trim() : "";
        let wordChoice = parts[1] ? parts[1].replace(/\\s+/g, '').trim() : "";
        if (optChoice === "4" && (wordChoice === "кверхутотчас" || wordChoice === "тотчаскверху")) isCorrect = true;
      } else if (qId === "ru_5_new") {
        try {
          let userObj = JSON.parse(userAnsStr);
          let val1 = String(userObj["input1"] || "").trim().toLowerCase();
          let val2 = String(userObj["input2"] || "").trim().toLowerCase();
          if (val1 === "нн" && val2 === "н") isCorrect = true;
        } catch(e) {}
      } else if (qId === "ru_8_new" && String(grade) === "10") {
        let val = userAnsLower.replace(/\\s+/g, "");
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
        if (normalizeString(userAnsStr) === normalizeString(keys.russian[qId].ans)) isCorrect = true;
      }
      
      if (isCorrect) ru += pts;
      trackTopic(topic, pts, isCorrect);
    });
    
    Object.keys(keys.math).forEach(qId => {
      let userAns = answers[qId] ? String(answers[qId]) : "";
      let pts = keys.math[qId].pts || 1;
      let topic = keys.math[qId].topic;
      let isCorrect = (normalizeString(userAns) === normalizeString(keys.math[qId].ans));
      if (isCorrect) ma += pts;
      trackTopic(topic, pts, isCorrect);
    });
    
    Object.keys(keys.logic).forEach(qId => {
      let userAns = answers[qId] ? String(answers[qId]).trim() : "";
      let pts = keys.logic[qId].pts || 1;
      let topic = keys.logic[qId].topic;
      let isCorrect = false;
      
      if (qId === "logic_3") {
        let ansArray;
        try { ansArray = JSON.parse(userAns); } catch(e) { ansArray = []; }
        let ansStr = ansArray.join(",");
        if (ansStr === "Митя,Толя,Сеня,Костя,Юра" || ansStr === "Митя,Толя,Костя,Сеня,Юра") {
          isCorrect = true;
        }
      } else if (qId === "logic_1" || qId === "logic_2" || qId === "logic_4") {
        try { 
          let userObj = JSON.parse(userAns); 
          let correctObj = JSON.parse(keys.logic[qId].ans);
          isCorrect = true;
          for (let k in correctObj) {
            if (userObj[k] !== correctObj[k]) isCorrect = false;
          }
          for (let k in userObj) {
            if (userObj[k] !== correctObj[k]) isCorrect = false;
          }
          if (Object.keys(correctObj).length === 0) isCorrect = false;
        } catch(e) {}
      } else {
        if (normalizeString(userAns) === normalizeString(keys.logic[qId].ans)) isCorrect = true;
      }
      
      if (isCorrect) lo += pts;
      trackTopic(topic, pts, isCorrect);
    });
    
    if (keys.english) {
      let hasEnglish = false;
      Object.keys(keys.english).forEach(qId => {
        if (answers[qId] !== undefined) hasEnglish = true;
      });
      if (hasEnglish) {
        Object.keys(keys.english).forEach(qId => {
          let userAns = answers[qId] ? String(answers[qId]).trim() : "";
          let pts = keys.english[qId].pts || 1;
          let topic = keys.english[qId].topic;
          let correctAns = keys.english[qId].ans;
          let normalizedUser = userAns.toLowerCase().replace(/[.,!?;]/g, "").replace(/\\s+/g, " ");
          let normalizedCorrect = correctAns.toLowerCase().replace(/[.,!?;]/g, "").replace(/\\s+/g, " ");
          let isCorrect = (normalizedUser === normalizedCorrect);
          if (isCorrect) en += pts;
          trackTopic(topic, pts, isCorrect);
        });
      }
    }
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
  if (strengths.length > 0) reportText += "🟢 СИЛЬНЫЕ СТОРОНЫ:\\n" + strengths.join(", ") + "\\n\\n";
  if (average.length > 0) reportText += "🟡 СРЕДНИЙ УРОВЕНЬ:\\n" + average.join(", ") + "\\n\\n";
  if (weaknesses.length > 0) reportText += "🔴 ЗОНА РОСТА (Нужно подтянуть):\\n" + weaknesses.join(", ");

  return reportText.trim() || "Недостаточно данных для анализа.";
}

"""

code = code[:start_idx] + new_calculate_scores + code[end_idx:]

# 2. Update `testSheet.appendRow` in `submitTest`
# First, let's replace `let scores = { russian: 0, math: 0, logic: 0 }; ...`
submit_test_start = code.find('let scores = { russian: 0, math: 0, logic: 0 };')
submit_test_end = code.find('return ContentService.createTextOutput(JSON.stringify({ success: true, totalScore, scores, cheated: !!cheated })).setMimeType(ContentService.MimeType.JSON);', submit_test_start)
submit_test_end += len('return ContentService.createTextOutput(JSON.stringify({ success: true, totalScore, scores, cheated: !!cheated })).setMimeType(ContentService.MimeType.JSON);')

new_submit_test_logic = """let scores = { russian: 0, math: 0, logic: 0, english: 0 };
      let diagnosticsReport = "";
      if (!cheated) {
        const calc = calculateScores(grade, answers);
        scores = calc.scores;
        diagnosticsReport = generateDiagnosticReport(calc.diagnosticsRaw);
      }
      const totalScore = scores.russian + scores.math + scores.logic;
      
      const ts = new Date().getTime();
      const answersStr = JSON.stringify(answers || {});
      testSheet.appendRow([new Date(ts).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }), finalName, grade, scores.russian, scores.math, scores.logic, totalScore, testId, ts, cheated ? "ДА" : "НЕТ", shortId, answersStr, scores.english, diagnosticsReport]);
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, totalScore, scores, diagnosticsReport, cheated: !!cheated })).setMimeType(ContentService.MimeType.JSON);"""

code = code[:submit_test_start] + new_submit_test_logic + code[submit_test_end:]

# 3. Update `submitEnglishTest`
eng_test_start = code.find('if (action === "submitEnglishTest") {')
eng_test_end = code.find('if (action === "getStudentByShortId") {', eng_test_start)

# We want to recalculate everything because we need the full diagnostic report (including english).
# We can fetch the student's previous answers from testSheet column 12 (index 11).
new_eng_test = """if (action === "submitEnglishTest") {
      const { shortId, grade, answers, cheated } = data;
      
      const testData = testSheet.getDataRange().getValues();
      let testRowIdx = -1;
      let previousAnswersStr = "{}";
      
      for (let i = 1; i < testData.length; i++) {
        if (String(testData[i][10]) === String(shortId)) {
          testRowIdx = i + 1;
          previousAnswersStr = data[i][11] || "{}"; // assuming answers is col 12 (idx 11)
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
      if (!cheated) {
        const calc = calculateScores(grade, allAnswers);
        scores = calc.scores;
        diagnosticsReport = generateDiagnosticReport(calc.diagnosticsRaw);
      }
      
      // Update English score in testSheet (Column 13 - M)
      safeSetValue(testSheet, testRowIdx, 13, scores.english);
      
      // Update Diagnostics Report in testSheet (Column 14 - N)
      safeSetValue(testSheet, testRowIdx, 14, diagnosticsReport);
      
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

    """

code = code[:eng_test_start] + new_eng_test + code[eng_test_end:]

with open('scratch/Code.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated Code.js successfully.")
