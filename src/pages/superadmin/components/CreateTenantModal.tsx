import React, { useState } from 'react';
import { TenantProvisioningService } from '../../../services/tenant/TenantProvisioningService';
import { SystemFeatureModule } from '../../../types/capabilities';

interface CreateTenantModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const AVAILABLE_MODULES: { id: SystemFeatureModule; label: string; desc: string }[] = [
  { id: 'MODULE_ANTI_CHEAT_PROCTORING', label: 'Anti-Cheat Shield', desc: 'Полноэкранный локдаун, веб-камера' },
  { id: 'MODULE_STUDENT_QR_IDENTIFIERS', label: 'QR-Паспорта & PIN', desc: 'Генерация часовых PIN-кодов' },
  { id: 'MODULE_DIAGNOSTIC_PDF_ENGINE', label: 'PDF Диагностика', desc: 'Генерация красивых отчетов' },
  { id: 'MODULE_EDU_CORE_JOURNAL', label: 'Edu Core (Журнал)', desc: 'Расписание, абонементы' },
  { id: 'MODULE_CRM_PIPELINES', label: 'CRM Воронки', desc: 'Сделки, лиды, карточки' },
];

export const CreateTenantModal: React.FC<CreateTenantModalProps> = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [tier, setTier] = useState<'starter' | 'business' | 'enterprise'>('starter');
  const [selectedModules, setSelectedModules] = useState<SystemFeatureModule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleModule = (mod: SystemFeatureModule) => {
    setSelectedModules(prev => 
      prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]
    );
  };

  const handleCreate = async () => {
    if (!name || !subdomain || !ownerEmail) {
      setError('Заполните все обязательные поля');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await TenantProvisioningService.provisionNewTenant(name, subdomain, ownerEmail, tier, selectedModules);
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Новая организация (Tenant)</h2>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">{error}</div>}
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Название организации *</label>
            <input type="text" className="w-full border p-2 rounded-lg" value={name} onChange={e=>setName(e.target.value)} placeholder="Oxford Bishkek" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Субдомен *</label>
            <div className="flex items-center">
              <input type="text" className="flex-1 border p-2 rounded-l-lg" value={subdomain} onChange={e=>setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="oxford" />
              <div className="bg-slate-100 border border-l-0 p-2 rounded-r-lg text-slate-500">.studyfreeforum.com</div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email владельца (Admin) *</label>
            <input type="email" className="w-full border p-2 rounded-lg" value={ownerEmail} onChange={e=>setOwnerEmail(e.target.value)} placeholder="admin@oxford.kg" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Тариф</label>
            <select className="w-full border p-2 rounded-lg" value={tier} onChange={e=>setTier(e.target.value as any)}>
              <option value="starter">Starter</option>
              <option value="business">Business</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 mt-4">Подключаемые модули (Capabilities)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AVAILABLE_MODULES.map(mod => (
                <label key={mod.id} className="flex items-start gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="mt-1" checked={selectedModules.includes(mod.id)} onChange={() => toggleModule(mod.id)} />
                  <div>
                    <div className="font-medium text-sm">{mod.label}</div>
                    <div className="text-xs text-slate-500">{mod.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">Отмена</button>
          <button onClick={handleCreate} disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium">
            {loading ? 'Создание...' : '1-Click Provision'}
          </button>
        </div>
      </div>
    </div>
  );
};
