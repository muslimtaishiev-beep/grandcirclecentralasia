import React from 'react';
import { useOutletContext, useParams, useNavigate } from 'react-router-dom';
import { useSpreadsheetGrid } from '../../../hooks/collab/useSpreadsheetGrid';
import { sheetService } from '../../../services/collab/sheetService';
import FormulaBar from './components/FormulaBar';
import CellFormatToolbar from './components/CellFormatToolbar';
import SpreadsheetGrid from './components/SpreadsheetGrid';

export default function SheetSpreadsheetPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  // Маршрут объявлен как :orgId/sheets/:sheetId — параметр называется sheetId.
  // Раньше здесь читался `id`, которого в маршруте нет: любая таблица
  // открывалась как «не найдена».
  const { sheetId } = useParams<{ sheetId: string }>();
  const navigate = useNavigate();
  
  const { 
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
  } = useSpreadsheetGrid(activeTenant?.id, sheetId);

  if (loading) return <div className="p-8 text-[var(--text-muted)]">Загрузка таблицы...</div>;
  if (!sheet) return <div className="p-8 text-red-500 font-bold">Таблица не найдена.</div>;

  const handleCellKeyDown = (id: string, e: React.KeyboardEvent) => {
    if (isEditing) {
      if (e.key === 'Enter') {
        setIsEditing(false);
        navigateCell('down');
      } else if (e.key === 'Tab') {
        e.preventDefault();
        setIsEditing(false);
        navigateCell('right');
      }
    } else {
      if (e.key === 'ArrowUp') navigateCell('up');
      if (e.key === 'ArrowDown') navigateCell('down');
      if (e.key === 'ArrowLeft') navigateCell('left');
      if (e.key === 'ArrowRight' || e.key === 'Tab') navigateCell('right');
    }
  };

  const handleExport = () => {
    sheetService.exportToCSV(sheet);
  };

  /**
   * Вставка и удаление строк.
   *
   * Содержимое ниже точки вставки сдвигается целиком, вместе со стилями:
   * иначе «вставить строку» означало бы затереть соседнюю, и таблицу
   * приходилось бы переписывать руками.
   *
   * delta = +1 вставляет пустую строку, -1 удаляет строку `at`.
   */
  const shiftRows = async (at: number, delta: 1 | -1) => {
    if (!sheet || !activeTenant?.id || !sheetId) return;
    const cells = sheet.cells || {};
    const next: Record<string, any> = {};

    for (const [key, value] of Object.entries(cells)) {
      const col = (key.match(/^[A-Z]+/) || [''])[0];
      const row = Number((key.match(/\d+$/) || [0])[0]);
      if (!col || !row) continue;
      if (delta === -1 && row === at) continue;       // удаляемая строка
      const shifted = row >= at ? row + delta : row;  // всё ниже — сдвигаем
      if (shifted < 1) continue;
      next[`${col}${shifted}`] = value;
    }

    await sheetService.replaceCells(activeTenant.id, sheetId, next, {
      rowsCount: Math.max(1, (sheet.rowsCount || 100) + delta),
    });
  };

  /** То же для колонок: содержимое правее сдвигается, стили сохраняются. */
  const shiftColumns = async (at: string, delta: 1 | -1) => {
    if (!sheet || !activeTenant?.id || !sheetId) return;
    const cells = sheet.cells || {};
    const atIndex = at.charCodeAt(0) - 65;
    const next: Record<string, any> = {};

    for (const [key, value] of Object.entries(cells)) {
      const col = (key.match(/^[A-Z]+/) || [''])[0];
      const row = Number((key.match(/\d+$/) || [0])[0]);
      if (!col || !row || col.length > 1) continue;
      const index = col.charCodeAt(0) - 65;
      if (delta === -1 && index === atIndex) continue;
      const shifted = index >= atIndex ? index + delta : index;
      if (shifted < 0 || shifted > 25) continue;
      next[`${String.fromCharCode(65 + shifted)}${row}`] = value;
    }

    await sheetService.replaceCells(activeTenant.id, sheetId, next, {
      columnsCount: Math.min(26, Math.max(1, (sheet.columnsCount || 26) + delta)),
    });
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-[var(--bg-app)]">
      <CellFormatToolbar 
        onBack={() => navigate(`/workspace/${activeTenant?.id}/sheets`)}
        onFormat={(updates) => activeCell && updateCellStyle(activeCell, updates)}
        onExport={handleExport}
      />
      <FormulaBar 
        activeCell={activeCell}
        activeCellData={getActiveCellData()}
        onChange={(val) => activeCell && updateCellValue(activeCell, val)}
        onEnter={() => {
          setIsEditing(false);
          navigateCell('down');
        }}
      />
      <SpreadsheetGrid 
        sheet={sheet}
        activeCell={activeCell}
        isEditing={isEditing}
        onCellClick={(id) => {
          setActiveCell(id);
          setIsEditing(false);
        }}
        onCellDoubleClick={(id) => {
          setActiveCell(id);
          setIsEditing(true);
        }}
        onCellChange={(id, val) => {
          updateCellValue(id, val);
          setIsEditing(false);
        }}
        onCellKeyDown={handleCellKeyDown}
        onInsertRow={(at) => void shiftRows(at, 1)}
        onDeleteRow={(at) => void shiftRows(at, -1)}
        onInsertColumn={(at) => void shiftColumns(at, 1)}
        onDeleteColumn={(at) => void shiftColumns(at, -1)}
      />
    </div>
  );
}
