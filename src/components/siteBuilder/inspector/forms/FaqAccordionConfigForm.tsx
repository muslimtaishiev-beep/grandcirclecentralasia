import React from 'react';
import { z } from 'zod';
import { SiteBlockSchema } from '../../../../types/siteBuilder';
import { Plus, Trash2 } from 'lucide-react';

type FaqConfig = Extract<z.infer<typeof SiteBlockSchema>['config'], { type: 'FAQ_ACCORDION' }>['data'];

interface Props {
  value: FaqConfig;
  onChange: (updates: Partial<FaqConfig>) => void;
}

export default function FaqAccordionConfigForm({ value, onChange }: Props) {
  const addItem = () => {
    onChange({ 
      items: [
        ...value.items, 
        { id: crypto.randomUUID(), question: 'Новый вопрос', answer: 'Подробный ответ на этот вопрос...' }
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
      <div>
        <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Описание (опционально)</label>
        <input 
          type="text" 
          value={value.subtitle || ''} 
          onChange={e => onChange({ subtitle: e.target.value })}
          className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:border-emerald-500 focus:outline-none"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer mt-2">
        <input 
          type="checkbox" 
          checked={value.allowMultipleExpanded}
          onChange={e => onChange({ allowMultipleExpanded: e.target.checked })}
          className="w-4 h-4 rounded border-[var(--border-color)] text-emerald-500 bg-[var(--bg-panel)]"
        />
        <span className="text-sm font-medium">Разрешить открывать несколько ответов</span>
      </label>

      <div className="pt-4 border-t border-[var(--border-color)]">
        <div className="flex items-center justify-between mb-4">
          <label className="block text-[10px] uppercase font-bold text-[var(--text-main)]">Вопросы (FAQ)</label>
          <button onClick={addItem} className="text-xs text-emerald-500 hover:text-emerald-400 font-bold flex items-center gap-1">
            <Plus className="w-3 h-3" /> Добавить
          </button>
        </div>
        
        <div className="space-y-3">
          {value.items.map(item => (
            <div key={item.id} className="p-3 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl relative group">
              <button onClick={() => removeItem(item.id)} className="absolute top-3 right-3 p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="space-y-2">
                <input 
                  type="text" placeholder="Вопрос"
                  value={item.question} onChange={e => updateItem(item.id, { question: e.target.value })}
                  className="w-full pr-8 bg-transparent border-b border-transparent hover:border-[var(--border-color)] focus:border-emerald-500 px-1 py-1 text-sm font-bold outline-none"
                />
                <textarea 
                  placeholder="Ответ"
                  value={item.answer} onChange={e => updateItem(item.id, { answer: e.target.value })}
                  className="w-full bg-transparent border-b border-transparent hover:border-[var(--border-color)] focus:border-emerald-500 px-1 py-1 text-xs outline-none h-16 resize-none"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
