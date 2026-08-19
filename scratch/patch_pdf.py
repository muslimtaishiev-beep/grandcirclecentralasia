with open('src/components/DiagnosticReportPdf.tsx', 'r') as f:
    code = f.read()

import re

# Fix date formatting
date_logic = """
  let formattedDate = "";
  if (date) {
    if (String(date).includes(",")) {
      formattedDate = String(date).split(",")[0];
    } else {
      const d = new Date(date);
      formattedDate = isNaN(d.getTime()) ? String(date) : d.toLocaleDateString('ru-RU');
    }
  } else {
    formattedDate = new Date().toLocaleDateString('ru-RU');
  }
"""

# Insert right after `const { displayName, grade, diagnostics, date } = data;`
insert_idx = code.find('const { displayName, grade, diagnostics, date } = data;')
if insert_idx != -1:
    end_of_line = code.find('\n', insert_idx)
    code = code[:end_of_line] + '\n' + date_logic + code[end_of_line:]

# Replace rendering logic
old_render = "Дата: {date ? new Date(date).toLocaleDateString('ru-RU') : new Date().toLocaleDateString('ru-RU')}"
new_render = "Дата: {formattedDate}"
code = code.replace(old_render, new_render)

# Fix letter spacing issue for html2canvas
code = code.replace('<span>Решено верно: {earned} из {possible}</span>', '<span style={{ letterSpacing: "0px", wordSpacing: "normal" }}>Решено верно: {earned} из {possible}</span>')

with open('src/components/DiagnosticReportPdf.tsx', 'w') as f:
    f.write(code)

print("Patched DiagnosticReportPdf.tsx")
