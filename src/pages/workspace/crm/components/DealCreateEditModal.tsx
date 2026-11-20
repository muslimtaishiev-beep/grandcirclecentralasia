import React, { useState } from 'react';
import { Archive, ArchiveRestore } from 'lucide-react';
import { Modal, btn, btnPrimary, input, label, toast, confirmDialog } from '../../../../components/ui';
import { crmService } from '../../../../services/crmService';
import { CrmContact, CrmDeal, CrmPipeline } from '../../../../types/crm';

interface Props {
  tenantId: string;
  pipeline: CrmPipeline;
  /** Есть — правка, нет — создание. */
  deal?: CrmDeal;
  contacts: CrmContact[];
  author: { id: string; name: string };
  canManage: boolean;
  onClose: () => void;
}

export default function DealCreateEditModal({ tenantId, pipeline, deal, contacts, author, canManage, onClose }: Props) {
  const [title, setTitle] = useState(deal?.title || '');
  const [amount, setAmount] = useState(deal ? String(deal.amount || '') : '');
  const [contactId, setContactId] = useState(deal?.contactId || '');
  const [closeDate, setCloseDate] = useState(deal?.expectedCloseDate || '');
  const [busy, setBusy] = useState(false);
  const currency = deal?.currency || pipeline.currency || '';
  const active = contacts.filter(c => c.status !== 'archived' || c.id === contactId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !canManage) return;
    setBusy(true);
    try {
      const amt = Math.max(0, Number(amount) || 0);
      const c = contacts.find(x => x.id === contactId);
      if (deal) {
        await crmService.updateDeal(tenantId, deal.id, {
          title: title.trim(), amount: amt, contactId, expectedCloseDate: closeDate || undefined,
          ...(c ? { contactName: c.fullName, contactPhone: c.phone, contactEmail: c.email } : {}),
        }, author);
      } else {
        await crmService.createDeal(tenantId, {
          tenantId, pipelineId: pipeline.id, stageId: pipeline.stages[0]?.id || '', title: title.trim(), amount: amt, currency,
          contactId, ...(c ? { contactName: c.fullName, contactPhone: c.phone, contactEmail: c.email } : {}),
          ...(closeDate ? { expectedCloseDate: closeDate } : {}), source: 'manual', status: 'open', tags: [],
        }, author);
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось сохранить сделку');
    } finally { setBusy(false); }
  };

  const toggleArchive = async () => {
    if (!deal) return;
    if (!deal.archived && !(await confirmDialog({ title: 'Убрать сделку в архив?', confirmLabel: 'В архив' }))) return;
    try { await crmService.archiveDeal(tenantId, deal.id, !deal.archived, author); onClose(); }
    catch (err: any) { toast.error(err?.message || 'Не удалось выполнить'); }
  };

  return (
    <Modal title={deal ? 'Сделка' : 'Новая сделка'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div><label className={label}>Название</label><input className={input} required value={title} onChange={e => setTitle(e.target.value)} disabled={!canManage} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Сумма{currency ? `, ${currency}` : ''}</label><input className={input} type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} disabled={!canManage} /></div>
          <div><label className={label}>Закрытие</label><input className={input} type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} disabled={!canManage} /></div>
        </div>
        <div>
          <label className={label}>Контакт</label>
          <select className={input} value={contactId} onChange={e => setContactId(e.target.value)} disabled={!canManage}>
            <option value="">Без контакта</option>
            {active.map(c => <option key={c.id} value={c.id}>{c.fullName}{c.phone ? ` · ${c.phone}` : ''}</option>)}
          </select>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2 justify-end">
            {deal && <button type="button" className={`${btn} mr-auto`} onClick={toggleArchive}>{deal.archived ? <><ArchiveRestore className="w-4 h-4" /> Восстановить</> : <><Archive className="w-4 h-4" /> В архив</>}</button>}
            <button type="button" className={btn} onClick={onClose}>Отмена</button>
            <button type="submit" className={btnPrimary} disabled={busy}>Сохранить</button>
          </div>
        )}
      </form>
    </Modal>
  );
}
