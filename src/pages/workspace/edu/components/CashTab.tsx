import { useCallback, useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Plus, Ban } from 'lucide-react';
import { Button, EmptyState, Modal, Spinner, Table, toast, input, label } from '../../../../components/ui';
import { apiCall, post } from '../../../../lib/eduApi';
import type { CashSummary } from '../../../../server/cash';

type Row = CashSummary['rows'][number];
const fmt = (n: number) => (Number(n) || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateRu = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString('ru-RU');
const ACCOUNT = { cash: 'Наличные', bank: 'Безналичные' } as const;

/** Касса: поступления и расходы вносятся здесь, зарплата и оплаты абонементов приходят сами. */
export default function CashTab({ tenantId, month, onChanged }: { tenantId: string; month: string; onChanged?: () => void }) {
  const [sum, setSum] = useState<CashSummary | null>(null);
  const [cats, setCats] = useState<{ in: string[]; out: string[] }>({ in: [], out: [] });
  const [adding, setAdding] = useState(false);
  const [voiding, setVoiding] = useState<Row | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([
        apiCall<CashSummary>(`/api/payroll/${tenantId}/cash?month=${month}`),
        apiCall<{ in: string[]; out: string[] }>(`/api/payroll/${tenantId}/categories`),
      ]);
      setSum(s); setCats({ in: c.in, out: c.out });
    } catch (e: any) { toast.error(e.message); }
  }, [tenantId, month]);
  useEffect(() => { setSum(null); load(); }, [load]);

  if (!sum) return <Spinner />;
  const cards: [string, number, string][] = [
    ['Остаток на начало', sum.opening, ''], ['Поступления', sum.income, 'text-emerald-600'], ['Расходы', sum.expense, 'text-rose-600'], ['Остаток на конец', sum.closing, sum.closing < 0 ? 'text-rose-600' : ''],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(([l, v, c]) => (
          <div key={l} className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-3">
            <div className="text-xs text-[var(--text-muted)]">{l}</div>
            <div className={`text-lg font-bold tabular-nums ${c}`}>{fmt(v)} <span className="text-xs font-normal text-[var(--text-muted)]">{sum.currency}</span></div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-[var(--text-muted)]">Зарплата выплачена: {fmt(sum.payrollPaid)} · налоги и взносы: {fmt(sum.payrollTaxes)} {sum.currency}</span>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setAdding(true)}>Внести</Button>
      </div>
      {sum.rows.length === 0 ? <EmptyState title="Движений за месяц нет" /> : (
        <Table minWidth={760}>
          <thead><tr><th>Дата</th><th></th><th>Статья</th><th>От кого / кому</th><th>Счёт</th><th className="text-right">Сумма</th><th /></tr></thead>
          <tbody>
            {sum.rows.map(r => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">{dateRu(r.date)}</td>
                <td>{r.kind === 'in' ? <ArrowDownLeft className="w-4 h-4 text-emerald-600" /> : <ArrowUpRight className="w-4 h-4 text-rose-600" />}</td>
                <td><div>{r.category}</div>{r.note && <div className="text-xs text-[var(--text-muted)]">{r.note}</div>}</td>
                <td>{r.counterparty || '—'}</td>
                <td className="text-xs">{ACCOUNT[r.account]}</td>
                <td className={`text-right tabular-nums font-semibold ${r.kind === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>{r.kind === 'in' ? '+' : '−'}{fmt(r.amount)}</td>
                <td className="text-right">{!r.readonly && <button type="button" title="Отменить запись" className="p-1 text-[var(--text-muted)] hover:text-rose-600" onClick={() => setVoiding(r)}><Ban className="w-4 h-4" /></button>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {adding && <EntryModal tenantId={tenantId} cats={cats} month={month} onClose={() => setAdding(false)} onSaved={() => { load(); onChanged?.(); }} />}
      {voiding && <VoidModal tenantId={tenantId} row={voiding} onClose={() => setVoiding(null)} onSaved={() => { load(); onChanged?.(); }} />}
    </div>
  );
}

function EntryModal({ tenantId, cats, month, onClose, onSaved }: { tenantId: string; cats: { in: string[]; out: string[] }; month: string; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toLocaleDateString('en-CA');
  const [kind, setKind] = useState<'in' | 'out'>('in');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(today.startsWith(month) ? today : `${month}-01`);
  const [category, setCategory] = useState('');
  const [account, setAccount] = useState<'cash' | 'bank'>('bank');
  const [counterparty, setCounterparty] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await post(`/api/payroll/${tenantId}/cash`, { kind, amount, date, category, account, counterparty, note }); toast.success('Внесено'); onSaved(); onClose(); }
    catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal title="Движение по кассе" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex rounded-lg border border-[var(--border-color)] p-0.5 w-fit">
          {(['in', 'out'] as const).map(k => <button key={k} type="button" onClick={() => setKind(k)} className={`px-4 py-1 text-sm rounded-md ${kind === k ? 'bg-[var(--accent)] text-white font-semibold' : 'text-[var(--text-muted)]'}`}>{k === 'in' ? 'Поступление' : 'Расход'}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><span className={label}>Сумма</span><input type="number" min={0} step="0.01" className={input} value={amount || ''} onChange={e => setAmount(Number(e.target.value))} /></div>
          <div><span className={label}>Дата</span><input type="date" className={input} value={date} onChange={e => setDate(e.target.value)} /></div>
        </div>
        <div><span className={label}>Статья</span><input className={input} list="cash-cats" value={category} onChange={e => setCategory(e.target.value)} />
          <datalist id="cash-cats">{cats[kind].map(c => <option key={c} value={c} />)}</datalist></div>
        <div className="grid grid-cols-2 gap-3">
          <div><span className={label}>{kind === 'in' ? 'От кого' : 'Кому'}</span><input className={input} value={counterparty} onChange={e => setCounterparty(e.target.value)} /></div>
          <div><span className={label}>Счёт</span><select className={input} value={account} onChange={e => setAccount(e.target.value as 'cash' | 'bank')}><option value="bank">Безналичные</option><option value="cash">Наличные</option></select></div>
        </div>
        <div><span className={label}>Примечание</span><input className={input} value={note} onChange={e => setNote(e.target.value)} /></div>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Отмена</Button><Button type="submit" variant="primary" loading={busy} disabled={!(amount > 0) || !category.trim()}>Внести</Button></div>
      </form>
    </Modal>
  );
}

function VoidModal({ tenantId, row, onClose, onSaved }: { tenantId: string; row: Row; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { await post(`/api/payroll/${tenantId}/cash/${row.id}/void`, { reason }); onSaved(); onClose(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Отменить запись: ${fmt(row.amount)}`} onClose={onClose}>
      <div className="space-y-4">
        <div><span className={label}>Причина</span><input className={input} value={reason} onChange={e => setReason(e.target.value)} /></div>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Назад</Button><Button variant="danger" loading={busy} disabled={!reason.trim()} onClick={go}>Отменить запись</Button></div>
      </div>
    </Modal>
  );
}
