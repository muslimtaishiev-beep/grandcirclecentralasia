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
