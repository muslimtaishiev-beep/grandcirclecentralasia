import { useEffect, useState } from "react";
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
    });
  }, [tenant?.id, tenant?.workspaceConfig]);

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
    });
  };

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
