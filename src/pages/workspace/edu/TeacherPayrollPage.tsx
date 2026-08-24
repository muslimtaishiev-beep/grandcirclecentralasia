import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Calendar, DollarSign, Search, FileText } from 'lucide-react';
import { useTeacherPayroll } from '../../../hooks/edu/useTeacherPayroll';
import PayrollStatementModal from './components/PayrollStatementModal';
import { TeacherPayrollRecord } from '../../../types/edu';
import { format } from 'date-fns';

export default function TeacherPayrollPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [search, setSearch] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<TeacherPayrollRecord | null>(null);

  const { records, approve, markPaid } = useTeacherPayroll(activeTenant?.id, month);

  const filtered = records.filter(r => r.teacherName.toLowerCase().includes(search.toLowerCase()));

  const totalPayroll = records.reduce((acc, r) => acc + r.finalTotal, 0);
  const paidPayroll = records.filter(r => r.status === 'paid').reduce((acc, r) => acc + r.finalTotal, 0);

  const handleApprove = async (id: string) => {
    await approve(id);
    setSelectedRecord(prev => prev ? { ...prev, status: 'approved' } : null);
  };

  const handlePay = async (id: string) => {
    await markPaid(id);
    setSelectedRecord(prev => prev ? { ...prev, status: 'paid', paidAt: Date.now() } : null);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-[var(--bg-app)]">
      <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-panel)] shrink-0">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-main)]">Зарплаты</h1>
            <p className="text-[var(--text-muted)] mt-1 font-medium text-sm">Расчеты и выплаты преподавателям</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input 
                type="month" 
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2 text-sm font-bold focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <button className="px-4 py-2 bg-[var(--accent)] text-white font-bold rounded-xl shadow-md hover:brightness-110 transition flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Начислить аванс
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-color)]">
            <div className="text-sm font-bold text-[var(--text-muted)] mb-1">К выплате за месяц</div>
            <div className="text-2xl font-black text-[var(--text-main)]">{totalPayroll.toLocaleString()} KGS</div>
          </div>
          <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-color)]">
            <div className="text-sm font-bold text-[var(--text-muted)] mb-1">Выплачено</div>
            <div className="text-2xl font-black text-emerald-500">{paidPayroll.toLocaleString()} KGS</div>
          </div>
          <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-color)]">
            <div className="text-sm font-bold text-[var(--text-muted)] mb-1">Остаток долга</div>
            <div className="text-2xl font-black text-rose-500">{(totalPayroll - paidPayroll).toLocaleString()} KGS</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <input 
            type="text" 
            placeholder="Поиск преподавателя..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-12 pr-4 py-3 text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] shadow-sm"
          />
        </div>

        <div className="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-surface)] border-b border-[var(--border-color)] text-sm font-bold text-[var(--text-muted)]">
                <th className="p-4">Преподаватель</th>
                <th className="p-4 text-center">Уроков</th>
                <th className="p-4 text-right">Начислено</th>
                <th className="p-4 text-right">Бонусы</th>
                <th className="p-4 text-right">Удержания</th>
                <th className="p-4 text-right text-[var(--text-main)]">Итого</th>
                <th className="p-4 text-center">Статус</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(record => (
                <tr key={record.id} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-surface)]/50 transition">
                  <td className="p-4 font-bold text-[var(--text-main)]">{record.teacherName}</td>
                  <td className="p-4 text-center font-medium">{record.totalLessonsConducted}</td>
                  <td className="p-4 text-right font-medium">{record.baseEarnings.toLocaleString()}</td>
                  <td className="p-4 text-right font-medium text-emerald-500">{record.bonuses > 0 ? `+${record.bonuses}` : '-'}</td>
                  <td className="p-4 text-right font-medium text-rose-500">{record.deductions > 0 ? `-${record.deductions}` : '-'}</td>
                  <td className="p-4 text-right font-black text-lg">{record.finalTotal.toLocaleString()}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      record.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                      record.status === 'approved' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {record.status === 'paid' ? 'Выплачено' : record.status === 'approved' ? 'Утверждено' : 'Черновик'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => setSelectedRecord(record)}
                      className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition text-slate-500 hover:text-[var(--text-main)]"
                    >
                      <FileText className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[var(--text-muted)] font-medium">
                    Нет данных за выбранный месяц
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PayrollStatementModal 
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        record={selectedRecord!}
        onApprove={handleApprove}
        onPay={handlePay}
      />
    </div>
  );
}
