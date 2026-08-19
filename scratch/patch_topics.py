import re
import json

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
code = re.sub(r'scores = calculateScores\(grade, answers\);', r'let result = calculateScores(grade, answers);\n        scores = result.scores;\n        var diagnosticsRaw = result.diagnosticsRaw;', code)

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

code = code.replace('return ContentService.createTextOutput(JSON.stringify({ success: true, scores: newScores })).setMimeType(ContentService.MimeType.JSON);', 'return ContentService.createTextOutput(JSON.stringify({ success: true, scores: newScores, diagnosticsRaw })).setMimeType(ContentService.MimeType.JSON);')

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

# SAFELY INJECT TOPICS
# We want to match: `"qid": { ... }` which can span multiple lines!
def replacer(match):
    full_str = match.group(0)
    if "topic:" in full_str:
        return full_str
    
    qid = match.group(1)
    inner = match.group(2)
    
    subj = "russian"
    if qid.startswith("ma") or "math" in qid: subj = "math"
    if qid.startswith("lo") or "logic" in qid: subj = "logic"
    if qid.startswith("en") or "english" in qid: subj = "english"
    
    q_text = q_texts.get(qid, "")
    topic = guess_topic(qid, q_text, subj)
    
    # insert topic before the last '}'
    last_brace = full_str.rfind('}')
    return full_str[:last_brace] + f', "topic": "{topic}"\n' + full_str[last_brace:]

# Match `"qid": { ... }` across newlines, where it ends with a closing brace that lines up with the same indentation, but easier is just matching `\{ [^{}]* \}` if there are no nested braces. But we DO have nested braces in `ans: JSON.stringify({...})`.
# So let's iterate line by line instead, but smarter.

new_code = ""
blocks = re.split(r'("[a-zA-Z0-9_]+":\s*\{)', code)
# blocks[0] is code before first match
# blocks[1] is the match `"qid": {`
# blocks[2] is the code after that until the next match
# Wait, this splits at EVERY `"key": {`, even inside `JSON.stringify({"key": {}})`.
# Let's just use Python's AST or a robust brace matcher!

def inject_topics_robust(code_text):
    out = ""
    i = 0
    while i < len(code_text):
        # find the start of a top-level question key: `      "qId": {`
        m = re.search(r'^(\s*)"([a-zA-Z0-9_]+)":\s*\{', code_text[i:], re.MULTILINE)
        if not m:
            out += code_text[i:]
            break
        
        start_idx = i + m.start()
        # append everything up to the start of the match
        out += code_text[i:start_idx]
        
        qid = m.group(2)
        indent = m.group(1)
        
        # now find the matching closing brace for this `{`
        brace_start = start_idx + m.end() - 1
        brace_count = 1
        j = brace_start + 1
        while j < len(code_text) and brace_count > 0:
            if code_text[j] == '{':
                brace_count += 1
            elif code_text[j] == '}':
                brace_count -= 1
            j += 1
        
        # code_text[start_idx:j] is the full `"qid": { ... }` block
        block = code_text[start_idx:j]
        
        if "topic:" not in block and '"topic"' not in block:
            subj = "russian"
            if qid.startswith("ma") or "math" in qid: subj = "math"
            if qid.startswith("lo") or "logic" in qid: subj = "logic"
            if qid.startswith("en") or "english" in qid: subj = "english"
            
            q_text = q_texts.get(qid, "")
            topic = guess_topic(qid, q_text, subj)
            
            # insert before the final brace
            block = block[:-1] + f', topic: "{topic}"' + '\n' + indent + '}'
        
        out += block
        i = j
    return out

final_code = inject_topics_robust(code)

with open('scratch/Code_Fixed.gs', 'w') as f:
    f.write(final_code)
