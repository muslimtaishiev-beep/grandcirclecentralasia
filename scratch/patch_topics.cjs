const fs = require('fs');
let code = fs.readFileSync('scratch/Code_final.gs', 'utf-8');
const testsData = fs.readFileSync('src/data/testsData.ts', 'utf-8');

// 1. Add getMacroCategory and topics fix
const getMacroCode = `
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
`;

if (!code.includes("function getMacroCategory")) {
    code = code.replace("function calculateScores(grade, answers) {", getMacroCode + "\nfunction calculateScores(grade, answers) {");
}

const diagnosticsInit = `
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
`;

code = code.replace('let ru = 0, ma = 0, lo = 0, en = 0;', 'let ru = 0, ma = 0, lo = 0, en = 0;\n' + diagnosticsInit);

const parseLogic = `
  if (typeof answers === 'string') {
    try { 
      answers = JSON.parse(answers); 
    } catch(e) { 
      answers = {}; 
    }
  }
`;
if (!code.includes("JSON.parse(answers)")) {
    code = code.replace("function calculateScores(grade, answers) {\n", "function calculateScores(grade, answers) {\n" + parseLogic);
}

code = code.replace(/ru \+= keys\.russian\[qId\]\.pts;/g, 'ru += keys.russian[qId].pts; addEarned("russian", qId, keys.russian);');
code = code.replace(/ru \+= pts;/g, 'ru += pts; addEarned("russian", qId, keys.russian);');
code = code.replace(/ma \+= pts;/g, 'ma += pts; addEarned("math", qId, keys.math);');
code = code.replace(/lo \+= pts;/g, 'lo += pts; addEarned("logic", qId, keys.logic);');
code = code.replace(/en \+= pts;/g, 'en += pts; addEarned("english", qId, keys.english);');

code = code.replace("return { russian: ru, math: ma, logic: lo, english: en };", "return { scores: { russian: ru, math: ma, logic: lo, english: en }, diagnosticsRaw };");

code = code.replace(/scores = calculateScores\(grade, answers\);/, 'let result = calculateScores(grade, answers);\n        scores = result.scores;\n        var diagnosticsRaw = result.diagnosticsRaw;');

code = code.replace(/testSheet\.getRange\(rowToUpdate, 1, 1, 13\)\.setValues\(\[\[(.*?)\]\]\);/g, (match, p1) => {
    return 'testSheet.getRange(rowToUpdate, 1, 1, 15).setValues([[' + p1 + ', "ЗАВЕРШЕН", JSON.stringify(diagnosticsRaw)]]);';
});

code = code.replace(/testSheet\.appendRow\(\[\s*(.*?)\s*\]\);/gs, (match, p1) => {
    if (p1.includes("finalName, grade, scores.russian")) {
        return 'testSheet.appendRow([' + p1 + ', "ЗАВЕРШЕН", JSON.stringify(diagnosticsRaw)]);';
    }
    return match;
});

const recheckPattern = /const newScores = calculateScores\(student\.grade, answersObj\);\n\s*const totalScore = newScores\.russian \+ newScores\.math \+ newScores\.logic;\n\s*safeSetValue\(testSheet, student\.row, 4, newScores\.russian\);\n\s*safeSetValue\(testSheet, student\.row, 5, newScores\.math\);\n\s*safeSetValue\(testSheet, student\.row, 6, newScores\.logic\);\n\s*safeSetValue\(testSheet, student\.row, 7, totalScore\);\n\s*safeSetValue\(testSheet, student\.row, 13, newScores\.english\);/;
const recheckReplacement = `const result = calculateScores(student.grade, answersObj);
      const newScores = result.scores;
      const diagnosticsRaw = result.diagnosticsRaw;
      const totalScore = newScores.russian + newScores.math + newScores.logic;
      
      safeSetValue(testSheet, student.row, 4, newScores.russian);
      safeSetValue(testSheet, student.row, 5, newScores.math);
      safeSetValue(testSheet, student.row, 6, newScores.logic);
      safeSetValue(testSheet, student.row, 7, totalScore);
      safeSetValue(testSheet, student.row, 13, newScores.english);
      safeSetValue(testSheet, student.row, 15, JSON.stringify(diagnosticsRaw));`;
code = code.replace(recheckPattern, recheckReplacement);

code = code.replace('return ContentService.createTextOutput(JSON.stringify({ success: true, scores: newScores })).setMimeType(ContentService.MimeType.JSON);', 'return ContentService.createTextOutput(JSON.stringify({ success: true, scores: newScores, diagnosticsRaw })).setMimeType(ContentService.MimeType.JSON);');

const getAllPattern = /testMap\[String\(testData\[i\]\[10\]\)\] = \{\s*cheated: \(testData\[i\]\[9\] === "ДА"\),\s*grade: testData\[i\]\[2\],\s*status: testData\[i\]\[13\]\s*\};/;
const getAllReplacement = `
        let rawStr = testData[i][14] || "{}";
        let rawObj = {};
        try { rawObj = JSON.parse(rawStr); } catch(e) {}
        
        testMap[String(testData[i][10])] = {
          cheated: (testData[i][9] === "ДА"),
          grade: testData[i][2],
          status: testData[i][13],
          diagnosticsRaw: rawObj
        };
`;
code = code.replace(getAllPattern, getAllReplacement);

