import React, { useState, useEffect } from 'react';
import { FunctionSquare } from 'lucide-react';
import { SheetCellData } from '../../../../types/collab';

interface Props {
  activeCell: string | null;
  activeCellData?: SheetCellData;
  onChange: (val: string) => void;
  onEnter: () => void;
}

export default function FormulaBar({ activeCell, activeCellData, onChange, onEnter }: Props) {
  const [val, setVal] = useState('');

  useEffect(() => {
    setVal(activeCellData?.rawValue || '');
  }, [activeCell, activeCellData]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onEnter();
    }
  };

  return (
    <div className="h-10 border-b border-[var(--border-color)] bg-[var(--bg-panel)] flex items-center px-2 sticky top-[48px] z-10 gap-2">
      <div className="w-12 h-6 flex items-center justify-center border border-[var(--border-color)] bg-[var(--bg-surface)] text-xs font-bold rounded">
        {activeCell || ''}
      </div>
      <div className="w-6 h-6 flex items-center justify-center text-[var(--text-muted)] shrink-0 border-r border-[var(--border-color)] pr-2">
        <FunctionSquare className="w-4 h-4" />
      </div>
      <input 
        type="text"
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          onChange(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Введите значение или формулу (напр. =SUM(A1:A5))"
        className="flex-1 bg-transparent h-full text-sm font-mono focus:outline-none placeholder-[var(--text-muted)] px-2"
        disabled={!activeCell}
      />
    </div>
  );
}
