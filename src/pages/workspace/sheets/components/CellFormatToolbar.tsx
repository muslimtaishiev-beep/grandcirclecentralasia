import React from 'react';
import { ArrowLeft, Bold, Italic, AlignLeft, AlignCenter, AlignRight, DollarSign, Percent, Download } from 'lucide-react';

interface Props {
  onBack: () => void;
  onFormat: (updates: any) => void;
  onExport: () => void;
}

export default function CellFormatToolbar({ onBack, onFormat, onExport }: Props) {
  return (
    <div className="h-12 border-b border-[var(--border-color)] bg-[var(--bg-panel)] flex items-center justify-between px-3 sticky top-0 z-20">
      <div className="flex items-center gap-2">
        <button 
          onClick={onBack} 
          title="Выйти из таблицы к списку таблиц"
          className="px-2.5 py-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg text-xs font-bold text-[var(--text-main)] hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Назад к таблицам</span>
        </button>
        <div className="h-5 w-px bg-[var(--border-color)]"></div>
      </div>

      <div className="flex items-center gap-1 border-r border-[var(--border-color)] pr-2 mr-2">
        <button onClick={() => onFormat({ isBold: true })} title="Жирный текст (Bold)" className="p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)] cursor-pointer"><Bold className="w-4 h-4" /></button>
        <button onClick={() => onFormat({ isItalic: true })} title="Курсив (Italic)" className="p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)] cursor-pointer"><Italic className="w-4 h-4" /></button>
      </div>

      <div className="flex items-center gap-1 border-r border-[var(--border-color)] pr-2 mr-2">
        <button onClick={() => onFormat({ align: 'left' })} title="Выравнивание по левому краю" className="p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)] cursor-pointer"><AlignLeft className="w-4 h-4" /></button>
        <button onClick={() => onFormat({ align: 'center' })} title="Выравнивание по центру" className="p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)] cursor-pointer"><AlignCenter className="w-4 h-4" /></button>
        <button onClick={() => onFormat({ align: 'right' })} title="Выравнивание по правому краю" className="p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)] cursor-pointer"><AlignRight className="w-4 h-4" /></button>
      </div>

      <div className="flex items-center gap-1 flex-1">
        <button onClick={() => onFormat({ format: 'currency' })} title="Формат валюты (KGS)" className="p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)] cursor-pointer"><DollarSign className="w-4 h-4" /></button>
        <button onClick={() => onFormat({ format: 'percent' })} title="Процентный формат (%)" className="p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)] cursor-pointer"><Percent className="w-4 h-4" /></button>
      </div>

      <button onClick={onExport} title="Экспортировать таблицу в CSV" className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-sm hover:brightness-110 cursor-pointer">
        <Download className="w-3.5 h-3.5" /> CSV
      </button>
    </div>
  );
}
