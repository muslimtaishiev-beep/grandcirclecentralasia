import React from 'react';
import { CrmDeal } from '../../../../types/crm';
import { useDraggable } from '@dnd-kit/core';
import { User, DollarSign, Calendar } from 'lucide-react';

interface Props {
  deal: CrmDeal;
  onClick: (deal: CrmDeal) => void;
}

export default function DealCard({ deal, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: {
      type: 'Deal',
      deal,
    }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-[var(--bg-panel)] p-4 rounded-xl border border-[var(--border-color)] shadow-sm cursor-grab active:cursor-grabbing hover:border-[var(--accent)] transition-colors group ${isDragging ? 'opacity-50 z-50 ring-2 ring-[var(--accent)]' : ''}`}
      onClick={(e) => {
        // Prevent click if we were dragging
        if (!isDragging) {
          onClick(deal);
        }
      }}
      {...attributes}
      {...listeners}
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-bold text-sm text-[var(--text-main)] group-hover:text-[var(--accent)] transition">{deal.title}</h4>
      </div>
      
      <div className="flex items-center gap-1 text-emerald-500 font-bold text-sm mb-3">
        <DollarSign className="w-3.5 h-3.5" />
        {deal.amount.toLocaleString()} {deal.currency}
      </div>
      
      <div className="flex flex-wrap gap-2 mb-3">
        {deal.tags.map(tag => (
          <span key={tag} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            {tag}
          </span>
        ))}
      </div>
      
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-3 border-t border-[var(--border-color)]">
        <div className="flex items-center gap-1">
          <User className="w-3.5 h-3.5" />
          <span className="truncate max-w-[100px]">Client {deal.contactId.substring(0, 4)}</span>
        </div>
        {deal.expectedCloseDate && (
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>{deal.expectedCloseDate}</span>
          </div>
        )}
      </div>
    </div>
  );
}
