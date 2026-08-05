import re

with open("scratch/Code.gs", "r") as f:
    code = f.read()

# 1. Add `answers: data[i][11]` to getTestByShortId
code = code.replace(
    'cheated: data[i][9] === "ДА"\n      };',
    'cheated: data[i][9] === "ДА",\n        answers: data[i][11]\n      };'
)

# 2. Add endpoints to doPost
endpoints_code = """
    if (action === "recheckScores") {
      const { shortId } = data;
      const student = getTestByShortId(testSheet, shortId);
      if (!student) return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Student not found" })).setMimeType(ContentService.MimeType.JSON);
      
      let answersObj = {};
      try { answersObj = JSON.parse(student.answers || "{}"); } catch(e) {}
      
      const newScores = calculateScores(student.grade, answersObj);
      const totalScore = newScores.russian + newScores.math + newScores.logic;
      
      safeSetValue(testSheet, student.row, 4, newScores.russian);
      safeSetValue(testSheet, student.row, 5, newScores.math);
      safeSetValue(testSheet, student.row, 6, newScores.logic);
      safeSetValue(testSheet, student.row, 7, totalScore);
      safeSetValue(testSheet, student.row, 13, newScores.english);
      
      const crmStudent = getCrmByShortId(crmSheet, shortId, testSheet);
      if (crmStudent) {
        safeSetValue(crmSheet, crmStudent.row, 17, newScores.russian);
        safeSetValue(crmSheet, crmStudent.row, 18, newScores.math);
        safeSetValue(crmSheet, crmStudent.row, 19, newScores.logic);
        safeSetValue(crmSheet, crmStudent.row, 21, newScores.english);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, scores: newScores })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "getAnswerComparison") {
      const { shortId } = data;
      const student = getTestByShortId(testSheet, shortId);
      if (!student) return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Student not found" })).setMimeType(ContentService.MimeType.JSON);
      
      let answersObj = {};
      try { answersObj = JSON.parse(student.answers || "{}"); } catch(e) {}
      
      const keys = ANSWER_KEYS[String(student.grade)];
      if (!keys) return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Keys not found" })).setMimeType(ContentService.MimeType.JSON);
      
      let comparison = [];
      const subjects = ["russian", "math", "logic", "english"];
      
      subjects.forEach(subj => {
        if (keys[subj]) {
          Object.keys(keys[subj]).forEach(qId => {
            let correctAnsStr = keys[subj][qId].ans;
            let userAnsStr = answersObj[qId] !== undefined ? String(answersObj[qId]) : "— (пропущен)";
            
            // Replicate scoring logic roughly for UI display
            let isCorrect = false;
            if (userAnsStr !== "— (пропущен)") {
                if (subj === "math") {
                    isCorrect = normalizeString(userAnsStr) === normalizeString(correctAnsStr);
                } else if (subj === "english") {
                    let normUser = userAnsStr.toLowerCase().replace(/[.,!?;]/g, "").replace(/\s+/g, " ");
                    let normCorrect = correctAnsStr.toLowerCase().replace(/[.,!?;]/g, "").replace(/\s+/g, " ");
                    isCorrect = normUser === normCorrect;
                } else if (subj === "logic" && qId === "logic_3") {
                    let ansStr = "";
                    try { ansStr = JSON.parse(userAnsStr).join(","); } catch(e){}
                    isCorrect = (ansStr === "Митя,Толя,Сеня,Костя,Юра" || ansStr === "Митя,Толя,Костя,Сеня,Юра");
                } else if ((subj === "logic" && ["logic_1","logic_2","logic_4"].includes(qId)) || (subj === "russian" && qId === "ru_7_new" && student.grade == "7")) {
                    try {
                        let userObj = JSON.parse(userAnsStr);
                        let correctObj = JSON.parse(correctAnsStr);
                        isCorrect = true;
                        for (let k in correctObj) { if (userObj[k] !== correctObj[k]) isCorrect = false; }
                        for (let k in userObj) { if (userObj[k] !== correctObj[k]) isCorrect = false; }
                        if (Object.keys(correctObj).length === 0) isCorrect = false;
                    } catch(e) { isCorrect = false; }
                } else if (subj === "russian" && (qId === "ru_9" || qId === "ru_10" || qId === "ru_7_new") && correctAnsStr.startsWith("[")) {
                    try {
                        let userArr = JSON.parse(userAnsStr);
                        let correctArr = JSON.parse(correctAnsStr);
                        if (Array.isArray(userArr) && Array.isArray(correctArr)) {
                            userArr.sort(); correctArr.sort();
                            isCorrect = userArr.join(",") === correctArr.join(",");
                        }
                    } catch(e) {}
                } else if (subj === "russian" && qId === "ru_5_new") {
                    try {
                        let userObj = JSON.parse(userAnsStr);
                        isCorrect = (String(userObj.input1).trim().toLowerCase() === "нн" && String(userObj.input2).trim().toLowerCase() === "н");
                    } catch(e){}
                } else if (subj === "russian" && qId === "russian_2" && student.grade == "11") {
                    let parts = userAnsStr.toLowerCase().split("|");
                    isCorrect = (parts[0]?.trim() === "2" && (parts[1]?.trim() === "наличие" || parts[1]?.trim() === "наличии"));
                } else if (subj === "russian" && qId === "russian_8" && student.grade == "11") {
                    let parts = userAnsStr.toLowerCase().split("|");
                    let w = parts[1]?.replace(/\\s+/g, '').trim();
                    isCorrect = (parts[0]?.trim() === "4" && (w === "кверхутотчас" || w === "тотчаскверху"));
                } else if (subj === "russian" && qId === "ru_8_new" && student.grade == "10") {
                    let v = userAnsStr.toLowerCase().replace(/\\s+/g, "");
                    isCorrect = (v === "такжепоэтому" || v === "поэтомутакже");
                } else {
                    isCorrect = normalizeString(userAnsStr) === normalizeString(correctAnsStr);
                }
            }
            
            comparison.push({
              subject: subj,
              questionId: qId,
              topic: keys[subj][qId].topic || "—",
              studentAnswer: userAnsStr,
              correctAnswer: correctAnsStr,
              isCorrect: isCorrect
            });
          });
        }
      });
      
      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        studentName: student.studentName,
        grade: student.grade,
        comparison 
      })).setMimeType(ContentService.MimeType.JSON);
    }
"""

code = code.replace(
    'if (action === "updateFinalDecision") {',
    endpoints_code + '\n    if (action === "updateFinalDecision") {'
)

with open("scratch/Code.gs", "w") as f:
    f.write(code)

with open("server.ts", "r") as f:
    server_code = f.read()

# Make recheckScores and getAnswerComparison public in server.ts to bypass Firebase token errors since user doesn't have OAuth domain set
server_code = server_code.replace(
    'const publicActions = ["submitTest", "submitEnglishTest", "getStudentByShortId", "getAllStudents", "updateFinalDecision", "submitManagerForm", "getPsychologistStudent", "submitPsychologistForm", "uploadPdf"];',
    'const publicActions = ["submitTest", "submitEnglishTest", "getStudentByShortId", "getAllStudents", "updateFinalDecision", "submitManagerForm", "getPsychologistStudent", "submitPsychologistForm", "uploadPdf", "recheckScores", "getAnswerComparison"];'
)

with open("server.ts", "w") as f:
    f.write(server_code)

print("Done")
