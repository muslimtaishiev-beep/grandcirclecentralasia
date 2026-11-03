import React, { useEffect, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { DIFFICULTY_LABEL, type Difficulty } from "../../../shared/exams";
import { type Exam, type ExamSection, type ExamSettings, type ScaleBand } from "../../../shared/examRun";
import { btn, btnPrimary, card, input, label } from "../journals/components/ui";
import type { Api, DisciplineRow } from "./examApi";

type Plan = { pool: number; have: Record<Difficulty, number>; want: number; short: { difficulty: Difficulty; need: number; have: number }[] };

/**
 * Конструктор экзамена: дисциплины из банка и все настройки, которые раньше
 * были зашиты в «Тесты» и «Срез», — каждая включается для этого экзамена.
 */
export default function ExamSettingsTab({ exam, api, bankApi, canEdit, onSaved }: {
  exam: Exam; api: Api; bankApi: Api; canEdit: boolean; onSaved: (e: Exam) => void;
}) {
  const [title, setTitle] = useState(exam.title);
  const [description, setDescription] = useState(exam.description);
  const [group, setGroup] = useState(exam.group);
  const [sections, setSections] = useState<ExamSection[]>(exam.sections);
  const [st, setSt] = useState<ExamSettings>(exam.settings);
  const [disciplines, setDisciplines] = useState<DisciplineRow[]>([]);
  const [plans, setPlans] = useState<Record<string, Plan>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => { bankApi("/disciplines").then(j => setDisciplines(j.disciplines)).catch(() => {}); }, [bankApi]);
  // Сколько вопросов найдётся под каждый раздел — пересчёт при правке.
  useEffect(() => {
    const t = setTimeout(() => { api(`/exams/${exam.id}/plan`, { method: "POST", body: JSON.stringify({ sections }) }).then(j => setPlans(j.plans)).catch(() => {}); }, 400);
    return () => clearTimeout(t);
  }, [api, exam.id, sections]);

  const dirty = JSON.stringify({ title, description, group, sections, st }) !== JSON.stringify({ title: exam.title, description: exam.description, group: exam.group, sections: exam.sections, st: exam.settings });
  const set = <K extends keyof ExamSettings>(k: K, p: Partial<ExamSettings[K]>) => setSt(s => ({ ...s, [k]: { ...s[k], ...p } }));
  const upd = (i: number, p: Partial<ExamSection>) => setSections(xs => xs.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const move = (i: number, d: number) => setSections(xs => { const n = [...xs]; const j = i + d; if (j < 0 || j >= n.length) return xs; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const addSection = () => {
    const d = disciplines.find(x => !sections.some(s => s.disciplineId === x.code)) || disciplines[0];
    if (!d) return;
    setSections(xs => [...xs, { id: `s${Date.now().toString(36)}`, disciplineId: d.code, title: d.name, minutes: 30, mode: "all", levels: [], counts: { 1: 0, 2: 0, 3: 0 }, shuffle: false }]);
  };

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const j = await api(`/exams/${exam.id}`, { method: "PUT", body: JSON.stringify({ title, description, group, sections, settings: st }) });
      setSections(j.exam.sections); setSt(j.exam.settings); onSaved(j.exam);
      setNotice("Сохранено"); setTimeout(() => setNotice(null), 2500);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const totalMinutes = sections.reduce((n, s) => n + s.minutes, 0);
  const totalQuestions = sections.reduce((n, s) => n + (plans[s.id]?.want ?? 0), 0);
  const toLocal = (ms: number | null) => (ms ? new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
  const fromLocal = (v: string) => (v ? new Date(v).getTime() : null);
  const Check = ({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) => (
    <label className="flex items-start gap-2 text-sm text-[var(--text-main)]"><input type="checkbox" className="mt-1" checked={checked} onChange={e => onChange(e.target.checked)} /> <span>{children}</span></label>
  );

  return (
    <fieldset disabled={!canEdit} className="space-y-4 pb-24">
      <section className={`${card} p-4 grid sm:grid-cols-3 gap-3`}>
        <div className="sm:col-span-2"><span className={label}>Название</span><input className={input} value={title} onChange={e => setTitle(e.target.value)} /></div>
        <div><span className={label}>Папка</span><input className={input} value={group} onChange={e => setGroup(e.target.value)} placeholder="Вступительные 2027" /></div>
        <div className="sm:col-span-3"><span className={label}>Описание для ученика</span><textarea rows={2} className={input} value={description} onChange={e => setDescription(e.target.value)} placeholder="Что взять с собой, сколько длится, правила" /></div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h3 className="font-bold text-[var(--text-main)]">Дисциплины</h3>
            <p className="text-xs text-[var(--text-muted)]">Идут по порядку, у каждой свой таймер. Всего: {totalMinutes} мин, {totalQuestions} вопросов.</p>
          </div>
          <button className={btn} onClick={addSection} disabled={!disciplines.length}><Plus className="w-4 h-4" /> Дисциплина</button>
        </div>
        {!sections.length && <div className={`${card} p-6 text-sm text-[var(--text-muted)] text-center`}>Добавьте дисциплины из банка вопросов.</div>}
        {sections.map((s, i) => {
          const disc = disciplines.find(d => d.code === s.disciplineId);
          const plan = plans[s.id];
          return (
            <div key={s.id} className={`${card} p-4 space-y-3`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[var(--text-muted)] w-5">{i + 1}.</span>
                <select className={`${input} !w-auto`} value={s.disciplineId} onChange={e => { const d = disciplines.find(x => x.code === e.target.value); upd(i, { disciplineId: e.target.value, title: d?.name || s.title, levels: [] }); }}>
                  {disciplines.map(d => <option key={d.code} value={d.code}>{d.code} · {d.name}</option>)}
                </select>
                <input className={`${input} flex-1 min-w-[160px]`} value={s.title} onChange={e => upd(i, { title: e.target.value })} placeholder="Название раздела для ученика" />
                <div className="flex items-center gap-1"><input type="number" min={1} className={`${input} !w-20`} value={s.minutes} onChange={e => upd(i, { minutes: Number(e.target.value) || 1 })} /><span className="text-xs text-[var(--text-muted)]">мин</span></div>
                <button className={btn} onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="w-4 h-4" /></button>
                <button className={btn} onClick={() => move(i, 1)} disabled={i === sections.length - 1}><ArrowDown className="w-4 h-4" /></button>
                <button className={btn} onClick={() => setSections(xs => xs.filter((_, k) => k !== i))}><Trash2 className="w-4 h-4 text-rose-600" /></button>
              </div>
              {disc && disc.levels.length > 0 && (
                <div>
                  <span className={label}>Классы (уровни) вопросов</span>
                  <div className="flex flex-wrap gap-1.5">
                    {disc.levels.map(l => {
                      const on = s.levels.includes(l);
                      return <button key={l} type="button" onClick={() => upd(i, { levels: on ? s.levels.filter(x => x !== l) : [...s.levels, l] })}
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${on ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border-color)] text-[var(--text-main)]"}`}>{l}</button>;
                    })}
                    <span className="text-[11px] text-[var(--text-muted)] self-center ml-1">{s.levels.length ? "" : "не выбрано — все классы"}</span>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={s.mode === "all"} onChange={() => upd(i, { mode: "all" })} /> Все вопросы по порядку (фиксированный тест)</label>
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={s.mode === "random"} onChange={() => upd(i, { mode: "random" })} /> Случайный вариант по сложности</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.shuffle} onChange={e => upd(i, { shuffle: e.target.checked })} /> Перемешать порядок</label>
              </div>
              {s.mode === "random" && (
                <div className="grid grid-cols-3 gap-2 max-w-md">
                  {([1, 2, 3] as Difficulty[]).map(d => (
                    <div key={d}>
                      <span className={label}>{DIFFICULTY_LABEL[d]}</span>
                      <input type="number" min={0} className={input} value={s.counts[d]} onChange={e => upd(i, { counts: { ...s.counts, [d]: Math.max(0, Number(e.target.value) || 0) } })} />
                      <div className="text-[11px] text-[var(--text-muted)] mt-0.5">в банке: {plan?.have[d] ?? "…"}</div>
                    </div>
                  ))}
                </div>
              )}
              {plan && (
                <div className={`text-xs ${plan.pool === 0 || plan.short.length ? "text-amber-700" : "text-[var(--text-muted)]"}`}>
                  {plan.pool === 0 ? <><AlertTriangle className="inline w-3.5 h-3.5 -mt-0.5" /> Нет активных вопросов под эти условия</>
                    : <>Ученик получит {plan.want} вопр. из {plan.pool} подходящих{plan.short.map(x => ` · не хватает «${DIFFICULTY_LABEL[x.difficulty].toLowerCase()}»: нужно ${x.need}, есть ${x.have}`).join("")}</>}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className={`${card} p-4 space-y-3`}>
          <h3 className="font-bold text-[var(--text-main)]">Доступ</h3>
          <div>
            <span className={label}>PIN для входа</span>
            <select className={input} value={st.access.pinMode} onChange={e => set("access", { pinMode: e.target.value as any })}>
              <option value="hourly">Меняется каждый час — объявляет организатор в аудитории</option>
              <option value="fixed">Постоянный</option>
              <option value="none">Без PIN — по одной ссылке</option>
            </select>
            {st.access.pinMode === "fixed" && <input className={`${input} mt-2`} value={st.access.fixedPin} onChange={e => set("access", { fixedPin: e.target.value.replace(/\D/g, "").slice(0, 8) })} placeholder="Например 2580" />}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><span className={label}>Открыт с</span><input type="datetime-local" className={input} value={toLocal(st.access.opensAt)} onChange={e => set("access", { opensAt: fromLocal(e.target.value) })} /></div>
            <div><span className={label}>по</span><input type="datetime-local" className={input} value={toLocal(st.access.closesAt)} onChange={e => set("access", { closesAt: fromLocal(e.target.value) })} /></div>
          </div>
          <div className="max-w-[220px]"><span className={label}>Попыток на человека</span><input type="number" min={1} max={20} className={input} value={st.access.maxAttempts} onChange={e => set("access", { maxAttempts: Number(e.target.value) || 1 })} /></div>
          <p className="text-[11px] text-[var(--text-muted)]">Повторную попытку сверх лимита разрешает менеджер в карточке работы.</p>
        </section>

        <section className={`${card} p-4 space-y-2`}>
          <h3 className="font-bold text-[var(--text-main)]">Регистрация ученика</h3>
          <p className="text-xs text-[var(--text-muted)]">Фамилия и имя — всегда.</p>
          <Check checked={st.registration.phone} onChange={v => set("registration", { phone: v })}>Телефон (по нему узнаём повторную попытку)</Check>
          <Check checked={st.registration.email} onChange={v => set("registration", { email: v })}>Почта</Check>
          <Check checked={st.registration.level} onChange={v => set("registration", { level: v })}>Спросить уровень</Check>
          {st.registration.level && <input className={`${input} ml-6 !w-60`} value={st.registration.levelLabel} onChange={e => set("registration", { levelLabel: e.target.value })} placeholder="Класс" />}
          <Check checked={st.registration.photo} onChange={v => set("registration", { photo: v })}>Фото с камеры перед началом (для сертификата и сверки личности)</Check>
        </section>

        <section className={`${card} p-4 space-y-2`}>
          <h3 className="font-bold text-[var(--text-main)]">Прокторинг</h3>
          <Check checked={st.proctoring.enabled} onChange={v => set("proctoring", { enabled: v })}>Наблюдение через камеру: нарушения со временем и снимки в досье</Check>
          {st.proctoring.enabled && (
            <div className="ml-6 space-y-1.5">
              {([["gazeAway", "Взгляд в сторону"], ["faceCount", "Второй человек в кадре / нет лица"], ["handTracking", "Руки и жесты"], ["audioAnalysis", "Разговор и подсказки (микрофон)"], ["phoneDetection", "Телефон и книги в кадре"]] as const).map(([k, l]) => (
                <Check key={k} checked={st.proctoring.detectors[k]} onChange={v => set("proctoring", { detectors: { ...st.proctoring.detectors, [k]: v } })}>{l}</Check>
              ))}
              <Check checked={st.proctoring.tabSwitch} onChange={v => set("proctoring", { tabSwitch: v })}>Уход со вкладки — нарушение</Check>
              <p className="text-[11px] text-[var(--text-muted)]">Без камеры экзамен не прерывается — работа помечается «без наблюдения». На балл прокторинг не влияет.</p>
            </div>
          )}
        </section>

        <section className={`${card} p-4 space-y-3`}>
          <h3 className="font-bold text-[var(--text-main)]">Оценка</h3>
          <Check checked={st.scoring.marks.enabled} onChange={v => set("scoring", { marks: { ...st.scoring.marks, enabled: v } })}>Отметка 2–5 по процентам</Check>
          {st.scoring.marks.enabled && (
            <div className="ml-6 grid grid-cols-3 gap-2 max-w-sm">
              {([["pass", "«3» от, %"], ["good", "«4» от, %"], ["excellent", "«5» от, %"]] as const).map(([k, l]) => (
                <div key={k}><span className={label}>{l}</span><input type="number" min={0} max={100} className={input} value={st.scoring.marks[k]} onChange={e => set("scoring", { marks: { ...st.scoring.marks, [k]: Number(e.target.value) || 0 } })} /></div>
              ))}
            </div>
          )}
          <Check checked={st.scoring.band} onChange={v => set("scoring", { band: v })}>Балл 1,0–5,0 с половинками (как в IELTS)</Check>
          <ScaleEditor scale={st.scoring.scale} onChange={scale => set("scoring", { scale })} />
        </section>

        <section className={`${card} p-4 space-y-3 lg:col-span-2`}>
          <h3 className="font-bold text-[var(--text-main)]">Результаты</h3>
          <div className="grid sm:grid-cols-3 gap-2">
            {([["after_publish", "Ученик видит после публикации"], ["immediately", "Сразу после сдачи"], ["never", "Не показывать ученику"]] as const).map(([k, l]) => (
              <label key={k} className={`flex items-center gap-2 text-sm rounded-lg border px-3 py-2 ${st.results.showToStudent === k ? "border-[var(--accent)]" : "border-[var(--border-color)]"}`}>
                <input type="radio" checked={st.results.showToStudent === k} onChange={() => set("results", { showToStudent: k })} /> {l}
              </label>
            ))}
          </div>
          <Check checked={st.results.requireReview} onChange={v => set("results", { requireReview: v })}>Публиковать только проверенные работы</Check>
          <Check checked={st.results.certificate} onChange={v => set("results", { certificate: v })}>Сертификат (печать и PDF, у ученика — после публикации)</Check>
          {st.results.certificate && <input className={`${input} ml-6 !w-96 max-w-full`} value={st.results.certificateTitle} onChange={e => set("results", { certificateTitle: e.target.value })} />}
          <Check checked={st.results.decisions} onChange={v => set("results", { decisions: v })}>Решение по работе: принят / резерв / не принят, с комментарием</Check>
          <GroupsEditor groups={st.results.groups} onChange={groups => set("results", { groups })} />
        </section>
      </div>

      {canEdit && (
        <div className="fixed bottom-3 left-3 right-3 md:left-auto md:bottom-4 md:right-4 z-40 flex flex-col-reverse md:flex-row items-stretch md:items-center gap-2">
          {error && <div className="text-sm text-rose-600 bg-[var(--bg-surface)] border border-rose-500/30 rounded-lg px-3 py-2 shadow md:max-w-md">{error}</div>}
          {notice && <div className="text-sm text-emerald-600 bg-[var(--bg-surface)] border border-emerald-500/30 rounded-lg px-3 py-2 shadow">{notice}</div>}
          {dirty && !notice && <div className="text-sm text-amber-600 bg-[var(--bg-surface)] border border-amber-500/30 rounded-lg px-3 py-2 shadow">Есть несохранённые изменения</div>}
          <button className={`${btnPrimary} shadow-lg px-5 py-3 justify-center`} onClick={save} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Сохранить</button>
        </div>
      )}
    </fieldset>
  );
}

function ScaleEditor({ scale, onChange }: { scale: ScaleBand[]; onChange: (s: ScaleBand[]) => void }) {
  // Без пересортировки при наборе — строка не должна прыгать под курсором; порядок наводит сервер.
  const rows = scale;
  return (
    <div>
      <span className={label}>Шкала уровней (необязательно)</span>
      <p className="text-[11px] text-[var(--text-muted)] mb-1.5">Например: от 75% — «Сильный класс», от 45% — «Основной», от 0% — «Подготовительный». Попадает в результаты, сертификат и аналитику.</p>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className="text-xs text-[var(--text-muted)]">от</span>
          <input type="number" min={0} max={100} className={`${input} !w-20`} value={r.minPercent} onChange={e => onChange(rows.map((x, k) => (k === i ? { ...x, minPercent: Number(e.target.value) || 0 } : x)))} />
          <span className="text-xs text-[var(--text-muted)]">%</span>
          <input className={`${input} flex-1`} value={r.label} onChange={e => onChange(rows.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
          <button type="button" className={btn} onClick={() => onChange(rows.filter((_, k) => k !== i))}><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <button type="button" className={btn} onClick={() => onChange([...rows, { minPercent: 0, label: "" }])}><Plus className="w-3.5 h-3.5" /> Уровень</button>
    </div>
  );
}

function GroupsEditor({ groups, onChange }: { groups: string[]; onChange: (g: string[]) => void }) {
  const [text, setText] = useState(groups.join(", "));
  useEffect(() => { setText(groups.join(", ")); }, [groups.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <span className={label}>Распределение по группам (классам)</span>
      <input className={input} value={text} onChange={e => setText(e.target.value)} onBlur={() => onChange(text.split(/[,;\n]/).map(x => x.trim()).filter(Boolean))} placeholder="7А, 7Б, 7В — пусто: не распределять" />
      <p className="text-[11px] text-[var(--text-muted)] mt-1">Менеджер назначает группу в карточке работы; в аналитике — сколько в каждой.</p>
    </div>
  );
}
