import React from 'react';
import { z } from 'zod';
import { SiteBlockSchema } from '../../../../types/siteBuilder';
import { Plus, Trash2, ShieldCheck, CheckSquare, Square } from 'lucide-react';

type PricingConfig = Extract<z.infer<typeof SiteBlockSchema>['config'], { type: 'PRICING_TABLE' }>['data'];

interface Props {
  value: PricingConfig;
  onChange: (updates: Partial<PricingConfig>) => void;
}

export default function PricingTableConfigForm({ value, onChange }: Props) {
  
  const addTier = () => {
    onChange({ 
      tiers: [
        ...value.tiers, 
        { 
          id: crypto.randomUUID(), 
          name: 'Новый тариф', 
          price: '0', 
          period: '/мес', 
          isPopular: false, 
          features: [{ name: 'Функция 1', isIncluded: true }],
          cta: { text: 'Купить', link: '#', style: 'primary' }
        }
      ] 
    });
  };

  const updateTier = (id: string, updates: any) => {
    onChange({
      tiers: value.tiers.map(t => t.id === id ? { ...t, ...updates } : t)
    });
  };

  const removeTier = (id: string) => {
    onChange({ tiers: value.tiers.filter(t => t.id !== id) });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Заголовок Секции</label>
        <input 
          type="text" 
          value={value.title} 
          onChange={e => onChange({ title: e.target.value })}
          className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:border-emerald-500 focus:outline-none"
        />
      </div>

      <div className="pt-4 border-t border-[var(--border-color)]">
        <div className="flex items-center justify-between mb-4">
          <label className="block text-[10px] uppercase font-bold text-[var(--text-main)]">Тарифные планы</label>
          <button onClick={addTier} className="text-xs text-emerald-500 hover:text-emerald-400 font-bold flex items-center gap-1">
            <Plus className="w-3 h-3" /> Добавить
          </button>
        </div>
        
        <div className="space-y-4">
          {value.tiers.map(tier => (
            <div key={tier.id} className="p-4 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl relative group">
              <button onClick={() => removeTier(tier.id)} className="absolute top-3 right-3 p-1 text-slate-400 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="space-y-3">
                <div className="flex gap-2 mr-6">
                  <input 
                    type="text" value={tier.name} onChange={e => updateTier(tier.id, { name: e.target.value })}
                    placeholder="Название (ПРО)"
                    className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded px-2 py-1.5 text-sm font-bold"
                  />
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={tier.isPopular} onChange={e => updateTier(tier.id, { isPopular: e.target.checked })} />
                    Популярный
                  </label>
                </div>
                
                <div className="flex gap-2">
                  <input 
                    type="text" value={tier.price} onChange={e => updateTier(tier.id, { price: e.target.value })}
                    placeholder="Цена" className="w-20 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded px-2 py-1.5 text-sm"
                  />
                  <input 
                    type="text" value={tier.period || ''} onChange={e => updateTier(tier.id, { period: e.target.value })}
                    placeholder="/мес" className="w-16 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded px-2 py-1.5 text-sm text-[var(--text-muted)]"
                  />
                </div>

                <div className="bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-color)]">
                  <div className="text-[10px] font-bold uppercase text-[var(--text-muted)] mb-2 flex justify-between">
                    Фичи
                    <button onClick={() => updateTier(tier.id, { features: [...tier.features, { name: 'Новая фича', isIncluded: true }] })} className="text-emerald-500">Добавить</button>
                  </div>
                  <div className="space-y-1">
                    {tier.features.map((f, i) => (
                      <div key={i} className="flex gap-1 items-center">
                        <button onClick={() => {
                          const nf = [...tier.features];
                          nf[i].isIncluded = !nf[i].isIncluded;
                          updateTier(tier.id, { features: nf });
                        }}>
                          {f.isIncluded ? <CheckSquare className="w-4 h-4 text-emerald-500" /> : <Square className="w-4 h-4 text-slate-500" />}
                        </button>
                        <input 
                          type="text" value={f.name} 
                          onChange={e => {
                            const nf = [...tier.features];
                            nf[i].name = e.target.value;
                            updateTier(tier.id, { features: nf });
                          }}
                          className="flex-1 bg-transparent text-xs px-1 py-1 outline-none border-b border-transparent hover:border-slate-500 focus:border-emerald-500"
                        />
                        <button onClick={() => {
                          const nf = [...tier.features];
                          nf.splice(i, 1);
                          updateTier(tier.id, { features: nf });
                        }} className="text-red-500/50 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
