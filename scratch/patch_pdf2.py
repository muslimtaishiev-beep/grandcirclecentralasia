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

# Insert right after `const displayName = childName || studentName || "Без имени";`
insert_idx = code.find('const displayName = childName || studentName || "Без имени";')
if insert_idx != -1:
    end_of_line = code.find('\n', insert_idx)
    code = code[:end_of_line] + '\n' + date_logic + code[end_of_line:]
else:
    print("Could not find insertion point!")

with open('src/components/DiagnosticReportPdf.tsx', 'w') as f:
    f.write(code)
