import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generates a deterministic 4-digit PIN that changes every hour
export function getHourlyPIN(hourOffset: number = 0): string {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() + hourOffset);
  const seed = d.getUTCFullYear() * 1000000 + (d.getUTCMonth() + 1) * 10000 + d.getUTCDate() * 100 + d.getUTCHours();
  const pin = (seed * 1103515245 + 12345) % 9000 + 1000;
  return Math.abs(pin).toString();
}
// Converts numbers to superscripts
function toSuperscript(numStr) {
  const map = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻'
  };
  return numStr.split('').map(c => map[c] || c).join('');
}

// Formats raw pseudo-latex into human-readable unicode
export function formatMathText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\\le/g, "≤")
    .replace(/\\ge/g, "≥")
    .replace(/\\pm/g, "±")
    .replace(/\\pi/g, "π")
    .replace(/\\in/g, "∈")
    .replace(/\\infty/g, "∞")
    .replace(/\\sqrt\[3\]\{x\}/g, "³√x")
    .replace(/\\sqrt\{3\}/g, "√3")
    .replace(/\\cos/g, "cos")
    .replace(/\\sin/g, "sin")
    .replace(/\\log_3/g, "log₃")
    .replace(/\\text\\{arcctg\\}/g, "arcctg")
    .replace(/x_1/g, "x₁")
    .replace(/x_2/g, "x₂")
    .replace(/\\^([-0-9]+)/g, (match, p1) => toSuperscript(p1))
    .replace(/\\alpha/g, "α");
}


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
