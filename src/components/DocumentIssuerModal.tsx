import React, { useState, useEffect, useRef } from 'react';
import { DocumentTemplateService } from '../services/tenant/DocumentTemplateService';
import { DocumentTemplate } from '../types/engine';
import { DynamicDocumentPdf } from './DynamicDocumentPdf';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';

interface Props {
  tenantId: string;
  onClose: () => void;
}

export const DocumentIssuerModal: React.FC<Props> = ({ tenantId, onClose }) => {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const printRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: 'Документ',
    onAfterPrint: () => toast.success('Отправлено на печать'),
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await DocumentTemplateService.getTemplates(tenantId);
      setTemplates(data);
      setLoading(false);
    };
    load();
  }, [tenantId]);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const handleInputChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col font-sans" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
          <h3 className="text-2xl font-bold flex items-center gap-2">
            <span>🖨️</span> Выдача документов по шаблонам
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl w-8 h-8">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel: Form */}
          <div className="w-1/3 bg-slate-50 border-r border-slate-200 p-6 overflow-y-auto">
            <label className="block text-sm font-bold text-slate-700 mb-2">Выберите шаблон</label>
            <select 
              className="w-full border-slate-300 rounded-lg shadow-sm p-3 border mb-6"
              value={selectedTemplateId}
              onChange={e => setSelectedTemplateId(e.target.value)}
            >
              <option value="">-- Выберите --</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name} {t.tenantId === 'GLOBAL' ? '(Глобальный)' : ''}</option>
              ))}
            </select>

            {selectedTemplate && (
              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 mb-4 border-b pb-2">Данные для заполнения</h4>
                {selectedTemplate.variables?.map(v => (
                  <div key={v.key}>
                    <label className="block text-sm text-slate-700 mb-1">{v.label}</label>
                    <input 
                      type={v.type === 'date' ? 'date' : v.type === 'number' ? 'number' : 'text'}
                      className="w-full border-slate-300 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500"
                      value={formData[v.key] || ''}
                      onChange={e => handleInputChange(v.key, e.target.value)}
                    />
                  </div>
                ))}

                <button 
                  onClick={handlePrint}
                  className="w-full mt-6 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200"
                >
                  🖨️ Распечатать PDF
                </button>
              </div>
            )}
            
            {loading && <p className="text-slate-500 text-sm">Загрузка шаблонов...</p>}
          </div>

          {/* Right Panel: Preview */}
          <div className="w-2/3 bg-slate-200 p-6 overflow-y-auto flex justify-center items-start">
            {selectedTemplate ? (
              <div className="shadow-2xl ring-1 ring-black/5 rounded-sm overflow-hidden" ref={printRef}>
                <DynamicDocumentPdf template={selectedTemplate} data={formData} />
              </div>
            ) : (
              <div className="text-slate-400 mt-20 text-center">
                <div className="text-6xl mb-4">📄</div>
                <p>Выберите шаблон для предпросмотра</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
