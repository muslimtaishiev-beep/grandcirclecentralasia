const fs = require('fs');
let code = fs.readFileSync('scratch/Code_final.gs', 'utf8');

code = code.replace(
  'const keys = ANSWER_KEYS[String(student.grade)];\\n      if (!keys) return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Keys not found" })).setMimeType(ContentService.MimeType.JSON);',
  'const match = String(student.grade).match(/\\\\d+/);\\n      const cleanGrade = match ? match[0] : String(student.grade);\\n      const keys = ANSWER_KEYS[cleanGrade];\\n      if (!keys) return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Keys not found" })).setMimeType(ContentService.MimeType.JSON);'
);

fs.writeFileSync('scratch/Code_final.gs', code);
