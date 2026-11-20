import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Modal, Tabs, toast, input, label } from '../../../../components/ui';
import { put } from '../../../../lib/eduApi';
import { PLAN_TYPE_LABEL, type DirItem, type EduDirectory, type PlanType, type SubPlan } from '../../../../shared/edu';
import { useWorkspaceTerms } from '../../../../lib/useWorkspaceConfig';

interface Props { tenantId: string; dir: EduDirectory; start?: 'rooms' | 'groups' | 'plans' | 'zone'; onClose: () => void; onSaved: (d: EduDirectory) => void }

const zones = (): string[] => {
  try { return (Intl as any).supportedValuesOf('timeZone') as string[]; } catch { return ['UTC']; }
};
const rid = () => `i${Math.random().toString(36).slice(2, 8)}`;

/** Справочники организации: кабинеты, группы, виды абонементов, часовой пояс. */
export default function DirectoryModal({ tenantId, dir, start = 'groups', onClose, onSaved }: Props) {
  const terms = useWorkspaceTerms();
  const [tab, setTab] = useState<string>(start);
  const [rooms, setRooms] = useState<DirItem[]>(dir.rooms);
  const [groups, setGroups] = useState<DirItem[]>(dir.groups);
  const [plans, setPlans] = useState<SubPlan[]>(dir.plans);
  const [timezone, setTimezone] = useState(dir.timezone);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const j = await put<EduDirectory>(`/api/edu/${tenantId}/directory`, { rooms, groups, plans, timezone });
      toast.success('Сохранено');
      onSaved({ rooms: j.rooms, groups: j.groups, plans: j.plans, timezone: j.timezone });
      onClose();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const list = (items: DirItem[], set: (v: DirItem[]) => void, ph: string) => (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={it.id} className="flex gap-2">
          <input className={input} value={it.name} placeholder={ph} onChange={e => set(items.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
          <button type="button" aria-label="Убрать" className="p-2 text-[var(--text-muted)] hover:text-red-500" onClick={() => set(items.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <Button variant="secondary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => set([...items, { id: rid(), name: '' }])}>Добавить</Button>
    </div>
  );
  const setPlan = (i: number, p: Partial<SubPlan>) => setPlans(plans.map((x, j) => j === i ? { ...x, ...p } : x));

  return (
    <Modal title="Справочники" onClose={onClose} wide>
      <div className="space-y-4">
        <Tabs value={tab} onChange={setTab} tabs={[
          { id: 'groups', label: terms.group, count: groups.length }, { id: 'rooms', label: terms.room, count: rooms.length },
          { id: 'plans', label: terms.subscription, count: plans.length }, { id: 'zone', label: 'Часовой пояс' },
        ]} />
        {tab === 'groups' && list(groups, setGroups, terms.group)}
        {tab === 'rooms' && list(rooms, setRooms, terms.room)}
        {tab === 'plans' && (
          <div className="space-y-3">
            {plans.map((p, i) => (
              <div key={p.id} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
                <div className="col-span-2"><span className={label}>Название</span><input className={input} value={p.name} onChange={e => setPlan(i, { name: e.target.value })} /></div>
                <div><span className={label}>Вид</span>
                  <select className={input} value={p.type} onChange={e => setPlan(i, { type: e.target.value as PlanType })}>
                    {(Object.keys(PLAN_TYPE_LABEL) as PlanType[]).map(k => <option key={k} value={k}>{PLAN_TYPE_LABEL[k]}</option>)}
                  </select></div>
                <div><span className={label}>Занятий</span><input type="number" min={1} disabled={p.type !== 'lessons_pack'} className={input} value={p.lessons || ''} onChange={e => setPlan(i, { lessons: Number(e.target.value) })} /></div>
                <div><span className={label}>Дней</span><input type="number" min={1} className={input} value={p.days || ''} onChange={e => setPlan(i, { days: Number(e.target.value) })} /></div>
                <div className="flex gap-2">
                  <div className="flex-1"><span className={label}>Цена</span><input type="number" min={0} className={input} value={p.price} onChange={e => setPlan(i, { price: Number(e.target.value) })} /></div>
                  <button type="button" aria-label="Убрать" className="p-2 text-[var(--text-muted)] hover:text-red-500" onClick={() => setPlans(plans.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
            <Button variant="secondary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setPlans([...plans, { id: rid(), name: '', type: 'lessons_pack', lessons: 8, days: 30, price: 0 }])}>Добавить</Button>
          </div>
        )}
        {tab === 'zone' && (
          <select className={input} value={timezone} onChange={e => setTimezone(e.target.value)}>
            {[...new Set([timezone, ...zones()])].map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button loading={busy} onClick={save}>Сохранить</Button>
        </div>
      </div>
    </Modal>
  );
}
