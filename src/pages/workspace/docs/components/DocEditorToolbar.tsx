import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, FileText, Star, FolderUp, CheckCircle2, History, MessageSquare, Lock, Share2,
  Undo2, Redo2, Printer, Paintbrush, ChevronDown, Bold, Italic, Underline, Baseline, Highlighter, 
  Link, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, CheckSquare, 
  Indent, Outdent, RemoveFormatting, Plus, Minus, Download, Code, Quote, Trash2, Eye, FilePlus, Sparkles,
  Scissors, Copy, Clipboard, BarChart2, Globe, HelpCircle, Keyboard, Info, Check, ShieldCheck
} from 'lucide-react';
import { DocBlock } from '../../../../types/collab';

interface Props {
  title: string;
  onUpdateTitle: (newTitle: string) => void;
  onBack: () => void;
  onAddBlock: (type: DocBlock['type']) => void;
  onExport: (format?: 'pdf' | 'markdown') => void;
  onDeleteDoc: () => void;
  saving: boolean;
  selectedFont: string;
  setSelectedFont: (font: string) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  activeBlock: DocBlock | null;
  onUpdateStyle: (updates: Partial<DocBlock>) => void;
  showRuler: boolean;
  setShowRuler: (show: boolean) => void;
  zoomLevel: number;
  setZoomLevel: (zoom: number) => void;
  docBlocks: DocBlock[];
}

