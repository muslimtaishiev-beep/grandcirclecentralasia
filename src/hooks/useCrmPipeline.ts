import { useState, useEffect, useMemo } from 'react';
import { crmService, dealInPipeline, stageOfDeal } from '../services/crmService';
import { CrmPipeline, CrmDeal } from '../types/crm';
import { useAuth } from '../contexts/AuthContext';

export function useCrmPipeline(tenantId: string) {
  const { user } = useAuth();
  const [pipelines, setPipelines] = useState<CrmPipeline[]>([]);
  const [allDeals, setAllDeals] = useState<CrmDeal[]>([]);
  const [pickedId, setActivePipelineId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    setLoaded(false);
    const unsub = crmService.subscribeToPipelines(tenantId, data => { setPipelines(data); setLoaded(true); }, () => { setError('Не удалось загрузить воронки'); setLoaded(true); });
    return () => unsub();
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = crmService.subscribeToDeals(tenantId, setAllDeals, () => setError('Не удалось загрузить сделки'));
    return () => unsub();
  }, [tenantId]);

  const defaultId = (pipelines.find(p => p.isDefault) || pipelines[0])?.id || '';
  const activePipeline = pipelines.find(p => p.id === pickedId) || pipelines.find(p => p.id === defaultId);
  const activePipelineId = activePipeline?.id || null;

  /** Сделки активной воронки, с этапом, приведённым к её этапам. */
  const deals = useMemo(() => {
    if (!activePipeline) return [];
    return allDeals
      .filter(d => dealInPipeline(d, activePipeline, defaultId))
      .map(d => ({ ...d, stageId: stageOfDeal(d, activePipeline), currency: d.currency || activePipeline.currency || '' }));
  }, [allDeals, activePipeline, defaultId]);

  const author = { id: user?.uid || '', name: user?.displayName || user?.email || 'Сотрудник' };

  const moveDeal = async (dealId: string, targetStageId: string) => {
    if (!activePipeline) return;
    const target = activePipeline.stages.find(s => s.id === targetStageId);
    const newStatus: 'open' | 'won' | 'lost' = target?.isWonStage ? 'won' : target?.isLostStage ? 'lost' : 'open';
    const prev = allDeals;
    setAllDeals(p => p.map(d => (d.id === dealId ? { ...d, stageId: targetStageId, status: newStatus, pipelineId: d.pipelineId || activePipeline.id } : d)));
    try {
      await crmService.moveDealStage(tenantId, dealId, targetStageId, newStatus, author, target?.name, activePipeline.id);
    } catch (e) {
      setAllDeals(prev);
      throw e;
    }
  };

  return { pipelines, activePipelineId, setActivePipelineId, activePipeline, deals, allDeals, moveDeal, loaded, error, author, defaultId };
}
