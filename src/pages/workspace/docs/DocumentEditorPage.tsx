import React, { useState, useRef, useEffect } from 'react';
import { useOutletContext, useParams, useNavigate } from 'react-router-dom';
import { useDocumentEditor } from '../../../hooks/collab/useDocumentEditor';
import DocEditorToolbar from './components/DocEditorToolbar';
import DocExportModal from './components/DocExportModal';
import { DocBlockType } from '../../../types/collab';

export default function DocumentEditorPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const { id: docId } = useParams();
  const { doc, loading, saving, updateBlock, toggleCheck, addBlockAfter, deleteBlock, changeBlockType } = useDocumentEditor(activeTenant?.id, docId);
  const [exportOpen, setExportOpen] = useState(false);
  const navigate = useNavigate();

  if (loading) {
    return <div className="p-8 text-[var(--text-muted)]">Загрузка документа...</div>;
  }

  if (!doc) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-red-500 font-bold text-lg">Документ не найден или у вас нет прав доступа.</div>
        <button 
          onClick={() => navigate(`/workspace/${activeTenant?.id}/docs`)}
          className="px-4 py-2 bg-[var(--accent)] text-white font-bold rounded-xl text-sm"
        >
          ← Вернуться к документам
        </button>
      </div>
    );
  }

  const handleExport = (format: 'pdf' | 'markdown') => {
    setExportOpen(false);
    if (format === 'pdf') {
      window.print(); // Simple PDF generation via browser
    } else {
      let md = '';
      doc.blocks.forEach(b => {
        if (b.type === 'heading_1') md += `# ${b.content}\n\n`;
        else if (b.type === 'heading_2') md += `## ${b.content}\n\n`;
        else if (b.type === 'heading_3') md += `### ${b.content}\n\n`;
        else if (b.type === 'bullet_list') md += `- ${b.content}\n`;
        else if (b.type === 'numbered_list') md += `1. ${b.content}\n`;
        else if (b.type === 'todo_list') md += `- [${b.checked ? 'x' : ' '}] ${b.content}\n`;
        else if (b.type === 'quote') md += `> ${b.content}\n\n`;
        else if (b.type === 'code_block') md += `\`\`\`\n${b.content}\n\`\`\`\n\n`;
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
        // e.g. continue list
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

  const renderBlock = (b: any, index: number) => {
    if (b.type === 'divider') {
      return (
        <div key={b.id} className="py-4 cursor-pointer hover:bg-[var(--bg-surface)] group" onClick={() => deleteBlock(b.id)}>
          <hr className="border-[var(--border-color)] group-hover:border-red-500 transition" />
        </div>
      );
    }

    const commonProps = {
      id: `block-${b.id}`,
      value: b.content,
      onChange: (e: any) => updateBlock(b.id, e.target.value),
      onKeyDown: (e: any) => handleKeyDown(e, b.id, index, b.type),
      className: "w-full bg-transparent focus:outline-none placeholder-[var(--text-muted)] resize-none overflow-hidden",
      placeholder: b.type === 'heading_1' ? "Заголовок..." : "Начните печатать..."
    };

    let style = "";
    if (b.type === 'heading_1') style = "text-4xl font-black mb-4";
    else if (b.type === 'heading_2') style = "text-2xl font-bold mt-6 mb-3";
    else if (b.type === 'heading_3') style = "text-xl font-bold mt-4 mb-2";
    else if (b.type === 'paragraph') style = "text-[16px] leading-relaxed mb-2";
    else if (b.type === 'quote') style = "text-lg italic border-l-4 border-[var(--accent)] pl-4 py-1 my-4";
    else if (b.type === 'code_block') style = "font-mono text-sm bg-slate-900 text-slate-50 p-4 rounded-xl my-4";
    else if (b.type === 'bullet_list' || b.type === 'numbered_list' || b.type === 'todo_list') style = "text-[16px] leading-relaxed mb-1";

    return (
      <div key={b.id} className={`flex items-start gap-2 group ${b.type.includes('list') ? 'ml-4' : ''}`}>
        {b.type === 'bullet_list' && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>}
        {b.type === 'numbered_list' && <span className="text-slate-400 font-bold shrink-0 min-w-[20px]">{index}.</span>}
        {b.type === 'todo_list' && (
          <input 
            type="checkbox" 
            checked={b.checked} 
            onChange={() => toggleCheck(b.id)}
            className="mt-1.5 w-4 h-4 rounded border-slate-300 text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
          />
        )}
        
        {b.type === 'code_block' ? (
          <textarea {...commonProps} className={`${commonProps.className} ${style} h-24`} />
        ) : (
          <input {...commonProps} className={`${commonProps.className} ${style} ${b.checked ? 'line-through opacity-50' : ''}`} />
        )}
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-[var(--bg-app)]">
      <DocEditorToolbar 
        onBack={() => navigate(`/workspace/${activeTenant?.id}/docs`)}
        onAddBlock={(type) => {
          if (doc.blocks.length > 0) {
            addBlockAfter(doc.blocks[doc.blocks.length - 1].id, type);
          } else {
            // Edge case: doc empty
          }
        }}
        onExport={() => setExportOpen(true)}
        saving={saving}
      />

      <div className="flex-1 overflow-y-auto print:bg-white print:text-black">
        <div ref={editorRef} className="max-w-3xl mx-auto py-12 px-8 min-h-full">
          {doc.blocks.map((b, i) => renderBlock(b, i))}
          
          <div 
            className="mt-8 py-8 text-center text-sm font-medium text-[var(--text-muted)] cursor-text opacity-50 hover:opacity-100 transition"
            onClick={() => {
              if (doc.blocks.length > 0) {
                addBlockAfter(doc.blocks[doc.blocks.length - 1].id, 'paragraph');
              }
            }}
          >
            Кликните чтобы добавить блок
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
