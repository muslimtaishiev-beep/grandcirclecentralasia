import React, { useState } from 'react';
import { Database, Loader2 } from 'lucide-react';
import { seedRealisticTenantData } from '../../services/demoDataSeeder';
import { useParams } from 'react-router-dom';

export default function DemoSeedButton() {
  const { orgId } = useParams();
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if (!orgId) return;
    if (!window.confirm('Внимание! Это добавит тестовые данные (контакты, сделки, задачи) в текущий тенант. Продолжить?')) return;
    
    setLoading(true);
    try {
      await seedRealisticTenantData(orgId);
      window.location.reload(); // Refresh to see the new data
    } catch (e) {
      console.error(e);
      alert('Ошибка при генерации демо-данных');
    } finally {
      setLoading(false);
    }
  };

  if (!orgId) return null;

  return (
    <button
      onClick={handleSeed}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 rounded-lg transition"
      title="1-Click Demo Data Seeder"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
      <span className="hidden sm:inline">Сгенерировать демо-данные</span>
    </button>
  );
}
