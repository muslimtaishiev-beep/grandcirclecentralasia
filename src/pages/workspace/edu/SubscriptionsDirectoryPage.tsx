import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Search, Plus, BookOpen, Snowflake, MinusCircle, Undo2, CalendarPlus, Ban, Sun } from 'lucide-react';
import { Button, PageHeader, Spinner, EmptyState, Modal, toast, confirmDialog, input, label } from '../../../components/ui';
import { useWorkspaceTerms } from '../../../lib/useWorkspaceConfig';
import { apiCall, post } from '../../../lib/eduApi';
import { SUB_STATUS_LABEL, type DirItem, type SubAction, type SubPlan, type SubStatus } from '../../../shared/edu';
import SubscriptionIssueModal from './components/SubscriptionIssueModal';
import DirectoryModal from './components/DirectoryModal';

interface Sub {
  id: string; studentName: string; groupName?: string; planName?: string; type: 'lessons_pack' | 'time_period';
  totalLessons: number; remainingLessons: number; attended?: number; pricePaid: number; currency: string;
  startDate: string; expiryDate: string; status: SubStatus; isFrozen?: boolean; frozenUntilDate?: string;
  refunded?: number; canceled?: { reason: string; by: string };
}
interface Data { subscriptions: Sub[]; plans: SubPlan[]; groups: DirItem[]; rooms: DirItem[]; timezone: string; currency: string; today: string }

const STATUS_CLASS: Record<SubStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700', frozen: 'bg-blue-100 text-blue-700', depleted: 'bg-rose-100 text-rose-700',
  expired: 'bg-slate-200 text-slate-700', canceled: 'bg-slate-200 text-slate-500',
};
const dateRu = (s: string) => (s ? new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString('ru-RU') : '—');

type Ask = { sub: Sub; action: 'freeze' | 'extend' | 'cancel' };

