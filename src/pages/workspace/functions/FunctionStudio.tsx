import React, { useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { 
  CustomBusinessFunction, 
  FormFieldDefinition, 
  WorkflowAction 
} from '../../../types/engine';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { 
  FileCheck2, Check, Loader2, Save, Plus, Trash2, ArrowUp, ArrowDown, 
  Settings2, Shield, PlayCircle, Eye
} from 'lucide-react';
import DynamicFormRunner from '../../../components/engine/DynamicFormRunner';

export default function FunctionStudio() {
  const { activeTenant } = useOutletContext<any>() || {};
  const { orgId } = useParams();
  const currentOrgId = activeTenant?.id || orgId || '';

  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'form' | 'pipeline' | 'access' | 'preview'>('form');

  const [funcConfig, setFuncConfig] = useState<CustomBusinessFunction>({
    id: `func_${Date.now()}`,
    tenantId: currentOrgId,
    name: 'Новая бизнес-функция',
    slug: `func-${Date.now()}`,
    targetAudience: 'internal_staff',
    icon: 'FileCheck2',
    description: 'Описание функции...',
    formFields: [],
    pipeline: { trigger: 'on_form_submit', actions: [] },
    accessControl: { allowedDepartments: [], allowedRoles: [], requiresApproval: false }
  });

  // =====================
  // TAB 1: FORM BUILDER
  // =====================
  const addField = (type: FormFieldDefinition['type']) => {
    const newField: FormFieldDefinition = {
      id: `field_${Date.now()}`,
      label: `Новое поле (${type})`,
      type,
      required: false,
      options: type === 'select' ? ['Опция 1', 'Опция 2'] : undefined
    };
    setFuncConfig(prev => ({ ...prev, formFields: [...prev.formFields, newField] }));
  };

  const updateField = (id: string, updates: Partial<FormFieldDefinition>) => {
    setFuncConfig(prev => ({
      ...prev,
      formFields: prev.formFields.map(f => f.id === id ? { ...f, ...updates } : f)
    }));
  };

  const removeField = (id: string) => {
    setFuncConfig(prev => ({ ...prev, formFields: prev.formFields.filter(f => f.id !== id) }));
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === funcConfig.formFields.length - 1)) return;
    const newFields = [...funcConfig.formFields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    setFuncConfig(prev => ({ ...prev, formFields: newFields }));
  };

  // =====================
  // TAB 2: PIPELINE BUILDER
  // =====================
  const addAction = (type: WorkflowAction['type']) => {
    let newAction: WorkflowAction;
    switch (type) {
      case 'GENERATE_PDF':
        newAction = { type, templateHtml: '<h1>Документ</h1>', outputFileName: 'Документ.pdf', attachQrTracker: true };
        break;
      case 'SEND_EMAIL':
        newAction = { type, templateId: 'default', toField: 'email', fromAlias: 'info@company.com', subject: 'Уведомление' };
        break;
      case 'SEND_TELEGRAM_NOTIFICATION':
        newAction = { type, chatTarget: 'staff_group', textTemplate: 'Новая заявка!' };
        break;
      case 'GENERATE_INVOICE_QR':
        newAction = { type, amountField: 'amount', gateway: 'kaspi' };
        break;
      case 'CREATE_CRM_LEAD':
        newAction = { type, pipelineId: 'default', initialStage: 'new' };
        break;
      default:
        newAction = { type: 'MUTATE_DATABASE_RECORD', targetCollection: 'custom_records', operation: 'create' };
    }
    setFuncConfig(prev => ({ ...prev, pipeline: { ...prev.pipeline, actions: [...prev.pipeline.actions, newAction] } }));
  };

  const removeAction = (index: number) => {
    setFuncConfig(prev => ({
      ...prev,
      pipeline: { ...prev.pipeline, actions: prev.pipeline.actions.filter((_, i) => i !== index) }
    }));
  };

  // =====================
  // SAVE CONFIG
  // =====================
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'custom_business_functions', funcConfig.id), {
        ...funcConfig,
        updatedAt: serverTimestamp()
      });
      alert('Функция успешно сохранена и готова к запуску!');
    } catch (error: any) {
      alert(`Ошибка сохранения: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-[var(--text-main)] pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-emerald-500" />
            <span>Конструктор функций</span>
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Свои формы, проверки и последовательности действий — без программирования
          </p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Опубликовать Функцию</span>
        </button>
      </div>

      {/* Main Settings */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Название функции</label>
          <input 
            type="text" 
            value={funcConfig.name}
            onChange={e => setFuncConfig({ ...funcConfig, name: e.target.value })}
            className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Краткое описание (подсказка)</label>
          <input 
            type="text" 
            value={funcConfig.description}
            onChange={e => setFuncConfig({ ...funcConfig, description: e.target.value })}
            className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-[var(--bg-surface)] border border-[var(--border-color)] p-1 rounded-xl">
        {[
          { id: 'form', label: '1. Поля Ввода', icon: FileCheck2 },
          { id: 'pipeline', label: '2. Пайплайн и Действия', icon: PlayCircle },
          { id: 'access', label: '3. Права Доступа', icon: Shield },
          { id: 'preview', label: '▶ Тест (Runner)', icon: Eye }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
              activeTab === tab.id ? 'bg-[var(--bg-panel)] shadow-sm text-emerald-500 border border-[var(--border-color)]' : 'text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB CONTENT: FORM BUILDER */}
      {activeTab === 'form' && (
        <div className="space-y-4">
          <div className="flex gap-2 mb-4">
            {['text', 'number', 'date', 'select', 'file'].map(t => (
              <button 
                key={t}
                onClick={() => addField(t as any)}
                className="bg-[var(--bg-panel)] border border-[var(--border-color)] hover:border-emerald-500 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase flex items-center gap-1 transition"
              >
                <Plus className="w-3 h-3" /> {t}
              </button>
            ))}
          </div>

          {funcConfig.formFields.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--text-muted)] border-2 border-dashed border-[var(--border-color)] rounded-2xl">
              Добавьте поля ввода для вашей функции
            </div>
          ) : (
            <div className="space-y-3">
              {funcConfig.formFields.map((field, index) => (
                <div key={field.id} className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-xl flex gap-4 items-start">
                  <div className="flex flex-col gap-1 mt-1">
                    <button onClick={() => moveField(index, 'up')} className="text-slate-400 hover:text-emerald-500"><ArrowUp className="w-4 h-4" /></button>
                    <button onClick={() => moveField(index, 'down')} className="text-slate-400 hover:text-emerald-500"><ArrowDown className="w-4 h-4" /></button>
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Заголовок поля</label>
                      <input 
                        type="text" value={field.label} onChange={e => updateField(field.id, { label: e.target.value })}
                        className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Уникальный ID (переменная)</label>
                      <input 
                        type="text" value={field.id} onChange={e => updateField(field.id, { id: e.target.value })}
                        className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-sm font-mono text-emerald-500"
                      />
                    </div>
                    {field.type === 'select' && (
                      <div className="md:col-span-2">
                        <label className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Опции (через запятую)</label>
                        <input 
                          type="text" value={field.options?.join(', ') || ''} onChange={e => updateField(field.id, { options: e.target.value.split(',').map(s => s.trim()) })}
                          className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-sm"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-[10px] font-mono font-bold bg-slate-500/10 px-2 py-0.5 rounded text-slate-400">{field.type}</span>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-main)] cursor-pointer mt-1">
                      <input type="checkbox" checked={field.required} onChange={e => updateField(field.id, { required: e.target.checked })} className="rounded text-emerald-500" />
                      Обязательное
                    </label>
                    <button onClick={() => removeField(field.id)} className="text-red-400 hover:text-red-500 p-1 mt-auto">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: PIPELINE BUILDER */}
      {activeTab === 'pipeline' && (
        <div className="space-y-6">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 rounded-2xl">
            <label className="block text-xs font-bold text-[var(--text-muted)] mb-2">Триггер запуска функции</label>
            <select 
              value={funcConfig.pipeline.trigger}
              onChange={e => setFuncConfig(prev => ({ ...prev, pipeline: { ...prev.pipeline, trigger: e.target.value as any } }))}
              className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="on_form_submit">После заполнения формы (on_form_submit)</option>
              <option value="manual_button">Ручное нажатие кнопки сотрудником (manual_button)</option>
              <option value="on_payment_success">После успешной оплаты (on_payment_success)</option>
            </select>
          </div>

          <div>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><PlayCircle className="w-4 h-4 text-emerald-500" /> Цепочка действий</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={() => addAction('GENERATE_PDF')} className="bg-[var(--bg-panel)] border border-[var(--border-color)] hover:border-emerald-500 px-3 py-1.5 rounded-lg text-[11px] font-bold">+ Сгенерировать PDF</button>
              <button onClick={() => addAction('SEND_EMAIL')} className="bg-[var(--bg-panel)] border border-[var(--border-color)] hover:border-emerald-500 px-3 py-1.5 rounded-lg text-[11px] font-bold">+ Отправить Email</button>
              <button onClick={() => addAction('SEND_TELEGRAM_NOTIFICATION')} className="bg-[var(--bg-panel)] border border-[var(--border-color)] hover:border-emerald-500 px-3 py-1.5 rounded-lg text-[11px] font-bold">+ Пуш в Telegram</button>
              <button onClick={() => addAction('CREATE_CRM_LEAD')} className="bg-[var(--bg-panel)] border border-[var(--border-color)] hover:border-emerald-500 px-3 py-1.5 rounded-lg text-[11px] font-bold">+ Создать Лид (CRM)</button>
              <button onClick={() => addAction('GENERATE_INVOICE_QR')} className="bg-[var(--bg-panel)] border border-[var(--border-color)] hover:border-emerald-500 px-3 py-1.5 rounded-lg text-[11px] font-bold">+ Счет / QR-оплата</button>
            </div>

            <div className="space-y-3">
              {funcConfig.pipeline.actions.map((action, index) => (
                <div key={index} className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-xl flex flex-col gap-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-emerald-400 text-xs">Шаг {index + 1}: {action.type}</span>
                    <button onClick={() => removeAction(index)} className="text-red-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  
                  <div className="text-xs text-[var(--text-muted)] space-y-2">
                    {/* Render action specific inputs */}
                    {action.type === 'GENERATE_PDF' && (
                      <>
                        <label className="block text-[10px] uppercase font-bold text-[var(--text-main)]">HTML Шаблон (используйте переменные { '{{fieldId}}' })</label>
                        <textarea className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg p-2 font-mono h-20 text-[11px]" value={action.templateHtml} readOnly />
                        <label className="flex items-center gap-1.5 text-xs text-[var(--text-main)] mt-2">
                          <input type="checkbox" checked={action.attachQrTracker} readOnly className="rounded text-emerald-500" />
                          Встроить QR-Код валидации в PDF
                        </label>
                      </>
                    )}
                    {action.type === 'SEND_EMAIL' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] uppercase font-bold">Email Получателя (ID поля)</label>
                          <input type="text" value={action.toField} readOnly className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-2 py-1" />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold">Тема письма</label>
                          <input type="text" value={action.subject} readOnly className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-2 py-1" />
                        </div>
                      </div>
                    )}
                    {action.type === 'SEND_TELEGRAM_NOTIFICATION' && (
                      <div>
                        <label className="block text-[10px] uppercase font-bold">Текст уведомления (шаблон)</label>
                        <input type="text" value={action.textTemplate} readOnly className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-2 py-1" />
                      </div>
                    )}
                    {action.type === 'GENERATE_INVOICE_QR' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] uppercase font-bold">Шлюз Оплаты</label>
                          <input type="text" value={action.gateway} readOnly className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-2 py-1 font-mono" />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold">Поле с суммой (ID)</label>
                          <input type="text" value={action.amountField} readOnly className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-2 py-1 font-mono" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {funcConfig.pipeline.actions.length === 0 && (
                <div className="py-8 text-center text-sm text-[var(--text-muted)] border-2 border-dashed border-[var(--border-color)] rounded-xl">
                  Добавьте хотя бы одно действие в пайплайн
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ACCESS CONTROL */}
      {activeTab === 'access' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 rounded-2xl space-y-5">
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] mb-2">Аудитория (Кто может использовать)</label>
            <select 
              value={funcConfig.targetAudience}
              onChange={e => setFuncConfig(prev => ({ ...prev, targetAudience: e.target.value as any }))}
              className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="public_client">Публичный доступ (Клиенты, Абитуриенты)</option>
              <option value="internal_staff">Только сотрудники организации</option>
              <option value="hybrid">Гибридный (Оба варианта)</option>
            </select>
          </div>
          
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <h4 className="text-amber-500 font-bold text-sm mb-1">Кому доступен запуск</h4>
            <p className="text-xs text-amber-400/80">
              Право на запуск выдаётся сотруднику в разделе «Роли и доступы».
            </p>
          </div>
        </div>
      )}

      {/* TAB CONTENT: RUNNER PREVIEW */}
      {activeTab === 'preview' && (
        <div className="pt-4">
          <div className="mb-4 text-center">
            <h3 className="font-bold text-emerald-400">Предпросмотр запуска</h3>
            <p className="text-xs text-[var(--text-muted)]">Так ваша бизнес-функция будет выглядеть для конечного пользователя</p>
          </div>
          
          <DynamicFormRunner 
            functionConfig={funcConfig}
            tenantId={currentOrgId}
            currentUserId="preview_user_123"
            currentUserFullName="Иван (Превью)"
          />
        </div>
      )}

    </div>
  );
}
