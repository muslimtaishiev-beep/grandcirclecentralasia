/**
 * «Тот же ребёнок» — одно правило для приёма и экзаменов: создание карточки,
 * вход на тест, привязка работы, подсказка дублей.
 *
 * ФИО сравнивается по словам, без учёта порядка, регистра, «ё» и отчества:
 * «Русланбеков Бакдоолот» и «Бакдоолот Русланбеков Русланбекович» — одно
 * имя (все слова короткого есть в длинном, общих — не меньше двух).
 * Подтверждение — дата рождения или телефон (ученика или родителя, по
 * последним 9 цифрам). Разные даты рождения — точно разные дети.
 */

export interface ChildProbe {
  name?: string | null;
  birthDate?: string | null;
  /** Любые телефоны семьи: ученика, родителя. */
  phones?: (string | null | undefined)[];
}

export const nameTokens = (v: unknown): string[] =>
  String(v || "").toLowerCase().replace(/ё/g, "е").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
/** Ключ точного совпадения ФИО (слова по алфавиту). */
export const nameKey = (v: unknown): string => nameTokens(v).sort().join(" ");
export const phoneKey = (v: unknown): string => { const d = String(v || "").replace(/\D/g, ""); return d.length >= 7 ? d.slice(-9) : ""; };

/** Имена совместимы: одно — часть другого (отчество может отсутствовать), общих слов — от двух. */
export function namesCompatible(a: unknown, b: unknown): boolean {
  const x = nameTokens(a), y = nameTokens(b);
  if (x.length < 2 || y.length < 2) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  const pool = [...long];
  for (const w of short) { const i = pool.indexOf(w); if (i < 0) return false; pool.splice(i, 1); }
  return true;
}

const isDate = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

/**
 * same — имя совместимо и подтверждено датой рождения или телефоном;
 * maybe — имя совместимо, подтверждений нет, но и противоречий нет;
 * no — другое имя или разные даты рождения.
 */
export function matchChild(a: ChildProbe, b: ChildProbe): "same" | "maybe" | "no" {
  if (!namesCompatible(a.name, b.name)) return "no";
  const bothBirth = isDate(a.birthDate) && isDate(b.birthDate);
  if (bothBirth && a.birthDate !== b.birthDate) return "no";
  if (bothBirth) return "same";
  const pa = new Set((a.phones || []).map(phoneKey).filter(Boolean));
  if ((b.phones || []).map(phoneKey).some(p => p && pa.has(p))) return "same";
  return "maybe";
}

/** Карточка поступающего → то, что сравнивается. */
export const probeOf = (a: { child?: { name?: string; birthDate?: string; phone?: string } | null; parent?: { phone?: string } | null }): ChildProbe =>
  ({ name: a.child?.name, birthDate: a.child?.birthDate, phones: [a.child?.phone, a.parent?.phone] });

/**
 * Найти карточку этого ребёнка среди карточек. Подтверждённая (same) одна —
 * она; иначе единственная возможная (maybe) — она; несколько — неясно.
 */
export function findChild<T>(cards: T[], probe: ChildProbe, toProbe: (c: T) => ChildProbe): { found?: T; strong?: boolean; ambiguous?: number } {
  const same: T[] = []; const maybe: T[] = [];
  for (const c of cards) { const m = matchChild(probe, toProbe(c)); if (m === "same") same.push(c); else if (m === "maybe") maybe.push(c); }
  if (same.length === 1) return { found: same[0], strong: true };
  if (same.length > 1) return { ambiguous: same.length };
  if (maybe.length === 1) return { found: maybe[0], strong: false };
  if (maybe.length > 1) return { ambiguous: maybe.length };
  return {};
}
