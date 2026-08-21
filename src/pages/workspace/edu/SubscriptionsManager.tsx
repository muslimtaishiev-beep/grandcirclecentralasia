import React, { useState, useEffect } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { CreditCard, Plus, Users, ShieldCheck, Check, Clock, AlertCircle, Trash2 } from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { StudentSubscription, FamilyProfile } from '../../../types/edu';

export default function SubscriptionsManager() {
  const { activeTenant } = useOutletContext<any>();
  const { orgId } = useParams();

  const [subscriptions, setSubscriptions] = useState<StudentSubscription[]>([]);
  const [families, setFamilies] = useState<FamilyProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Subscription Modal State
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [packageName, setPackageName] = useState('8 уроков (Стандарт)');
  const [totalLessons, setTotalLessons] = useState(8);
  const [price, setPrice] = useState(25000);

  useEffect(() => {
    if (!orgId) return;

    const qSub = query(collection(db, 'subscriptions'), where('tenantId', '==', orgId));
    const unsubSub = onSnapshot(qSub, (snap) => {
      const items: StudentSubscription[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentSubscription));
      setSubscriptions(items);
      setLoading(false);
    });

    const qFam = query(collection(db, 'family_profiles'), where('tenantId', '==', orgId));
    const unsubFam = onSnapshot(qFam, (snap) => {
      const fams: FamilyProfile[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as FamilyProfile));
      setFamilies(fams);
    });

    return () => {
      unsubSub();
      unsubFam();
    };
  }, [orgId]);

  const handleAddSubscription = async () => {
    if (!studentName || !packageName) return;

    try {
      const studentId = 'std_' + Date.now();
      await addDoc(collection(db, 'subscriptions'), {
        tenantId: orgId,
        studentId,
        studentName,
        parentName: parentName || 'Родитель',
        parentPhone: parentPhone || '',
        packageName,
        totalLessons: Number(totalLessons),
        remainingLessons: Number(totalLessons),
        price: Number(price),
        isPaid: true,
        status: 'active',
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        createdAt: serverTimestamp(),
      });

      setIsSubModalOpen(false);
      setStudentName('');
      setParentName('');
      setParentPhone('');
    } catch (err: any) {
      alert('Ошибка при выписке абонемента: ' + err.message);
    }
  };

  const handleDeleteSub = async (id: string) => {
    if (confirm('Удалить абонемент?')) {
      await deleteDoc(doc(db, 'subscriptions', id));
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)] flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-[var(--accent)]" /> Абонементы и Семейный Баланс
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Выписка пакетов уроков, контроль баланса исвязь «Родитель ↔ Ученик»
          </p>
        </div>

        <button
          onClick={() => setIsSubModalOpen(true)}
          className="bg-[var(--accent)] text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:opacity-90 transition shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4.5 h-4.5" /> Выписать абонемент
        </button>
      </div>

      {/* Subscriptions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {subscriptions.map((sub) => (
          <div key={sub.id} className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 rounded-xl shadow-xs hover:border-[var(--accent)] transition flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-[var(--accent)]/10 text-[var(--accent)]">
                  {sub.packageName}
                </span>
                <button onClick={() => handleDeleteSub(sub.id)} className="text-[var(--text-muted)] hover:text-red-500 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <h3 className="text-base font-bold text-[var(--text-main)]">{sub.studentName}</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Родитель: {sub.parentName || 'Не указан'}</p>

              <div className="mt-4 bg-[var(--bg-app)] p-3 rounded-lg border border-[var(--border-color)] space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Остаток уроков:</span>
                  <span className="font-bold text-[var(--text-main)] font-mono">{sub.remainingLessons} из {sub.totalLessons}</span>
                </div>
                <div className="w-full bg-[var(--border-color)] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[var(--accent)] h-full transition-all"
                    style={{ width: `${(sub.remainingLessons / sub.totalLessons) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--border-color)] flex items-center justify-between text-xs">
              <span className="font-bold text-[var(--text-main)]">{sub.price?.toLocaleString()} KZT</span>
              <span className="text-emerald-500 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Оплачено
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Form */}
      {isSubModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4 animate-in fade-in duration-200">
            <h2 className="text-lg font-bold text-[var(--text-main)]">Выписка нового абонемента</h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] mb-1 block">ФИО Ученика</label>
                <input
                  type="text"
                  placeholder="Алина Русланова"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] mb-1 block">ФИО Родителя</label>
                <input
                  type="text"
                  placeholder="Руслан Русланов"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] mb-1 block">Пакет уроков</label>
                <select
                  value={packageName}
                  onChange={(e) => {
                    setPackageName(e.target.value);
                    if (e.target.value.includes('8')) { setTotalLessons(8); setPrice(25000); }
                    if (e.target.value.includes('12')) { setTotalLessons(12); setPrice(35000); }
                  }}
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="8 уроков (Стандарт)">8 уроков (25 000 KZT)</option>
                  <option value="12 уроков (Интенсив)">12 уроков (35 000 KZT)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border-color)]">
              <button
                onClick={() => setIsSubModalOpen(false)}
                className="bg-[var(--bg-app)] text-[var(--text-muted)] border border-[var(--border-color)] px-4 py-2 rounded-lg text-sm hover:text-[var(--text-main)] transition"
              >
                Отмена
              </button>
              <button
                onClick={handleAddSubscription}
                className="bg-[var(--accent)] text-white px-5 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition shadow-sm"
              >
                Выписать
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
