import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSpreadsheet, colIndexToLetter, evaluateFormula, parseCellKey } from '../../../lib/useSpreadsheet';
import { CellData, CellStyle, SheetData, SpreadsheetMeta } from '../../../types/spreadsheet';
import {
  ChevronLeft, Save, Loader2, Bold, Italic, AlignLeft, AlignCenter, AlignRight,
  Plus, Download, Upload, Trash2, Rows3, Columns3, FileSpreadsheet, RefreshCw
} from 'lucide-react';
import Papa from 'papaparse';

export default function SpreadsheetEditor() {
  const { orgId, sheetId } = useParams();
  const { meta, loading, saveMeta } = useSpreadsheet(sheetId);

  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [selectedCell, setSelectedCell] = useState<{ col: number; row: number }>({ col: 0, row: 0 });
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [title, setTitle] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const formulaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (meta?.title) {
      setTitle(meta.title);
    }
  }, [meta?.title]);

  if (loading || !meta) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[var(--bg-app)]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
        <span className="text-xs font-mono text-[var(--text-muted)]">Загрузка электронной таблицы...</span>
      </div>
    );
  }

  const currentSheet = meta.sheets[activeSheetIndex] || meta.sheets[0];
  const activeColLetter = colIndexToLetter(selectedCell.col);
  const activeRowNumber = selectedCell.row + 1;
  const activeCellKey = `${activeColLetter}${activeRowNumber}`;

  const currentCellData: CellData = currentSheet.cells[activeCellKey] || { raw: '' };

  // Handle cell updates
  const updateCell = (cellKey: string, rawVal: string, styleUpdates?: Partial<CellStyle>) => {
    const updatedSheets = [...meta.sheets];
    const sheet = { ...updatedSheets[activeSheetIndex] };
    const updatedCells = { ...sheet.cells };

    const existing = updatedCells[cellKey] || { raw: '' };
    const newRaw = rawVal !== undefined ? rawVal : existing.raw;
    const newStyle = { ...(existing.style || {}), ...(styleUpdates || {}) };

    if (!newRaw && Object.keys(newStyle).length === 0) {
      delete updatedCells[cellKey];
    } else {
      updatedCells[cellKey] = {
        raw: newRaw,
        computed: evaluateFormula(newRaw, updatedCells),
        style: newStyle
      };
    }

    sheet.cells = updatedCells;
    updatedSheets[activeSheetIndex] = sheet;

    saveMeta({ ...meta, title, sheets: updatedSheets });
  };

  // Cell selection navigation
  const handleCellClick = (col: number, row: number) => {
    setSelectedCell({ col, row });
    setEditing(false);
    const key = `${colIndexToLetter(col)}${row + 1}`;
    setEditValue(currentSheet.cells[key]?.raw || '');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editing) {
      if (e.key === 'Enter') {
        updateCell(activeCellKey, editValue);
        setEditing(false);
        setSelectedCell(prev => ({ ...prev, row: Math.min(currentSheet.rowCount - 1, prev.row + 1) }));
      } else if (e.key === 'Escape') {
        setEditing(false);
      }
      return;
    }

    if (e.key === 'Enter') {
      setEditing(true);
      setEditValue(currentCellData.raw || '');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedCell(prev => ({ ...prev, row: Math.max(0, prev.row - 1) }));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedCell(prev => ({ ...prev, row: Math.min(currentSheet.rowCount - 1, prev.row + 1) }));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSelectedCell(prev => ({ ...prev, col: Math.max(0, prev.col - 1) }));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSelectedCell(prev => ({ ...prev, col: Math.min(currentSheet.colCount - 1, prev.col + 1) }));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      updateCell(activeCellKey, '');
      setEditValue('');
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      setEditing(true);
      setEditValue(e.key);
    }
  };

  // Add/Remove Rows & Columns
  const addRow = () => {
    const updatedSheets = [...meta.sheets];
    updatedSheets[activeSheetIndex].rowCount += 5;
    saveMeta({ ...meta, sheets: updatedSheets });
  };

  const addColumn = () => {
    const updatedSheets = [...meta.sheets];
    updatedSheets[activeSheetIndex].colCount += 3;
    saveMeta({ ...meta, sheets: updatedSheets });
  };

  // Add New Sheet Tab
  const addSheet = () => {
    const newNum = meta.sheets.length + 1;
    const newSheet: SheetData = {
      id: `sheet_${Date.now()}`,
      name: `Лист ${newNum}`,
      rowCount: 30,
      colCount: 12,
      cells: {}
    };
    const updatedSheets = [...meta.sheets, newSheet];
    saveMeta({ ...meta, sheets: updatedSheets });
    setActiveSheetIndex(updatedSheets.length - 1);
  };

  // Export CSV
  const exportCSV = () => {
    const rows: string[][] = [];
    for (let r = 0; r < currentSheet.rowCount; r++) {
      const rowVals: string[] = [];
      let hasData = false;
      for (let c = 0; c < currentSheet.colCount; c++) {
        const key = `${colIndexToLetter(c)}${r + 1}`;
        const cell = currentSheet.cells[key];
        const val = cell ? String(evaluateFormula(cell.raw, currentSheet.cells)) : '';
        if (val) hasData = true;
        rowVals.push(val);
      }
      if (hasData || r < 10) rows.push(rowVals);
    }

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title || 'Spreadsheet'}_${currentSheet.name}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import CSV
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      complete: (result) => {
        const rows = result.data as string[][];
        if (!rows || rows.length === 0) return;

        const newCells: Record<string, CellData> = {};
        let maxCols = currentSheet.colCount;

        rows.forEach((row, rIdx) => {
          if (row.length > maxCols) maxCols = row.length;
          row.forEach((val, cIdx) => {
            if (val !== undefined && val !== null && val !== '') {
              const key = `${colIndexToLetter(cIdx)}${rIdx + 1}`;
              newCells[key] = { raw: val, computed: val };
            }
          });
        });

        const updatedSheets = [...meta.sheets];
        updatedSheets[activeSheetIndex] = {
          ...currentSheet,
          rowCount: Math.max(currentSheet.rowCount, rows.length + 5),
          colCount: Math.max(currentSheet.colCount, maxCols),
          cells: newCells
        };

        saveMeta({ ...meta, sheets: updatedSheets });
      }
    });
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-app)] text-[var(--text-main)] overflow-hidden select-none" tabIndex={0} onKeyDown={handleKeyDown}>
      
      {/* Top Header Bar */}
      <div className="h-14 flex items-center justify-between px-4 bg-[var(--bg-surface)] border-b border-[var(--border-color)] shrink-0 gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Link to={`/workspace/${orgId}/sheets`} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <FileSpreadsheet className="w-5 h-5 text-emerald-500 shrink-0" />
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              saveMeta({ ...meta, title: e.target.value });
            }}
            className="font-bold text-base bg-transparent border border-transparent hover:border-[var(--border-color)] focus:border-emerald-500 rounded px-2 py-0.5 outline-hidden transition text-[var(--text-main)] max-w-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 mr-2">
            <Save className="w-3.5 h-3.5" /> Автосохранение
          </div>

          <label className="p-1.5 bg-black/5 dark:hover:bg-white/10 text-[var(--text-main)] rounded-lg text-xs font-medium flex items-center gap-1 hover:bg-black/10 transition cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-emerald-500" /> Импорт CSV
            <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
          </label>

          <button
            onClick={exportCSV}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Экспорт CSV
          </button>
        </div>
      </div>

      {/* Formatting & Controls Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-[var(--bg-surface)] border-b border-[var(--border-color)] overflow-x-auto shrink-0 text-xs">
        
        {/* Cell Position Indicator */}
        <div className="font-mono font-bold bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded border border-[var(--border-color)] min-w-[50px] text-center text-emerald-500">
          {activeCellKey}
        </div>

        <div className="w-px h-5 bg-[var(--border-color)] mx-1" />

        {/* Style Toggles */}
        <button
          onClick={() => updateCell(activeCellKey, currentCellData.raw, { bold: !currentCellData.style?.bold })}
          className={`p-1.5 rounded transition ${currentCellData.style?.bold ? 'bg-emerald-500/20 text-emerald-500 font-bold' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
          title="Жирный"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => updateCell(activeCellKey, currentCellData.raw, { italic: !currentCellData.style?.italic })}
          className={`p-1.5 rounded transition ${currentCellData.style?.italic ? 'bg-emerald-500/20 text-emerald-500' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
          title="Курсив"
        >
          <Italic className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-[var(--border-color)] mx-1" />

        {/* Align Toggles */}
        <button
          onClick={() => updateCell(activeCellKey, currentCellData.raw, { align: 'left' })}
          className={`p-1.5 rounded transition ${currentCellData.style?.align === 'left' ? 'bg-emerald-500/20 text-emerald-500' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => updateCell(activeCellKey, currentCellData.raw, { align: 'center' })}
          className={`p-1.5 rounded transition ${currentCellData.style?.align === 'center' ? 'bg-emerald-500/20 text-emerald-500' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={() => updateCell(activeCellKey, currentCellData.raw, { align: 'right' })}
          className={`p-1.5 rounded transition ${currentCellData.style?.align === 'right' ? 'bg-emerald-500/20 text-emerald-500' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
        >
          <AlignRight className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-[var(--border-color)] mx-1" />

        {/* Grid expansion */}
        <button onClick={addRow} className="px-2 py-1 bg-black/5 dark:bg-white/5 hover:bg-black/10 rounded flex items-center gap-1 transition">
          <Rows3 className="w-3.5 h-3.5 text-emerald-500" /> +5 строк
        </button>
        <button onClick={addColumn} className="px-2 py-1 bg-black/5 dark:bg-white/5 hover:bg-black/10 rounded flex items-center gap-1 transition">
          <Columns3 className="w-3.5 h-3.5 text-emerald-500" /> +3 столбца
        </button>

        <div className="w-px h-5 bg-[var(--border-color)] mx-1" />

        {/* Formula Bar Input */}
        <div className="flex-1 flex items-center gap-2 bg-[var(--bg-app)] border border-[var(--border-color)] rounded px-2 py-1">
          <span className="font-mono text-xs text-emerald-500 font-bold">fx</span>
          <input
            ref={formulaInputRef}
            type="text"
            value={editing ? editValue : currentCellData.raw || ''}
            onChange={(e) => {
              setEditing(true);
              setEditValue(e.target.value);
            }}
            onBlur={() => {
              if (editing) {
                updateCell(activeCellKey, editValue);
                setEditing(false);
              }
            }}
            placeholder="Значение или формулу (напр. =SUM(A1:A5))"
            className="w-full bg-transparent outline-hidden text-xs font-mono text-[var(--text-main)]"
          />
        </div>
      </div>

      {/* Grid Canvas */}
      <div className="flex-1 overflow-auto bg-[var(--bg-app)] relative">
        <table className="border-collapse table-fixed w-max text-xs">
          <thead>
            <tr>
              <th className="w-10 h-7 bg-[var(--bg-surface)] border border-[var(--border-color)] text-center text-[var(--text-muted)] font-mono text-[10px]"></th>
              {Array.from({ length: currentSheet.colCount }).map((_, c) => {
                const isSelectedCol = selectedCell.col === c;
                return (
                  <th
                    key={c}
                    className={`w-28 h-7 border border-[var(--border-color)] font-mono text-center select-none font-bold ${
                      isSelectedCol ? 'bg-emerald-500/20 text-emerald-500' : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                    }`}
                  >
                    {colIndexToLetter(c)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: currentSheet.rowCount }).map((_, r) => {
              const isSelectedRow = selectedCell.row === r;
              return (
                <tr key={r}>
                  <td
                    className={`w-10 h-7 border border-[var(--border-color)] font-mono text-center font-bold select-none ${
                      isSelectedRow ? 'bg-emerald-500/20 text-emerald-500' : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                    }`}
                  >
                    {r + 1}
                  </td>

                  {Array.from({ length: currentSheet.colCount }).map((_, c) => {
                    const cellKey = `${colIndexToLetter(c)}${r + 1}`;
                    const cell = currentSheet.cells[cellKey];
                    const isSelected = selectedCell.col === c && selectedCell.row === r;

                    const computedValue = cell ? evaluateFormula(cell.raw, currentSheet.cells) : '';

                    const style: React.CSSProperties = {
                      fontWeight: cell?.style?.bold ? 'bold' : 'normal',
                      fontStyle: cell?.style?.italic ? 'italic' : 'normal',
                      textAlign: cell?.style?.align || 'left',
                      color: cell?.style?.textColor || 'inherit',
                      backgroundColor: cell?.style?.bgColor || 'transparent'
                    };

                    return (
                      <td
                        key={c}
                        onClick={() => handleCellClick(c, r)}
                        onDoubleClick={() => {
                          setSelectedCell({ col: c, row: r });
                          setEditing(true);
                          setEditValue(cell?.raw || '');
                          setTimeout(() => inputRef.current?.focus(), 50);
                        }}
                        style={style}
                        className={`h-7 px-2 border border-[var(--border-color)] truncate relative cursor-default ${
                          isSelected ? 'outline-2 outline-emerald-500 bg-emerald-500/10 z-10' : 'hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        {isSelected && editing ? (
                          <input
                            ref={inputRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => {
                              updateCell(cellKey, editValue);
                              setEditing(false);
                            }}
                            className="absolute inset-0 w-full h-full px-2 bg-[var(--bg-surface)] text-[var(--text-main)] outline-hidden font-mono text-xs border border-emerald-500"
                            autoFocus
                          />
                        ) : (
                          <span>{computedValue !== undefined ? String(computedValue) : ''}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sheet Tabs Footer */}
      <div className="h-10 bg-[var(--bg-surface)] border-t border-[var(--border-color)] flex items-center justify-between px-3 shrink-0 text-xs">
        <div className="flex items-center gap-1 overflow-x-auto">
          {meta.sheets.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setActiveSheetIndex(idx)}
              className={`px-3 py-1 rounded-t-lg font-medium transition ${
                activeSheetIndex === idx
                  ? 'bg-[var(--bg-app)] text-emerald-500 border-t-2 border-emerald-500 font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5'
              }`}
            >
              {s.name}
            </button>
          ))}

          <button
            onClick={addSheet}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 rounded transition"
            title="Добавить лист"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="text-[10px] text-[var(--text-muted)] font-mono">
          {currentSheet.rowCount} строк × {currentSheet.colCount} столбцов
        </div>
      </div>

    </div>
  );
}
