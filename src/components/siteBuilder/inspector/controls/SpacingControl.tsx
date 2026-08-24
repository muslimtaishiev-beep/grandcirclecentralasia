import React, { useState } from 'react';
import { SpacingConfig } from '../../../../types/siteBuilder';
import { Monitor, Tablet, Smartphone, Link as LinkIcon, Unlink } from 'lucide-react';

interface Props {
  value: SpacingConfig;
  onChange: (value: SpacingConfig) => void;
}

type DeviceType = 'desktop' | 'tablet' | 'mobile';
type SpacingType = 'padding' | 'margin';

export default function SpacingControl({ value, onChange }: Props) {
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [linked, setLinked] = useState<{ padding: boolean; margin: boolean }>({ padding: false, margin: false });

  const updateVal = (type: SpacingType, index: number, val: number) => {
    const newTuple = [...value[device][type]] as [number, number, number, number];
    if (linked[type]) {
      newTuple[0] = val; newTuple[1] = val; newTuple[2] = val; newTuple[3] = val;
    } else {
      newTuple[index] = val;
    }
    onChange({
      ...value,
      [device]: { ...value[device], [type]: newTuple }
    });
  };

  const renderBox = (type: SpacingType) => (
    <div className="mb-4 bg-[var(--bg-panel)] p-3 rounded-xl border border-[var(--border-color)]">
      <div className="flex justify-between items-center mb-2">
        <label className="text-[10px] uppercase font-bold text-[var(--text-muted)]">{type}</label>
        <button onClick={() => setLinked(p => ({ ...p, [type]: !p[type] }))} className="text-[var(--text-muted)] hover:text-emerald-500 transition">
          {linked[type] ? <LinkIcon className="w-3 h-3" /> : <Unlink className="w-3 h-3" />}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1 items-center justify-items-center">
        <div />
        <input type="number" value={value[device][type][0]} onChange={e => updateVal(type, 0, Number(e.target.value))} className="w-12 h-8 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded text-xs text-center text-[var(--text-main)] focus:border-emerald-500 focus:outline-none" />
        <div />
        
        <input type="number" value={value[device][type][3]} onChange={e => updateVal(type, 3, Number(e.target.value))} className="w-12 h-8 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded text-xs text-center text-[var(--text-main)] focus:border-emerald-500 focus:outline-none" />
        <div className="w-12 h-8 bg-slate-800/50 rounded flex items-center justify-center text-[10px] text-[var(--text-muted)] font-mono">{device[0].toUpperCase()}</div>
        <input type="number" value={value[device][type][1]} onChange={e => updateVal(type, 1, Number(e.target.value))} className="w-12 h-8 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded text-xs text-center text-[var(--text-main)] focus:border-emerald-500 focus:outline-none" />

        <div />
        <input type="number" value={value[device][type][2]} onChange={e => updateVal(type, 2, Number(e.target.value))} className="w-12 h-8 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded text-xs text-center text-[var(--text-main)] focus:border-emerald-500 focus:outline-none" />
        <div />
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex bg-[var(--bg-panel)] rounded-lg p-1 border border-[var(--border-color)] mb-4">
        {[
          { v: 'desktop', icon: Monitor },
          { v: 'tablet', icon: Tablet },
          { v: 'mobile', icon: Smartphone }
        ].map(({ v, icon: Icon }) => (
          <button
            key={v}
            onClick={() => setDevice(v as any)}
            className={`flex-1 flex justify-center items-center py-1.5 rounded-md transition ${device === v ? 'bg-white/10 text-emerald-500' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      {renderBox('margin')}
      {renderBox('padding')}
    </div>
  );
}
