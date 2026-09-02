import { useCallback, useEffect, useState } from "react";
import { auth } from "../../lib/firebase";

/**
 * Аналитика вступительного среза.
 *
 * Всё считается на сервере: кабинет получает готовые агрегаты, а не сотни
 * работ с полными текстами заданий. Здесь только отображение.
 *
 * Две вещи, которые важнее красоты графиков:
 *
 * Показатели, на которые школа опирается в отчётности (успеваемость,
 * качество), зависят от порогов оценок — а они у каждой школы свои. Пороги
 * видны прямо на экране, чтобы никто не сравнивал цифры, посчитанные по
 * разным границам.
 *
 * Малая выборка честно помечается. Тема, которую решал один ученик, не
 * попадает в «проблемные»: «0% усвоения» по одному ответу — это не провал
 * темы, а один неудачный ответ, и решения по нему принимать нельзя.
 */

type Marks = { pass: number; good: number; excellent: number };
type Summary = {
  total: number; performance: number; quality: number;
  avgPercent: number; avgScore: number; medianPercent: number;
  avgSat: number | null; reviewed: number; published: number;
};
type GroupRow = {
  name: string; total: number; performance: number; quality: number;
  avgPercent: number; avgScore: number;
};
type TopicRow = { subject: string; topic: string; correct: number; total: number; rate: number };
type DiffRow = { difficulty: number; label: string; correct: number; total: number; rate: number };
type QuestionRow = {
  id: string; text: string; topic: string; difficulty: number; subject: string;
  correct: number; total: number; rate: number;
  topWrong: { option: string; count: number }[];
};
type StudentRow = {
  id: string; shortId: string; studentName: string; grade: number;
  percent: number; score: number; total: number; mark: number;
  assignedClass: string | null; satMath: number | null;
};
type Data = {
  total: number; marks: Marks; summary: Summary | null;
  distribution: { mark: number; count: number; percent: number }[];
  byGrade: GroupRow[]; byClass: GroupRow[];
  topics: TopicRow[]; thinTopics: TopicRow[]; difficulty: DiffRow[];
  questions: QuestionRow[]; risk: StudentRow[]; top: StudentRow[];
  minSamples: { topic: number; question: number };
};

async function authHeaders(): Promise<Record<string, string>> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/** Цвет по проценту выполнения: красный — провал, зелёный — усвоено. */
const rateColor = (r: number) =>
  r >= 80 ? "bg-emerald-500" : r >= 60 ? "bg-lime-500" : r >= 40 ? "bg-amber-500" : "bg-red-500";
const rateText = (r: number) =>
  r >= 80 ? "text-emerald-700" : r >= 60 ? "text-lime-700" : r >= 40 ? "text-amber-700" : "text-red-700";

const MARK_COLOR: Record<number, string> = {
  5: "bg-emerald-500", 4: "bg-lime-500", 3: "bg-amber-500", 2: "bg-red-500",
};

