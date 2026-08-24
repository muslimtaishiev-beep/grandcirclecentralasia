import { db } from '../../lib/firebase';
import { collection, doc, query, onSnapshot, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { WorkspaceSpreadsheet, SheetCellData } from '../../types/collab';
import { formulaEngine } from './sheetFormulaEngine';

class SheetService {
  subscribeToList(tenantId: string, onUpdate: (sheets: WorkspaceSpreadsheet[]) => void) {
    const q = query(collection(db, 'tenants', tenantId, 'workspace_sheets'));
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as WorkspaceSpreadsheet)));
    });
  }

  subscribeToSheet(tenantId: string, sheetId: string, onUpdate: (sheet: WorkspaceSpreadsheet | null) => void) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_sheets', sheetId);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = { ...snap.data(), id: snap.id } as WorkspaceSpreadsheet;
        // Pre-compute formula engine
        formulaEngine.setCells(data.cells || {});
        onUpdate(data);
      } else {
        onUpdate(null);
      }
    });
  }

  async createSheet(tenantId: string, authorStaffId: string, title: string = 'Новая таблица') {
    const ref = doc(collection(db, 'tenants', tenantId, 'workspace_sheets'));
    
    const newSheet: WorkspaceSpreadsheet = {
      id: ref.id,
      tenantId,
      title,
      authorStaffId,
      lastEditedByStaffId: authorStaffId,
      columnsCount: 26, // A-Z
      rowsCount: 100,
      cells: {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await setDoc(ref, newSheet);
    return ref.id;
  }

  async updateCell(tenantId: string, sheetId: string, cellId: string, rawValue: string, staffId: string) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_sheets', sheetId);
    
    // Optimistically calculate computed value locally
    const computedValue = formulaEngine.evaluate(cellId, rawValue);

    await updateDoc(ref, {
      [`cells.${cellId}.rawValue`]: rawValue,
      [`cells.${cellId}.computedValue`]: computedValue,
      lastEditedByStaffId: staffId,
      updatedAt: Date.now()
    });
  }

  async updateCellStyle(tenantId: string, sheetId: string, cellId: string, styleUpdates: any, staffId: string) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_sheets', sheetId);
    
    // We update multiple fields of the style object
    const updates: Record<string, any> = {
      lastEditedByStaffId: staffId,
      updatedAt: Date.now()
    };

    for (const [key, val] of Object.entries(styleUpdates)) {
      updates[`cells.${cellId}.style.${key}`] = val;
    }

    await updateDoc(ref, updates);
  }

  async updateTitle(tenantId: string, sheetId: string, title: string, staffId: string) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_sheets', sheetId);
    await updateDoc(ref, {
      title,
      lastEditedByStaffId: staffId,
      updatedAt: Date.now()
    });
  }

  async deleteSheet(tenantId: string, sheetId: string) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_sheets', sheetId);
    await deleteDoc(ref);
  }

  exportToCSV(sheet: WorkspaceSpreadsheet) {
    let csv = '';
    const cols = Array.from({ length: sheet.columnsCount }, (_, i) => String.fromCharCode(65 + i));
    
    for (let r = 1; r <= sheet.rowsCount; r++) {
      const rowData = cols.map(c => {
        const id = `${c}${r}`;
        const cell = sheet.cells[id];
        let val = cell ? (cell.computedValue || cell.rawValue) : '';
        // Escape quotes
        if (val.includes(',') || val.includes('"')) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });
      csv += rowData.join(',') + '\n';
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${sheet.title}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export const sheetService = new SheetService();
