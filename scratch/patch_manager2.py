import re

with open("src/pages/ManagerDashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix the string interpolation and NaN logic in the table cell
old_str = 'return `Р:${s.ru}/${getMaxScore(s.grade, "russian")} М:{s.ma}/${getMaxScore(s.grade, "math")} Л:{s.lo}/${getMaxScore(s.grade, "logic")} | ${enStr}`;'
new_str = 'return `Р:${s.ru || 0}/${getMaxScore(s.grade, "russian")} М:${s.ma || 0}/${getMaxScore(s.grade, "math")} Л:${s.lo || 0}/${getMaxScore(s.grade, "logic")} | ${enStr}`;'
content = content.replace(old_str, new_str)

# Fix the enStr undefined/null issue
old_enStr = 'let enStr = `А:${s.en}/${maxEn}`; if (s.en !== undefined && s.en !== "" && maxEn !== "?") {'
new_enStr = 'let enStr = `А:${s.en || 0}/${maxEn}`; if (s.en !== undefined && s.en !== null && s.en !== "" && maxEn !== "?") {'
content = content.replace(old_enStr, new_enStr)

with open("src/pages/ManagerDashboard.tsx", "w", encoding="utf-8") as f:
    f.write(content)
