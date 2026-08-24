import React from 'react';
import { BorderAndShadowConfig } from '../../../../types/siteBuilder';

interface Props {
  value: BorderAndShadowConfig;
  onChange: (value: BorderAndShadowConfig) => void;
}

export default function BorderShadowControl({ value, onChange }: Props) {
  const update = (updates: Partial<BorderAndShadowConfig>) => onChange({ ...value, ...updates });
  const updateShadow = (updates: Partial<NonNullable<BorderAndShadowConfig['shadow']>>) => {
    onChange({ ...value, shadow: { ...(value.shadow || { x: 0, y: 0, blur: 0, spread: 0, color: 'rgba(0,0,0,0)' }), ...updates } });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Скругление (Radius)</label>
          <input 
            type="number" 
            value={value.borderRadius} 
            onChange={e => update({ borderRadius: Number(e.target.value) })}
            className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Толщина (Width)</label>
          <input 
            type="number" 
            value={value.borderWidth} 
            onChange={e => update({ borderWidth: Number(e.target.value) })}
            className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Стиль</label>
          <select 
            value={value.borderStyle} 
            onChange={e => update({ borderStyle: e.target.value as any })}
            className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="none">None</option>
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Цвет границы</label>
          <div className="flex gap-2">
            <input 
              type="color" 
              value={value.borderColor}
              onChange={e => update({ borderColor: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer bg-transparent"
            />
            <input 
              type="text" 
              value={value.borderColor}
              onChange={e => update({ borderColor: e.target.value })}
              className="flex-1 w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 text-sm font-mono focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-[var(--border-color)] space-y-3">
        <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)]">Тень (Box Shadow)</label>
        
        <div className="grid grid-cols-4 gap-1">
          <div>
            <label className="block text-[8px] text-[var(--text-muted)] mb-1 text-center">X</label>
            <input type="number" value={value.shadow?.x || 0} onChange={e => updateShadow({ x: Number(e.target.value) })} className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded px-1 py-1 text-xs text-center focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-[8px] text-[var(--text-muted)] mb-1 text-center">Y</label>
            <input type="number" value={value.shadow?.y || 0} onChange={e => updateShadow({ y: Number(e.target.value) })} className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded px-1 py-1 text-xs text-center focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-[8px] text-[var(--text-muted)] mb-1 text-center">Blur</label>
            <input type="number" value={value.shadow?.blur || 0} onChange={e => updateShadow({ blur: Number(e.target.value) })} className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded px-1 py-1 text-xs text-center focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-[8px] text-[var(--text-muted)] mb-1 text-center">Spread</label>
            <input type="number" value={value.shadow?.spread || 0} onChange={e => updateShadow({ spread: Number(e.target.value) })} className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded px-1 py-1 text-xs text-center focus:border-emerald-500 focus:outline-none" />
          </div>
        </div>
        
        <div>
          <label className="block text-[8px] text-[var(--text-muted)] mb-1">Color (RGBA/Hex)</label>
          <input 
            type="text" 
            value={value.shadow?.color || 'rgba(0,0,0,0)'}
            onChange={e => updateShadow({ color: e.target.value })}
            className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
