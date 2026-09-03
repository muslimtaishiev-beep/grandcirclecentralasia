import { hourlyPin } from "../shared/pin";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateShortId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Generates a deterministic 4-digit PIN that changes every hour
/**
 * Accepts the PIN for the current hour and the two either side of it.
 *
 * The PIN rotates on the hour, so a manager reading one out at 10:59 gave a
 * code that stopped working sixty seconds later — the student typed exactly
 * what they were told and was refused. The window also absorbs a device clock
 * that is a few minutes off, which is common on phones and was indistinguishable
 * from the student mistyping.
 */
export function isValidHourlyPIN(entered: string, tenantId = ""): boolean {
  // Keep only the digits. A student reported being refused while typing the
  // correct code: phone keyboards and paste routinely smuggle in characters
  // that look like nothing — a non-breaking space, a zero-width space, an RTL
  // mark — and String.trim() removes none of them. Full-width and Arabic-Indic
  // digits are folded too, since a non-Latin numeric keyboard produces those
  // and they are visually identical to what the manager read out.
  const clean = normalizeDigits(entered);
  if (!clean) return false;
  return [-1, 0, 1].some(offset => clean === getHourlyPIN(offset, tenantId));
}

/** Extracts the digits from user input, folding non-Latin numerals to ASCII. */
export function normalizeDigits(raw: string): string {
  return String(raw || "")
    .replace(/[\u0660-\u0669]/g, c => String(c.charCodeAt(0) - 0x0660))  // ٠-٩
    .replace(/[\u06F0-\u06F9]/g, c => String(c.charCodeAt(0) - 0x06F0))  // ۰-۹
    .replace(/[\uFF10-\uFF19]/g, c => String(c.charCodeAt(0) - 0xFF10))  // ０-９
    .replace(/\D/g, "");
}

/** Часовой PIN — общий расчёт с сервером (см. src/shared/pin.ts). */
export function getHourlyPIN(hourOffset: number = 0, tenantId = ""): string {
  return hourlyPin(tenantId, hourOffset);
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

import { auth } from "./firebase";

export async function fetchGasAPI(url: string, payload: any, token: string = ""): Promise<any> {
  // Повторы и таймаут рассчитаны на 500 одновременных учеников.
  //
  // Было: 4 попытки по 50 секунд — до 3,5 минут ожидания, и, что хуже,
  // таймаут считался поводом повторить. Когда в конце экзамена все сдают
  // разом, сервер отвечает медленно, каждый клиент шлёт запрос ещё трижды,
  // сервер отвечает ещё медленнее — лавина, из которой нет выхода.
  //
  // Стало: 2 попытки по 20 секунд; таймаут НЕ повторяем (сервер занят —
  // добивать нельзя); задержка со случайным разбросом, чтобы клиенты не
  // возвращались одной волной.
  let delay = 1500;
  const MAX_RETRIES = 2;
  const TIMEOUT_MS = 20000;
  let attempt = 0;

  // ⚠️ SECURITY: API key is NEVER sent from the client.
  // The server proxy (server.ts /api/gas) injects GAS_API_KEY from process.env.
  const fullPayload = { ...payload };

  // If token is missing, attempt to grab it directly from Firebase Auth
  if (!token && auth.currentUser) {
    try {
      token = await auth.currentUser.getIdToken();
    } catch (e) {
      console.warn("fetchGasAPI: Could not fetch Firebase ID token", e);
    }
  }

  while (attempt < MAX_RETRIES) {
    attempt++;

    try {
      const headers: Record<string, string> = { "Content-Type": "text/plain;charset=utf-8" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(fullPayload),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error("Неверный формат ответа от сервера");
      }
      
      // Only retry on 503 (temporary unavailable)
      if (res.status === 503 || (data && data.success === false && String(data.error || "").includes("временно"))) {
        throw new Error(data?.error || `Сервер временно занят (${res.status})`);
      }
      
      // For any other status (200, 400, 401, etc.) return immediately — don't retry
      return data;
    } catch (e: any) {
      // AbortError (таймаут) больше НЕ повторяем: он означает, что сервер не
      // успел ответить, и ещё три таких же запроса только усугубят затор.
      // Повторяем лишь обрыв сети (TypeError) и явное «сервер временно занят».
      const isRetryable = e.name === 'TypeError' || String(e.message || "").includes("временно");
      
      if (!isRetryable || attempt >= MAX_RETRIES) {
        console.error(`[GAS] fetch failed permanently (attempt ${attempt}/${MAX_RETRIES}):`, e.message);
        throw new Error(e.message || "Сервер временно недоступен. Попробуйте еще раз.");
      }
      
      console.warn(`[GAS] fetch failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms...`, e.message);
      // Случайный разброс ±40%: без него все клиенты возвращаются
      // одновременно и снова кладут сервер той же волной.
      const jitter = delay * (0.6 + Math.random() * 0.8);
      await new Promise(r => setTimeout(r, jitter));
      delay = Math.min(delay * 1.5, 5000);
    }
  }
  throw new Error("Превышено количество попыток отправки.");
}

export function toDativeCase(fullName: string): string {
  if (!fullName || !fullName.trim()) return "";
  const parts = fullName.trim().split(/\s+/);

  const declinedParts = parts.map((word, idx) => {
    const w = word.trim();
    if (!w) return "";

    // 1. Surname (usually first part, or ends in typical surname suffixes)
    if (idx === 0 || /ов$|ев$|ин$|ын$|ова$|ева$|ина$|ына$/i.test(w)) {
      if (/ова$/i.test(w)) return w.replace(/ова$/i, "овой");
      if (/ева$/i.test(w)) return w.replace(/ева$/i, "евой");
      if (/ина$/i.test(w)) return w.replace(/ина$/i, "иной");
      if (/ына$/i.test(w)) return w.replace(/ына$/i, "ыной");

      if (/ов$/i.test(w)) return w + "у";
      if (/ев$/i.test(w)) return w + "у";
      if (/ин$/i.test(w)) return w + "у";
      if (/ын$/i.test(w)) return w + "у";
      if (/ский$/i.test(w)) return w.replace(/ский$/i, "скому");
      if (/ская$/i.test(w)) return w.replace(/ская$/i, "ской");
    }

    // 2. Patronymic (Ends in -вич, -вна)
    if (/вич$/i.test(w)) return w + "у";
    if (/вна$/i.test(w)) return w.replace(/вна$/i, "вне");

    // 3. First names or middle names
    if (/ия$/i.test(w)) return w.replace(/я$/i, "и"); // Мария -> Марии
    if (/а$/i.test(w)) return w.replace(/а$/i, "е"); // Анна -> Анне, Никита -> Никите
    if (/я$/i.test(w)) return w.replace(/я$/i, "е"); // Илья -> Илье, Наталья -> Наталье
    if (/й$/i.test(w)) return w.replace(/й$/i, "ю"); // Алексей -> Алексею
    if (/ь$/i.test(w)) return w.replace(/ь$/i, "ю"); // Игорь -> Игорю

    // Male first names ending in consonant (e.g. Бакыт -> Бакыту, Иван -> Ивану)
    if (/[бвгджзклмнпрстфхцчшщ]$/i.test(w)) {
      return w + "у";
    }

    return w;
  });

  return declinedParts.filter(Boolean).join(" ");
}

export function toGenitiveCase(fullName: string): string {
  return toDativeCase(fullName);
}
