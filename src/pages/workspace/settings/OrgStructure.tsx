import React, { useState, useEffect } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  Plus, 
  Shield, 
  Crown, 
  Trash2, 
  Edit3, 
  Loader2, 
  X, 
  Check, 
  ChevronRight, 
  FolderTree, 
  Briefcase, 
  ShieldCheck, 
  DollarSign, 
  BookOpen, 
  MapPin,
  UserCheck
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

const DEFAULT_DEPARTMENTS = [
  { name: 'Приемная Комиссия & Деканат', color: 'from-blue-600 to-indigo-600', description: 'Обработка заявок абитуриентов, вступительные экзамены и зачисление' },
  { name: 'Отдел Прокторинга & Безопасности', color: 'from-emerald-600 to-teal-600', description: 'Мониторинг видеофиксации, анализ индекса честности и анти-чит проверки' },
  { name: 'Отдел Продаж & CRM', color: 'from-purple-600 to-pink-600', description: 'Ведение воронок сделок, работа с абитуриентами и первичные консультации' },
  { name: 'Отдел Методологии & Тестов', color: 'from-amber-600 to-orange-600', description: 'Составление экзаменационных вариантов по предметам (7–11 классы)' },
  { name: 'Финансовый Отдел & Бухгалтерия', color: 'from-rose-600 to-red-600', description: 'Учет оплат, абонементов, ведомостей зарплат преподавателей' },
];

