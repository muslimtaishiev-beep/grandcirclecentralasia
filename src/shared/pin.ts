/**
 * Часовой PIN аудитории — один расчёт для клиента, экзамена и среза.
 *
 * Код меняется каждый час и свой у каждой организации. Соль организации
 * подмешивается XOR-ом, а не сложением: при сложении сид «соседнего часа»
 * одной организации совпадал с сидом другой, чей id отличается на один
 * символ, — и окно ±1 час принимало чужой код.
 */
export function hourlyPin(tenantId: string, hourOffset = 0, now: Date = new Date()): string {
  const d = new Date(now.getTime());
  d.setUTCHours(d.getUTCHours() + hourOffset);
  const seed = d.getUTCFullYear() * 1000000 + (d.getUTCMonth() + 1) * 10000 + d.getUTCDate() * 100 + d.getUTCHours();
  let h = 0;
  for (const ch of String(tenantId || "")) h = ((h * 31) + ch.charCodeAt(0)) >>> 0;
  const base = Math.floor((seed * 1103515245 + 12345) % 2147483647);
  const mixed = Math.abs(base ^ h);
  return (mixed % 9000 + 1000).toString();
}

/** Введённый код против текущего часа и соседних (сдвиг часов у телефона). */
export function pinMatches(entered: string, tenantId: string): boolean {
  const clean = String(entered || "").replace(/\D/g, "");
  if (!clean) return false;
  return [-1, 0, 1].some(o => clean === hourlyPin(tenantId, o));
}
