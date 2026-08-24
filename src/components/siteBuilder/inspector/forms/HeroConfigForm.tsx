import React from 'react';
import { z } from 'zod';
import { SiteBlockSchema } from '../../../../types/siteBuilder';

type HeroConfig = Extract<z.infer<typeof SiteBlockSchema>['config'], { type: 'HERO' }>['data'];

interface Props {
  value: HeroConfig;
  onChange: (updates: Partial<HeroConfig>) => void;
}

export default function HeroConfigForm({ value, onChange }: Props) {
  const updateCta = (key: 'primaryCta' | 'secondaryCta', field: string, val: string) => {
    const currentCta = value[key] || { text: '', link: '', style: key === 'primaryCta' ? 'primary' : 'outline' };
    onChange({ [key]: { ...currentCta, [field]: val } });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Заголовок</label>
        <textarea 
          value={value.title} 
          onChange={e => onChange({ title: e.target.value })}
          className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:border-emerald-500 focus:outline-none h-20"
        />
      </div>
      
      <div>
        <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Подзаголовок</label>
        <textarea 
          value={value.subtitle} 
          onChange={e => onChange({ subtitle: e.target.value })}
          className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:border-emerald-500 focus:outline-none h-24"
        />
      </div>

      <div>
        <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Бейдж (Badge над заголовком)</label>
        <input 
          type="text" 
          value={value.badge || ''} 
          onChange={e => onChange({ badge: e.target.value })}
          className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:border-emerald-500 focus:outline-none"
        />
      </div>

      <div className="pt-4 border-t border-[var(--border-color)]">
        <label className="block text-[10px] uppercase font-bold text-[var(--text-main)] mb-3">Главная кнопка (Primary CTA)</label>
        <div className="space-y-2">
          <input 
            type="text" placeholder="Текст кнопки"
            value={value.primaryCta?.text || ''} 
            onChange={e => updateCta('primaryCta', 'text', e.target.value)}
            className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-sm"
          />
          <input 
            type="text" placeholder="Ссылка (URL)"
            value={value.primaryCta?.link || ''} 
            onChange={e => updateCta('primaryCta', 'link', e.target.value)}
            className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="pt-4 border-t border-[var(--border-color)]">
        <label className="block text-[10px] uppercase font-bold text-[var(--text-main)] mb-3">Второстепенная кнопка (Secondary CTA)</label>
        <div className="space-y-2">
          <input 
            type="text" placeholder="Текст кнопки"
            value={value.secondaryCta?.text || ''} 
            onChange={e => updateCta('secondaryCta', 'text', e.target.value)}
            className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-sm"
          />
          <input 
            type="text" placeholder="Ссылка (URL)"
            value={value.secondaryCta?.link || ''} 
            onChange={e => updateCta('secondaryCta', 'link', e.target.value)}
            className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="pt-4 border-t border-[var(--border-color)]">
        <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Фоновое видео/медиа (URL)</label>
        <input 
          type="text" 
          value={value.backgroundMedia || ''} 
          onChange={e => onChange({ backgroundMedia: e.target.value })}
          className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:border-emerald-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
