import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { sheetService } from '../../services/collab/sheetService';
import { WorkspaceSpreadsheet, CellStyle, SheetCellData } from '../../types/collab';
import { useAuth } from '../../contexts/AuthContext';
import { computeSheet, parseCell, cellId, Axis, MAX_COLUMNS } from '../../services/collab/sheetCore';

interface HistoryEntry { undo: () => Promise<void>; redo: () => Promise<void> }
const errMsg = (e: unknown) => ((e as { code?: string })?.code === 'permission-denied' ? 'Нет прав на правку таблицы' : 'Не сохранилось — повторите');

/**
 * Таблица для нескольких человек: ячейки пишутся поштучно, поэтому правки
 * коллег не перезаписываются. Свои несохранённые правки лежат в `pending`
 * поверх данных с сервера; при отказе базы возвращаются на место.
 */
export function useSpreadsheetGrid(tenantId: string, sheetId: string | undefined, onError?: (msg: string) => void) {
  const { user } = useAuth();
  const [sheet, setSheet] = useState<WorkspaceSpreadsheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [activeCell, setActiveCell] = useState<string | null>('A1');
  const [isEditing, setIsEditing] = useState(false);
  const [pending, setPending] = useState<Record<string, string>>({});
  const [, bump] = useState(0);

  const sheetRef = useRef<WorkspaceSpreadsheet | null>(null);
  const pendingRef = useRef<Record<string, string>>({});
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const fail = useCallback((e: unknown) => onError?.(errMsg(e)), [onError]);

  useEffect(() => {
    setSheet(null); setPending({}); pendingRef.current = {}; setDenied(false);
    undoStack.current = []; redoStack.current = [];
    if (!tenantId || !sheetId) { setLoading(false); return; }
    setLoading(true);
    const unsub = sheetService.subscribeToSheet(tenantId, sheetId, (data) => {
      sheetRef.current = data;
      setSheet(data);
      setLoading(false);
    }, (code) => { setDenied(code === 'permission-denied'); setSheet(null); setLoading(false); });
    return () => unsub();
  }, [tenantId, sheetId]);

  /** Ячейки как их видит сотрудник: данные сервера + свои ещё не подтверждённые правки, формулы пересчитаны. */
  const cells = useMemo<Record<string, SheetCellData>>(() => {
    const merged: Record<string, SheetCellData> = { ...(sheet?.cells || {}) };
    for (const [id, raw] of Object.entries(pending)) merged[id] = { ...(merged[id] || { computedValue: '' }), rawValue: raw };
    const computed = computeSheet(merged);
    const out: Record<string, SheetCellData> = {};
    for (const [id, c] of Object.entries(merged)) out[id] = { ...c, computedValue: computed[id] ?? c.rawValue };
    return out;
  }, [sheet?.cells, pending]);
  const cellsRef = useRef(cells);
  cellsRef.current = cells;

  const rawOf = (id: string) => cellsRef.current[id]?.rawValue ?? '';

  const write = useCallback(async (changes: Record<string, string>) => {
    const s = sheetRef.current;
    if (!s || !user) return;
    pendingRef.current = { ...pendingRef.current, ...changes };
    setPending(pendingRef.current);
    try {
      await sheetService.updateCells(tenantId, s.id, s.cells || {}, changes, user.uid);
    } catch (e) {
      fail(e);
    } finally {
      const next = { ...pendingRef.current };
      for (const id of Object.keys(changes)) if (next[id] === changes[id]) delete next[id];
      pendingRef.current = next;
      setPending(next);
    }
  }, [tenantId, user, fail]);

  const updateCellValue = useCallback((id: string, rawValue: string) => {
    const prev = rawOf(id);
    if (prev === rawValue) return;
    undoStack.current.push({ undo: () => write({ [id]: prev }), redo: () => write({ [id]: rawValue }) });
    redoStack.current = [];
    bump(n => n + 1);
    void write({ [id]: rawValue });
  }, [write]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateCellStyle = useCallback((id: string, updates: Partial<CellStyle>) => {
    const s = sheetRef.current;
    if (!s || !user) return;
    sheetService.updateCellStyle(tenantId, s.id, id, updates as Record<string, unknown>, user.uid).catch(fail);
  }, [tenantId, user, fail]);

  /** Вставить (+1) или удалить (−1) строку/колонку. Отмена — undo(). */
  const shift = useCallback(async (axis: Axis, at: number, delta: 1 | -1): Promise<boolean> => {
    const s = sheetRef.current;
    if (!s || !user) return false;
    try {
      let before = await sheetService.shiftStructure(tenantId, s.id, axis, at, delta, user.uid);
      undoStack.current.push({
        undo: () => sheetService.restoreSnapshot(tenantId, s.id, before, user.uid),
        redo: async () => { before = await sheetService.shiftStructure(tenantId, s.id, axis, at, delta, user.uid); },
      });
      redoStack.current = [];
      bump(n => n + 1);
      return true;
    } catch (e) { fail(e); return false; }
  }, [tenantId, user, fail]);

  const addRows = useCallback((n: number) => {
    const s = sheetRef.current; if (!s || !user) return;
    sheetService.extendGrid(tenantId, s.id, (s.rowsCount || 100) + n, s.columnsCount || 26, user.uid).catch(fail);
  }, [tenantId, user, fail]);
  const addColumns = useCallback((n: number) => {
    const s = sheetRef.current; if (!s || !user) return;
    sheetService.extendGrid(tenantId, s.id, s.rowsCount || 100, Math.min(MAX_COLUMNS, (s.columnsCount || 26) + n), user.uid).catch(fail);
  }, [tenantId, user, fail]);

  const undo = useCallback(async () => {
    const e = undoStack.current.pop();
    if (!e) return;
    redoStack.current.push(e);
    try { await e.undo(); } catch (er) { fail(er); }
    bump(n => n + 1);
  }, [fail]);
  const redo = useCallback(async () => {
    const e = redoStack.current.pop();
    if (!e) return;
    undoStack.current.push(e);
    try { await e.redo(); } catch (er) { fail(er); }
    bump(n => n + 1);
  }, [fail]);

  const getActiveCellData = () => (activeCell ? cells[activeCell] : undefined);

  const navigateCell = (direction: 'up' | 'down' | 'left' | 'right', force = false) => {
    if (!activeCell || (isEditing && !force) || !sheet) return;
    const a = parseCell(activeCell);
    if (!a) return;
    let { col, row } = a;
    if (direction === 'up' && row > 1) row--;
    if (direction === 'down' && row < sheet.rowsCount) row++;
    if (direction === 'left' && col > 0) col--;
    if (direction === 'right' && col < sheet.columnsCount - 1) col++;
    setActiveCell(cellId(col, row));
  };

  return {
    sheet, cells, loading, denied,
    activeCell, setActiveCell, isEditing, setIsEditing,
    updateCellValue, updateCellStyle, getActiveCellData, navigateCell,
    shift, addRows, addColumns,
    undo, redo, canUndo: undoStack.current.length > 0, canRedo: redoStack.current.length > 0,
  };
}
