import React, { useState, useRef } from 'react';
import { resolveLegalProfile } from '../../../shared/legal';
import { useOutletContext, useParams, useNavigate } from 'react-router-dom';
import { useDocumentEditor } from '../../../hooks/collab/useDocumentEditor';
import DocEditorToolbar from './components/DocEditorToolbar';
import DocExportModal from './components/DocExportModal';
import { DocBlockType, DocBlock, DocAccessLevel, UserDocRole } from '../../../types/collab';
import { useAuth } from '../../../contexts/AuthContext';
import { documentService } from '../../../services/collab/documentService';
import { Lock, ShieldAlert } from 'lucide-react';

export default function DocumentEditorPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const { id: docId } = useParams();
  const { user } = useAuth();
  const { 
    doc, 
    loading, 
    saving, 
    activeBlockId, 
    setActiveBlockId, 
    updateTitle, 
    updateBlock, 
    updateBlockStyle,
    updateActiveBlockStyle,
    toggleCheck, 
    addBlockAfter, 
    deleteBlock, 
    changeBlockType,
    undo,
    redo,
    deleteDoc 
  } = useDocumentEditor(activeTenant?.id, docId);

  const [exportOpen, setExportOpen] = useState(false);
  const [selectedFont, setSelectedFont] = useState('Verdana');
  const [fontSize, setFontSize] = useState(11);
  const [showRuler, setShowRuler] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);
  const navigate = useNavigate();
  const editorRef = useRef<HTMLDivElement>(null);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="flex items-center gap-3 text-slate-500 font-medium">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Загрузка документа Google Docs...</span>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f8f9fa] p-8">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 text-center max-w-md w-full space-y-4">
          <div className="text-red-500 font-bold text-lg">Документ не найден</div>
          <p className="text-slate-600 text-sm">Документ удален или у вас недостаточно прав для просмотра.</p>
          <button 
            onClick={() => navigate(`/workspace/${activeTenant?.id}/docs`)}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md transition cursor-pointer"
          >
            ← Вернуться к списку документов
          </button>
        </div>
      </div>
    );
  }

  const isAuthor = Boolean(user && doc.authorStaffId === user.uid);
  const isFullAdmin = activeTenant?.role === 'owner' || activeTenant?.role === 'org:owner' || activeTenant?.role === 'superadmin' || activeTenant?.role === 'admin';
  
  let userRole: 'editor' | 'viewer' | 'none' = 'none';
  if (isAuthor || isFullAdmin) {
    userRole = 'editor';
  } else {
    const level = doc.accessLevel || 'company_edit';
    if (level === 'company_edit') userRole = 'editor';
    else if (level === 'company_view') userRole = 'viewer';
    else if (level === 'specific_users' && user?.uid && doc.permissionsMap?.[user.uid]) {
      const assigned = doc.permissionsMap[user.uid];
      userRole = assigned === 'editor' ? 'editor' : 'viewer';
    } else {
      userRole = 'none';
    }
  }

  if (userRole === 'none') {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f8f9fa] p-8">
        <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-200 text-center max-w-md w-full space-y-4">
          <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-2">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Доступ ограничен автором</h2>
          <p className="text-slate-600 text-xs leading-relaxed">
            Автор документа (<strong>{doc.authorName || 'Сотрудник'}</strong>) установил приватный уровень доступа. У вас нет прав на просмотр этого файла.
          </p>
          <button 
            onClick={() => navigate(`/workspace/${activeTenant?.id}/docs`)}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-md transition cursor-pointer"
          >
            ← Вернуться к списку документов
          </button>
        </div>
      </div>
    );
  }

  const activeBlock = doc.blocks.find(b => b.id === activeBlockId) || (doc.blocks.length > 0 ? doc.blocks[0] : null);

  const handleDeleteDoc = async () => {
    if (window.confirm(`Вы уверены, что хотите удалить документ "${doc.title}"?`)) {
      await deleteDoc();
      navigate(`/workspace/${activeTenant?.id}/docs`);
    }
  };

  const handleUpdateAccess = async (newLevel: DocAccessLevel, newMap: Record<string, UserDocRole>) => {
    if (!activeTenant?.id || !user?.uid) return;
    await documentService.updateAccessControl(activeTenant.id, doc.id, newLevel, newMap, user.uid);
  };

  const handleExport = (format: 'pdf' | 'markdown' = 'pdf') => {
    setExportOpen(false);
    if (format === 'pdf') {
      window.print();
    } else {
      let md = `# ${doc.title}\n\n`;
      doc.blocks.forEach(b => {
        const text = b.content ? b.content.replace(/<[^>]*>/g, '') : '';
        if (b.type === 'heading_1') md += `# ${text}\n\n`;
        else if (b.type === 'heading_2') md += `## ${text}\n\n`;
        else if (b.type === 'heading_3') md += `### ${text}\n\n`;
        else if (b.type === 'bullet_list') md += `- ${text}\n`;
        else if (b.type === 'numbered_list') md += `1. ${text}\n`;
        else if (b.type === 'todo_list') md += `- [${b.checked ? 'x' : ' '}] ${text}\n`;
        else if (b.type === 'quote') md += `> ${text}\n\n`;
        else if (b.type === 'code_block') md += `\`\`\`\n${text}\n\`\`\`\n\n`;
        else if (b.type === 'image') md += `![Изображение](${b.imageUrl || text})\n\n`;
        else if (b.type === 'divider') md += `---\n\n`;
        else md += `${text}\n\n`;
      });
      const blob = new Blob([md], { type: 'text/markdown' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${doc.title}.md`;
      a.click();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, blockId: string, index: number, type: DocBlockType) => {
    if (userRole === 'viewer') return;
    const target = e.target as HTMLDivElement;
    if (e.key === 'Enter') {
      e.preventDefault();
      addBlockAfter(blockId, type === 'bullet_list' || type === 'numbered_list' || type === 'todo_list' ? type : 'paragraph');
    } else if (e.key === 'Backspace' && (target.innerText.trim() === '' || target.innerHTML === '<br>')) {
      e.preventDefault();
      deleteBlock(blockId);
    }
  };

  const renderBlock = (b: DocBlock, index: number) => {
    if (b.type === 'divider') {
      return (
        <div key={b.id} className="py-4 cursor-pointer hover:bg-slate-50 group" onClick={() => userRole === 'editor' && deleteBlock(b.id)}>
          <hr className="border-slate-300 group-hover:border-red-500 transition" />
        </div>
      );
    }

    if (b.type === 'image') {
      const imgSrc = b.imageUrl || b.content || 'https://images.unsplash.com/photo-1542435503-956c469947f6?w=800';
      return (
        <div key={b.id} className="my-4 cursor-pointer group relative" onClick={() => setActiveBlockId(b.id)}>
          <img src={imgSrc} alt="" className="max-w-full rounded-lg shadow-md border border-slate-200" />
          {userRole === 'editor' && <button onClick={() => deleteBlock(b.id)} className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white rounded text-xs opacity-0 group-hover:opacity-100 transition">Удалить картинку</button>}
        </div>
      );
    }

    const fontStyle: React.CSSProperties = {
      fontFamily: b.fontFamily || selectedFont,
      fontSize: `${(b.fontSizePx || fontSize) + (b.type === 'heading_1' ? 12 : b.type === 'heading_2' ? 6 : b.type === 'heading_3' ? 3 : 0)}px`,
      textAlign: b.align || 'left',
      color: b.textColor || '#0f172a',
      backgroundColor: b.bgColor || 'transparent'
    };

    let style = "";
    if (b.type === 'heading_1') style = "text-3xl font-bold mb-4";
    else if (b.type === 'heading_2') style = "text-2xl font-bold mt-6 mb-3";
    else if (b.type === 'heading_3') style = "text-xl font-bold mt-4 mb-2";
    else if (b.type === 'paragraph') style = "leading-relaxed mb-2";
    else if (b.type === 'quote') style = "text-base italic border-l-4 border-blue-600 pl-4 py-1 my-4 bg-blue-50/40 rounded-r";
    else if (b.type === 'code_block') style = "font-mono text-sm bg-slate-900 text-slate-100 p-4 rounded-xl my-4";
    else if (b.type === 'bullet_list' || b.type === 'numbered_list' || b.type === 'todo_list') style = "leading-relaxed mb-1";

    return (
      <div key={b.id} className={`flex items-start gap-2 group ${b.type.includes('list') ? 'ml-6' : ''}`}>
        {b.type === 'bullet_list' && <span className="mt-2 w-2 h-2 rounded-full bg-slate-600 shrink-0"></span>}
        {b.type === 'numbered_list' && <span className="text-slate-600 font-bold shrink-0 min-w-[20px]">{index}.</span>}
        {b.type === 'todo_list' && (
          <input 
            type="checkbox" 
            checked={b.checked} 
            disabled={userRole === 'viewer'}
            onChange={() => userRole === 'editor' && toggleCheck(b.id)}
            className="mt-1.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        )}

        <EditableBlock
          id={`block-${b.id}`}
          editable={userRole === 'editor'}
          html={b.content || ''}
          onFocus={() => setActiveBlockId(b.id)}
          onInput={(html) => userRole === 'editor' && updateBlock(b.id, html)}
          onKeyDown={(e) => handleKeyDown(e, b.id, index, b.type)}
          style={fontStyle}
          className={`w-full bg-transparent focus:outline-none min-h-[1.5em] text-slate-900 outline-none ${style} ${b.checked ? 'line-through opacity-50' : ''}`}
        />
      </div>
    );
  };

  const handleLoadTemplate = (templateBlocks: DocBlock[]) => {
    if (!doc || !user || !activeTenant?.id || userRole !== 'editor') return;
    documentService.updateBlocks(activeTenant.id, doc.id, templateBlocks, user.uid);
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-[#f8f9fa] overflow-hidden">
      <DocEditorToolbar 
        legal={resolveLegalProfile(activeTenant)}
        doc={doc}
        title={doc.title}
        onUpdateTitle={updateTitle}
        onBack={() => navigate(`/workspace/${activeTenant?.id}/docs`)}
        onAddBlock={(type) => {
          if (userRole === 'editor' && doc.blocks.length > 0) {
            addBlockAfter(doc.blocks[doc.blocks.length - 1].id, type);
          }
        }}
        onExport={handleExport}
        onDeleteDoc={handleDeleteDoc}
        saving={saving}
        selectedFont={selectedFont}
        setSelectedFont={setSelectedFont}
        fontSize={fontSize}
        setFontSize={setFontSize}
        onUndo={undo}
        onRedo={redo}
        activeBlock={activeBlock}
        onUpdateStyle={updateActiveBlockStyle}
        showRuler={showRuler}
        setShowRuler={setShowRuler}
        zoomLevel={zoomLevel}
        setZoomLevel={setZoomLevel}
        docBlocks={doc.blocks}
        isAuthor={isAuthor}
        isFullAdmin={isFullAdmin}
        onUpdateAccess={handleUpdateAccess}
        onLoadTemplate={handleLoadTemplate}
      />

      {showRuler && (
        <div className="bg-[#edf2fa] border-b border-slate-200 h-6 flex items-center justify-center select-none shrink-0 overflow-hidden">
          <div className="w-[816px] flex items-center justify-between text-[10px] font-mono text-slate-500 px-12">
            <span>1</span><span>.</span><span>2</span><span>.</span><span>3</span><span>.</span><span>4</span><span>.</span><span>5</span><span>.</span><span>6</span><span>.</span><span>7</span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-8 px-4 flex justify-center bg-[#f8f9fa] print:bg-white print:p-0">
        <div 
          ref={editorRef} 
          style={{ 
            fontFamily: selectedFont,
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'top center'
          }}
          className="bg-white text-slate-900 shadow-xl border border-slate-200/90 rounded-sm w-full max-w-[816px] min-h-[1056px] px-16 py-14 space-y-2 relative transition-transform duration-200"
        >
          {doc.blocks.map((b, i) => renderBlock(b, i))}
          
          {userRole === 'editor' && (
            <div 
              className="mt-12 py-6 text-center text-xs font-semibold text-slate-400 border-2 border-dashed border-transparent hover:border-slate-300 hover:bg-slate-50 rounded-xl cursor-pointer transition select-none"
              onClick={() => {
                if (doc.blocks.length > 0) {
                  addBlockAfter(doc.blocks[doc.blocks.length - 1].id, 'paragraph');
                }
              }}
            >
              + Нажмите сюда для добавления нового блока текста
            </div>
          )}
        </div>
      </div>

      <DocExportModal 
        isOpen={exportOpen} 
        onClose={() => setExportOpen(false)} 
        onExport={handleExport}
      />
    </div>
  );
}

/**
 * Редактируемый блок без «перерисовки под курсором».
 *
 * Раньше блок рендерился через dangerouslySetInnerHTML из состояния: каждое
 * нажатие клавиши обновляло состояние, React переписывал innerHTML, и
 * курсор прыгал в начало — текст набирался задом наперёд («абв» → «вба»).
 * Здесь DOM принадлежит браузеру: содержимое подставляется из состояния
 * только когда оно изменилось снаружи (другой участник, шаблон, отмена),
 * а не после собственного ввода.
 */
function EditableBlock({ id, editable, html, onFocus, onInput, onKeyDown, style, className }: {
  id: string; editable: boolean; html: string;
  onFocus: () => void; onInput: (html: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  style?: React.CSSProperties; className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== html) el.innerHTML = html;
  }, [html]);
  return (
    <div
      id={id}
      ref={ref}
      contentEditable={editable}
      suppressContentEditableWarning
      onFocus={onFocus}
      onInput={(e) => onInput(e.currentTarget.innerHTML)}
      onKeyDown={onKeyDown}
      style={style}
      className={className}
    />
  );
}
