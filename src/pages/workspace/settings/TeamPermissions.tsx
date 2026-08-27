import React, { useState, useEffect } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { 
  Shield, 
  ShieldCheck, 
  UserPlus, 
  Mail, 
  CheckCircle, 
  X, 
  Trash2, 
  Edit3, 
  Key, 
  Loader2, 
  Lock, 
  AlertCircle,
  Users,
  Check
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';

interface PermissionOption {
  key: string;
  label: string;
  description: string;
  category: 'Тесты & Прокторинг' | 'Обучение & Журнал' | 'CRM & Продажи' | 'Администрирование';
}

const ALL_PERMISSIONS: PermissionOption[] = [
  { key: 'tests:read', label: 'Просмотр тестов', description: 'Разрешить доступ к просмотру списка вступительных и предметных тестов', category: 'Тесты & Прокторинг' },
  { key: 'tests:manage', label: 'Создание & ред. тестов', description: 'Разрешить создание новых тестов, изменение вопросов и времени прохождения', category: 'Тесты & Прокторинг' },
  { key: 'tests:review', label: 'Проверка & Прокторинг', description: 'Доступ к кабинету управляющего, просмотру снимков прокторинга и отчетам', category: 'Тесты & Прокторинг' },
  { key: 'certificates:issue', label: 'Выдача сертификатов', description: 'Разрешить регистрацию и выгрузку официальных PDF-сертификатов и справок', category: 'Тесты & Прокторинг' },
  
  { key: 'edu:schedule', label: 'Расписание & Посещаемость', description: 'Доступ к сетке расписания, отметкам в журнале и списанию уроков', category: 'Обучение & Журнал' },
  { key: 'edu:payroll', label: 'Расчет зарплат', description: 'Просмотр и расчет ставок преподавателей за проведенные занятия', category: 'Обучение & Журнал' },
  
  { key: 'crm:read', label: 'Просмотр CRM & Лидов', description: 'Просмотр списка поступивших абитуриентов, контактов и заявок', category: 'CRM & Продажи' },
  { key: 'crm:manage', label: 'Управление сделками', description: 'Перемещение воронок, редактирование данных абитуриента и статусов', category: 'CRM & Продажи' },
  
  { key: 'team:manage', label: 'Управление сотрудниками', description: 'Добавление новых работников, отправка инвайтов и назначение прав', category: 'Администрирование' },
  { key: 'settings:manage', label: 'Настройки компании', description: 'Изменение названия, субдоменов, логотипа и системных интеграций', category: 'Администрирование' },
];

export default function TeamPermissions() {
  const { activeTenant } = useOutletContext<any>() || {};
  const { orgId } = useParams();
  const currentOrgId = activeTenant?.id || orgId || 'org_future_leaders';

  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  
  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('manager');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    'tests:read', 'tests:review', 'crm:read'
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load Team Members from Firestore
  useEffect(() => {
    if (!currentOrgId) return;

    setLoading(true);
    const q = query(
      collection(db, 'memberships'),
      where('tenantId', '==', currentOrgId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setMembers(list);
      setLoading(false);
    }, (err) => {
      console.warn("Error fetching memberships:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentOrgId]);

  const openAddModal = () => {
    setEditingMemberId(null);
    setFullName('');
    setEmail('');
    setRole('manager');
    setSelectedPermissions(['tests:read', 'tests:review', 'crm:read']);
    setStatusMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (member: any) => {
    setEditingMemberId(member.id);
    setFullName(member.name || member.fullName || '');
    setEmail(member.email || '');
    setRole(member.role || 'manager');
    setSelectedPermissions(member.permissions || []);
    setStatusMessage(null);
    setIsModalOpen(true);
  };

  const togglePermission = (permKey: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permKey) 
        ? prev.filter(k => k !== permKey)
        : [...prev, permKey]
    );
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setStatusMessage({ type: 'error', text: 'Пожалуйста, заполните ФИО и Email сотрудника.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      // Membership create/role changes go through the server (send-employee-invite),
      // which verifies the CALLER is a tenant admin before writing — a plain client
      // setDoc() here would either be rejected by firestore.rules (good) or, if it
      // succeeded, would let any member grant themselves/others arbitrary roles.
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/auth/send-employee-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          fullName: fullName.trim(),
          tenantName: activeTenant?.name || 'Академия Будущих Лидеров',
          tenantId: currentOrgId,
          role,
          permissions: selectedPermissions
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Не удалось сохранить сотрудника');
      }

      // Report what actually happened: the server returns emailSent, and without
      // RESEND_API_KEY configured no invite email goes out at all. Claiming it was
      // sent leaves the admin waiting for a message the employee never receives.
      setStatusMessage({
        type: 'success',
        text: editingMemberId
          ? 'Права сотрудника успешно обновлены!'
          : data.emailSent
            ? `Сотрудник добавлен! Письмо с ссылкой для установки пароля отправлено на ${email}.`
            : `Сотрудник добавлен. Письмо отправить не удалось — передайте ${email} ссылку для входа вручную.`
      });

      setTimeout(() => {
        setIsModalOpen(false);
        setIsSubmitting(false);
      }, 1500);

    } catch (err: any) {
      console.error("Save member error:", err);
      setStatusMessage({ type: 'error', text: `Ошибка сохранения: ${err.message}` });
      setIsSubmitting(false);
    }
  };

  const handleDeleteMember = async (memberId: string, memberName: string, memberEmail?: string) => {
    if (!window.confirm(`Вы уверены, что хотите отозвать доступ и БЕЗВОЗВРАТНО удалить сотрудника "${memberName}" из базы данных?`)) return;
    try {
      // 1. Delete from memberships
      await deleteDoc(doc(db, 'memberships', memberId));

      // 2. Delete from root crm_contacts
      if (memberEmail && memberEmail !== '—') {
        const crmSnap = await getDocs(query(collection(db, 'crm_contacts'), where('email', '==', memberEmail)));
        crmSnap.forEach(async (d) => { await deleteDoc(d.ref); });
      }
      const directCrmSnap = await getDocs(query(collection(db, 'crm_contacts'), where('fullName', '==', memberName)));
      directCrmSnap.forEach(async (d) => { await deleteDoc(d.ref); });

      // 3. Delete from nested tenant crm_contacts
      if (activeTenant?.id) {
        const nestedCrmSnap = await getDocs(query(collection(db, 'tenants', activeTenant.id, 'crm_contacts')));
        nestedCrmSnap.forEach(async (d) => {
          const data = d.data();
          if (data.email === memberEmail || data.fullName === memberName || d.id === memberId) {
            await deleteDoc(d.ref);
          }
        });
      }

      // 4. Delete from users collection
      try {
        await deleteDoc(doc(db, 'users', memberId));
      } catch (e) {}

      setStatusMessage({ type: 'success', text: `Сотрудник "${memberName}" полностью удален из всех баз данных!` });
    } catch(err: any) {
      alert(`Ошибка удаления: ${err.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-[var(--text-main)]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-500" />
            <span>Управление Сотрудниками & Права Доступа</span>
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Назначение гибких разрешений, отзыва доступов и отправка приглашений с установкой пароля для {activeTenant?.name || "Вашей Компании"}
          </p>
        </div>
        
        <button 
          onClick={openAddModal}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-xs cursor-pointer"
        >
          <UserPlus className="w-4 h-4" /> Добавить Сотрудника & Выдать Права
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-emerald-950/30 border border-emerald-800/60 p-4 rounded-2xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-200/80 leading-relaxed">
          <strong>Безопасность и Изоляция:</strong> Выбранные чекбоксы разрешений мгновенно управляют видимостью разделов в меню навигации работника. При добавлении сотрудника система пытается отправить письмо со ссылкой для установки пароля — результат отправки показывается прямо в форме.
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-[var(--text-muted)] text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
            <span>Загрузка списка сотрудников компании...</span>
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)] space-y-3">
            <Users className="w-10 h-10 mx-auto opacity-40 text-emerald-500" />
            <p className="text-sm font-semibold">Список сотрудников пока пуст</p>
            <p className="text-xs max-w-sm mx-auto">Нажмите «Добавить Сотрудника», чтобы назначить роли и пригласить коллег к работе.</p>
            <button 
              onClick={openAddModal}
              className="px-4 py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold hover:bg-emerald-600/30 transition"
            >
              + Добавить первого работника
            </button>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-panel)] border-b border-[var(--border-color)] text-[var(--text-muted)] font-mono uppercase">
              <tr>
                <th className="px-6 py-3.5 font-bold">Сотрудник / Email</th>
                <th className="px-6 py-3.5 font-bold">Роль</th>
                <th className="px-6 py-3.5 font-bold">Выданные Разрешения</th>
                <th className="px-6 py-3.5 font-bold">Статус</th>
                <th className="px-6 py-3.5 font-bold text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {members.map(member => (
                <tr key={member.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 font-bold">
                        {(member.name || member.email || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-[var(--text-main)]">{member.name || 'Сотрудник'}</div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{member.email}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-slate-500/10 border border-slate-500/20 uppercase text-[var(--text-main)]">
                      {member.role === 'owner' ? 'Владелец' : member.role === 'admin' ? 'Администратор' : 'Менеджер'}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1 max-w-md">
                      {Array.isArray(member.permissions) && member.permissions.length > 0 ? (
                        member.permissions.map((pKey: string) => {
                          const pObj = ALL_PERMISSIONS.find(ap => ap.key === pKey);
                          return (
                            <span key={pKey} className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded font-mono text-[10px]">
                              {pObj?.label || pKey}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-[11px] text-[var(--text-muted)] italic">Нет выданных прав</span>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 w-max border ${
                      member.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    }`}>
                      {member.status === 'active' ? <Check className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                      {member.status === 'active' ? 'Активен' : 'Ожидает пароль'}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(member)}
                        className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-emerald-400 transition"
                        title="Редактировать права"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMember(member.id, member.name || member.email, member.email)}
                        className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition"
                        title="Отозвать доступ и удалить пользователя"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Add/Edit Employee Permissions */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <span>{editingMemberId ? 'Редактирование Прав Сотрудника' : 'Добавление Нового Сотрудника'}</span>
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Укажите данные и отметьте необходимые разделы галочками</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl text-slate-400 hover:text-[var(--text-main)] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {statusMessage && (
              <div className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
                statusMessage.type === 'success' 
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-700/80' 
                  : 'bg-red-950/40 text-red-300 border-red-700/80'
              }`}>
                {statusMessage.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{statusMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveMember} className="space-y-6">
              
              {/* Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5">ФИО Сотрудника *</label>
                  <input 
                    type="text" 
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Иванов Алексей Петрович"
                    className="w-full px-3.5 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5">Рабочий Email *</label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@company.com"
                    className="w-full px-3.5 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5">Роль в компании</label>
                  <select 
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
                  >
                    <option value="manager">Менеджер Проверки</option>
                    <option value="admin">Администратор Школы</option>
                    <option value="teacher">Преподаватель</option>
                    <option value="proctor">Проктор / Модератор</option>
                  </select>
                </div>
              </div>

              {/* Permissions Checkbox Matrix */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-muted)] font-mono flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-500" /> Выбор Выдаваемых Разрешений (Checkboxes)
                  </h3>
                  <span className="text-[11px] text-emerald-500 font-mono font-bold">
                    Выбрано: {selectedPermissions.length} из {ALL_PERMISSIONS.length}
                  </span>
                </div>

                {['Тесты & Прокторинг', 'Обучение & Журнал', 'CRM & Продажи', 'Администрирование'].map(cat => {
                  const categoryPerms = ALL_PERMISSIONS.filter(p => p.category === cat);
                  return (
                    <div key={cat} className="space-y-2">
                      <div className="text-[11px] font-bold text-emerald-400 font-mono">{cat}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {categoryPerms.map(p => {
                          const isChecked = selectedPermissions.includes(p.key);
                          return (
                            <div 
                              key={p.key}
                              onClick={() => togglePermission(p.key)}
                              className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 select-none ${
                                isChecked
                                  ? 'bg-emerald-950/40 border-emerald-500/50 text-white'
                                  : 'bg-[var(--bg-panel)] border-[var(--border-color)] text-[var(--text-muted)] hover:border-slate-500'
                              }`}
                            >
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}} // handled by parent onClick
                                className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                              />
                              <div>
                                <div className="font-bold text-xs text-[var(--text-main)] flex items-center gap-1.5">
                                  <span>{p.label}</span>
                                  <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">{p.key}</span>
                                </div>
                                <div className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">{p.description}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-[var(--border-color)] pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[var(--border-color)] text-xs font-bold hover:bg-black/5 dark:hover:bg-white/5 transition"
                >
                  Отмена
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Сохранение & Отправка Письма...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>{editingMemberId ? 'Сохранить Изменения Прав' : 'Выдать Права & Отправить Инвайт по Email'}</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
