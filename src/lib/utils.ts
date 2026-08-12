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
  
  const levels = [
    "Beginner (A1)",
    "Elementary (A2)",
    "Pre-Intermediate (A2-B1)",
    "Intermediate (B1+)",
    "Upper-Intermediate (B2)",
    "Advanced (C1)"
  ];
  
  let targetIndex = 3; // default Grade 9 (Intermediate B1+)
  const gradeNum = Number(grade);
  if (gradeNum === 8) targetIndex = 2; // Pre-Intermediate (A2-B1)
  if (gradeNum >= 10) targetIndex = 4; // Upper-Intermediate (B2)

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
}

export async function fetchGasAPI(url: string, payload: any, token: string = ""): Promise<any> {
  let delay = 2000;
  const MAX_RETRIES = 4;
  let attempt = 0;
  
  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(45000) // 45 second timeout — GAS cold starts can take 30s+
      });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error("Invalid JSON response from server");
      }
      
      if (res.status >= 500) {
        throw new Error(data.error || `Server Error ${res.status}`);
      }
      
      return data;
    } catch (e: any) {
      console.warn(`[GAS] fetch failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms...`, e);
      if (attempt >= MAX_RETRIES) {
        throw new Error("Сервер временно недоступен. Ваши ответы сохранены локально. Попробуйте позже.");
      }
      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(delay * 1.5, 10000); // max 10s delay between retries
    }
  }
  throw new Error("Превышено количество попыток отправки.");
}