code = code.replace(/grade: testMap\[sid\] \? String\(testMap\[sid\]\.grade\) : "",\s*status: testMap\[sid\] \? String\(testMap\[sid\]\.status\) : ""/, 'grade: testMap[sid] ? String(testMap[sid].grade) : "",\n          status: testMap[sid] ? String(testMap[sid].status) : "",\n          diagnosticsRaw: testMap[sid] ? testMap[sid].diagnosticsRaw : {}');

code = code.replace(/grade: String\(testData\[i\]\[2\]\),\s*status: String\(testData\[i\]\[13\]\)/, 'grade: String(testData[i][2]),\n            status: String(testData[i][13]),\n            diagnosticsRaw: (function(){ try { return JSON.parse(testData[i][14] || "{}"); } catch(e){ return {}; } })()');

const uploadLogic = `
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
      const blob = Utilities.newBlob(decoded, "application/pdf", \`Аналитика_\${safeName}_\${shortId}.pdf\`);
      
      const file = folder.createFile(blob);
      const fileUrl = file.getUrl();
      
      const crmData = crmSheet.getDataRange().getValues();
      for (let i = 1; i < crmData.length; i++) {
        if (String(crmData[i][4]) === String(shortId)) {
          safeSetValue(crmSheet, i + 1, 22, fileUrl);
          break;
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, url: fileUrl })).setMimeType(ContentService.MimeType.JSON);
    }
`;
if (!code.includes("uploadPdf")) {
    code = code.replace('return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unknown action" })).setMimeType(ContentService.MimeType.JSON);', uploadLogic + '\n    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unknown action" })).setMimeType(ContentService.MimeType.JSON);');
}


// --- INJECT TOPICS ---
let q_texts = {};
const regex = /id:\s*["']([^"']+)["'][^}]*?text:\s*["'](.*?)["']/gs;
let match;
while ((match = regex.exec(testsData)) !== null) {
  q_texts[match[1]] = match[2];
}

function guessTopic(qid, text, subject) {
    let t = text.toLowerCase();
    if (subject === "russian") {
        if (t.includes("запят") || t.includes("пунктуаци") || t.includes("тире") || t.includes("вводн") || t.includes("сложн")) return "Пунктуация";
        if (t.includes("синтаксис") || t.includes("сказуем") || t.includes("основа") || t.includes("грамматик") || t.includes("соотнесите")) return "Синтаксис";
        return "Орфография";
    }
    if (subject === "math") {
        if (t.includes("уравнен") || t.includes("неравенств") || t.includes("систем")) return "Алгебра: Уравнения и неравенства";
        if (t.includes("геометр") || t.includes("угол") || t.includes("треугольник") || t.includes("площадь")) return "Геометрия";
        if (t.includes("функц") || t.includes("график")) return "Функции и графики";
        if (t.includes("задач") || t.includes("мотоциклист") || t.includes("процент")) return "Текстовые задачи и Прогрессии";
        return "Алгебра: Вычисления и преобразования";
    }
    if (subject === "logic") {
        if (t.includes("утвержден") || t.includes("истин") || t.includes("лож") || t.includes("матриц")) return "Анализ данных и множества";
        return "Логико-математические задачи";
    }
    if (subject === "english") {
        if (t.includes("tense") || t.includes("verb")) return "Grammar: Basic Tenses (Present/Past)";
        return "Vocabulary & Prepositions";
    }
    return "Основные навыки";
}

let lines = code.split('\n');
let currentQid = null;
let currentSubject = null;

for (let i = 0; i < lines.length; i++) {
  // Check if this line starts a new question block
  let mQid = lines[i].match(/"([a-zA-Z0-9_]+)":\s*\{/);
  if (mQid) {
    currentQid = mQid[1];
    if (currentQid.startsWith("ma") || currentQid.includes("math")) currentSubject = "math";
    else if (currentQid.startsWith("lo") || currentQid.includes("logic")) currentSubject = "logic";
    else if (currentQid.startsWith("en") || currentQid.includes("english")) currentSubject = "english";
    else currentSubject = "russian";
  }
  
  // if this line contains pts: 1, inject topic
  if ((lines[i].includes('pts: 1') || lines[i].includes('"pts": 1') || lines[i].includes('pts:1') || lines[i].includes('"pts":1')) && !lines[i].includes('topic:')) {
    if (currentQid) {
      let qtext = q_texts[currentQid] || "";
      let topic = guessTopic(currentQid, qtext, currentSubject);
      
      lines[i] = lines[i].replace(/(["']?pts["']?\s*:\s*1[0-9]*)/, `$1, topic: "${topic}"`);
    }
  }
}

fs.writeFileSync('scratch/Code_Fixed.gs', lines.join('\n'));
console.log("JS patching done!");
