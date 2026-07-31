with open("src/lib/utils.ts", "r", encoding="utf-8") as f:
    content = f.read()

import re

old_cefr = re.search(r'export function getCEFRLevel.*?return \{ percent, actualLevel, icon, targetLevel \};\n\}', content, re.DOTALL)
if old_cefr:
    old_cefr_text = old_cefr.group(0)
else:
    print("Could not find getCEFRLevel")
    exit(1)

new_cefr_text = """export function getCEFRLevel(grade: number, maxPoints: number, score: number) {
  if (maxPoints === 0) return null;
  const percent = Math.round((score / maxPoints) * 100);
  
  const levels = [
    "Beginner (A1)",
    "Elementary (A2)",
    "Pre-Intermediate (A2-B1)",
    "Intermediate (B1+)",
    "Upper-Intermediate (B2)",
    "Advanced (C1)"
  ];
  
  let targetIndex = 3; // default Grade 9 (Intermediate B1+)
  if (grade === 8) targetIndex = 2; // Pre-Intermediate (A2-B1)
  if (grade >= 10) targetIndex = 4; // Upper-Intermediate (B2)

  let actualIndex = targetIndex;
  let icon = "✅";
  
  if (percent < 40) {
    actualIndex = Math.max(0, targetIndex - 2);
    icon = "❌";
  } else if (percent <= 59) {
    actualIndex = Math.max(0, targetIndex - 1);
    icon = "❓";
  } else if (percent <= 85) {
    actualIndex = targetIndex;
    icon = "✅";
  } else {
    actualIndex = Math.min(levels.length - 1, targetIndex + 1);
    icon = "✅";
  }

  return { 
    percent, 
    actualLevel: levels[actualIndex], 
    icon, 
    targetLevel: levels[targetIndex] 
  };
}"""

content = content.replace(old_cefr_text, new_cefr_text)

with open("src/lib/utils.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("Success")
