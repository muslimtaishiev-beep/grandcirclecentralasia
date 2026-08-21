import React from 'react';

export function SkipToContent({ targetId = "main-content" }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--accent)] focus:text-white focus:font-bold focus:rounded-xl focus:shadow-2xl focus:outline-hidden transition"
    >
      Перейти к основному содержимому (Skip to content)
    </a>
  );
}
