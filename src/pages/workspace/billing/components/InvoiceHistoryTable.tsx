import React from 'react';
import { BillingInvoice } from '../../../../types/billing';
import { Download, FileText } from 'lucide-react';

interface Props {
  invoices: BillingInvoice[];
}

export default function InvoiceHistoryTable({ invoices }: Props) {
  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)] bg-[var(--bg-panel)] rounded-2xl border border-dashed border-[var(--border-color)]">
        <FileText className="w-8 h-8 mx-auto mb-4 opacity-30" />
        <p>История платежей пуста</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-color)] overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-[var(--border-color)] text-[var(--text-muted)] font-medium uppercase text-xs">
          <tr>
            <th className="px-6 py-4">Счет (Invoice)</th>
            <th className="px-6 py-4">Дата</th>
            <th className="px-6 py-4">Сумма</th>
            <th className="px-6 py-4">Статус</th>
            <th className="px-6 py-4 text-right">Квитанция</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-color)]">
          {invoices.map((inv) => (
            <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
              <td className="px-6 py-4 font-mono font-medium">{inv.invoiceNumber}</td>
              <td className="px-6 py-4">{new Date(inv.createdAt).toLocaleDateString()}</td>
              <td className="px-6 py-4 font-bold">${inv.amount} {inv.currency}</td>
              <td className="px-6 py-4">
                {inv.status === 'paid' && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 uppercase tracking-wider">Оплачено</span>}
                {inv.status === 'pending' && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 uppercase tracking-wider">Ожидает</span>}
                {inv.status === 'failed' && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 uppercase tracking-wider">Ошибка</span>}
              </td>
              <td className="px-6 py-4 text-right">
                {inv.pdfInvoiceUrl ? (
                  <a href={inv.pdfInvoiceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-500 transition font-medium text-xs">
                    <Download className="w-3.5 h-3.5" /> PDF
                  </a>
                ) : (
                  <span className="text-[var(--text-muted)] text-xs">Недоступно</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
