import React, { useState, useEffect } from 'react';
import { useOutletContext, useParams, useNavigate } from 'react-router-dom';
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
  AlertCircle,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FancyQr, { QR_THEMES, QrThemePicker, downloadQr, type QrTheme } from '../../../components/forms/FancyQr';
import { STATUS_LABEL, STATUS_COLOR, MODE_STATUSES, type FormMode } from '../../../shared/formStatuses';
import { auth } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';

export default function FormBuilder() {
  const { activeTenant } = useOutletContext<any>() || {};
  const { orgId } = useParams();
  // Без организации не подписываемся ни на что: подставной тенант означал
  // бы показать чужие заявки.
  const currentOrgId = activeTenant?.id || orgId || '';
  const navigate = useNavigate();
  const { user } = useAuth();

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
  /**
   * Показывать ли анкету в общем списке организации для внешних сайтов.
   *
   * По умолчанию выключено: рядом с открытым опросом у организации лежат
   * внутренние анкеты, и само их существование — не публичные сведения.
   * Ссылку на анкету можно раздать и без этого, список нужен лишь тем, кто
   * собирает страницу «все наши анкеты» на своём сайте.
   */
  const [publicListed, setPublicListed] = useState(false);
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

  /**
   * Фильтры и корзина.
   *
   * Заявок бывают сотни, и без отбора по форме и статусу таблица
   * бесполезна: нужную строку в ней не найти.
   */
  const [filterFormId, setFilterFormId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [subView, setSubView] = useState<any | null>(null);
  const [busySub, setBusySub] = useState<string | null>(null);

  const visibleSubs = submissions.filter((sub: any) => {
    if (showDeleted !== Boolean(sub.deleted)) return false;
    if (filterFormId && sub.formId !== filterFormId) return false;
    if (filterStatus && (sub.status || 'new') !== filterStatus) return false;
    if (search.trim()) {
      const hay = [sub.applicantName, sub.applicantPhone, sub.applicantEmail, sub.qrToken]
        .concat(Object.values(sub.data || {}).map(v => String(v).slice(0, 200)))
        .join(' ').toLowerCase();
      if (!hay.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  });

  const deletedCount = submissions.filter((s: any) => s.deleted).length;

  /** Подписи полей формы — чтобы в ответах читалось «Город», а не «field_3». */
  const labelsOf = (formId: string): Record<string, string> => {
    const f = forms.find(x => x.id === formId);
    const map: Record<string, string> = {};
    (f?.fields || []).forEach((x: any) => { map[x.id] = x.label || x.id; });
    return map;
  };

  const removeSubmission = async (sub: any, restore = false) => {
    if (!restore && !confirm(`Убрать заявку «${sub.applicantName || 'без имени'}» из списка? Её можно будет вернуть.`)) return;
    setBusySub(sub.id);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/forms/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId: currentOrgId, submissionId: sub.id, restore }),
      });
      const data = await res.json();
      if (!data.success) alert(data.error || 'Не удалось');
      // onSnapshot сам обновит список.
    } catch (e: any) { alert(`Не удалось: ${e.message}`); }
    finally { setBusySub(null); }
  };

  /**
   * Выгрузка ответов таблицей.
   *
   * Колонки — поля формы, по одной заявке в строке. Файлы в выгрузку не
   * попадают: там base64 на сотни килобайт, который сломает любую таблицу.
   */
  const exportSubs = (formId: string) => {
    const form = forms.find(f => f.id === formId);
    const rows = submissions.filter((s: any) => s.formId === formId && !s.deleted);
    if (!rows.length) { alert('По этой форме заявок пока нет.'); return; }

    const fields = (form?.fields || []).filter((f: any) => f.type !== 'file');
    const head = ['Дата', 'Имя', 'Телефон', 'Почта', 'Статус', 'Код']
      .concat(fields.map((f: any) => f.label || f.id));

    // Точка с запятой и BOM: так файл открывается в Гугл Таблицах и Excel
    // с русскими буквами и разнесённый по колонкам, а не одной строкой.
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
    const lines = [head.map(esc).join(';')];
    for (const r of rows) {
      const when = r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleString('ru-RU') : '';
      lines.push([
        when, r.applicantName || '', r.applicantPhone || '', r.applicantEmail || '',
        STATUS_LABEL[(r.status || 'new') as keyof typeof STATUS_LABEL] || r.status || '', r.qrToken || '',
      ].concat(fields.map((f: any) => r.data?.[f.id] ?? '')).map(esc).join(';'));
    }

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(form?.title || 'Заявки').replace(/[^\wа-яА-ЯёЁ -]/g, '')} — ${new Date().toLocaleDateString('ru-RU')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /**
   * Перенести ответы в таблицу воркспейса.
   *
   * В свою таблицу, а не в чужую Гугл-таблицу: писать в чужой документ по
   * обычной ссылке Google не даёт, и «перенос» свёлся бы к тому, что
   * человек сам перетаскивает файл. Здесь ответы попадают в таблицу сразу
   * и открываются на редактирование, как любая другая таблица организации.
   *
   * Таблица создаётся один раз и запоминается у формы; дальше новые заявки
   * дописывает сервер сам, строкой вниз. Эта кнопка нужна для первого
   * переноса и чтобы подтянуть заявки, пришедшие до привязки таблицы.
   *
   * Уже существующие строки не трогаем: в таблице ведут свои пометки в
   * соседних колонках, и полная перестройка листа стирала бы эту работу.
   */
  const toWorkspaceSheet = async (formId: string) => {
    const form = forms.find(f => f.id === formId);
    const rows = submissions.filter((s: any) => s.formId === formId && !s.deleted);
    if (!rows.length) { alert('По этой форме заявок пока нет.'); return; }
    if (!currentOrgId || !user?.uid) return;

    setBusySub(formId);
    try {
      const { sheetService } = await import('../../../services/collab/sheetService');
      const fields = (form?.fields || []).filter((f: any) => f.type !== 'file');
      const head = ['Дата', 'Имя', 'Телефон', 'Почта', 'Статус', 'Код']
        .concat(fields.map((f: any) => f.label || f.id));

      const table: string[][] = [head];
      for (const r of rows) {
        table.push([
          r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleString('ru-RU') : '',
          r.applicantName || '', r.applicantPhone || '', r.applicantEmail || '',
          STATUS_LABEL[(r.status || 'new') as keyof typeof STATUS_LABEL] || '', r.qrToken || '',
        ].concat(fields.map((f: any) => String(r.data?.[f.id] ?? ''))));
      }

      // Ячейки в формате «A1»: буква колонки + номер строки.
      const colName = (i: number) => {
        let n = i, name = '';
        do { name = String.fromCharCode(65 + (n % 26)) + name; n = Math.floor(n / 26) - 1; } while (n >= 0);
        return name;
      };
      let sheetId = form?.sheetId || '';
      let existing: any = null;
      if (sheetId) {
        const snap = await getDoc(doc(db, 'tenants', currentOrgId, 'workspace_sheets', sheetId));
        if (snap.exists()) existing = snap.data();
      }

      if (!existing) {
        sheetId = await sheetService.createSheet(currentOrgId, user.uid, `Ответы — ${form?.title || 'форма'}`);
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
        await fetch('/api/forms/sheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ tenantId: currentOrgId, formId, sheetId }),
        });
      }

      // Какие заявки уже в таблице — по коду в шестой колонке. Повторный
      // перенос дописывает только недостающие, а не собирает лист заново:
      // иначе пометки, сделанные в таблице руками, стирались бы.
      const prevCells: Record<string, any> = existing?.cells || {};
      const already = new Set(
        Object.entries(prevCells)
          .filter(([k]) => /^F\d+$/.test(k))
          .map(([, v]) => String((v as any)?.rawValue || '')),
      );
      let lastRow = 0;
      for (const key of Object.keys(prevCells)) {
        const n = Number((key.match(/\d+$/) || [])[0]);
        if (Number.isFinite(n) && n > lastRow) lastRow = n;
      }

      const cells: Record<string, any> = {};
      if (lastRow === 0) {
        head.forEach((value, ci) => { cells[`${colName(ci)}1`] = { rawValue: value, computedValue: value }; });
        lastRow = 1;
      }
      let added = 0;
      for (let i = 1; i < table.length; i++) {
        const row = table[i];
        if (already.has(row[5])) continue; // код заявки уже в таблице
        lastRow++; added++;
        // Пустой ответ пишем пустой ячейкой, а не пропускаем: иначе на этом
        // месте оставалось бы значение, лежавшее там раньше.
        row.forEach((value, ci) => {
          cells[`${colName(ci)}${lastRow}`] = { rawValue: value, computedValue: value };
        });
      }

      if (added === 0 && existing) {
        alert('В таблице уже есть все заявки по этой форме.');
        navigate(`/workspace/${currentOrgId}/sheets/${sheetId}`);
        return;
      }

      const patch: Record<string, any> = {
        rowsCount: Math.max(Number(existing?.rowsCount) || 100, lastRow + 10),
        columnsCount: Math.max(Number(existing?.columnsCount) || 26, head.length + 2),
        lastEditedByStaffId: user.uid,
        updatedAt: Date.now(),
      };
      // Точечно по ячейкам, а не целым полем cells: так соседние колонки с
      // пометками остаются нетронутыми.
      Object.entries(cells).forEach(([k, v]) => { patch[`cells.${k}`] = v; });
      await updateDoc(doc(db, 'tenants', currentOrgId, 'workspace_sheets', sheetId), patch);

      navigate(`/workspace/${currentOrgId}/sheets/${sheetId}`);
    } catch (e: any) {
      alert(`Не удалось перенести в таблицу: ${e.message}`);
    } finally {
      setBusySub(null);
    }
  };

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

  /**
   * Варианты выбора — отдельным списком, а не одной строкой через запятую.
   *
   * Раньше строка резалась по запятым на КАЖДОЕ нажатие клавиши, куски
   * обрезались по краям и пустые выбрасывались: запятую съедало как
   * разделитель, пробел срезало, а вариант с запятой внутри («Бишкек,
   * центр») ввести было нельзя вовсе. Теперь каждый вариант живёт своей
   * строкой ввода и хранится как есть.
   */
  const optionsOf = (field: any): string[] => (Array.isArray(field.options) ? field.options : []);

  const setOptions = (index: number, next: string[]) => updateField(index, 'options', next);

  const addOption = (index: number) => {
    const cur = optionsOf(fields[index]);
    setOptions(index, [...cur, '']);
  };

  const updateOption = (index: number, optIdx: number, value: string) => {
    const next = [...optionsOf(fields[index])];
    next[optIdx] = value;
    setOptions(index, next);
  };

  const removeOption = (index: number, optIdx: number) => {
    setOptions(index, optionsOf(fields[index]).filter((_, i) => i !== optIdx));
  };

  /** Порядок вариантов виден гостю — его должно быть можно менять. */
  const moveOption = (index: number, optIdx: number, delta: number) => {
    const cur = [...optionsOf(fields[index])];
    const target = optIdx + delta;
    if (target < 0 || target >= cur.length) return;
    [cur[optIdx], cur[target]] = [cur[target], cur[optIdx]];
    setOptions(index, cur);
  };

  /** Совпадающие варианты гость различить не сможет — предупреждаем заранее. */
  const duplicateOptions = (field: any): Set<number> => {
    const seen = new Map<string, number>();
    const dupes = new Set<number>();
    optionsOf(field).forEach((o, i) => {
      const key = String(o).trim().toLowerCase();
      if (!key) return;
      if (seen.has(key)) { dupes.add(i); dupes.add(seen.get(key)!); } else { seen.set(key, i); }
    });
    return dupes;
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    // Пустые варианты в список гостя попадать не должны: пустая строка в
    // выпадающем списке выглядит как сбой и выбрать её нельзя. Убираем их
    // здесь, а не при вводе, — иначе поле схлопывалось бы под руками.
    const cleanFields = fields.map((f: any) => (
      f.type === 'select'
        ? { ...f, options: optionsOf(f).map((o: string) => String(o).trim()).filter(Boolean) }
        : f
    ));

    const brokenSelect = cleanFields.find((f: any) => f.type === 'select' && f.options.length < 2);
    if (brokenSelect) {
      alert(`У поля «${brokenSelect.label || 'без названия'}» нужно минимум два варианта ответа.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const fId = editingFormId || `form_${Date.now()}`;
      await setDoc(doc(db, 'custom_forms', fId), {
        tenantId: currentOrgId,
        title: formTitle.trim(),
        description: formDesc.trim(),
        fields: cleanFields,
        qrTrackingEnabled,
        publicListed,
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
  /**
   * Смена статуса с комментарием.
   *
   * Сервер писал комментарий в историю заявки с самого начала, но взять
   * его было неоткуда: выпадающий список менял статус молча. Из-за этого
   * в истории оставалось «кто и когда», но не «почему» — а именно это
   * спрашивают, когда через месяц разбирают отказ.
   *
   * Поэтому сначала окно, и только потом запрос.
   */
  const [statusDraft, setStatusDraft] = useState<
    { sub: any; status: string; note: string; withNote: boolean } | null
  >(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const askStatusChange = (sub: any, newStatus: string) => {
    if ((sub.status || 'new') === newStatus) return;
    setStatusDraft({ sub, status: newStatus, note: '', withNote: true });
  };

  const applyStatusChange = async () => {
    if (!statusDraft) return;
    const { sub, status, note, withNote } = statusDraft;

    // Галочка снята — комментарий не спрашиваем вовсе. Она включена, но
    // поле пустое — не даём сохранить: пустой комментарий в истории
    // неотличим от его отсутствия, и человек зря думает, что записал причину.
    if (withNote && !note.trim()) return;

    setStatusBusy(true);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/forms/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tenantId: currentOrgId,
          submissionId: sub.id,
          status,
          note: withNote ? note.trim() : '',
        }),
      });
      const data = await res.json();
      if (!data.success) { alert(data.error || 'Не удалось сменить статус'); return; }
      setStatusDraft(null);
      // onSnapshot сам подтянет обновление — локально ничего не трогаем.
    } catch(e: any) {
      alert(`Не удалось сменить статус: ${e.message}`);
    } finally {
      setStatusBusy(false);
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
              // Новая анкета не публичная, даже если прошлая была: показ
              // наружу — осознанное решение, а не наследство от соседней.
              setPublicListed(false);
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
                        setPublicListed(form.publicListed === true);
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
        <div className="space-y-3">
          {/* Отбор: без него в сотне заявок нужную строку не найти. */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-3 flex flex-wrap items-center gap-2">
            <select value={filterFormId} onChange={e => setFilterFormId(e.target.value)}
              className="px-3 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg text-xs">
              <option value="">Все формы</option>
              {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>

            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg text-xs">
              <option value="">Любой статус</option>
              {Object.entries(STATUS_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>

            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по имени, телефону, ответам…"
              className="flex-1 min-w-[200px] px-3 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg text-xs" />

            {(filterFormId || filterStatus || search) && (
              <button onClick={() => { setFilterFormId(''); setFilterStatus(''); setSearch(''); }}
                className="px-2.5 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/10">
                Сбросить
              </button>
            )}

            <div className="ml-auto flex items-center gap-2">
              {deletedCount > 0 && (
                <button onClick={() => setShowDeleted(v => !v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${showDeleted
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-600'
                    : 'border-[var(--border-color)] text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/10'}`}>
                  {showDeleted ? 'К списку заявок' : `Удалённые (${deletedCount})`}
                </button>
              )}

              {/* Перенос и скачивание работают по одной форме: в общей куче
                  у заявок разные поля, и колонки не сойдутся. */}
              <button
                onClick={() => filterFormId ? void toWorkspaceSheet(filterFormId) : alert('Выберите форму — у разных форм разные поля, и в общей таблице колонки не сойдутся.')}
                disabled={busySub === filterFormId && !!filterFormId}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 inline-flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                {busySub === filterFormId && filterFormId ? 'Переношу…' : 'В таблицу'}
              </button>

              <button
                onClick={() => filterFormId ? exportSubs(filterFormId) : alert('Выберите форму, ответы которой нужно скачать.')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[var(--border-color)] text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10">
                Скачать
              </button>
            </div>
          </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-xs">
          {visibleSubs.length === 0 ? (
            <div className="p-12 text-center text-[var(--text-muted)] text-xs">
              {showDeleted
                ? 'В корзине пусто.'
                : submissions.length === 0
                  ? 'Заявок пока нет. Поделитесь ссылкой на форму с клиентами!'
                  : 'Под фильтры ничего не подошло.'}
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-panel)] border-b border-[var(--border-color)] text-[var(--text-muted)] font-mono uppercase text-[11px]">
                <tr>
                  <th className="px-5 py-3 font-medium">Заявитель / ФИО</th>
                  <th className="px-5 py-3 font-medium">Форма</th>
                  <th className="px-5 py-3 font-medium">Ответы</th>
                  <th className="px-5 py-3 font-medium">Статус</th>
                  <th className="px-5 py-3 font-medium">Дата подачи</th>
                  <th className="px-5 py-3 font-medium text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {visibleSubs.map(sub => (
                  <tr key={sub.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-[var(--text-main)]">{sub.applicantName || 'Неизвестный'}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{sub.applicantPhone || sub.applicantEmail || 'Без контакта'}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-emerald-500 font-bold">{sub.formTitle || 'Форма'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {(() => {
                        // Короткая выжимка ответов прямо в строке: без неё
                        // таблица показывала только имя и статус, а сами
                        // ответы, ради которых форму и заполняли, увидеть
                        // было негде.
                        const labels = labelsOf(sub.formId);
                        const entries = Object.entries(sub.data || {})
                          .filter(([, v]) => String(v ?? '').trim() && !String(v).startsWith('data:'));
                        if (!entries.length) return <span className="text-[var(--text-muted)] text-[11px]">—</span>;
                        const preview = entries.slice(0, 2)
                          .map(([k, v]) => `${labels[k] || k}: ${String(v).slice(0, 28)}`).join(' · ');
                        return (
                          <button onClick={() => setSubView(sub)}
                            className="text-left text-[11px] text-[var(--text-main)] hover:text-emerald-500 transition">
                            <span className="line-clamp-1">{preview}</span>
                            {entries.length > 2 && (
                              <span className="text-[var(--text-muted)]">и ещё {entries.length - 2}</span>
                            )}
                          </button>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-3.5">
                      {/* Цвет статуса — тот же, что везде в проекте: раньше
                          все статусы выглядели одинаково, и отличить новую
                          заявку от отклонённой в списке было нельзя. */}
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLOR[(sub.status || 'new') as keyof typeof STATUS_COLOR]}`} />
                      <select 
                        value={sub.status || 'new'}
                        onChange={(e) => askStatusChange(sub, e.target.value)}
                        className="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg px-2.5 py-1 text-[11px] font-bold font-mono text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
                      >
                        {/* Набор статусов зависит от режима формы: у билета
                            есть «Оплачено» и «Гость пришёл», у заявки — нет. */}
                        {MODE_STATUSES[(forms.find(f => f.id === sub.formId)?.mode === 'ticket' ? 'ticket' : 'application') as FormMode]
                          .map(st => (
                            <option key={st} value={st}>{STATUS_LABEL[st]}</option>
                          ))}
                      </select>
                      </div>
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
                        <QrCode className="w-3.5 h-3.5" /> QR
                      </button>
                      {sub.deleted ? (
                        <button
                          onClick={() => void removeSubmission(sub, true)}
                          disabled={busySub === sub.id}
                          className="ml-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/30 px-3 py-1 rounded-lg font-bold text-[11px] transition disabled:opacity-50">
                          Вернуть
                        </button>
                      ) : (
                        <button
                          onClick={() => void removeSubmission(sub)}
                          disabled={busySub === sub.id}
                          title="Убрать в корзину"
                          className="ml-2 p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition disabled:opacity-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        </div>
      )}

      {/* Смена статуса с ответом заявителю: текст появится у него на
          странице отслеживания рядом с новым статусом. */}
      {statusDraft && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !statusBusy && setStatusDraft(null)}>
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[var(--border-color)] pb-3">
              <div>
                <h3 className="text-lg font-bold">Смена статуса</h3>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  {statusDraft.sub.applicantName || 'Без имени'} — {statusDraft.sub.formTitle || 'Заявка'}
                </p>
              </div>
              <button onClick={() => setStatusDraft(null)} disabled={statusBusy}
                className="p-2 hover:bg-black/10 rounded-xl text-slate-400 disabled:opacity-40">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[(statusDraft.sub.status || 'new') as keyof typeof STATUS_COLOR]}`} />
              <span className="text-[var(--text-muted)]">{STATUS_LABEL[(statusDraft.sub.status || 'new') as keyof typeof STATUS_LABEL]}</span>
              <span className="text-[var(--text-muted)]">→</span>
              <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[statusDraft.status as keyof typeof STATUS_COLOR]}`} />
              <span className="font-bold">{STATUS_LABEL[statusDraft.status as keyof typeof STATUS_LABEL]}</span>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={statusDraft.withNote}
                onChange={e => setStatusDraft({ ...statusDraft, withNote: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300" />
              <span className="text-sm">Написать ответ заявителю</span>
            </label>

            {statusDraft.withNote ? (
              <div className="space-y-1">
                <textarea
                  value={statusDraft.note}
                  onChange={e => setStatusDraft({ ...statusDraft, note: e.target.value.slice(0, 300) })}
                  autoFocus
                  rows={3}
                  placeholder="Что сообщить человеку: причина решения, что делать дальше, когда ждать ответа"
                  className="w-full px-3 py-2 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-sm resize-none focus:outline-none focus:border-emerald-500"
                />
                <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                  <span>Увидит заявитель на странице своей заявки</span>
                  <span>{statusDraft.note.length}/300</span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-[var(--text-muted)]">
                Статус сменится молча — заявитель увидит только новое состояние, без пояснения.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={() => setStatusDraft(null)} disabled={statusBusy}
                className="px-4 py-2 rounded-xl border border-[var(--border-color)] font-bold text-sm disabled:opacity-40">
                Отмена
              </button>
              <button
                onClick={() => void applyStatusChange()}
                disabled={statusBusy || (statusDraft.withNote && !statusDraft.note.trim())}
                title={statusDraft.withNote && !statusDraft.note.trim()
                  ? 'Напишите ответ или снимите галочку'
                  : undefined}
                className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2">
                {statusBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Сменить статус</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Окно с полной заявкой: в таблице видна только выжимка. */}
      {subView && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSubView(null)}>
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[var(--border-color)] pb-3">
              <div>
                <h3 className="text-lg font-bold">{subView.applicantName || 'Без имени'}</h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {subView.formTitle || 'Заявка'}
                  {subView.createdAt?.seconds
                    ? ` · ${new Date(subView.createdAt.seconds * 1000).toLocaleString('ru-RU')}`
                    : ''}
                </p>
              </div>
              <button onClick={() => setSubView(null)} className="p-2 hover:bg-black/10 rounded-xl text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[(subView.status || 'new') as keyof typeof STATUS_COLOR]}`} />
              <span className="font-bold">{STATUS_LABEL[(subView.status || 'new') as keyof typeof STATUS_LABEL]}</span>
              {subView.qrToken && <span className="ml-auto font-mono text-[var(--text-muted)]">{subView.qrToken}</span>}
            </div>

            {(subView.applicantPhone || subView.applicantEmail) && (
              <div className="text-xs text-[var(--text-muted)]">
                {[subView.applicantPhone, subView.applicantEmail].filter(Boolean).join(' · ')}
              </div>
            )}

            <div className="space-y-2">
              {(() => {
                const labels = labelsOf(subView.formId);
                const entries = Object.entries(subView.data || {});
                if (!entries.length) return <p className="text-xs text-[var(--text-muted)]">Ответов нет.</p>;
                return entries.map(([k, v]) => {
                  const value = String(v ?? '');
                  return (
                    <div key={k} className="border-b border-[var(--border-color)] pb-2">
                      <div className="text-[11px] font-semibold text-[var(--text-muted)]">{labels[k] || k}</div>
                      {value.startsWith('data:image/') ? (
                        <img src={value} alt={labels[k] || k}
                          className="mt-1 max-h-48 rounded-xl border border-[var(--border-color)]" />
                      ) : (
                        <div className="text-sm text-[var(--text-main)] whitespace-pre-wrap break-words">
                          {value || '—'}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {Array.isArray(subView.history) && subView.history.length > 0 && (
              <div className="pt-2">
                <div className="text-[11px] font-semibold text-[var(--text-muted)] mb-1">Ход рассмотрения</div>
                {subView.history.map((h: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-[11px] py-0.5">
                    <span>{STATUS_LABEL[h.status as keyof typeof STATUS_LABEL] || h.status}</span>
                    <span className="text-[var(--text-muted)] font-mono">
                      {h.at?.seconds ? new Date(h.at.seconds * 1000).toLocaleDateString('ru-RU') : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
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
                  <label className="flex items-start gap-2 text-[11px] text-[var(--text-muted)] cursor-pointer">
                    <input type="checkbox" checked={publicListed} onChange={(e) => setPublicListed(e.target.checked)} className="mt-0.5" />
                    <span>
                      Показывать в списке анкет для внешних сайтов
                      <span className="block text-[10px] opacity-70">
                        Анкету увидят на сторонних страницах организации. Ссылка работает и без этого.
                      </span>
                    </span>
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
                    {field.type === 'select' && (() => {
                      const options = optionsOf(field);
                      const dupes = duplicateOptions(field);
                      const filled = options.filter(o => String(o).trim()).length;
                      return (
                        <div className="space-y-1.5 pl-1 border-l-2 border-[var(--border-color)]">
                          <div className="flex items-center justify-between pl-2">
                            <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                              Варианты ответа{filled > 0 ? ` — ${filled}` : ''}
                            </span>
                            {filled < 2 && (
                              <span className="text-[11px] text-amber-600">Нужно минимум два</span>
                            )}
                          </div>

                          {options.length === 0 && (
                            <p className="pl-2 text-[11px] text-[var(--text-muted)]">
                              Пока пусто. Добавьте варианты, из которых гость будет выбирать.
                            </p>
                          )}

                          {options.map((opt: string, optIdx: number) => (
                            <div key={optIdx} className="flex items-center gap-1.5 pl-2">
                              <span className="text-[11px] text-[var(--text-muted)] w-4 shrink-0 text-right">{optIdx + 1}.</span>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => updateOption(idx, optIdx, e.target.value)}
                                onKeyDown={(e) => {
                                  // Enter добавляет следующий вариант, а не отправляет форму:
                                  // список заполняют подряд, не трогая мышь.
                                  if (e.key === 'Enter') { e.preventDefault(); addOption(idx); }
                                }}
                                autoFocus={opt === '' && optIdx === options.length - 1}
                                placeholder={`Вариант ${optIdx + 1}`}
                                className={`flex-1 px-2.5 py-1.5 bg-[var(--bg-surface)] border rounded-lg text-xs ${
                                  dupes.has(optIdx) ? 'border-amber-500' : 'border-[var(--border-color)]'
                                }`}
                              />
                              <button type="button" onClick={() => moveOption(idx, optIdx, -1)} disabled={optIdx === 0}
                                title="Выше"
                                className="p-1 rounded text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-default">
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => moveOption(idx, optIdx, 1)} disabled={optIdx === options.length - 1}
                                title="Ниже"
                                className="p-1 rounded text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-default">
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => removeOption(idx, optIdx)} title="Удалить вариант"
                                className="p-1 rounded text-red-500 hover:bg-red-500/10">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}

                          {dupes.size > 0 && (
                            <p className="pl-2 text-[11px] text-amber-600">
                              Одинаковые варианты выделены — гость не сможет их различить.
                            </p>
                          )}

                          <button type="button" onClick={() => addOption(idx)}
                            className="ml-2 mt-0.5 inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-[var(--border-color)] text-[11px] font-semibold text-[var(--text-muted)] hover:border-emerald-500 hover:text-emerald-600">
                            <Plus className="w-3 h-3" /> Добавить вариант
                          </button>
                        </div>
                      );
                    })()}
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
