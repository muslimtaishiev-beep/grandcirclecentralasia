import React, { useState } from 'react';
import { Tenant } from '../../../types/firestore';
import { MoreVertical, Shield, PauseCircle, PlayCircle, Settings2 } from 'lucide-react';
import { updateTenantPlan, toggleTenantStatus } from '../../../services/superadminService';
import { CreateTenantModal } from './CreateTenantModal';

interface Props {
  tenants: Tenant[];
  onUpdate: () => void;
}

export default function TenantManagementTable({ tenants, onUpdate }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handlePlanChange = async (tenantId: string, currentLimit: number) => {
    const newLimit = window.prompt("Введите новый лимит студентов (100 = Starter, 500 = Business, 99999 = Enterprise):", currentLimit.toString());
    if (newLimit && !isNaN(Number(newLimit))) {
      setLoadingId(tenantId);
      await updateTenantPlan(tenantId, Number(newLimit));
      setLoadingId(null);
      onUpdate();
    }
  };

  const handleStatusToggle = async (tenantId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    if (window.confirm(`Изменить статус тенанта на ${newStatus}?`)) {
      setLoadingId(tenantId);
      await toggleTenantStatus(tenantId, newStatus);
      setLoadingId(null);
      onUpdate();
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden">
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#9F7AEA]" />
          Реестр Организаций
        </h3>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-[#9F7AEA] hover:bg-[#8B5CF6] text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          + Создать Организацию
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-white/5 text-slate-400 font-mono text-xs uppercase">
            <tr>
              <th className="px-6 py-3">Организация</th>
              <th className="px-6 py-3">Субдомен</th>
              <th className="px-6 py-3">Тариф (Лимит)</th>
              <th className="px-6 py-3">Статус</th>
              <th className="px-6 py-3 text-right">Управление</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {tenants.map(t => (
              <tr key={t.id} className={`hover:bg-white/5 transition ${loadingId === t.id ? 'opacity-50' : ''}`}>
                <td className="px-6 py-4">
                  <div className="font-semibold text-white">{t.name}</div>
                  <div className="text-xs text-slate-500">{t.id}</div>
                </td>
                <td className="px-6 py-4 font-mono text-xs text-[#9F7AEA]">
                  {t.slug}.nopelabs.com
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-white/10 rounded-md text-xs">
                    {t.settings.maxStudents <= 100 ? 'Starter' : t.settings.maxStudents <= 500 ? 'Business' : 'Enterprise'} ({t.settings.maxStudents})
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${t.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {t.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => handlePlanChange(t.id, t.settings.maxStudents)}
                      className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition"
                      title="Изменить тариф"
                    >
                      <Settings2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleStatusToggle(t.id, t.status)}
                      className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition"
                      title={t.status === 'active' ? 'Заморозить' : 'Разморозить'}
                    >
                      {t.status === 'active' ? <PauseCircle className="w-4 h-4 text-orange-400" /> : <PlayCircle className="w-4 h-4 text-emerald-400" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                  Нет зарегистрированных организаций
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <CreateTenantModal 
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            onUpdate();
          }}
        />
      )}
    </div>
  );
}
