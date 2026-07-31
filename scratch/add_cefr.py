with open("src/lib/utils.ts", "r", encoding="utf-8") as f:
    content = f.read()

cefr_code = """
export function getCEFRLevel(grade: number, maxPoints: number, score: number) {
  if (maxPoints === 0) return null;
  const percent = Math.round((score / maxPoints) * 100);
  
  let targetLevel = "Intermediate (B1+)";
  let targetCode = "B1+";
  if (grade === 8) { targetLevel = "Pre-Intermediate (A2-B1)"; targetCode = "A2-B1"; }
  if (grade >= 10) { targetLevel = "Upper-Intermediate (B2)"; targetCode = "B2"; }

  let actualLevel = "";
  let icon = "✅"; // Default matching
  
  if (percent <= 30) {
    actualLevel = "Beginner (A1)";
    icon = "❌";
  } else if (percent <= 55) {
    actualLevel = "Elementary (A2)";
    icon = "❓";
  } else if (percent <= 85) {
    actualLevel = targetLevel;
    icon = "✅";
  } else {
    // If they score >85%, they are above the target
    if (grade === 8) { actualLevel = "Intermediate (B1+)"; icon = "✅"; }
    else if (grade === 9) { actualLevel = "Upper-Intermediate (B2)"; icon = "✅"; }
    else { actualLevel = "Advanced (C1)"; icon = "✅"; }
  }

  // Edge case: if test is easy but they get 31-55, it might be same as actualLevel if target is A2 (but no target is A2).
  return { percent, actualLevel, icon, targetLevel };
}
"""

if "getCEFRLevel" not in content:
    with open("src/lib/utils.ts", "a", encoding="utf-8") as f:
        f.write("\n" + cefr_code)
