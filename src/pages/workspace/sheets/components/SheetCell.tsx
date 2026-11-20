import React, { useState, useEffect, useRef } from 'react';
import { SheetCellData } from '../../../../types/collab';

interface Props {
  id: string;
  data?: SheetCellData;
  readOnly?: boolean;
  isActive: boolean;
  isEditing: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onChange: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export default function SheetCell({ id, data, readOnly, isActive, isEditing, onClick, onDoubleClick, onChange, onKeyDown }: Props) {
  const [editVal, setEditVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Значение для правки берём один раз — при входе в правку. Правка коллеги
  // в этой же ячейке не должна затирать то, что человек уже печатает.
  const rawRef = useRef('');
  const doneRef = useRef(false);
  const commit = () => { if (doneRef.current) return; doneRef.current = true; onChange(editVal); };
  rawRef.current = data?.rawValue || '';
  useEffect(() => {
    if (isEditing && isActive && !readOnly) {
      doneRef.current = false;
      setEditVal(rawRef.current);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isEditing, isActive, readOnly]);

  const displayVal = data?.computedValue || data?.rawValue || '';
  let formattedVal = displayVal;
  
  if (data?.style?.format === 'currency' && displayVal !== '' && !isNaN(Number(displayVal))) {
    formattedVal = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(displayVal));
  } else if (data?.style?.format === 'percent' && displayVal !== '' && !isNaN(Number(displayVal))) {
    formattedVal = `${Number(displayVal)}%`;
  }

  let styleObj: React.CSSProperties = {
    fontWeight: data?.style?.isBold ? 'bold' : 'normal',
    fontStyle: data?.style?.isItalic ? 'italic' : 'normal',
    textAlign: data?.style?.align || 'left',
    // Цвет текста берём из темы, а не наследуем: без этого содержимое
    // ячеек тонуло в тёмном фоне листа и читалось с трудом.
    color: data?.style?.textColor || 'var(--text-main)',
    backgroundColor: data?.style?.backgroundColor || 'transparent'
  };

  return (
    <div 
      className={`border-r border-b border-[var(--border-color)] relative select-none ${isActive ? 'outline outline-2 outline-emerald-500 z-10 bg-emerald-500/10' : 'hover:bg-emerald-500/5'}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={{ minWidth: 100 }} // Assuming default width
    >
      {isEditing && isActive && !readOnly ? (
        <input 
          ref={inputRef}
          type="text"
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') { doneRef.current = true; onChange(rawRef.current); return; }
            if (e.key === 'Enter' || e.key === 'Tab') { commit(); }
            onKeyDown(e);
          }}
          onBlur={commit}
          className="absolute inset-0 w-full h-full px-2 bg-[var(--bg-surface)] text-[var(--text-main)] outline outline-2 outline-emerald-500 text-sm font-mono z-20"
        />
      ) : (
        <div className="w-full h-full px-2 py-1 text-[13px] leading-5 overflow-hidden whitespace-nowrap text-ellipsis" style={styleObj}>
          {formattedVal}
        </div>
      )}
    </div>
  );
}
