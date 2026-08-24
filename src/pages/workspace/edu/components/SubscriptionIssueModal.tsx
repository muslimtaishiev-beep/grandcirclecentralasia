import React, { useState } from 'react';
import { X, Calendar, DollarSign, BookOpen } from 'lucide-react';
import { db } from '../../../../lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { SubscriptionType } from '../../../../types/edu';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
}

export default function SubscriptionIssueModal({ isOpen, onClose, tenantId }: Props) {
  const [studentContactId, setStudentContactId] = useState('');
  const [type, setType] = useState<SubscriptionType>('lessons_pack');
  const [totalLessons, setTotalLessons] = useState('12');
  const [price, setPrice] = useState('5000');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentContactId || !totalLessons || !price) return;

    try {
      setLoading(true);
      const ref = doc(collection(db, 'tenants', tenantId, 'edu_subscriptions'));
      
      const now = new Date();
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + 1); // 1 month default validity

      await setDoc(ref, {
        tenantId,
        studentContactId,
        studentName: 'Студент ' + studentContactId.substring(0, 4), // mock
        type,
        totalLessons: parseInt(totalLessons, 10),
        remainingLessons: parseInt(totalLessons, 10),
        pricePaid: parseFloat(price),
        currency: 'KGS',
        startDate: now.toISOString(),
        expiryDate: expiry.toISOString(),
        isFrozen: false,
        status: 'active',
        createdAt: Date.now()
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
          <h2 className="text-xl font-bold">Выдать абонемент</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-[var(--text-muted)] mb-1">ID Студента</label>
            <input 
              type="text" 
              required
              value={studentContactId}
              onChange={e => setStudentContactId(e.target.value)}
              placeholder="Введите ID"
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-[var(--text-muted)] mb-1">Тип абонемента</label>
            <select 
              value={type}
              onChange={e => setType(e.target.value as SubscriptionType)}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="lessons_pack">Пакет занятий</option>
              <option value="time_period">Безлимит (Месяц)</option>
              <option value="deposit_balance">Депозит</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-[var(--text-muted)] mb-1">Кол-во занятий</label>
              <div className="relative">
                <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input 
                  type="number" 
                  required
                  value={totalLessons}
                  onChange={e => setTotalLessons(e.target.value)}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-3 text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-[var(--text-muted)] mb-1">Стоимость (KGS)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input 
                  type="number" 
                  required
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-3 text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
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
              {loading ? 'Создание...' : 'Выдать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
