import React, { useState } from 'react';
import { TenantProvisioningService, type ProvisionedTenant } from '../../../services/tenant/TenantProvisioningService';

interface CreateTenantModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateTenantModal: React.FC<CreateTenantModalProps> = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [tier, setTier] = useState<'starter' | 'business' | 'enterprise'>('starter');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ProvisionedTenant | null>(null);

  const handleCreate = async () => {
    if (!name.trim() || !subdomain.trim() || !ownerEmail.trim()) {
      setError('Заполните все обязательные поля');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setDone(await TenantProvisioningService.provisionNewTenant(name.trim(), subdomain.trim(), ownerEmail.trim(), tier));
    } catch (e: any) {
      setError(e?.message || 'Не удалось создать организацию');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Новая организация</h2>

        {done ? (
          <div className="space-y-3 text-sm">
            <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg">Организация создана: <b>{done.subdomain}.studyfreeforum.com</b></div>
            <div>Владелец: <b>{done.ownerEmail}</b> — {done.inviteEmailSent ? 'письмо для установки пароля отправлено' : 'письмо не отправлено'}</div>
            {done.inviteLink && (
              <div>
                <div className="font-medium mb-1">Ссылка для входа владельца</div>
                <input readOnly className="w-full border p-2 rounded-lg font-mono text-xs" value={done.inviteLink} onFocus={e => e.currentTarget.select()} />
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={onSuccess} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium">Готово</button>
            </div>
          </div>
        ) : (
          <>
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">{error}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Название организации *</label>
                <input type="text" className="w-full border p-2 rounded-lg" value={name} onChange={e => setName(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Субдомен *</label>
                <div className="flex items-center">
                  <input type="text" className="flex-1 min-w-0 border p-2 rounded-l-lg" value={subdomain} onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
                  <div className="bg-slate-100 border border-l-0 p-2 rounded-r-lg text-slate-500">.studyfreeforum.com</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Почта владельца *</label>
                <input type="email" className="w-full border p-2 rounded-lg" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Тариф</label>
                <select className="w-full border p-2 rounded-lg" value={tier} onChange={e => setTier(e.target.value as typeof tier)}>
                  <option value="starter">Стартовый</option>
                  <option value="business">Бизнес</option>
                  <option value="enterprise">Корпоративный</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">Отмена</button>
              <button onClick={handleCreate} disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-60">
                {loading ? 'Создание…' : 'Создать'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
