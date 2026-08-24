import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import { SiteBlockSchema } from '../../../../types/siteBuilder';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import { useParams } from 'react-router-dom';

type EmbedConfig = Extract<z.infer<typeof SiteBlockSchema>['config'], { type: 'FUNCTION_EMBED' }>['data'];

interface Props {
  value: EmbedConfig;
  onChange: (updates: Partial<EmbedConfig>) => void;
}

export default function FunctionEmbedConfigForm({ value, onChange }: Props) {
  const { orgId } = useParams();
  const [functions, setFunctions] = useState<Array<{id: string, name: string}>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFuncs = async () => {
      try {
        const q = query(collection(db, 'custom_business_functions'), where('tenantId', '==', orgId));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
        setFunctions(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchFuncs();
  }, [orgId]);

  return (
    <div className="space-y-4">
      <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl space-y-4">
        <div>
          <label className="block text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 mb-1">Привязка Бизнес-Функции</label>
          <select 
            value={value.embeddedFunctionId} 
            onChange={e => onChange({ embeddedFunctionId: e.target.value })}
            className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:border-emerald-500 focus:outline-none"
          >
            <option value="">-- Выберите функцию --</option>
            {loading ? <option disabled>Загрузка...</option> : functions.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] uppercase font-bold text-[var(--text-main)] mb-1">Режим отображения виджета</label>
          <select 
            value={value.widgetTheme} 
            onChange={e => onChange({ widgetTheme: e.target.value as any })}
            className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:border-emerald-500 focus:outline-none"
          >
            <option value="card">Card Container (В карточке)</option>
            <option value="inline">Inline Embed (Напрямую в потоке)</option>
            <option value="full-bleed">Full Bleed (На всю ширину)</option>
          </select>
        </div>
      </div>

      <div className="pt-4 border-t border-[var(--border-color)] space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input 
            type="checkbox" 
            checked={value.hideSystemHeaders}
            onChange={e => onChange({ hideSystemHeaders: e.target.checked })}
            className="w-4 h-4 rounded border-[var(--border-color)] text-emerald-500 focus:ring-emerald-500 bg-[var(--bg-panel)]"
          />
          <span className="text-sm font-medium text-[var(--text-main)]">Скрыть системные заголовки функции</span>
        </label>
      </div>

      <div>
        <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Свой заголовок поверх виджета (опционально)</label>
        <input 
          type="text" 
          value={value.title || ''} 
          onChange={e => onChange({ title: e.target.value })}
          className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:border-emerald-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Свое описание (опционально)</label>
        <textarea 
          value={value.subtitle || ''} 
          onChange={e => onChange({ subtitle: e.target.value })}
          className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:border-emerald-500 focus:outline-none h-16"
        />
      </div>
    </div>
  );
}
