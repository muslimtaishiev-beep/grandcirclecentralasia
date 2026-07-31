import re

with open("scratch/Code.js", "r") as f:
    code = f.read()

# Add safeSetValue helper
helper = """
function safeSetValue(sheet, row, col, value) {
  if (sheet.getMaxColumns() < col) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), col - sheet.getMaxColumns());
  }
  sheet.getRange(row, col).setValue(value);
}
"""

if "function safeSetValue" not in code:
    code = code.replace("function submitTest", helper + "\nfunction submitTest")

# Replace testSheet.getRange(testRowIdx, 13).setValue
code = re.sub(r'testSheet\.getRange\(testRowIdx, 13\)\.setValue\((.*?)\);', r'safeSetValue(testSheet, testRowIdx, 13, \1);', code)

# Replace crmSheet.getRange(i \+ 1, 21).setValue
code = re.sub(r'crmSheet\.getRange\(i \+ 1, 21\)\.setValue\((.*?)\);', r'safeSetValue(crmSheet, i + 1, 21, \1);', code)

with open("scratch/Code.js", "w") as f:
    f.write(code)
with open("scratch/Code.gs", "w") as f:
    f.write(code)
