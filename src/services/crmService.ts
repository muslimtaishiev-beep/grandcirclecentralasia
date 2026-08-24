import { db } from '../lib/firebase';
import { collection, doc, onSnapshot, query, where, orderBy, setDoc, addDoc, serverTimestamp, writeBatch, updateDoc } from 'firebase/firestore';
import { CrmPipeline, CrmDeal, CrmContact, CrmActivityLog } from '../types/crm';

class CrmService {
  subscribeToPipelines(tenantId: string, onUpdate: (pipelines: CrmPipeline[]) => void) {
    const q = query(
      collection(db, 'tenants', tenantId, 'crm_pipelines'),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as CrmPipeline)));
    });
  }

  subscribeToDeals(tenantId: string, pipelineId: string, onUpdate: (deals: CrmDeal[]) => void) {
    const q = query(
      collection(db, 'tenants', tenantId, 'crm_deals'),
      where('pipelineId', '==', pipelineId)
    );
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as CrmDeal)));
    });
  }

  async moveDealStage(
    tenantId: string, 
    dealId: string, 
    targetStageId: string, 
    newStatus: 'open' | 'won' | 'lost',
    author: { id: string; name: string }
  ) {
    const batch = writeBatch(db);
    
    // Update deal
    const dealRef = doc(db, 'tenants', tenantId, 'crm_deals', dealId);
    batch.update(dealRef, {
      stageId: targetStageId,
      status: newStatus,
      updatedAt: serverTimestamp()
    });

    // Add activity log
    const logRef = doc(collection(db, 'tenants', tenantId, 'crm_logs'));
    batch.set(logRef, {
      tenantId,
      targetType: 'deal',
      targetId: dealId,
      authorStaffId: author.id,
      authorName: author.name,
      action: 'stage_changed',
      details: `Moved to stage ${targetStageId} with status ${newStatus}`,
      timestamp: Date.now()
    } as Omit<CrmActivityLog, 'id'>);

    await batch.commit();
  }

  async createDeal(tenantId: string, deal: Omit<CrmDeal, 'id' | 'createdAt' | 'updatedAt'>) {
    const ref = doc(collection(db, 'tenants', tenantId, 'crm_deals'));
    await setDoc(ref, {
      ...deal,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return ref.id;
  }
}

export const crmService = new CrmService();
