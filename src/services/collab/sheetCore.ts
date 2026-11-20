import type { SheetCellData } from '../../types/collab';

/* ─────────── Адреса: A, B … Z, AA, AB … ─────────── */

/** Предел колонок таблицы: до ZZ. */
export const MAX_COLUMNS = 702;
export const MAX_ROWS = 5000;

/** «A» → 0, «Z» → 25, «AA» → 26. */
export function colToIndex(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** 0 → «A», 26 → «AA». */
export function indexToCol(i: number): string {
  let n = i;
  let s = '';
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

export interface CellAddr { col: number; row: number }

/** «AB12» → {col: 27, row: 12}; не адрес — null. */
export function parseCell(id: string): CellAddr | null {
  const m = /^([A-Z]{1,3})(\d+)$/.exec(id);
  if (!m) return null;
  const row = Number(m[2]);
  return row >= 1 ? { col: colToIndex(m[1]), row } : null;
}

export const cellId = (col: number, row: number) => `${indexToCol(col)}${row}`;

/* ─────────── Вычисление формул ─────────── */

class FormulaError extends Error {}
const err = (code: string): never => { throw new FormulaError(code); };

type Val = number | string;
const isFormula = (raw: string) => raw.startsWith('=');

function asNumber(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (t === '' || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const fmt = (n: number): string => {
  if (!Number.isFinite(n)) return '#ERROR!';
  return String(Number(n.toPrecision(12)));
};

type Tok =
  | { t: 'num'; v: number }
  | { t: 'ref'; v: string }
  | { t: 'range'; a: string; b: string }
  | { t: 'fn'; v: string }
  | { t: 'op'; v: string }
  | { t: 'err'; v: string };

const REF = '\\$?[A-Z]{1,3}\\$?\\d+';

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  const re = new RegExp(`\\s*(?:(#REF!)|(${REF}):(${REF})|(${REF})(?![A-Z0-9(])|([A-Z][A-Z0-9.]*)(?=\\()|(\\d+\\.?\\d*(?:E[-+]?\\d+)?|\\.\\d+)|([-+*/^%(),;]))`, 'gy');
  let pos = 0;
  while (pos < src.length) {
    if (/\s/.test(src[pos])) { pos++; continue; }
    re.lastIndex = pos;
    const m = re.exec(src);
    if (!m) err('#ERROR!');
    pos = re.lastIndex;
    const g = m!;
    if (g[1]) out.push({ t: 'err', v: '#REF!' });
    else if (g[2]) out.push({ t: 'range', a: g[2].replace(/\$/g, ''), b: g[3].replace(/\$/g, '') });
    else if (g[4]) out.push({ t: 'ref', v: g[4].replace(/\$/g, '') });
    else if (g[5]) out.push({ t: 'fn', v: g[5] });
    else if (g[6]) out.push({ t: 'num', v: Number(g[6]) });
    else out.push({ t: 'op', v: g[7] });
  }
  return out;
}

/**
 * Значения всех ячеек таблицы: формулы считаются, зависимости разворачиваются
 * рекурсивно, циклы дают #CYCLE!. Возвращается только вычисленное для формул
 * (остальные ячейки — как введены).
 */
export function computeSheet(cells: Record<string, { rawValue?: string }>): Record<string, string> {
  const memo = new Map<string, Val>();
  const visiting = new Set<string>();

  const cellValue = (id: string): Val => {
    if (memo.has(id)) return memo.get(id)!;
    const raw = cells[id]?.rawValue ?? '';
    let v: Val;
    if (isFormula(raw)) {
      if (visiting.has(id)) err('#CYCLE!');
      visiting.add(id);
      try { v = evalFormula(raw.slice(1)); }
      catch (e) { v = e instanceof FormulaError ? e.message : '#ERROR!'; }
      finally { visiting.delete(id); }
    } else {
      const n = asNumber(raw);
      v = n !== null ? n : raw;
    }
    memo.set(id, v);
    return v;
  };

  /** Значение ячейки как число в арифметике: пусто — 0, текст — #VALUE!, ошибка — пробрасывается. */
  const num = (id: string): number => {
    const v = cellValue(id);
    if (typeof v === 'number') return v;
    if (v === '') return 0;
    if (v.startsWith('#')) err(v);
    return err('#VALUE!');
  };

  const rangeCells = (a: string, b: string): string[] => {
    const A = parseCell(a); const B = parseCell(b);
    if (!A || !B) return err('#REF!');
    const ids: string[] = [];
    for (let c = Math.min(A.col, B.col); c <= Math.max(A.col, B.col); c++)
      for (let r = Math.min(A.row, B.row); r <= Math.max(A.row, B.row); r++) ids.push(cellId(c, r));
    if (ids.length > 100000) err('#ERROR!');
    return ids;
  };

  const evalFormula = (body: string): Val => {
    const toks = tokenize(body.toUpperCase());
    let i = 0;
    const peek = () => toks[i];
    const eatOp = (v: string) => { const t = toks[i]; if (t && t.t === 'op' && t.v === v) { i++; return true; } return false; };

    // Аргумент функции: диапазон/ссылка/выражение → список чисел для агрегатов.
    const args = (): { nums: number[] } => {
      const nums: number[] = []; // числа из диапазонов и выражений
      if (eatOp(')')) return { nums };
      for (;;) {
        const t = peek();
        const next = toks[i + 1];
        const endsArg = !next || (next.t === 'op' && (next.v === ',' || next.v === ';' || next.v === ')'));
        if (t && t.t === 'range' && endsArg) {
          i++;
          for (const id of rangeCells(t.a, t.b)) {
            const v = cellValue(id);
            if (typeof v === 'number') nums.push(v);
            else if (v.startsWith('#')) err(v);
          }
        } else if (t && t.t === 'ref' && endsArg) {
          i++;
          const v = cellValue(t.v);
          if (typeof v === 'number') nums.push(v);
          else if (v.startsWith('#')) err(v);
        } else nums.push(expr());
        if (eatOp(',') || eatOp(';')) continue;
        if (eatOp(')')) break;
        err('#ERROR!');
      }
      return { nums };
    };

    const call = (name: string): number => {
      const { nums } = args();
      switch (name) {
        case 'SUM': return nums.reduce((a, b) => a + b, 0);
        case 'AVERAGE': return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : err('#DIV/0!');
        case 'COUNT': return nums.length;
        case 'MAX': return nums.length ? Math.max(...nums) : 0;
        case 'MIN': return nums.length ? Math.min(...nums) : 0;
        case 'ABS': return Math.abs(nums[0] ?? err('#ERROR!'));
        case 'ROUND': { const k = 10 ** (nums[1] ?? 0); return Math.round((nums[0] ?? err('#ERROR!')) * k) / k; }
        default: return err('#NAME?');
      }
    };

    const primary = (): number => {
      const t = toks[i++];
      if (!t) return err('#ERROR!');
      if (t.t === 'num') return t.v;
      if (t.t === 'err') return err(t.v);
      if (t.t === 'ref') return num(t.v);
      if (t.t === 'range') return err('#VALUE!');
      if (t.t === 'fn') { if (!eatOp('(')) err('#ERROR!'); return call(t.v); }
      if (t.v === '(') { const v = expr(); if (!eatOp(')')) err('#ERROR!'); return v; }
      return err('#ERROR!');
    };
    const unary = (): number => {
      if (eatOp('-')) return -unary();
      if (eatOp('+')) return unary();
      let v = primary();
      while (eatOp('%')) v /= 100;
      return v;
    };
    const power = (): number => { const b = unary(); return eatOp('^') ? b ** power() : b; };
    const term = (): number => {
      let v = power();
      for (;;) {
        if (eatOp('*')) v *= power();
        else if (eatOp('/')) { const d = power(); if (d === 0) err('#DIV/0!'); v /= d; }
        else return v;
      }
    };
    const expr = (): number => {
      let v = term();
      for (;;) {
        if (eatOp('+')) v += term();
        else if (eatOp('-')) v -= term();
        else return v;
      }
    };

    if (!toks.length) return err('#ERROR!');
    const r = expr();
    if (i < toks.length) err('#ERROR!');
    return Number.isFinite(r) ? r : err('#ERROR!');
  };

  const out: Record<string, string> = {};
  for (const [id, c] of Object.entries(cells)) {
    const raw = c?.rawValue ?? '';
    if (!isFormula(raw)) { out[id] = raw; continue; }
    let v: Val;
    try { v = cellValue(id); } catch (e) { v = e instanceof FormulaError ? e.message : '#ERROR!'; }
    out[id] = typeof v === 'number' ? fmt(v) : String(v);
  }
  return out;
}

/** Совместимость: вычислить одну формулу на наборе ячеек. */
export class SheetFormulaEngine {
  private cells: Record<string, SheetCellData> = {};
  setCells(cells: Record<string, SheetCellData>) { this.cells = cells; }
  evaluate(cellId: string, rawValue: string): string {
    if (!isFormula(rawValue)) return rawValue;
    return computeSheet({ ...this.cells, [cellId]: { rawValue } })[cellId] ?? '';
  }
}

/* ─────────── Сдвиг при вставке и удалении строк и колонок ─────────── */

export type Axis = 'row' | 'col';

/**
 * Куда уедет индекс (строки с 1 или колонки с 0) при вставке (delta=+1) или
 * удалении (delta=-1) на позиции `at`. null — позиция удалена.
 */
export function shiftIndex(i: number, at: number, delta: 1 | -1): number | null {
  if (delta === 1) return i >= at ? i + 1 : i;
  if (i === at) return null;
  return i > at ? i - 1 : i;
}

/** Переписать ссылки формулы после сдвига; удалённые превращаются в #REF!. */
export function shiftFormula(raw: string, axis: Axis, at: number, delta: 1 | -1): string {
  if (!isFormula(raw)) return raw;
  const one = (m: string): { col: number; row: number; ac: string; ar: string } | null => {
    const g = /^(\$?)([A-Z]{1,3})(\$?)(\d+)$/.exec(m);
    return g ? { ac: g[1], col: colToIndex(g[2]), ar: g[3], row: Number(g[4]) } : null;
  };
  const pos = (p: { col: number; row: number }) => (axis === 'row' ? p.row : p.col);
  const put = (p: { col: number; row: number; ac: string; ar: string }, v: number) =>
    axis === 'row' ? `${p.ac}${indexToCol(p.col)}${p.ar}${v}` : `${p.ac}${indexToCol(v)}${p.ar}${p.row}`;

  const re = new RegExp(`(?<![A-Z0-9_.])(${REF})(?::(${REF}))?(?![A-Z0-9(])`, 'g');
  return raw.replace(re, (_m, a: string, b?: string) => {
    const A = one(a)!;
    if (!b) {
      const s = shiftIndex(pos(A), at, delta);
      return s === null ? '#REF!' : put(A, s);
    }
    const B = one(b)!;
    // Диапазон: границы подтягиваются внутрь, исчезает только если удалена вся.
    let lo = pos(A), hi = pos(B);
    const swapped = lo > hi;
    if (swapped) [lo, hi] = [hi, lo];
    let nl: number | null; let nh: number | null;
    if (delta === 1) { nl = shiftIndex(lo, at, 1); nh = shiftIndex(hi, at, 1); }
    else if (lo === at && hi === at) return '#REF!';
    else { nl = lo === at ? at : shiftIndex(lo, at, -1); nh = hi === at ? at - 1 : shiftIndex(hi, at, -1); }
    if (nl === null || nh === null) return '#REF!';
    const [x, y] = swapped ? [nh, nl] : [nl, nh];
    return `${put(A, x)}:${put(B, y)}`;
  });
}

/** Сдвинуть ячейки и формулы; возвращает новый набор ячеек. */
export function shiftCells<T extends { rawValue?: string }>(
  cells: Record<string, T>, axis: Axis, at: number, delta: 1 | -1,
): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [id, v] of Object.entries(cells)) {
    const a = parseCell(id);
    if (!a) continue;
    const s = shiftIndex(axis === 'row' ? a.row : a.col, at, delta);
    if (s === null) continue;
    const to = axis === 'row' ? cellId(a.col, s) : cellId(s, a.row);
    next[to] = v;
  }
  for (const [id, v] of Object.entries(next)) {
    if (v.rawValue && isFormula(v.rawValue)) next[id] = { ...v, rawValue: shiftFormula(v.rawValue, axis, at, delta) };
  }
  return next;
}
