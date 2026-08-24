import React, { useState, useEffect } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { 
  ShieldCheck, 
  Users, 
  Eye, 
  Edit3, 
  Play, 
  Download, 
  Lock, 
  Check, 
  Loader2, 
  Search, 
  Sliders, 
  ChevronRight, 
  UserCheck, 
  FileText, 
  Building2,
  X
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { StaffMember, ModulePermission } from '../../../types/engine';

const SYSTEM_MODULES = [
  { id: 'mod_admissions', name: '🎓 Приемная Комиссия & Бланки Заявок', defaultFields: ['applicantName', 'phone', 'grade', 'status', 'passportDoc'] },
  { id: 'mod_proctoring', name: '🛡️ AI-Прокторинг & Результаты Тестов', defaultFields: ['studentName', 'honestyIndex', 'gazeViolations', 'scores', 'videoFolder'] },
  { id: 'mod_crm', name: '💼 Воронка Сделок & Клиенты CRM', defaultFields: ['clientTitle', 'valueKGS', 'stage', 'assignedManager', 'whatsappHistory'] },
  { id: 'mod_certificates', name: '📜 Выписка Справок & QR-Валидация', defaultFields: ['studentId', 'transcriptNumber', 'gpa', 'issueDate', 'qrPass'] },
  { id: 'mod_payroll', name: '💵 Зарплатная Ведомость & Бухгалтерия', defaultFields: ['teacherName', 'workedHours', 'calculatedSalary', 'payoutStatus'] },
  { id: 'mod_settings', name: '⚙️ Настройки Тенанта & Оргструктура', defaultFields: ['orgName', 'subdomain', 'smtpSettings', 'branchList'] },
];

export default function TeamPermissionMatrix() {
  const { activeTenant } = useOutletContext<any>() || {};
  const { orgId } = useParams();
  const currentOrgId = activeTenant?.id || orgId || 'org_future_leaders';

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Field Masking Modal State
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [maskFields, setMaskFields] = useState<string[]>([]);

  // Subscribe to Staff / Memberships from Firestore
  useEffect(() => {
    if (!currentOrgId) return;

    setLoading(true);
    const qStaff = query(collection(db, 'memberships'), where('tenantId', '==', currentOrgId));
    const unsub = onSnapshot(qStaff, (snap) => {
      const list: StaffMember[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({
          id: d.id,
          tenantId: data.tenantId || currentOrgId,
          userId: data.userId || d.id,
          fullName: data.name || data.displayName || data.email || 'Сотрудник',
          email: data.email || 'staff@org.kg',
          departmentId: data.departmentId || 'dept_1',
          role: data.role || 'manager',
          status: data.status || 'active',
          customPermissions: data.customPermissions || SYSTEM_MODULES.map(m => ({
            moduleId: m.id,
            moduleName: m.name,
            canView: true,
            canEdit: data.role === 'admin' || data.role === 'owner',
            canExecute: data.role === 'admin' || data.role === 'owner',
            canExport: data.role === 'admin' || data.role === 'owner',
            visibleFields: m.defaultFields
          }))
        });
      });
      setStaffList(list);
      if (list.length > 0 && !selectedStaff) setSelectedStaff(list[0]);
      setLoading(false);
    });

    return () => unsub();
  }, [currentOrgId]);

  const togglePermission = (moduleId: string, permKey: 'canView' | 'canEdit' | 'canExecute' | 'canExport') => {
    if (!selectedStaff) return;

    const updatedPermissions = (selectedStaff.customPermissions || []).map(p => {
      if (p.moduleId === moduleId) {
        return { ...p, [permKey]: !p[permKey] };
      }
      return p;
    });

    // If permission doesn't exist, create it
    const exists = updatedPermissions.some(p => p.moduleId === moduleId);
    if (!exists) {
      const modObj = SYSTEM_MODULES.find(m => m.id === moduleId);
      updatedPermissions.push({
        moduleId,
        moduleName: modObj?.name,
        canView: permKey === 'canView',
        canEdit: permKey === 'canEdit',
        canExecute: permKey === 'canExecute',
        canExport: permKey === 'canExport',
        visibleFields: modObj?.defaultFields || []
      });
    }

    setSelectedStaff({ ...selectedStaff, customPermissions: updatedPermissions });
  };

  const openFieldMaskingModal = (moduleId: string) => {
    if (!selectedStaff) return;
    const modPerm = selectedStaff.customPermissions?.find(p => p.moduleId === moduleId);
    const modDef = SYSTEM_MODULES.find(m => m.id === moduleId);
    setEditingModuleId(moduleId);
    setMaskFields(modPerm?.visibleFields || modDef?.defaultFields || []);
  };

  const toggleFieldVisibility = (field: string) => {
    setMaskFields(prev => 
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  const saveFieldMasking = () => {
    if (!selectedStaff || !editingModuleId) return;

    const updatedPermissions = (selectedStaff.customPermissions || []).map(p => {
      if (p.moduleId === editingModuleId) {
        return { ...p, visibleFields: maskFields };
      }
      return p;
    });

    setSelectedStaff({ ...selectedStaff, customPermissions: updatedPermissions });
    setEditingModuleId(null);
  };

  const handleSaveMatrix = async () => {
    if (!selectedStaff) return;

    setIsSaving(true);
    try {
      await setDoc(doc(db, 'memberships', selectedStaff.id), {
        customPermissions: selectedStaff.customPermissions,
        updatedAt: serverTimestamp()
      }, { merge: true });

      alert(`Матрица прав для ${selectedStaff.fullName} успешно обновлена!`);
    } catch(err: any) {
      alert(`Ошибка сохранения матрицы: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredStaff = staffList.filter(s => 
    s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-[var(--text-main)]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
            <span>Матрица Гранулярных Прав (PBAC / RBAC Matrix)</span>
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Настройка прав Чтения, Изменения, Запуска Бизнес-Процессов и Маскирования Полей (Data Masking)
          </p>
        </div>

        <button 
          onClick={handleSaveMatrix}
          disabled={isSaving || !selectedStaff}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-xs"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          <span>Сохранить Матрицу Прав</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left Column: Staff Members Selector */}
        <div className="md:col-span-4 space-y-3 bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl">
          <div className="text-xs font-bold uppercase font-mono text-[var(--text-muted)] flex items-center justify-between">
            <span>Сотрудники ({staffList.length})</span>
            <Users className="w-3.5 h-3.5 text-emerald-500" />
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input 
              type="text" 
              placeholder="Поиск сотрудника..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
            />
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
              <span>Загрузка сотрудников...</span>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
              {filteredStaff.map(s => {
                const isSelected = selectedStaff?.id === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedStaff(s)}
                    className={`p-3 rounded-xl border transition cursor-pointer select-none flex items-center justify-between ${
                      isSelected 
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-white' 
                        : 'bg-[var(--bg-panel)] border-[var(--border-color)] hover:border-slate-500 text-[var(--text-muted)]'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-bold text-xs text-[var(--text-main)] truncate">{s.fullName}</div>
                      <div className="text-[10px] text-[var(--text-muted)] truncate">{s.email} • {s.role}</div>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-slate-600'}`} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Permission Matrix */}
        <div className="md:col-span-8 bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 rounded-2xl space-y-4">
          
          {selectedStaff ? (
            <>
              {/* Selected Staff Info Banner */}
              <div className="bg-[var(--bg-panel)] border border-[var(--border-color)] p-4 rounded-xl flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-[var(--text-main)]">{selectedStaff.fullName}</h3>
                  <p className="text-xs text-[var(--text-muted)] font-mono">{selectedStaff.email} • Назначенная роль: <span className="text-emerald-400 font-bold uppercase">{selectedStaff.role}</span></p>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold font-mono">
                  PBAC ENABLED
                </span>
              </div>

              {/* Matrix Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--bg-panel)] border-b border-[var(--border-color)] text-[var(--text-muted)] uppercase font-mono text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Модуль / Функция</th>
                      <th className="px-3 py-3 text-center">👁️ Чтение</th>
                      <th className="px-3 py-3 text-center">✏️ Изменение</th>
                      <th className="px-3 py-3 text-center">⚡ Запуск</th>
                      <th className="px-3 py-3 text-center">📥 Экспорт</th>
                      <th className="px-4 py-3 text-right">Маскирование Полей</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {SYSTEM_MODULES.map(mod => {
                      const perm = selectedStaff.customPermissions?.find(p => p.moduleId === mod.id) || {
                        canView: false, canEdit: false, canExecute: false, canExport: false, visibleFields: []
                      };

                      return (
                        <tr key={mod.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition">
                          <td className="px-4 py-3 font-semibold text-[var(--text-main)]">{mod.name}</td>
                          
                          <td className="px-3 py-3 text-center">
                            <input 
                              type="checkbox"
                              checked={perm.canView}
                              onChange={() => togglePermission(mod.id, 'canView')}
                              className="rounded text-emerald-500 focus:ring-0 cursor-pointer"
                            />
                          </td>

                          <td className="px-3 py-3 text-center">
                            <input 
                              type="checkbox"
                              checked={perm.canEdit}
                              onChange={() => togglePermission(mod.id, 'canEdit')}
                              className="rounded text-emerald-500 focus:ring-0 cursor-pointer"
                            />
                          </td>

                          <td className="px-3 py-3 text-center">
                            <input 
                              type="checkbox"
                              checked={perm.canExecute}
                              onChange={() => togglePermission(mod.id, 'canExecute')}
                              className="rounded text-emerald-500 focus:ring-0 cursor-pointer"
                            />
                          </td>

                          <td className="px-3 py-3 text-center">
                            <input 
                              type="checkbox"
                              checked={perm.canExport}
                              onChange={() => togglePermission(mod.id, 'canExport')}
                              className="rounded text-emerald-500 focus:ring-0 cursor-pointer"
                            />
                          </td>

                          <td className="px-4 py-3 text-right">
                            <button 
                              onClick={() => openFieldMaskingModal(mod.id)}
                              className="px-2.5 py-1 bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-main)] hover:border-emerald-500 rounded-lg text-[11px] font-bold font-mono transition cursor-pointer flex items-center gap-1.5 ml-auto"
                            >
                              <Sliders className="w-3 h-3 text-emerald-500" />
                              <span>Полей: {perm.visibleFields?.length || 0}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="py-16 text-center text-xs text-[var(--text-muted)]">
              Выберите сотрудника в левом списке для настройки прав
            </div>
          )}

        </div>
      </div>

      {/* Modal: Field Level Data Masking */}
      {editingModuleId && selectedStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-500" />
                <span>Маскирование Полей (Data Masking)</span>
              </h3>
              <button onClick={() => setEditingModuleId(null)} className="p-1 hover:bg-black/10 rounded text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              Отметьте только те поля, которые сотрудник <strong className="text-[var(--text-main)]">{selectedStaff.fullName}</strong> имею право видеть в интерфейсе:
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto p-1">
              {(SYSTEM_MODULES.find(m => m.id === editingModuleId)?.defaultFields || []).map(f => {
                const isChecked = maskFields.includes(f);
                return (
                  <div 
                    key={f}
                    onClick={() => toggleFieldVisibility(f)}
                    className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between text-xs ${
                      isChecked ? 'bg-emerald-950/40 border-emerald-500/50 text-white' : 'bg-[var(--bg-panel)] border-[var(--border-color)] text-[var(--text-muted)]'
                    }`}
                  >
                    <span className="font-mono text-[11px]">{f}</span>
                    <input type="checkbox" checked={isChecked} onChange={() => {}} className="rounded text-emerald-500" />
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
              <button onClick={() => setEditingModuleId(null)} className="px-3 py-1.5 rounded-xl border text-xs font-bold">Отмена</button>
              <button onClick={saveFieldMasking} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs">Применить</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
