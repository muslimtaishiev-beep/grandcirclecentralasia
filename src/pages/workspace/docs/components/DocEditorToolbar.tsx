import React from 'react';
import { Type, List, ListOrdered, CheckSquare, Quote, Code, Minus, Download, Check, Save } from 'lucide-react';
import { DocBlock } from '../../../../types/collab';

interface Props {
  onAddBlock: (type: DocBlock['type']) => void;
  onExport: () => void;
  saving: boolean;
}

export default function DocEditorToolbar({ onAddBlock, onExport, saving }: Props) {
  const tools = [
    { icon: <Type className="w-4 h-4" />, type: 'heading_2' as DocBlock['type'], title: 'Заголовок' },
    { icon: <List className="w-4 h-4" />, type: 'bullet_list' as DocBlock['type'], title: 'Список' },
    { icon: <ListOrdered className="w-4 h-4" />, type: 'numbered_list' as DocBlock['type'], title: 'Нумерованный список' },
    { icon: <CheckSquare className="w-4 h-4" />, type: 'todo_list' as DocBlock['type'], title: 'Чек-лист' },
    { icon: <Quote className="w-4 h-4" />, type: 'quote' as DocBlock['type'], title: 'Цитата' },
    { icon: <Code className="w-4 h-4" />, type: 'code_block' as DocBlock['type'], title: 'Код' },
    { icon: <Minus className="w-4 h-4" />, type: 'divider' as DocBlock['type'], title: 'Разделитель' },
  ];

  return (
    <div className="h-12 border-b border-[var(--border-color)] bg-[var(--bg-panel)] flex items-center justify-between px-4 sticky top-0 z-10">
      <div className="flex items-center gap-1">
        {tools.map(t => (
          <button
            key={t.title}
            onClick={() => onAddBlock(t.type)}
            title={t.title}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] rounded-md transition"
          >
            {t.icon}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)]">
          {saving ? (
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> Сохранение...</span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-500"><Check className="w-3.5 h-3.5" /> Сохранено в облаке</span>
          )}
        </div>
        <button 
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg text-sm font-bold text-[var(--text-main)] hover:bg-[var(--bg-app)] transition"
        >
          <Download className="w-4 h-4" /> Экспорт
        </button>
      </div>
    </div>
  );
}
