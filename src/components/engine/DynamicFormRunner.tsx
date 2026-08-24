import React, { useState } from 'react';
import { 
  CustomBusinessFunction, 
  FormFieldDefinition 
} from '../../types/engine';
import { WorkflowExecutionService, ExecutionContext } from '../../lib/WorkflowExecutionService';
import { Loader2, FileCheck2, AlertCircle, QrCode, Download } from 'lucide-react';

interface DynamicFormRunnerProps {
  functionConfig: CustomBusinessFunction;
  currentUserId?: string;
  currentUserRole?: string;
  currentUserEmail?: string;
  currentUserFullName?: string;
  tenantId: string;
}

export default function DynamicFormRunner({ 
  functionConfig, 
  currentUserId = 'anonymous',
  currentUserRole = 'guest',
  currentUserEmail = '',
  currentUserFullName = 'Anonymous',
  tenantId 
}: DynamicFormRunnerProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; qrToken?: string; error?: string } | null>(null);

  const handleInputChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    const context: ExecutionContext = {
      tenantId,
      user: {
        userId: currentUserId,
        role: currentUserRole,
        email: currentUserEmail,
        fullName: currentUserFullName,
      },
      formValues: formData
    };

    try {
      const execResult = await WorkflowExecutionService.executeFunction(functionConfig, context);
      
      if (execResult.success) {
        // We look for QR Token generation context by extracting from PDF/QR actions if needed,
        // or we just show generic success. The service handles QR internally, but let's 
        // generate a deterministic QR token here if we want to show it.
        const generatedQrToken = `QR_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        
        // Let's re-run with explicit QR token if we want to display it immediately
        context.qrToken = generatedQrToken;
        await WorkflowExecutionService.executeFunction(functionConfig, context);
        
        setResult({ success: true, qrToken: generatedQrToken });
      } else {
        setResult({ success: false, error: execResult.errors?.join(', ') || 'Pipeline execution failed' });
      }
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (result?.success) {
    return (
      <div className="bg-[var(--bg-surface)] border border-emerald-500/30 p-8 rounded-3xl text-center space-y-6 shadow-xl max-w-lg mx-auto">
        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
          <FileCheck2 className="w-10 h-10 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Успешно Выполнено!</h2>
          <p className="text-sm text-[var(--text-muted)]">Бизнес-функция «{functionConfig.name}» отработала без ошибок. Все действия (PDF, Email, CRM) запущены.</p>
        </div>

        {result.qrToken && (
          <div className="bg-emerald-950/30 p-6 rounded-2xl border border-emerald-500/20 space-y-4">
            <QrCode className="w-12 h-12 text-emerald-400 mx-auto" />
            <div>
              <div className="text-[10px] uppercase font-mono font-bold text-emerald-500 mb-1">Официальный QR-Токен Валидации</div>
              <div className="font-mono text-lg font-bold text-white tracking-widest">{result.qrToken}</div>
            </div>
            <a 
              href={`/track/${result.qrToken}`} 
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition"
            >
              Отследить Статус
            </a>
          </div>
        )}
        
        <button 
          onClick={() => { setResult(null); setFormData({}); }}
          className="text-xs font-bold text-[var(--text-muted)] hover:text-white transition underline"
        >
          Запустить еще раз
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-6 shadow-lg max-w-2xl mx-auto">
      <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-4 mb-6">
        <div className="p-3 bg-[var(--bg-panel)] rounded-xl border border-[var(--border-color)]">
          <FileCheck2 className="w-6 h-6 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--text-main)]">{functionConfig.name}</h2>
          <p className="text-xs text-[var(--text-muted)]">{functionConfig.description}</p>
        </div>
      </div>

      {result?.error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm text-red-400">{result.error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {functionConfig.formFields.map((field) => (
          <div key={field.id} className="space-y-1.5">
            <label className="block text-xs font-bold text-[var(--text-main)]">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            
            {field.type === 'select' ? (
              <select
                required={field.required}
                value={formData[field.id] || ''}
                onChange={(e) => handleInputChange(field.id, e.target.value)}
                className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-main)] focus:outline-none focus:border-emerald-500 transition"
              >
                <option value="" disabled>Выберите опцию...</option>
                {field.options?.map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
            ) : field.type === 'date' ? (
              <input
                type="date"
                required={field.required}
                value={formData[field.id] || ''}
                onChange={(e) => handleInputChange(field.id, e.target.value)}
                className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-main)] focus:outline-none focus:border-emerald-500 transition"
              />
            ) : field.type === 'file' ? (
              <input
                type="file"
                required={field.required}
                onChange={(e) => handleInputChange(field.id, e.target.files?.[0])}
                className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-emerald-500 transition file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-500/10 file:text-emerald-500 hover:file:bg-emerald-500/20"
              />
            ) : field.type === 'number' ? (
              <input
                type="number"
                required={field.required}
                placeholder={field.placeholder}
                value={formData[field.id] || ''}
                onChange={(e) => handleInputChange(field.id, Number(e.target.value))}
                className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-main)] focus:outline-none focus:border-emerald-500 transition"
              />
            ) : (
              <input
                type="text"
                required={field.required}
                placeholder={field.placeholder}
                value={formData[field.id] || ''}
                onChange={(e) => handleInputChange(field.id, e.target.value)}
                className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-main)] focus:outline-none focus:border-emerald-500 transition"
              />
            )}
          </div>
        ))}

        <div className="pt-4 border-t border-[var(--border-color)]">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold text-sm transition shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Исполнение пайплайна...</span>
              </>
            ) : (
              <>
                <FileCheck2 className="w-5 h-5" />
                <span>Запустить Функцию</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
