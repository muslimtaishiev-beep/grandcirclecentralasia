import React, { useState, useEffect, useRef } from 'react';
import { FunctionSquare } from 'lucide-react';
import { SheetCellData } from '../../../../types/collab';

interface Props {
  activeCell: string | null;
  activeCellData?: SheetCellData;
  readOnly?: boolean;
  /** Вызывается один раз — по Enter или при уходе из поля, а не на каждую букву. */
  onChange: (val: string) => void;
  onEnter: () => void;
}

export default function FormulaBar({ activeCell, activeCellData, readOnly, onChange, onEnter }: Props) {
  const [val, setVal] = useState('');
  const focused = useRef(false);
  const raw = activeCellData?.rawValue || '';

  // Пока человек печатает здесь, чужие правки поле не перезаписывают.
  useEffect(() => { if (!focused.current) setVal(raw); }, [activeCell, raw]);

  const commit = () => { if (val !== raw) onChange(val); };

  return (
    <div className="h-10 border-b border-[var(--border-color)] bg-[var(--bg-panel)] flex items-center px-2 gap-2 shrink-0">
      <div className="min-w-12 h-6 px-1 flex items-center justify-center border border-[var(--border-color)] bg-[var(--bg-surface)] text-xs font-bold rounded">
        {activeCell || ''}
      </div>
      <div className="w-6 h-6 flex items-center justify-center text-[var(--text-muted)] shrink-0 border-r border-[var(--border-color)] pr-2">
        <FunctionSquare className="w-4 h-4" />
      </div>
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; commit(); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); onEnter(); }
          else if (e.key === 'Escape') { setVal(raw); (e.target as HTMLInputElement).blur(); }
        }}
        placeholder="Значение или формула, например =SUM(A1:A5)"
        className="flex-1 bg-transparent h-full text-sm font-mono focus:outline-none placeholder-[var(--text-muted)] px-2"
        disabled={!activeCell || readOnly}
      />
    </div>
  );
}
