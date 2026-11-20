import { db } from '../../lib/firebase';
import { collection, doc, query, where, onSnapshot, setDoc, updateDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { WorkspaceSpreadsheet, SheetCellData } from '../../types/collab';
import { computeSheet, shiftCells, indexToCol, parseCell, Axis, MAX_COLUMNS, MAX_ROWS } from './sheetCore';

export interface SheetSnapshot {
  cells: Record<string, SheetCellData>;
  rowsCount: number;
  columnsCount: number;
}

/** Выгрузка в CSV: ячейка, начинающаяся с = + - @, не должна стать формулой в Excel. */
const csvSafe = (v: string) => (/^[=+\-@\t\r]/.test(v) && !/^-?\d+([.,]\d+)?$/.test(v) ? `'${v}` : v);

class SheetService {
  /** Все таблицы — тем, у кого право «Таблицы»; иначе только свои (так разрешают правила базы). */
  subscribeToList(tenantId: string, staffId: string, seeAll: boolean, onUpdate: (sheets: WorkspaceSpreadsheet[]) => void, onError?: () => void) {
    const col = collection(db, 'tenants', tenantId, 'workspace_sheets');
    const q = seeAll ? query(col) : query(col, where('authorStaffId', '==', staffId));
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as WorkspaceSpreadsheet)));
    }, (e) => { console.warn('Sheets list notice:', e); onError?.(); });
  }

  subscribeToSheet(tenantId: string, sheetId: string, onUpdate: (sheet: WorkspaceSpreadsheet | null) => void, onError?: (code: string) => void) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_sheets', sheetId);
    return onSnapshot(ref, (snap) => {
      onUpdate(snap.exists() ? ({ ...snap.data(), id: snap.id } as WorkspaceSpreadsheet) : null);
    }, (e) => { onError?.((e as { code?: string }).code || 'error'); });
  }

  async createSheet(tenantId: string, authorStaffId: string, title: string = 'Новая таблица') {
    const ref = doc(collection(db, 'tenants', tenantId, 'workspace_sheets'));
    const newSheet: WorkspaceSpreadsheet = {
      id: ref.id,
      tenantId,
      title,
      authorStaffId,
      lastEditedByStaffId: authorStaffId,
      columnsCount: 26,
      rowsCount: 100,
      cells: {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await setDoc(ref, newSheet);
    return ref.id;
  }

  async duplicateSheet(tenantId: string, src: WorkspaceSpreadsheet, authorStaffId: string) {
    const ref = doc(collection(db, 'tenants', tenantId, 'workspace_sheets'));
    const copy: WorkspaceSpreadsheet = {
      id: ref.id, tenantId, title: `${src.title} — копия`, authorStaffId, lastEditedByStaffId: authorStaffId,
      columnsCount: src.columnsCount || 26, rowsCount: src.rowsCount || 100,
      cells: JSON.parse(JSON.stringify(src.cells || {})), createdAt: Date.now(), updatedAt: Date.now(),
    };
    await setDoc(ref, copy);
    return ref.id;
  }

  /**
   * Правка ячеек — только изменённые поля (cells.A1.rawValue), поэтому правки
   * коллег в других ячейках не затираются. Вместе с ячейкой пересчитываются
   * и сохранённые значения формул, которые от неё зависят.
   */
  async updateCells(
    tenantId: string, sheetId: string, current: Record<string, SheetCellData>,
    changes: Record<string, string>, staffId: string,
  ) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_sheets', sheetId);
    const before = computeSheet(current);
    const merged: Record<string, SheetCellData> = { ...current };
    for (const [id, raw] of Object.entries(changes)) merged[id] = { ...(current[id] || { computedValue: '' }), rawValue: raw };
    const after = computeSheet(merged);

    const updates: Record<string, unknown> = { lastEditedByStaffId: staffId, updatedAt: Date.now() };
    for (const [id, raw] of Object.entries(changes)) {
      updates[`cells.${id}.rawValue`] = raw;
      updates[`cells.${id}.computedValue`] = after[id] ?? raw;
    }
    for (const id of Object.keys(after)) {
      if (id in changes) continue;
      if (merged[id]?.rawValue?.startsWith('=') && after[id] !== before[id]) updates[`cells.${id}.computedValue`] = after[id];
    }
    await updateDoc(ref, updates);
  }

  async updateCellStyle(tenantId: string, sheetId: string, cellId: string, styleUpdates: Record<string, unknown>, staffId: string) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_sheets', sheetId);
    const updates: Record<string, unknown> = { lastEditedByStaffId: staffId, updatedAt: Date.now() };
    for (const [key, val] of Object.entries(styleUpdates)) updates[`cells.${cellId}.style.${key}`] = val;
    await updateDoc(ref, updates);
  }

  /**
   * Вставка/удаление строки или колонки: в транзакции — над тем, что в базе
   * сейчас (а не над копией на экране), с пересчётом ссылок в формулах.
   * Возвращает состояние до операции — для отмены.
   */
  async shiftStructure(tenantId: string, sheetId: string, axis: Axis, at: number, delta: 1 | -1, staffId: string): Promise<SheetSnapshot> {
    const ref = doc(db, 'tenants', tenantId, 'workspace_sheets', sheetId);
    return runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw Object.assign(new Error('not-found'), { code: 'not-found' });
      const d = snap.data() as WorkspaceSpreadsheet;
      const before: SheetSnapshot = { cells: d.cells || {}, rowsCount: d.rowsCount || 100, columnsCount: d.columnsCount || 26 };
      const next = shiftCells(before.cells, axis, at, delta);
      const computed = computeSheet(next);
      for (const id of Object.keys(next)) next[id] = { ...next[id], computedValue: computed[id] ?? next[id].rawValue };
      const rowsCount = axis === 'row' ? Math.min(MAX_ROWS, Math.max(1, before.rowsCount + delta)) : before.rowsCount;
      const columnsCount = axis === 'col' ? Math.min(MAX_COLUMNS, Math.max(1, before.columnsCount + delta)) : before.columnsCount;
      tx.update(ref, { cells: next, rowsCount, columnsCount, updatedAt: Date.now(), lastEditedByStaffId: staffId });
      return before;
    });
  }

  /** Вернуть таблицу к сохранённому состоянию (отмена вставки/удаления). */
  async restoreSnapshot(tenantId: string, sheetId: string, s: SheetSnapshot, staffId: string) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_sheets', sheetId);
    await updateDoc(ref, { cells: s.cells, rowsCount: s.rowsCount, columnsCount: s.columnsCount, updatedAt: Date.now(), lastEditedByStaffId: staffId });
  }

  async extendGrid(tenantId: string, sheetId: string, rowsCount: number, columnsCount: number, staffId: string) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_sheets', sheetId);
    await updateDoc(ref, {
      rowsCount: Math.min(MAX_ROWS, rowsCount), columnsCount: Math.min(MAX_COLUMNS, columnsCount),
      updatedAt: Date.now(), lastEditedByStaffId: staffId,
    });
  }

  async updateTitle(tenantId: string, sheetId: string, title: string, staffId: string) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_sheets', sheetId);
    await updateDoc(ref, { title, lastEditedByStaffId: staffId, updatedAt: Date.now() });
  }

  /** В архив и обратно: таблица остаётся, но уходит из основного списка. */
  async setArchived(tenantId: string, sheetId: string, archived: boolean, staffId: string) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_sheets', sheetId);
    await updateDoc(ref, { archivedAt: archived ? Date.now() : null, lastEditedByStaffId: staffId, updatedAt: Date.now() });
  }

  async deleteSheet(tenantId: string, sheetId: string) {
    await deleteDoc(doc(db, 'tenants', tenantId, 'workspace_sheets', sheetId));
  }

  exportToCSV(sheet: WorkspaceSpreadsheet) {
    // Размер выгрузки — по заполненному, а не по всем колонкам и строкам листа.
    let maxC = 0; let maxR = 0;
    for (const id of Object.keys(sheet.cells || {})) {
      const a = parseCell(id);
      if (a && (sheet.cells[id].computedValue || sheet.cells[id].rawValue)) { maxC = Math.max(maxC, a.col); maxR = Math.max(maxR, a.row); }
    }
    const computed = computeSheet(sheet.cells || {});
    const lines: string[] = [];
    for (let r = 1; r <= maxR; r++) {
      const row: string[] = [];
      for (let c = 0; c <= maxC; c++) {
        let val = csvSafe(computed[`${indexToCol(c)}${r}`] ?? '');
        if (/[;,"\n\r]/.test(val)) val = `"${val.replace(/"/g, '""')}"`;
        row.push(val);
      }
      lines.push(row.join(';'));
    }
    // BOM и «;» — чтобы Excel открыл кириллицу и разложил по колонкам.
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${sheet.title}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
}

export const sheetService = new SheetService();
