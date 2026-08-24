import React from 'react';
import { BackgroundConfig } from '../../../../types/siteBuilder';

interface Props {
  value: BackgroundConfig;
  onChange: (value: BackgroundConfig) => void;
}

export default function BackgroundControl({ value, onChange }: Props) {
  const update = (updates: Partial<BackgroundConfig>) => onChange({ ...value, ...updates });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Тип Фона</label>
        <select 
          value={value.type} 
          onChange={e => update({ type: e.target.value as any })}
          className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:border-emerald-500 focus:outline-none"
        >
          <option value="solid">Сплошной Цвет (Solid)</option>
          <option value="linear-gradient">Линейный Градиент</option>
          <option value="radial-gradient">Радиальный Градиент</option>
          <option value="image">Изображение (Image)</option>
        </select>
      </div>

      {value.type === 'solid' && (
        <div>
          <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Цвет</label>
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
              className="flex-1 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 text-sm font-mono focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {(value.type === 'linear-gradient' || value.type === 'radial-gradient') && (
        <div>
          <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Градиент CSS</label>
          <input 
            type="text" 
            value={value.gradient || ''}
            onChange={e => update({ gradient: e.target.value })}
            placeholder="to right, #ff0000, #0000ff"
            className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>
      )}

      {value.type === 'image' && (
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">URL Изображения</label>
            <input 
              type="text" 
              value={value.imageUrl || ''}
              onChange={e => update({ imageUrl: e.target.value })}
              placeholder="https://..."
              className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Размер</label>
              <select 
                value={value.imageSize || 'cover'}
                onChange={e => update({ imageSize: e.target.value as any })}
                className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Позиция</label>
              <input 
                type="text" 
                value={value.imagePosition || 'center'}
                onChange={e => update({ imagePosition: e.target.value })}
                placeholder="center center"
                className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">
              Прозрачность оверлея: {Math.round((value.overlayOpacity || 0) * 100)}%
            </label>
            <input 
              type="range" min="0" max="1" step="0.05"
              value={value.overlayOpacity || 0}
              onChange={e => update({ overlayOpacity: Number(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
