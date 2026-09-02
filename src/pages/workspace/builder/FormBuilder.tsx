import React, { useState, useEffect } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { 
  FileCheck2, 
  Plus, 
  Trash2, 
  QrCode, 
  Check, 
  Loader2, 
  X, 
  Copy, 
  ExternalLink, 
  Eye, 
  Layers, 
  Calendar, 
  UserCheck, 
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FancyQr, { QR_THEMES, QrThemePicker, downloadQr, type QrTheme } from '../../../components/forms/FancyQr';
import { auth } from '../../../lib/firebase';

export default function FormBuilder() {
  const { activeTenant } = useOutletContext<any>() || {};
  const { orgId } = useParams();
  const currentOrgId = activeTenant?.id || orgId || 'org_future_leaders';

  const [forms, setForms] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'forms' | 'submissions'>('forms');

  // Form Editor Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [qrTrackingEnabled, setQrTrackingEnabled] = useState(true);
  // Статистика по формам: сколько заявок пришло, в каких они статусах.
  const [stats, setStats] = useState<any | null>(null);
  const [qrTheme, setQrTheme] = useState<QrTheme>(QR_THEMES[0]);
  // Какая форма показывает свой QR (QR на саму форму, не на заявку).
  const [formQr, setFormQr] = useState<any | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const STATUS_LABEL: Record<string, string> = {
    new: 'Новые', review: 'На рассмотрении', testing: 'Тестирование',
    approved: 'Одобрено', rejected: 'Отклонено',
  };
  const STATUS_COLOR: Record<string, string> = {
    new: 'bg-blue-500', review: 'bg-amber-500', testing: 'bg-violet-500',
    approved: 'bg-emerald-500', rejected: 'bg-red-500',
  };

  /** Сводка по одной форме: сколько заявок и в каких они статусах. */
  const statsFor = (formId: string) => {
    const mine = submissions.filter((s: any) => s.formId === formId);
    const byStatus: Record<string, number> = {};
    for (const k of Object.keys(STATUS_LABEL)) byStatus[k] = mine.filter((s: any) => (s.status || 'new') === k).length;
    const ms = (t: any) => t?.toMillis?.() ?? (t?.seconds ? t.seconds * 1000 : 0);
    const week = Date.now() - 7 * 86400000;
    const closed = byStatus.approved + byStatus.rejected;
    return {
      total: mine.length,
      byStatus,
      pending: byStatus.new + byStatus.review,
      last7: mine.filter((s: any) => ms(s.createdAt) > week).length,
      conversion: closed ? Math.round((byStatus.approved / closed) * 100) : null,
    };
  };

  const formUrl = (id: string) => `${window.location.origin}/form/${id}`;
  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(c => (c === key ? null : c)), 2000);
  };
  const [fields, setFields] = useState<any[]>([
    { id: 'field_1', label: 'ФИО Заявителя', type: 'text', required: true, placeholder: 'Иванов Иван' },
    { id: 'field_2', label: 'Контактный Телефон / WhatsApp', type: 'text', required: true, placeholder: '+996 555 123456' },
    { id: 'field_3', label: 'Класс / Направление', type: 'select', required: true, options: ['7 класс', '8 класс', '9 класс', '10 класс', '11 класс'] }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // QR Modal View
  const [selectedSubmissionForQr, setSelectedSubmissionForQr] = useState<any | null>(null);

  // Subscribe to Forms & Submissions
  useEffect(() => {
    if (!currentOrgId) return;

    setLoading(true);
    const qForms = query(collection(db, 'custom_forms'), where('tenantId', '==', currentOrgId));
    const qSubs = query(collection(db, 'form_submissions'), where('tenantId', '==', currentOrgId));

    const unsubForms = onSnapshot(qForms, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setForms(list);
    });

    const unsubSubs = onSnapshot(qSubs, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setSubmissions(list);
      setLoading(false);
    });

    return () => {
      unsubForms();
      unsubSubs();
    };
  }, [currentOrgId]);

  const addField = () => {
    const newF = {
      id: `field_${Date.now()}`,
      label: 'Новое поле',
      type: 'text',
      required: false,
      placeholder: ''
    };
    setFields(prev => [...prev, newF]);
  };

  const updateField = (index: number, key: string, val: any) => {
    setFields(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [key]: val };
      return updated;
    });
  };

  const removeField = (index: number) => {
    setFields(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const fId = editingFormId || `form_${Date.now()}`;
      await setDoc(doc(db, 'custom_forms', fId), {
        tenantId: currentOrgId,
        title: formTitle.trim(),
        description: formDesc.trim(),
        fields,
        qrTrackingEnabled,
        active: true,
        updatedAt: serverTimestamp(),
        ...(!editingFormId && { createdAt: serverTimestamp() })
      }, { merge: true });

      setIsModalOpen(false);
    } catch (err: any) {
      alert(`Ошибка сохранения формы: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateSubmissionStatus = async (subId: string, newStatus: string) => {
    try {
      await setDoc(doc(db, 'form_submissions', subId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch(e: any) {
      alert(`Ошибка обследования: ${e.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-[var(--text-main)]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileCheck2 className="w-6 h-6 text-emerald-500" />
            <span>No-Code Конструктор Заявок & QR-Паспортов</span>
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Создание произвольных веб-форм для клиентов с автоматической выдачей QR-кода отслеживания статуса
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl p-1 text-xs">
            <button 
              onClick={() => setActiveTab('forms')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${activeTab === 'forms' ? 'bg-[var(--bg-surface)] text-emerald-500 shadow-xs' : 'text-[var(--text-muted)]'}`}
            >
              Формы ({forms.length})
            </button>
            <button 
              onClick={() => setActiveTab('submissions')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${activeTab === 'submissions' ? 'bg-[var(--bg-surface)] text-emerald-500 shadow-xs' : 'text-[var(--text-muted)]'}`}
            >
              Заявки & QR ({submissions.length})
            </button>
          </div>

          <button 
            onClick={() => {
              setEditingFormId(null);
              setFormTitle('');
              setFormDesc('');
              setIsModalOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" /> Создать Форму
          </button>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--text-muted)] text-xs gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
          <span>Загрузка конструктора...</span>
        </div>
      ) : activeTab === 'forms' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {forms.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-[var(--bg-surface)] border border-dashed border-[var(--border-color)] rounded-2xl">
              <FileCheck2 className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2 opacity-50" />
              <h3 className="font-bold text-sm">Нет созданных бланков</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
                Создайте свою первую форму заявки для абитуриентов или клиентов с автоматическим QR-трекером
              </p>
            </div>
          ) : (
            forms.map(form => (
              <div key={form.id} className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 rounded-2xl space-y-4 shadow-xs hover:border-emerald-500/40 transition">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-base text-[var(--text-main)]">{form.title}</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{form.description || 'Произвольная форма приема данных'}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-mono font-bold flex items-center gap-1">
                    <QrCode className="w-3 h-3" /> QR Активен
                  </span>
                </div>

                <div className="space-y-1 bg-[var(--bg-panel)] p-3 rounded-xl border border-[var(--border-color)] text-xs">
                  <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase font-mono">Состав полей ({form.fields?.length || 0}):</div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(form.fields || []).map((f: any) => (
                      <span key={f.id} className="px-2 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded text-[11px]">
                        {f.label} ({f.type})
                      </span>
                    ))}
                  </div>
                </div>

                {/* Отслеживание по этой форме: сколько заявок пришло и где
                    они сейчас. Раньше в кабинете был только общий список всех
                    заявок — понять, какая форма работает, а какая нет, было
                    невозможно. */}
                {(() => {
                  const st = statsFor(form.id);
                  return (
                    <div className="bg-[var(--bg-panel)] p-3 rounded-xl border border-[var(--border-color)] space-y-2.5">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase font-mono">Заявки</span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {st.last7 > 0 && <span className="text-emerald-500 font-bold">+{st.last7} за неделю</span>}
                        </span>
                      </div>

                      <div className="flex items-end gap-3">
                        <span className="text-3xl font-bold text-[var(--text-main)] tabular-nums leading-none">{st.total}</span>
                        {st.pending > 0 && (
                          <span className="text-xs text-amber-500 font-bold pb-0.5">{st.pending} ждут ответа</span>
                        )}
                        {st.conversion !== null && (
                          <span className="text-xs text-[var(--text-muted)] pb-0.5 ml-auto">
                            одобрено {st.conversion}%
                          </span>
                        )}
                      </div>

                      {st.total > 0 && (
                        <>
                          <div className="flex h-2 rounded-full overflow-hidden bg-[var(--bg-surface)]">
                            {Object.keys(STATUS_LABEL).map(k => st.byStatus[k] > 0 && (
                              <div key={k} className={STATUS_COLOR[k]}
                                style={{ width: `${(st.byStatus[k] / st.total) * 100}%` }}
                                title={`${STATUS_LABEL[k]}: ${st.byStatus[k]}`} />
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                            {Object.keys(STATUS_LABEL).map(k => st.byStatus[k] > 0 && (
                              <span key={k} className="flex items-center gap-1.5 text-[var(--text-muted)]">
                                <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[k]}`} />
                                {STATUS_LABEL[k]}: <b className="text-[var(--text-main)]">{st.byStatus[k]}</b>
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                      {st.total === 0 && (
                        <p className="text-[11px] text-[var(--text-muted)]">
                          Заявок ещё нет. Поделитесь ссылкой или QR-кодом ниже.
                        </p>
                      )}
                    </div>
                  );
                })()}

                <div className="flex items-center justify-between pt-2 text-xs border-t border-[var(--border-color)]">
                  <div className="flex items-center gap-3">
                    <a href={`/form/${form.id}`} target="_blank" rel="noreferrer"
                      className="text-[var(--text-muted)] hover:text-emerald-500 font-bold flex items-center gap-1.5 transition">
                      <ExternalLink className="w-3.5 h-3.5" /> Открыть
                    </a>
                    <button onClick={() => copy(formUrl(form.id), form.id)}
                      className="text-emerald-500 hover:text-emerald-400 font-bold flex items-center gap-1.5 transition cursor-pointer">
                      <Copy className="w-3.5 h-3.5" /> {copied === form.id ? 'Скопировано' : 'Ссылка'}
                    </button>
                    <button onClick={() => setFormQr(form)}
                      className="text-emerald-500 hover:text-emerald-400 font-bold flex items-center gap-1.5 transition cursor-pointer">
                      <QrCode className="w-3.5 h-3.5" /> QR
                    </button>
                  </div>
                  <button 
                    onClick={async () => {
                      if (window.confirm('Удалить форму?')) await deleteDoc(doc(db, 'custom_forms', form.id));
                    }}
                    className="text-red-500 hover:text-red-400 p-1 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Submissions List */
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-xs">
          {submissions.length === 0 ? (
            <div className="p-12 text-center text-[var(--text-muted)] text-xs">
              Заявок пока нет. Поделитесь ссылкой на форму с клиентами!
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-panel)] border-b border-[var(--border-color)] text-[var(--text-muted)] font-mono uppercase text-[11px]">
                <tr>
                  <th className="px-5 py-3 font-medium">Заявитель / ФИО</th>
                  <th className="px-5 py-3 font-medium">Форма</th>
                  <th className="px-5 py-3 font-medium">Статус QR-Паспорта</th>
                  <th className="px-5 py-3 font-medium">Дата подачи</th>
                  <th className="px-5 py-3 font-medium text-right">QR Паспорт</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {submissions.map(sub => (
                  <tr key={sub.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-[var(--text-main)]">{sub.applicantName || 'Неизвестный'}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{sub.applicantPhone || sub.applicantEmail || 'Без контакта'}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-emerald-500 font-bold">{sub.formTitle || 'Форма'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <select 
                        value={sub.status || 'new'}
                        onChange={(e) => updateSubmissionStatus(sub.id, e.target.value)}
                        className="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-2.5 py-1 text-[11px] font-bold font-mono text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
                      >
                        <option value="new">🆕 Новый</option>
                        <option value="review">🔍 На проверке</option>
                        <option value="testing">📐 Экзамен / Тест</option>
                        <option value="approved">✅ Зачислен / Принят</option>
                        <option value="rejected">❌ Отклонен</option>
                      </select>
                    </td>
                    <td className="px-5 py-3.5 text-[11px] font-mono text-[var(--text-muted)]">
                      {sub.createdAt ? new Date(sub.createdAt.seconds ? sub.createdAt.seconds * 1000 : sub.createdAt).toLocaleDateString() : 'Сегодня'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button 
                        onClick={() => setSelectedSubmissionForQr(sub)}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 px-3 py-1 rounded-lg font-bold text-[11px] inline-flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" /> Показать QR
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal: Form Builder */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-emerald-500" />
                <span>Конструктор Нового Бланка Заявки</span>
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-black/10 rounded-xl text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[var(--text-muted)] mb-1">Название формы *</label>
                <input 
                  type="text" 
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Например: Заявка на поступление 2026"
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)]"
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--text-muted)] mb-1">Описание формы</label>
                <input 
                  type="text" 
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Введите пояснение для заявителя..."
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)]"
                />
              </div>

              {/* Dynamic Fields List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-[var(--text-muted)] uppercase font-mono text-[11px]">Поля формы:</label>
                  <button type="button" onClick={addField} className="text-emerald-500 font-bold flex items-center gap-1 hover:underline">
                    <Plus className="w-3.5 h-3.5" /> Добавить поле
                  </button>
                </div>

                {fields.map((field, idx) => (
                  <div key={field.id} className="p-3 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl flex items-center gap-3">
                    <input 
                      type="text" 
                      value={field.label}
                      onChange={(e) => updateField(idx, 'label', e.target.value)}
                      placeholder="Название поля"
                      className="flex-1 px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg text-xs"
                    />
                    <select 
                      value={field.type}
                      onChange={(e) => updateField(idx, 'type', e.target.value)}
                      className="px-2.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg text-xs"
                    >
                      <option value="text">Текст</option>
                      <option value="select">Выбор из списка</option>
                      <option value="file">Загрузка файла</option>
                      <option value="date">Дата</option>
                    </select>
                    <button type="button" onClick={() => removeField(idx)} className="text-red-500 p-1 hover:bg-red-500/10 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl border border-[var(--border-color)] font-bold">Отмена</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-2">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Сохранить форму</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR на саму форму — его печатают и вешают на стенд, чтобы люди
          сканировали и заполняли заявку с телефона. */}
      {formQr && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setFormQr(null)}>
          <div onClick={e => e.stopPropagation()}
            className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl max-w-sm w-full p-6 space-y-4 text-center shadow-2xl relative">
            <button onClick={() => setFormQr(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full font-bold">
                QR на форму
              </span>
              <h3 className="text-lg font-bold text-[var(--text-main)] pt-2">{formQr.title}</h3>
              <p className="text-xs text-[var(--text-muted)]">Отсканируйте — откроется форма заявки</p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <FancyQr value={formUrl(formQr.id)} theme={qrTheme} size={230} />
              <QrThemePicker value={qrTheme.key} onChange={setQrTheme} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => downloadQr(formUrl(formQr.id), qrTheme, `QR-${formQr.title}.png`)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-xl transition">
                Скачать
              </button>
              <button onClick={() => copy(formUrl(formQr.id), 'modal')}
                className="border border-[var(--border-color)] text-[var(--text-main)] font-bold text-xs py-2.5 rounded-xl hover:bg-[var(--bg-panel)] transition">
                {copied === 'modal' ? 'Скопировано' : 'Копировать ссылку'}
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] font-mono break-all">{formUrl(formQr.id)}</p>
          </div>
        </div>
      )}

      {/* Modal: View QR Pass */}
      {selectedSubmissionForQr && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl max-w-sm w-full p-6 space-y-5 text-center shadow-2xl relative">
            <button onClick={() => setSelectedSubmissionForQr(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full font-bold">
                QR-Паспорт Заявки
              </span>
              <h3 className="text-lg font-bold text-[var(--text-main)] pt-1">{selectedSubmissionForQr.applicantName}</h3>
              <p className="text-xs text-[var(--text-muted)] font-mono">ID: {selectedSubmissionForQr.qrToken || selectedSubmissionForQr.id}</p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <FancyQr
                value={`${window.location.origin}/track/${selectedSubmissionForQr.qrToken || selectedSubmissionForQr.id}`}
                theme={qrTheme} size={220} />
              <QrThemePicker value={qrTheme.key} onChange={setQrTheme} />
              <button
                onClick={() => downloadQr(
                  `${window.location.origin}/track/${selectedSubmissionForQr.qrToken || selectedSubmissionForQr.id}`,
                  qrTheme,
                  `Заявка-${selectedSubmissionForQr.qrToken || selectedSubmissionForQr.id}.png`)}
                className="text-xs font-bold text-emerald-500 hover:text-emerald-400">
                Скачать картинкой
              </button>
            </div>

            <div className="bg-[var(--bg-panel)] p-3 rounded-xl border border-[var(--border-color)] text-xs space-y-1">
              <div className="text-[11px] text-[var(--text-muted)] font-mono">Текущий статус:</div>
              <div className="font-bold text-emerald-400 uppercase font-mono">{selectedSubmissionForQr.status || 'В обработке'}</div>
            </div>

            <a 
              href={`/track/${selectedSubmissionForQr.qrToken || selectedSubmissionForQr.id}`}
              target="_blank"
              rel="noreferrer"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 transition"
            >
              <ExternalLink className="w-4 h-4" /> Страница Публичного Трекера
            </a>
          </div>
        </div>
      )}

    </div>
  );
}
