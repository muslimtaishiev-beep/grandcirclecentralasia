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

/**
 * Обрыв сети браузеры называют по-своему: Safari — «Load failed», Chrome —
 * «Failed to fetch». Человек видел «Не удалось сменить статус: Load failed»
 * и думал, что сломался кабинет, хотя у него просто пропал интернет.
 */
const humanError = (e: any): string =>
  /load failed|failed to fetch|networkerror|network request failed/i.test(String(e?.message || e))
    ? 'нет связи с сервером — проверьте интернет и повторите'
    : String(e?.message || e);

/** Поле анкеты, которое можно править из кабинета (файлы — нет). */
const editableField = (f: any) => f && f.type !== 'file';

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
    // Предел был 300, и у организации с 470 заявками старые просто
    // исчезали из кабинета — выглядело как потеря данных, хотя в базе
    // лежало всё.
    //
    // Ограничение стояло из-за фотографий: в заявке бывает снимок
    // документа (base64 до 400 КБ), и подписка без лимита тянула бы в
    // браузер снимки всех гостей разом. Но фотография и не нужна в
    // списке — она открывается отдельным окном по клику. Поэтому вместо
    // маленького лимита выбрасываем тяжёлые поля из того, что держим в
    // памяти, а снимок подгружаем по требованию.
    const qSubs = query(
      collection(db, 'form_submissions'),
      where('tenantId', '==', currentOrgId),
      orderBy('createdAt', 'desc'),
      limit(2000),
    );

    const unsubForms = onSnapshot(qForms, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setForms(list);
    });

    const unsubSubs = onSnapshot(qSubs, (snap) => {
      const list: any[] = [];
      snap.forEach(d => {
        const raw: any = d.data();
        // Снимки документов в списке не нужны: они открываются по клику,
        // а в памяти держать сотни картинок по 400 КБ нельзя.
        const data: Record<string, any> = {};
        let hasFile = false;
        for (const [k, v] of Object.entries(raw.data || {})) {
          if (typeof v === 'string' && v.startsWith('data:')) { hasFile = true; continue; }
          data[k] = v;
        }
        list.push({ id: d.id, ...raw, data, hasFile });
      });
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

  /**
   * Отбор по отдельным полям анкеты.
   *
   * Общий поиск по всему тексту отвечает на «где-то встречается слово»,
   * но не на живые вопросы: кто подал за последнюю неделю, кто выбрал
   * командное участие, кто не дал согласия. Для этого нужен не один
   * ввод, а по условию на каждое поле — и у каждого поля свой вид:
   * дата диапазоном, галочка «да/нет», список выбором из вариантов.
   *
   * Условия хранятся как { [id поля]: значение }. Пустое значение
   * означает «не фильтруем», поэтому лишние условия не мешают.
   */
  const [fieldFilters, setFieldFilters] = useState<Record<string, any>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Поля выбранной анкеты плюс те, что есть у любой заявки.
  const filterableFields = React.useMemo(() => {
    const form = forms.find(f => f.id === filterFormId);
    const own = (form?.fields || []).map((f: any) => ({
      id: f.id, label: f.label || f.id, type: f.type, options: f.options || [],
    }));
    return [
      { id: '__date', label: 'Дата подачи', type: 'daterange', options: [] },
      { id: '__name', label: 'Имя заявителя', type: 'text', options: [] },
      { id: '__contact', label: 'Телефон или почта', type: 'text', options: [] },
      { id: '__code', label: 'Код заявки', type: 'text', options: [] },
      ...own,
    ];
  }, [forms, filterFormId]);

  const activeFilterCount = Object.values(fieldFilters)
    .filter(v => v !== '' && v !== undefined && v !== null
      && !(typeof v === 'object' && !v.from && !v.to)).length;

  /** Подходит ли заявка под все заданные условия. */
  const matchesFieldFilters = (sub: any): boolean => {
    for (const [key, cond] of Object.entries(fieldFilters)) {
      if (cond === '' || cond === undefined || cond === null) continue;

      if (key === '__date') {
        const ms = sub.createdAt?.seconds ? sub.createdAt.seconds * 1000 : 0;
        if (!ms) return false;
        if (cond.from && ms < new Date(cond.from).setHours(0, 0, 0, 0)) return false;
        if (cond.to && ms > new Date(cond.to).setHours(23, 59, 59, 999)) return false;
        continue;
      }

      const text = (v: unknown) => String(v ?? '').toLowerCase();
      if (key === '__name') { if (!text(sub.applicantName).includes(text(cond))) return false; continue; }
      if (key === '__code') { if (!text(sub.qrToken).includes(text(cond))) return false; continue; }
      if (key === '__contact') {
        const hay = `${text(sub.applicantPhone)} ${text(sub.applicantEmail)}`;
        if (!hay.includes(text(cond))) return false;
        continue;
      }

      const value = sub.data?.[key];
      // Галочка: «да» и «нет» — разные условия, поэтому сравниваем строго.
      if (cond === '__true') { if (value !== true && String(value) !== 'true') return false; continue; }
      if (cond === '__false') { if (value === true || String(value) === 'true') return false; continue; }
      // Пусто или заполнено — частый вопрос: «кто не указал команду».
      if (cond === '__empty') { if (String(value ?? '').trim()) return false; continue; }
      if (cond === '__filled') { if (!String(value ?? '').trim()) return false; continue; }

      if (!text(value).includes(text(cond))) return false;
    }
    return true;
  };
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
    if (!matchesFieldFilters(sub)) return false;
    return true;
  });

  const deletedCount = submissions.filter((s: any) => s.deleted).length;

  /**
   * Корзина опустела — возвращаемся к списку сами.
   *
   * Кнопка «К списку заявок» живёт рядом со счётчиком корзины и исчезает
   * вместе с ним. Если вернуть или стереть последнюю заявку, человек
   * оставался в пустой корзине без единой кнопки выхода.
   */
  React.useEffect(() => {
    if (showDeleted && deletedCount === 0) setShowDeleted(false);
  }, [showDeleted, deletedCount]);

  /** Подписи полей формы — чтобы в ответах читалось «Город», а не «field_3». */
  const labelsOf = (formId: string): Record<string, string> => {
    const FRIENDLY_NAMES: Record<string, string> = {
      field_1790767291933: 'ФИО участника',
      field_1790767998828: 'Email',
      field_1790768013294: 'Телефон',
      field_1790768170123: 'Формат участия',
      field_1790768063759: 'Название команды',
      field_1790768090009: 'Код команды',
      field_1790768091708: 'Пароль команды',
      field_1790940529090: 'Презентация (файл/ссылка)',
    };
    const f = forms.find(x => x.id === formId);
    const map: Record<string, string> = { ...FRIENDLY_NAMES };
    (f?.fields || []).forEach((x: any) => { map[x.id] = x.label || FRIENDLY_NAMES[x.id] || x.id; });
    return map;
  };

  /**
   * Показывать заявку на витрине или убрать с неё.
   *
   * Решение принимается по каждой заявке отдельно: анкета может быть
   * анонимной, и человек писал не для публикации.
   */
  const togglePublic = async (sub: any) => {
    const next = !sub.publicShown;
    if (next && !confirm(`Показать эту заявку на сайте организации?\n\nЕё текст увидят все посетители.`)) return;
    setBusySub(sub.id);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/forms/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId: currentOrgId, submissionId: sub.id, shown: next }),
      });
      const data = await res.json();
      if (!data.success) alert(data.error || 'Не удалось');
    } catch (e: any) { alert(`Не удалось: ${humanError(e)}`); }
    finally { setBusySub(null); }
  };

  /**
   * Снимок документа — по требованию.
   *
   * В списке его нет: сотни фотографий по 400 КБ в памяти браузера
   * означали бы, что кабинет не открывается вовсе. Читаем саму заявку в
   * момент, когда человек нажал «Документ».
   */
  const openDocument = async (sub: any) => {
    setBusySub(sub.id);
    try {
      const snap = await getDoc(doc(db, 'form_submissions', sub.id));
      const data: any = snap.data()?.data || {};
      const src = Object.values(data).find((v: any) => typeof v === 'string' && v.startsWith('data:'));
      if (!src) { alert('Документ не найден.'); return; }
      setDocView({ name: sub.applicantName || 'Документ', src: String(src) });
    } catch (e: any) {
      alert(`Не удалось открыть документ: ${humanError(e)}`);
    } finally {
      setBusySub(null);
    }
  };

  /**
   * Стереть заявку насовсем — только из корзины.
   *
   * Корзина спасает от случайного нажатия, но из неё нужен выход:
   * пробные заявки и спам нельзя держать вечно, и в выгрузке их быть
   * не должно.
   */
  const purgeSubmission = async (sub: any) => {
    if (!confirm(`Стереть заявку «${sub.applicantName || 'без имени'}» насовсем?\n\nВернуть её будет нельзя.`)) return;
    setBusySub(sub.id);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/forms/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId: currentOrgId, submissionId: sub.id }),
      });
      const data = await res.json();
      if (!data.success) alert(data.error || 'Не удалось стереть');
    } catch (e: any) { alert(`Не удалось: ${humanError(e)}`); }
    finally { setBusySub(null); }
  };

  const purgeAll = async () => {
    const count = submissions.filter((x: any) => x.deleted).length;
    if (!confirm(`Очистить корзину — стереть ${count} заявок насовсем?\n\nВернуть их будет нельзя.`)) return;
    setBusySub('all');
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/forms/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId: currentOrgId, all: true }),
      });
      const data = await res.json();
      if (!data.success) alert(data.error || 'Не удалось');
      else { alert(`Стёрто заявок: ${data.purged}`); setShowDeleted(false); }
    } catch (e: any) { alert(`Не удалось: ${humanError(e)}`); }
    finally { setBusySub(null); }
  };

  /**
   * Привести таблицу в соответствие со списком заявок.
   *
   * Таблица дописывается по строке на заявку и со временем расходится с
   * кабинетом: остаются строки удалённых, задваиваются коды. Проверить
   * глазами сотни строк нельзя — нужна кнопка.
   */
  const resyncSheet = async (formId: string) => {
    if (!confirm('Переписать таблицу по текущему списку заявок?\n\nКолонки заявок будут собраны заново. Ваши пометки в колонках правее останутся, но могут оказаться не напротив своих строк, если порядок заявок изменился.')) return;
    setBusySub(formId);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/forms/sheet/resync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId: currentOrgId, formId }),
      });
      const data = await res.json();
      if (!data.success) { alert(data.error || 'Не удалось'); return; }
      alert(`Таблица обновлена: ${data.rows} заявок.`);
    } catch (e: any) { alert(`Не удалось: ${humanError(e)}`); }
    finally { setBusySub(null); }
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
    } catch (e: any) { alert(`Не удалось: ${humanError(e)}`); }
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
    // Выгружаем ТО, ЧТО НА ЭКРАНЕ: человек отобрал заявки фильтрами и
    // ждёт именно их. Раньше скачивались все заявки формы, и отбор
    // приходилось повторять руками в скачанном файле.
    const rows = visibleSubs.filter((s: any) => s.formId === formId && !s.deleted);
    if (!rows.length) { alert('Под выбранные условия не подошла ни одна заявка.'); return; }

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
    const filtered = activeFilterCount > 0 || !!filterStatus || !!search.trim();
    a.download = `${(form?.title || 'Заявки').replace(/[^\wа-яА-ЯёЁ -]/g, '')}${filtered ? ' (отбор)' : ''} — ${new Date().toLocaleDateString('ru-RU')}.csv`;
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
    // Как и выгрузка файлом — по тому, что на экране: две кнопки рядом
    // не должны вести себя по-разному.
    const rows = visibleSubs.filter((s: any) => s.formId === formId && !s.deleted);
    if (!rows.length) { alert('Под выбранные условия не подошла ни одна заявка.'); return; }
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
      alert(`Не удалось перенести в таблицу: ${humanError(e)}`);
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
    { subs: any[]; status: string; note: string; withNote: boolean } | null
  >(null);
  const [statusBusy, setStatusBusy] = useState(false);

  /**
   * Выделенные заявки — для массовых действий.
   *
   * Действие применяется только к тому, что выделено И видно на экране:
   * после смены фильтра невидимые заявки не должны меняться «втихую».
   */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelected = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  /** Итог пачки: сколько изменено и что пропущено — с причинами. */
  const reportBulk = (data: any) => {
    const skipped: any[] = Array.isArray(data.skipped) ? data.skipped : [];
    const lines = [`Изменено заявок: ${data.updated || 0}.`];
    if (skipped.length) {
      lines.push(`Пропущено: ${skipped.length}.`);
      skipped.slice(0, 8).forEach(x => lines.push(`• ${x.name}: ${x.reason}`));
      if (skipped.length > 8) lines.push(`…и ещё ${skipped.length - 8}`);
    }
    alert(lines.join('\n'));
  };

  /** Массовая правка одного поля: { поле, значение } для выделенных заявок одной анкеты. */
  const [fieldDraft, setFieldDraft] = useState<{ formId: string; fieldId: string; value: any } | null>(null);
  const [fieldBusy, setFieldBusy] = useState(false);

  const applyBulkField = async (subs: any[]) => {
    if (!fieldDraft?.fieldId || !subs.length) return;
    setFieldBusy(true);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/forms/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tenantId: currentOrgId, action: 'field',
          submissionIds: subs.map((x: any) => x.id), fieldId: fieldDraft.fieldId, value: fieldDraft.value,
        }),
      });
      const data = await res.json();
      if (!data.success) { alert(data.error || 'Не удалось изменить'); return; }
      setFieldDraft(null);
      setSelected(new Set());
      reportBulk(data);
    } catch (e: any) { alert(`Не удалось изменить: ${humanError(e)}`); }
    finally { setFieldBusy(false); }
  };

  /** Правка ответов в одной заявке — черновик значений по id поля. */
  const [editDraft, setEditDraft] = useState<Record<string, any> | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  const saveEdit = async (sub: any, changed: Record<string, any>) => {
    setEditBusy(true);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/forms/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId: currentOrgId, submissionId: sub.id, data: changed }),
      });
      const data = await res.json();
      if (!data.success) { alert(data.error || 'Не удалось сохранить'); return; }
      setEditDraft(null);
    } catch (e: any) { alert(`Не удалось сохранить: ${humanError(e)}`); }
    finally { setEditBusy(false); }
  };

  /** Поле ввода по типу поля анкеты: список — вариантами, галочка — галочкой. */
  const fieldInput = (f: any, value: any, onChange: (v: any) => void) => {
    const base = 'w-full px-2.5 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-main)]';
    if (f.type === 'checkbox') {
      return (
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={value === true || String(value) === 'true'} onChange={e => onChange(e.target.checked)} />
          <span>{value === true || String(value) === 'true' ? 'Отмечено' : 'Не отмечено'}</span>
        </label>
      );
    }
    if (f.type === 'select') {
      return (
        <select className={base} value={String(value ?? '')} onChange={e => onChange(e.target.value)}>
          <option value="">— не выбрано —</option>
          {(f.options || []).map((o: string) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (f.type === 'textarea') {
      return <textarea className={base} rows={3} value={String(value ?? '')} onChange={e => onChange(e.target.value)} />;
    }
    return (
      <input className={base}
        type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
        value={String(value ?? '')} onChange={e => onChange(e.target.value)} />
    );
  };

  const askStatusChange = (sub: any, newStatus: string) => {
    if ((sub.status || 'new') === newStatus) return;
    setStatusDraft({ subs: [sub], status: newStatus, note: '', withNote: true });
  };

  const applyStatusChange = async () => {
    if (!statusDraft) return;
    const { subs, status, note, withNote } = statusDraft;
    if (!subs.length) return;

    // Галочка снята — комментарий не спрашиваем вовсе. Она включена, но
    // поле пустое — не даём сохранить: пустой комментарий в истории
    // неотличим от его отсутствия, и человек зря думает, что записал причину.
    if (withNote && !note.trim()) return;

    setStatusBusy(true);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      // Одна заявка — обычная смена статуса; несколько — одной пачкой, с
      // отчётом, какие пропущены и почему.
      const single = subs.length === 1;
      const res = await fetch(single ? '/api/forms/status' : '/api/forms/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(single
          ? { tenantId: currentOrgId, submissionId: subs[0].id, status, note: withNote ? note.trim() : '' }
          : { tenantId: currentOrgId, action: 'status', submissionIds: subs.map((x: any) => x.id), status, note: withNote ? note.trim() : '' }),
      });
      const data = await res.json();
      if (!data.success) { alert(data.error || 'Не удалось сменить статус'); return; }
      setStatusDraft(null);
      if (!single) { reportBulk(data); setSelected(new Set()); }
      // onSnapshot сам подтянет обновление — локально ничего не трогаем.
    } catch(e: any) {
      alert(`Не удалось сменить статус: ${humanError(e)}`);
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

            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              {visibleSubs.length === submissions.filter((x: any) => !x.deleted).length
                ? `${visibleSubs.length}`
                : `${visibleSubs.length} из ${submissions.filter((x: any) => !x.deleted).length}`}
            </span>

            <button
              onClick={() => setShowFilters(v => !v)}
              disabled={!filterFormId}
              title={filterFormId ? 'Отбор по отдельным полям анкеты' : 'Сначала выберите форму'}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition disabled:opacity-40 ${
                activeFilterCount > 0
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600'
                  : 'border-[var(--border-color)] text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/10'
              }`}>
              Фильтры{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>

            {(filterFormId || filterStatus || search || activeFilterCount > 0) && (
              <button onClick={() => { setFilterFormId(''); setFilterStatus(''); setSearch(''); setFieldFilters({}); }}
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

              {/* Таблица дописывается по строке на заявку и со временем
                  расходится со списком: остаются строки удалённых заявок.
                  Проверить глазами сотни строк нельзя — нужна кнопка. */}
              {filterFormId && forms.find(f => f.id === filterFormId)?.sheetId && (
                <button
                  onClick={() => void resyncSheet(filterFormId)}
                  disabled={busySub === filterFormId}
                  title="Переписать таблицу по текущему списку заявок"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[var(--border-color)] text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50">
                  {busySub === filterFormId ? 'Обновляю…' : 'Обновить таблицу'}
                </button>
              )}

              {showDeleted && deletedCount > 0 && (
                <button
                  onClick={() => void purgeAll()}
                  disabled={busySub === 'all'}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-500 disabled:opacity-50">
                  {busySub === 'all' ? 'Стираю…' : `Очистить корзину (${deletedCount})`}
                </button>
              )}
            </div>
          </div>

          {/* Отбор по каждому полю анкеты.
              У каждого типа свой способ спросить: дату — диапазоном,
              галочку — «да/нет», список — его же вариантами. Одно общее
              текстовое поле на всё не отвечает на вопросы вроде «кто подал
              за неделю» или «кто не дал согласия». */}
          {showFilters && filterFormId && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[var(--text-muted)]">Отбор по полям анкеты</span>
                {activeFilterCount > 0 && (
                  <button onClick={() => setFieldFilters({})}
                    className="text-[11px] text-[var(--text-muted)] hover:text-emerald-500">
                    Очистить условия
                  </button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filterableFields.map((f: any) => {
                  const value = fieldFilters[f.id];
                  const set = (v: any) => setFieldFilters(prev => {
                    const next = { ...prev };
                    if (v === '' || v === undefined || v === null) delete next[f.id];
                    else next[f.id] = v;
                    return next;
                  });
                  const base = "w-full px-2.5 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg text-xs";

                  return (
                    <div key={f.id} className="space-y-1">
                      <label className="block text-[11px] font-semibold text-[var(--text-muted)]">{f.label}</label>

                      {f.type === 'daterange' ? (
                        <div className="flex items-center gap-1.5">
                          <input type="date" className={base}
                            value={value?.from || ''}
                            onChange={e => set({ ...(value || {}), from: e.target.value })} />
                          <span className="text-[11px] text-[var(--text-muted)] shrink-0">—</span>
                          <input type="date" className={base}
                            value={value?.to || ''}
                            onChange={e => set({ ...(value || {}), to: e.target.value })} />
                        </div>
                      ) : f.type === 'checkbox' ? (
                        <select className={base} value={value || ''} onChange={e => set(e.target.value)}>
                          <option value="">Не важно</option>
                          <option value="__true">Отмечено</option>
                          <option value="__false">Не отмечено</option>
                        </select>
                      ) : f.type === 'select' ? (
                        <select className={base} value={value || ''} onChange={e => set(e.target.value)}>
                          <option value="">Любой</option>
                          {(f.options || []).map((o: string) => <option key={o} value={o}>{o}</option>)}
                          <option value="__empty">— не выбрано —</option>
                        </select>
                      ) : f.type === 'date' ? (
                        <input type="date" className={base} value={value || ''} onChange={e => set(e.target.value)} />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input type="text" className={base} placeholder="Содержит…"
                            value={value && !String(value).startsWith('__') ? value : ''}
                            onChange={e => set(e.target.value)} />
                          <select
                            className="px-1.5 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg text-[11px] shrink-0"
                            value={String(value || '').startsWith('__') ? value : ''}
                            onChange={e => set(e.target.value)}
                            title="Пусто или заполнено">
                            <option value="">∙</option>
                            <option value="__filled">Заполнено</option>
                            <option value="__empty">Пусто</option>
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 pt-3 border-t border-[var(--border-color)] text-[11px] text-[var(--text-muted)]">
                Подходит заявок: <b className="text-[var(--text-main)]">{visibleSubs.length}</b>
                {activeFilterCount > 0 && ' — кнопка «Скачать» выгрузит именно их'}
              </div>
            </div>
          )}

        {(() => {
          // Только выделенное И видимое: заявки, скрытые фильтром, не
          // должны меняться «втихую».
          const picked = visibleSubs.filter((x: any) => selected.has(x.id) && !x.deleted);
          if (!picked.length) return null;
          const formIds = [...new Set(picked.map((x: any) => x.formId))];
          const oneForm = formIds.length === 1 ? forms.find(f => f.id === formIds[0]) : null;
          return (
            <div className="sticky top-2 z-20 bg-emerald-600 text-white rounded-2xl px-4 py-2.5 flex flex-wrap items-center gap-2 shadow-lg">
              <span className="text-sm font-bold mr-1">Выбрано: {picked.length}</span>
              <button
                onClick={() => setStatusDraft({ subs: picked, status: 'approved', note: '', withNote: false })}
                className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold">
                Сменить статус
              </button>
              <button
                onClick={() => oneForm
                  ? setFieldDraft({ formId: oneForm.id, fieldId: '', value: '' })
                  : alert('Выбраны заявки разных анкет — у них разные поля. Отфильтруйте по одной анкете.')}
                className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold">
                Изменить поле
              </button>
              <button onClick={() => setSelected(new Set())}
                className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-white/15">
                Снять выделение
              </button>
            </div>
          );
        })()}

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
                  <th className="pl-5 pr-1 py-3 w-8">
                    <input type="checkbox" aria-label="Выбрать все видимые"
                      checked={visibleSubs.length > 0 && visibleSubs.every((x: any) => selected.has(x.id))}
                      onChange={e => setSelected(prev => {
                        const next = new Set(prev);
                        visibleSubs.forEach((x: any) => e.target.checked ? next.add(x.id) : next.delete(x.id));
                        return next;
                      })} />
                  </th>
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
                  <tr key={sub.id} className={`transition ${selected.has(sub.id) ? 'bg-emerald-500/5' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                    <td className="pl-5 pr-1 py-3.5 w-8">
                      <input type="checkbox" aria-label="Выбрать заявку"
                        checked={selected.has(sub.id)} onChange={() => toggleSelected(sub.id)} />
                    </td>
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
                      {sub.hasFile && (
                        <button
                          onClick={() => void openDocument(sub)}
                          disabled={busySub === sub.id}
                          className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-lg font-bold text-[11px] inline-flex items-center gap-1.5 transition cursor-pointer mr-2 disabled:opacity-50">
                          📄 Документ
                        </button>
                      )}
                      <button 
                        onClick={() => setSelectedSubmissionForQr(sub)}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 px-3 py-1 rounded-lg font-bold text-[11px] inline-flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" /> QR
                      </button>
                      <button
                        onClick={() => void togglePublic(sub)}
                        disabled={busySub === sub.id}
                        title={sub.publicShown
                          ? 'Показывается на сайте организации — нажмите, чтобы убрать'
                          : 'Показать эту заявку на сайте организации'}
                        className={`ml-2 px-2.5 py-1 rounded-lg font-bold text-[11px] border transition disabled:opacity-50 ${
                          sub.publicShown
                            ? 'bg-sky-500/15 border-sky-500/40 text-sky-600'
                            : 'border-[var(--border-color)] text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/10'
                        }`}>
                        {sub.publicShown ? '◉ На сайте' : '○ На сайт'}
                      </button>
                      {sub.deleted ? (
                        <>
                          <button
                            onClick={() => void removeSubmission(sub, true)}
                            disabled={busySub === sub.id}
                            className="ml-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/30 px-3 py-1 rounded-lg font-bold text-[11px] transition disabled:opacity-50">
                            Вернуть
                          </button>
                          <button
                            onClick={() => void purgeSubmission(sub)}
                            disabled={busySub === sub.id}
                            title="Стереть насовсем"
                            className="ml-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/30 px-3 py-1 rounded-lg font-bold text-[11px] transition disabled:opacity-50">
                            Стереть
                          </button>
                        </>
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

      {/* Массовая правка одного поля у выделенных заявок одной анкеты. */}
      {fieldDraft && (() => {
        const form = forms.find(f => f.id === fieldDraft.formId);
        const fields = (form?.fields || []).filter(editableField);
        const field = fields.find((x: any) => x.id === fieldDraft.fieldId);
        const picked = visibleSubs.filter((x: any) => selected.has(x.id) && !x.deleted && x.formId === fieldDraft.formId);
        return (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !fieldBusy && setFieldDraft(null)}>
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between border-b border-[var(--border-color)] pb-3">
                <div>
                  <h3 className="text-lg font-bold">Изменить поле</h3>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {form?.title || 'Анкета'} · выбрано заявок: {picked.length}
                  </p>
                </div>
                <button onClick={() => setFieldDraft(null)} disabled={fieldBusy}
                  className="p-2 hover:bg-black/10 rounded-xl text-slate-400 disabled:opacity-40">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-muted)]">Поле</label>
                <select
                  value={fieldDraft.fieldId}
                  onChange={e => {
                    const f = fields.find((x: any) => x.id === e.target.value);
                    setFieldDraft({ ...fieldDraft, fieldId: e.target.value, value: f?.type === 'checkbox' ? false : '' });
                  }}
                  className="w-full px-2.5 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg text-sm">
                  <option value="">— выберите поле —</option>
                  {fields.map((f: any) => <option key={f.id} value={f.id}>{f.label || f.id}</option>)}
                </select>
              </div>

              {field && (
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)]">Новое значение для всех</label>
                  {fieldInput(field, fieldDraft.value, v => setFieldDraft({ ...fieldDraft, value: v }))}
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Прежние значения сохранятся в истории каждой заявки.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={() => setFieldDraft(null)} disabled={fieldBusy}
                  className="px-4 py-2 rounded-xl border border-[var(--border-color)] font-bold text-sm disabled:opacity-40">
                  Отмена
                </button>
                <button
                  onClick={() => void applyBulkField(picked)}
                  disabled={fieldBusy || !field}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 disabled:opacity-40 inline-flex items-center gap-2">
                  {fieldBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Изменить у {picked.length}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
                  {statusDraft.subs.length === 1
                    ? `${statusDraft.subs[0].applicantName || 'Без имени'} — ${statusDraft.subs[0].formTitle || 'Заявка'}`
                    : `Выбрано заявок: ${statusDraft.subs.length}`}
                </p>
              </div>
              <button onClick={() => setStatusDraft(null)} disabled={statusBusy}
                className="p-2 hover:bg-black/10 rounded-xl text-slate-400 disabled:opacity-40">
                <X className="w-5 h-5" />
              </button>
            </div>

            {statusDraft.subs.length === 1 ? (
              <div className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[(statusDraft.subs[0].status || 'new') as keyof typeof STATUS_COLOR]}`} />
                <span className="text-[var(--text-muted)]">{STATUS_LABEL[(statusDraft.subs[0].status || 'new') as keyof typeof STATUS_LABEL]}</span>
                <span className="text-[var(--text-muted)]">→</span>
                <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[statusDraft.status as keyof typeof STATUS_COLOR]}`} />
                <span className="font-bold">{STATUS_LABEL[statusDraft.status as keyof typeof STATUS_LABEL]}</span>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-muted)]">Новый статус для всех выбранных</label>
                <select
                  value={statusDraft.status}
                  onChange={e => setStatusDraft({ ...statusDraft, status: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg text-sm">
                  {Object.entries(STATUS_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Заявки, которым этот статус не подходит по анкете, будут пропущены — покажем, какие и почему.
                </p>
              </div>
            )}

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
      {subView && (() => {
        // Окно держит живую версию: после правки или смены статуса снимок
        // приходит через onSnapshot, и окно сразу показывает новое.
        const liveSub = submissions.find(x => x.id === subView.id) || subView;
        const form = forms.find(f => f.id === liveSub.formId);
        const formFields: any[] = form?.fields || [];
        const close = () => { if (!editBusy) { setSubView(null); setEditDraft(null); } };
        return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={close}>
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[var(--border-color)] pb-3">
              <div>
                <h3 className="text-lg font-bold">{liveSub.applicantName || 'Без имени'}</h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {liveSub.formTitle || 'Заявка'}
                  {liveSub.createdAt?.seconds
                    ? ` · ${new Date(liveSub.createdAt.seconds * 1000).toLocaleString('ru-RU')}`
                    : ''}
                </p>
              </div>
              <button onClick={close} className="p-2 hover:bg-black/10 rounded-xl text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[(liveSub.status || 'new') as keyof typeof STATUS_COLOR]}`} />
              <span className="font-bold">{STATUS_LABEL[(liveSub.status || 'new') as keyof typeof STATUS_LABEL]}</span>
              {liveSub.qrToken && <span className="ml-auto font-mono text-[var(--text-muted)]">{liveSub.qrToken}</span>}
            </div>

            {(liveSub.applicantPhone || liveSub.applicantEmail) && (
              <div className="text-xs text-[var(--text-muted)]">
                {[liveSub.applicantPhone, liveSub.applicantEmail].filter(Boolean).join(' · ')}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold text-[var(--text-muted)]">Ответы</div>
              {!liveSub.deleted && formFields.some(editableField) && !editDraft && (
                <button
                  onClick={() => {
                    const draft: Record<string, any> = {};
                    formFields.filter(editableField).forEach(f => { draft[f.id] = liveSub.data?.[f.id] ?? (f.type === 'checkbox' ? false : ''); });
                    setEditDraft(draft);
                  }}
                  className="text-[11px] font-bold text-emerald-600 hover:underline">
                  Изменить ответы
                </button>
              )}
            </div>

            {editDraft ? (
              <div className="space-y-3">
                {formFields.filter(editableField).map(f => (
                  <div key={f.id} className="space-y-1">
                    <label className="block text-[11px] font-semibold text-[var(--text-muted)]">{f.label || f.id}</label>
                    {fieldInput(f, editDraft[f.id], v => setEditDraft({ ...editDraft, [f.id]: v }))}
                  </div>
                ))}
                <p className="text-[11px] text-[var(--text-muted)]">
                  Файлы и фото здесь не меняются. Прежние значения останутся в истории.
                </p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditDraft(null)} disabled={editBusy}
                    className="px-4 py-2 rounded-xl border border-[var(--border-color)] font-bold text-sm disabled:opacity-40">
                    Отмена
                  </button>
                  <button onClick={() => {
                      // Отправляем только изменённое: иначе каждое поле попадёт
                      // в историю как «правка», хотя его никто не трогал.
                      const changed: Record<string, any> = {};
                      Object.entries(editDraft).forEach(([k, v]) => {
                        const before = liveSub.data?.[k];
                        if (String(before ?? '') !== String(v ?? '') && !(before == null && (v === '' || v === false))) changed[k] = v;
                      });
                      if (!Object.keys(changed).length) { setEditDraft(null); return; }
                      void saveEdit(liveSub, changed);
                    }}
                    disabled={editBusy}
                    className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 disabled:opacity-40 inline-flex items-center gap-2">
                    {editBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>Сохранить</span>
                  </button>
                </div>
              </div>
            ) : (
            <div className="space-y-2">
              {(() => {
                const labels = labelsOf(liveSub.formId);
                const entries = Object.entries(liveSub.data || {});
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
            )}

            {(() => {
              // Одна лента: смены статуса (с ответом заявителю) и правки
              // ответов. Новое сверху; у каждой записи — кто и когда.
              const ts = (x: any) => x?.seconds ? x.seconds * 1000 : (typeof x === 'string' ? Date.parse(x) : 0);
              const show = (v: any) => v === true ? 'да' : v === false ? 'нет' : (v == null || v === '' ? '—' : String(v));
              const items = [
                ...(Array.isArray(liveSub.history) ? liveSub.history : []).map((h: any) => ({ kind: 'status', at: ts(h.at), by: h.by, h })),
                ...(Array.isArray(liveSub.changes) ? liveSub.changes : []).map((c: any) => ({ kind: 'field', at: ts(c.at), by: c.by, c })),
              ].sort((a, b) => b.at - a.at);
              if (!items.length) return null;
              return (
                <div className="pt-2 space-y-1.5">
                  <div className="text-[11px] font-semibold text-[var(--text-muted)]">История изменений</div>
                  {items.map((it, i) => (
                    <div key={i} className="text-[11px] border-l-2 border-[var(--border-color)] pl-2 py-0.5">
                      <div className="flex items-center justify-between gap-2">
                        {it.kind === 'status' ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLOR[it.h.status as keyof typeof STATUS_COLOR] || 'bg-slate-400'}`} />
                            <span className="font-semibold">{STATUS_LABEL[it.h.status as keyof typeof STATUS_LABEL] || it.h.status}</span>
                          </span>
                        ) : (
                          <span className="min-w-0">
                            <span className="font-semibold">{it.c.label || it.c.field}:</span>{' '}
                            <span className="text-[var(--text-muted)] line-through break-words">{show(it.c.from)}</span>
                            {' → '}<span className="break-words">{show(it.c.to)}</span>
                          </span>
                        )}
                        <span className="text-[var(--text-muted)] font-mono shrink-0">
                          {it.at ? new Date(it.at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                        </span>
                      </div>
                      {it.kind === 'status' && it.h.note && (
                        <div className="text-[var(--text-main)] whitespace-pre-wrap break-words mt-0.5">Ответ заявителю: {it.h.note}</div>
                      )}
                      {it.by && <div className="text-[var(--text-muted)]">{it.by}</div>}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      );
      })()}

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