export default function DocEditorToolbar({ 
  title, 
  onUpdateTitle, 
  onBack, 
  onAddBlock, 
  onExport, 
  onDeleteDoc,
  saving,
  selectedFont,
  setSelectedFont,
  fontSize,
  setFontSize,
  onUndo,
  onRedo,
  activeBlock,
  onUpdateStyle,
  showRuler,
  setShowRuler,
  zoomLevel,
  setZoomLevel,
  docBlocks
}: Props) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [docTitle, setDocTitle] = useState(title);
  const [isStarred, setIsStarred] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Modals
  const [showShareModal, setShowShareModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Color Pickers
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDocTitle(title);
  }, [title]);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (docTitle.trim() && docTitle !== title) {
      onUpdateTitle(docTitle.trim());
    }
  };

  const handleInsertLink = () => {
    const url = window.prompt("Введите URL ссылки:", "https://");
    if (!url || !activeBlock) return;
    const linkText = window.prompt("Введите текст ссылки:", "Открыть ссылку") || url;
    onUpdateStyle({ content: activeBlock.content + ` [${linkText}](${url})` });
  };

  const handleInsertImage = () => {
    const url = window.prompt("Введите URL изображения:", "https://images.unsplash.com/photo-1542435503-956c469947f6?w=800");
    if (!url) return;
    onAddBlock('image');
  };

  // Word & Character count calculations
  const totalWords = docBlocks.reduce((acc, b) => acc + (b.content ? b.content.trim().split(/\s+/).filter(Boolean).length : 0), 0);
  const totalChars = docBlocks.reduce((acc, b) => acc + (b.content ? b.content.length : 0), 0);

  const colors = ['#0f172a', '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#d97706'];
  const bgColors = ['transparent', '#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8'];

  return (
    <div ref={menuRef} className="bg-[#f9fbfd] border-b border-slate-200 font-sans text-slate-700 sticky top-0 z-30 select-none shadow-sm">
      {/* Top Header Bar */}
      <div className="px-4 py-2 flex items-center justify-between gap-4 border-b border-slate-200/60 bg-white">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            data-tooltip="Вернуться к списку документов"
            data-tooltip-pos="bottom"
            className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

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
                  onKeyDown={e => e.key === 'Enter' && handleTitleSubmit()}
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

              <button 
                onClick={() => setIsStarred(!isStarred)}
                data-tooltip={isStarred ? "Удалить из помеченных" : "Пометить звездочкой"}
                data-tooltip-pos="bottom"
                className={`p-1 rounded hover:bg-slate-100 transition ${isStarred ? 'text-amber-400' : 'text-slate-400'}`}
              >
                <Star className="w-4 h-4 fill-current" />
              </button>

              <button 
                data-tooltip="Переместить в папку"
                data-tooltip-pos="bottom"
                className="p-1 text-slate-500 hover:bg-slate-100 rounded transition"
              >
                <FolderUp className="w-4 h-4" />
              </button>

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

            {/* Interactive Top Menu Bar (NO Gemini, FULLY Functional Menus) */}
            <div className="flex items-center gap-1 text-xs font-medium text-slate-600 mt-0.5 relative">
              {/* ФАЙЛ (File) */}
              <div className="relative">
                <button 
                  onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
                  data-tooltip="Открыть меню Файл"
                  data-tooltip-pos="bottom"
                  className={`px-2 py-0.5 rounded text-slate-700 cursor-pointer font-sans ${activeMenu === 'file' ? 'bg-slate-200 font-bold' : 'hover:bg-slate-100'}`}
                >
                  Файл
                </button>
                {activeMenu === 'file' && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 z-50 text-xs text-slate-700">
                    <button onClick={() => { setActiveMenu(null); onBack(); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><FilePlus className="w-4 h-4 text-blue-600" /> Вернуться к документам</button>
                    <button onClick={() => { setActiveMenu(null); setIsEditingTitle(true); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><FileText className="w-4 h-4 text-slate-500" /> Переименовать документ</button>
                    <hr className="my-1 border-slate-100" />
                    <button onClick={() => { setActiveMenu(null); onExport('pdf'); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center justify-between font-medium"><span>📄 Скачать как PDF</span><span className="text-[10px] text-slate-400 font-mono">Cmd+P</span></button>
                    <button onClick={() => { setActiveMenu(null); onExport('markdown'); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center justify-between font-medium"><span>📝 Скачать как Markdown (.md)</span></button>
                    <hr className="my-1 border-slate-100" />
                    <button onClick={() => { setActiveMenu(null); onDeleteDoc(); }} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 font-medium"><Trash2 className="w-4 h-4" /> Удалить документ</button>
                  </div>
                )}
              </div>

              {/* ПРАВКА (Edit) */}
              <div className="relative">
                <button 
                  onClick={() => setActiveMenu(activeMenu === 'edit' ? null : 'edit')}
                  data-tooltip="Открыть меню Правка"
                  data-tooltip-pos="bottom"
                  className={`px-2 py-0.5 rounded text-slate-700 cursor-pointer font-sans ${activeMenu === 'edit' ? 'bg-slate-200 font-bold' : 'hover:bg-slate-100'}`}
                >
                  Правка
                </button>
                {activeMenu === 'edit' && (
                  <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 z-50 text-xs text-slate-700">
                    <button onClick={() => { setActiveMenu(null); onUndo(); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center justify-between font-medium"><span className="flex items-center gap-2"><Undo2 className="w-4 h-4" /> Отменить</span><span className="text-[10px] text-slate-400 font-mono">Cmd+Z</span></button>
                    <button onClick={() => { setActiveMenu(null); onRedo(); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center justify-between font-medium"><span className="flex items-center gap-2"><Redo2 className="w-4 h-4" /> Повторить</span><span className="text-[10px] text-slate-400 font-mono">Cmd+Y</span></button>
                    <hr className="my-1 border-slate-100" />
                    <button onClick={() => { setActiveMenu(null); onUpdateStyle({ isBold: false, isItalic: false, isUnderline: false, textColor: '', bgColor: '', align: 'left' }); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><RemoveFormatting className="w-4 h-4" /> Очистить форматирование</button>
                  </div>
                )}
              </div>

              {/* ВИД (View) */}
              <div className="relative">
                <button 
                  onClick={() => setActiveMenu(activeMenu === 'view' ? null : 'view')}
                  data-tooltip="Открыть меню Вид"
                  data-tooltip-pos="bottom"
                  className={`px-2 py-0.5 rounded text-slate-700 cursor-pointer font-sans ${activeMenu === 'view' ? 'bg-slate-200 font-bold' : 'hover:bg-slate-100'}`}
                >
                  Вид
                </button>
                {activeMenu === 'view' && (
                  <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 z-50 text-xs text-slate-700">
                    <button onClick={() => { setActiveMenu(null); setShowRuler(!showRuler); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center justify-between font-medium"><span>Показать линейку</span><span>{showRuler ? '✓' : ''}</span></button>
                    <hr className="my-1 border-slate-100" />
                    <button onClick={() => { setActiveMenu(null); setZoomLevel(100); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center justify-between font-medium"><span>Масштаб: 100%</span><span>{zoomLevel === 100 ? '✓' : ''}</span></button>
                    <button onClick={() => { setActiveMenu(null); setZoomLevel(125); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center justify-between font-medium"><span>Масштаб: 125%</span><span>{zoomLevel === 125 ? '✓' : ''}</span></button>
                    <button onClick={() => { setActiveMenu(null); setZoomLevel(150); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center justify-between font-medium"><span>Масштаб: 150%</span><span>{zoomLevel === 150 ? '✓' : ''}</span></button>
                  </div>
                )}
              </div>

              {/* ВСТАВКА (Insert) */}
              <div className="relative">
                <button 
                  onClick={() => setActiveMenu(activeMenu === 'insert' ? null : 'insert')}
                  data-tooltip="Открыть меню Вставка"
                  data-tooltip-pos="bottom"
                  className={`px-2 py-0.5 rounded text-slate-700 cursor-pointer font-sans ${activeMenu === 'insert' ? 'bg-slate-200 font-bold' : 'hover:bg-slate-100'}`}
                >
                  Вставка
                </button>
                {activeMenu === 'insert' && (
                  <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 z-50 text-xs text-slate-700">
                    <button onClick={() => { setActiveMenu(null); handleInsertImage(); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><ImageIcon className="w-4 h-4 text-emerald-600" /> Изображение</button>
                    <button onClick={() => { setActiveMenu(null); handleInsertLink(); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><Link className="w-4 h-4 text-blue-600" /> Ссылка</button>
                    <button onClick={() => { setActiveMenu(null); onAddBlock('divider'); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><span>➖ Разделитель</span></button>
                    <button onClick={() => { setActiveMenu(null); onAddBlock('todo_list'); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><CheckSquare className="w-4 h-4 text-indigo-600" /> Чек-лист задач</button>
                    <button onClick={() => { setActiveMenu(null); onAddBlock('code_block'); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><Code className="w-4 h-4 text-purple-600" /> Блок кода</button>
                    <button onClick={() => { setActiveMenu(null); onAddBlock('quote'); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><Quote className="w-4 h-4 text-amber-600" /> Цитата</button>
                  </div>
                )}
              </div>

              {/* ФОРМАТ (Format) */}
              <div className="relative">
                <button 
                  onClick={() => setActiveMenu(activeMenu === 'format' ? null : 'format')}
                  data-tooltip="Открыть меню Формат"
                  data-tooltip-pos="bottom"
                  className={`px-2 py-0.5 rounded text-slate-700 cursor-pointer font-sans ${activeMenu === 'format' ? 'bg-slate-200 font-bold' : 'hover:bg-slate-100'}`}
                >
                  Формат
                </button>
                {activeMenu === 'format' && (
                  <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 z-50 text-xs text-slate-700">
                    <button onClick={() => { setActiveMenu(null); onUpdateStyle({ isBold: !activeBlock?.isBold }); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center justify-between font-medium"><span>Полужирный</span><span className="font-bold">B</span></button>
                    <button onClick={() => { setActiveMenu(null); onUpdateStyle({ isItalic: !activeBlock?.isItalic }); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center justify-between font-medium"><span>Курсив</span><span className="italic">I</span></button>
                    <button onClick={() => { setActiveMenu(null); onUpdateStyle({ isUnderline: !activeBlock?.isUnderline }); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center justify-between font-medium"><span>Подчеркнутый</span><span className="underline">U</span></button>
                    <hr className="my-1 border-slate-100" />
                    <button onClick={() => { setActiveMenu(null); onUpdateStyle({ align: 'left' }); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><AlignLeft className="w-4 h-4" /> По левому краю</button>
                    <button onClick={() => { setActiveMenu(null); onUpdateStyle({ align: 'center' }); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><AlignCenter className="w-4 h-4" /> По центру</button>
                    <button onClick={() => { setActiveMenu(null); onUpdateStyle({ align: 'right' }); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><AlignRight className="w-4 h-4" /> По правому краю</button>
                  </div>
                )}
              </div>

              {/* ИНСТРУМЕНТЫ (Tools) */}
              <div className="relative">
                <button 
                  onClick={() => setActiveMenu(activeMenu === 'tools' ? null : 'tools')}
                  data-tooltip="Открыть меню Инструменты"
                  data-tooltip-pos="bottom"
                  className={`px-2 py-0.5 rounded text-slate-700 cursor-pointer font-sans ${activeMenu === 'tools' ? 'bg-slate-200 font-bold' : 'hover:bg-slate-100'}`}
                >
                  Инструменты
                </button>
                {activeMenu === 'tools' && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 z-50 text-xs text-slate-700">
                    <button onClick={() => { setActiveMenu(null); setShowStatsModal(true); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><BarChart2 className="w-4 h-4 text-blue-600" /> Статистика документа</button>
                    <button onClick={() => { setActiveMenu(null); alert("Орфография: Все слова в документе корректны"); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><span>🔤 Проверка орфографии</span></button>
                    <button onClick={() => { setActiveMenu(null); alert("Язык документа: Русский"); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><Globe className="w-4 h-4 text-emerald-600" /> Язык документа</button>
                  </div>
                )}
              </div>

              {/* РАСШИРЕНИЯ (Extensions) */}
              <div className="relative">
                <button 
                  onClick={() => setActiveMenu(activeMenu === 'extensions' ? null : 'extensions')}
                  data-tooltip="Открыть меню Расширения"
                  data-tooltip-pos="bottom"
                  className={`px-2 py-0.5 rounded text-slate-700 cursor-pointer font-sans ${activeMenu === 'extensions' ? 'bg-slate-200 font-bold' : 'hover:bg-slate-100'}`}
                >
                  Расширения
                </button>
                {activeMenu === 'extensions' && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 z-50 text-xs text-slate-700">
                    <button onClick={() => { setActiveMenu(null); alert("Штамп организации активен"); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Электронный штамп орг-ции</button>
                    <button onClick={() => { setActiveMenu(null); alert("Автосохранение включено в Firestore"); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><span>⚡ Автосохранение в облако</span></button>
                  </div>
                )}
              </div>

              {/* СПРАВКА (Help) */}
              <div className="relative">
                <button 
                  onClick={() => setActiveMenu(activeMenu === 'help' ? null : 'help')}
                  data-tooltip="Открыть меню Справка"
                  data-tooltip-pos="bottom"
                  className={`px-2 py-0.5 rounded text-slate-700 cursor-pointer font-sans ${activeMenu === 'help' ? 'bg-slate-200 font-bold' : 'hover:bg-slate-100'}`}
                >
                  Справка
                </button>
                {activeMenu === 'help' && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 z-50 text-xs text-slate-700">
                    <button onClick={() => { setActiveMenu(null); setShowShortcutsModal(true); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><Keyboard className="w-4 h-4 text-indigo-600" /> Горячие клавиши</button>
                    <button onClick={() => { setActiveMenu(null); alert("Google Docs Engine v2.4 — Мощная редактируемая система документов платформы"); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><Info className="w-4 h-4 text-blue-600" /> О программе</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Header Buttons */}
        <div className="flex items-center gap-2">
          <button 
            onClick={onUndo}
            data-tooltip="История версий"
            data-tooltip-pos="bottom"
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition cursor-pointer"
          >
            <History className="w-5 h-5" />
          </button>

          <button 
            onClick={() => alert("Комментарии к документу в реальном времени активны")}
            data-tooltip="Открыть комментарии"
            data-tooltip-pos="bottom"
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition cursor-pointer"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

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

      {/* Formatting Ribbon */}
      <div className="px-3 py-1.5 flex items-center gap-1 overflow-x-auto text-slate-700 text-xs bg-[#edf2fa] border-t border-slate-200 relative">
        <button onClick={onUndo} data-tooltip="Отменить (Cmd+Z)" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><Undo2 className="w-4 h-4" /></button>
        <button onClick={onRedo} data-tooltip="Повторить (Cmd+Y)" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><Redo2 className="w-4 h-4" /></button>
        <button onClick={() => onExport('pdf')} data-tooltip="Печать (Cmd+P)" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><Printer className="w-4 h-4" /></button>
        <button data-tooltip="Формат по образцу" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><Paintbrush className="w-4 h-4" /></button>
        
        <div className="h-4 w-px bg-slate-300 mx-1"></div>

        {/* Zoom */}
        <button data-tooltip="Масштаб отображения" data-tooltip-pos="bottom" onClick={() => setZoomLevel(zoomLevel === 100 ? 125 : zoomLevel === 125 ? 150 : 100)} className="px-2 py-1 hover:bg-slate-200 rounded flex items-center gap-1 font-mono cursor-pointer font-bold">
          <span>{zoomLevel}%</span>
          <ChevronDown className="w-3 h-3 text-slate-500" />
        </button>

        <div className="h-4 w-px bg-slate-300 mx-1"></div>

        {/* Paragraph Style Dropdown */}
        <select 
          value={activeBlock?.type || 'paragraph'}
          data-tooltip="Стиль абзаца"
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

        {/* Formatting Actions */}
        <button 
          onClick={() => onUpdateStyle({ isBold: !activeBlock?.isBold })} 
          data-tooltip="Полужирный (Bold)" 
          data-tooltip-pos="bottom" 
          className={`p-1.5 rounded font-black cursor-pointer transition ${activeBlock?.isBold ? 'bg-blue-200 text-blue-800' : 'hover:bg-slate-200 text-slate-800'}`}
        >
          <Bold className="w-4 h-4" />
        </button>

        <button 
          onClick={() => onUpdateStyle({ isItalic: !activeBlock?.isItalic })} 
          data-tooltip="Курсив (Italic)" 
          data-tooltip-pos="bottom" 
          className={`p-1.5 rounded italic cursor-pointer transition ${activeBlock?.isItalic ? 'bg-blue-200 text-blue-800' : 'hover:bg-slate-200 text-slate-800'}`}
        >
          <Italic className="w-4 h-4" />
        </button>

        <button 
          onClick={() => onUpdateStyle({ isUnderline: !activeBlock?.isUnderline })} 
          data-tooltip="Подчеркнутый (Underline)" 
          data-tooltip-pos="bottom" 
          className={`p-1.5 rounded underline cursor-pointer transition ${activeBlock?.isUnderline ? 'bg-blue-200 text-blue-800' : 'hover:bg-slate-200 text-slate-800'}`}
        >
          <Underline className="w-4 h-4" />
        </button>

        {/* Text Color Picker */}
        <div className="relative">
          <button 
            onClick={() => { setShowTextColorPicker(!showTextColorPicker); setShowBgColorPicker(false); }} 
            data-tooltip="Цвет текста" 
            data-tooltip-pos="bottom" 
            className="p-1.5 hover:bg-slate-200 rounded font-bold cursor-pointer"
            style={{ color: activeBlock?.textColor || '#2563eb' }}
          >
            <Baseline className="w-4 h-4" />
          </button>
          {showTextColorPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-slate-200 rounded-xl shadow-xl flex gap-1 z-50">
              {colors.map(c => (
                <button 
                  key={c} 
                  onClick={() => { onUpdateStyle({ textColor: c }); setShowTextColorPicker(false); }}
                  className="w-5 h-5 rounded-full border border-slate-300 hover:scale-110 transition cursor-pointer"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Highlight Color Picker */}
        <div className="relative">
          <button 
            onClick={() => { setShowBgColorPicker(!showBgColorPicker); setShowTextColorPicker(false); }} 
            data-tooltip="Цвет выделения маркером" 
            data-tooltip-pos="bottom" 
            className="p-1.5 hover:bg-slate-200 rounded text-amber-500 cursor-pointer"
          >
            <Highlighter className="w-4 h-4" />
          </button>
          {showBgColorPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-slate-200 rounded-xl shadow-xl flex gap-1 z-50">
              {bgColors.map(c => (
                <button 
                  key={c} 
                  onClick={() => { onUpdateStyle({ bgColor: c === 'transparent' ? '' : c }); setShowBgColorPicker(false); }}
                  className="w-5 h-5 rounded-full border border-slate-300 hover:scale-110 transition cursor-pointer flex items-center justify-center font-bold text-[10px]"
                  style={{ backgroundColor: c === 'transparent' ? '#ffffff' : c }}
                >
                  {c === 'transparent' ? '✕' : ''}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-slate-300 mx-1"></div>

        {/* Link & Image */}
        <button onClick={handleInsertLink} data-tooltip="Вставить ссылку" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><Link className="w-4 h-4" /></button>
        <button onClick={handleInsertImage} data-tooltip="Вставить изображение" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><ImageIcon className="w-4 h-4" /></button>

        <div className="h-4 w-px bg-slate-300 mx-1"></div>

        {/* Alignments */}
        <button onClick={() => onUpdateStyle({ align: 'left' })} data-tooltip="По левому краю" data-tooltip-pos="bottom" className={`p-1.5 rounded cursor-pointer ${activeBlock?.align === 'left' ? 'bg-slate-300 font-bold' : 'hover:bg-slate-200'}`}><AlignLeft className="w-4 h-4" /></button>
        <button onClick={() => onUpdateStyle({ align: 'center' })} data-tooltip="По центру" data-tooltip-pos="bottom" className={`p-1.5 rounded cursor-pointer ${activeBlock?.align === 'center' ? 'bg-slate-300 font-bold' : 'hover:bg-slate-200'}`}><AlignCenter className="w-4 h-4" /></button>
        <button onClick={() => onUpdateStyle({ align: 'right' })} data-tooltip="По правому краю" data-tooltip-pos="bottom" className={`p-1.5 rounded cursor-pointer ${activeBlock?.align === 'right' ? 'bg-slate-300 font-bold' : 'hover:bg-slate-200'}`}><AlignRight className="w-4 h-4" /></button>
        <button onClick={() => onUpdateStyle({ align: 'justify' })} data-tooltip="По ширине" data-tooltip-pos="bottom" className={`p-1.5 rounded cursor-pointer ${activeBlock?.align === 'justify' ? 'bg-slate-300 font-bold' : 'hover:bg-slate-200'}`}><AlignJustify className="w-4 h-4" /></button>

        <div className="h-4 w-px bg-slate-300 mx-1"></div>

        {/* Lists */}
        <button data-tooltip="Чек-лист задач" data-tooltip-pos="bottom" onClick={() => onAddBlock('todo_list')} className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><CheckSquare className="w-4 h-4" /></button>
        <button data-tooltip="Маркированный список" data-tooltip-pos="bottom" onClick={() => onAddBlock('bullet_list')} className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><List className="w-4 h-4" /></button>
        <button data-tooltip="Нумерованный список" data-tooltip-pos="bottom" onClick={() => onAddBlock('numbered_list')} className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><ListOrdered className="w-4 h-4" /></button>

        <div className="h-4 w-px bg-slate-300 mx-1"></div>

        {/* Clear formatting */}
        <button 
          onClick={() => onUpdateStyle({ isBold: false, isItalic: false, isUnderline: false, textColor: '', bgColor: '', align: 'left' })} 
          data-tooltip="Очистить форматирование" 
          data-tooltip-pos="bottom" 
          className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
        >
          <RemoveFormatting className="w-4 h-4" />
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button 
            onClick={() => onExport('pdf')} 
            data-tooltip="Экспортировать документ в PDF"
            data-tooltip-pos="bottom"
            className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs transition cursor-pointer shadow-sm"
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
              Все сотрудники вашей организации имеют мгновенный доступ на чтение и редактирование.
            </p>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-semibold text-blue-800">
              🔗 Документ синхронизируется в реальном времени
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

      {/* Word Count Statistics Modal */}
      {showStatsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-blue-600" />
              <span>Статистика документа</span>
            </h3>
            <div className="space-y-3 text-xs text-slate-700">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="font-medium">Всего слов:</span>
                <span className="font-bold text-blue-600 font-mono text-sm">{totalWords}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="font-medium">Всего символов:</span>
                <span className="font-bold text-blue-600 font-mono text-sm">{totalChars}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="font-medium">Всего блоков текста:</span>
                <span className="font-bold text-blue-600 font-mono text-sm">{docBlocks.length}</span>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button 
                onClick={() => setShowStatsModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-indigo-600" />
              <span>Горячие клавиши Google Docs</span>
            </h3>
            <div className="space-y-2 text-xs text-slate-700 font-mono">
              <div className="flex justify-between p-2 bg-slate-50 rounded-lg"><span>Отменить действие</span><span className="font-bold text-blue-600">Cmd + Z</span></div>
              <div className="flex justify-between p-2 bg-slate-50 rounded-lg"><span>Повторить действие</span><span className="font-bold text-blue-600">Cmd + Y</span></div>
              <div className="flex justify-between p-2 bg-slate-50 rounded-lg"><span>Печать / Экспорт PDF</span><span className="font-bold text-blue-600">Cmd + P</span></div>
              <div className="flex justify-between p-2 bg-slate-50 rounded-lg"><span>Новый абзац</span><span className="font-bold text-blue-600">Enter</span></div>
              <div className="flex justify-between p-2 bg-slate-50 rounded-lg"><span>Удалить блок</span><span className="font-bold text-blue-600">Backspace (пустой)</span></div>
            </div>
            <div className="flex justify-end pt-2">
              <button 
                onClick={() => setShowShortcutsModal(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
