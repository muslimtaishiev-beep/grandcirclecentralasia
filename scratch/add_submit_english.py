with open("scratch/Code.gs", "r", encoding="utf-8") as f:
    content = f.read()

submit_english_code = """
    if (action === "submitEnglishTest") {
      const { shortId, grade, answers, cheated } = data;
      
      const testData = testSheet.getDataRange().getValues();
      let testRowIdx = -1;
      let scores = { english: 0 };
      
      for (let i = 1; i < testData.length; i++) {
        if (testData[i][10] === shortId) {
          testRowIdx = i + 1;
          break;
        }
      }
      
      if (testRowIdx === -1) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Основной тест не найден по этому ID" })).setMimeType(ContentService.MimeType.JSON);
      }
      
      if (!cheated) {
        scores = calculateScores(grade, answers);
      }
      
      // Update English score in testSheet (Column 13 - M)
      testSheet.getRange(testRowIdx, 13).setValue(scores.english);
      
      // Also update CRM sheet if the manager has already created a row
      const crmData = crmSheet.getDataRange().getValues();
      for (let i = 1; i < crmData.length; i++) {
        if (crmData[i][4] === shortId) { // Column 5 is "ID Теста (ученика)"
          // Update English score in crmSheet (Column 21 - U)
          crmSheet.getRange(i + 1, 21).setValue(scores.english);
          break;
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, scores, cheated: !!cheated })).setMimeType(ContentService.MimeType.JSON);
    }
"""

# Insert right after submitTest
insert_pos = content.find('if (action === "getStudentByShortId") {')
if insert_pos != -1:
    content = content[:insert_pos] + submit_english_code + "\n    " + content[insert_pos:]
    with open("scratch/Code.gs", "w", encoding="utf-8") as f:
        f.write(content)
        print("Patched Code.gs successfully!")
else:
    print("Could not find getStudentByShortId")
