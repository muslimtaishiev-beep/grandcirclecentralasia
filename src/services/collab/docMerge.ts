import type { DocBlock } from '../../types/collab';

const same = (a: DocBlock | undefined, b: DocBlock | undefined) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Трёхстороннее слияние блоков документа.
 *
 * base — что было на сервере, когда мы начали править; local — наша версия;
 * server — что на сервере сейчас (с правками коллег). Блок, который мы
 * изменили, берётся наш; не тронутый нами — серверный. Наши удаления
 * применяются, только если коллега блок не правил. Наши новые блоки встают
 * после ближайшего предшествующего им блока, новые блоки коллег сохраняются.
 */
export function mergeBlocks(base: DocBlock[], local: DocBlock[], server: DocBlock[]): DocBlock[] {
  const B = new Map(base.map(b => [b.id, b]));
  const L = new Map(local.map(b => [b.id, b]));
  const S = new Map(server.map(b => [b.id, b]));

  const out: DocBlock[] = [];
  for (const s of server) {
    const l = L.get(s.id);
    const b = B.get(s.id);
    if (l) {
      out.push(b && same(l, b) ? s : l);
    } else if (b) {
      // Мы удалили блок: если коллега его менял — оставляем его версию.
      if (!same(s, b)) out.push(s);
    } else {
      out.push(s); // новый блок коллеги
    }
  }

  // Наши новые блоки и блоки, которые мы правили, а коллега удалил.
  for (let i = 0; i < local.length; i++) {
    const l = local[i];
    if (S.has(l.id)) continue;
    const b = B.get(l.id);
    if (b && same(l, b)) continue; // коллега удалил, мы не трогали — удалено
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = out.findIndex(x => x.id === local[j].id);
      if (k !== -1) { at = k + 1; break; }
    }
    out.splice(at, 0, l);
  }
  return out;
}
