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
  // Показываем заполненное плюс небольшой запас, а не все 100 строк:
  // лист из двух строк ответов и девяноста восьми пустых выглядит
  // заброшенным, и найти в нём данные труднее, чем в списке заявок.
  const lastFilledRow = React.useMemo(() => {
    let last = 0;
    for (const key of Object.keys(sheet.cells || {})) {
      const n = Number((key.match(/\d+$/) || [])[0]);
      if (Number.isFinite(n) && n > last) last = n;
    }
    return last;
  }, [sheet.cells]);
  const visibleRowCount = Math.min(sheet.rowsCount, Math.max(lastFilledRow + 12, 24));
  const rows = Array.from({ length: visibleRowCount }, (_, i) => i + 1);

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

  // Колонка расширяется под своё содержимое: при жёсткой ширине заголовки
  // вроде «Фамилия и имя» обрезались до «Фамилия и…», и таблица с ответами
  // читалась хуже, чем список заявок.
  const widthOf = (col: string): number => {
    let longest = 0;
    for (let r = 1; r <= Math.min(rows.length, 60); r++) {
      const raw = String(sheet.cells?.[`${col}${r}`]?.computedValue ?? sheet.cells?.[`${col}${r}`]?.rawValue ?? '');
      if (raw.length > longest) longest = raw.length;
    }
    if (!longest) return 100;
    return Math.min(320, Math.max(100, longest * 8 + 24));
  };
  const colWidths = React.useMemo(
    () => Object.fromEntries(cols.map(c => [c, widthOf(c)])),
    [cols, sheet.cells, rows.length],
  );

  const activeCol = activeCell ? (activeCell.match(/^[A-Z]+/) || [''])[0] : '';
  const activeRow = activeCell ? Number((activeCell.match(/\d+$/) || [0])[0]) : 0;

  return (
    <div className="flex-1 overflow-auto bg-[var(--bg-surface)] relative">
      <div className="inline-block min-w-full">
        {/* Header Row */}
        <div className="flex sticky top-0 z-30">
          <div className="w-12 h-8 bg-[var(--bg-panel)] border-r border-b border-[var(--border-color)] shrink-0 sticky left-0 z-40"></div>
          {cols.map(c => (
            <div key={c}
              style={{ width: colWidths[c] }}
              className={`h-8 border-r border-b border-[var(--border-color)] flex items-center justify-center font-bold text-[11px] shrink-0 select-none transition-colors ${
                c === activeCol
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-[var(--bg-panel)] text-[var(--text-muted)]'
              }`}>
              {c}
            </div>
          ))}
        </div>

        {/* Rows */}
        {rows.map(r => (
          <div key={r} className="flex flex-nowrap h-7">
            <div className={`w-12 h-full border-r border-b border-[var(--border-color)] flex items-center justify-center font-bold text-[11px] shrink-0 sticky left-0 z-20 select-none transition-colors ${
              r === activeRow
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-[var(--bg-panel)] text-[var(--text-muted)]'
            }`}>
              {r}
            </div>
            {cols.map(c => {
              const cellId = `${c}${r}`;
              return (
                <div key={cellId} style={{ width: colWidths[c] }}
                  className={`shrink-0 h-full ${r % 2 === 0 ? 'bg-black/[0.02] dark:bg-white/[0.02]' : ''}`}>
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
