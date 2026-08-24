import React from 'react';
import { TypographyConfig } from '../../../../types/siteBuilder';
import { AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';

interface Props {
  value: TypographyConfig;
  onChange: (value: TypographyConfig) => void;
}

const FONTS = ['Inter', 'Roboto', 'Plus Jakarta Sans', 'Playfair Display', 'JetBrains Mono'];
const WEIGHTS = [400, 500, 600, 700, 800];

export default function TypographyControl({ value, onChange }: Props) {
  const update = (updates: Partial<TypographyConfig>) => onChange({ ...value, ...updates });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Шрифт</label>
        <select 
          value={value.fontFamily} 
          onChange={e => update({ fontFamily: e.target.value })}
          className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:border-emerald-500 focus:outline-none"
        >
          {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Размер</label>
          <input 
            type="text" 
            value={value.fontSize} 
            onChange={e => update({ fontSize: e.target.value })}
            className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:border-emerald-500 focus:outline-none"
            placeholder="16px / 1rem"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Начертание</label>
          <select 
            value={value.fontWeight} 
            onChange={e => update({ fontWeight: Number(e.target.value) })}
            className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:border-emerald-500 focus:outline-none"
          >
            {WEIGHTS.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Выравнивание</label>
        <div className="flex bg-[var(--bg-panel)] rounded-lg p-1 border border-[var(--border-color)]">
          {[
            { v: 'left', icon: AlignLeft },
            { v: 'center', icon: AlignCenter },
            { v: 'right', icon: AlignRight },
            { v: 'justify', icon: AlignJustify }
          ].map(({ v, icon: Icon }) => (
            <button
              key={v}
              onClick={() => update({ textAlign: v as any })}
              className={`flex-1 flex justify-center items-center py-1.5 rounded-md transition ${value.textAlign === v ? 'bg-white/10 text-emerald-500' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Line Height</label>
          <input 
            type="number" step="0.1"
            value={value.lineHeight} 
            onChange={e => update({ lineHeight: Number(e.target.value) })}
            className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Цвет текста</label>
          <div className="flex gap-2">
            <input 
              type="color" 
              value={value.color}
              onChange={e => update({ color: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer bg-transparent"
            />
            <input 
              type="text" 
              value={value.color}
              onChange={e => update({ color: e.target.value })}
              className="flex-1 w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 text-sm text-[var(--text-main)] font-mono focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
