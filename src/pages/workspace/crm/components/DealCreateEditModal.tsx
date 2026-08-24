import React, { useState } from 'react';
import { X, DollarSign, Tag } from 'lucide-react';
import { crmService } from '../../../../services/crmService';
import { CrmPipeline } from '../../../../types/crm';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  pipeline: CrmPipeline;
}

export default function DealCreateEditModal({ isOpen, onClose, tenantId, pipeline }: Props) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [contactId, setContactId] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount || !contactId) return;

    try {
      setLoading(true);
      await crmService.createDeal(tenantId, {
        tenantId,
        pipelineId: pipeline.id,
        stageId: pipeline.stages[0].id,
        title,
        amount: parseFloat(amount),
        currency: 'KGS',
        contactId,
        source: 'manual',
        status: 'open',
        tags: []
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[var(--bg-panel)] rounded-2xl max-w-md w-full shadow-2xl border border-[var(--border-color)]">
        <div className="flex justify-between items-center p-6 border-b border-[var(--border-color)]">
          <h2 className="text-xl font-bold">Новая сделка</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-[var(--text-muted)] mb-1">Название сделки</label>
            <input 
              type="text" 
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
              placeholder="Например: Покупка курса Python"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-[var(--text-muted)] mb-1">Сумма (KGS)</label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
              <input 
                type="number" 
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-12 pr-4 py-3 text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[var(--text-muted)] mb-1">ID Контакта (Клиент)</label>
            <div className="relative">
              <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
              <input 
                type="text" 
                required
                value={contactId}
                onChange={e => setContactId(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-12 pr-4 py-3 text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                placeholder="ID клиента в системе"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-[var(--text-main)] font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              Отмена
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 py-3 bg-[var(--accent)] text-white font-bold rounded-xl shadow-lg hover:brightness-110 transition disabled:opacity-50"
            >
              {loading ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
