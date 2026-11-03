import type { ClickableSegment, InlineSegment } from "../../../shared/exams";

/**
 * Текстовая разметка для двух типов, которые неудобно собирать по кусочкам.
 *
 * Пропуски в тексте: ответ в двойных квадратных скобках —
 *   «Неслыха[[нн]]ая дерзость. Задача реше[[н]]а.»
 * Расставить знаки: место для запятой — [*] (нужна) или [ ] (не нужна) —
 *   «Ветер [*] дующий [ ] с моря [*] принёс прохладу.»
 */

export function inlineToMarkup(segments: InlineSegment[] = [], answer = ""): string {
  const parts = answer.split("||")[0].split(/\s*,\s*/);
  let i = 0;
  return segments.map(s => (s.type === "text" ? s.text : `[[${parts[i++] ?? ""}]]`)).join("");
}

export function markupToInline(markup: string): { segments: InlineSegment[]; answer: string } {
  const segments: InlineSegment[] = [];
  const answers: string[] = [];
  const re = /\[\[([^\]]*)\]\]/g;
  let last = 0; let m: RegExpExecArray | null; let n = 0;
  while ((m = re.exec(markup))) {
    if (m.index > last) segments.push({ type: "text", text: markup.slice(last, m.index) });
    segments.push({ type: "input", id: `input${++n}` });
    answers.push(m[1].trim());
    last = m.index + m[0].length;
  }
  if (last < markup.length) segments.push({ type: "text", text: markup.slice(last) });
  return { segments, answer: answers.join(", ") };
}

export function clickableToMarkup(segments: ClickableSegment[] = []): string {
  return segments.map(s => (s.id ? (s.isTarget ? " [*] " : " [ ] ") : s.text)).join("").replace(/ {2,}/g, " ").trim();
}

export function markupToClickable(markup: string): ClickableSegment[] {
  const out: ClickableSegment[] = [];
  const re = /\s*\[( |\*)\]\s*/g;
  let last = 0; let m: RegExpExecArray | null; let n = 0;
  while ((m = re.exec(markup))) {
    const text = markup.slice(last, m.index).trim();
    if (text) out.push({ text });
    out.push({ text: " [,] ", id: String(++n), isTarget: m[1] === "*" });
    last = m.index + m[0].length;
  }
  const tail = markup.slice(last).trim();
  if (tail) out.push({ text: tail });
  return out;
}

/** Перемешать так, чтобы порядок точно отличался от правильного. */
export function shuffled<T>(items: T[]): T[] {
  if (items.length < 2) return [...items];
  for (let tries = 0; tries < 10; tries++) {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    if (a.some((x, i) => x !== items[i])) return a;
  }
  return [...items.slice(1), items[0]];
}
