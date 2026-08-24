import React from 'react';
import { useOutletContext, useParams, useNavigate } from 'react-router-dom';
import { useSpreadsheetGrid } from '../../../hooks/collab/useSpreadsheetGrid';
import { sheetService } from '../../../services/collab/sheetService';
import FormulaBar from './components/FormulaBar';
import CellFormatToolbar from './components/CellFormatToolbar';
import SpreadsheetGrid from './components/SpreadsheetGrid';

export default function SheetSpreadsheetPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const { id: sheetId } = useParams();
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
      />
    </div>
  );
}
