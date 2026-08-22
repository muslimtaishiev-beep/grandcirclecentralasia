import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Zap, Plus, Trash2, CheckCircle, Power, Loader2, ArrowRight, Bell, CheckSquare, Sparkles } from 'lucide-react';
import { useAutomations, AutomationRule } from '../../../lib/useAutomations';

export default function AutomationsList() {
  const { activeTenant } = useOutletContext<any>() || {};
  const { rules, loading, addRule, toggleRule, deleteRule } = useAutomations(activeTenant?.id);

  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [ruleName, setRuleName] = useState('');
  const [triggerType, setTriggerType] = useState<AutomationRule['trigger']['type']>('NEW_CONTACT');
  const [targetStage, setTargetStage] = useState('Новая заявка');
  const [actionType, setActionType] = useState<AutomationRule['action']['type']>('CREATE_TASK');
  const [taskTitle, setTaskTitle] = useState('Связаться с новым лидом');
  const [notifTitle, setNotifTitle] = useState('Новый лид в CRM');
  const [notifBody, setNotifBody] = useState('Поступила новая заявка на обучение.');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName || !activeTenant?.id) return;

    await addRule({
      tenantId: activeTenant.id,
      name: ruleName,
      active: true,
      trigger: {
        type: triggerType,
        targetStage: triggerType === 'CRM_DEAL_STAGE_CHANGE' ? targetStage : undefined
      },
      action: {
        type: actionType,
        taskTitle: actionType === 'CREATE_TASK' ? taskTitle : undefined,
        notificationTitle: actionType === 'SEND_NOTIFICATION' ? notifTitle : undefined,
        notificationBody: actionType === 'SEND_NOTIFICATION' ? notifBody : undefined
      }
    });

    setRuleName('');
    setIsCreating(false);
  };

  const loadPreset = (presetName: string) => {
    if (presetName === 'new_lead_task') {
      setRuleName('Авто-задача при новом лиде с сайта');
      setTriggerType('NEW_CONTACT');
      setActionType('CREATE_TASK');
      setTaskTitle('Перезвонить по заявке с сайта в течение 15 минут');
    } else if (presetName === 'stage_notif') {
      setRuleName('Уведомление при смене этапа на Оплачено');
      setTriggerType('CRM_DEAL_STAGE_CHANGE');
      setTargetStage('Оплачено');
      setActionType('SEND_NOTIFICATION');
      setNotifTitle('🎉 Сделка оплачена!');
      setNotifBody('Клиент перешел на этап Оплачено. Начните подготовку документов.');
    }
    setIsCreating(true);
  };

  return (
    <div className="flex flex-col h-full space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)] flex items-center gap-2">
            <Zap className="w-6 h-6 text-[var(--accent)]" />
            Автоматизация и Роботы
          </h1>
          <p className="text-[var(--text-muted)] mt-1">Автоматические правила "Если Произошло X → Сделать Y" для {activeTenant?.name}</p>
        </div>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="bg-[var(--accent)] text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:opacity-90 transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> Создать робота
        </button>
      </div>

      {/* Preset Templates Banner */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[var(--accent)]/10 text-[var(--accent)] rounded-lg">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-[var(--text-main)]">Быстрый старт: Шаблоны автоматизаций</div>
            <div className="text-xs text-[var(--text-muted)]">Создайте популярное правило в 1 клик</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => loadPreset('new_lead_task')}
            className="px-3 py-1.5 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg text-xs font-bold text-[var(--text-main)] hover:border-[var(--accent)] transition"
          >
            + Задача на лид
          </button>
          <button 
            onClick={() => loadPreset('stage_notif')}
            className="px-3 py-1.5 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg text-xs font-bold text-[var(--text-main)] hover:border-[var(--accent)] transition"
          >
            + Уведомление об оплате
          </button>
        </div>
      </div>

      {/* Creation Modal / Inline Form */}
      {isCreating && (
        <form onSubmit={handleCreate} className="bg-[var(--bg-surface)] border border-[var(--accent)]/50 rounded-xl p-6 shadow-md space-y-4">
          <h2 className="text-base font-bold text-[var(--text-main)]">Настройка нового правила</h2>

          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Название правила</label>
            <input 
              type="text" 
              required
              placeholder="Например: Создать задачу при новом лиде"
              value={ruleName}
              onChange={e => setRuleName(e.target.value)}
              className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Trigger Setup */}
            <div className="bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg p-4 space-y-3">
              <div className="text-xs font-bold uppercase text-[var(--accent)] tracking-wider">1. ТРИГГЕР (ЕСЛИ)</div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Событие</label>
                <select 
                  value={triggerType}
                  onChange={e => setTriggerType(e.target.value as any)}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] font-medium"
                >
                  <option value="NEW_CONTACT">Появился новый контакт / лид</option>
                  <option value="CRM_DEAL_STAGE_CHANGE">Сделка перешла на этап</option>
                  <option value="NEW_TASK">Создана новая задача</option>
                </select>
              </div>

              {triggerType === 'CRM_DEAL_STAGE_CHANGE' && (
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Название этапа сделки</label>
                  <input 
                    type="text" 
                    value={targetStage}
                    onChange={e => setTargetStage(e.target.value)}
                    className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)]"
                  />
                </div>
              )}
            </div>

            {/* Action Setup */}
            <div className="bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg p-4 space-y-3">
              <div className="text-xs font-bold uppercase text-emerald-500 tracking-wider">2. ДЕЙСТВИЕ (ТО)</div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Выполнить действие</label>
                <select 
                  value={actionType}
                  onChange={e => setActionType(e.target.value as any)}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] font-medium"
                >
                  <option value="CREATE_TASK">Автоматически создать Задачу</option>
                  <option value="SEND_NOTIFICATION">Отправить Пуш-уведомление</option>
                </select>
              </div>

              {actionType === 'CREATE_TASK' && (
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Заголовок создаваемой задачи</label>
                  <input 
                    type="text" 
                    value={taskTitle}
                    onChange={e => setTaskTitle(e.target.value)}
                    className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)]"
                  />
                </div>
              )}

              {actionType === 'SEND_NOTIFICATION' && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Заголовок уведомления</label>
                    <input 
                      type="text" 
                      value={notifTitle}
                      onChange={e => setNotifTitle(e.target.value)}
                      className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Текст уведомления</label>
                    <input 
                      type="text" 
                      value={notifBody}
                      onChange={e => setNotifBody(e.target.value)}
                      className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button 
              type="button" 
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)]"
            >
              Отмена
            </button>
            <button 
              type="submit" 
              className="px-6 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-lg hover:opacity-90 transition"
            >
              Сохранить робота
            </button>
          </div>
        </form>
      )}

      {/* Rules List */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-16 bg-[var(--bg-surface)] border border-[var(--border-color)] border-dashed rounded-xl">
            <Zap className="w-10 h-10 mx-auto text-[var(--text-muted)] mb-2 opacity-40" />
            <h3 className="text-[var(--text-main)] font-semibold mb-1">Нет активных роботов</h3>
            <p className="text-[var(--text-muted)] text-sm mb-4">Создайте первое правило для автоматизации процессов</p>
          </div>
        ) : (
          rules.map(rule => (
            <div 
              key={rule.id}
              className={`bg-[var(--bg-surface)] border rounded-xl p-4 flex items-center justify-between transition ${rule.active ? 'border-[var(--border-color)] shadow-sm' : 'border-[var(--border-color)] opacity-60'}`}
            >
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => toggleRule(rule.id, !rule.active)}
                  className={`p-2 rounded-lg transition ${rule.active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gray-500/10 text-gray-400'}`}
                >
                  <Power className="w-5 h-5" />
                </button>

                <div>
                  <div className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
                    {rule.name}
                    {!rule.active && <span className="text-[10px] bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded uppercase font-mono">Отключен</span>}
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)]">
                    <span className="font-semibold text-[var(--accent)]">
                      {rule.trigger.type === 'NEW_CONTACT' ? 'Новый Лид' : rule.trigger.type === 'CRM_DEAL_STAGE_CHANGE' ? `Этап: ${rule.trigger.targetStage || 'Любой'}` : 'Новая задача'}
                    </span>
                    <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                    <span className="font-semibold text-emerald-500 flex items-center gap-1">
                      {rule.action.type === 'CREATE_TASK' ? <><CheckSquare className="w-3 h-3" /> Задача "{rule.action.taskTitle}"</> : <><Bell className="w-3 h-3" /> Пуш: "{rule.action.notificationTitle}"</>}
                    </span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => deleteRule(rule.id)}
                className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
