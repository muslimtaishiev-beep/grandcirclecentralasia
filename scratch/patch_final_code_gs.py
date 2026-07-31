with open("scratch/Code.gs", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update calculateScores return
content = content.replace("return { russian: ru, math: ma, logic: lo };", "return { russian: ru, math: ma, logic: lo, english: en };")

# 2. Update calculateScores loop
english_block = """    });
    if (keys.english) {
      Object.keys(keys.english).forEach(qId => {
        let userAns = answers[qId] ? String(answers[qId]).trim() : "";
        let correctAns = keys.english[qId].ans;
        let normalizedUser = userAns.toLowerCase().replace(/[.,!?;]/g, "").replace(/\s+/g, " ");
        let normalizedCorrect = correctAns.toLowerCase().replace(/[.,!?;]/g, "").replace(/\s+/g, " ");
        if (normalizedUser === normalizedCorrect) en += keys.english[qId].pts;
      });
    }
  }"""
content = content.replace("    });\n  }\n  return { russian: ru", english_block + "\n  return { russian: ru")

# 3. Update getTestByShortId
content = content.replace(
    "math: data[i][4],\n        logic: data[i][5]",
    "math: data[i][4],\n        logic: data[i][5],\n        english: data[i][12]"
)

# 4. Update testSheet and crmSheet headers
content = content.replace(
    '"Short ID", "Ответы ученика (JSON)"]);',
    '"Short ID", "Ответы ученика (JSON)", "Английский язык"]);'
)
content = content.replace(
    '"Имя ребенка", "Русский", "Математика", "Логика", "Комментарий менеджера"]);',
    '"Имя ребенка", "Русский", "Математика", "Логика", "Комментарий менеджера", "Английский"]);'
)

# 5. Update submitTest appendRow
content = content.replace(
    "scores.logic, totalScore, testId, ts, cheated ? \"ДА\" : \"НЕТ\", shortId, answersStr]);",
    "scores.logic, totalScore, testId, ts, cheated ? \"ДА\" : \"НЕТ\", shortId, answersStr, scores.english]);"
)

# 6. Update submitManagerForm
content = content.replace(
    "new Array(20).fill(\"\");",
    "new Array(21).fill(\"\");"
)
content = content.replace(
    "newRow[18] = student.logic;\n      newRow[19] = sanitize(managerComment);",
    "newRow[18] = student.logic;\n      newRow[19] = sanitize(managerComment);\n      newRow[20] = student.english;"
)

# 7. Update getAllStudents CRM side
content = content.replace(
    "lo: crmData[i][18],",
    "lo: crmData[i][18],\n          en: crmData[i][20],"
)
# 8. Update getAllStudents Test side
content = content.replace(
    "lo: testData[i][5],",
    "lo: testData[i][5],\n            en: testData[i][12],"
)

with open("scratch/Code.gs", "w", encoding="utf-8") as f:
    f.write(content)
