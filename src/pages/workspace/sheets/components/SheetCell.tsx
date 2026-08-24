import React, { useState, useEffect, useRef } from 'react';
import { SheetCellData } from '../../../../types/collab';

interface Props {
  id: string;
  data?: SheetCellData;
  isActive: boolean;
  isEditing: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onChange: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export default function SheetCell({ id, data, isActive, isEditing, onClick, onDoubleClick, onChange, onKeyDown }: Props) {
  const [editVal, setEditVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && isActive) {
      setEditVal(data?.rawValue || '');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isEditing, isActive, data]);

  const displayVal = data?.computedValue || data?.rawValue || '';
  let formattedVal = displayVal;
  
  if (data?.style?.format === 'currency' && !isNaN(Number(displayVal))) {
    formattedVal = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD' }).format(Number(displayVal));
  } else if (data?.style?.format === 'percent' && !isNaN(Number(displayVal))) {
    formattedVal = `${Number(displayVal)}%`;
  }

  let styleObj: React.CSSProperties = {
    fontWeight: data?.style?.isBold ? 'bold' : 'normal',
    fontStyle: data?.style?.isItalic ? 'italic' : 'normal',
    textAlign: data?.style?.align || 'left',
    color: data?.style?.textColor || 'inherit',
    backgroundColor: data?.style?.backgroundColor || 'transparent'
  };

  return (
    <div 
      className={`border-r border-b border-[var(--border-color)] relative select-none ${isActive ? 'outline outline-2 outline-emerald-500 z-10 bg-emerald-50 dark:bg-emerald-900/20' : 'bg-transparent hover:bg-[var(--bg-surface)]'}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={{ minWidth: 100 }} // Assuming default width
    >
      {isEditing && isActive ? (
        <input 
          ref={inputRef}
          type="text"
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => onChange(editVal)}
          className="absolute inset-0 w-full h-full p-1 bg-white dark:bg-slate-800 outline-none text-sm font-mono z-20"
        />
      ) : (
        <div className="w-full h-full p-1 text-sm overflow-hidden whitespace-nowrap text-ellipsis" style={styleObj}>
          {formattedVal}
        </div>
      )}
    </div>
  );
}
