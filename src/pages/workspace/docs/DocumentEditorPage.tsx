import React, { useState, useRef } from 'react';
import { useOutletContext, useParams, useNavigate } from 'react-router-dom';
import { useDocumentEditor } from '../../../hooks/collab/useDocumentEditor';
import DocEditorToolbar from './components/DocEditorToolbar';
import DocExportModal from './components/DocExportModal';
import { DocBlockType, DocBlock } from '../../../types/collab';

export default function DocumentEditorPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const { id: docId } = useParams();
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
    redo 
  } = useDocumentEditor(activeTenant?.id, docId);

  const [exportOpen, setExportOpen] = useState(false);
  const [selectedFont, setSelectedFont] = useState('Verdana');
  const [fontSize, setFontSize] = useState(11);
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

  const activeBlock = doc.blocks.find(b => b.id === activeBlockId) || (doc.blocks.length > 0 ? doc.blocks[0] : null);

  const handleExport = (format: 'pdf' | 'markdown') => {
    setExportOpen(false);
    if (format === 'pdf') {
      window.print();
    } else {
      let md = `# ${doc.title}\n\n`;
      doc.blocks.forEach(b => {
        if (b.type === 'heading_1') md += `# ${b.content}\n\n`;
        else if (b.type === 'heading_2') md += `## ${b.content}\n\n`;
        else if (b.type === 'heading_3') md += `### ${b.content}\n\n`;
        else if (b.type === 'bullet_list') md += `- ${b.content}\n`;
        else if (b.type === 'numbered_list') md += `1. ${b.content}\n`;
        else if (b.type === 'todo_list') md += `- [${b.checked ? 'x' : ' '}] ${b.content}\n`;
        else if (b.type === 'quote') md += `> ${b.content}\n\n`;
        else if (b.type === 'code_block') md += `\`\`\`\n${b.content}\n\`\`\`\n\n`;
        else if (b.type === 'image') md += `![Изображение](${b.imageUrl || b.content})\n\n`;
        else if (b.type === 'divider') md += `---\n\n`;
        else md += `${b.content}\n\n`;
      });
      const blob = new Blob([md], { type: 'text/markdown' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${doc.title}.md`;
      a.click();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, blockId: string, index: number, type: DocBlockType) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (e.key === 'Enter') {
      if (type !== 'paragraph' && type !== 'heading_1' && type !== 'heading_2' && type !== 'heading_3') {
        e.preventDefault();
        addBlockAfter(blockId, type);
      } else {
        e.preventDefault();
        addBlockAfter(blockId, 'paragraph');
      }
      setTimeout(() => {
        const nextInput = document.getElementById(`block-${doc.blocks[index + 1]?.id}`);
        nextInput?.focus();
      }, 0);
    } else if (e.key === 'Backspace' && target.value === '') {
      e.preventDefault();
      deleteBlock(blockId);
      setTimeout(() => {
        const prevInput = document.getElementById(`block-${doc.blocks[index - 1]?.id}`);
        prevInput?.focus();
      }, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevInput = document.getElementById(`block-${doc.blocks[index - 1]?.id}`);
      prevInput?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextInput = document.getElementById(`block-${doc.blocks[index + 1]?.id}`);
      nextInput?.focus();
    }
  };

  const renderBlock = (b: DocBlock, index: number) => {
    if (b.type === 'divider') {
      return (
        <div key={b.id} className="py-4 cursor-pointer hover:bg-slate-50 group" onClick={() => deleteBlock(b.id)}>
          <hr className="border-slate-300 group-hover:border-red-500 transition" />
        </div>
      );
    }

    if (b.type === 'image') {
      const imgSrc = b.imageUrl || b.content || 'https://images.unsplash.com/photo-1542435503-956c469947f6?w=800';
      return (
        <div key={b.id} className="my-4 cursor-pointer group relative" onClick={() => setActiveBlockId(b.id)}>
          <img src={imgSrc} alt="" className="max-w-full rounded-lg shadow-md border border-slate-200" />
          <button onClick={() => deleteBlock(b.id)} className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white rounded text-xs opacity-0 group-hover:opacity-100 transition">Удалить картинку</button>
        </div>
      );
    }

    const commonProps = {
      id: `block-${b.id}`,
      value: b.content,
      onFocus: () => setActiveBlockId(b.id),
      onChange: (e: any) => updateBlock(b.id, e.target.value),
      onKeyDown: (e: any) => handleKeyDown(e, b.id, index, b.type),
      className: "w-full bg-transparent focus:outline-none placeholder-slate-400 resize-none overflow-hidden text-slate-900",
      placeholder: b.type === 'heading_1' ? "Устав Общества / Заголовок..." : "Введите текст документа..."
    };

    const fontStyle: React.CSSProperties = {
      fontFamily: b.fontFamily || selectedFont,
      fontSize: `${(b.fontSizePx || fontSize) + (b.type === 'heading_1' ? 12 : b.type === 'heading_2' ? 6 : b.type === 'heading_3' ? 3 : 0)}px`,
      fontWeight: b.isBold ? 'bold' : 'normal',
      fontStyle: b.isItalic ? 'italic' : 'normal',
      textDecoration: b.isUnderline ? 'underline' : 'none',
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
            onChange={() => toggleCheck(b.id)}
            className="mt-1.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        )}
        
        {b.type === 'code_block' ? (
          <textarea {...commonProps} style={fontStyle} className={`${commonProps.className} ${style} h-24`} />
        ) : (
          <input {...commonProps} style={fontStyle} className={`${commonProps.className} ${style} ${b.checked ? 'line-through opacity-50' : ''}`} />
        )}
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-[#f8f9fa] overflow-hidden">
      {/* Google Docs Header & Formatting Ribbon */}
      <DocEditorToolbar 
        title={doc.title}
        onUpdateTitle={updateTitle}
        onBack={() => navigate(`/workspace/${activeTenant?.id}/docs`)}
        onAddBlock={(type) => {
          if (doc.blocks.length > 0) {
            addBlockAfter(doc.blocks[doc.blocks.length - 1].id, type);
          }
        }}
        onExport={() => setExportOpen(true)}
        saving={saving}
        selectedFont={selectedFont}
        setSelectedFont={setSelectedFont}
        fontSize={fontSize}
        setFontSize={setFontSize}
        onUndo={undo}
        onRedo={redo}
        activeBlock={activeBlock}
        onUpdateStyle={updateActiveBlockStyle}
      />

      {/* Google Docs Ruler Bar */}
      <div className="bg-[#edf2fa] border-b border-slate-200 h-6 flex items-center justify-center select-none shrink-0 overflow-hidden">
        <div className="w-[816px] flex items-center justify-between text-[10px] font-mono text-slate-500 px-12">
          <span>1</span><span>.</span><span>2</span><span>.</span><span>3</span><span>.</span><span>4</span><span>.</span><span>5</span><span>.</span><span>6</span><span>.</span><span>7</span>
        </div>
      </div>

      {/* Document Workspace Canvas (A4 Paper Layout) */}
      <div className="flex-1 overflow-y-auto py-8 px-4 flex justify-center bg-[#f8f9fa] print:bg-white print:p-0">
        <div 
          ref={editorRef} 
          style={{ fontFamily: selectedFont }}
          className="bg-white text-slate-900 shadow-xl border border-slate-200/90 rounded-sm w-full max-w-[816px] min-h-[1056px] px-16 py-14 space-y-2 relative transition-all"
        >
          {doc.blocks.map((b, i) => renderBlock(b, i))}
          
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
