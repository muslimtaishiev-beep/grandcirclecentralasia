import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { PipelineStage, CrmDeal } from '../../../../types/crm';
import DealCard from './DealCard';

interface Props {
  stage: PipelineStage;
  deals: CrmDeal[];
  onDealClick: (deal: CrmDeal) => void;
}

export default function DealKanbanColumn({ stage, deals, onDealClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: {
      type: 'Column',
      stage,
    }
  });

  const totalAmount = deals.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="flex flex-col h-full w-80 shrink-0 bg-[var(--bg-app)] rounded-2xl overflow-hidden border border-[var(--border-color)]">
      <div 
        className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-panel)] flex flex-col gap-2"
        style={{ borderTopWidth: '4px', borderTopColor: stage.color }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[var(--text-main)] truncate" title={stage.name}>
            {stage.name}
          </h3>
          <span className="bg-slate-100 dark:bg-slate-800 text-[var(--text-muted)] text-xs font-bold px-2 py-1 rounded-full">
            {deals.length}
          </span>
        </div>
        <div className="text-sm font-medium text-[var(--text-muted)] flex items-center justify-between">
          <span>{totalAmount.toLocaleString()} KGS</span>
          <span className="text-[10px] uppercase font-bold tracking-wider">{stage.probabilityPercent}% win</span>
        </div>
      </div>
      
      <div 
        ref={setNodeRef} 
        className={`flex-1 p-3 overflow-y-auto flex flex-col gap-3 transition-colors ${
          isOver ? 'bg-[var(--accent)]/5 border-2 border-dashed border-[var(--accent)] rounded-xl m-1' : ''
        }`}
      >
        {deals.map(deal => (
          <DealCard key={deal.id} deal={deal} onClick={onDealClick} />
        ))}
      </div>
    </div>
  );
}
