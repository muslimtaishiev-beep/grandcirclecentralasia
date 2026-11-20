import { useEffect, useState } from 'react';
import { Button, Modal, OptionPicker, toast, input, label } from '../../../../components/ui';
import { apiCall, post } from '../../../../lib/eduApi';
import { useWorkspaceTerms } from '../../../../lib/useWorkspaceConfig';
import type { DirItem, SubPlan } from '../../../../shared/edu';

interface Props { tenantId: string; plans: SubPlan[]; groups: DirItem[]; currency: string; today: string; onClose: () => void; onSaved: () => void }

/** Выдача абонемента: ученик из базы, вид — из справочника. Оплата попадает в кассу вместе с выдачей. */
export default function SubscriptionIssueModal({ tenantId, plans, groups, currency, today, onClose, onSaved }: Props) {
  const terms = useWorkspaceTerms();
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [planId, setPlanId] = useState(plans[0]?.id || '');
  const [groupId, setGroupId] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [price, setPrice] = useState<number>(plans[0]?.price || 0);
  const [paid, setPaid] = useState(true);
  const [account, setAccount] = useState<'bank' | 'cash'>('bank');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiCall<{ students: { id: string; name: string }[] }>(`/api/edu/${tenantId}/students`).then(j => setStudents(j.students)).catch(e => toast.error(e.message));
  }, [tenantId]);

  const plan = plans.find(p => p.id === planId);
  const student = students.find(s => s.name === studentName);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !plan) { toast.error(`Выберите ${terms.student.toLowerCase()} и вид`); return; }
    setBusy(true);
    try {
      await post(`/api/edu/${tenantId}/subscriptions`, { studentContactId: student.id, studentName: student.name, planId: plan.id, price, groupId, startDate, paid, account });
      toast.success('Выдано'); onSaved(); onClose();
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal title={`Выдать: ${terms.subscription.toLowerCase()}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div><span className={label}>{terms.student}</span>
          <OptionPicker options={students.map(s => ({ label: s.name }))} value={studentName} onChange={setStudentName} placeholder={terms.student} /></div>
        <div><span className={label}>Вид</span>
          <select className={input} value={planId} onChange={e => { setPlanId(e.target.value); setPrice(plans.find(p => p.id === e.target.value)?.price || 0); }}>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
        <div><span className={label}>{terms.group}</span>
          <select className={input} value={groupId} onChange={e => setGroupId(e.target.value)}><option value="">—</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-3">
          <div><span className={label}>С даты</span><input type="date" className={input} value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          <div><span className={label}>Цена, {currency}</span><input type="number" min={0} className={input} value={price} onChange={e => setPrice(Number(e.target.value))} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-main)]">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)} /> Оплачено</label>
          {paid && <select className={`${input} !w-auto`} value={account} onChange={e => setAccount(e.target.value as 'bank' | 'cash')}><option value="bank">Безналичные</option><option value="cash">Наличные</option></select>}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!plan}>Выдать</Button>
        </div>
      </form>
    </Modal>
  );
}
