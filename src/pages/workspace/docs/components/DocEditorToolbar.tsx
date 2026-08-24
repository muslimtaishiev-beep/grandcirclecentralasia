import React from 'react';
import { ArrowLeft, Type, List, ListOrdered, CheckSquare, Quote, Code, Minus, Download, Check, ShieldCheck, Lock } from 'lucide-react';
import { DocBlock } from '../../../../types/collab';

interface Props {
  onBack: () => void;
  onAddBlock: (type: DocBlock['type']) => void;
  onExport: () => void;
  saving: boolean;
}

export default function DocEditorToolbar({ onBack, onAddBlock, onExport, saving }: Props) {
  const tools = [
    { icon: <Type className="w-4 h-4" />, type: 'heading_2' as DocBlock['type'], title: 'Заголовок (Heading)' },
    { icon: <List className="w-4 h-4" />, type: 'bullet_list' as DocBlock['type'], title: 'Маркированный список' },
    { icon: <ListOrdered className="w-4 h-4" />, type: 'numbered_list' as DocBlock['type'], title: 'Нумерованный список' },
    { icon: <CheckSquare className="w-4 h-4" />, type: 'todo_list' as DocBlock['type'], title: 'Чек-лист задач' },
    { icon: <Quote className="w-4 h-4" />, type: 'quote' as DocBlock['type'], title: 'Цитата' },
    { icon: <Code className="w-4 h-4" />, type: 'code_block' as DocBlock['type'], title: 'Блок кода' },
    { icon: <Minus className="w-4 h-4" />, type: 'divider' as DocBlock['type'], title: 'Разделитель' },
  ];

  return (
    <div className="h-14 border-b border-[var(--border-color)] bg-[var(--bg-panel)] flex items-center justify-between px-4 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        {/* Exit Button */}
        <button 
          onClick={onBack}
          title="Выйти из документа в список документов"
          className="px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)] hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад к документам</span>
        </button>

        <div className="h-5 w-px bg-[var(--border-color)]"></div>

        {/* Toolbar formatting buttons */}
        <div className="flex items-center gap-1">
          {tools.map(t => (
            <button
              key={t.title}
              onClick={() => onAddBlock(t.type)}
              title={t.title}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] rounded-lg transition cursor-pointer"
            >
              {t.icon}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Access Control Badge */}
        <div 
          title="Контроль доступа: Документ доступен авторизованным сотрудникам организации"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-bold"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Доступ: Организация</span>
        </div>

        {/* Cloud saving indicator */}
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)]">
          {saving ? (
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> Сохранение...</span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-500" title="Автоматически сохранено в облаке Firestore"><Check className="w-3.5 h-3.5" /> Сохранено</span>
          )}
        </div>

        {/* Export Button */}
        <button 
          onClick={onExport}
          title="Скачать документ в PDF или Markdown"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white rounded-xl text-xs font-bold hover:brightness-110 transition shadow-sm cursor-pointer"
        >
          <Download className="w-4 h-4" /> Экспорт
        </button>
      </div>
    </div>
  );
}
