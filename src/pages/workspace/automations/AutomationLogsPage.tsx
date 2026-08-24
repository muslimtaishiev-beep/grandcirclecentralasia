import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import { useAutomations } from '../../../hooks/useAutomations';

export default function AutomationLogsPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const navigate = useNavigate();
  const { logs } = useAutomations(activeTenant?.id);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-[var(--bg-app)]">
      <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-panel)] shrink-0 flex items-center gap-4">
        <button 
          onClick={() => navigate(`/${activeTenant?.id}/automations`)}
          className="p-2 hover:bg-[var(--bg-surface)] rounded-xl transition text-[var(--text-muted)]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-black text-[var(--text-main)]">Журнал выполнений</h1>
          <p className="text-[var(--text-muted)] text-sm font-medium">История срабатывания правил автоматизации</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-surface)] border-b border-[var(--border-color)] text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <th className="p-4 pl-6">Статус</th>
                <th className="p-4">Время</th>
                <th className="p-4">Правило</th>
                <th className="p-4">Триггер</th>
                <th className="p-4 pr-6">Детали</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
              {logs.map(log => (
                <tr key={log.id} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-surface)] transition group">
                  <td className="p-4 pl-6">
                    {log.status === 'success' && <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg w-max"><CheckCircle2 className="w-4 h-4" /> Успех</div>}
                    {log.status === 'failed' && <div className="flex items-center gap-2 text-red-600 bg-red-50 px-2 py-1 rounded-lg w-max"><XCircle className="w-4 h-4" /> Ошибка</div>}
                    {log.status === 'skipped_conditions' && <div className="flex items-center gap-2 text-slate-500 bg-slate-100 px-2 py-1 rounded-lg w-max"><AlertCircle className="w-4 h-4" /> Пропущено</div>}
                  </td>
                  <td className="p-4 text-[var(--text-main)] whitespace-nowrap">
                    <div className="flex items-center gap-1.5 opacity-70">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </td>
                  <td className="p-4 text-[var(--text-main)] font-bold">{log.ruleName}</td>
                  <td className="p-4 text-[var(--text-muted)]">{log.triggerType}</td>
                  <td className="p-4 pr-6">
                    <button 
                      onClick={() => alert(JSON.stringify(log.payloadSnapshot, null, 2))}
                      className="text-xs font-bold text-[var(--accent)] hover:underline opacity-0 group-hover:opacity-100 transition"
                    >
                      Смотреть Payload
                    </button>
                    {log.errorDetails && (
                      <div className="text-xs text-red-500 mt-1">{log.errorDetails}</div>
                    )}
                  </td>
                </tr>
              ))}

              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-[var(--text-muted)] font-medium">
                    Журнал пуст. Здесь будут отображаться логи срабатывания правил.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