/** Горизонтальная полоса: доля от максимума в группе. */
function Bar({ value, max, className = "" }: { value: number; max: number; className?: string }) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${w}%` }} />
    </div>
  );
}

function Card({ label, value, hint, tone = "" }: {
  label: string; value: string; hint?: string; tone?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">{label}</div>
      <div className={`text-3xl font-bold tabular-nums leading-none ${tone || "text-slate-900"}`}>{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1.5">{hint}</div>}
    </div>
  );
}

export default function Analytics({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grade, setGrade] = useState<number>(0);
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const q = `tenantId=${encodeURIComponent(tenantId)}${grade ? `&grade=${grade}` : ""}`;
      const res = await fetch(`/api/placement/analytics?${q}`, { headers: await authHeaders() });
      const j = await res.json();
      if (!j.success) { setError(j.error || "Не удалось загрузить аналитику."); return; }
      setData(j);
    } catch {
      setError("Нет связи с сервером.");
    } finally { setLoading(false); }
  }, [tenantId, grade]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400">
      Считаем аналитику…
    </div>;
  }
  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-800">
      {error}
      <button onClick={() => void load()} className="ml-3 underline font-semibold">Повторить</button>
    </div>;
  }
  if (!data || !data.summary) {
    return <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400">
      Пока нет ни одной сданной работы — аналитика появится после первых результатов.
    </div>;
  }

  const s = data.summary;
  const maxDist = Math.max(1, ...data.distribution.map(d => d.count));

  return (
    <div className="grid gap-5">
      {/* Фильтр по параллели */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-slate-500">Параллель:</span>
        <select value={grade} onChange={e => setGrade(Number(e.target.value))}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white">
          <option value={0}>Все классы</option>
          {[5, 6, 7, 8, 9, 10, 11].map(g => <option key={g} value={g}>{g} класс</option>)}
        </select>
        <span className="text-xs text-slate-400">
          Оценки по порогам: «3» от {data.marks.pass}%, «4» от {data.marks.good}%, «5» от {data.marks.excellent}%
          {!grade && " · общие пороги, у параллелей могут быть свои"}
        </span>
      </div>

      {/* Основные показатели */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="Успеваемость" value={`${s.performance}%`}
          tone={rateText(s.performance)}
          hint={`сдали на «3» и выше — ${Math.round(s.performance * s.total / 100)} из ${s.total}`} />
        <Card label="Качество знаний" value={`${s.quality}%`}
          tone={rateText(s.quality)}
          hint={`оценки «4» и «5» — ${Math.round(s.quality * s.total / 100)} из ${s.total}`} />
        <Card label="Средний балл" value={String(s.avgScore)}
          hint={`${s.avgPercent}% · медиана ${s.medianPercent}%`} />
        <Card label="Средний SAT" value={s.avgSat != null ? String(s.avgSat) : "—"}
          hint={s.avgSat != null ? "эквивалент по математике" : "нет данных по математике"} />
      </div>

      {/* Распределение оценок */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-bold text-slate-900 mb-4">Распределение оценок</h3>
        <div className="grid gap-2.5">
          {data.distribution.map(d => (
            <div key={d.mark} className="flex items-center gap-3">
              <span className="w-16 text-sm text-slate-600 shrink-0">
                {d.mark === 2 ? "не сдали" : `«${d.mark}»`}
              </span>
              <Bar value={d.count} max={maxDist} className={MARK_COLOR[d.mark]} />
              <span className="w-24 text-right text-sm tabular-nums shrink-0">
                <b className="text-slate-900">{d.count}</b>
                <span className="text-slate-400"> · {d.percent}%</span>
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Всего работ: {s.total} · проверено {s.reviewed} · опубликовано {s.published}
        </p>
      </div>

      {/* Разрезы по параллелям и классам */}
      <div className="grid lg:grid-cols-2 gap-5">
        {([["По параллелям", data.byGrade], ["По классам зачисления", data.byClass]] as const)
          .filter(([, rows]) => rows.length > 0)
          .map(([title, rows]) => (
          <div key={title} className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-bold text-slate-900 mb-4">{title}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400 text-left">
                    <th className="pb-2 font-medium">Группа</th>
                    <th className="pb-2 font-medium text-right">Чел.</th>
                    <th className="pb-2 font-medium text-right">Успев.</th>
                    <th className="pb-2 font-medium text-right">Качество</th>
                    <th className="pb-2 font-medium text-right">Ср. балл</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.name} className="border-t border-slate-100">
                      <td className="py-2 font-medium text-slate-800">{r.name}</td>
                      <td className="py-2 text-right tabular-nums text-slate-500">{r.total}</td>
                      <td className={`py-2 text-right tabular-nums font-semibold ${rateText(r.performance)}`}>{r.performance}%</td>
                      <td className={`py-2 text-right tabular-nums font-semibold ${rateText(r.quality)}`}>{r.quality}%</td>
                      <td className="py-2 text-right tabular-nums text-slate-800">{r.avgScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Выполнение по сложности */}
      {data.difficulty.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="font-bold text-slate-900 mb-1">Выполнение по сложности</h3>
          <p className="text-xs text-slate-500 mb-4">
            В норме процент падает от лёгких к сложным. Если нет — сложность заданий в банке
            размечена неверно, и это стоит поправить до следующего экзамена.
          </p>
          <div className="grid gap-2.5">
            {data.difficulty.map(d => (
              <div key={d.difficulty} className="flex items-center gap-3">
                <span className="w-20 text-sm text-slate-600 shrink-0">{d.label}</span>
                <Bar value={d.rate} max={100} className={rateColor(d.rate)} />
                <span className="w-28 text-right text-sm tabular-nums shrink-0">
                  <b className={rateText(d.rate)}>{d.rate}%</b>
                  <span className="text-slate-400"> · {d.total} отв.</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Темы: проблемные и усвоенные.
          Списки не должны пересекаться: при пяти темах «худшие пять» и
          «лучшие пять» — это одни и те же строки в обратном порядке, и такой
          экран не говорит ничего. Делим по границе усвоения (60%), а когда тем
          мало — показываем один общий список. */}
      {data.topics.length > 0 && (() => {
        const WEAK = 60;
        const weak = data.topics.filter(t => t.rate < WEAK).slice(0, 10);
        const strong = [...data.topics].reverse().filter(t => t.rate >= WEAK).slice(0, 10);
        const split = weak.length > 0 && strong.length > 0;
        return split ? (
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-bold text-slate-900 mb-1">Проблемные темы</h3>
            <p className="text-xs text-slate-500 mb-4">Выполнение ниже {WEAK}% — на что направить повторение.</p>
            <div className="grid gap-2">
              {weak.map(t => (
                <div key={`${t.subject}-${t.topic}`} className="flex items-center gap-3">
                  <span className="w-44 text-sm text-slate-700 truncate shrink-0" title={t.topic}>{t.topic}</span>
                  <Bar value={t.rate} max={100} className={rateColor(t.rate)} />
                  <span className="w-20 text-right text-sm tabular-nums shrink-0">
                    <b className={rateText(t.rate)}>{t.rate}%</b>
                    <span className="text-slate-400"> /{t.total}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-bold text-slate-900 mb-1">Усвоенные темы</h3>
            <p className="text-xs text-slate-500 mb-4">Выполнение от {WEAK}% — время на повторение можно не тратить.</p>
            <div className="grid gap-2">
              {strong.map(t => (
                <div key={`${t.subject}-${t.topic}`} className="flex items-center gap-3">
                  <span className="w-44 text-sm text-slate-700 truncate shrink-0" title={t.topic}>{t.topic}</span>
                  <Bar value={t.rate} max={100} className={rateColor(t.rate)} />
                  <span className="w-20 text-right text-sm tabular-nums shrink-0">
                    <b className={rateText(t.rate)}>{t.rate}%</b>
                    <span className="text-slate-400"> /{t.total}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-bold text-slate-900 mb-1">Выполнение по темам</h3>
            <p className="text-xs text-slate-500 mb-4">
              {weak.length === 0
                ? `Все темы выполнены на ${WEAK}% и выше — провальных нет.`
                : `Ни одна тема не достигла ${WEAK}% — поток не справился со всем разделом.`}
            </p>
            <div className="grid gap-2">
              {data.topics.slice(0, 15).map(t => (
                <div key={`${t.subject}-${t.topic}`} className="flex items-center gap-3">
                  <span className="w-44 text-sm text-slate-700 truncate shrink-0" title={t.topic}>{t.topic}</span>
                  <Bar value={t.rate} max={100} className={rateColor(t.rate)} />
                  <span className="w-20 text-right text-sm tabular-nums shrink-0">
                    <b className={rateText(t.rate)}>{t.rate}%</b>
                    <span className="text-slate-400"> /{t.total}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Темы с малой выборкой — отдельно, чтобы по ним не делали выводов */}
      {data.thinTopics.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="text-sm font-semibold text-amber-900 mb-1">
            Ещё {data.thinTopics.length} тем встретились реже {data.minSamples.topic} раз
          </div>
          <p className="text-xs text-amber-800">
            Их процент выполнения ненадёжен — по одному-двум ответам нельзя судить о теме.
            Они появятся в разборе выше, когда экзамен сдаст больше учеников.
          </p>
        </div>
      )}

      {/* Позадачный анализ */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-bold text-slate-900 mb-1">Позадачный анализ</h3>
        <p className="text-xs text-slate-500 mb-4">
          Процент выполнения каждого задания. Нажмите на строку, чтобы увидеть,
          какие неверные ответы выбирали чаще всего — это показывает, в чём именно ошибка.
        </p>
        {data.questions.length === 0 ? (
          <p className="text-sm text-slate-400">
            Пока недостаточно данных: задание попадает сюда, когда его получили
            минимум {data.minSamples.question} ученика. Варианты у всех разные,
            поэтому нужна массовая сдача.
          </p>
        ) : (
          <div className="grid gap-1.5">
            {data.questions.slice(0, 40).map(q => (
              <div key={q.id} className="border border-slate-100 rounded-lg overflow-hidden">
                <button onClick={() => setOpenQuestion(openQuestion === q.id ? null : q.id)}
                  className="w-full flex items-center gap-3 p-2.5 hover:bg-slate-50 text-left">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-slate-800 truncate">{q.text}</span>
                    <span className="block text-xs text-slate-400">
                      {q.subject} · {q.topic} · сложность {q.difficulty}
                    </span>
                  </span>
                  <span className="w-24 shrink-0"><Bar value={q.rate} max={100} className={rateColor(q.rate)} /></span>
                  <span className="w-20 text-right text-sm tabular-nums shrink-0">
                    <b className={rateText(q.rate)}>{q.rate}%</b>
                    <span className="text-slate-400"> /{q.total}</span>
                  </span>
                </button>
                {openQuestion === q.id && (
                  <div className="px-3 pb-3 pt-1 bg-slate-50 border-t border-slate-100">
                    <div className="text-sm text-slate-700 mb-2">{q.text}</div>
                    {q.topWrong.length === 0 ? (
                      <div className="text-xs text-emerald-700">Неверных ответов не было.</div>
                    ) : (
                      <>
                        <div className="text-xs uppercase tracking-wide text-slate-400 mb-1.5">
                          Типичные ошибки
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {q.topWrong.map(w => (
                            <span key={w.option}
                              className="px-2.5 py-1 rounded-lg bg-white border border-red-200 text-sm">
                              <b className="text-red-700">{w.option}</b>
                              <span className="text-slate-500"> — {w.count} чел.</span>
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Группа риска и высокобалльники */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white border border-red-200 rounded-xl p-5">
          <h3 className="font-bold text-slate-900 mb-1">
            Группа риска <span className="text-red-600">({data.risk.length})</span>
          </h3>
          <p className="text-xs text-slate-500 mb-3">Не набрали проходной балл ({data.marks.pass}%).</p>
          {data.risk.length === 0 ? (
            <p className="text-sm text-emerald-700">Все набрали проходной балл.</p>
          ) : (
            <div className="grid gap-1">
              {data.risk.slice(0, 30).map(r => (
                <div key={r.id} className="flex items-center justify-between text-sm border-t border-slate-100 py-1.5">
                  <span className="truncate">
                    <span className="text-slate-800">{r.studentName}</span>
                    <span className="text-slate-400"> · {r.grade} кл.</span>
                  </span>
                  <span className="tabular-nums shrink-0 ml-2">
                    <b className="text-red-700">{r.percent}%</b>
                    <span className="text-slate-400"> · {r.score}/{r.total}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-emerald-200 rounded-xl p-5">
          <h3 className="font-bold text-slate-900 mb-1">
            Высокобалльники <span className="text-emerald-600">({data.top.length})</span>
          </h3>
          <p className="text-xs text-slate-500 mb-3">Результат от {data.marks.excellent}% и выше.</p>
          {data.top.length === 0 ? (
            <p className="text-sm text-slate-400">Пока никто не достиг этой планки.</p>
          ) : (
            <div className="grid gap-1">
              {data.top.slice(0, 30).map(r => (
                <div key={r.id} className="flex items-center justify-between text-sm border-t border-slate-100 py-1.5">
                  <span className="truncate">
                    <span className="text-slate-800">{r.studentName}</span>
                    <span className="text-slate-400"> · {r.grade} кл.{r.assignedClass ? ` → ${r.assignedClass}` : ""}</span>
                  </span>
                  <span className="tabular-nums shrink-0 ml-2">
                    <b className="text-emerald-700">{r.percent}%</b>
                    {r.satMath != null && <span className="text-slate-400"> · SAT {r.satMath}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
