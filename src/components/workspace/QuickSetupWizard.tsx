import { useState } from "react";
import { Sparkles, ArrowRight, ArrowLeft, Check, Loader2 } from "lucide-react";
import { auth } from "../../lib/firebase";
import {
  ACTIVITY_PRESETS, DEFAULT_WORKSPACE_CONFIG, resolveWorkspaceConfig,
  type WorkspaceConfig,
} from "../../shared/workspaceConfig";

/**
 * Быстрая настройка воркспейса — первый экран владельца новой организации.
 *
 * Компании устроены по-разному, а экраны говорили со всеми словами академии:
 * «Панель Управления Академией», «Преподаватель», обязательный «Кабинет» в
 * расписании. Здесь владелец за три шага описывает свой вид деятельности, и
 * названия с полями подстраиваются. Пропустить можно — тогда остаются
 * значения по умолчанию, и мастер больше не навязывается.
 */
export default function QuickSetupWizard({
  tenant, onDone,
}: { tenant: any; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cfg, setCfg] = useState<WorkspaceConfig>(() => ({
    ...resolveWorkspaceConfig(tenant?.workspaceConfig),
    dashboardTitle: tenant?.workspaceConfig?.dashboardTitle || "",
    dashboardSubtitle: tenant?.workspaceConfig?.dashboardSubtitle || "",
  }));

  const set = (patch: Partial<WorkspaceConfig>) => setCfg(p => ({ ...p, ...patch }));
  const setTerm = (k: string, v: string) =>
    setCfg(p => ({ ...p, terms: { ...(p.terms || {}), [k]: v } }));

  const save = async (skip = false) => {
    setSaving(true); setError(null);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
      const res = await fetch(`/api/tenants/${tenant.id}/workspace-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        // Пропуск — это тоже решение: сохраняем дефолты, чтобы мастер не
        // выскакивал при каждом входе.
        body: JSON.stringify({ config: skip ? { ...DEFAULT_WORKSPACE_CONFIG } : cfg }),
      });
      const j = await res.json();
      if (!j.success) { setError(j.error || "Не удалось сохранить."); return; }
      onDone();
    } catch {
      setError("Нет связи с сервером.");
    } finally { setSaving(false); }
  };

  const input = "w-full px-3 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-sm";
  const termFields: { key: keyof NonNullable<WorkspaceConfig["terms"]>; label: string; hint: string }[] = [
    { key: "teacher", label: "Кто ведёт занятия", hint: "Преподаватель / Тренер / Ведущий" },
    { key: "room", label: "Где проходят занятия", hint: "Кабинет / Зал / Площадка" },
    { key: "student", label: "Кого вы обслуживаете", hint: "Ученик / Клиент / Участник" },
    { key: "group", label: "Как объединяете людей", hint: "Класс / Группа / Поток" },
  ];

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-[var(--text-main)]">Быстрая настройка</h2>
            <p className="text-xs text-[var(--text-muted)] truncate">
              {tenant?.name} · шаг {step + 1} из 3
            </p>
          </div>
        </div>

        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-muted)]">
              Чем занимается ваша организация? Экраны подстроятся под ответ —
              всё можно уточнить на следующих шагах.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ACTIVITY_PRESETS.map(p => (
                <button key={p.key}
                  onClick={() => set({ ...p.config })}
                  className={`p-3 rounded-xl border text-left text-sm font-semibold transition ${
                    cfg.activityType === p.config.activityType
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                      : "border-[var(--border-color)] text-[var(--text-main)] hover:border-emerald-500/40"}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <input value={cfg.activityType || ""} onChange={e => set({ activityType: e.target.value })}
              placeholder="Или своими словами: языковая школа, детский лагерь…" className={input} />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-muted)]">
              Как это называется у вас? Эти слова появятся в расписании,
              журнале и на других экранах.
            </p>
            {termFields.map(f => (
              <div key={f.key}>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">{f.label}</label>
                <input value={cfg.terms?.[f.key] || ""} onChange={e => setTerm(f.key, e.target.value)}
                  placeholder={f.hint} className={input} />
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-muted)]">
              Заголовок главного экрана и правила расписания.
            </p>
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Заголовок дашборда</label>
              <input value={cfg.dashboardTitle || ""} onChange={e => set({ dashboardTitle: e.target.value })}
                placeholder={DEFAULT_WORKSPACE_CONFIG.dashboardTitle} className={input} />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Подзаголовок</label>
              <input value={cfg.dashboardSubtitle || ""} onChange={e => set({ dashboardSubtitle: e.target.value })}
                placeholder="Коротко о том, что здесь видно" className={input} />
            </div>
            <div className="space-y-2 pt-1">
              {([
                ["requireTeacher", `Занятие обязано иметь: ${cfg.terms?.teacher || "Преподаватель"}`],
                ["requireRoom", `Занятие обязано иметь: ${cfg.terms?.room || "Кабинет"}`],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2.5 text-sm text-[var(--text-main)] cursor-pointer">
                  <input type="checkbox"
                    checked={cfg.schedule?.[key] !== false}
                    onChange={e => set({ schedule: { ...(cfg.schedule || {}), [key]: e.target.checked } })} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <div className="text-xs text-red-500 font-semibold">{error}</div>}

        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)]">
          <button onClick={() => void save(true)} disabled={saving}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)]">
            Пропустить — настрою позже
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} disabled={saving}
                className="px-4 py-2 rounded-xl border border-[var(--border-color)] text-sm font-bold text-[var(--text-main)]">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            {step < 2 ? (
              <button onClick={() => setStep(s => s + 1)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-1.5">
                Дальше <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={() => void save(false)} disabled={saving}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Готово
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
