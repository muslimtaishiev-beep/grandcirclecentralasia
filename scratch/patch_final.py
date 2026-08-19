with open('scratch/Code_final.gs', 'r') as f:
    code = f.read()

# 1. Add getMacroCategory and topics fix
get_macro_code = """
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
"""

if "function getMacroCategory" not in code:
    code = code.replace("function calculateScores(grade, answers) {", get_macro_code + "\nfunction calculateScores(grade, answers) {")

diagnostics_init = """
  let diagnosticsRaw = {};
  
  function initPossible(subject, keyMap) {
    Object.keys(keyMap).forEach(qId => {
      let qData = keyMap[qId];
      let topicText = qData.topic || "";
      let macro = getMacroCategory(topicText, subject);
      if (!diagnosticsRaw[macro]) diagnosticsRaw[macro] = { earned: 0, possible: 0, subject: subject };
      diagnosticsRaw[macro].possible += (qData.pts || 1);
    });
  }
  
  function addEarned(subject, qId, keyMap) {
    let qData = keyMap[qId];
    let topicText = qData.topic || "";
    let macro = getMacroCategory(topicText, subject);
    if (diagnosticsRaw[macro]) {
      diagnosticsRaw[macro].earned += (qData.pts || 1);
    }
  }

  initPossible("russian", keys.russian || {});
  initPossible("math", keys.math || {});
  initPossible("logic", keys.logic || {});
  initPossible("english", keys.english || {});
"""

import re
# DO NOT REMOVE the if statement!
code = code.replace('let ru = 0, ma = 0, lo = 0, en = 0;', 'let ru = 0, ma = 0, lo = 0, en = 0;\n' + diagnostics_init)

parse_logic = """
  if (typeof answers === 'string') {
    try { 
      answers = JSON.parse(answers); 
    } catch(e) { 
      answers = {}; 
    }
  }
"""
if "JSON.parse(answers)" not in code:
    code = code.replace("function calculateScores(grade, answers) {\n", "function calculateScores(grade, answers) {\n" + parse_logic)

code = re.sub(r'ru \+= keys\.russian\[qId\]\.pts;', r'ru += keys.russian[qId].pts; addEarned("russian", qId, keys.russian);', code)
code = re.sub(r'ru \+= pts;', r'ru += pts; addEarned("russian", qId, keys.russian);', code)
code = re.sub(r'ma \+= pts;', r'ma += pts; addEarned("math", qId, keys.math);', code)
code = re.sub(r'lo \+= pts;', r'lo += pts; addEarned("logic", qId, keys.logic);', code)
code = re.sub(r'en \+= pts;', r'en += pts; addEarned("english", qId, keys.english);', code)

code = code.replace("return { russian: ru, math: ma, logic: lo, english: en };", "return { scores: { russian: ru, math: ma, logic: lo, english: en }, diagnosticsRaw };")

code = re.sub(
    r'scores = calculateScores\(grade, answers\);',
    r'let result = calculateScores(grade, answers);\n        scores = result.scores;\n        var diagnosticsRaw = result.diagnosticsRaw;',
    code
)

# 2. Fix submitTest to write 15 columns
submit_pattern = r'testSheet\.getRange\(rowToUpdate, 1, 1, 13\)\.setValues\(\[\[(.*?)\]\]\);'
def repl_submit_update(m):
    inner = m.group(1)
    return 'testSheet.getRange(rowToUpdate, 1, 1, 15).setValues([[' + inner + ', "ЗАВЕРШЕН", JSON.stringify(diagnosticsRaw)]]);'
code = re.sub(submit_pattern, repl_submit_update, code, flags=re.DOTALL)

submit_append_pattern = r'testSheet\.appendRow\(\[\s*(.*?)\s*\]\);'
def repl_submit_append(m):
    inner = m.group(1)
    if "finalName, grade, scores.russian" in inner:
        return 'testSheet.appendRow([' + inner + ', "ЗАВЕРШЕН", JSON.stringify(diagnosticsRaw)]);'
    return m.group(0)
