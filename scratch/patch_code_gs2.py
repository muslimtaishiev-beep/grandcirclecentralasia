import json
import re

with open("scratch/english_raw.json", "r", encoding="utf-8") as f:
    data = json.load(f)

with open("scratch/Code.gs", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Insert English keys for grades 8, 9, 10, 11
for grade_key, data_key in [("8", "8"), ("9", "9"), ("10", "10_11"), ("11", "10_11")]:
    grade_data = data[data_key]
    keys_js = ""
    for task in grade_data["tasks"]:
        for q in task["questions"]:
            q_id = f"en_{data_key}_{q['id']}"
            ans = q["answer"].replace('"', '\\"')
            keys_js += f'      "{q_id}": {{ ans: "{ans}", pts: 1 }},\n'
    
    # We find the specific grade block: `  "8": {\n    "russian": {`
    # and insert english before it. But actually inserting it before `logic: {` is safer because we don't know the exact spacing of `"russian"`.
    # Let's find `  "GRADE": {` and then the first `    "logic": {` after it.
    
    # Better yet, search for `    "logic": {` within the grade block.
    # We will use regex to find the grade block and replace the logic key inside it.
    pattern = r'(\s*"' + grade_key + r'":\s*\{.*?)(\s*"logic":\s*\{)'
    replacement = r'\1\n    "english": {\n' + keys_js + r'    },\2'
    code = re.sub(pattern, replacement, code, flags=re.DOTALL | re.MULTILINE)

# 2. Update calculateScores
old_ret = r'return \{ russian: ru, math: ma, logic: lo \};'
new_ret = r'return { russian: ru, math: ma, logic: lo, english: en };'
code = code.replace(old_ret, new_ret)

old_init = r'let ru = 0, ma = 0, lo = 0;'
new_init = r'let ru = 0, ma = 0, lo = 0, en = 0;'
code = code.replace(old_init, new_init)

old_calc = r'    Object.keys\(keys.logic\).forEach\(qId => \{'
new_calc = r'''    if (keys.english) {
      Object.keys(keys.english).forEach(qId => {
        let userAnsStr = answers[qId] ? String(answers[qId]).trim() : "";
        if (qId.startsWith("en_") && keys.english[qId].ans.length > 20) {
          // Likely drag and drop sentence
          try {
            let userArr = JSON.parse(userAnsStr);
            if (Array.isArray(userArr) && userArr.join(" ") === keys.english[qId].ans) {
              en += keys.english[qId].pts;
              return;
            }
          } catch(e) {}
        }
        if (normalizeString(userAnsStr) === normalizeString(keys.english[qId].ans)) en += keys.english[qId].pts;
      });
    }
    Object.keys(keys.logic).forEach(qId => {'''
code = code.replace(old_calc, new_calc)

# 3. Update testSheet appendRow
old_test_header = r'\["Дата", "ФИО Ученика", "Класс", "Русский язык", "Математика", "Логика", "Общий балл", "Уникальный ID теста", "Timestamp", "Читерство", "Short ID", "Ответы ученика \(JSON\)"\]'
new_test_header = r'["Дата", "ФИО Ученика", "Класс", "Русский язык", "Математика", "Логика", "Общий балл", "Уникальный ID теста", "Timestamp", "Читерство", "Short ID", "Ответы ученика (JSON)", "Английский язык"]'
code = code.replace(old_test_header, new_test_header)

old_test_row = r'testSheet\.appendRow\(\[new Date\(ts\)\.toLocaleString\("ru-RU", \{ timeZone: "Asia/Almaty" \}\), finalName, grade, scores\.russian, scores\.math, scores\.logic, totalScore, testId, ts, cheated \? "ДА" : "НЕТ", shortId, answersStr\]\);'
new_test_row = r'testSheet.appendRow([new Date(ts).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }), finalName, grade, scores.russian, scores.math, scores.logic, totalScore, testId, ts, cheated ? "ДА" : "НЕТ", shortId, answersStr, scores.english || 0]);'
code = code.replace(old_test_row, new_test_row)

# 4. Update crmSheet appendRow
old_crm_header = r'\["Дата", "Менеджер", "ФИО Родителя", "Номер телефона", "ID Теста \(ученика\)", "Стадия работы", "Оплата до\.инфо", "Взнос", "Общая стоимость", "Оплата -1-месяц", "К психологу\?", "Вердикт", "Комментарий психолога", "Финальное решение", "Причина отказа", "Имя ребенка", "Русский", "Математика", "Логика", "Комментарий менеджера"\]'
new_crm_header = r'["Дата", "Менеджер", "ФИО Родителя", "Номер телефона", "ID Теста (ученика)", "Стадия работы", "Оплата до.инфо", "Взнос", "Общая стоимость", "Оплата -1-месяц", "К психологу?", "Вердикт", "Комментарий психолога", "Финальное решение", "Причина отказа", "Имя ребенка", "Русский", "Математика", "Логика", "Комментарий менеджера", "Английский"]'
code = code.replace(old_crm_header, new_crm_header)

old_get_test = r'        logic: data\[i\]\[5\]'
new_get_test = r'        logic: data[i][5],\n        english: data[i][12]'
code = code.replace(old_get_test, new_get_test)

old_crm_row = r'    const newRow = \[new Date\(ts\)\.toLocaleString\("ru-RU", \{ timeZone: "Asia/Almaty" \}\), "", "", "", testId, "Новая заявка", "", "", "", "", "НЕТ", "", "", "", "", finalName, scores\.russian, scores\.math, scores\.logic, ""\];'
new_crm_row = r'    const newRow = [new Date(ts).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }), "", "", "", testId, "Новая заявка", "", "", "", "", "НЕТ", "", "", "", "", finalName, scores.russian, scores.math, scores.logic, "", scores.english || 0];'
code = code.replace(old_crm_row, new_crm_row)

with open("scratch/Code.gs", "w", encoding="utf-8") as f:
    f.write(code)

print("Patched Code.gs successfully.")
