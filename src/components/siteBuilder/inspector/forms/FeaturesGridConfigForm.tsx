import React from 'react';
import { z } from 'zod';
import { SiteBlockSchema } from '../../../../types/siteBuilder';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

type FeaturesConfig = Extract<z.infer<typeof SiteBlockSchema>['config'], { type: 'FEATURES_GRID' }>['data'];

interface Props {
  value: FeaturesConfig;
  onChange: (updates: Partial<FeaturesConfig>) => void;
}

export default function FeaturesGridConfigForm({ value, onChange }: Props) {
  const addItem = () => {
    onChange({ 
      items: [
        ...value.items, 
        { id: crypto.randomUUID(), title: 'Новая фича', description: 'Описание', icon: 'CheckCircle' }
      ] 
    });
  };

  const updateItem = (id: string, updates: any) => {
    onChange({
      items: value.items.map(i => i.id === id ? { ...i, ...updates } : i)
    });
  };

  const removeItem = (id: string) => {
    onChange({ items: value.items.filter(i => i.id !== id) });
  };

  const moveItem = (index: number, dir: 'up' | 'down') => {
    if (dir === 'up' && index === 0) return;
    if (dir === 'down' && index === value.items.length - 1) return;
    const items = [...value.items];
    const target = dir === 'up' ? index - 1 : index + 1;
    [items[index], items[target]] = [items[target], items[index]];
    onChange({ items });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Количество колонок сетки</label>
        <select 
          value={value.columns} 
          onChange={e => onChange({ columns: Number(e.target.value) })}
          className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:border-emerald-500 focus:outline-none"
        >
          {[1,2,3,4].map(n => <option key={n} value={n}>{n} колонки</option>)}
        </select>
      </div>

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
          <label className="block text-[10px] uppercase font-bold text-[var(--text-main)]">Карточки</label>
          <button onClick={addItem} className="text-xs text-emerald-500 hover:text-emerald-400 font-bold flex items-center gap-1">
            <Plus className="w-3 h-3" /> Добавить
          </button>
        </div>
        
        <div className="space-y-3">
          {value.items.map((item, idx) => (
            <div key={item.id} className="p-3 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl relative group">
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => moveItem(idx, 'up')} className="p-1 hover:text-emerald-500"><ArrowUp className="w-3 h-3" /></button>
                <button onClick={() => moveItem(idx, 'down')} className="p-1 hover:text-emerald-500"><ArrowDown className="w-3 h-3" /></button>
                <button onClick={() => removeItem(item.id)} className="p-1 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
              </div>

              <div className="space-y-2 mt-2">
                <input 
                  type="text" placeholder="Lucide Icon (CheckCircle)"
                  value={item.icon} onChange={e => updateItem(item.id, { icon: e.target.value })}
                  className="w-full bg-transparent border-b border-transparent hover:border-[var(--border-color)] focus:border-emerald-500 px-1 py-1 text-xs outline-none"
                />
                <input 
                  type="text" placeholder="Заголовок"
                  value={item.title} onChange={e => updateItem(item.id, { title: e.target.value })}
                  className="w-full bg-transparent border-b border-transparent hover:border-[var(--border-color)] focus:border-emerald-500 px-1 py-1 text-sm font-bold outline-none"
                />
                <textarea 
                  placeholder="Описание"
                  value={item.description} onChange={e => updateItem(item.id, { description: e.target.value })}
                  className="w-full bg-transparent border-b border-transparent hover:border-[var(--border-color)] focus:border-emerald-500 px-1 py-1 text-xs outline-none h-12 resize-none"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
