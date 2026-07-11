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
    .replace(/\\text\{arcctg\}/g, "arcctg")
    .replace(/x_1/g, "x₁")
    .replace(/x_2/g, "x₂")
    .replace(/\^2/g, "²")
    .replace(/\^3/g, "³")
    .replace(/\^5/g, "⁵")
    .replace(/\^6/g, "⁶")
    .replace(/\\alpha/g, "α");
}
