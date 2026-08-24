import React, { useState, useEffect } from 'react';

export function GlobalTooltip() {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number; pos: string } | null>(null);

  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('[data-tooltip]') as HTMLElement;
      if (target) {
        const text = target.getAttribute('data-tooltip');
        const pos = target.getAttribute('data-tooltip-pos') || 'top';
        if (text && text.trim()) {
          const rect = target.getBoundingClientRect();
          let x = rect.left + rect.width / 2;
          let y = rect.top - 6;

          if (pos === 'bottom') {
            y = rect.bottom + 6;
          } else if (pos === 'right') {
            x = rect.right + 8;
            y = rect.top + rect.height / 2;
          } else if (pos === 'left') {
            x = rect.left - 8;
            y = rect.top + rect.height / 2;
          }

          setTooltip({ text, x, y, pos });
        }
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('[data-tooltip]');
      if (target) {
        setTooltip(null);
      }
    };

    const handleScroll = () => setTooltip(null);

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  if (!tooltip || !tooltip.text) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: `${tooltip.x}px`,
        top: `${tooltip.y}px`,
        transform: tooltip.pos === 'right' ? 'translateY(-50%)' : tooltip.pos === 'left' ? 'translate(-100%, -50%)' : tooltip.pos === 'bottom' ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
        zIndex: 99999999,
        pointerEvents: 'none'
      }}
      className="bg-slate-900 text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow-2xl border border-white/20 whitespace-nowrap font-sans tracking-wide transition-opacity duration-150"
    >
      {tooltip.text}
    </div>
  );
}
