import { ArrowLeft, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Percent, Download, Undo2, Redo2, RemoveFormatting, Hash, Rows3, Columns3, Trash2, Plus } from 'lucide-react';
import { CellStyle } from '../../../../types/collab';

interface Props {
  onBack: () => void;
  title: string;
  onTitleChange?: (t: string) => void;
  onFormat: (updates: Partial<CellStyle>) => void;
  /** Оформление активной ячейки — кнопки включаются и выключаются. */
  style?: CellStyle;
  onExport: () => void;
  readOnly?: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onRowAction: (kind: 'insert' | 'delete') => void;
  onColAction: (kind: 'insert' | 'delete') => void;
  onAddRows: () => void;
  onAddColumns: () => void;
}

const btn = 'p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)] cursor-pointer disabled:opacity-30 disabled:cursor-default';
const on = 'bg-[var(--accent)]/15 text-[var(--accent)]';

export default function CellFormatToolbar(p: Props) {
  const s = p.style || {};
  const ro = !!p.readOnly;
  const sep = <div className="h-5 w-px bg-[var(--border-color)] mx-1 shrink-0" />;
  return (
    <div className="min-h-12 border-b border-[var(--border-color)] bg-[var(--bg-panel)] flex items-center gap-1 px-3 py-1 overflow-x-auto shrink-0">
      <button onClick={p.onBack} title="К списку таблиц" className="px-2.5 py-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg text-xs font-bold text-[var(--text-main)] flex items-center gap-1 cursor-pointer shrink-0">
        <ArrowLeft className="w-3.5 h-3.5" /> Таблицы
      </button>
      <input
        defaultValue={p.title}
        key={p.title}
        readOnly={ro || !p.onTitleChange}
        onBlur={e => { const v = e.target.value.trim(); if (v && v !== p.title) p.onTitleChange?.(v); else e.target.value = p.title; }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="mx-2 w-44 bg-transparent text-sm font-semibold text-[var(--text-main)] border border-transparent hover:border-[var(--border-color)] focus:border-[var(--accent)] rounded px-2 py-1 focus:outline-none shrink-0"
      />
      {sep}
      <button onClick={p.onUndo} disabled={!p.canUndo || ro} title="Отменить" className={btn}><Undo2 className="w-4 h-4" /></button>
      <button onClick={p.onRedo} disabled={!p.canRedo || ro} title="Повторить" className={btn}><Redo2 className="w-4 h-4" /></button>
      {!ro && (<>
        {sep}
        <button onClick={() => p.onFormat({ isBold: !s.isBold })} title="Жирный" className={`${btn} ${s.isBold ? on : ''}`}><Bold className="w-4 h-4" /></button>
        <button onClick={() => p.onFormat({ isItalic: !s.isItalic })} title="Курсив" className={`${btn} ${s.isItalic ? on : ''}`}><Italic className="w-4 h-4" /></button>
        <button onClick={() => p.onFormat({ align: 'left' })} title="По левому краю" className={`${btn} ${s.align === 'left' ? on : ''}`}><AlignLeft className="w-4 h-4" /></button>
        <button onClick={() => p.onFormat({ align: 'center' })} title="По центру" className={`${btn} ${s.align === 'center' ? on : ''}`}><AlignCenter className="w-4 h-4" /></button>
        <button onClick={() => p.onFormat({ align: 'right' })} title="По правому краю" className={`${btn} ${s.align === 'right' ? on : ''}`}><AlignRight className="w-4 h-4" /></button>
        <button onClick={() => p.onFormat({ format: s.format === 'currency' ? 'text' : 'currency' })} title="Денежный формат" className={`${btn} ${s.format === 'currency' ? on : ''}`}><Hash className="w-4 h-4" /></button>
        <button onClick={() => p.onFormat({ format: s.format === 'percent' ? 'text' : 'percent' })} title="Проценты" className={`${btn} ${s.format === 'percent' ? on : ''}`}><Percent className="w-4 h-4" /></button>
        <button onClick={() => p.onFormat({ isBold: false, isItalic: false, align: 'left', format: 'text', textColor: '', backgroundColor: '' })} title="Снять оформление" className={btn}><RemoveFormatting className="w-4 h-4" /></button>
        {sep}
        <button onClick={() => p.onRowAction('insert')} title="Вставить строку выше" className={`${btn} flex items-center gap-0.5`}><Rows3 className="w-4 h-4" /><Plus className="w-3 h-3" /></button>
        <button onClick={() => p.onRowAction('delete')} title="Удалить строку" className={`${btn} flex items-center gap-0.5`}><Rows3 className="w-4 h-4" /><Trash2 className="w-3 h-3" /></button>
        <button onClick={() => p.onColAction('insert')} title="Вставить колонку слева" className={`${btn} flex items-center gap-0.5`}><Columns3 className="w-4 h-4" /><Plus className="w-3 h-3" /></button>
        <button onClick={() => p.onColAction('delete')} title="Удалить колонку" className={`${btn} flex items-center gap-0.5`}><Columns3 className="w-4 h-4" /><Trash2 className="w-3 h-3" /></button>
        <button onClick={p.onAddRows} title="Добавить 20 строк в конец" className="px-2 py-1 text-xs font-semibold hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)] cursor-pointer whitespace-nowrap">+ 20 строк</button>
        <button onClick={p.onAddColumns} title="Добавить 5 колонок" className="px-2 py-1 text-xs font-semibold hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)] cursor-pointer whitespace-nowrap">+ 5 колонок</button>
      </>)}
      <div className="flex-1" />
      <button onClick={p.onExport} title="Скачать CSV" className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:brightness-110 cursor-pointer shrink-0">
        <Download className="w-3.5 h-3.5" /> CSV
      </button>
    </div>
  );
}
