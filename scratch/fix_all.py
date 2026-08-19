import re

with open('scratch/Code_final.gs', 'r') as f:
    code = f.read()

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

# Insert right after `let ru = 0...`
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
    r'let result = calculateScores(grade, answers);\n        scores = result.scores;',
    code
)

recheck_pattern = r'const newScores = calculateScores\(student\.grade, answersObj\);\n\s*const totalScore = newScores\.russian \+ newScores\.math \+ newScores\.logic;\n\s*safeSetValue\(testSheet, student\.row, 4, newScores\.russian\);\n\s*safeSetValue\(testSheet, student\.row, 5, newScores\.math\);\n\s*safeSetValue\(testSheet, student\.row, 6, newScores\.logic\);\n\s*safeSetValue\(testSheet, student\.row, 7, totalScore\);\n\s*safeSetValue\(testSheet, student\.row, 13, newScores\.english\);'
recheck_replacement = """const result = calculateScores(student.grade, answersObj);
      const newScores = result.scores;
      const diagnosticsRaw = result.diagnosticsRaw;
      const totalScore = newScores.russian + newScores.math + newScores.logic;
      
      safeSetValue(testSheet, student.row, 4, newScores.russian);
      safeSetValue(testSheet, student.row, 5, newScores.math);
      safeSetValue(testSheet, student.row, 6, newScores.logic);
      safeSetValue(testSheet, student.row, 7, totalScore);
      safeSetValue(testSheet, student.row, 13, newScores.english);"""
code = re.sub(recheck_pattern, recheck_replacement, code)

code = code.replace(
    'return ContentService.createTextOutput(JSON.stringify({ success: true, scores: newScores })).setMimeType(ContentService.MimeType.JSON);',
    'return ContentService.createTextOutput(JSON.stringify({ success: true, scores: newScores, diagnosticsRaw })).setMimeType(ContentService.MimeType.JSON);'
)

with open('scratch/Code_Fixed.gs', 'w') as f:
    f.write(code)