code = re.sub(submit_append_pattern, repl_submit_append, code, flags=re.DOTALL)

# 3. Fix recheckScores to save diagnosticsRaw to column 15
recheck_pattern = r'const newScores = calculateScores\(student\.grade, answersObj\);\n\s*const totalScore = newScores\.russian \+ newScores\.math \+ newScores\.logic;\n\s*safeSetValue\(testSheet, student\.row, 4, newScores\.russian\);\n\s*safeSetValue\(testSheet, student\.row, 5, newScores\.math\);\n\s*safeSetValue\(testSheet, student\.row, 6, newScores\.logic\);\n\s*safeSetValue\(testSheet, student\.row, 7, totalScore\);\n\s*safeSetValue\(testSheet, student\.row, 13, newScores\.english\);'
recheck_replacement = """const result = calculateScores(student.grade, answersObj);
      const newScores = result.scores;
      const diagnosticsRaw = result.diagnosticsRaw;
      const totalScore = newScores.russian + newScores.math + newScores.logic;
      
      safeSetValue(testSheet, student.row, 4, newScores.russian);
      safeSetValue(testSheet, student.row, 5, newScores.math);
      safeSetValue(testSheet, student.row, 6, newScores.logic);
      safeSetValue(testSheet, student.row, 7, totalScore);
      safeSetValue(testSheet, student.row, 13, newScores.english);
      safeSetValue(testSheet, student.row, 15, JSON.stringify(diagnosticsRaw));"""
code = re.sub(recheck_pattern, recheck_replacement, code)

code = code.replace(
    'return ContentService.createTextOutput(JSON.stringify({ success: true, scores: newScores })).setMimeType(ContentService.MimeType.JSON);',
    'return ContentService.createTextOutput(JSON.stringify({ success: true, scores: newScores, diagnosticsRaw })).setMimeType(ContentService.MimeType.JSON);'
)

# 4. Fix getAllStudents to read diagnosticsRaw from column 15
get_all_pattern = r'testMap\[String\(testData\[i\]\[10\]\)\] = \{\s*cheated: \(testData\[i\]\[9\] === "ДА"\),\s*grade: testData\[i\]\[2\],\s*status: testData\[i\]\[13\]\s*\};'
get_all_replacement = """
        let rawStr = testData[i][14] || "{}";
        let rawObj = {};
        try { rawObj = JSON.parse(rawStr); } catch(e) {}
        
        testMap[String(testData[i][10])] = {
          cheated: (testData[i][9] === "ДА"),
          grade: testData[i][2],
          status: testData[i][13],
          diagnosticsRaw: rawObj
        };
"""
code = re.sub(get_all_pattern, get_all_replacement, code)

push_pattern1 = r'grade: testMap\[sid\] \? String\(testMap\[sid\]\.grade\) : "",\s*status: testMap\[sid\] \? String\(testMap\[sid\]\.status\) : ""'
push_replacement1 = 'grade: testMap[sid] ? String(testMap[sid].grade) : "",\n          status: testMap[sid] ? String(testMap[sid].status) : "",\n          diagnosticsRaw: testMap[sid] ? testMap[sid].diagnosticsRaw : {}'
code = re.sub(push_pattern1, push_replacement1, code)

push_pattern2 = r'grade: String\(testData\[i\]\[2\]\),\s*status: String\(testData\[i\]\[13\]\)'
push_replacement2 = 'grade: String(testData[i][2]),\n            status: String(testData[i][13]),\n            diagnosticsRaw: (function(){ try { return JSON.parse(testData[i][14] || "{}"); } catch(e){ return {}; } })()'
code = re.sub(push_pattern2, push_replacement2, code)

with open('scratch/Code_Fixed.gs', 'w') as f:
    f.write(code)

print("Applied final fixes without deleting the braces!")
