import React, {useState, useEffect} from 'react';
import { useOutletContext } from 'react-router-dom';
import { DndContext, DragOverlay, closestCorners, DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { useCrmPipeline } from '../../../hooks/useCrmPipeline';
import DealKanbanColumn from './components/DealKanbanColumn';
import DealCard from './components/DealCard';
import DealCreateEditModal from './components/DealCreateEditModal';
import ContactProfileDrawer from './components/ContactProfileDrawer';
import { Plus, Filter } from 'lucide-react';
import { CrmDeal } from '../../../types/crm';

export default function DealsKanbanPage() {
  const { activeTenant } = useOutletContext<any>();
  const { pipelines, activePipelineId, setActivePipelineId, activePipeline, deals, moveDeal } = useCrmPipeline(activeTenant?.id);
  
  const [activeDragDeal, setActiveDragDeal] = useState<CrmDeal | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<CrmDeal | null>(null);
  const [dealContact, setDealContact] = useState<any>(undefined);
  useEffect(() => {
    if (!selectedDeal?.contactId || !activeTenant?.id) { setDealContact(undefined); return; }
    let cancelled = false;
    (async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../../../lib/firebase');
        const snap = await getDoc(doc(db, 'tenants', activeTenant.id, 'crm_contacts', selectedDeal.contactId));
        if (!cancelled) setDealContact(snap.exists() ? { id: snap.id, ...snap.data() } : undefined);
      } catch { if (!cancelled) setDealContact(undefined); }
    })();
    return () => { cancelled = true; };
  }, [selectedDeal?.contactId, activeTenant?.id]);

  if (!activePipeline) return <div className="p-6">Загрузка воронок...</div>;

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'Deal') {
      setActiveDragDeal(active.data.current.deal);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragDeal(null);
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    if (active.data.current?.type === 'Deal' && over.data.current?.type === 'Column') {
      const dealId = active.id as string;
      const targetStageId = over.id as string;
      moveDeal(dealId, targetStageId);
    }
  };

  return (
    <div className="h-full flex flex-col -m-4 md:-m-6 relative">
      {/* Header Toolbar */}
      <div className="bg-[var(--bg-panel)] p-4 border-b border-[var(--border-color)] flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-4">
          <select 
            value={activePipelineId || ''} 
            onChange={e => setActivePipelineId(e.target.value)}
            className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-sm font-bold text-[var(--text-main)] focus:outline-none"
          >
            {pipelines.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="h-6 w-px bg-[var(--border-color)]"></div>
          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">
            <Filter className="w-4 h-4" /> Фильтры
          </button>
        </div>
        
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 bg-[var(--accent)] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:brightness-110 transition"
        >
          <Plus className="w-4 h-4" /> Новая сделка
        </button>
      </div>

      {/* Kanban Board Area */}
      <div className="flex-1 overflow-x-auto p-6 bg-[var(--bg-app)]">
        <DndContext
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-6 h-full min-w-max pb-4 items-start">
            {activePipeline.stages.map(stage => (
              <DealKanbanColumn 
                key={stage.id} 
                stage={stage} 
                deals={deals.filter(d => d.stageId === stage.id)}
                onDealClick={deal => setSelectedDeal(deal)}
              />
            ))}
          </div>
          
          <DragOverlay>
            {activeDragDeal ? (
              <div className="w-80 shadow-2xl scale-105 rotate-2 opacity-90 cursor-grabbing">
                <DealCard deal={activeDragDeal} onClick={() => {}} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <DealCreateEditModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        tenantId={activeTenant.id} 
        pipeline={activePipeline} 
      />

      {/* When a deal is clicked, we show the ContactProfileDrawer passing the contactId info. 
          For full implementation, we would fetch the Contact by contactId. Here we pass a mock wrapper. */}
      <ContactProfileDrawer 
        isOpen={!!selectedDeal} 
        onClose={() => setSelectedDeal(null)} 
        // Контакт из базы, а не выдуманный: раньше в карточке сделки
        // показывались «Client 1a2b», client@example.com и метка VIP.
        contact={dealContact}
        deals={selectedDeal ? [selectedDeal] : []}
      />
    </div>
  );
}
