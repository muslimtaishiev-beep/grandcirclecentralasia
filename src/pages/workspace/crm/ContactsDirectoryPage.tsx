import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Search, Plus, Mail, Phone, Archive, Users } from 'lucide-react';
import { useWorkspaceTerms } from '../../../lib/useWorkspaceConfig';
import { Button, EmptyState, Modal, PageHeader, Spinner, Table, Tabs, btn, btnPrimary, confirmDialog, input, label, toast } from '../../../components/ui';
import { crmService } from '../../../services/crmService';
import { useCrmPerms } from '../../../hooks/useCrmPerms';
import { CrmContact } from '../../../types/crm';
import ContactProfileDrawer from './components/ContactProfileDrawer';

type ContactType = CrmContact['type'];

export default function ContactsDirectoryPage() {
  const terms = useWorkspaceTerms();
  const { activeTenant } = useOutletContext<any>();
  const tenantId: string = activeTenant?.id;
  const { canManage, uid, name } = useCrmPerms();
  const author = useMemo(() => ({ id: uid, name }), [uid, name]);

  const [contacts, setContacts] = useState<CrmContact[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<{ id?: string; fullName: string; phone: string; email: string; type: ContactType } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    return crmService.subscribeToContacts(tenantId, setContacts, () => setLoadError('Не удалось загрузить контакты. Обновите страницу.'));
  }, [tenantId]);

  const typeLabel: Record<string, string> = {
    student: terms.student, lead: 'Лид', parent: 'Родитель', partner: 'Партнёр', corporate_client: 'Компания', employee: 'Сотрудник',
  };

  const list = contacts || [];
  const selected = list.find(c => c.id === selectedId) || null;
  const archivedCount = list.filter(c => c.status === 'archived').length;
  const q = search.trim().toLowerCase();
  const filtered = list.filter(c =>
    (tab === 'archived') === (c.status === 'archived') &&
    (!q || c.fullName.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q)));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !form.fullName.trim()) return;
    setBusy(true);
    try {
      if (form.id) await crmService.updateContact(tenantId, form.id, { fullName: form.fullName.trim(), phone: form.phone.trim(), email: form.email.trim(), type: form.type });
      else await crmService.createContact(tenantId, form);
      setForm(null);
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось сохранить контакт');
    } finally { setBusy(false); }
  };

  const archive = async (c: CrmContact) => {
    const to = c.status !== 'archived';
    if (to && !(await confirmDialog({ title: `Убрать «${c.fullName}» в архив?`, confirmLabel: 'В архив' }))) return;
    try { await crmService.archiveContact(tenantId, c.id, to, author); if (to) setSelectedId(null); }
    catch (err: any) { toast.error(err?.message || 'Не удалось выполнить'); }
  };

  const remove = async (c: CrmContact) => {
    if (c.type === 'employee') { toast.error('Карточка сотрудника не удаляется — доступ меняется в разделе сотрудников'); return; }
    if (!(await confirmDialog({ title: `Удалить «${c.fullName}» навсегда?`, message: 'Восстановить будет нельзя.', confirmLabel: 'Удалить', danger: true }))) return;
    try { await crmService.deleteContact(tenantId, c.id, c.fullName, author, c.type); setSelectedId(null); toast.success('Контакт удалён'); }
    catch (err: any) { toast.error(err?.message || 'Не удалось удалить'); }
  };

  const f = (patch: Partial<NonNullable<typeof form>>) => setForm(v => (v ? { ...v, ...patch } : v));

  return (
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto w-full">
      <PageHeader
        title="Контакты"
        actions={canManage ? <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setForm({ fullName: '', phone: '', email: '', type: 'student' })}>Контакт</Button> : undefined}
        tabs={<Tabs value={tab} onChange={id => setTab(id as 'active' | 'archived')} tabs={[{ id: 'active', label: 'Контакты', icon: <Users className="w-4 h-4" /> }, { id: 'archived', label: 'Архив', icon: <Archive className="w-4 h-4" />, count: archivedCount }]} />}
      />
      <div className="relative my-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <input className={`${input} pl-9`} placeholder="Имя, телефон, почта" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loadError ? <EmptyState title={loadError} /> : !contacts ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon={<Users className="w-8 h-8" />} title={q ? 'Ничего не найдено' : tab === 'archived' ? 'Архив пуст' : 'Контактов пока нет'}
          action={!q && tab === 'active' && canManage ? <Button variant="primary" onClick={() => setForm({ fullName: '', phone: '', email: '', type: 'student' })}>Добавить контакт</Button> : undefined} />
      ) : (
        <Table>
          <thead>
            <tr className="text-left text-xs uppercase text-[var(--text-muted)] border-b border-[var(--border-color)]">
              <th className="px-4 py-3">Контакт</th><th className="px-4 py-3">Связь</th><th className="px-4 py-3">Тип</th><th className="px-4 py-3">Сделки</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-[var(--bg-surface-hover)] cursor-pointer" onClick={() => setSelectedId(c.id)}>
                <td className="px-4 py-3 font-bold text-sm text-[var(--text-main)]">{c.fullName}{c.companyName && <div className="text-xs font-normal text-[var(--text-muted)]">{c.companyName}</div>}</td>
                <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                  {c.phone && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{c.phone}</div>}
                  {c.email && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{c.email}</div>}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{typeLabel[c.type] || c.type}</td>
                <td className="px-4 py-3 text-sm font-bold text-[var(--text-main)]">{c.totalDealsCount}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <ContactProfileDrawer
        isOpen={!!selected} onClose={() => setSelectedId(null)} contact={selected || undefined}
        onEditContact={canManage ? c => setForm({ id: c.id, fullName: c.fullName, phone: c.phone, email: c.email, type: c.type }) : undefined}
        onArchiveContact={canManage ? archive : undefined}
        onDeleteContact={canManage && selected?.status === 'archived' && selected.type !== 'employee' ? remove : undefined}
      />

      {form && (
        <Modal title={form.id ? 'Контакт' : 'Новый контакт'} onClose={() => setForm(null)}>
          <form onSubmit={save} className="space-y-4">
            <div><label className={label}>ФИО</label><input className={input} required value={form.fullName} onChange={e => f({ fullName: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>Телефон</label><input className={input} value={form.phone} onChange={e => f({ phone: e.target.value })} /></div>
              <div><label className={label}>Почта</label><input className={input} type="email" value={form.email} onChange={e => f({ email: e.target.value })} /></div>
            </div>
            <div>
              <label className={label}>Тип</label>
              <select className={input} value={form.type} onChange={e => f({ type: e.target.value as ContactType })} disabled={form.type === 'employee'}>
                {Object.entries(typeLabel).filter(([k]) => k !== 'employee' || form.type === 'employee').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={btn} onClick={() => setForm(null)}>Отмена</button>
              <button type="submit" className={btnPrimary} disabled={busy}>Сохранить</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
