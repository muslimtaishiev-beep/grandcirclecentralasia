import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, FileText, Star, FolderUp, CheckCircle2, History, MessageSquare, Lock, Share2,
  Undo2, Redo2, Printer, Paintbrush, ChevronDown, Bold, Italic, Underline, Baseline, Highlighter, 
  Link, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, CheckSquare, 
  Indent, Outdent, RemoveFormatting, Plus, Minus, Download, Code, Quote, Trash2, Eye, FilePlus, Sparkles,
  Scissors, Copy, Clipboard, BarChart2, Globe, HelpCircle, Keyboard, Info, Check, ShieldCheck, UserCheck, Users, Edit3
} from 'lucide-react';
import { db } from '../../../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { DocBlock, DocAccessLevel, UserDocRole, WorkspaceDocument } from '../../../../types/collab';

interface Props {
  doc: WorkspaceDocument;
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
  isAuthor: boolean;
  isFullAdmin: boolean;
  onUpdateAccess: (accessLevel: DocAccessLevel, permissionsMap: Record<string, UserDocRole>) => void;
}

export default function DocEditorToolbar({ 
  doc: currentDoc,
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
  docBlocks,
  isAuthor,
  isFullAdmin,
  onUpdateAccess
}: Props) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [docTitle, setDocTitle] = useState(title);
  const [isStarred, setIsStarred] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Access Control Modal State
  const [showShareModal, setShowShareModal] = useState(false);
  const [accessLevel, setAccessLevel] = useState<DocAccessLevel>(currentDoc.accessLevel || 'private');
  const [permissionsMap, setPermissionsMap] = useState<Record<string, UserDocRole>>(currentDoc.permissionsMap || {});
  const [staffList, setStaffList] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserDocRole>('editor');

  // Modals
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Color Pickers
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDocTitle(title);
  }, [title]);

  useEffect(() => {
    setAccessLevel(currentDoc.accessLevel || 'private');
    setPermissionsMap(currentDoc.permissionsMap || {});
  }, [currentDoc]);

  useEffect(() => {
    if (!showShareModal || !currentDoc.tenantId) return;
    const q = query(collection(db, 'crm_contacts'), where('tenantId', '==', currentDoc.tenantId));
    const unsub = onSnapshot(q, (snap) => {
      const list: Array<{ id: string; name: string; email: string }> = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({ id: d.id, name: data.fullName || data.name || 'Сотрудник', email: data.email || '' });
      });
      setStaffList(list);
      if (list.length > 0 && !selectedStaffId) setSelectedStaffId(list[0].id);
    });
    return () => unsub();
  }, [showShareModal, currentDoc.tenantId]);

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

  // Helper to execute formatting on highlighted text range or current cursor
  const execFormat = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    // Also trigger block update if active block is present
    if (activeBlock) {
      const el = document.getElementById(`block-${activeBlock.id}`);
      if (el) {
        onUpdateStyle({ content: el.innerHTML });
      }
    }
  };

  const handleAddUserPermission = () => {
    if (!selectedStaffId) return;
    const updated = { ...permissionsMap, [selectedStaffId]: selectedRole };
    setPermissionsMap(updated);
  };

  const handleRemoveUserPermission = (staffId: string) => {
    const updated = { ...permissionsMap };
    delete updated[staffId];
    setPermissionsMap(updated);
  };

  const handleSaveAccess = () => {
    onUpdateAccess(accessLevel, permissionsMap);
    setShowShareModal(false);
  };

  const handleInsertStamp = (stampType: 'round' | 'corner' | 'signature' | 'logo') => {
    let imgUrl = '/stamp.png';
    if (stampType === 'corner') imgUrl = '/corner_stamp.png';
    else if (stampType === 'logo') imgUrl = '/school_logo.png';
    else if (stampType === 'signature') imgUrl = 'https://upload.wikimedia.org/wikipedia/commons/f/fa/John_Hancock_signature.svg'; // Director Facsimile Signature SVG

    execFormat('insertImage', imgUrl);
  };

  const handleInsertLink = () => {
    const url = window.prompt("Введите URL ссылки:", "https://");
    if (!url) return;
    execFormat('createLink', url);
  };

  const handleInsertImage = () => {
    const url = window.prompt("Введите URL изображения:", "https://images.unsplash.com/photo-1542435503-956c469947f6?w=800");
    if (!url) return;
    onAddBlock('image');
  };

  const totalWords = docBlocks.reduce((acc, b) => acc + (b.content ? b.content.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length : 0), 0);
  const totalChars = docBlocks.reduce((acc, b) => acc + (b.content ? b.content.replace(/<[^>]*>/g, '').length : 0), 0);

  const colors = ['#0f172a', '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#d97706'];
  const bgColors = ['transparent', '#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8'];

  const canManageAccess = isAuthor || isFullAdmin;

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
            <div className="flex items-center gap-2">
              {isEditingTitle && canManageAccess ? (
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
                  onClick={() => canManageAccess && setIsEditingTitle(true)}
                  data-tooltip={canManageAccess ? "Нажмите, чтобы переименовать документ" : "Название документа"}
                  data-tooltip-pos="bottom"
                  className={`text-lg font-semibold text-slate-800 px-2 py-0.5 rounded transition border border-transparent ${canManageAccess ? 'hover:bg-slate-100 cursor-pointer hover:border-slate-300' : ''}`}
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

            {/* Menu Bar */}
            <div className="flex items-center gap-1 text-xs font-medium text-slate-600 mt-0.5 relative">
              <div className="relative">
                <button onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')} className={`px-2 py-0.5 rounded text-slate-700 cursor-pointer font-sans ${activeMenu === 'file' ? 'bg-slate-200 font-bold' : 'hover:bg-slate-100'}`}>Файл</button>
                {activeMenu === 'file' && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 z-50 text-xs text-slate-700">
                    <button onClick={() => { setActiveMenu(null); onBack(); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><FilePlus className="w-4 h-4 text-blue-600" /> Вернуться к документам</button>
                    {canManageAccess && <button onClick={() => { setActiveMenu(null); setIsEditingTitle(true); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><FileText className="w-4 h-4 text-slate-500" /> Переименовать документ</button>}
                    <hr className="my-1 border-slate-100" />
                    <button onClick={() => { setActiveMenu(null); onExport('pdf'); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center justify-between font-medium"><span>📄 Скачать как PDF</span><span className="text-[10px] text-slate-400 font-mono">Cmd+P</span></button>
                    <button onClick={() => { setActiveMenu(null); onExport('markdown'); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center justify-between font-medium"><span>📝 Скачать как Markdown (.md)</span></button>
                    {canManageAccess && <>
                      <hr className="my-1 border-slate-100" />
                      <button onClick={() => { setActiveMenu(null); onDeleteDoc(); }} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 font-medium"><Trash2 className="w-4 h-4" /> Удалить документ</button>
                    </>}
                  </div>
                )}
              </div>

              <div className="relative">
                <button onClick={() => setActiveMenu(activeMenu === 'edit' ? null : 'edit')} className={`px-2 py-0.5 rounded text-slate-700 cursor-pointer font-sans ${activeMenu === 'edit' ? 'bg-slate-200 font-bold' : 'hover:bg-slate-100'}`}>Правка</button>
                {activeMenu === 'edit' && (
                  <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 z-50 text-xs text-slate-700">
                    <button onClick={() => { setActiveMenu(null); onUndo(); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center justify-between font-medium"><span className="flex items-center gap-2"><Undo2 className="w-4 h-4" /> Отменить</span><span className="text-[10px] text-slate-400 font-mono">Cmd+Z</span></button>
                    <button onClick={() => { setActiveMenu(null); onRedo(); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center justify-between font-medium"><span className="flex items-center gap-2"><Redo2 className="w-4 h-4" /> Повторить</span><span className="text-[10px] text-slate-400 font-mono">Cmd+Y</span></button>
                  </div>
                )}
              </div>

              <div className="relative">
                <button onClick={() => setActiveMenu(activeMenu === 'view' ? null : 'view')} className={`px-2 py-0.5 rounded text-slate-700 cursor-pointer font-sans ${activeMenu === 'view' ? 'bg-slate-200 font-bold' : 'hover:bg-slate-100'}`}>Вид</button>
                {activeMenu === 'view' && (
                  <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 z-50 text-xs text-slate-700">
                    <button onClick={() => { setActiveMenu(null); setShowRuler(!showRuler); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center justify-between font-medium"><span>Показать линейку</span><span>{showRuler ? '✓' : ''}</span></button>
                    <hr className="my-1 border-slate-100" />
                    <button onClick={() => { setActiveMenu(null); setZoomLevel(100); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center justify-between font-medium"><span>Масштаб: 100%</span><span>{zoomLevel === 100 ? '✓' : ''}</span></button>
                    <button onClick={() => { setActiveMenu(null); setZoomLevel(125); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center justify-between font-medium"><span>Масштаб: 125%</span><span>{zoomLevel === 125 ? '✓' : ''}</span></button>
                  </div>
                )}
              </div>

              <div className="relative">
                <button onClick={() => setActiveMenu(activeMenu === 'insert' ? null : 'insert')} className={`px-2 py-0.5 rounded text-slate-700 cursor-pointer font-sans ${activeMenu === 'insert' ? 'bg-slate-200 font-bold' : 'hover:bg-slate-100'}`}>Вставка</button>
                {activeMenu === 'insert' && (
                  <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 z-50 text-xs text-slate-700">
                    <button onClick={() => { setActiveMenu(null); handleInsertStamp('round'); }} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-blue-700 flex items-center gap-2 font-bold"><span>🔵 Круглая печать Академии</span></button>
                    <button onClick={() => { setActiveMenu(null); handleInsertStamp('signature'); }} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-blue-700 flex items-center gap-2 font-bold"><span>✍️ Подпись Директора</span></button>
                    <button onClick={() => { setActiveMenu(null); handleInsertStamp('corner'); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><span>🟦 Угольный штамп орг-ции</span></button>
                    <button onClick={() => { setActiveMenu(null); handleInsertStamp('logo'); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><span>🏫 Логотип Академии</span></button>
                    <hr className="my-1 border-slate-100" />
                    <button onClick={() => { setActiveMenu(null); handleInsertImage(); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><ImageIcon className="w-4 h-4 text-emerald-600" /> Свое изображение (URL)</button>
                    <button onClick={() => { setActiveMenu(null); handleInsertLink(); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><Link className="w-4 h-4 text-blue-600" /> Ссылка</button>
                    <button onClick={() => { setActiveMenu(null); onAddBlock('divider'); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><span>➖ Разделитель</span></button>
                    <button onClick={() => { setActiveMenu(null); onAddBlock('todo_list'); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><CheckSquare className="w-4 h-4 text-indigo-600" /> Чек-лист задач</button>
                  </div>
                )}
              </div>

              <div className="relative">
                <button onClick={() => setActiveMenu(activeMenu === 'tools' ? null : 'tools')} className={`px-2 py-0.5 rounded text-slate-700 cursor-pointer font-sans ${activeMenu === 'tools' ? 'bg-slate-200 font-bold' : 'hover:bg-slate-100'}`}>Инструменты</button>
                {activeMenu === 'tools' && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 z-50 text-xs text-slate-700">
                    <button onClick={() => { setActiveMenu(null); setShowStatsModal(true); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><BarChart2 className="w-4 h-4 text-blue-600" /> Статистика документа</button>
                  </div>
                )}
              </div>

              <div className="relative">
                <button onClick={() => setActiveMenu(activeMenu === 'help' ? null : 'help')} className={`px-2 py-0.5 rounded text-slate-700 cursor-pointer font-sans ${activeMenu === 'help' ? 'bg-slate-200 font-bold' : 'hover:bg-slate-100'}`}>Справка</button>
                {activeMenu === 'help' && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 z-50 text-xs text-slate-700">
                    <button onClick={() => { setActiveMenu(null); setShowShortcutsModal(true); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><Keyboard className="w-4 h-4 text-indigo-600" /> Горячие клавиши</button>
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
            onClick={() => setShowShareModal(true)}
            data-tooltip="Настройки совместного доступа к документу"
            data-tooltip-pos="bottom"
            className={`px-4 py-2 rounded-full font-bold text-xs shadow-md transition flex items-center gap-2 cursor-pointer ${
              accessLevel === 'private' ? 'bg-amber-600 hover:bg-amber-700 text-white' :
              accessLevel === 'company_view' ? 'bg-blue-600 hover:bg-blue-700 text-white' :
              'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{accessLevel === 'private' ? 'Приватный доступ' : accessLevel === 'company_view' ? 'Чтение компанией' : 'Редактирование'}</span>
          </button>
        </div>
      </div>

      {/* Formatting Ribbon */}
      <div className="px-3 py-1.5 flex items-center gap-1 overflow-x-auto text-slate-700 text-xs bg-[#edf2fa] border-t border-slate-200 relative">
        <button onMouseDown={e => e.preventDefault()} onClick={onUndo} data-tooltip="Отменить (Cmd+Z)" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><Undo2 className="w-4 h-4" /></button>
        <button onMouseDown={e => e.preventDefault()} onClick={onRedo} data-tooltip="Повторить (Cmd+Y)" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><Redo2 className="w-4 h-4" /></button>
        <button onMouseDown={e => e.preventDefault()} onClick={() => onExport('pdf')} data-tooltip="Печать (Cmd+P)" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><Printer className="w-4 h-4" /></button>
        
        <div className="h-4 w-px bg-slate-300 mx-1"></div>

        {/* Paragraph Style */}
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

        {/* Font Family */}
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

        {/* BOLD BUTTON: Applies to selected text or toggles for subsequent typing! */}
        <button 
          onMouseDown={e => e.preventDefault()} 
          onClick={() => execFormat('bold')} 
          data-tooltip="Полужирный для выделенного текста (Bold)" 
          data-tooltip-pos="bottom" 
          className="p-1.5 rounded font-black hover:bg-slate-200 text-slate-800 cursor-pointer transition active:bg-blue-200"
        >
          <Bold className="w-4 h-4" />
        </button>

        {/* ITALIC BUTTON */}
        <button 
          onMouseDown={e => e.preventDefault()} 
          onClick={() => execFormat('italic')} 
          data-tooltip="Курсив для выделенного текста (Italic)" 
          data-tooltip-pos="bottom" 
          className="p-1.5 rounded italic hover:bg-slate-200 text-slate-800 cursor-pointer transition active:bg-blue-200"
        >
          <Italic className="w-4 h-4" />
        </button>

        {/* UNDERLINE BUTTON */}
        <button 
          onMouseDown={e => e.preventDefault()} 
          onClick={() => execFormat('underline')} 
          data-tooltip="Подчеркнутый для выделенного текста (Underline)" 
          data-tooltip-pos="bottom" 
          className="p-1.5 rounded underline hover:bg-slate-200 text-slate-800 cursor-pointer transition active:bg-blue-200"
        >
          <Underline className="w-4 h-4" />
        </button>

        {/* TEXT COLOR PICKER */}
        <div className="relative">
          <button 
            onMouseDown={e => e.preventDefault()} 
            onClick={() => { setShowTextColorPicker(!showTextColorPicker); setShowBgColorPicker(false); }} 
            data-tooltip="Цвет выделенного текста" 
            data-tooltip-pos="bottom" 
            className="p-1.5 hover:bg-slate-200 rounded font-bold cursor-pointer text-blue-600"
          >
            <Baseline className="w-4 h-4" />
          </button>
          {showTextColorPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-slate-200 rounded-xl shadow-xl flex gap-1 z-50">
              {colors.map(c => (
                <button 
                  key={c} 
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { execFormat('foreColor', c); setShowTextColorPicker(false); }}
                  className="w-5 h-5 rounded-full border border-slate-300 hover:scale-110 transition cursor-pointer"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        </div>

        {/* HIGHLIGHT COLOR PICKER */}
        <div className="relative">
          <button 
            onMouseDown={e => e.preventDefault()} 
            onClick={() => { setShowBgColorPicker(!showBgColorPicker); setShowTextColorPicker(false); }} 
            data-tooltip="Маркер выделения фона текста" 
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
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { execFormat('hiliteColor', c); setShowBgColorPicker(false); }}
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

        {/* ALIGNMENTS */}
        <button onMouseDown={e => e.preventDefault()} onClick={() => execFormat('justifyLeft')} data-tooltip="По левому краю" data-tooltip-pos="bottom" className="p-1.5 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"><AlignLeft className="w-4 h-4" /></button>
        <button onMouseDown={e => e.preventDefault()} onClick={() => execFormat('justifyCenter')} data-tooltip="По центру" data-tooltip-pos="bottom" className="p-1.5 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"><AlignCenter className="w-4 h-4" /></button>
        <button onMouseDown={e => e.preventDefault()} onClick={() => execFormat('justifyRight')} data-tooltip="По правому краю" data-tooltip-pos="bottom" className="p-1.5 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"><AlignRight className="w-4 h-4" /></button>
        <button onMouseDown={e => e.preventDefault()} onClick={() => execFormat('justifyFull')} data-tooltip="По ширине" data-tooltip-pos="bottom" className="p-1.5 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"><AlignJustify className="w-4 h-4" /></button>

        <div className="h-4 w-px bg-slate-300 mx-1"></div>

        {/* REMOVE FORMATTING */}
        <button onMouseDown={e => e.preventDefault()} onClick={() => execFormat('removeFormat')} data-tooltip="Очистить форматирование выделенного фрагмента" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><RemoveFormatting className="w-4 h-4" /></button>

        <div className="h-4 w-px bg-slate-300 mx-1"></div>

        {/* QUICK OFFICIAL STAMPS */}
        <button onMouseDown={e => e.preventDefault()} onClick={() => handleInsertStamp('round')} data-tooltip="Вставить синюю круглую печать Академии" data-tooltip-pos="bottom" className="px-2 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold rounded text-[11px] flex items-center gap-1 cursor-pointer transition"><span>🔵 Печать</span></button>
        <button onMouseDown={e => e.preventDefault()} onClick={() => handleInsertStamp('signature')} data-tooltip="Вставить факсимильную подпись Директора" data-tooltip-pos="bottom" className="px-2 py-1 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-bold rounded text-[11px] flex items-center gap-1 cursor-pointer transition"><span>✍️ Подпись</span></button>

        <div className="ml-auto flex items-center gap-2">
          <button 
            onClick={() => onExport('pdf')} 
            data-tooltip="Скачать PDF"
            data-tooltip-pos="bottom"
            className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs transition cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> Скачать
          </button>
        </div>
      </div>

      {/* GRANULAR ACCESS CONTROL MODAL */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 text-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-600" />
                <span>Настройки доступа к файлу</span>
              </h3>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                {canManageAccess ? 'Вы автор (Управляющий)' : 'Режим просмотра'}
              </span>
            </div>

            {canManageAccess ? (
              <div className="space-y-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Общий доступ для компании:</label>
                  <select 
                    value={accessLevel}
                    onChange={e => setAccessLevel(e.target.value as DocAccessLevel)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
                  >
                    <option value="private">🔒 Приватно (Только вы и админы. Для остальных скрыт!)</option>
                    <option value="company_view">👁️ Только чтение (Все сотрудники компании видят, но не могут менять)</option>
                    <option value="company_edit">✏️ Редактирование (Все сотрудники компании могут менять файл)</option>
                    <option value="specific_users">👥 Назначить конкретным сотрудникам (Индивидуальный доступ)</option>
                  </select>
                </div>

                {accessLevel === 'specific_users' && (
                  <div className="space-y-3 p-3 bg-purple-50/60 border border-purple-200 rounded-xl">
                    <label className="block font-bold text-purple-900">Выдать доступ сотруднику:</label>
                    <div className="flex gap-2">
                      <select 
                        value={selectedStaffId}
                        onChange={e => setSelectedStaffId(e.target.value)}
                        className="flex-1 bg-white border border-purple-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                      >
                        {staffList.map(s => (
                          <option key={s.id} value={s.id}>👤 {s.name} ({s.email})</option>
                        ))}
                      </select>
                      <select 
                        value={selectedRole}
                        onChange={e => setSelectedRole(e.target.value as UserDocRole)}
                        className="bg-white border border-purple-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                      >
                        <option value="editor">Редактор</option>
                        <option value="viewer">Читатель</option>
                      </select>
                      <button 
                        onClick={handleAddUserPermission}
                        className="px-3 py-2 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition"
                      >
                        Добавить
                      </button>
                    </div>

                    <div className="space-y-1 pt-2">
                      <span className="font-bold text-slate-600 block mb-1">Сотрудники с доступом:</span>
                      {Object.keys(permissionsMap).length === 0 ? (
                        <span className="text-slate-400 italic">Сотрудники не выбраны</span>
                      ) : (
                        Object.entries(permissionsMap).map(([uid, role]) => {
                          const staff = staffList.find(s => s.id === uid);
                          return (
                            <div key={uid} className="flex justify-between items-center bg-white px-3 py-1.5 border border-purple-100 rounded-lg">
                              <span className="font-bold text-slate-800">{staff ? staff.name : uid.substring(0, 8)}</span>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 font-bold rounded text-[10px] uppercase">{role}</span>
                                <button onClick={() => handleRemoveUserPermission(uid)} className="text-red-500 hover:text-red-700 font-bold">✕</button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 space-y-2">
                <div className="font-bold text-slate-900">Уровень доступа:</div>
                <div className="text-xs">
                  {currentDoc.accessLevel === 'private' ? '🔒 Приватный документ (Только автор)' :
                   currentDoc.accessLevel === 'company_view' ? '👁️ Только чтение для сотрудников' : '✏️ Доступен для редактирования'}
                </div>
                <div className="text-[11px] text-slate-500 italic mt-2">
                  * Изменять настройки доступа может только автор ({currentDoc.authorName || 'Создатель'}).
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => setShowShareModal(false)} className="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-50">Отмена</button>
              {canManageAccess && (
                <button onClick={handleSaveAccess} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md cursor-pointer">Сохранить доступ</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Word Count Statistics Modal */}
      {showStatsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200 text-xs">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-blue-600" />
              <span>Статистика документа</span>
            </h3>
            <div className="space-y-2 text-slate-700 font-medium">
              <div className="flex justify-between py-1.5 border-b"><span>Всего слов:</span><span className="font-bold text-blue-600 font-mono">{totalWords}</span></div>
              <div className="flex justify-between py-1.5 border-b"><span>Всего символов:</span><span className="font-bold text-blue-600 font-mono">{totalChars}</span></div>
              <div className="flex justify-between py-1.5 border-b"><span>Блоков текста:</span><span className="font-bold text-blue-600 font-mono">{docBlocks.length}</span></div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setShowStatsModal(false)} className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl">Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* Shortcuts Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 text-xs">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-indigo-600" />
              <span>Горячие клавиши</span>
            </h3>
            <div className="space-y-1 font-mono text-slate-700">
              <div className="flex justify-between p-2 bg-slate-50 rounded"><span>Отмена</span><span className="font-bold text-blue-600">Cmd + Z</span></div>
              <div className="flex justify-between p-2 bg-slate-50 rounded"><span>Повтор</span><span className="font-bold text-blue-600">Cmd + Y</span></div>
              <div className="flex justify-between p-2 bg-slate-50 rounded"><span>Печать PDF</span><span className="font-bold text-blue-600">Cmd + P</span></div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setShowShortcutsModal(false)} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl">Понятно</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
