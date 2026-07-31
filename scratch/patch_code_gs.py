import re

with open("scratch/Code.gs", "r", encoding="utf-8") as f:
    content = f.read()

# Fix 1: English test missing -> return "" instead of 0
# The calculateScores function calculates english score based on enKeys
# We can just change `let english = 0;` to `let english = "";` if no english answers are passed.
# Actually, if `answers` has NO english keys, `english` remains empty string!
# Let's see calculateScores:
#   let scores = { russian: 0, math: 0, logic: 0, english: 0 };
# We can change it to: let scores = { russian: 0, math: 0, logic: 0, english: "" };
content = content.replace(
    'let scores = { russian: 0, math: 0, logic: 0, english: 0 };',
    'let scores = { russian: 0, math: 0, logic: 0, english: "" };'
)

# Fix 2: Strict equality bugs
# In submitTest
content = content.replace(
    'if (dataRange[i][7] === testId || dataRange[i][10] === shortId)',
    'if (String(dataRange[i][7]) === String(testId) || String(dataRange[i][10]) === String(shortId))'
)

# In submitEnglishTest
content = content.replace(
    'if (testData[i][10] === shortId)',
    'if (String(testData[i][10]) === String(shortId))'
)

content = content.replace(
    'if (crmData[i][4] === shortId)',
    'if (String(crmData[i][4]) === String(shortId))'
)

# Write back
with open("scratch/Code.gs", "w", encoding="utf-8") as f:
    f.write(content)
print("Code.gs patched successfully")