export default function OrgStructure() {
  const { activeTenant } = useOutletContext<any>() || {};
  const { orgId } = useParams();
  const currentOrgId = activeTenant?.id || orgId || '';

  const [departments, setDepartments] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingDefaults, setSyncingDefaults] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [headUserId, setHeadUserId] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Subscribe to Departments & Memberships from Firestore
  useEffect(() => {
    if (!currentOrgId) return;

    setLoading(true);
    const qDepts = query(collection(db, 'departments'), where('tenantId', '==', currentOrgId));
    const qMems = query(collection(db, 'memberships'), where('tenantId', '==', currentOrgId));

    const unsubMems = onSnapshot(qMems, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setMembers(list);
    });

    const unsubDepts = onSnapshot(qDepts, async (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));

      // Auto-seed default corporate departments if empty
      if (list.length === 0 && !syncingDefaults) {
        setSyncingDefaults(true);
        try {
          for (let i = 0; i < DEFAULT_DEPARTMENTS.length; i++) {
            const dDef = DEFAULT_DEPARTMENTS[i];
            const dId = `dept_${i + 1}_${currentOrgId}`;
            await setDoc(doc(db, 'departments', dId), {
              tenantId: currentOrgId,
              name: dDef.name,
              description: dDef.description,
              color: dDef.color,
              memberIds: [],
              headUserId: null,
              createdAt: serverTimestamp()
            }, { merge: true });
          }
        } catch (e) {
          console.warn("Auto-seed dept notice:", e);
        } finally {
          setSyncingDefaults(false);
        }
      } else {
        setDepartments(list);
        setLoading(false);
      }
    });

    return () => {
      unsubDepts();
      unsubMems();
    };
  }, [currentOrgId]);

  const openAddModal = () => {
    setEditingDeptId(null);
    setDeptName('');
    setDeptDesc('');
    setHeadUserId('');
    setSelectedMemberIds([]);
    setIsModalOpen(true);
  };

  const openEditModal = (dept: any) => {
    setEditingDeptId(dept.id);
    setDeptName(dept.name || '');
    setDeptDesc(dept.description || '');
    setHeadUserId(dept.headUserId || '');
    setSelectedMemberIds(dept.memberIds || []);
    setIsModalOpen(true);
  };

  const toggleMemberSelection = (mId: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(mId) ? prev.filter(id => id !== mId) : [...prev, mId]
    );
  };

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim()) return;

    setIsSubmitting(true);
    try {
      const docId = editingDeptId || `dept_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await setDoc(doc(db, 'departments', docId), {
        tenantId: currentOrgId,
        name: deptName.trim(),
        description: deptDesc.trim(),
        headUserId: headUserId || null,
        memberIds: selectedMemberIds,
        updatedAt: serverTimestamp(),
        ...(!editingDeptId && { createdAt: serverTimestamp(), color: 'from-emerald-600 to-teal-600' })
      }, { merge: true });

      setIsModalOpen(false);
    } catch (err: any) {
      alert(`Ошибка сохранения: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDept = async (deptId: string, name: string) => {
    if (!window.confirm(`Вы уверены, что хотите удалить отдел "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'departments', deptId));
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
            <FolderTree className="w-6 h-6 text-emerald-500" />
            <span>Оргструктура и отделы</span>
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Древовидное управление отделами, филиалами и назначение руководителей подразделений для {activeTenant?.name || "Вашей Организации"}
          </p>
        </div>
        
        <button 
          onClick={openAddModal}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Создать Отдел
        </button>
      </div>

      {/* Corporate Overview Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-slate-950/40 border border-emerald-800/60 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span>Иерархическая Структура & Руководители Подразделений</span>
          </h3>
          <p className="text-xs text-emerald-200/80 max-w-2xl leading-relaxed">
            Каждое подразделение изолирует свои сделки, тесты и сессии прокторинга. Руководитель отдела видит метрики своего департамента, а генеральный директор получает сквозную сводку холдинга.
          </p>
        </div>
        
        <div className="flex items-center gap-4 text-xs font-mono font-bold shrink-0">
          <div className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-emerald-400">
            Отделов: {departments.length}
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 px-3 py-1.5 rounded-xl text-blue-400">
            Сотрудников: {members.length}
          </div>
        </div>
      </div>

      {/* Departments Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--text-muted)] text-xs gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
          <span>Загрузка оргструктуры отделов...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {departments.map((dept, index) => {
            const headMember = members.find(m => m.id === dept.headUserId || m.email === dept.headUserId);
            const deptMembers = members.filter(m => (dept.memberIds || []).includes(m.id));

            return (
              <div 
                key={dept.id} 
                className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-xs hover:border-emerald-500/40 transition group flex flex-col justify-between"
              >
                <div>
                  {/* Card Header with Banner */}
                  <div className={`p-4 bg-gradient-to-r ${dept.color || 'from-emerald-600 to-teal-600'} text-white flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center font-bold text-xs font-mono">
                        0{index + 1}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm leading-tight">{dept.name}</h3>
                        <span className="text-[10px] text-white/80 font-mono">Департамент #{dept.id.substring(0, 8)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition">
                      <button 
                        onClick={() => openEditModal(dept)}
                        className="p-1.5 hover:bg-white/20 rounded-lg text-white transition"
                        title="Редактировать отдел"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteDept(dept.id, dept.name)}
                        className="p-1.5 hover:bg-red-500/30 rounded-lg text-white transition"
                        title="Удалить отдел"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-4 text-xs">
                    {dept.description && (
                      <p className="text-[var(--text-muted)] text-xs leading-relaxed border-b border-[var(--border-color)] pb-3">
                        {dept.description}
                      </p>
                    )}

                    {/* Head of Department */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-mono uppercase font-bold text-[var(--text-muted)] flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5 text-amber-500" /> Руководитель Отдела (Head)
                      </div>

                      {headMember ? (
                        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center">
                            {(headMember.name || headMember.email || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-[var(--text-main)] text-xs">{headMember.name || 'Начальник отдела'}</div>
                            <div className="text-[11px] text-[var(--text-muted)]">{headMember.email}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-[var(--text-muted)] italic bg-black/5 dark:bg-white/5 p-2 rounded-xl border border-dashed border-[var(--border-color)]">
                          Руководитель отдела пока не назначен
                        </div>
                      )}
                    </div>

                    {/* Department Members */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-mono uppercase font-bold text-[var(--text-muted)] flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-500" /> Состав Сотрудников
                        </span>
                        <span className="text-[10px] text-emerald-400 font-bold">{deptMembers.length} человек</span>
                      </div>

                      {deptMembers.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {deptMembers.map(m => (
                            <span 
                              key={m.id} 
                              className="px-2.5 py-1 bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg font-mono text-[11px] flex items-center gap-1.5"
                            >
                              <UserCheck className="w-3 h-3 text-emerald-500" />
                              <span>{m.name || m.email}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-[var(--text-muted)] italic">Сотрудники еще не закреплены за этим отделом</p>
                      )}
                    </div>

                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-[var(--bg-panel)] border-t border-[var(--border-color)] flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-muted)] font-mono">Статус: Активный департамент</span>
                  <button 
                    onClick={() => openEditModal(dept)}
                    className="text-emerald-500 hover:text-emerald-400 font-bold flex items-center gap-1 transition"
                  >
                    <span>Настроить состав</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create/Edit Department */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <FolderTree className="w-5 h-5 text-emerald-500" />
                  <span>{editingDeptId ? 'Редактирование Отдела' : 'Создание Нового Отдела'}</span>
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Укажите параметры подразделения и выберите руководителя</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl text-slate-400 hover:text-[var(--text-main)] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDept} className="space-y-5 text-xs">
              
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5">Название Отдела / Подразделения *</label>
                <input 
                  type="text" 
                  required
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="Например: Деканат, Отдел Прокторинга"
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5">Описание и Обязанности</label>
                <textarea 
                  rows={2}
                  value={deptDesc}
                  onChange={(e) => setDeptDesc(e.target.value)}
                  placeholder="Основные цели и зоны ответственности этого подразделения..."
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5">Назначить Руководителя Отдела (Head of Dept)</label>
                <select 
                  value={headUserId}
                  onChange={(e) => setHeadUserId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500 font-mono"
                >
                  <option value="">-- Руководитель не выбран --</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      👑 {m.name || m.email} ({m.role || 'manager'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Members Selection List */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[var(--text-muted)]">Закрепить Сотрудников за Отделом</label>
                
                {members.length === 0 ? (
                  <p className="text-[11px] text-[var(--text-muted)] italic">В компании пока нет добавленных сотрудников</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl">
                    {members.map(m => {
                      const isChecked = selectedMemberIds.includes(m.id);
                      return (
                        <div 
                          key={m.id}
                          onClick={() => toggleMemberSelection(m.id)}
                          className={`p-2 rounded-lg border transition cursor-pointer flex items-center justify-between select-none ${
                            isChecked 
                              ? 'bg-emerald-950/40 border-emerald-500/50 text-white' 
                              : 'bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-muted)] hover:border-slate-500'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <div className="font-bold text-[11px] text-[var(--text-main)] truncate">{m.name || 'Сотрудник'}</div>
                            <div className="text-[10px] text-[var(--text-muted)] truncate">{m.email}</div>
                          </div>
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer shrink-0"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
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
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{editingDeptId ? 'Сохранить Изменения' : 'Создать Департамент'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
