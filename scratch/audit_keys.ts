import * as fs from 'fs';
import * as path from 'path';

// Parse Code.gs keys (assuming it's a JS object we can extract)
const codeGsPath = path.join(process.cwd(), 'scratch', 'Code.gs');
const codeGsContent = fs.readFileSync(codeGsPath, 'utf8');

// Extract ANSWER_KEYS block
const answerKeysMatch = codeGsContent.match(/const ANSWER_KEYS = (\{[\s\S]*?\n\};\n)/);
if (!answerKeysMatch) {
  console.error("Could not find ANSWER_KEYS in Code.gs");
  process.exit(1);
}

let answerKeysStr = answerKeysMatch[1];
// Some slight fixups to make it valid JSON or eval-able JS if necessary.
// We can use eval to parse it.
let ANSWER_KEYS;
try {
  eval("ANSWER_KEYS = " + answerKeysStr);
} catch (e) {
  console.error("Failed to eval ANSWER_KEYS:", e);
  process.exit(1);
}

// Import testsData
import { testsData } from '../src/data/testsData';

function normalizeString(str) {
  if (typeof str !== 'string') return "";
  let s = str.toLowerCase().replace(/\s+/g, "");
  // Replace Cyrillic / Text issues
  s = s.replace(/ё/g, "е").replace(/…/g, ".");
  // Map exponents
  s = s.replace(/²/g, "^2").replace(/³/g, "^3").replace(/⁴/g, "^4").replace(/⁵/g, "^5").replace(/⁶/g, "^6");
  // Normalize Math Symbols / LaTeX
  s = s.replace(/≤/g, "<=").replace(/\\le/g, "<=");
  s = s.replace(/≥/g, ">=").replace(/\\ge/g, ">=");
  s = s.replace(/±/g, "+-").replace(/\\pm/g, "+-");
  s = s.replace(/π/g, "pi").replace(/\\pi/g, "pi");
  s = s.replace(/√/g, "sqrt").replace(/\\sqrt/g, "sqrt");
  s = s.replace(/∈/g, "in").replace(/\\in/g, "in");
  s = s.replace(/∞/g, "infty").replace(/\\infty/g, "infty");
  // Specific Logs
  s = s.replace(/log₃/g, "log_3").replace(/\\log_3/g, "log_3");
  s = s.replace(/log₅/g, "log_5").replace(/\\log_5/g, "log_5");
  // Remove formatting braces and text
  s = s.replace(/\\text/g, "").replace(/[{}]/g, "");
  // Greek letters
  s = s.replace(/α/g, "alpha").replace(/\\alpha/g, "alpha");
  return s;
}

const report = [];

for (const grade of Object.keys(testsData)) {
  report.push(`\n## 📝 Аудит ключей для ${grade} класса`);
  
  const uiData = testsData[grade as any];
  const backendKeys = ANSWER_KEYS[grade];
  
  if (!backendKeys) {
    report.push(`❌ ОШИБКА: Для ${grade} класса нет ключей в Code.gs!`);
    continue;
  }
  
  const subjects = ['russian', 'math'];
  
  for (const subject of subjects) {
    report.push(`\n### ${subject === 'russian' ? '🇷🇺 Русский язык' : '📐 Математика'}`);
    
    if (!uiData[subject]) continue;
    
    for (const q of uiData[subject]) {
      const qId = q.id;
      const keyData = backendKeys[subject]?.[qId];
      
      if (!keyData) {
        report.push(`- ❌ **${qId}**: Ключ отсутствует в \`Code.gs\``);
        continue;
      }
      
      const backendAns = keyData.ans;
      let isMatch = false;
      let reason = "";
      
      if (q.type === 'multiple_choice') {
        const matchingOption = q.options?.find(opt => normalizeString(opt) === normalizeString(backendAns));
        if (matchingOption) {
          isMatch = true;
        } else {
          // Check for specific hardcoded exceptions in Code.gs
          if (qId === 'ru_8_new' && grade === '10' && normalizeString(backendAns) === 'поэтомутакже') {
            isMatch = true;
          } else if (grade === '11' && qId === 'russian_2' && normalizeString(backendAns) === 'наличии') {
            isMatch = true; // In Code.gs: parts = ans.split("|"); option === 2 && word === наличие
          } else if (grade === '11' && qId === 'russian_8' && normalizeString(backendAns) === '4') {
            isMatch = true; // Code.gs splits and checks word
          } else {
            reason = `Ответ '${backendAns}' (norm: '${normalizeString(backendAns)}') не найден среди вариантов UI: \n    ${q.options?.map(o => `'${o}' (norm: '${normalizeString(o)}')`).join('\n    ')}`;
          }
        }
      } else if (q.type === 'clickable_text') {
        try {
          const arr = JSON.parse(backendAns);
          if (Array.isArray(arr)) {
            isMatch = true;
          } else {
            reason = `Ожидался JSON-массив, получено: '${backendAns}'`;
          }
        } catch (e) {
          reason = `Невалидный JSON: '${backendAns}'`;
        }
      } else if (q.type === 'dropdown_multiple') {
         try {
           const obj = JSON.parse(backendAns);
           if (typeof obj === 'object' && obj !== null) {
             isMatch = true;
             // Check if keys in obj exist in dropdownItems labels
             for (const k of Object.keys(obj)) {
                if (!q.dropdownItems?.find(item => item.label === k)) {
                  reason = `Ключ '${k}' не найден в dropdownItems. Возможные: ${q.dropdownItems?.map(i => i.label).join(', ')}`;
                  isMatch = false;
                  break;
                }
             }
           } else {
             reason = `Ожидался JSON-объект, получено: '${backendAns}'`;
           }
         } catch(e) {
           reason = `Невалидный JSON: '${backendAns}'`;
         }
      } else if (q.type === 'inline_inputs') {
         try {
           const obj = JSON.parse(backendAns);
           isMatch = true;
         } catch(e) {
           reason = `Невалидный JSON: '${backendAns}'`;
         }
      } else if (q.type === 'free_text' || q.type === 'number_input') {
         // It's text input, hard to validate perfectly against UI options since there are none, 
         // but we ensure it's not empty.
         if (backendAns !== "") {
           isMatch = true;
         } else {
           reason = `Пустой ответ в ключе`;
         }
      } else {
        isMatch = true; // other types
      }
      
      if (isMatch) {
        report.push(`- ✅ **${qId}**: OK`);
      } else {
        report.push(`- ❌ **${qId}**: НЕСОВПАДЕНИЕ. ${reason}`);
      }
    }
  }
}

// Write report
const reportPath = path.join(process.cwd(), 'test_audit_final.md');
fs.writeFileSync(reportPath, report.join('\n'), 'utf8');
console.log('Report written to test_audit_final.md');
