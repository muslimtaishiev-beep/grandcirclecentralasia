import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Zap, Plus, Settings2, Activity, Play, ActivitySquare } from 'lucide-react';
import { useAutomations } from '../../../hooks/useAutomations';
import AutomationRuleBuilderModal from './components/AutomationRuleBuilderModal';

export default function AutomationsDirectoryPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { rules, toggleRule } = useAutomations(activeTenant?.id);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-[var(--bg-app)]">
      <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-panel)] shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-main)] flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500" />
            Автоматизации
          </h1>
          <p className="text-[var(--text-muted)] mt-1 font-medium text-sm">Управление триггерами и реакциями воркспейса</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(`/${activeTenant?.id}/automations/logs`)}
            className="px-4 py-2 border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] font-bold rounded-xl hover:bg-slate-50 transition flex items-center gap-2"
          >
            <ActivitySquare className="w-4 h-4" /> Журнал выполнений
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-[var(--accent)] text-white font-bold rounded-xl shadow-md hover:brightness-110 transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Создать правило
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rules.map(rule => (
            <div key={rule.id} className="bg-[var(--bg-panel)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm hover:shadow-md transition flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-[var(--text-main)] line-clamp-2 pr-4">{rule.name}</h3>
                
                {/* Toggle Switch */}
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={rule.isActive}
                    onChange={(e) => toggleRule(rule.id, e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-[var(--accent)]"></div>
                </label>
              </div>

              <div className="space-y-3 mb-6 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 rounded bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Zap className="w-3 h-3" />
                  </div>
                  <span className="font-medium text-[var(--text-muted)] truncate">{rule.triggerType}</span>
                </div>
                <div className="w-px h-3 bg-[var(--border-color)] ml-3"></div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Play className="w-3 h-3" />
                  </div>
                  <span className="font-bold text-[var(--text-main)] truncate">{rule.actions[0]?.type}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--border-color)] flex justify-between items-center text-xs font-bold text-[var(--text-muted)]">
                <div className="flex items-center gap-1">
                  <Activity className="w-4 h-4" /> {rule.executionCount} выполнений
                </div>
                {rule.lastTriggeredAt ? (
                  <span>Был: {new Date(rule.lastTriggeredAt).toLocaleDateString()}</span>
                ) : (
                  <span>Никогда</span>
                )}
              </div>
            </div>
          ))}

          {rules.length === 0 && (
            <div className="col-span-full py-20 text-center flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-color)] rounded-2xl">
              <Zap className="w-12 h-12 text-[var(--text-muted)] opacity-30 mb-4" />
              <h3 className="text-lg font-bold text-[var(--text-main)] mb-1">Нет активных автоматизаций</h3>
              <p className="text-[var(--text-muted)] font-medium max-w-sm mb-6">Создайте первое правило, чтобы воркспейс сам отправлял уведомления и ставил задачи.</p>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="px-6 py-2 bg-[var(--accent)] text-white font-bold rounded-xl shadow-sm hover:brightness-110 transition"
              >
                Создать правило
              </button>
            </div>
          )}
        </div>
      </div>

      <AutomationRuleBuilderModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tenantId={activeTenant?.id}
      />
    </div>
  );
}
