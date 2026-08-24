import React from 'react';
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight, DollarSign, Percent, Download } from 'lucide-react';

interface Props {
  onFormat: (updates: any) => void;
  onExport: () => void;
}

export default function CellFormatToolbar({ onFormat, onExport }: Props) {
  return (
    <div className="h-12 border-b border-[var(--border-color)] bg-[var(--bg-panel)] flex items-center justify-between px-2 sticky top-0 z-20">
      <div className="flex items-center gap-1 border-r border-[var(--border-color)] pr-2 mr-2">
        <button onClick={() => onFormat({ isBold: true })} className="p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)]"><Bold className="w-4 h-4" /></button>
        <button onClick={() => onFormat({ isItalic: true })} className="p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)]"><Italic className="w-4 h-4" /></button>
      </div>

      <div className="flex items-center gap-1 border-r border-[var(--border-color)] pr-2 mr-2">
        <button onClick={() => onFormat({ align: 'left' })} className="p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)]"><AlignLeft className="w-4 h-4" /></button>
        <button onClick={() => onFormat({ align: 'center' })} className="p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)]"><AlignCenter className="w-4 h-4" /></button>
        <button onClick={() => onFormat({ align: 'right' })} className="p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)]"><AlignRight className="w-4 h-4" /></button>
      </div>

      <div className="flex items-center gap-1 flex-1">
        <button onClick={() => onFormat({ format: 'currency' })} className="p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)]"><DollarSign className="w-4 h-4" /></button>
        <button onClick={() => onFormat({ format: 'percent' })} className="p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)]"><Percent className="w-4 h-4" /></button>
      </div>

      <button onClick={onExport} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-bold shadow-sm hover:brightness-110">
        <Download className="w-4 h-4" /> CSV
      </button>
    </div>
  );
}
