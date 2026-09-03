import { useEffect, useState } from "react";
import { sanitizeLegal, type LegalProfile } from "../../../shared/legal";
import { useOutletContext } from "react-router-dom";
import { Sparkles, Check, Loader2, RotateCcw } from "lucide-react";
import { auth } from "../../../lib/firebase";
import {
  ACTIVITY_PRESETS, DEFAULT_WORKSPACE_CONFIG, resolveWorkspaceConfig,
  type WorkspaceConfig,
} from "../../../shared/workspaceConfig";
import { resolvePermissions } from "../../../shared/permissions";

/**
 * Настройки воркспейса — отдельный экран, полная версия быстрой настройки.
 *
 * Мастер при первом входе даёт три шага и уходит; сюда владелец возвращается,
 * когда нужно поменять формулировки или правила. Всё на одной странице: вид
 * деятельности, терминология, дашборд, расписание.
 *
 * Организации без сохранённого конфига видят прежние тексты — поля показывают
 * их как подсказки, а не как введённые значения, чтобы было ясно: пока
 * действует умолчание.
 */
export default function WorkspaceSetupPage() {
  const ctx = useOutletContext<{ activeTenant?: any; refreshTenants?: () => void } | null>();
  const tenant = ctx?.activeTenant;

  const [cfg, setCfg] = useState<WorkspaceConfig>({});
  // Реквизиты для справок, сертификатов и шаблонов документов.
  const [legal, setLegal] = useState<LegalProfile>({ legalName: "" });
  const [legalSaving, setLegalSaving] = useState(false);
  const [legalNotice, setLegalNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant) return;
    const raw = (tenant.workspaceConfig || {}) as WorkspaceConfig;
    setCfg({
      activityType: raw.activityType || "",
      dashboardTitle: raw.dashboardTitle || "",
      dashboardSubtitle: raw.dashboardSubtitle || "",
      terms: { ...(raw.terms || {}) },
      schedule: { ...(raw.schedule || {}) },
      registration: { ...(raw.registration || {}) },
      tickets: { ...(raw.tickets || {}) },
      email: { ...(raw.email || {}) },
      landing: { ...(raw.landing || {}) },
    });
  }, [tenant?.id, tenant?.workspaceConfig]);
  useEffect(() => {
    if (!tenant) return;
    setLegal({ legalName: "", ...sanitizeLegal(tenant.legal) });
  }, [tenant?.id, tenant?.legal]);

  const saveLegal = async () => {
    setLegalSaving(true); setError(null); setLegalNotice(null);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
      const res = await fetch(`/api/tenants/${tenant.id}/legal`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ legal }),
      });
      const j = await res.json();
      if (!j.success) { setError(j.error || "Не удалось сохранить реквизиты."); return; }
      setLegalNotice("Реквизиты сохранены — справки и сертификаты будут печататься с ними.");
      setTimeout(() => setLegalNotice(null), 6000);
      ctx?.refreshTenants?.();
    } catch { setError("Нет связи с сервером"); }
    finally { setLegalSaving(false); }
  };
  const setL = (k: keyof LegalProfile, v: string) => setLegal(p => ({ ...p, [k]: v }));

  // Право, а не название должности: владелец может выдать настройку
  // организации кому угодно, и это должно работать.
  const canEdit = (() => {
    const granted = Array.isArray(tenant?.effectivePermissions)
      ? new Set(tenant.effectivePermissions)
      : resolvePermissions({
          role: tenant?.role, permissions: tenant?.permissions,
          customPermissions: tenant?.customPermissions,
          rolePermissions: tenant?.customRole?.permissions,
          disabledModules: tenant?.disabledModules,
        });
    return granted.has("settings:manage" as any) || granted.has("team:manage" as any);
  })();
  const resolved = resolveWorkspaceConfig(tenant?.workspaceConfig);

  const set = (patch: Partial<WorkspaceConfig>) => setCfg(p => ({ ...p, ...patch }));
  const setTerm = (k: string, v: string) => setCfg(p => ({ ...p, terms: { ...(p.terms || {}), [k]: v } }));

  const save = async () => {
    setSaving(true); setError(null); setNotice(null);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
      const res = await fetch(`/api/tenants/${tenant.id}/workspace-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ config: cfg }),
      });
      const j = await res.json();
      if (!j.success) { setError(j.error || "Не удалось сохранить."); return; }
      setNotice("Настройки сохранены. Экраны обновятся после перезагрузки страницы.");
      setTimeout(() => setNotice(null), 6000);
      ctx?.refreshTenants?.();
    } catch {
      setError("Нет связи с сервером.");
    } finally { setSaving(false); }
  };

  const resetToDefaults = () => {
    if (!confirm("Вернуть стандартные формулировки образовательной организации?")) return;
    setCfg({
      activityType: DEFAULT_WORKSPACE_CONFIG.activityType,
      dashboardTitle: DEFAULT_WORKSPACE_CONFIG.dashboardTitle,
      dashboardSubtitle: DEFAULT_WORKSPACE_CONFIG.dashboardSubtitle,
      terms: { ...DEFAULT_WORKSPACE_CONFIG.terms },
      schedule: { ...DEFAULT_WORKSPACE_CONFIG.schedule },
      registration: {},
      tickets: {},
      email: {},
      landing: {},
    });
  };
  const setEm = (patch: Record<string, any>) => setCfg(p => ({ ...p, email: { ...(p.email || {}), ...patch } }));
  const setLd = (patch: Record<string, any>) => setCfg(p => ({ ...p, landing: { ...(p.landing || {}), ...patch } }));
  const setReg = (patch: Record<string, any>) => setCfg(p => ({ ...p, registration: { ...(p.registration || {}), ...patch } }));
  const setRegField = (key: "name" | "phone" | "email" | "grade", patch: Record<string, any>) => setCfg(p => {
    const cur = Array.isArray(p.registration?.fields) ? p.registration!.fields! : [];
    const rest = cur.filter(f => f.key !== key);
    const mine = cur.find(f => f.key === key) || { key };
    return { ...p, registration: { ...(p.registration || {}), fields: [...rest, { ...mine, ...patch }] } };
  });
  const regField = (key: "name" | "phone" | "email" | "grade") =>
    (cfg.registration?.fields || []).find(f => f.key === key) || {};
  const setTk = (patch: Record<string, any>) => setCfg(p => ({ ...p, tickets: { ...(p.tickets || {}), ...patch } }));

  const input = "w-full px-3 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-sm";
  const termFields: { key: string; label: string; hint: string; where: string }[] = [
    { key: "teacher", label: "Кто ведёт занятия", hint: "Преподаватель / Тренер / Ведущий", where: "расписание, зарплаты" },
    { key: "room", label: "Где проходят занятия", hint: "Кабинет / Зал / Площадка", where: "расписание" },
    { key: "student", label: "Кого вы обслуживаете", hint: "Ученик / Клиент / Участник", where: "CRM, журнал, абонементы" },
    { key: "group", label: "Как объединяете людей", hint: "Класс / Группа / Поток", where: "расписание, тесты" },
    { key: "lesson", label: "Единица занятия", hint: "Урок / Занятие / Тренировка", where: "расписание, зарплаты" },
    { key: "subscription", label: "Что покупают", hint: "Абонемент / Пакет / Членство", where: "абонементы" },
  ];

  if (!tenant) {
    return <div className="py-16 text-center text-[var(--text-muted)] text-sm">Загрузка организации…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 text-[var(--text-main)]">
      <div className="border-b border-[var(--border-color)] pb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-emerald-500" />
          Настройка воркспейса
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {tenant.name} · как называются вещи на экранах и какие поля обязательны
        </p>
      </div>

      {!canEdit && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-amber-600">
          Менять настройки может владелец или администратор организации. Ниже — текущие значения.
        </div>
      )}

      {/* Вид деятельности */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 space-y-3">
        <h2 className="font-bold text-sm">Вид деятельности</h2>
        <p className="text-xs text-[var(--text-muted)]">
          Пресет заполняет всё остальное разом — потом можно поправить любое поле.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ACTIVITY_PRESETS.map(p => (
            <button key={p.key} disabled={!canEdit}
              onClick={() => set({ ...p.config })}
              className={`p-3 rounded-xl border text-left text-xs font-semibold transition disabled:opacity-50 ${
                cfg.activityType === p.config.activityType
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                  : "border-[var(--border-color)] hover:border-emerald-500/40"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <input value={cfg.activityType || ""} disabled={!canEdit}
          onChange={e => set({ activityType: e.target.value })}
          placeholder={resolved.activityType} className={input} />
      </section>

      {/* Терминология */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 space-y-3">
        <h2 className="font-bold text-sm">Терминология</h2>
        <p className="text-xs text-[var(--text-muted)]">
          Эти слова подставляются в подписи полей и заголовки. Пустое поле — значит используется значение по умолчанию.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {termFields.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                {f.label}
                <span className="font-normal opacity-70"> · {f.where}</span>
              </label>
              <input value={(cfg.terms as any)?.[f.key] || ""} disabled={!canEdit}
                onChange={e => setTerm(f.key, e.target.value)}
                placeholder={(resolved.terms as any)[f.key]} className={input} />
            </div>
          ))}
        </div>
      </section>

      {/* Дашборд */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 space-y-3">
        <h2 className="font-bold text-sm">Главный экран</h2>
        <div>
          <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Заголовок</label>
          <input value={cfg.dashboardTitle || ""} disabled={!canEdit}
            onChange={e => set({ dashboardTitle: e.target.value })}
            placeholder={resolved.dashboardTitle} className={input} />
        </div>
        <div>
          <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Подзаголовок</label>
          <input value={cfg.dashboardSubtitle || ""} disabled={!canEdit}
            onChange={e => set({ dashboardSubtitle: e.target.value })}
            placeholder={resolved.dashboardSubtitle} className={input} />
        </div>
      </section>

      {/* Анкета регистрации на экзамен */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 space-y-3" data-testid="registration-section">
        <h2 className="font-bold text-sm">Анкета регистрации на экзамен</h2>
        <p className="text-xs text-[var(--text-muted)]">
          Что спрашивать у участника перед стартом, как подписать поля и какие варианты класса или уровня
          предлагать. Пустое поле — значение по умолчанию.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input value={cfg.registration?.title || ""} disabled={!canEdit} onChange={e => setReg({ title: e.target.value })}
            placeholder={`Заголовок: ${resolved.registration.title}`} className={input} data-testid="reg-title" />
          <input value={cfg.registration?.startButtonLabel || ""} disabled={!canEdit} onChange={e => setReg({ startButtonLabel: e.target.value })}
            placeholder={`Кнопка: ${resolved.registration.startButtonLabel}`} className={input} />
          <input value={cfg.registration?.subtitle || ""} disabled={!canEdit} onChange={e => setReg({ subtitle: e.target.value })}
            placeholder="Подзаголовок (по умолчанию — название организации)" className={`${input} sm:col-span-2`} />
        </div>
        <div className="space-y-2">
          {([["name", "Имя"], ["phone", "Телефон"], ["email", "E-mail"], ["grade", "Класс / уровень"]] as const).map(([key, title]) => {
            const f = regField(key) as any;
            const def = resolved.registration.fields.find(x => x.key === key)!;
            return (
              <div key={key} className="grid sm:grid-cols-[110px_1fr_1fr_auto_auto] gap-2 items-center">
                <span className="text-xs font-bold text-[var(--text-muted)]">{title}</span>
                <input value={f.label || ""} disabled={!canEdit} onChange={e => setRegField(key, { label: e.target.value })}
                  placeholder={`Подпись: ${def.label}`} className={input} data-testid={`reg-${key}-label`} />
                <input value={f.placeholder || ""} disabled={!canEdit} onChange={e => setRegField(key, { placeholder: e.target.value })}
                  placeholder={`Подсказка: ${def.placeholder || "—"}`} className={input} />
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" disabled={!canEdit} checked={f.visible !== false}
                    onChange={e => setRegField(key, { visible: e.target.checked })} /> показывать
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" disabled={!canEdit} checked={f.required !== false}
                    onChange={e => setRegField(key, { required: e.target.checked })} /> обязательно
                </label>
              </div>
            );
          })}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <input value={(cfg.registration?.gradeOptions || []).join(", ")} disabled={!canEdit}
            onChange={e => setReg({ gradeOptions: e.target.value.split(",").map(v => v.trim()).filter(Boolean) })}
            placeholder={`Варианты через запятую: ${resolved.registration.gradeOptions.join(", ")}`} className={input} data-testid="reg-grades" />
          <input value={cfg.registration?.gradeSuffix ?? ""} disabled={!canEdit} onChange={e => setReg({ gradeSuffix: e.target.value })}
            placeholder={`Слово после варианта: ${resolved.registration.gradeSuffix || "—"}`} className={input} />
          <input value={cfg.registration?.pinAuthority || ""} disabled={!canEdit} onChange={e => setReg({ pinAuthority: e.target.value })}
            placeholder={`Кто называет PIN: ${resolved.registration.pinAuthority}`} className={input} />
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" disabled={!canEdit} checked={cfg.registration?.pinRequired !== false}
                onChange={e => setReg({ pinRequired: e.target.checked })} /> Требовать PIN аудитории
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" disabled={!canEdit} checked={cfg.registration?.requireFullName !== false}
                onChange={e => setReg({ requireFullName: e.target.checked })} /> Имя и фамилия
            </label>
          </div>
        </div>
        <textarea value={cfg.registration?.consentText || ""} disabled={!canEdit} rows={3}
          onChange={e => setReg({ consentText: e.target.value })}
          placeholder="Текст согласия на обработку данных (пусто — стандартный)" className={input} />
      </section>

      {/* Заявки и билеты */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 space-y-3" data-testid="tickets-section">
        <h2 className="font-bold text-sm">Заявки и билеты</h2>
        <p className="text-xs text-[var(--text-muted)]">
          Тексты публичных страниц: форма заявки, страница билета у гостя, экран проверки на входе.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {([
            ["publicTitle", "Заголовок публичных страниц (по умолчанию — название организации)"],
            ["ticketWord", `Как называть билет: ${resolved.tickets.ticketWord}`],
            ["submitButtonLabel", `Кнопка отправки: ${resolved.tickets.submitButtonLabel}`],
            ["successTitle", `Заголовок после отправки: ${resolved.tickets.successTitle}`],
            ["closedTitle", `Заголовок, когда приём закрыт: ${resolved.tickets.closedTitle}`],
            ["checkinOkText", `Надпись на входе при успехе: ${resolved.tickets.checkinOkText}`],
            ["supportPhone", "Телефон для вопросов гостей"],
          ] as const).map(([key, ph]) => (
            <input key={key} value={(cfg.tickets as any)?.[key] || ""} disabled={!canEdit}
              onChange={e => setTk({ [key]: e.target.value })} placeholder={ph} className={input} data-testid={`tk-${key}`} />
          ))}
          <textarea value={cfg.tickets?.closedMessage || ""} disabled={!canEdit} rows={2}
            onChange={e => setTk({ closedMessage: e.target.value })}
            placeholder={`Текст, когда приём закрыт: ${resolved.tickets.closedMessage}`} className={`${input} sm:col-span-2`} />
          <textarea value={cfg.tickets?.successMessage || ""} disabled={!canEdit} rows={2}
            onChange={e => setTk({ successMessage: e.target.value })}
            placeholder="Текст после отправки заявки (пусто — стандартный)" className={`${input} sm:col-span-2`} />
        </div>
      </section>

      {/* Письма */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 space-y-3" data-testid="email-section">
        <h2 className="font-bold text-sm">Письма от имени организации</h2>
        <p className="text-xs text-[var(--text-muted)]">
          Результаты тестов и приглашения сотрудникам уходят с этим именем отправителя. Ответы участников
          придут на указанный адрес.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input value={cfg.email?.fromName || ""} disabled={!canEdit} onChange={e => setEm({ fromName: e.target.value })}
            placeholder={`Имя отправителя (по умолчанию — ${tenant?.name || "название организации"})`} className={input} data-testid="em-fromName" />
          <input value={cfg.email?.replyTo || ""} disabled={!canEdit} onChange={e => setEm({ replyTo: e.target.value })}
            placeholder="Адрес для ответов: info@example.com" className={input} data-testid="em-replyTo" />
          <textarea value={cfg.email?.signature || ""} disabled={!canEdit} rows={2} onChange={e => setEm({ signature: e.target.value })}
            placeholder="Подпись внизу письма: контакты, часы работы" className={`${input} sm:col-span-2`} />
        </div>
      </section>

      {/* Лендинг */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 space-y-3" data-testid="landing-section">
        <h2 className="font-bold text-sm">Публичная страница приёма</h2>
        <p className="text-xs text-[var(--text-muted)]">
          Страница /{tenant?.id}/admission: бейдж, подзаголовок под названием организации и подписи кнопок.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input value={cfg.landing?.badge || ""} disabled={!canEdit} onChange={e => setLd({ badge: e.target.value })}
            placeholder={`Бейдж: ${resolved.landing.badge}`} className={input} data-testid="ld-badge" />
          <input value={cfg.landing?.primaryCtaLabel || ""} disabled={!canEdit} onChange={e => setLd({ primaryCtaLabel: e.target.value })}
            placeholder={`Кнопка результатов: ${resolved.landing.primaryCtaLabel}`} className={input} />
          <input value={cfg.landing?.secondaryCtaLabel || ""} disabled={!canEdit} onChange={e => setLd({ secondaryCtaLabel: e.target.value })}
            placeholder={`Кнопка входа в тест: ${resolved.landing.secondaryCtaLabel}`} className={input} />
          <textarea value={cfg.landing?.subtitle || ""} disabled={!canEdit} rows={2} onChange={e => setLd({ subtitle: e.target.value })}
            placeholder={`Подзаголовок: ${resolved.landing.subtitle}`} className={`${input} sm:col-span-2`} />
        </div>
      </section>

      {/* Расписание */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 space-y-3">
        <h2 className="font-bold text-sm">Расписание</h2>
        <p className="text-xs text-[var(--text-muted)]">
          Какие поля обязательны при создании занятия. У кого нет кабинетов или
          постоянных ведущих — снимите галочку, иначе занятие не сохранить.
        </p>
        {([
          ["requireTeacher", `Обязательно указывать: ${cfg.terms?.teacher || resolved.terms.teacher}`],
          ["requireRoom", `Обязательно указывать: ${cfg.terms?.room || resolved.terms.room}`],
        ] as const).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input type="checkbox" disabled={!canEdit}
              checked={(cfg.schedule as any)?.[key] !== false}
              onChange={e => set({ schedule: { ...(cfg.schedule || {}), [key]: e.target.checked } })} />
            {label}
          </label>
        ))}
      </section>

      {/* Реквизиты */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 space-y-3" data-testid="legal-section">
        <h2 className="font-bold text-sm">Реквизиты для справок и сертификатов</h2>
        <p className="text-xs text-[var(--text-muted)]">
          Печатаются на справках, сертификатах среза и в шаблонах документов. Пока их нет,
          документы выходят только с названием организации — без печати и адреса.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {([
            ["legalName", "Официальное название", "ОсОО «Название»"],
            ["nameKg", "Название на втором языке", ""],
            ["city", "Город", "Бишкек"],
            ["phone", "Телефон", "+996 …"],
            ["address", "Адрес", "720000, г. …, ул. …"],
            ["addressKg", "Адрес на втором языке", ""],
            ["inn", "ИНН", ""],
            ["license", "Лицензия", "№ … от …"],
            ["signatoryTitle", "Должность подписанта", "Директор"],
            ["signatoryName", "ФИО подписанта", ""],
            ["stampUrl", "Печать (ссылка на изображение)", "https://… или /stamp.png"],
            ["logoUrl", "Логотип (ссылка)", "https://…"],
            ["signatureUrl", "Факсимиле подписи (ссылка)", "https://…"],
            ["stampColor", "Цвет штампа", "#0C3674"],
          ] as const).map(([key, label, ph]) => (
            <label key={key} className="block">
              <span className="block text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1">{label}</span>
              <input value={(legal as any)[key] || ""} onChange={e => setL(key, e.target.value)} disabled={!canEdit}
                placeholder={ph} data-testid={`legal-${key}`}
                className="w-full px-3 py-2 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-sm" />
            </label>
          ))}
        </div>
        {legalNotice && <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm text-emerald-600">{legalNotice}</div>}
        {canEdit && (
          <button onClick={() => void saveLegal()} disabled={legalSaving || !legal.legalName.trim()} data-testid="legal-save"
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50">
            {legalSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Сохранить реквизиты
          </button>
        )}
      </section>

      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-500">{error}</div>}
      {notice && <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm text-emerald-600">{notice}</div>}

      {canEdit && (
        <div className="flex items-center justify-between gap-3 pb-8">
          <button onClick={resetToDefaults}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> Вернуть стандартные
          </button>
          <button onClick={() => void save()} disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Сохранить
          </button>
        </div>
      )}
    </div>
  );
}
