import React, { useState, useEffect } from 'react';
import { useWorkspaceTerms } from '../../../lib/useWorkspaceConfig';
import { useOutletContext } from 'react-router-dom';
import { Search, Plus, Filter, MoreHorizontal, Mail, Phone, X, Check, Trash2 } from 'lucide-react';
import { db } from '../../../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, setDoc, doc, deleteDoc, getDocs, limit } from 'firebase/firestore';
import { CrmContact } from '../../../types/crm';
import ContactProfileDrawer from './components/ContactProfileDrawer';
import toast from 'react-hot-toast';

export default function ContactsDirectoryPage() {
  const terms = useWorkspaceTerms();
  const { activeTenant } = useOutletContext<any>();
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<CrmContact | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState<'student' | 'lead' | 'partner' | 'employee'>('student');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!activeTenant?.id) return;

    // Живая подписка, но ограниченная: экран показывает список, а не всю
    // базу контактов школы. Без limit браузер держал в памяти каждый контакт
    // и перерисовывал таблицу на любое изменение любого из них.
    const q1 = query(
      collection(db, 'crm_contacts'),
      where('tenantId', '==', activeTenant.id),
      limit(500),
    );
    const unsub = onSnapshot(q1, (snap) => {
      const list: CrmContact[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({
          id: d.id,
          tenantId: data.tenantId,
          fullName: data.fullName || data.name || 'Без имени',
          email: data.email || '—',
          phone: data.phone || '—',
          type: data.type || 'student',
          companyName: data.companyName || '',
          totalDealsCount: data.totalDealsCount || 0,
          totalRevenueGenerated: data.totalRevenueGenerated || 0,
          createdAt: data.createdAt
        } as CrmContact);
      });
      setContacts(list);
    }, (err) => {
      // Молчаливый console.warn превращал сбой запроса в пустой экран:
      // менеджер видел «контактов нет» вместо «не удалось загрузить».
      console.warn("CRM contacts listener notice:", err);
      setLoadError("Не удалось загрузить контакты. Обновите страницу.");
    });

    return () => unsub();
  }, [activeTenant?.id]);

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !activeTenant?.id) return;

    setIsSubmitting(true);
    try {
      const newContactDoc = {
        tenantId: activeTenant.id,
        fullName: fullName.trim(),
        name: fullName.trim(),
        phone: phone.trim() || '—',
        email: email.trim() || '—',
        type,
        status: 'active',
        totalDealsCount: 0,
        totalRevenueGenerated: 0,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'crm_contacts'), newContactDoc);
      // Also save to nested subcollection for backward compatibility
      const nestedRef = doc(collection(db, 'tenants', activeTenant.id, 'crm_contacts'));
      await setDoc(nestedRef, newContactDoc);

      setFullName('');
      setPhone('');
      setEmail('');
      setIsModalOpen(false);
    } catch (err: any) {
      alert(`Ошибка добавления контакта: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteContact = async (contact: CrmContact, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm(`Вы уверены, что хотите безвозвратно удалить контакт "${contact.fullName}" из базы данных?`)) return;

    try {
      // 1. Delete root crm_contacts doc
      await deleteDoc(doc(db, 'crm_contacts', contact.id));

      // 2. Delete nested tenant crm_contacts doc
      if (activeTenant?.id) {
        try { await deleteDoc(doc(db, 'tenants', activeTenant.id, 'crm_contacts', contact.id)); } catch (err) {}
      }

      // 3. Delete memberships doc if employee
      if (contact.type === 'employee' || contact.type === 'partner') {
        // Только СВОЯ организация: раньше по совпадению почты удалялись
        // членства этого человека во всех организациях платформы.
        const memSnap = await getDocs(query(
          collection(db, 'memberships'),
          where('userEmail', '==', contact.email),
          where('tenantId', '==', activeTenant.id),
        ));
        // await для каждого удаления: forEach с async молча терял ошибки, и
        // «успешно удалён» показывался до фактического удаления.
        await Promise.all(memSnap.docs.map(d => deleteDoc(d.ref)));
      }

      toast.success(`Контакт "${contact.fullName}" полностью удален`);
      if (selectedContact?.id === contact.id) setSelectedContact(null);
    } catch (err: any) {
      alert(`Ошибка удаления контакта: ${err.message}`);
    }
  };

  const filtered = contacts.filter(c => 
    (c.fullName || '').toLowerCase().includes(search.toLowerCase()) || 
    (c.phone || '').includes(search) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)] mb-1">Контакты & Абитуриенты (Directory)</h1>
          <p className="text-sm font-medium text-[var(--text-muted)]">База учащихся, клиентов и партнеров ({contacts.length})</p>
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
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md transition shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Добавить Контакт
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
                    Контакты не найдены. Нажмите "+ Добавить Контакт" для создания первой карточки.
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
                          {(contact.fullName || 'К')[0].toUpperCase()}
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
                      <span className="text-xs text-emerald-500 font-bold">{(contact.totalRevenueGenerated || 0).toLocaleString()} KGS</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition cursor-pointer" 
                      onClick={(e) => handleDeleteContact(contact, e)}
                      title="Удалить контакт из базы данных"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
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
        onDeleteContact={handleDeleteContact}
        contact={selectedContact || undefined} 
      />

      {/* Modal: Create Contact */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h3 className="font-bold text-base text-[var(--text-main)] flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-500" />
                <span>Новый Контакт CRM</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-black/10 rounded text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateContact} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">{`ФИО: ${terms.student.toLowerCase()} / клиент *`}</label>
                <input 
                  type="text" 
                  required
                  placeholder="Иванов Иван Иванович"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Номер телефона</label>
                <input 
                  type="text" 
                  placeholder="+996 555 123 456"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Электронная почта (Email)</label>
                <input 
                  type="email" 
                  placeholder="student@gmail.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Тип контакта</label>
                <select 
                  value={type}
                  onChange={e => setType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
                >
                  <option value="student">{terms.student}</option>
                  <option value="lead">Лид / Заявка</option>
                  <option value="partner">Партнер / Родитель</option>
                  <option value="employee">Сотрудник</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl border text-xs font-bold">Отмена</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                  <Check className="w-4 h-4" />
                  <span>Сохранить</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
