import React, { useState, useEffect, useRef } from 'react';
import type { LegalProfile } from '../../../../shared/legal';
import { useOutletContext } from 'react-router-dom';
import { 
  ArrowLeft, FileText, Star, FolderUp, CheckCircle2, History, MessageSquare, Lock, Share2,
  Undo2, Redo2, Printer, Paintbrush, ChevronDown, Bold, Italic, Underline, Baseline, Highlighter, 
  Link, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, CheckSquare, 
  Indent, Outdent, RemoveFormatting, Plus, Minus, Download, Code, Quote, Trash2, Eye, FilePlus, Sparkles,
  Scissors, Copy, Clipboard, BarChart2, Globe, HelpCircle, Keyboard, Info, Check, ShieldCheck, UserCheck, Users, Edit3, Upload, FileCheck
} from 'lucide-react';
import { db } from '../../../../lib/firebase';
import { cleanDocHtml } from '../../../../lib/docHtml';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { DocBlock, DocAccessLevel, UserDocRole, WorkspaceDocument } from '../../../../types/collab';
import type { DocumentTemplate } from '../../../../types/engine';
import { DocumentTemplateService } from '../../../../services/tenant/DocumentTemplateService';
import { fillTemplateVars, templateHtmlToBlocks } from '../../../../services/collab/templateBlocks';
import { confirmDialog, toast } from '../../../../components/ui';

interface Props {
  /** Реквизиты организации: шаблоны, печать, логотип. */
  legal?: LegalProfile | null;
  doc: WorkspaceDocument;
  title: string;
  onUpdateTitle: (newTitle: string) => void;
  onBack: () => void;
  onAddBlock: (type: DocBlock['type']) => void;
  onExport: (format?: 'pdf' | 'markdown') => void;
  onDeleteDoc: () => void;
  saving: boolean;
  /** Последняя запись не удалась — текст остаётся на экране и уйдёт повторно. */
  saveError?: string | null;
  canEdit: boolean;
  canDelete: boolean;
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
  onLoadTemplate: (templateBlocks: DocBlock[]) => void;
}

