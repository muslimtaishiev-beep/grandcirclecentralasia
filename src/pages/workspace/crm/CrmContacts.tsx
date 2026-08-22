import React, { useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { Search, Plus, User, Mail, Phone, MoreVertical, Filter, Loader2, Trash } from 'lucide-react';
import { useCrmContacts, CrmContact } from '../../../lib/useCrm';

export default function CrmContacts() {
  const { activeTenant } = useOutletContext<any>() || {};
  const { orgId } = useParams();
  
  const { contacts, loading, addContact, deleteContact } = useCrmContacts(orgId);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const handleAddContact = async () => {
    if (!newName.trim()) return;
    await addContact({
      name: newName,
      email: newEmail,
      phone: newPhone,
      type: 'student',
      status: 'new'
    });
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setIsAdding(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 h-full flex flex-col">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)]">Контакты и Клиенты</h1>
          <p className="text-[var(--text-muted)] mt-1">База учеников, лидов и сотрудников для {activeTenant?.name}</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-[var(--accent)] text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:opacity-90 transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> Добавить контакт
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input 
            type="text" 
            placeholder="Поиск по имени, email или телефону..."
            className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text-main)]"
          />
        </div>
        <button className="bg-[var(--bg-app)] border border-[var(--border-color)] text-[var(--text-main)] px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition">
          <Filter className="w-4 h-4" /> Фильтры
        </button>
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl flex-1 overflow-hidden flex flex-col shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[var(--bg-app)]/50 border-b border-[var(--border-color)] text-[var(--text-muted)] font-mono text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">Имя</th>
                <th className="px-6 py-4 font-medium">Роль</th>
                <th className="px-6 py-4 font-medium">Контакты</th>
                <th className="px-6 py-4 font-medium">Статус</th>
                <th className="px-6 py-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {isAdding && (
                <tr className="bg-[var(--bg-app)]/30">
                  <td className="px-6 py-3">
                    <input autoFocus type="text" placeholder="Имя..." value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-transparent border border-[var(--border-color)] rounded px-2 py-1 text-sm text-[var(--text-main)]" />
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-xs text-[var(--text-muted)]">student</span>
                  </td>
                  <td className="px-6 py-3 flex gap-2">
                    <input type="text" placeholder="Email..." value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-32 bg-transparent border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-main)]" />
                    <input type="text" placeholder="Телефон..." value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-32 bg-transparent border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-main)]" />
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-xs text-[var(--text-muted)]">new</span>
                  </td>
                  <td className="px-6 py-3 text-right flex items-center justify-end gap-2">
                    <button onClick={() => setIsAdding(false)} className="text-[var(--text-muted)] text-xs hover:text-[var(--text-main)]">Отмена</button>
                    <button onClick={handleAddContact} className="bg-[var(--accent)] text-white text-xs px-2 py-1 rounded">Сохранить</button>
                  </td>
                </tr>
              )}

              {loading && !isAdding && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[var(--text-muted)]">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </td>
                </tr>
              )}

              {contacts.map(contact => (
                <tr key={contact.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--bg-app)] flex items-center justify-center border border-[var(--border-color)]">
                        <User className="w-4 h-4 text-[var(--text-muted)]" />
                      </div>
                      <span className="font-semibold text-[var(--text-main)] group-hover:text-[var(--accent)] transition cursor-pointer">{contact.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-[var(--bg-app)] text-[var(--text-muted)] px-2 py-1 rounded-md text-xs font-mono border border-[var(--border-color)]">
                      {contact.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">
                      {contact.email && <div className="flex items-center gap-2"><Mail className="w-3 h-3"/> {contact.email}</div>}
                      {contact.phone && <div className="flex items-center gap-2"><Phone className="w-3 h-3"/> {contact.phone}</div>}
                      {!contact.email && !contact.phone && <span className="opacity-50">Нет контактов</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-xs font-mono font-medium ${
                      contact.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800' : 
                      contact.status === 'new' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                    }`}>
                      {contact.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => deleteContact(contact.id)} className="text-[var(--text-muted)] hover:text-red-500 p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition">
                        <Trash className="w-4 h-4" />
                      </button>
                      <button className="text-[var(--text-muted)] hover:text-[var(--text-main)] p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              
              {!loading && contacts.length === 0 && !isAdding && (
                 <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[var(--text-muted)]">
                    Контакты не найдены. Нажмите "Добавить контакт", чтобы начать.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
