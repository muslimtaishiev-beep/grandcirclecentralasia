import React, { useState, useEffect } from 'react';
import { useTenant } from '../../../context/TenantContext';
import { DocumentTemplateService } from '../../../services/tenant/DocumentTemplateService';
import { DocumentTemplate } from '../../../types/engine';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';

export default function DocumentTemplates() {
  const { tenant } = useTenant();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<DocumentTemplate>>({});

  useEffect(() => {
    loadTemplates();
  }, [tenant]);

  const loadTemplates = async () => {
    if (!tenant) return;
    setLoading(true);
    const data = await DocumentTemplateService.getTemplates(tenant.id);
    setTemplates(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!tenant) return;
    if (!editingTemplate.name || !editingTemplate.htmlContent) {
      toast.error('Заполните название и HTML-шаблон');
      return;
    }
    
    try {
      const templateToSave = {
        ...editingTemplate,
        tenantId: editingTemplate.tenantId || tenant.id, // Support 'GLOBAL' if admin set it, otherwise use tenant
        layout: editingTemplate.layout || 'A4-portrait',
        variables: editingTemplate.variables || [],
      } as DocumentTemplate;

      await DocumentTemplateService.saveTemplate(templateToSave);
      toast.success('Шаблон сохранен!');
      setIsEditing(false);
      loadTemplates();
    } catch (e) {
      toast.error('Ошибка сохранения');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Удалить шаблон?')) {
      await DocumentTemplateService.deleteTemplate(id);
      toast.success('Шаблон удален');
      loadTemplates();
    }
  };

  const addVariable = () => {
    setEditingTemplate(prev => ({
      ...prev,
      variables: [...(prev.variables || []), { key: '', label: '', type: 'text' }]
    }));
  };

  const updateVariable = (index: number, field: keyof DocumentTemplate['variables'][0], value: string) => {
    const newVars = [...(editingTemplate.variables || [])];
    newVars[index] = { ...newVars[index], [field]: value } as any;
    setEditingTemplate({ ...editingTemplate, variables: newVars });
  };

  const removeVariable = (index: number) => {
    const newVars = [...(editingTemplate.variables || [])];
    newVars.splice(index, 1);
    setEditingTemplate({ ...editingTemplate, variables: newVars });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Шаблоны документов</h1>
          <p className="text-slate-500 text-sm mt-1">Создавайте шаблоны для справок, договоров и сертификатов</p>
        </div>
        {!isEditing && (
          <button 
            onClick={() => { setEditingTemplate({}); setIsEditing(true); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Создать шаблон
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Название шаблона</label>
              <input 
                type="text"
                className="w-full border-slate-300 rounded-md shadow-sm p-2 border"
                value={editingTemplate.name || ''}
                onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})}
                placeholder="Справка с места учебы..."
              />
            </div>
            <div className="w-48">
              <label className="block text-sm font-medium text-slate-700 mb-1">Формат</label>
              <select 
                className="w-full border-slate-300 rounded-md shadow-sm p-2 border"
                value={editingTemplate.layout || 'A4-portrait'}
                onChange={e => setEditingTemplate({...editingTemplate, layout: e.target.value as any})}
              >
                <option value="A4-portrait">A4 Вертикальный</option>
                <option value="A4-landscape">A4 Горизонтальный</option>
              </select>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-end mb-2">
              <label className="block text-sm font-medium text-slate-700">Переменные (используйте в HTML как {'{{'}ключ{'}}'})</label>
              <button onClick={addVariable} className="text-sm text-blue-600 font-medium">+ Добавить переменную</button>
            </div>
            
            {editingTemplate.variables?.map((v, i) => (
              <div key={i} className="flex gap-3 mb-2 items-center bg-slate-50 p-2 rounded border border-slate-100">
                <input 
                  type="text" placeholder="Ключ (напр. studentName)" className="flex-1 border p-1.5 rounded text-sm font-mono"
                  value={v.key} onChange={e => updateVariable(i, 'key', e.target.value)}
                />
                <input 
                  type="text" placeholder="Метка (напр. ФИО Ученика)" className="flex-1 border p-1.5 rounded text-sm"
                  value={v.label} onChange={e => updateVariable(i, 'label', e.target.value)}
                />
                <select 
                  className="w-32 border p-1.5 rounded text-sm"
                  value={v.type} onChange={e => updateVariable(i, 'type', e.target.value)}
                >
                  <option value="text">Текст</option>
                  <option value="date">Дата</option>
                  <option value="number">Число</option>
                </select>
                <button onClick={() => removeVariable(i)} className="text-red-500 px-2">×</button>
              </div>
            ))}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">HTML Код (можно использовать Tailwind/inline-стили)</label>
            <textarea 
              className="w-full border border-slate-300 rounded-md shadow-sm p-4 font-mono text-sm h-64 bg-slate-900 text-green-400"
              value={editingTemplate.htmlContent || ''}
              onChange={e => setEditingTemplate({...editingTemplate, htmlContent: e.target.value})}
              placeholder="<div class='text-center'><h1>Справка</h1><p>Выдана {{studentName}}</p></div>"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button 
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Отмена
            </button>
            <button 
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Сохранить шаблон
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Загрузка...</div>
          ) : templates.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Нет ни одного шаблона. Создайте первый!</div>
          ) : (
            templates.map(t => (
              <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <h3 className="font-medium text-slate-900 flex items-center gap-2">
                    {t.name}
                    {t.tenantId === 'GLOBAL' && <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold">ГЛОБАЛЬНЫЙ</span>}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Переменных: {t.variables?.length || 0} • Формат: {t.layout === 'A4-portrait' ? 'A4 Верт.' : 'A4 Гориз.'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setEditingTemplate(t); setIsEditing(true); }}
                    className="p-2 text-slate-400 hover:text-blue-600"
                  >
                    Редактировать
                  </button>
                  <button 
                    onClick={() => handleDelete(t.id)}
                    className="p-2 text-slate-400 hover:text-red-600"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
