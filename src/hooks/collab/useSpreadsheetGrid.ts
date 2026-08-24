import { useState, useEffect, useCallback } from 'react';
import { sheetService } from '../../services/collab/sheetService';
import { WorkspaceSpreadsheet, CellStyle } from '../../types/collab';
import { useAuth } from '../../contexts/AuthContext';

export function useSpreadsheetGrid(tenantId: string, sheetId: string | undefined) {
  const { user } = useAuth();
  const [sheet, setSheet] = useState<WorkspaceSpreadsheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCell, setActiveCell] = useState<string | null>('A1');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!tenantId || !sheetId) {
      setLoading(false);
      return;
    }
    const unsub = sheetService.subscribeToSheet(tenantId, sheetId, (data) => {
      setSheet(data);
      setLoading(false);
    });
    return () => unsub();
  }, [tenantId, sheetId]);

  const updateCellValue = useCallback((cellId: string, rawValue: string) => {
    if (!sheet || !user) return;
    
    // Optimistic update
    const newSheet = { ...sheet };
    if (!newSheet.cells) newSheet.cells = {};
    if (!newSheet.cells[cellId]) {
      newSheet.cells[cellId] = { rawValue: '', computedValue: '' };
    }
    newSheet.cells[cellId].rawValue = rawValue;
    setSheet(newSheet);

    // Call service to compute & save
    sheetService.updateCell(tenantId, sheet.id, cellId, rawValue, user.uid);
  }, [sheet, tenantId, user]);

  const updateCellStyle = useCallback((cellId: string, updates: Partial<CellStyle>) => {
    if (!sheet || !user || !activeCell) return;
    sheetService.updateCellStyle(tenantId, sheet.id, cellId, updates, user.uid);
  }, [sheet, tenantId, user, activeCell]);

  const getActiveCellData = () => {
    if (!sheet || !activeCell || !sheet.cells) return undefined;
    return sheet.cells[activeCell];
  };

  const navigateCell = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (!activeCell || isEditing || !sheet) return;
    const col = activeCell.match(/[A-Z]+/)?.[0] || 'A';
    const row = parseInt(activeCell.match(/[0-9]+/)?.[0] || '1', 10);
    
    let newCol = col.charCodeAt(0);
    let newRow = row;

    if (direction === 'up' && row > 1) newRow--;
    if (direction === 'down' && row < sheet.rowsCount) newRow++;
    if (direction === 'left' && newCol > 65) newCol--;
    if (direction === 'right' && newCol < 65 + sheet.columnsCount - 1) newCol++;

    setActiveCell(`${String.fromCharCode(newCol)}${newRow}`);
  };

  return {
    sheet,
    loading,
    activeCell,
    setActiveCell,
    isEditing,
    setIsEditing,
    updateCellValue,
    updateCellStyle,
    getActiveCellData,
    navigateCell
  };
}
