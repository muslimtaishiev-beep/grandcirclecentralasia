import re

with open("scratch/Code.js", "r") as f:
    code = f.read()

helper = """
function safeSetValue(sheet, row, col, value) {
  if (sheet.getMaxColumns() < col) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), col - sheet.getMaxColumns());
  }
  sheet.getRange(row, col).setValue(value);
}
"""

if "function safeSetValue" not in code:
    code = code.replace("function doPost(e) {", helper + "\nfunction doPost(e) {")

with open("scratch/Code.js", "w") as f:
    f.write(code)
with open("scratch/Code.gs", "w") as f:
    f.write(code)
with open("scratch/update_code_gs_4.js", "w") as f:
    f.write(code)
