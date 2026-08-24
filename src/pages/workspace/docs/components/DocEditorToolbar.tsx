import React, { useState } from 'react';
import { 
  ArrowLeft, FileText, Star, FolderUp, CheckCircle2, History, MessageSquare, Lock, Share2,
  Undo2, Redo2, Printer, Paintbrush, ChevronDown, Bold, Italic, Underline, Baseline, Highlighter, 
  Link, Image, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, CheckSquare, 
  Indent, Outdent, RemoveFormatting, Plus, Minus, Download, Code, Quote, Sparkles
} from 'lucide-react';
import { DocBlock } from '../../../../types/collab';

interface Props {
  title: string;
  onUpdateTitle: (newTitle: string) => void;
  onBack: () => void;
  onAddBlock: (type: DocBlock['type']) => void;
  onExport: () => void;
  saving: boolean;
  selectedFont: string;
  setSelectedFont: (font: string) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
}

export default function DocEditorToolbar({ 
  title, 
  onUpdateTitle, 
  onBack, 
  onAddBlock, 
  onExport, 
  saving,
  selectedFont,
  setSelectedFont,
  fontSize,
  setFontSize
}: Props) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [docTitle, setDocTitle] = useState(title);
  const [isStarred, setIsStarred] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Sync title prop changes
  React.useEffect(() => {
    setDocTitle(title);
  }, [title]);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (docTitle.trim() && docTitle !== title) {
      onUpdateTitle(docTitle.trim());
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    }
  };

  return (
    <div className="bg-[#f9fbfd] border-b border-slate-200 font-sans text-slate-700 sticky top-0 z-30 select-none shadow-sm">
      {/* Top Header Bar (Google Docs Title & Menu) */}
      <div className="px-4 py-2 flex items-center justify-between gap-4 border-b border-slate-200/60 bg-white">
        <div className="flex items-center gap-3">
          {/* Back Button */}
          <button 
            onClick={onBack}
            data-tooltip="Вернуться к списку документов"
            data-tooltip-pos="bottom"
            className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Docs Blue Icon */}
          <div 
            data-tooltip="Документ Google Docs" 
            data-tooltip-pos="bottom"
            className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm shrink-0"
          >
            <FileText className="w-5 h-5" />
          </div>

          <div className="flex flex-col">
            {/* Inline Title Editor */}
            <div className="flex items-center gap-2">
              {isEditingTitle ? (
                <input 
                  type="text" 
                  autoFocus
                  value={docTitle}
                  onChange={e => setDocTitle(e.target.value)}
                  onBlur={handleTitleSubmit}
                  onKeyDown={handleTitleKeyDown}
                  className="text-lg font-semibold text-slate-900 bg-white border border-blue-500 rounded px-2 py-0.5 outline-none shadow-sm font-sans"
                />
              ) : (
                <h1 
                  onClick={() => setIsEditingTitle(true)}
                  data-tooltip="Нажмите, чтобы переименовать документ"
                  data-tooltip-pos="bottom"
                  className="text-lg font-semibold text-slate-800 hover:bg-slate-100 px-2 py-0.5 rounded cursor-pointer transition border border-transparent hover:border-slate-300"
                >
                  {docTitle || 'Устав Ноуп Лабс'}
                </h1>
              )}

              {/* Star / Favorites Button */}
              <button 
                onClick={() => setIsStarred(!isStarred)}
                data-tooltip={isStarred ? "Удалить из помеченных" : "Пометить звездочкой"}
                data-tooltip-pos="bottom"
                className={`p-1 rounded hover:bg-slate-100 transition ${isStarred ? 'text-amber-400' : 'text-slate-400'}`}
              >
                <Star className="w-4 h-4 fill-current" />
              </button>

              {/* Folder Move Button */}
              <button 
                data-tooltip="Переместить в папку"
                data-tooltip-pos="bottom"
                className="p-1 text-slate-500 hover:bg-slate-100 rounded transition"
              >
                <FolderUp className="w-4 h-4" />
              </button>

              {/* Cloud Save Status */}
              <div 
                data-tooltip="Документ автоматически сохранен в облаке" 
                data-tooltip-pos="bottom"
                className="flex items-center gap-1 text-xs text-slate-500 ml-1 font-medium"
              >
                {saving ? (
                  <span className="flex items-center gap-1.5 text-amber-600 font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span> Сохранение...
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Сохранено на Диске</span>
                  </span>
                )}
              </div>
            </div>

            {/* Menu Bar (File, Edit, View, etc.) */}
            <div className="flex items-center gap-1 text-xs font-medium text-slate-600 mt-0.5">
              {['Файл', 'Правка', 'Вид', 'Вставка', 'Формат', 'Инструменты', 'Gemini', 'Расширения', 'Справка'].map(menu => (
                <button 
                  key={menu} 
                  data-tooltip={`Меню: ${menu}`}
                  data-tooltip-pos="bottom"
                  className="px-2 py-0.5 hover:bg-slate-100 rounded text-slate-700 cursor-pointer font-sans"
                >
                  {menu}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Header Buttons */}
        <div className="flex items-center gap-2">
          {/* History */}
          <button 
            data-tooltip="История версий"
            data-tooltip-pos="bottom"
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition cursor-pointer"
          >
            <History className="w-5 h-5" />
          </button>

          {/* Comments */}
          <button 
            data-tooltip="Открыть комментарии"
            data-tooltip-pos="bottom"
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition cursor-pointer"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          {/* Share Button (Google Docs Blue Pill) */}
          <button 
            onClick={() => setShowShareModal(true)}
            data-tooltip="Настройки совместного доступа"
            data-tooltip-pos="bottom"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-xs shadow-md transition flex items-center gap-2 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Настройки доступа</span>
          </button>
        </div>
      </div>

      {/* Formatting Toolbar (Google Docs Word Processor Ribbon) */}
      <div className="px-3 py-1.5 flex items-center gap-1 overflow-x-auto text-slate-700 text-xs bg-[#edf2fa] border-t border-slate-200">
        {/* Undo / Redo */}
        <button data-tooltip="Отменить (Cmd+Z)" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><Undo2 className="w-4 h-4" /></button>
        <button data-tooltip="Повторить (Cmd+Y)" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><Redo2 className="w-4 h-4" /></button>
        <button data-tooltip="Печать (Cmd+P)" data-tooltip-pos="bottom" onClick={onExport} className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><Printer className="w-4 h-4" /></button>
        <button data-tooltip="Формат по образцу" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><Paintbrush className="w-4 h-4" /></button>
        
        <div className="h-4 w-px bg-slate-300 mx-1"></div>

        {/* Zoom */}
        <button data-tooltip="Масштаб отображения" data-tooltip-pos="bottom" className="px-2 py-1 hover:bg-slate-200 rounded flex items-center gap-1 font-mono cursor-pointer">
          <span>100%</span>
          <ChevronDown className="w-3 h-3 text-slate-500" />
        </button>

        <div className="h-4 w-px bg-slate-300 mx-1"></div>

        {/* Paragraph Style Dropdown */}
        <select 
          data-tooltip="Стиль форматирования"
          data-tooltip-pos="bottom"
          onChange={e => onAddBlock(e.target.value as DocBlock['type'])}
          className="bg-transparent hover:bg-slate-200 border-none rounded px-2 py-1 text-slate-800 font-semibold cursor-pointer outline-none font-sans"
        >
          <option value="paragraph">Обычный текст</option>
          <option value="heading_1">Заголовок 1</option>
          <option value="heading_2">Заголовок 2</option>
          <option value="heading_3">Заголовок 3</option>
          <option value="quote">Цитата</option>
          <option value="code_block">Блок кода</option>
        </select>

        <div className="h-4 w-px bg-slate-300 mx-1"></div>

        {/* Font Family Dropdown */}
        <select 
          value={selectedFont}
          onChange={e => setSelectedFont(e.target.value)}
          data-tooltip="Шрифт документа"
          data-tooltip-pos="bottom"
          className="bg-transparent hover:bg-slate-200 border-none rounded px-2 py-1 text-slate-800 font-semibold cursor-pointer outline-none font-sans"
        >
          <option value="Verdana">Verdana</option>
          <option value="Inter">Inter</option>
          <option value="Roboto">Roboto</option>
          <option value="Georgia">Georgia</option>
          <option value="JetBrains Mono">JetBrains Mono</option>
        </select>

        <div className="h-4 w-px bg-slate-300 mx-1"></div>

        {/* Font Size controls */}
        <div className="flex items-center border border-slate-300 rounded bg-white overflow-hidden">
          <button data-tooltip="Уменьшить шрифт" data-tooltip-pos="bottom" onClick={() => setFontSize(Math.max(6, fontSize - 1))} className="px-1.5 py-0.5 hover:bg-slate-100 text-slate-600 font-bold"><Minus className="w-3 h-3" /></button>
          <span className="px-2 py-0.5 text-xs font-mono font-bold text-slate-800">{fontSize}</span>
          <button data-tooltip="Увеличить шрифт" data-tooltip-pos="bottom" onClick={() => setFontSize(fontSize + 1)} className="px-1.5 py-0.5 hover:bg-slate-100 text-slate-600 font-bold"><Plus className="w-3 h-3" /></button>
        </div>

        <div className="h-4 w-px bg-slate-300 mx-1"></div>

        {/* Formatting Actions (Bold, Italic, Underline, Color) */}
        <button data-tooltip="Полужирный (Bold)" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded font-black text-slate-800 cursor-pointer"><Bold className="w-4 h-4" /></button>
        <button data-tooltip="Курсив (Italic)" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded italic text-slate-800 cursor-pointer"><Italic className="w-4 h-4" /></button>
        <button data-tooltip="Подчеркнутый (Underline)" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded underline text-slate-800 cursor-pointer"><Underline className="w-4 h-4" /></button>
        <button data-tooltip="Цвет текста" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-blue-600 font-bold cursor-pointer"><Baseline className="w-4 h-4" /></button>
        <button data-tooltip="Цвет выделения" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-amber-500 cursor-pointer"><Highlighter className="w-4 h-4" /></button>

        <div className="h-4 w-px bg-slate-300 mx-1"></div>

        {/* Insert Link & Image */}
        <button data-tooltip="Вставить ссылку" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><Link className="w-4 h-4" /></button>
        <button data-tooltip="Вставить изображение" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><Image className="w-4 h-4" /></button>

        <div className="h-4 w-px bg-slate-300 mx-1"></div>

        {/* Alignments */}
        <button data-tooltip="По левому краю" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><AlignLeft className="w-4 h-4" /></button>
        <button data-tooltip="По центру" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><AlignCenter className="w-4 h-4" /></button>
        <button data-tooltip="По правому краю" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><AlignRight className="w-4 h-4" /></button>
        <button data-tooltip="По ширине" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><AlignJustify className="w-4 h-4" /></button>

        <div className="h-4 w-px bg-slate-300 mx-1"></div>

        {/* Lists */}
        <button data-tooltip="Чек-лист задач" data-tooltip-pos="bottom" onClick={() => onAddBlock('todo_list')} className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><CheckSquare className="w-4 h-4" /></button>
        <button data-tooltip="Маркированный список" data-tooltip-pos="bottom" onClick={() => onAddBlock('bullet_list')} className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><List className="w-4 h-4" /></button>
        <button data-tooltip="Нумерованный список" data-tooltip-pos="bottom" onClick={() => onAddBlock('numbered_list')} className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><ListOrdered className="w-4 h-4" /></button>

        <div className="h-4 w-px bg-slate-300 mx-1"></div>

        {/* Indents & Formatting */}
        <button data-tooltip="Уменьшить отступ" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><Outdent className="w-4 h-4" /></button>
        <button data-tooltip="Увеличить отступ" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><Indent className="w-4 h-4" /></button>
        <button data-tooltip="Очистить форматирование" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><RemoveFormatting className="w-4 h-4" /></button>

        <div className="ml-auto flex items-center gap-2">
          <button 
            onClick={onExport} 
            data-tooltip="Экспортировать документ"
            data-tooltip-pos="bottom"
            className="flex items-center gap-1 px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold text-xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Скачать
          </button>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <Share2 className="w-5 h-5 text-blue-600" />
              <span>Совместный доступ к документу</span>
            </h3>
            <p className="text-xs text-slate-600">
              Все сотрудники вашей организации в системе имеют доступ на чтение и редактирование.
            </p>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-semibold text-blue-800">
              🔗 Ссылка доступна для команды организации
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button 
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
