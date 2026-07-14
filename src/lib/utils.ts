import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generates a deterministic 4-digit PIN that changes every hour
export function getHourlyPIN(): string {
  const d = new Date();
  const seed = d.getFullYear() * 1000000 + (d.getMonth() + 1) * 10000 + d.getDate() * 100 + d.getHours();
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
