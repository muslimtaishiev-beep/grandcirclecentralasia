import React, { useState } from 'react';
import { X, Zap, Filter, Play } from 'lucide-react';
import { AutomationTriggerType, AutomationActionType } from '../../../../types/automations';
import { db } from '../../../../lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
}

export default function AutomationRuleBuilderModal({ isOpen, onClose, tenantId }: Props) {
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>('on_deal_stage_changed');
  const [actionType, setActionType] = useState<AutomationActionType>('SEND_CHAT_NOTIFICATION');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setLoading(true);
      const ref = doc(collection(db, 'tenants', tenantId, 'automation_rules'));
      
      await setDoc(ref, {
        tenantId,
        name,
        isActive: true,
        triggerType,
        conditions: [], // Simplified for this prompt implementation
        actions: [
          { type: actionType, payload: {} }
        ],
        executionCount: 0,
        createdAt: Date.now()
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[var(--bg-panel)] rounded-2xl max-w-2xl w-full shadow-2xl border border-[var(--border-color)] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-[var(--border-color)]">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Создать правило автоматизации
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-bold text-[var(--text-muted)] mb-1">Название правила</label>
            <input 
              type="text" 
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Например: Уведомление в Телеграм при пропуске урока"
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="space-y-4">
            {/* Step 1: Trigger */}
            <div className="p-4 border border-[var(--border-color)] rounded-xl bg-slate-50 dark:bg-slate-800/50 relative">
              <div className="absolute -left-3 top-4 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs shadow-sm border border-indigo-200">1</div>
              <div className="ml-4">
                <label className="block text-sm font-bold text-[var(--text-main)] mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" /> КОГДА ПРОИСХОДИТ СОБЫТИЕ
                </label>
                <select 
                  value={triggerType}
                  onChange={e => setTriggerType(e.target.value as AutomationTriggerType)}
                  className="w-full bg-white dark:bg-slate-900 border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="on_deal_stage_changed">Сделка перешла на стадию</option>
                  <option value="on_attendance_marked_absent">Студент пропустил урок</option>
                  <option value="on_subscription_depleted">Закончились уроки в абонементе</option>
                  <option value="on_custom_function_submit">Заполнена кастомная форма</option>
                  <option value="on_task_overdue">Задача просрочена</option>
                </select>
              </div>
            </div>

            {/* Step 2: Filter/Condition (Mocked as disabled for simplicity) */}
            <div className="p-4 border border-[var(--border-color)] rounded-xl bg-slate-50 dark:bg-slate-800/50 relative">
              <div className="absolute -left-3 top-4 w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-black text-xs shadow-sm border border-slate-300">2</div>
              <div className="ml-4">
                <label className="block text-sm font-bold text-[var(--text-main)] mb-2 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-blue-500" /> И ВЫПОЛНЯЮТСЯ УСЛОВИЯ (Опционально)
                </label>
                <div className="p-3 border border-dashed border-[var(--border-color)] rounded-lg text-center text-sm text-[var(--text-muted)] font-medium bg-white/50 dark:bg-slate-900/50 cursor-pointer hover:border-[var(--accent)] transition">
                  + Добавить условие
                </div>
              </div>
            </div>

            {/* Step 3: Action */}
            <div className="p-4 border border-[var(--border-color)] rounded-xl bg-slate-50 dark:bg-slate-800/50 relative">
              <div className="absolute -left-3 top-4 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs shadow-sm border border-emerald-200">3</div>
              <div className="ml-4">
                <label className="block text-sm font-bold text-[var(--text-main)] mb-2 flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-500" /> ТО ВЫПОЛНИТЬ ДЕЙСТВИЕ
                </label>
                <select 
                  value={actionType}
                  onChange={e => setActionType(e.target.value as AutomationActionType)}
                  className="w-full bg-white dark:bg-slate-900 border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="SEND_CHAT_NOTIFICATION">Отправить сообщение в корпоративный чат</option>
                  <option value="SEND_TELEGRAM_ALERT">Отправить Push-уведомление в Telegram</option>
                  <option value="SEND_BRANDED_EMAIL">Отправить Email клиенту</option>
                  <option value="CREATE_CRM_TASK">Автоматически создать задачу менеджеру</option>
                  <option value="GENERATE_DYNAMIC_DOCUMENT">Сгенерировать PDF документ</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-4 flex gap-3 border-t border-[var(--border-color)]">
            <button 
              type="button" 
              onClick={onClose}
              className="px-6 py-3 bg-slate-100 dark:bg-slate-800 font-bold rounded-xl hover:bg-slate-200 transition"
            >
              Отмена
            </button>
            <div className="flex-1"></div>
            <button 
              type="submit" 
              disabled={loading}
              className="px-8 py-3 bg-[var(--accent)] text-white font-bold rounded-xl shadow-lg hover:brightness-110 transition disabled:opacity-50"
            >
              {loading ? 'Создание...' : 'Активировать правило'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
