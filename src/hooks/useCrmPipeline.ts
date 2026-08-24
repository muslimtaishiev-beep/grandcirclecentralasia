import { useState, useEffect } from 'react';
import { crmService } from '../services/crmService';
import { CrmPipeline, CrmDeal } from '../types/crm';
import { useAuth } from '../contexts/AuthContext';

export function useCrmPipeline(tenantId: string) {
  const { user } = useAuth();
  const [pipelines, setPipelines] = useState<CrmPipeline[]>([]);
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = crmService.subscribeToPipelines(tenantId, (data) => {
      setPipelines(data);
      if (data.length > 0 && !activePipelineId) {
        const defaultPipe = data.find(p => p.isDefault) || data[0];
        setActivePipelineId(defaultPipe.id);
      }
    });
    return () => unsub();
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId || !activePipelineId) return;
    const unsub = crmService.subscribeToDeals(tenantId, activePipelineId, (data) => {
      setDeals(data);
    });
    return () => unsub();
  }, [tenantId, activePipelineId]);

  const activePipeline = pipelines.find(p => p.id === activePipelineId);

  const moveDeal = async (dealId: string, targetStageId: string) => {
    if (!activePipeline) return;
    
    const targetStage = activePipeline.stages.find(s => s.id === targetStageId);
    let newStatus: 'open' | 'won' | 'lost' = 'open';
    if (targetStage?.isWonStage) newStatus = 'won';
    else if (targetStage?.isLostStage) newStatus = 'lost';

    // Optimistic update
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stageId: targetStageId, status: newStatus } : d));

    await crmService.moveDealStage(tenantId, dealId, targetStageId, newStatus, {
      id: user?.uid || 'unknown',
      name: user?.displayName || user?.email || 'System'
    });
  };

  return {
    pipelines,
    activePipelineId,
    setActivePipelineId,
    activePipeline,
    deals,
    moveDeal
  };
}
