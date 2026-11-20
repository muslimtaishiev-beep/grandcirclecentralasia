import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Modal, btn, btnPrimary, input, label } from '../../journals/components/ui';
import { CrmPipeline, PipelineStage } from '../../../../types/crm';
import { DEFAULT_CURRENCY, DEFAULT_STAGES } from '../../../../services/crmService';

interface Props {
  pipeline?: CrmPipeline;
  /** Сколько сделок на каждом этапе — этап со сделками не удаляется. */
  dealsByStage: Record<string, number>;
  canDelete: boolean;
  onSave: (p: { id?: string; name: string; stages: PipelineStage[]; currency: string; isDefault?: boolean }) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

const newId = () => `st_${Math.random().toString(36).slice(2, 8)}`;

export default function PipelineEditorModal({ pipeline, dealsByStage, canDelete, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(pipeline?.name || 'Воронка продаж');
  const [currency, setCurrency] = useState(pipeline?.currency || DEFAULT_CURRENCY);
  const [stages, setStages] = useState<PipelineStage[]>(() => JSON.parse(JSON.stringify(pipeline?.stages?.length ? pipeline.stages : DEFAULT_STAGES)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const set = (i: number, patch: Partial<PipelineStage>) => setStages(s => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) => setStages(s => {
    const n = [...s]; const j = i + d;
    if (j < 0 || j >= n.length) return s;
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });
  const flag = (i: number, k: 'isWonStage' | 'isLostStage') => setStages(s => s.map((x, j) => {
    const other = k === 'isWonStage' ? 'isLostStage' : 'isWonStage';
    if (j === i) return { ...x, [k]: !x[k], [other]: false };
    return { ...x, [k]: false };
  }));

  const save = async () => {
    if (!stages.length) { setErr('Нужен хотя бы один этап'); return; }
    setBusy(true); setErr('');
    try { await onSave({ id: pipeline?.id, name, stages, currency, isDefault: pipeline?.isDefault }); onClose(); }
    catch (e: any) { setErr(e?.message || 'Не удалось сохранить'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={pipeline ? 'Воронка' : 'Новая воронка'} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem] gap-3">
          <div><label className={label}>Название</label><input className={input} value={name} onChange={e => setName(e.target.value)} /></div>
          <div><label className={label}>Валюта</label><input className={input} value={currency} maxLength={8} onChange={e => setCurrency(e.target.value.toUpperCase())} /></div>
        </div>
        <div className="space-y-2">
          {stages.map((s, i) => {
            const n = dealsByStage[s.id] || 0;
            return (
              <div key={s.id} className="rounded-xl border border-[var(--border-color)] p-2.5 grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_5.5rem_auto_auto] gap-2 items-center">
                <input type="color" value={s.color} onChange={e => set(i, { color: e.target.value })} className="w-9 h-9 rounded-lg border border-[var(--border-color)] bg-transparent cursor-pointer" aria-label="Цвет" />
                <input className={input} value={s.name} onChange={e => set(i, { name: e.target.value })} />
                <div className="relative order-last sm:order-none col-span-3 sm:col-span-1">
                  <input className={`${input} pr-7`} type="number" min={0} max={100} value={s.probabilityPercent} onChange={e => set(i, { probabilityPercent: Number(e.target.value) })} aria-label="Вероятность" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">%</span>
                </div>
                <div className="flex gap-1 col-span-3 sm:col-span-1 order-last sm:order-none">
                  <button type="button" className={`${btn} !px-2 ${s.isWonStage ? '!border-emerald-500 !text-emerald-600' : ''}`} onClick={() => flag(i, 'isWonStage')}>Успех</button>
                  <button type="button" className={`${btn} !px-2 ${s.isLostStage ? '!border-rose-500 !text-rose-600' : ''}`} onClick={() => flag(i, 'isLostStage')}>Отказ</button>
                </div>
                <div className="flex gap-1">
                  <button type="button" className={`${btn} !px-1.5`} onClick={() => move(i, -1)} disabled={i === 0} title="Выше"><ArrowUp className="w-4 h-4" /></button>
                  <button type="button" className={`${btn} !px-1.5`} onClick={() => move(i, 1)} disabled={i === stages.length - 1} title="Ниже"><ArrowDown className="w-4 h-4" /></button>
                  <button type="button" className={`${btn} !px-1.5`} disabled={n > 0} title={n ? `Сделок на этапе: ${n}` : 'Убрать'} onClick={() => setStages(st => st.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4 text-rose-600" /></button>
                </div>
              </div>
            );
          })}
          <button type="button" className={btn} onClick={() => setStages(s => [...s, { id: newId(), name: '', color: '#64748b', order: s.length, probabilityPercent: 0 }])}><Plus className="w-4 h-4" /> Этап</button>
        </div>
        {err && <div className="text-sm text-rose-600">{err}</div>}
        <div className="flex flex-wrap gap-2 justify-end">
          {pipeline && onDelete && canDelete && <button type="button" className={`${btn} mr-auto text-rose-600`} onClick={() => onDelete().then(onClose).catch(e => setErr(e?.message || 'Не удалось удалить'))}><Trash2 className="w-4 h-4" /> Удалить воронку</button>}
          <button type="button" className={btn} onClick={onClose}>Отмена</button>
          <button type="button" className={btnPrimary} disabled={busy} onClick={save}>Сохранить</button>
        </div>
      </div>
    </Modal>
  );
}
