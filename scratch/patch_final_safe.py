with open('scratch/Code_final.gs', 'r') as f:
    code = f.read()

import re
import json

# Fix date formatting and other logic as done previously

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

upload_logic = """
    if (action === "uploadPdf") {
      const { shortId, childName, base64Data } = data;
      const FOLDER_NAME = "Аналитика Академия Будущих Лидеров";
      let folders = DriveApp.getFoldersByName(FOLDER_NAME);
      let folder;
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder(FOLDER_NAME);
      }
      
      let base64String = base64Data;
      if (base64String.indexOf("base64,") !== -1) {
        base64String = base64String.split("base64,")[1];
      }
      
      const decoded = Utilities.base64Decode(base64String);
      const safeName = sanitize(childName || shortId);
      const blob = Utilities.newBlob(decoded, "application/pdf", `Аналитика_${safeName}_${shortId}.pdf`);
      
      const file = folder.createFile(blob);
      const fileUrl = file.getUrl();
      
      // Update CRM sheet with the PDF link (Column 22 - V)
      const crmData = crmSheet.getDataRange().getValues();
      for (let i = 1; i < crmData.length; i++) {
        if (String(crmData[i][4]) === String(shortId)) {
          safeSetValue(crmSheet, i + 1, 22, fileUrl);
          break;
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, url: fileUrl })).setMimeType(ContentService.MimeType.JSON);
    }
"""
if "uploadPdf" not in code:
    code = code.replace('return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unknown action" })).setMimeType(ContentService.MimeType.JSON);', upload_logic + '\n    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unknown action" })).setMimeType(ContentService.MimeType.JSON);')

with open('src/data/testsData.ts', 'r') as f:
    ts_data = f.read()

q_texts = {}
for match in re.finditer(r'id:\s*["\'](.*?)["\'].*?text:\s*["\'](.*?)["\']', ts_data, re.DOTALL):
    q_texts[match.group(1)] = match.group(2)

def guess_topic(qid, text, subject):
    text_lower = text.lower()
    if subject == "russian":
        if "запят" in text_lower or "пунктуаци" in text_lower or "тире" in text_lower or "вводн" in text_lower or "сложн" in text_lower:
            return "Пунктуация"
        elif "синтаксис" in text_lower or "сказуем" in text_lower or "основа" in text_lower or "грамматик" in text_lower or "соотнесите" in text_lower:
            return "Синтаксис"
        else:
            return "Орфография"
    elif subject == "math":
        if "уравнен" in text_lower or "неравенств" in text_lower or "систем" in text_lower:
            return "Алгебра: Уравнения и неравенства"
        elif "геометр" in text_lower or "угол" in text_lower or "треугольник" in text_lower or "площадь" in text_lower:
            return "Геометрия"
        elif "функц" in text_lower or "график" in text_lower:
            return "Функции и графики"
        elif "задач" in text_lower or "мотоциклист" in text_lower or "процент" in text_lower:
            return "Текстовые задачи и Прогрессии"
        else:
            return "Алгебра: Вычисления и преобразования"
    elif subject == "logic":
        if "утвержден" in text_lower or "истин" in text_lower or "лож" in text_lower or "матриц" in text_lower:
            return "Анализ данных и множества"
        else:
            return "Логико-математические задачи"
    elif subject == "english":
        if "tense" in text_lower or "verb" in text_lower:
            return "Grammar: Basic Tenses (Present/Past)"
        else:
            return "Vocabulary & Prepositions"
    return "Основные навыки"

# CAREFUL REGEX TO ADD TOPIC
lines = code.split('\n')
for i, line in enumerate(lines):
    if '"ans"' in line or ' ans:' in line:
        if 'topic:' not in line:
            # find the qid by searching backwards
            qid = None
            for j in range(i, max(-1, i-5), -1):
                m = re.search(r'"([a-zA-Z0-9_]+)":\s*\{', lines[j])
                if m:
                    qid = m.group(1)
                    break
            
            if qid:
                subj = "russian"
                if qid.startswith("ma") or "math" in qid: subj = "math"
                if qid.startswith("lo") or "logic" in qid: subj = "logic"
                if qid.startswith("en") or "english" in qid: subj = "english"
                
                q_text = q_texts.get(qid, "")
                topic = guess_topic(qid, q_text, subj)
                
                # safely inject before the last closing brace in the line
                # "russian_1": { "ans": "быстро бежать", "pts": 1 },
                # find the last '}'
                last_brace = line.rfind('}')
                if last_brace != -1:
                    lines[i] = line[:last_brace] + f', topic: "{topic}" ' + line[last_brace:]

code = '\n'.join(lines)
with open('scratch/Code_Fixed.gs', 'w') as f:
    f.write(code)

print("Safely injected topics!")
