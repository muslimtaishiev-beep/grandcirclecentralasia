import React, { useEffect } from 'react';
import SheetCell from './SheetCell';
import { WorkspaceSpreadsheet } from '../../../../types/collab';

interface Props {
  sheet: WorkspaceSpreadsheet;
  activeCell: string | null;
  isEditing: boolean;
  onCellClick: (id: string) => void;
  onCellDoubleClick: (id: string) => void;
  onCellChange: (id: string, val: string) => void;
  onCellKeyDown: (id: string, e: React.KeyboardEvent) => void;
}

export default function SpreadsheetGrid({ sheet, activeCell, isEditing, onCellClick, onCellDoubleClick, onCellChange, onCellKeyDown }: Props) {
  const cols = Array.from({ length: sheet.columnsCount }, (_, i) => String.fromCharCode(65 + i));
  const rows = Array.from({ length: sheet.rowsCount }, (_, i) => i + 1);

  // Global keydown for navigation when not editing
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (isEditing || !activeCell) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
        e.preventDefault();
        onCellKeyDown(activeCell, e as any); // Passed back up to page handler for navigation
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onCellDoubleClick(activeCell); // trigger edit
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeCell, isEditing, onCellKeyDown, onCellDoubleClick]);

  return (
    <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 relative">
      <div className="inline-block min-w-full">
        {/* Header Row */}
        <div className="flex sticky top-0 z-30">
          <div className="w-10 h-8 bg-[var(--bg-panel)] border-r border-b border-[var(--border-color)] flex items-center justify-center shrink-0 sticky left-0 z-40"></div>
          {cols.map(c => (
            <div key={c} className="w-[100px] h-8 bg-[var(--bg-panel)] border-r border-b border-[var(--border-color)] flex items-center justify-center font-bold text-xs text-[var(--text-muted)] shrink-0 select-none">
              {c}
            </div>
          ))}
        </div>

        {/* Rows */}
        {rows.map(r => (
          <div key={r} className="flex flex-nowrap h-7">
            <div className="w-10 h-full bg-[var(--bg-panel)] border-r border-b border-[var(--border-color)] flex items-center justify-center font-bold text-xs text-[var(--text-muted)] shrink-0 sticky left-0 z-20 select-none">
              {r}
            </div>
            {cols.map(c => {
              const cellId = `${c}${r}`;
              return (
                <div key={cellId} className="w-[100px] shrink-0 h-full">
                  <SheetCell 
                    id={cellId}
                    data={sheet.cells?.[cellId]}
                    isActive={activeCell === cellId}
                    isEditing={isEditing}
                    onClick={() => onCellClick(cellId)}
                    onDoubleClick={() => onCellDoubleClick(cellId)}
                    onChange={(val) => onCellChange(cellId, val)}
                    onKeyDown={(e) => onCellKeyDown(cellId, e)}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
