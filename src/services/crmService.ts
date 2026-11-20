import { db } from '../lib/firebase';
import {
  collection, doc, onSnapshot, query, where, limit, setDoc, addDoc, deleteDoc,
  serverTimestamp, writeBatch, updateDoc,
} from 'firebase/firestore';
import { CrmPipeline, CrmDeal, CrmContact, CrmActivityLog, PipelineStage } from '../types/crm';

/** Валюта по умолчанию, если у воронки своя не задана. */
export const DEFAULT_CURRENCY = 'KGS';

/** Этапы новой воронки — стартовая точка, владелец правит под себя. */
export const DEFAULT_STAGES: PipelineStage[] = [
  { id: 'new', name: 'Новый', color: '#3b82f6', order: 0, probabilityPercent: 10 },
  { id: 'work', name: 'В работе', color: '#8b5cf6', order: 1, probabilityPercent: 40 },
  { id: 'decision', name: 'Принимает решение', color: '#f59e0b', order: 2, probabilityPercent: 70 },
  { id: 'won', name: 'Успешно', color: '#10b981', order: 3, probabilityPercent: 100, isWonStage: true },
  { id: 'lost', name: 'Отказ', color: '#ef4444', order: 4, probabilityPercent: 0, isLostStage: true },
];

const STAGE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899', '#64748b'];

const toMs = (v: any): number => (typeof v === 'number' ? v : v?.toMillis?.() ?? (v ? Date.parse(v) || 0 : 0));

/**
 * Старые воронки хранили этапы строками, без createdAt и isDefault — из-за
 * orderBy('createdAt') они не попадали в выдачу, и «Сделки» висели вечно.
 * Приводим к одному виду на чтении; id строковых этапов — s0, s1… (сохраняются
 * при первой правке воронки).
 */
export function normalizePipeline(id: string, raw: any): CrmPipeline {
  const stages: PipelineStage[] = (Array.isArray(raw?.stages) ? raw.stages : []).map((s: any, i: number) =>
    typeof s === 'string'
      ? { id: `s${i}`, name: s, color: STAGE_COLORS[i % STAGE_COLORS.length], order: i, probabilityPercent: 0 }
      : {
          id: String(s?.id || `s${i}`), name: String(s?.name || `Этап ${i + 1}`),
          color: String(s?.color || STAGE_COLORS[i % STAGE_COLORS.length]),
          order: Number.isFinite(s?.order) ? s.order : i,
          probabilityPercent: Number(s?.probabilityPercent) || 0,
          ...(s?.isWonStage ? { isWonStage: true } : {}),
          ...(s?.isLostStage ? { isLostStage: true } : {}),
        });
  stages.sort((a, b) => a.order - b.order);
  return {
    id, tenantId: raw?.tenantId || '', name: raw?.name || 'Воронка', stages,
    isDefault: !!raw?.isDefault, departmentId: raw?.departmentId,
    currency: raw?.currency || DEFAULT_CURRENCY, createdAt: toMs(raw?.createdAt),
  };
}

export function normalizeDeal(id: string, raw: any): CrmDeal {
  return {
    ...raw,
    id,
    tenantId: raw?.tenantId || '',
    pipelineId: raw?.pipelineId || '',
    stageId: String(raw?.stageId || ''),
    title: raw?.title || raw?.contactName || 'Без названия',
    amount: Number(raw?.amount ?? raw?.value) || 0,
    currency: raw?.currency || '',
    contactId: raw?.contactId || '',
    status: raw?.status || 'open',
    tags: Array.isArray(raw?.tags) ? raw.tags : [],
    createdAt: toMs(raw?.createdAt),
    updatedAt: toMs(raw?.updatedAt),
  } as CrmDeal;
}

/**
 * Этап сделки в воронке. Старые сделки приёма записаны с stage_new/stage_won
 * и без pipelineId — они кладутся на первый этап (или «успех»/«отказ»).
 */
export function stageOfDeal(deal: CrmDeal, pipeline: CrmPipeline): string {
  if (pipeline.stages.some(s => s.id === deal.stageId)) return deal.stageId;
  const won = pipeline.stages.find(s => s.isWonStage), lost = pipeline.stages.find(s => s.isLostStage);
  if (/won/i.test(deal.stageId) && won) return won.id;
  if (/lost/i.test(deal.stageId) && lost) return lost.id;
  return pipeline.stages[0]?.id || '';
}

/** Сделка этой воронки: своя или старая без воронки — в воронке по умолчанию. */
export const dealInPipeline = (deal: CrmDeal, pipeline: CrmPipeline, defaultId: string) =>
  deal.pipelineId ? deal.pipelineId === pipeline.id : pipeline.id === defaultId;

type Author = { id: string; name: string };

