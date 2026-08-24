import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, Snowflake } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { db } from '../../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { StudentSubscription } from '../../../types/edu';
import SubscriptionIssueModal from './components/SubscriptionIssueModal';

export default function SubscriptionsDirectoryPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subscriptions, setSubscriptions] = useState<StudentSubscription[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!activeTenant?.id) return;
    const q = query(collection(db, 'edu_subscriptions'), where('tenantId', '==', activeTenant.id));
    const unsub = onSnapshot(q, (snap) => {
      const list: StudentSubscription[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as StudentSubscription);
      });
      setSubscriptions(list);
    }, (err) => {
      console.warn("Edu subscriptions notice:", err);
    });
    return () => unsub();
  }, [activeTenant?.id]);

  const filtered = subscriptions.filter(s => 
    s.studentName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-[var(--bg-app)]">
      <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-panel)] shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-main)]">Абонементы</h1>
          <p className="text-[var(--text-muted)] mt-1 font-medium text-sm">Управление пакетами занятий и биллинг</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] font-bold rounded-xl hover:bg-slate-50 transition flex items-center gap-2">
            <Filter className="w-4 h-4" /> Фильтр
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-[var(--accent)] text-white font-bold rounded-xl shadow-md hover:brightness-110 transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Выдать абонемент
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <input 
            type="text" 
            placeholder="Поиск по имени студента..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-12 pr-4 py-3 text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] shadow-sm"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(sub => (
            <div key={sub.id} className="bg-[var(--bg-panel)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-[var(--text-main)]">{sub.studentName}</h3>
                  <span className={`inline-flex mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                    sub.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    sub.status === 'depleted' ? 'bg-rose-100 text-rose-700' :
                    sub.status === 'frozen' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {sub.status === 'active' ? 'Активен' : sub.status === 'depleted' ? 'Исчерпан' : sub.status === 'frozen' ? 'Заморожен' : 'Истек'}
                  </span>
                </div>
                {sub.status === 'active' && (
                  <button title="Заморозить" className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-blue-100 hover:text-blue-600 transition">
                    <Snowflake className="w-4 h-4" />
                  </button>
                )}
              </div>

              {sub.type === 'lessons_pack' && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1 font-bold">
                    <span className="text-[var(--text-muted)]">Остаток</span>
                    <span className={sub.remainingLessons < 3 ? 'text-rose-500' : 'text-emerald-500'}>
                      {sub.remainingLessons} / {sub.totalLessons}
                    </span>
                  </div>
                  <div className="w-full bg-[var(--bg-app)] rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${sub.remainingLessons < 3 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                      style={{ width: `${(sub.remainingLessons / sub.totalLessons) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="text-xs font-bold text-[var(--text-muted)] border-t border-[var(--border-color)] pt-3 flex justify-between">
                <span>До: {new Date(sub.expiryDate).toLocaleDateString()}</span>
                <span className="text-[var(--text-main)] font-black">{sub.pricePaid.toLocaleString()} {sub.currency}</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-[var(--text-muted)] font-medium">
              Абонементы не найдены
            </div>
          )}
        </div>
      </div>

      <SubscriptionIssueModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tenantId={activeTenant?.id}
      />
    </div>
  );
}
