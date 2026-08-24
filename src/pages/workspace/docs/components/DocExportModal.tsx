import React from 'react';
import { X, FileText, Download, Printer } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'pdf' | 'markdown') => void;
}

export default function DocExportModal({ isOpen, onClose, onExport }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[var(--bg-panel)] rounded-2xl max-w-sm w-full shadow-2xl border border-[var(--border-color)] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Download className="w-5 h-5" />
            Экспорт документа
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-[var(--bg-surface)] rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-3">
          <button 
            onClick={() => onExport('pdf')}
            className="w-full flex items-center gap-3 p-4 border border-[var(--border-color)] rounded-xl hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition group text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-[var(--text-main)]">PDF Документ</div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">Сохранить как PDF или распечатать</div>
            </div>
          </button>

          <button 
            onClick={() => onExport('markdown')}
            className="w-full flex items-center gap-3 p-4 border border-[var(--border-color)] rounded-xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition group text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-[var(--text-main)]">Markdown (.md)</div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">Обычный текст с разметкой</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