export default function DocEditorToolbar({ 
  legal,
  doc: currentDoc,
  title, 
  onUpdateTitle, 
  onBack, 
  onAddBlock, 
  onExport, 
  onDeleteDoc,
  saving,
  saveError,
  canEdit,
  canDelete,
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
  onUpdateAccess,
  onLoadTemplate
}: Props) {
  // Имя организации в шаблонах документов: раньше во все справки и договоры
  // любого тенанта подставлялась «Академия Будущих Лидеров» — чужое
  // юридическое лицо в документе, который выдают живому человеку.
  const wsCtx = useOutletContext<{ activeTenant?: any } | null>();
  const orgName = wsCtx?.activeTenant?.name || 'вашей организации';
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
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);

  // Color Pickers
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);

  // File Input Ref for native computer image upload
  const fileInputRef = useRef<HTMLInputElement>(null);
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

    // Только сотрудники организации с действующим доступом: ни клиентов CRM, ни выдуманных людей.
    const qMembers = query(collection(db, 'memberships'), where('tenantId', '==', currentDoc.tenantId));
    const unsubMembers = onSnapshot(qMembers, (snap1) => {
      const list: Array<{ id: string; name: string; email: string }> = [];
      snap1.forEach(d => {
        const data = d.data();
        if (data.status && data.status !== 'active') return;
        const uid = data.userId;
        if (!uid || list.some(x => x.id === uid)) return;
        const email = data.userEmail || data.email || '';
        list.push({
          id: uid,
          name: data.displayName || data.userName || data.fullName || data.name || (email ? email.split('@')[0] : 'Сотрудник'),
          email
        });
      });
      setStaffList(list);
      setSelectedStaffId(prev => prev || list[0]?.id || '');
    }, () => setStaffList([]));

    return () => unsubMembers();
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

  const execFormat = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (activeBlock) {
      const el = document.getElementById(`block-${activeBlock.id}`);
      if (el) {
        onUpdateStyle({ content: cleanDocHtml(el.innerHTML) });
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
    // Печать, подпись и логотип — только свои. Раньше в документ любой
    // организации вставлялись печать и подпись Академии.
    const url = stampType === 'round' ? legal?.stampUrl
      : stampType === 'logo' ? legal?.logoUrl
      : stampType === 'signature' ? legal?.signatureUrl
      : legal?.cornerStampUrl;
    if (!url) {
      toast.error('Файл не загружен. Добавьте его в «Настройка воркспейса → Реквизиты»');
      return;
    }
    execFormat('insertImage', url);
  };

  // Фото с телефона — это мегабайты; документ в базе ограничен 1 МБ, поэтому
  // картинку уменьшаем и пережимаем, а слишком большую не вставляем.
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => toast.error('Не удалось прочитать файл');
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => toast.error('Это не изображение');
      img.onload = () => {
        const k = Math.min(1, 1000 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k));
        c.height = Math.max(1, Math.round(img.height * k));
        const ctx = c.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const url = c.toDataURL('image/jpeg', 0.7);
        if (url.length > 400_000) { toast.error('Изображение слишком большое'); return; }
        execFormat('insertImage', url);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleInsertLink = () => {
    const url = window.prompt("Введите URL ссылки:", "https://");
    if (!url) return;
    execFormat('createLink', url);
  };

  const handleInsertImagePrompt = () => fileInputRef.current?.click();

  // Шаблоны организации (Настройки → Шаблоны документов)
  const [orgTemplates, setOrgTemplates] = useState<DocumentTemplate[]>([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [pickedTpl, setPickedTpl] = useState<DocumentTemplate | null>(null);
  const [tplValues, setTplValues] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!showTemplatesModal || !currentDoc.tenantId) return;
    let alive = true;
    setTplLoading(true);
    DocumentTemplateService.getTemplates(currentDoc.tenantId)
      .then(list => { if (alive) setOrgTemplates(list); })
      .finally(() => { if (alive) setTplLoading(false); });
    return () => { alive = false; };
  }, [showTemplatesModal, currentDoc.tenantId]);

  const hasContent = () => (docBlocks || []).some(b => b.type === 'image' || b.type === 'divider' || (b.content || '').replace(/<[^>]*>/g, '').trim());
  const confirmReplace = async () => !hasContent() || confirmDialog({ title: 'Шаблон заменит текст документа', message: 'Отменить можно через «Отменить».', confirmLabel: 'Заменить', danger: true });

  const applyOrgTemplate = async (t: DocumentTemplate, values: Record<string, string>) => {
    if (!(await confirmReplace())) return;
    setShowTemplatesModal(false);
    setPickedTpl(null);
    onUpdateTitle(t.name);
    onLoadTemplate(templateHtmlToBlocks(fillTemplateVars(t.htmlContent, values)));
  };

  const pickTemplate = (t: DocumentTemplate) => {
    if (t.variables?.length) { setTplValues({}); setPickedTpl(t); } else void applyOrgTemplate(t, {});
  };

  // Встроенные шаблоны: реквизиты — из настроек организации, остальное — пустые поля.
  const applyTemplate = async (type: 'order' | 'certificate' | 'contract') => {
    if (!(await confirmReplace())) return;
    const nowStr = new Date().toLocaleDateString('ru-RU');
    const orgTitle = (legal?.legalName || orgName).toUpperCase();
    const city = legal?.city ? `г. ${legal.city}` : '';
    const blank = '__________';
    const stamp = legal?.stampUrl ? [{ id: 'st', type: 'image' as const, imageUrl: legal.stampUrl, content: legal.stampUrl }] : [];
    setShowTemplatesModal(false);

    if (type === 'order') {
      onUpdateTitle('Приказ № ' + blank);
      onLoadTemplate([
        { id: '1', type: 'heading_1', content: orgTitle, align: 'center', isBold: true },
        { id: '2', type: 'heading_2', content: 'ПРИКАЗ № ' + blank, align: 'center', isBold: true },
        { id: '3', type: 'paragraph', content: `<b>${city}</b> <span style="float:right;"><b>Дата: ${nowStr} г.</b></span>` },
        { id: '4', type: 'divider', content: '' },
        { id: '5', type: 'heading_3', content: 'Об утверждении ' + blank },
        { id: '6', type: 'paragraph', content: 'ПРИКАЗЫВАЮ:' },
        { id: '7', type: 'numbered_list', content: blank },
        { id: '8', type: 'numbered_list', content: 'Контроль за исполнением настоящего приказа оставляю за собой.' },
        { id: '9', type: 'paragraph', content: '<br><b>Руководитель:</b> ___________________ / Подпись /' },
        ...stamp
      ]);
    } else if (type === 'certificate') {
      onUpdateTitle('Справка № ' + blank);
      onLoadTemplate([
        { id: '1', type: 'heading_1', content: orgTitle, align: 'center', isBold: true },
        { id: '2', type: 'paragraph', content: [legal?.address, legal?.phone ? `Тел.: ${legal.phone}` : ''].filter(Boolean).join(' • '), align: 'center' },
        { id: '3', type: 'divider', content: '' },
        { id: '4', type: 'heading_2', content: 'СПРАВКА № ' + blank, align: 'center', isBold: true },
        { id: '5', type: 'paragraph', content: `Выдана <b>${blank}</b> в том, что он(а) действительно является учеником(цей) <b>${blank}</b> «${orgName}».` },
        { id: '6', type: 'paragraph', content: 'Справка выдана для предъявления по месту требования.' },
        { id: '7', type: 'paragraph', content: `<br><b>Дата выдачи:</b> ${nowStr} г.` },
        { id: '8', type: 'paragraph', content: '<b>Руководитель:</b> ___________________' },
        ...stamp
      ]);
    } else {
      onUpdateTitle('Договор № ' + blank);
      onLoadTemplate([
        { id: '1', type: 'heading_1', content: 'ДОГОВОР ОКАЗАНИЯ ОБРАЗОВАТЕЛЬНЫХ УСЛУГ', align: 'center', isBold: true },
        { id: '2', type: 'paragraph', content: `<b>${city}</b> <span style="float:right;"><b>«${nowStr}» г.</b></span>` },
        { id: '3', type: 'paragraph', content: `Организация «${orgName}», именуемая в дальнейшем «Исполнитель», с одной стороны, и ${blank}, именуемый в дальнейшем «Заказчик», с другой стороны, заключили настоящий Договор:` },
        { id: '4', type: 'heading_3', content: '1. ПРЕДМЕТ ДОГОВОРА' },
        { id: '5', type: 'paragraph', content: '1.1. Исполнитель обязуется предоставить образовательные услуги, а Заказчик обязуется оплатить оказанные услуги.' },
        { id: '6', type: 'heading_3', content: '2. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН' },
        { id: '7', type: 'paragraph', content: `<b>Исполнитель:</b> ${[legal?.inn ? `ИНН ${legal.inn}` : '', city, legal?.address].filter(Boolean).join(', ')}.` },
        ...stamp
      ]);
    }
  };

  const totalWords = docBlocks.reduce((acc, b) => acc + (b.content ? b.content.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length : 0), 0);
  const totalChars = docBlocks.reduce((acc, b) => acc + (b.content ? b.content.replace(/<[^>]*>/g, '').length : 0), 0);

  const colors = ['#0f172a', '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#d97706'];
  const bgColors = ['transparent', '#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8'];

  const canManageAccess = isAuthor || isFullAdmin;

  return (
    <div ref={menuRef} className="bg-[#f9fbfd] border-b border-slate-200 font-sans text-slate-700 sticky top-0 z-30 select-none shadow-sm">
      {/* Hidden Native File Input for uploading local images from computer */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept="image/*" 
        className="hidden" 
      />

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
                                data-tooltip-pos="bottom"
                className="flex items-center gap-1 text-xs text-slate-500 ml-1 font-medium"
              >
                {saveError ? (
                  <span className="flex items-center gap-1.5 text-red-600 font-bold" title={saveError}>
                    <span className="w-2 h-2 rounded-full bg-red-500"></span> {saveError}
                  </span>
                ) : saving ? (
                  <span className="flex items-center gap-1.5 text-amber-600 font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span> Сохранение...
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Сохранено</span>
                  </span>
                )}
              </div>
            </div>

            {/* Menu Bar */}
            <div className="flex items-center gap-1 text-xs font-medium text-slate-600 mt-0.5 relative">
              <div className="relative">
                <button onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')} className={`px-2 py-0.5 rounded text-slate-700 cursor-pointer font-sans ${activeMenu === 'file' ? 'bg-slate-200 font-bold' : 'hover:bg-slate-100'}`}>Файл</button>
                {activeMenu === 'file' && (
                  <div className="absolute top-full left-0 mt-1 w-60 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 z-50 text-xs text-slate-700">
                    <button onClick={() => { setActiveMenu(null); setShowTemplatesModal(true); }} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-blue-700 flex items-center gap-2 font-bold"><FileCheck className="w-4 h-4 text-blue-600" /> Загрузить готовый шаблон</button>
                    <button onClick={() => { setActiveMenu(null); onBack(); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><FilePlus className="w-4 h-4 text-blue-600" /> Вернуться к документам</button>
                    {canManageAccess && <button onClick={() => { setActiveMenu(null); setIsEditingTitle(true); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><FileText className="w-4 h-4 text-slate-500" /> Переименовать документ</button>}
                    <hr className="my-1 border-slate-100" />
                    <button onClick={() => { setActiveMenu(null); onExport('pdf'); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center justify-between font-medium"><span>📄 Скачать как PDF</span><span className="text-[10px] text-slate-400 font-mono">Cmd+P</span></button>
                    <button onClick={() => { setActiveMenu(null); onExport('markdown'); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center justify-between font-medium"><span>📝 Скачать как Markdown (.md)</span></button>
                    {canManageAccess && <>
                      <hr className="my-1 border-slate-100" />
                      {canDelete && <button onClick={() => { setActiveMenu(null); onDeleteDoc(); }} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 font-medium"><Trash2 className="w-4 h-4" /> Удалить документ</button>}
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
                    <button onClick={() => { setActiveMenu(null); fileInputRef.current?.click(); }} className="w-full text-left px-4 py-2 hover:bg-emerald-50 text-emerald-700 flex items-center gap-2 font-bold"><Upload className="w-4 h-4 text-emerald-600" /> Загрузить изображение с ПК</button>
                    <button onClick={() => { setActiveMenu(null); handleInsertStamp('round'); }} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-blue-700 flex items-center gap-2 font-bold"><span>🔵 Круглая печать организации</span></button>
                    <button onClick={() => { setActiveMenu(null); handleInsertStamp('signature'); }} className="w-full text-left px-4 py-2 hover:bg-purple-50 text-purple-700 flex items-center gap-2 font-bold"><span>✍️ Подпись Директора</span></button>
                    <button onClick={() => { setActiveMenu(null); handleInsertStamp('corner'); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><span>🟦 Угловой штамп организации</span></button>
                    <button onClick={() => { setActiveMenu(null); handleInsertStamp('logo'); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><span>🏫 Логотип организации</span></button>
                    <hr className="my-1 border-slate-100" />
                    <button onClick={() => { setActiveMenu(null); handleInsertLink(); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><Link className="w-4 h-4 text-blue-600" /> Ссылка</button>
                    <button onClick={() => { setActiveMenu(null); onAddBlock('divider'); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 font-medium"><span>➖ Разделитель</span></button>
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
          {canEdit && <button 
            onClick={() => setShowTemplatesModal(true)}
            data-tooltip="Шаблоны документов"
            data-tooltip-pos="bottom"
            className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold rounded-full text-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <FileCheck className="w-4 h-4 text-indigo-600" />
            <span>Шаблоны</span>
          </button>}

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
      <div className={`px-3 py-1.5 flex items-center gap-1 overflow-x-auto text-slate-700 text-xs bg-[#edf2fa] border-t border-slate-200 relative ${canEdit ? '' : 'pointer-events-none opacity-50'}`}>
        <button onMouseDown={e => e.preventDefault()} onClick={onUndo} data-tooltip="Отменить (Cmd+Z)" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><Undo2 className="w-4 h-4" /></button>
        <button onMouseDown={e => e.preventDefault()} onClick={onRedo} data-tooltip="Повторить (Cmd+Y)" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><Redo2 className="w-4 h-4" /></button>
        <button onMouseDown={e => e.preventDefault()} onClick={() => onExport('pdf')} data-tooltip="Печать (Cmd+P)" data-tooltip-pos="bottom" className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"><Printer className="w-4 h-4" /></button>
        
        <div className="h-4 w-px bg-slate-300 mx-1"></div>

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

        <button 
          onMouseDown={e => e.preventDefault()} 
          onClick={() => execFormat('bold')} 
          data-tooltip="Полужирный для выделенного текста (Bold)" 
          data-tooltip-pos="bottom" 
          className="p-1.5 rounded font-black hover:bg-slate-200 text-slate-800 cursor-pointer transition active:bg-blue-200"
        >
          <Bold className="w-4 h-4" />
        </button>

        <button 
          onMouseDown={e => e.preventDefault()} 
          onClick={() => execFormat('italic')} 
          data-tooltip="Курсив для выделенного текста (Italic)" 
          data-tooltip-pos="bottom" 
          className="p-1.5 rounded italic hover:bg-slate-200 text-slate-800 cursor-pointer transition active:bg-blue-200"
        >
          <Italic className="w-4 h-4" />
        </button>

        <button 
          onMouseDown={e => e.preventDefault()} 
          onClick={() => execFormat('underline')} 
          data-tooltip="Подчеркнутый для выделенного текста (Underline)" 
          data-tooltip-pos="bottom" 
          className="p-1.5 rounded underline hover:bg-slate-200 text-slate-800 cursor-pointer transition active:bg-blue-200"
        >
          <Underline className="w-4 h-4" />
        </button>

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

        <button onMouseDown={e => e.preventDefault()} onClick={() => execFormat('justifyLeft')} data-tooltip="По левому краю" data-tooltip-pos="bottom" className="p-1.5 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"><AlignLeft className="w-4 h-4" /></button>
        <button onMouseDown={e => e.preventDefault()} onClick={() => execFormat('justifyCenter')} data-tooltip="По центру" data-tooltip-pos="bottom" className="p-1.5 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"><AlignCenter className="w-4 h-4" /></button>
        <button onMouseDown={e => e.preventDefault()} onClick={() => execFormat('justifyRight')} data-tooltip="По правому краю" data-tooltip-pos="bottom" className="p-1.5 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"><AlignRight className="w-4 h-4" /></button>
        <button onMouseDown={e => e.preventDefault()} onClick={() => execFormat('justifyFull')} data-tooltip="По ширине" data-tooltip-pos="bottom" className="p-1.5 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"><AlignJustify className="w-4 h-4" /></button>

        <div className="h-4 w-px bg-slate-300 mx-1"></div>

        {/* IMAGE FILE UPLOAD FROM COMPUTER & URL */}
        <button 
          onMouseDown={e => e.preventDefault()} 
          onClick={handleInsertImagePrompt} 
          data-tooltip="Загрузить картинку с компьютера или по URL" 
          data-tooltip-pos="bottom" 
          className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer flex items-center gap-1 font-bold text-[11px]"
        >
          <ImageIcon className="w-4 h-4 text-emerald-600" />
          <span className="hidden sm:inline">Фото</span>
        </button>

        <button onMouseDown={e => e.preventDefault()} onClick={() => handleInsertStamp('round')} data-tooltip="Вставить круглую печать организации" data-tooltip-pos="bottom" className="px-2 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold rounded text-[11px] flex items-center gap-1 cursor-pointer transition"><span>🔵 Печать</span></button>
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

      {/* CORPORATE TEMPLATES MODAL */}
      {showTemplatesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 text-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-600" />
                <span>Шаблоны</span>
              </h3>
              <button onClick={() => setShowTemplatesModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            
            {pickedTpl ? (
              <div className="space-y-3">
                <div className="font-bold text-slate-900 text-sm">{pickedTpl.name}</div>
                {pickedTpl.variables.map(v => (
                  <label key={v.key} className="block">
                    <span className="block text-[11px] font-semibold text-slate-600 mb-1">{v.label || v.key}</span>
                    <input
                      type={v.type === 'date' ? 'date' : v.type === 'number' ? 'number' : 'text'}
                      value={tplValues[v.key] || ''}
                      onChange={e => setTplValues(prev => ({ ...prev, [v.key]: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                    />
                  </label>
                ))}
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setPickedTpl(null)} className="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-50">Назад</button>
                  <button onClick={() => void applyOrgTemplate(pickedTpl, tplValues)} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700">Применить</button>
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-1 gap-2 pt-1 max-h-[60vh] overflow-y-auto">
              {tplLoading && <div className="text-slate-400 py-2">Загрузка…</div>}
              {orgTemplates.map(t => (
                <button key={t.id} onClick={() => pickTemplate(t)} className="text-left p-3 border border-slate-200 hover:border-blue-500 rounded-xl hover:bg-blue-50/50 cursor-pointer transition flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{t.name}</span>
                  <span className="px-3 py-1 bg-blue-600 text-white font-bold rounded-lg text-[11px]">Выбрать</span>
                </button>
              ))}
              {([['order', 'Приказ'], ['certificate', 'Справка'], ['contract', 'Договор оказания услуг']] as const).map(([k, label]) => (
                <button key={k} onClick={() => void applyTemplate(k)} className="text-left p-3 border border-slate-200 hover:border-blue-500 rounded-xl hover:bg-blue-50/50 cursor-pointer transition flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{label}</span>
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 font-bold rounded-lg text-[11px]">Выбрать</span>
                </button>
              ))}
            </div>
            )}

            <div className="flex justify-end pt-2">
              <button onClick={() => { setShowTemplatesModal(false); setPickedTpl(null); }} className="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-50">Закрыть</button>
            </div>
          </div>
        </div>
      )}

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