class CrmService {
  subscribeToPipelines(tenantId: string, onUpdate: (pipelines: CrmPipeline[]) => void, onError?: (e: Error) => void) {
    const q = query(collection(db, 'tenants', tenantId, 'crm_pipelines'));
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => normalizePipeline(d.id, d.data()));
      list.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.createdAt - b.createdAt || a.name.localeCompare(b.name));
      onUpdate(list);
    }, e => onError?.(e));
  }

  /** Все сделки организации: старые записи без pipelineId тоже нужны. */
  subscribeToDeals(tenantId: string, onUpdate: (deals: CrmDeal[]) => void, onError?: (e: Error) => void) {
    const q = query(collection(db, 'tenants', tenantId, 'crm_deals'), limit(2000));
    return onSnapshot(q, snap => onUpdate(snap.docs.map(d => normalizeDeal(d.id, d.data()))), e => onError?.(e));
  }

  subscribeToLogs(tenantId: string, targetId: string, onUpdate: (logs: CrmActivityLog[]) => void) {
    const q = query(collection(db, 'tenants', tenantId, 'crm_logs'), where('targetId', '==', targetId), limit(100));
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ ...(d.data() as any), id: d.id } as CrmActivityLog));
      list.sort((a, b) => b.timestamp - a.timestamp);
      onUpdate(list);
    }, () => onUpdate([]));
  }

  private log(batch: ReturnType<typeof writeBatch>, tenantId: string, targetType: 'deal' | 'contact', targetId: string, author: Author, action: CrmActivityLog['action'], details: string) {
    batch.set(doc(collection(db, 'tenants', tenantId, 'crm_logs')), {
      tenantId, targetType, targetId, authorStaffId: author.id, authorName: author.name, action, details, timestamp: Date.now(),
    } as Omit<CrmActivityLog, 'id'>);
  }

  // ── Воронки ──

  async savePipeline(tenantId: string, p: { id?: string; name: string; stages: PipelineStage[]; currency?: string; isDefault?: boolean }, author: Author) {
    const ref = p.id ? doc(db, 'tenants', tenantId, 'crm_pipelines', p.id) : doc(collection(db, 'tenants', tenantId, 'crm_pipelines'));
    const stages = p.stages.map((s, i) => ({
      id: s.id, name: s.name.trim() || `Этап ${i + 1}`, color: s.color, order: i, probabilityPercent: Math.max(0, Math.min(100, Number(s.probabilityPercent) || 0)),
      ...(s.isWonStage ? { isWonStage: true } : {}), ...(s.isLostStage ? { isLostStage: true } : {}),
    }));
    const batch = writeBatch(db);
    batch.set(ref, {
      tenantId, name: p.name.trim() || 'Воронка', stages, currency: (p.currency || DEFAULT_CURRENCY).trim().slice(0, 8),
      isDefault: !!p.isDefault, updatedAt: Date.now(), ...(p.id ? {} : { createdAt: Date.now() }),
    }, { merge: true });
    this.log(batch, tenantId, 'deal', ref.id, author, 'pipeline_saved', `Воронка «${p.name.trim()}»`);
    await batch.commit();
    return ref.id;
  }

  async setDefaultPipeline(tenantId: string, pipelines: CrmPipeline[], id: string) {
    const batch = writeBatch(db);
    for (const p of pipelines) if (p.isDefault !== (p.id === id)) batch.update(doc(db, 'tenants', tenantId, 'crm_pipelines', p.id), { isDefault: p.id === id });
    await batch.commit();
  }

  async deletePipeline(tenantId: string, id: string) {
    await deleteDoc(doc(db, 'tenants', tenantId, 'crm_pipelines', id));
  }

  // ── Сделки ──

  async moveDealStage(tenantId: string, dealId: string, targetStageId: string, newStatus: 'open' | 'won' | 'lost', author: Author, stageName?: string, pipelineId?: string) {
    const batch = writeBatch(db);
    batch.update(doc(db, 'tenants', tenantId, 'crm_deals', dealId), { stageId: targetStageId, status: newStatus, ...(pipelineId ? { pipelineId } : {}), updatedAt: serverTimestamp() });
    this.log(batch, tenantId, 'deal', dealId, author, 'stage_changed', `Этап: ${stageName || targetStageId}`);
    await batch.commit();
  }

  async createDeal(tenantId: string, deal: Omit<CrmDeal, 'id' | 'createdAt' | 'updatedAt'>, author?: Author) {
    const ref = doc(collection(db, 'tenants', tenantId, 'crm_deals'));
    const batch = writeBatch(db);
    batch.set(ref, { ...deal, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    if (author) this.log(batch, tenantId, 'deal', ref.id, author, 'deal_created', `Сделка «${deal.title}»`);
    await batch.commit();
    return ref.id;
  }

  async updateDeal(tenantId: string, dealId: string, patch: Partial<CrmDeal>, author: Author) {
    const { id: _id, createdAt: _c, ...rest } = patch as any;
    const batch = writeBatch(db);
    batch.update(doc(db, 'tenants', tenantId, 'crm_deals', dealId), { ...rest, updatedAt: serverTimestamp() });
    this.log(batch, tenantId, 'deal', dealId, author, 'deal_updated', 'Сделка изменена');
    await batch.commit();
  }

  async archiveDeal(tenantId: string, dealId: string, archived: boolean, author: Author) {
    const batch = writeBatch(db);
    batch.update(doc(db, 'tenants', tenantId, 'crm_deals', dealId), archived
      ? { archived: true, archivedAt: Date.now(), archivedBy: author.id, updatedAt: serverTimestamp() }
      : { archived: false, updatedAt: serverTimestamp() });
    this.log(batch, tenantId, 'deal', dealId, author, archived ? 'deal_archived' : 'deal_restored', archived ? 'В архив' : 'Из архива');
    await batch.commit();
  }

  async addNote(tenantId: string, targetType: 'deal' | 'contact', targetId: string, text: string, author: Author) {
    const batch = writeBatch(db);
    this.log(batch, tenantId, targetType, targetId, author, 'note_added', text.trim().slice(0, 2000));
    await batch.commit();
  }

  // ── Контакты (общая копия + копия в организации) ──

  subscribeToContacts(tenantId: string, onUpdate: (c: CrmContact[]) => void, onError?: (e: Error) => void) {
    const q = query(collection(db, 'crm_contacts'), where('tenantId', '==', tenantId), limit(1000));
    return onSnapshot(q, snap => onUpdate(snap.docs.map(d => {
      const x: any = d.data();
      return {
        id: d.id, tenantId: x.tenantId, fullName: x.fullName || x.name || 'Без имени',
        email: x.email && x.email !== '—' ? x.email : '', phone: x.phone != null && x.phone !== '—' ? String(x.phone) : '',
        type: x.type || 'student', companyName: x.companyName || '', tags: Array.isArray(x.tags) ? x.tags : [],
        status: x.status === 'archived' ? 'archived' : 'active', archivedAt: x.archivedAt,
        totalDealsCount: x.totalDealsCount || 0, totalRevenueGenerated: x.totalRevenueGenerated || 0,
        createdAt: toMs(x.createdAt), updatedAt: toMs(x.updatedAt), avatarUrl: x.avatarUrl,
      } as CrmContact;
    })), e => onError?.(e));
  }

  async createContact(tenantId: string, c: { fullName: string; phone: string; email: string; type: CrmContact['type']; companyName?: string }) {
    const data = {
      tenantId, fullName: c.fullName.trim(), name: c.fullName.trim(), phone: c.phone.trim(), email: c.email.trim(),
      type: c.type, companyName: (c.companyName || '').trim(), status: 'active', tags: [],
      totalDealsCount: 0, totalRevenueGenerated: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, 'crm_contacts'), data);
    try { await setDoc(doc(db, 'tenants', tenantId, 'crm_contacts', ref.id), data); } catch { /* копия в организации — не обязательна */ }
    return ref.id;
  }

  async updateContact(tenantId: string, id: string, patch: Partial<Pick<CrmContact, 'fullName' | 'phone' | 'email' | 'type' | 'companyName'>>) {
    const data: any = { ...patch, updatedAt: serverTimestamp() };
    if (patch.fullName) data.name = patch.fullName;
    await updateDoc(doc(db, 'crm_contacts', id), data);
    try { await setDoc(doc(db, 'tenants', tenantId, 'crm_contacts', id), data, { merge: true }); } catch { /* нет копии */ }
  }

  async archiveContact(tenantId: string, id: string, archived: boolean, author: Author) {
    const data = archived ? { status: 'archived', archivedAt: Date.now(), archivedBy: author.id } : { status: 'active' };
    await updateDoc(doc(db, 'crm_contacts', id), data);
    try { await setDoc(doc(db, 'tenants', tenantId, 'crm_contacts', id), data, { merge: true }); } catch { /* нет копии */ }
    const batch = writeBatch(db);
    this.log(batch, tenantId, 'contact', id, author, archived ? 'contact_archived' : 'contact_restored', archived ? 'В архив' : 'Из архива');
    await batch.commit();
  }

  /** Окончательно — только из архива. */
  async deleteContact(tenantId: string, id: string, name: string, author: Author) {
    await deleteDoc(doc(db, 'crm_contacts', id));
    try { await deleteDoc(doc(db, 'tenants', tenantId, 'crm_contacts', id)); } catch { /* нет копии */ }
    const batch = writeBatch(db);
    this.log(batch, tenantId, 'contact', id, author, 'contact_deleted', `Удалён контакт «${name}»`);
    await batch.commit();
  }
}

export const crmService = new CrmService();
