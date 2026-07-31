with open("src/pages/ManagerDashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add getCEFRLevel import
content = content.replace(
    'import { getHourlyPIN } from "../lib/utils";',
    'import { getHourlyPIN, getCEFRLevel } from "../lib/utils";'
)

# Replace the specific score rendering string in the table
old_str = 'Р:{s.ru}/{getMaxScore(s.grade, "russian")} М:{s.ma}/{getMaxScore(s.grade, "math")} Л:{s.lo}/{getMaxScore(s.grade, "logic")} А:{s.en}/{getMaxScore(s.grade, "english")}'
new_str = '{(() => { const maxEn = getMaxScore(s.grade, "english"); let enStr = `А:${s.en}/${maxEn}`; if (s.en !== undefined && s.en !== "" && maxEn !== "?") { const cefr = getCEFRLevel(parseInt(s.grade, 10), parseInt(maxEn as string, 10), parseInt(s.en, 10)); if(cefr) enStr = `Английский: ${cefr.actualLevel} (${cefr.percent}%) ${cefr.icon}`; } return `Р:${s.ru}/${getMaxScore(s.grade, "russian")} М:{s.ma}/${getMaxScore(s.grade, "math")} Л:{s.lo}/${getMaxScore(s.grade, "logic")} | ${enStr}`; })()}'

content = content.replace(old_str, new_str)

with open("src/pages/ManagerDashboard.tsx", "w", encoding="utf-8") as f:
    f.write(content)
