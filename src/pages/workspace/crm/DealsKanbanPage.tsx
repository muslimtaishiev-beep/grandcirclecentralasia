import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { DndContext, DragOverlay, closestCorners, DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { Archive, Briefcase, Plus, Settings2 } from 'lucide-react';
import { Button, EmptyState, Spinner, toast, confirmDialog } from '../../../components/ui';
import { useCrmPipeline } from '../../../hooks/useCrmPipeline';
import { useCrmPerms } from '../../../hooks/useCrmPerms';
import { crmService } from '../../../services/crmService';
import { CrmContact, CrmDeal } from '../../../types/crm';
import DealKanbanColumn from './components/DealKanbanColumn';
import DealCard from './components/DealCard';
import DealCreateEditModal from './components/DealCreateEditModal';
import PipelineEditorModal from './components/PipelineEditorModal';

export default function DealsKanbanPage() {
  const { activeTenant } = useOutletContext<any>();
  const tenantId: string = activeTenant?.id;
  const { canManage } = useCrmPerms();
  const { pipelines, activePipelineId, setActivePipelineId, activePipeline, deals, moveDeal, loaded, error, author } = useCrmPipeline(tenantId);

  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [activeDragDeal, setActiveDragDeal] = useState<CrmDeal | null>(null);
  const [dealModal, setDealModal] = useState<{ deal?: CrmDeal } | null>(null);
  const [pipelineModal, setPipelineModal] = useState<'new' | 'edit' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    return crmService.subscribeToContacts(tenantId, setContacts);
  }, [tenantId]);

  const visible = useMemo(() => deals.filter(d => !!d.archived === showArchived), [deals, showArchived]);
  const dealsByStage = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of deals) m[d.stageId] = (m[d.stageId] || 0) + 1;
    return m;
  }, [deals]);

  if (!loaded) return <div className="p-10 flex justify-center"><Spinner /></div>;
  if (error && !pipelines.length) return <EmptyState title={error} />;

  if (!activePipeline) {
    return (
      <>
        <EmptyState
          icon={<Briefcase className="w-8 h-8" />}
          title="Воронок пока нет"
          action={canManage ? (
            <div className="flex gap-2 justify-center">
              <Button loading={creating} onClick={async () => {
                setCreating(true);
                try { await crmService.ensureDefaultPipeline(tenantId, author); } catch (e: any) { toast.error(e?.message || 'Не удалось создать воронку'); } finally { setCreating(false); }
              }}>Создать воронку</Button>
              <Button variant="secondary" onClick={() => setPipelineModal('new')}>Настроить этапы</Button>
            </div>
          ) : undefined}
        />
        {pipelineModal && renderPipelineModal('new', () => setPipelineModal(null))}
      </>
    );
  }

  function renderPipelineModal(mode: 'new' | 'edit', onClose: () => void) {
    const editing = mode === 'edit' ? activePipeline : undefined;
    return (
      <PipelineEditorModal
        pipeline={editing}
        dealsByStage={dealsByStage}
        canDelete={canManage && !!editing && pipelines.length > 1 && deals.length === 0}
        onSave={async p => {
          const id = await crmService.savePipeline(tenantId, { ...p, isDefault: p.isDefault || pipelines.length === 0 }, author);
          if (mode === 'new') setActivePipelineId(id);
        }}
        onDelete={editing ? async () => {
          if (!(await confirmDialog({ title: `Удалить воронку «${editing.name}»?`, confirmLabel: 'Удалить', danger: true }))) throw new Error('Отменено');
          await crmService.deletePipeline(tenantId, editing.id);
          if (editing.isDefault) { const next = pipelines.find(x => x.id !== editing.id); if (next) await crmService.setDefaultPipeline(tenantId, pipelines.filter(x => x.id !== editing.id), next.id); }
          setActivePipelineId(null);
        } : undefined}
        onClose={onClose}
      />
    );
  }

  const handleDragStart = (e: DragStartEvent) => {
    if (e.active.data.current?.type === 'Deal') setActiveDragDeal(e.active.data.current.deal);
  };
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDragDeal(null);
    const { active, over } = e;
    if (!canManage || !over || active.id === over.id) return;
    if (active.data.current?.type === 'Deal' && over.data.current?.type === 'Column') {
      moveDeal(active.id as string, over.id as string).catch(() => toast.error('Не удалось переместить сделку'));
    }
  };

  return (
    <div className="h-full flex flex-col -m-4 md:-m-6 relative">
      <div className="bg-[var(--bg-panel)] p-4 border-b border-[var(--border-color)] flex flex-wrap items-center justify-between gap-3 z-10 shrink-0">
        <div className="flex items-center gap-2">
          <select
            value={activePipelineId || ''}
            onChange={e => setActivePipelineId(e.target.value)}
            className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-sm font-bold text-[var(--text-main)] focus:outline-none"
          >
            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {canManage && <Button variant="ghost" size="sm" icon={<Settings2 className="w-4 h-4" />} onClick={() => setPipelineModal('edit')}>Этапы</Button>}
          {canManage && <Button variant="ghost" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setPipelineModal('new')}>Воронка</Button>}
          <Button variant={showArchived ? 'secondary' : 'ghost'} size="sm" icon={<Archive className="w-4 h-4" />} onClick={() => setShowArchived(v => !v)}>Архив</Button>
        </div>
        {canManage && <Button icon={<Plus className="w-4 h-4" />} onClick={() => setDealModal({})}>Новая сделка</Button>}
      </div>

      <div className="flex-1 overflow-x-auto p-6 bg-[var(--bg-app)]">
        <DndContext collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-6 h-full min-w-max pb-4 items-start">
            {activePipeline.stages.map(stage => (
              <DealKanbanColumn
                key={stage.id} stage={stage} currency={activePipeline.currency} draggable={canManage && !showArchived}
                deals={visible.filter(d => d.stageId === stage.id)}
                onDealClick={deal => setDealModal({ deal })}
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

      {dealModal && (
        <DealCreateEditModal
          tenantId={tenantId} pipeline={activePipeline} deal={dealModal.deal} contacts={contacts}
          author={author} canManage={canManage} onClose={() => setDealModal(null)}
        />
      )}
      {pipelineModal && renderPipelineModal(pipelineModal, () => setPipelineModal(null))}
    </div>
  );
}
