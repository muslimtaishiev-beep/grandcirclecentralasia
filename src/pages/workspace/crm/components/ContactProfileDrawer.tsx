import React from 'react';
import { X, Mail, Phone, Building, History, CheckSquare, Activity, Trash2 } from 'lucide-react';
import { CrmContact, CrmDeal, CrmActivityLog } from '../../../../types/crm';
import { WorkspaceTask } from '../../../../types/tasks';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDeleteContact?: (contact: CrmContact) => void;
  contact?: CrmContact;
  deals?: CrmDeal[];
  tasks?: WorkspaceTask[];
  logs?: CrmActivityLog[];
}

export default function ContactProfileDrawer({ isOpen, onClose, onDeleteContact, contact, deals = [], tasks = [], logs = [] }: Props) {
  if (!isOpen || !contact) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-[var(--bg-panel)] shadow-2xl border-l border-[var(--border-color)] z-50 flex flex-col animate-in slide-in-from-right duration-300">
      <div className="flex justify-between items-center p-6 border-b border-[var(--border-color)]">
        <h2 className="text-xl font-bold">Профиль 360°</h2>
        <div className="flex items-center gap-2">
          {onDeleteContact && (
            <button 
              onClick={() => onDeleteContact(contact)} 
              className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded-full transition"
              title="Удалить контакт из БД"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Header Profile */}
        <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-app)]">
          <div className="flex items-center gap-4 mb-4">
            {contact.avatarUrl ? (
              <img src={contact.avatarUrl} alt={contact.fullName} className="w-16 h-16 rounded-full" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-2xl font-bold">
                {contact.fullName.charAt(0)}
              </div>
            )}
            <div>
              <h3 className="text-xl font-bold text-[var(--text-main)]">{contact.fullName}</h3>
              <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {contact.type}
              </span>
            </div>
          </div>

          <div className="space-y-2 text-sm text-[var(--text-muted)] font-medium">
            <div className="flex items-center gap-2"><Mail className="w-4 h-4" /> {contact.email}</div>
            <div className="flex items-center gap-2"><Phone className="w-4 h-4" /> {contact.phone}</div>
            {contact.companyName && <div className="flex items-center gap-2"><Building className="w-4 h-4" /> {contact.companyName}</div>}
          </div>
        </div>

        {/* Content Tabs area - simplified for now */}
        <div className="p-6 space-y-6">
          <section>
            <h4 className="flex items-center gap-2 font-bold mb-3"><History className="w-5 h-5 text-[var(--accent)]" /> Сделки</h4>
            {deals.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Нет связанных сделок</p> : (
              <div className="space-y-2">
                {deals.map(d => (
                  <div key={d.id} className="p-3 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-sm">
                    <div className="font-bold">{d.title}</div>
                    <div className="text-emerald-500 font-bold">{d.amount} {d.currency}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h4 className="flex items-center gap-2 font-bold mb-3"><CheckSquare className="w-5 h-5 text-indigo-500" /> Задачи</h4>
            {tasks.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Нет активных задач</p> : (
              <div className="space-y-2">
                {tasks.map(t => (
                  <div key={t.id} className="p-3 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-sm">
                    <div className="font-bold">{t.title}</div>
                    <div className="text-[var(--text-muted)]">{t.status}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h4 className="flex items-center gap-2 font-bold mb-3"><Activity className="w-5 h-5 text-rose-500" /> Активность</h4>
            {logs.length === 0 ? <p className="text-sm text-[var(--text-muted)]">История пуста</p> : (
              <div className="space-y-4 border-l-2 border-slate-200 dark:border-slate-800 ml-2 pl-4">
                {logs.map(log => (
                  <div key={log.id} className="relative">
                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-[var(--bg-panel)]"></div>
                    <div className="text-xs text-[var(--text-muted)]">{new Date(log.timestamp).toLocaleString()}</div>
                    <div className="text-sm font-medium">{log.details}</div>
                    <div className="text-xs text-[var(--text-muted)]">by {log.authorName}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