export default function SubscriptionsDirectoryPage() {
  const terms = useWorkspaceTerms();
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const tenantId: string = activeTenant?.id || '';
  const [data, setData] = useState<Data | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | SubStatus>('');
  const [issue, setIssue] = useState(false);
  const [showDir, setShowDir] = useState(false);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    if (!tenantId) return;
    try { setData(await apiCall<Data>(`/api/edu/${tenantId}/subscriptions`)); } catch (e: any) { toast.error(e.message); setData(d => d || { subscriptions: [], plans: [], groups: [], rooms: [], timezone: 'UTC', currency: '', today: '' }); }
  }, [tenantId]);
  useEffect(() => { load(); }, [load]);

  const run = async (s: Sub, action: SubAction, body: Record<string, unknown> = {}) => {
    setBusyId(s.id);
    try { await post(`/api/edu/${tenantId}/subscriptions/${s.id}/${action}`, body); await load(); return true; }
    catch (e: any) { toast.error(e.message); return false; } finally { setBusyId(''); }
  };

  const list = useMemo(() => (data?.subscriptions || []).filter(s =>
    (!status || s.status === status) && s.studentName.toLowerCase().includes(search.trim().toLowerCase())), [data, search, status]);

  if (!data) return <Spinner />;
  return (
    <div className="p-4 sm:p-6">
      <PageHeader title={terms.subscription} actions={<>
        <Button variant="secondary" icon={<BookOpen className="w-4 h-4" />} onClick={() => setShowDir(true)}>Справочники</Button>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setIssue(true)}>{`Выдать: ${terms.subscription.toLowerCase()}`}</Button>
      </>} />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input className={`${input} pl-9`} placeholder={terms.student} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className={`${input} !w-auto`} value={status} onChange={e => setStatus(e.target.value as '' | SubStatus)}>
          <option value="">Все</option>{(Object.keys(SUB_STATUS_LABEL) as SubStatus[]).map(k => <option key={k} value={k}>{SUB_STATUS_LABEL[k]}</option>)}
        </select>
      </div>

      {list.length === 0 ? (
        <EmptyState title={data.subscriptions.length ? 'Ничего не найдено' : `Пока нет: ${terms.subscription.toLowerCase()}`}
          action={data.plans.length === 0 ? <Button variant="primary" onClick={() => setShowDir(true)}>Добавить вид</Button> : <Button variant="primary" onClick={() => setIssue(true)}>Выдать</Button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map(s => {
            const live = s.status === 'active';
            const low = s.type === 'lessons_pack' && s.remainingLessons < 3;
            return (
              <div key={s.id} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 space-y-3">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--text-main)] truncate">{s.studentName}</div>
                    <div className="text-xs text-[var(--text-muted)] truncate">{[s.planName, s.groupName].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span className={`self-start px-2 py-0.5 rounded-md text-[11px] font-semibold ${STATUS_CLASS[s.status]}`}>{SUB_STATUS_LABEL[s.status]}</span>
                </div>
                {s.type === 'lessons_pack' && (
                  <div>
                    <div className="flex justify-between text-sm font-semibold mb-1"><span className="text-[var(--text-muted)]">Остаток</span><span className={low ? 'text-rose-500' : 'text-emerald-600'}>{s.remainingLessons} / {s.totalLessons}</span></div>
                    <div className="h-2 rounded-full bg-[var(--bg-app)]"><div className={`h-2 rounded-full ${low ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${s.totalLessons ? Math.min(100, (s.remainingLessons / s.totalLessons) * 100) : 0}%` }} /></div>
                  </div>
                )}
                <div className="flex justify-between text-xs text-[var(--text-muted)]">
                  <span>{s.isFrozen && s.frozenUntilDate ? `Заморожен до ${dateRu(s.frozenUntilDate)}` : `До ${dateRu(s.expiryDate)}`}</span>
                  <span className="font-semibold text-[var(--text-main)]">{s.pricePaid.toLocaleString('ru-RU')} {s.currency}</span>
                </div>
                {s.canceled && <div className="text-xs text-[var(--text-muted)]">Причина: {s.canceled.reason}{s.refunded ? ` · возврат ${s.refunded}` : ''}</div>}
                {s.status !== 'canceled' && !s.id.startsWith('flat_') && (
                  <div className="flex flex-wrap gap-1.5">
                    {live && <Button size="sm" variant="secondary" loading={busyId === s.id} icon={<MinusCircle className="w-3.5 h-3.5" />} onClick={() => run(s, 'deduct')}>Списать</Button>}
                    {(s.attended || 0) > 0 && <Button size="sm" variant="ghost" icon={<Undo2 className="w-3.5 h-3.5" />} onClick={() => run(s, 'return')}>Вернуть</Button>}
                    {live && <Button size="sm" variant="ghost" icon={<Snowflake className="w-3.5 h-3.5" />} onClick={() => setAsk({ sub: s, action: 'freeze' })}>Заморозить</Button>}
                    {s.status === 'frozen' && <Button size="sm" variant="ghost" icon={<Sun className="w-3.5 h-3.5" />} onClick={() => run(s, 'unfreeze')}>Разморозить</Button>}
                    <Button size="sm" variant="ghost" icon={<CalendarPlus className="w-3.5 h-3.5" />} onClick={() => setAsk({ sub: s, action: 'extend' })}>Продлить</Button>
                    <Button size="sm" variant="ghost" icon={<Ban className="w-3.5 h-3.5" />} onClick={() => setAsk({ sub: s, action: 'cancel' })}>Отменить</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {issue && <SubscriptionIssueModal tenantId={tenantId} plans={data.plans} groups={data.groups} currency={data.currency} today={data.today} onClose={() => setIssue(false)} onSaved={load} />}
      {showDir && <DirectoryModal tenantId={tenantId} dir={{ rooms: data.rooms, groups: data.groups, plans: data.plans, timezone: data.timezone }} start="plans" onClose={() => setShowDir(false)} onSaved={load} />}
      {ask && <ActionModal ask={ask} today={data.today} onClose={() => setAsk(null)} onRun={async (body) => { if (await run(ask.sub, ask.action, body)) setAsk(null); }} />}
    </div>
  );
}

function ActionModal({ ask, today, onClose, onRun }: { ask: Ask; today: string; onClose: () => void; onRun: (body: Record<string, unknown>) => Promise<void> }) {
  const { sub, action } = ask;
  const [until, setUntil] = useState('');
  const [days, setDays] = useState(7);
  const [lessons, setLessons] = useState(0);
  const [reason, setReason] = useState('');
  const [refund, setRefund] = useState(0);
  const [account, setAccount] = useState<'bank' | 'cash'>('bank');
  const [busy, setBusy] = useState(false);
  const titles = { freeze: 'Заморозить', extend: 'Продлить', cancel: 'Отменить' };
  const go = async () => {
    if (action === 'cancel' && refund > 0 && !(await confirmDialog({ title: `Вернуть ${refund} ${sub.currency}?`, message: 'Расход попадёт в кассу', confirmLabel: 'Вернуть', danger: true }))) return;
    setBusy(true);
    await onRun(action === 'freeze' ? { until } : action === 'extend' ? { days, lessons } : { note: reason, refund, account });
    setBusy(false);
  };
  return (
    <Modal title={`${titles[action]}: ${sub.studentName}`} onClose={onClose}>
      <div className="space-y-4">
        {action === 'freeze' && <div><span className={label}>До даты</span><input type="date" className={input} min={today} value={until} onChange={e => setUntil(e.target.value)} /></div>}
        {action === 'extend' && <div className="grid grid-cols-2 gap-3">
          <div><span className={label}>Дней</span><input type="number" min={0} className={input} value={days} onChange={e => setDays(Number(e.target.value))} /></div>
          {sub.type === 'lessons_pack' && <div><span className={label}>Занятий</span><input type="number" min={0} className={input} value={lessons} onChange={e => setLessons(Number(e.target.value))} /></div>}
        </div>}
        {action === 'cancel' && <>
          <div><span className={label}>Причина</span><input className={input} value={reason} onChange={e => setReason(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><span className={label}>Возврат, {sub.currency}</span><input type="number" min={0} max={sub.pricePaid} className={input} value={refund} onChange={e => setRefund(Number(e.target.value))} /></div>
            <div><span className={label}>Откуда</span><select className={input} value={account} onChange={e => setAccount(e.target.value as 'bank' | 'cash')}><option value="bank">Безналичные</option><option value="cash">Наличные</option></select></div>
          </div>
        </>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Назад</Button>
          <Button variant={action === 'cancel' ? 'danger' : 'primary'} loading={busy} disabled={(action === 'freeze' && !until) || (action === 'cancel' && !reason.trim())} onClick={go}>{titles[action]}</Button>
        </div>
      </div>
    </Modal>
  );
}
