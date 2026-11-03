import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { examAnalytics, type Attempt, type Exam } from "../../../shared/examRun";
import { card, input, label } from "../journals/components/ui";
import type { Api } from "./examApi";

/**
 * Аналитика экзамена — всё, что было в аналитике среза, но для любого
 * экзамена: успеваемость, распределение, разделы, темы, вопросы, риски.
 */
export default function ExamAnalyticsTab({ exam, api, onOpen }: { exam: Exam; api: Api; onOpen?: (id: string) => void }) {
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState("");
  const [qLimit, setQLimit] = useState(15);
  useEffect(() => { api(`/exams/${exam.id}/attempts?full=1`).then(j => setAttempts(j.attempts)).catch(e => setError(e.message)); }, [api, exam.id]);

  const levels = useMemo(() => [...new Set((attempts || []).map(a => a.student.level).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru", { numeric: true })), [attempts]);
  const an = useMemo(() => attempts && examAnalytics(attempts.filter(a => !level || a.student.level === level), exam.settings, Object.fromEntries(exam.sections.map(s => [s.id, s.title]))), [attempts, level, exam]);

  if (error) return <div className="text-sm text-rose-600">{error}</div>;
  if (!an) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>;
  if (!an.finished) return <div className={`${card} p-10 text-center text-sm text-[var(--text-muted)]`}>Пока нет сданных работ{an.inProgress ? ` — сейчас сдают ${an.inProgress}` : ""}.</div>;

  const s = exam.settings;
  const histMax = Math.max(1, ...an.histogram.map(h => h.count));

  return (
    <div className="space-y-4">
      {levels.length > 1 && (
        <div className="max-w-xs"><span className={label}>{s.registration.levelLabel}</span>
          <select className={input} value={level} onChange={e => setLevel(e.target.value)}><option value="">Все</option>{levels.map(l => <option key={l} value={l}>{l}</option>)}</select>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Tile t="Сдали" v={an.finished} sub={an.inProgress ? `ещё сдают: ${an.inProgress}` : ""} />
        <Tile t="Средний результат" v={`${an.avgPercent}%`} sub={`медиана ${an.medianPercent}%`} />
        {an.passRate != null && <Tile t="Успеваемость" v={`${an.passRate}%`} sub="отметка 3 и выше" />}
        {an.qualityRate != null && <Tile t="Качество" v={`${an.qualityRate}%`} sub="отметки 4 и 5" />}
        {s.proctoring.enabled && <Tile t="Честность" v={an.honesty.avg != null ? `${an.honesty.avg}/100` : "—"} sub={`с нарушениями: ${an.honesty.flagged}${an.honesty.noCamera ? ` · без камеры: ${an.honesty.noCamera}` : ""}`} />}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Распределение результатов">
          <div className="flex items-end gap-1 h-36">
            {an.histogram.map(h => (
              <div key={h.from} className="flex-1 flex flex-col items-center justify-end h-full" title={`${h.from}–${Math.floor(h.to)}%: ${h.count}`}>
                <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{h.count || ""}</span>
                <div className="w-full rounded-t bg-[var(--accent)]" style={{ height: `${(h.count / histMax) * 100}%`, minHeight: h.count ? 2 : 0 }} />
              </div>
            ))}
          </div>
          <div className="flex gap-1 mt-1">{an.histogram.map(h => <span key={h.from} className="flex-1 text-center text-[10px] text-[var(--text-muted)]">{h.from}</span>)}</div>
        </Panel>
        <Panel title="По разделам">{an.sections.map(x => <Bar key={x.id} label={x.title} value={x.avgPercent} suffix="%" />)}</Panel>
        {an.marks.length > 0 && <Panel title="Отметки">{an.marks.map(m => <Bar key={m.mark} label={`«${m.mark}»`} value={m.count} max={an.finished} />)}</Panel>}
        {an.scale.length > 0 && s.scoring.scale.length > 0 && <Panel title="Уровни по шкале">{an.scale.map(x => <Bar key={x.label} label={x.label} value={x.count} max={an.finished} />)}</Panel>}
        {an.levels.length > 1 && !level && <Panel title={`По ${s.registration.levelLabel.toLowerCase()}ам`}>{an.levels.map(x => <Bar key={x.level} label={`${x.level} (${x.count})`} value={x.avgPercent} suffix="%" />)}</Panel>}
        {s.results.groups.length > 0 && <Panel title="Распределение по группам">{an.groups.map(x => <Bar key={x.group} label={x.group} value={x.count} max={an.finished} />)}</Panel>}
        {s.results.decisions && <Panel title="Решения">{an.decisions.map(x => <Bar key={x.decision} label={x.decision} value={x.count} max={an.finished} />)}</Panel>}
        <Panel title="Темы — от проблемных к освоенным">
          <div className="max-h-80 overflow-y-auto pr-1">{an.topics.map(t => <Bar key={t.topic} label={t.topic} value={t.avgPercent} suffix="%" warn={t.avgPercent < 50} />)}</div>
        </Panel>
      </div>

      <Panel title="Вопросы — самые трудные сверху">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="text-[11px] uppercase font-mono text-[var(--text-muted)]"><tr><th className="py-2 text-left">Вопрос</th><th className="py-2 text-left">Тема</th><th className="py-2 text-right">Верно</th><th className="py-2 pl-4 text-left">Частые неверные ответы</th></tr></thead>
            <tbody>
              {an.questions.slice(0, qLimit).map(q => (
                <tr key={q.qid} className="border-t border-[var(--border-color)]">
                  <td className="py-2 font-mono text-xs">{q.qid}</td>
                  <td className="py-2 text-[var(--text-muted)] text-xs">{q.topic}</td>
                  <td className={`py-2 text-right tabular-nums font-semibold ${q.percent < 30 ? "text-rose-600" : q.percent < 60 ? "text-amber-700" : "text-[var(--text-main)]"}`}>{q.percent}% <span className="text-[11px] font-normal text-[var(--text-muted)]">({q.correct}/{q.asked})</span></td>
                  <td className="py-2 pl-4 text-xs text-[var(--text-muted)]">{q.wrong.map(w => `«${w.answer.slice(0, 40)}» ×${w.count}`).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {an.questions.length > qLimit && <button className="mt-2 text-xs text-[var(--accent)] hover:underline" onClick={() => setQLimit(n => n + 50)}>Показать ещё</button>}
      </Panel>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Лучшие">{an.top.map((x, i) => <Person key={x.id} n={i + 1} name={x.name} right={`${x.percent}%`} onClick={() => onOpen?.(x.id)} />)}</Panel>
        <Panel title="Требуют внимания">{an.risk.length ? an.risk.map((x, i) => <Person key={x.id} n={i + 1} name={x.name} right={`${x.percent}%`} sub={x.reason} onClick={() => onOpen?.(x.id)} />) : <p className="text-sm text-[var(--text-muted)]">Нет</p>}</Panel>
      </div>
    </div>
  );
}

function Tile({ t, v, sub }: { t: string; v: React.ReactNode; sub?: string }) {
  return <div className={`${card} p-4`}><div className="text-[11px] uppercase font-bold text-[var(--text-muted)] tracking-wider">{t}</div><div className="text-2xl font-bold tabular-nums text-[var(--text-main)] mt-1">{v}</div>{sub && <div className="text-[11px] text-[var(--text-muted)]">{sub}</div>}</div>;
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className={`${card} p-4`}><h4 className="font-semibold text-sm text-[var(--text-main)] mb-3">{title}</h4><div className="space-y-2">{children}</div></div>;
}
function Bar({ label: l, value, max = 100, suffix = "", warn }: { label: string; value: number; max?: number; suffix?: string; warn?: boolean }) {
  return (
    <div title={`${l}: ${value}${suffix}`}>
      <div className="flex justify-between gap-3 text-sm"><span className="truncate text-[var(--text-main)]">{l}</span><span className={`tabular-nums font-medium ${warn ? "text-rose-600" : "text-[var(--text-main)]"}`}>{value}{suffix}</span></div>
      <div className="h-1.5 mt-1 rounded-full bg-[var(--bg-surface-hover)]"><div className={`h-1.5 rounded-full ${warn ? "bg-rose-500" : "bg-[var(--accent)]"}`} style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} /></div>
    </div>
  );
}
function Person({ n, name, right, sub, onClick }: { n: number; name: string; right: string; sub?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 text-left text-sm py-1 hover:bg-[var(--bg-surface-hover)] rounded px-1">
      <span className="w-5 text-[var(--text-muted)] tabular-nums">{n}</span>
      <span className="flex-1 min-w-0"><span className="text-[var(--text-main)]">{name}</span>{sub && <span className="block text-[11px] text-[var(--text-muted)]">{sub}</span>}</span>
      <span className="font-semibold tabular-nums">{right}</span>
    </button>
  );
}
