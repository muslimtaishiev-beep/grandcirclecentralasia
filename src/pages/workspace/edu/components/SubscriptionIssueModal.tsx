import React, { useState, useEffect } from 'react';
import { useWorkspaceTerms } from '../../../../lib/useWorkspaceConfig';
import { X, DollarSign, BookOpen, User, Check, Loader2 } from 'lucide-react';
import { db } from '../../../../lib/firebase';
import { collection, doc, setDoc, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { SubscriptionType } from '../../../../types/edu';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
}

export default function SubscriptionIssueModal({ isOpen, onClose, tenantId }: Props) {
  const terms = useWorkspaceTerms();
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [customStudentName, setCustomStudentName] = useState('');
  const [type, setType] = useState<SubscriptionType>('lessons_pack');
  const [totalLessons, setTotalLessons] = useState('12');
  const [price, setPrice] = useState('5000');
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !tenantId) return;

    setLoadingStudents(true);
    const q = query(collection(db, 'crm_contacts'), where('tenantId', '==', tenantId));
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({ id: d.id, name: data.fullName || data.name || 'Студент', phone: data.phone || '' });
      });
      setStudents(list);
      if (list.length > 0 && !selectedStudentId) {
        setSelectedStudentId(list[0].id);
      }
      setLoadingStudents(false);
    }, (err) => {
      console.warn("Students fetch notice:", err);
      setLoadingStudents(false);
    });

    return () => unsub();
  }, [isOpen, tenantId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totalLessons || !price) return;

    try {
      setLoading(true);
      const studentObj = students.find(s => s.id === selectedStudentId);
      const studentName = studentObj ? studentObj.name : (customStudentName.trim() || 'Студент');
      const studentContactId = selectedStudentId || `student_${Date.now()}`;

      const now = new Date();
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + 1); // 1 month default validity

      const subData = {
        tenantId,
        studentContactId,
        studentName,
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
      };

      const ref1 = doc(collection(db, 'tenants', tenantId, 'edu_subscriptions'));
      await setDoc(ref1, subData);

      const ref2 = doc(collection(db, 'edu_subscriptions'));
      await setDoc(ref2, subData);

      onClose();
    } catch (err: any) {
      alert(`Ошибка выдачи абонемента: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[var(--bg-panel)] rounded-2xl max-w-md w-full shadow-2xl border border-[var(--border-color)]">
        <div className="flex justify-between items-center p-5 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-bold text-[var(--text-main)]">{`Выдать ${terms.subscription.toLowerCase()}: ${terms.student.toLowerCase()}`}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-black/10 rounded-xl transition text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">{`Выбрать из CRM: ${terms.student.toLowerCase()} *`}</label>
            {loadingStudents ? (
              <div className="flex items-center gap-2 py-2 text-xs text-[var(--text-muted)]">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> {`Загрузка: ${terms.student.toLowerCase()}…`}
              </div>
            ) : students.length > 0 ? (
              <select 
                value={selectedStudentId}
                onChange={e => setSelectedStudentId(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500 font-mono"
              >
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    👤 {s.name} {s.phone ? `(${s.phone})` : ''}
                  </option>
                ))}
                <option value="">-- Ввести имя вручную --</option>
              </select>
            ) : (
              <input 
                type="text"
                required
                placeholder={`ФИО: ${terms.student.toLowerCase()}`}
                value={customStudentName}
                onChange={e => setCustomStudentName(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">{`Тип: ${terms.subscription.toLowerCase()}`}</label>
            <select 
              value={type}
              onChange={e => setType(e.target.value as SubscriptionType)}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
            >
              <option value="lessons_pack">Пакет занятий (8, 12 или 24 урока)</option>
              <option value="time_period">Безлимит на 1 месяц</option>
              <option value="deposit_balance">Депозит / Баланс</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Кол-во занятий</label>
              <div className="relative">
                <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input 
                  type="number" 
                  required
                  value={totalLessons}
                  onChange={e => setTotalLessons(e.target.value)}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-9 pr-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Стоимость (KGS)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input 
                  type="number" 
                  required
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-9 pr-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 flex gap-2 justify-end border-t border-[var(--border-color)]">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 bg-[var(--bg-surface)] border text-[var(--text-main)] font-bold rounded-xl text-xs"
            >
              Отмена
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{`Выдать ${terms.subscription.toLowerCase()}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
