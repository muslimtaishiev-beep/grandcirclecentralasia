import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export function CopyButton({ text, label, className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className={`px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-main)] text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${className}`}
      title="Скопировать в буфер"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-emerald-500 font-bold">Скопировано!</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span>{label || 'Копировать'}</span>
        </>
      )}
    </button>
  );
}
