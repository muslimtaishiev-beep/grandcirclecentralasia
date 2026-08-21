import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { CellData, SheetData, SpreadsheetMeta } from '../types/spreadsheet';

// Helper to convert column index to letter (0 -> A, 1 -> B, 25 -> Z, 26 -> AA)
export function colIndexToLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

// Helper to convert column letter to index (A -> 0, B -> 1, Z -> 25, AA -> 26)
export function letterToColIndex(letter: string): number {
  let col = 0;
  for (let i = 0; i < letter.length; i++) {
    col = col * 26 + (letter.charCodeAt(i) - 64);
  }
  return col - 1;
}

// Helper to parse cell key e.g. "B5" -> { colLetter: "B", colIndex: 1, rowIndex: 4 }
export function parseCellKey(key: string): { colLetter: string; colIndex: number; rowIndex: number } | null {
  const match = key.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  const colLetter = match[1].toUpperCase();
  const rowIndex = parseInt(match[2], 10) - 1;
  return { colLetter, colIndex: letterToColIndex(colLetter), rowIndex };
}

// Helper to expand cell range e.g. "A1:A5" -> ["A1", "A2", "A3", "A4", "A5"]
export function expandRange(rangeStr: string): string[] {
  const parts = rangeStr.split(':');
  if (parts.length !== 2) return [parts[0].toUpperCase()];

  const start = parseCellKey(parts[0]);
  const end = parseCellKey(parts[1]);
  if (!start || !end) return [];

  const minCol = Math.min(start.colIndex, end.colIndex);
  const maxCol = Math.max(start.colIndex, end.colIndex);
  const minRow = Math.min(start.rowIndex, end.rowIndex);
  const maxRow = Math.max(start.rowIndex, end.rowIndex);

  const keys: string[] = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      keys.push(`${colIndexToLetter(c)}${r + 1}`);
    }
  }
  return keys;
}

// Formula Evaluator Function
export function evaluateFormula(
  rawInput: string,
  cells: Record<string, CellData>,
  visited: Set<string> = new Set()
): string | number {
  if (!rawInput.startsWith('=')) {
    const num = Number(rawInput);
    return isNaN(num) || rawInput.trim() === '' ? rawInput : num;
  }

  const formula = rawInput.substring(1).trim().toUpperCase();

  // Helper to get resolved cell numeric or string value
  const getCellValue = (cellKey: string): number => {
    const key = cellKey.toUpperCase();
    if (visited.has(key)) return 0; // Prevent circular references
    visited.add(key);

    const cell = cells[key];
    if (!cell || !cell.raw) return 0;

    const val = evaluateFormula(cell.raw, cells, new Set(visited));
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  };

  // 1. Functions: SUM, AVG / AVERAGE, MIN, MAX, COUNT
  const funcMatch = formula.match(/^(SUM|AVG|AVERAGE|MIN|MAX|COUNT)\(([^)]+)\)$/i);
  if (funcMatch) {
    const funcName = funcMatch[1].toUpperCase();
    const rangeArg = funcMatch[2].trim();
    const targetKeys = expandRange(rangeArg);
    const values = targetKeys.map(k => getCellValue(k));

    if (values.length === 0) return 0;

    switch (funcName) {
      case 'SUM':
        return values.reduce((a, b) => a + b, 0);
      case 'AVG':
      case 'AVERAGE':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'MIN':
        return Math.min(...values);
      case 'MAX':
        return Math.max(...values);
      case 'COUNT':
        return values.filter(v => typeof v === 'number' && !isNaN(v)).length;
    }
  }

  // 2. Simple arithmetic expression e.g. A1 + B1 or A1 * 10
  try {
    const expression = formula.replace(/([A-Z]+\d+)/g, (match) => {
      return String(getCellValue(match));
    });

    // Safe mathematical evaluation (only numbers, operators, parens, spaces)
    if (/^[0-9.+\-*/()\s]+$/.test(expression)) {
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${expression})`)();
      return typeof result === 'number' && isFinite(result) ? Math.round(result * 100) / 100 : '#ERROR!';
    }
  } catch (err) {
    return '#ERROR!';
  }

  // Fallback single cell reference e.g. =A1
  if (/^[A-Z]+\d+$/.test(formula)) {
    return getCellValue(formula);
  }

  return '#VALUE!';
}

// Hook for fetching organization spreadsheets
export function useSpreadsheetList(tenantId: string | undefined) {
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setSpreadsheets([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'spreadsheets'),
      where('tenantId', '==', tenantId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: SpreadsheetMeta[] = [];
      snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() } as SpreadsheetMeta));
      // Sort client-side
      docs.sort((a, b) => {
        const t1 = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
        const t2 = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
        return t2 - t1;
      });
      setSpreadsheets(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId]);

  const createSpreadsheet = async (title: string = 'Новая таблица'): Promise<string | undefined> => {
    if (!tenantId) return;

    const initialSheet: SheetData = {
      id: 'sheet_1',
      name: 'Лист 1',
      rowCount: 30,
      colCount: 12,
      cells: {}
    };

    const docRef = await addDoc(collection(db, 'spreadsheets'), {
      tenantId,
      title,
      sheets: [initialSheet],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return docRef.id;
  };

  const deleteSpreadsheet = async (id: string) => {
    await deleteDoc(doc(db, 'spreadsheets', id));
  };

  return { spreadsheets, loading, createSpreadsheet, deleteSpreadsheet };
}

// Hook for managing a single spreadsheet document
export function useSpreadsheet(id: string | undefined) {
  const [meta, setMeta] = useState<SpreadsheetMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (!id) {
      setMeta(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const docRef = doc(db, 'spreadsheets', id);

    getDoc(docRef).then(snapshot => {
      if (snapshot.exists()) {
        setMeta({ id: snapshot.id, ...snapshot.data() } as SpreadsheetMeta);
      }
      setLoading(false);
    }).catch(console.error);

    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setMeta({ id: snapshot.id, ...snapshot.data() } as SpreadsheetMeta);
      }
    });

    return () => unsubscribe();
  }, [id]);

  const saveMeta = useCallback((updated: SpreadsheetMeta) => {
    setMeta(updated);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (!id) return;
      const docRef = doc(db, 'spreadsheets', id);
      updateDoc(docRef, {
        title: updated.title,
        sheets: updated.sheets,
        updatedAt: serverTimestamp()
      }).catch(console.error);
    }, 1500); // 1.5s debounced save
  }, [id]);

  return { meta, loading, saveMeta };
}
