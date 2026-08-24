import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Search, Plus, Filter, MoreHorizontal, Mail, Phone } from 'lucide-react';
import { db } from '../../../lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { CrmContact } from '../../../types/crm';
import ContactProfileDrawer from './components/ContactProfileDrawer';

export default function ContactsDirectoryPage() {
  const { activeTenant } = useOutletContext<any>();
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [search, setSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<CrmContact | null>(null);

  useEffect(() => {
    if (!activeTenant?.id) return;
    const q = query(collection(db, 'tenants', activeTenant.id, 'crm_contacts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setContacts(snap.docs.map(d => ({ ...d.data(), id: d.id } as CrmContact)));
    });
    return () => unsub();
  }, [activeTenant?.id]);

  const filtered = contacts.filter(c => c.fullName.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));

  return (
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)] mb-1">Контакты (Directory)</h1>
          <p className="text-sm font-medium text-[var(--text-muted)]">База клиентов, партнеров и сотрудников ({contacts.length})</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input 
              type="text" 
              placeholder="Поиск по имени или телефону..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <button className="p-2 border border-[var(--border-color)] bg-[var(--bg-panel)] rounded-xl text-[var(--text-muted)] hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <Filter className="w-5 h-5" />
          </button>
          <button className="flex items-center gap-2 bg-[var(--accent)] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:brightness-110 transition shrink-0">
            <Plus className="w-4 h-4" /> Добавить
          </button>
        </div>
      </div>

      <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-color)] overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-surface)] text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-color)]">
                <th className="px-6 py-4 font-bold">Контакт</th>
                <th className="px-6 py-4 font-bold">Связь</th>
                <th className="px-6 py-4 font-bold">Тип</th>
                <th className="px-6 py-4 font-bold">Сделки</th>
                <th className="px-6 py-4 font-bold text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm font-medium text-[var(--text-muted)]">
                    Контакты не найдены.
                  </td>
                </tr>
              ) : filtered.map(contact => (
                <tr key={contact.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer" onClick={() => setSelectedContact(contact)}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {contact.avatarUrl ? (
                        <img src={contact.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold">
                          {contact.fullName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-sm text-[var(--text-main)]">{contact.fullName}</div>
                        {contact.companyName && <div className="text-xs text-[var(--text-muted)] font-medium mt-0.5">{contact.companyName}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 text-xs text-[var(--text-muted)] font-medium">
                      <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {contact.phone}</div>
                      <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {contact.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {contact.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-[var(--text-main)]">{contact.totalDealsCount}</span>
                      <span className="text-xs text-emerald-500 font-bold">{contact.totalRevenueGenerated.toLocaleString()} KGS</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-[var(--text-muted)] hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition" onClick={(e) => { e.stopPropagation(); }}>
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ContactProfileDrawer 
        isOpen={!!selectedContact} 
        onClose={() => setSelectedContact(null)} 
        contact={selectedContact || undefined} 
      />
    </div>
  );
}
