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
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FancyQr, { QR_THEMES, QrThemePicker, downloadQr, type QrTheme } from '../../../components/forms/FancyQr';
import { STATUS_LABEL, STATUS_COLOR, MODE_STATUSES, type FormMode } from '../../../shared/formStatuses';
import { auth } from '../../../lib/firebase';

export default function FormBuilder() {
  const { activeTenant } = useOutletContext<any>() || {};
  const { orgId } = useParams();
  // Без организации не подписываемся ни на что: подставной тенант означал
  // бы показать чужие заявки.
  const currentOrgId = activeTenant?.id || orgId || '';

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
  // Режим формы: обычная заявка или билет на событие. От него зависят набор
  // статусов и появление QR-билета у гостя после одобрения.
  const [formMode, setFormMode] = useState<FormMode>('application');
  // Статистика по формам: сколько заявок пришло, в каких они статусах.
  const [stats, setStats] = useState<any | null>(null);
  const [qrTheme, setQrTheme] = useState<QrTheme>(QR_THEMES[0]);
  // Какая форма показывает свой QR (QR на саму форму, не на заявку).
  const [formQr, setFormQr] = useState<any | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // Просмотр приложенного документа (фото удостоверения из file-поля заявки).
  const [docView, setDocView] = useState<{ name: string; src: string } | null>(null);



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
    // Свежие заявки, не больше 300: в data заявки лежит фото документа
    // (base64 до 400КБ), и подписка без лимита тянула бы в браузер снимки
    // всех гостей события разом.
    const qSubs = query(
      collection(db, 'form_submissions'),
      where('tenantId', '==', currentOrgId),
      orderBy('createdAt', 'desc'),
      limit(300),
    );

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
        mode: formMode,
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

  /**
   * Статус меняется через сервер, а не напрямую в Firestore.
   *
   * Прямая запись выглядела так же, но молча ломала три вещи: не росла
   * история статусов (таймлайн у заявителя навсегда застывал на «Заявка
   * принята»), не писалось, КТО сменил статус, и обходилась серверная
   * проверка принадлежности заявки организации.
   */
  const updateSubmissionStatus = async (subId: string, newStatus: string) => {
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/forms/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId: currentOrgId, submissionId: subId, status: newStatus }),
      });
      const data = await res.json();
      if (!data.success) alert(data.error || 'Не удалось сменить статус');
      // onSnapshot сам подтянет обновление — локально ничего не трогаем.
    } catch(e: any) {
      alert(`Не удалось сменить статус: ${e.message}`);
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
              setFormMode('application');
              setQrTrackingEnabled(true);
              setFields([
                { id: `field_${Date.now()}`, label: 'Фамилия и имя', type: 'text', required: true, placeholder: '' },
              ]);
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
                    <button onClick={() => {
                        // Редактирование существующей формы: гидратируем модалку
                        // из карточки. Раньше этой кнопки не было вовсе, и
                        // изменить форму после создания было нельзя.
                        setEditingFormId(form.id);
                        setFormTitle(form.title || '');
                        setFormDesc(form.description || '');
                        setFields(Array.isArray(form.fields) && form.fields.length ? form.fields : []);
                        setFormMode(form.mode === 'ticket' ? 'ticket' : 'application');
                        setQrTrackingEnabled(form.qrTrackingEnabled !== false);
                        setIsModalOpen(true);
                      }}
                      className="text-[var(--text-muted)] hover:text-emerald-500 font-bold flex items-center gap-1.5 transition cursor-pointer">
                      ✎ Изменить
                    </button>
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
                        {/* Набор статусов зависит от режима формы: у билета
                            есть «Оплачено» и «Гость пришёл», у заявки — нет. */}
                        {MODE_STATUSES[(forms.find(f => f.id === sub.formId)?.mode === 'ticket' ? 'ticket' : 'application') as FormMode]
                          .map(st => (
                            <option key={st} value={st}>{STATUS_LABEL[st]}</option>
                          ))}
                      </select>
                    </td>
                    <td className="px-5 py-3.5 text-[11px] font-mono text-[var(--text-muted)]">
                      {sub.createdAt ? new Date(sub.createdAt.seconds ? sub.createdAt.seconds * 1000 : sub.createdAt).toLocaleDateString() : 'Сегодня'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {(() => {
                        // Первое файловое поле формы этой заявки — там лежит
                        // фото документа, если гость его прикладывал.
                        const ff = (forms.find(f => f.id === sub.formId)?.fields || []).find((x: any) => x.type === 'file');
                        const src = ff ? sub.data?.[ff.id] : null;
                        return src ? (
                          <button
                            onClick={() => setDocView({ name: sub.applicantName || 'Документ', src })}
                            className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-lg font-bold text-[11px] inline-flex items-center gap-1.5 transition cursor-pointer mr-2">
                            📄 Документ
                          </button>
                        ) : null;
                      })()}
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
                {/* Режим определяет судьбу заявки после одобрения: заявка
                    просто получает статус, билет — ещё и QR для входа. */}
                <div className="space-y-2 p-3 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl">
                  <label className="font-bold text-[var(--text-muted)] uppercase font-mono text-[11px]">Тип формы</label>
                  <div className="flex gap-2">
                    {([['application', 'Приём заявок'], ['ticket', 'Билеты на событие']] as const).map(([m, label]) => (
                      <button key={m} type="button" onClick={() => setFormMode(m)}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold border transition ${
                          formMode === m
                            ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500'
                            : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-emerald-500/30'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {formMode === 'ticket' && (
                    <p className="text-[11px] text-[var(--text-muted)] pt-1">
                      QR-билет появится у гостя на странице отслеживания, как только заявку
                      одобрят. На входе билеты проверяют сотрудники через «Проверку билетов»
                      в меню воркспейса: камера сканирует QR гостя, вход отмечается
                      автоматически, повторный вход блокируется. Волонтёров добавьте как
                      сотрудников организации.
                    </p>
                  )}
                  <label className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] cursor-pointer pt-1">
                    <input type="checkbox" checked={qrTrackingEnabled} onChange={(e) => setQrTrackingEnabled(e.target.checked)} />
                    Выдавать QR-код отслеживания после отправки
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <label className="font-bold text-[var(--text-muted)] uppercase font-mono text-[11px]">Поля формы:</label>
                  <button type="button" onClick={addField} className="text-emerald-500 font-bold flex items-center gap-1 hover:underline">
                    <Plus className="w-3.5 h-3.5" /> Добавить поле
                  </button>
                </div>

                {fields.map((field, idx) => (
                  <div key={field.id} className="p-3 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl space-y-2">
                    <div className="flex items-center gap-3">
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
                        <option value="textarea">Многострочный текст</option>
                        <option value="number">Число</option>
                        <option value="select">Выбор из списка</option>
                        <option value="checkbox">Галочка</option>
                        <option value="file">Загрузка файла (фото)</option>
                        <option value="date">Дата</option>
                      </select>
                      <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] shrink-0 cursor-pointer">
                        <input type="checkbox" checked={!!field.required}
                          onChange={(e) => updateField(idx, 'required', e.target.checked)} />
                        обяз.
                      </label>
                      <button type="button" onClick={() => removeField(idx)} className="text-red-500 p-1 hover:bg-red-500/10 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {field.type === 'select' && (
                      <input
                        type="text"
                        value={(field.options || []).join(', ')}
                        onChange={(e) => updateField(idx, 'options', e.target.value.split(',').map((o: string) => o.trim()).filter(Boolean))}
                        placeholder="Варианты через запятую: 9 класс, 10 класс, 11 класс"
                        className="w-full px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg text-[11px]"
                      />
                    )}
                    {field.type === 'file' && (
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Гость приложит фото документа (JPG/PNG, сжимается автоматически). Подходит для удостоверения личности.
                      </p>
                    )}
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

      {/* Просмотр приложенного документа */}
      {docView && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDocView(null)}>
          <div onClick={e => e.stopPropagation()}
            className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl max-w-lg w-full p-4 shadow-2xl relative">
            <button onClick={() => setDocView(null)} className="absolute top-3 right-3 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-bold text-[var(--text-main)] mb-3">{docView.name} — документ</h3>
            <img src={docView.src} alt="Документ заявителя"
              className="w-full rounded-xl border border-[var(--border-color)] max-h-[70vh] object-contain bg-black/30" />
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
