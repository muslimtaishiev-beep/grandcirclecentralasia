import React from 'react';
import { X, Download, DollarSign, Clock, Users } from 'lucide-react';
import { TeacherPayrollRecord } from '../../../../types/edu';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  record?: TeacherPayrollRecord;
  onApprove: (id: string) => void;
  onPay: (id: string) => void;
}

export default function PayrollStatementModal({ isOpen, onClose, record, onApprove, onPay }: Props) {
  if (!isOpen || !record) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[var(--bg-panel)] rounded-2xl max-w-2xl w-full shadow-2xl border border-[var(--border-color)] flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-[var(--border-color)] bg-[var(--bg-app)] rounded-t-2xl">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                record.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                record.status === 'approved' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
              }`}>
                {record.status === 'paid' ? 'ВЫПЛАЧЕНО' : record.status === 'approved' ? 'УТВЕРЖДЕНО' : 'ЧЕРНОВИК'}
              </span>
              <span className="text-sm font-bold text-[var(--text-muted)]">Период: {record.monthPeriod}</span>
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-main)]">{record.teacherName}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl">
              <div className="text-sm font-bold text-[var(--text-muted)] mb-1 flex items-center gap-2">
                <Users className="w-4 h-4" /> Уроков
              </div>
              <div className="text-2xl font-black text-[var(--text-main)]">{record.totalLessonsConducted}</div>
            </div>
            <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl">
              <div className="text-sm font-bold text-[var(--text-muted)] mb-1 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Часов
              </div>
              <div className="text-2xl font-black text-[var(--text-main)]">{record.totalHours}</div>
            </div>
            <div className="p-4 bg-[var(--accent)] text-white rounded-xl shadow-md">
              <div className="text-sm font-bold opacity-80 mb-1 flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> К выплате
              </div>
              <div className="text-2xl font-black">{record.finalTotal.toLocaleString()} {record.currency}</div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="border border-[var(--border-color)] rounded-xl overflow-hidden">
            <div className="bg-[var(--bg-surface)] p-4 border-b border-[var(--border-color)] font-bold text-sm">
              Детализация расчета
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--text-muted)] font-medium">Базовая ставка (за уроки)</span>
                <span className="font-bold">{record.baseEarnings.toLocaleString()} {record.currency}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--text-muted)] font-medium">Бонусы</span>
                <span className="font-bold text-emerald-500">+{record.bonuses.toLocaleString()} {record.currency}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--text-muted)] font-medium">Удержания (Штрафы)</span>
                <span className="font-bold text-rose-500">-{record.deductions.toLocaleString()} {record.currency}</span>
              </div>
              <div className="pt-3 mt-3 border-t border-[var(--border-color)] flex justify-between items-center">
                <span className="font-bold text-[var(--text-main)] text-lg">Итого</span>
                <span className="font-black text-[var(--text-main)] text-lg">{record.finalTotal.toLocaleString()} {record.currency}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-app)] rounded-b-2xl flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-[var(--text-main)] font-bold rounded-xl hover:bg-slate-200 transition">
            <Download className="w-4 h-4" /> PDF
          </button>
          
          <div className="flex-1"></div>

          {record.status === 'draft' && (
            <button 
              onClick={() => onApprove(record.id)}
              className="px-6 py-2 bg-blue-500 text-white font-bold rounded-xl shadow-md hover:bg-blue-600 transition"
            >
              Утвердить расчет
            </button>
          )}

          {record.status === 'approved' && (
            <button 
              onClick={() => onPay(record.id)}
              className="px-6 py-2 bg-[var(--accent)] text-white font-bold rounded-xl shadow-md hover:brightness-110 transition"
            >
              Провести выплату
            </button>
          )}

          {record.status === 'paid' && (
            <div className="px-6 py-2 bg-emerald-50 text-emerald-600 font-bold rounded-xl border border-emerald-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Выплачено {record.paidAt ? new Date(record.paidAt).toLocaleDateString() : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
