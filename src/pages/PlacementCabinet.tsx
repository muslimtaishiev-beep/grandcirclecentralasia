import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { auth } from "../lib/firebase";
import QuestionImport from "../components/placement/QuestionImport";
import { exportStreamCSV, openStudentReport } from "../lib/placementExport";

/**
 * Кабинет завуча — вступительный срез 5-11.
 *
 * Two jobs: control the shape of the exam (how many questions of each
 * difficulty, how long each section runs, what score means which class), and
 * read the results as they arrive.
 *
 * The blueprint editor shows what the question bank can actually supply
 * alongside every input — asking for 15 hard questions when the bank holds 5
 * silently produces a shorter exam for that student, so the shortage is stated
 * before it can happen rather than discovered afterwards.
 */

const GRADES = [5, 6, 7, 8, 9, 10, 11];
const DIFF_LABEL: Record<string, string> = { "1": "Лёгкие", "2": "Средние", "3": "Сложные" };

type Section = { key: string; title: string; minutes: number; counts: Record<string, number>; minTopics: number };
type Blueprint = { tenantId: string; grade: number; sections: Section[]; scale: { minPercent: number; label: string }[] };
type Availability = Record<string, Record<string, number>>;

async function authHeaders(): Promise<Record<string, string>> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

export default function PlacementCabinet() {
  const { orgId } = useParams<{ orgId: string }>();
  const tenantId = orgId || "";

  const [tab, setTab] = useState<"results" | "setup" | "bank">("results");
  const [bank, setBank] = useState<any[]>([]);
  const [bankNeedsReview, setBankNeedsReview] = useState(0);
  const [editing, setEditing] = useState<any>(null);
  const [grade, setGrade] = useState(7);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [availability, setAvailability] = useState<Availability>({});
  const [pin, setPin] = useState<string>("");
  const [pinLeft, setPinLeft] = useState<number>(0);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openStudent, setOpenStudent] = useState<any>(null);
  const [gradeFilter, setGradeFilter] = useState<number | 0>(0);

  const loadBlueprint = useCallback(async (g: number) => {
    try {
      const res = await fetch(`/api/placement/blueprint?tenantId=${encodeURIComponent(tenantId)}&grade=${g}`, {
        headers: await authHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(res.status === 403
          ? "Нет прав на управление срезом. Нужна роль «завуч» или администратор организации."
          : data.error || "Не удалось загрузить настройки.");
        return;
      }
      setBlueprint(data.blueprint);
      setAvailability(data.availability || {});
      setPin(data.pin || "");
      setPinLeft(data.pinMinutesLeft ?? 0);
      setError(null);
    } catch (e: any) {
      setError("Нет связи с сервером.");
    }
  }, [tenantId]);

  const loadBank = useCallback(async () => {
    try {
      const res = await fetch(`/api/placement/questions?tenantId=${encodeURIComponent(tenantId)}`, {
        headers: await authHeaders(),
      });
      const data = await res.json();
      if (data.success) { setBank(data.questions || []); setBankNeedsReview(data.needsReview || 0); }
    } catch (e) { /* bank is secondary to results */ }
  }, [tenantId]);

  const loadResults = useCallback(async () => {
    try {
      const res = await fetch(`/api/placement/results?tenantId=${encodeURIComponent(tenantId)}`, {
        headers: await authHeaders(),
      });
      const data = await res.json();
      if (data.success) setResults(data.results || []);
    } catch (e) { /* results are secondary to the blueprint; stay quiet */ }
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      await Promise.all([loadBlueprint(grade), loadResults(), loadBank()]);
      setLoading(false);
    })();
  }, [tenantId, grade, loadBlueprint, loadResults, loadBank]);

  // Results and the PIN both go stale while the page sits open during an exam.
  useEffect(() => {
    const t = setInterval(() => { void loadResults(); void loadBlueprint(grade); }, 30000);
    return () => clearInterval(t);
  }, [loadResults, loadBlueprint, grade]);

  const setCount = (sectionKey: string, diff: string, raw: string) => {
    const n = Math.max(0, Math.min(60, Number(raw.replace(/\D/g, "")) || 0));
    setBlueprint(bp => bp ? {
      ...bp,
      sections: bp.sections.map(s => s.key === sectionKey ? { ...s, counts: { ...s.counts, [diff]: n } } : s),
    } : bp);
  };
  const setMinutes = (sectionKey: string, raw: string) => {
    const n = Math.max(5, Math.min(180, Number(raw.replace(/\D/g, "")) || 5));
    setBlueprint(bp => bp ? {
      ...bp, sections: bp.sections.map(s => s.key === sectionKey ? { ...s, minutes: n } : s),
    } : bp);
  };

  const shortages = useMemo(() => {
    if (!blueprint) return [];
    const out: string[] = [];
    for (const s of blueprint.sections) {
      for (const d of ["1", "2", "3"]) {
        const want = s.counts[d] || 0;
        const have = availability[s.key]?.[d] ?? 0;
        if (want > have) out.push(`${s.title}, ${DIFF_LABEL[d].toLowerCase()}: нужно ${want}, в банке ${have}`);
      }
    }
    return out;
  }, [blueprint, availability]);

  const saveBlueprint = async () => {
    if (!blueprint) return;
    setSaving(true); setError(null); setNotice(null);
    try {
      const res = await fetch("/api/placement/blueprint", {
        method: "PUT", headers: await authHeaders(),
        body: JSON.stringify({ tenantId, grade, sections: blueprint.sections, scale: blueprint.scale }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Не удалось сохранить."); return; }
      setNotice(`Настройки для ${grade} класса сохранены.`);
      setTimeout(() => setNotice(null), 4000);
    } catch (e: any) {
      setError("Не удалось сохранить — нет связи с сервером.");
    } finally { setSaving(false); }
  };

  const decide = async (row: any, finalDecision: string) => {
    try {
      const res = await fetch("/api/placement/decide", {
        method: "POST", headers: await authHeaders(),
        body: JSON.stringify({ tenantId, resultId: row.id, finalDecision }),
      });
      const data = await res.json();
      if (data.success) {
        setResults(rs => rs.map(r => r.id === row.id ? { ...r, approved: true, finalDecision } : r));
        setOpenStudent(null);
      } else setError(data.error || "Не удалось сохранить решение.");
    } catch (e) { setError("Нет связи с сервером."); }
  };

  const allowRetake = async (row: any) => {
    const reason = prompt(
      `Разрешить пересдачу для ${row.studentName}?\n\n` +
      "Текущая попытка будет заархивирована — результат сохранится в истории.\n" +
      "Укажите причину (её увидит комиссия):", "Технический сбой во время экзамена");
    if (reason === null) return;
    try {
      const res = await fetch("/api/placement/allow-retake", {
        method: "POST", headers: await authHeaders(),
        body: JSON.stringify({ tenantId, shortId: row.shortId, reason }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Не удалось разрешить пересдачу."); return; }
      setNotice(`${row.studentName} может сдавать заново (попытка ${data.attempt}).`);
      setTimeout(() => setNotice(null), 5000);
      setOpenStudent(null);
      void loadResults();
    } catch (e) { setError("Нет связи с сервером."); }
  };

  const stats = useMemo(() => {
    // Superseded attempts stay in the list for history but must not skew the
    // averages the завуч reports to the committee.
    const live = results.filter(r => !r.superseded);
    const done = live.length;
    const avg = done ? Math.round(live.reduce((a, r) => a + (r.percent || 0), 0) / done) : 0;
    const pending = live.filter(r => !r.approved).length;
    return { done, avg, pending };
  }, [results]);

  const visibleResults = useMemo(
    () => results.filter(r => !gradeFilter || Number(r.grade) === gradeFilter),
    [results, gradeFilter]);

  const totalQuestions = blueprint
    ? blueprint.sections.reduce((a, s) => a + Object.values(s.counts).reduce((x, y) => x + (y || 0), 0), 0)
    : 0;
  const totalMinutes = blueprint ? blueprint.sections.reduce((a, s) => a + s.minutes, 0) : 0;

  if (loading) {
    return <div className="min-h-screen bg-slate-50 grid place-items-center text-slate-500">Загрузка кабинета…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Вступительный срез знаний</h1>
            <p className="text-slate-500 text-sm">Распределение по классам 5–11</p>
          </div>
          {pin && (
            <div className="bg-white border border-blue-200 rounded-xl px-4 py-2 flex items-center gap-3">
              <span className="text-sm text-slate-500">PIN аудитории:</span>
              <span className="text-xl font-mono font-bold text-blue-600 tracking-widest">{pin}</span>
              <span className={`text-xs ${pinLeft <= 5 ? "text-amber-600 font-semibold" : "text-slate-400"}`}>
                {pinLeft <= 5 ? `сменится через ${pinLeft} мин` : `действует ещё ${pinLeft} мин`}
              </span>
            </div>
          )}
        </div>

        {error && <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</div>}
        {notice && <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">{notice}</div>}

        <div className="flex gap-2 mb-5">
          {([["results", `Результаты (${stats.done})`], ["setup", "Настройка экзамена"],
             ["bank", `Банк вопросов (${bank.length})${bankNeedsReview ? ` · ${bankNeedsReview} на проверку` : ""}`]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                tab === k ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "results" && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[["Сдали экзамен", stats.done, ""], ["Средний результат", `${stats.avg}%`, ""],
                ["Ждут решения", stats.pending, stats.pending ? "text-amber-600" : ""]].map(([l, v, cls]) => (
                <div key={String(l)} className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className={`text-2xl font-bold tabular-nums ${cls}`}>{v}</div>
                  <div className="text-xs text-slate-500">{l}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-sm text-slate-500">Класс:</span>
              <button onClick={() => setGradeFilter(0)}
                className={`px-3 h-8 rounded-lg text-sm font-semibold border ${
                  gradeFilter === 0 ? "bg-slate-900 border-slate-900 text-white" : "border-slate-200 text-slate-600"}`}>
                все
              </button>
              {GRADES.map(g => (
                <button key={g} onClick={() => setGradeFilter(g)}
                  className={`w-9 h-8 rounded-lg text-sm font-semibold border ${
                    gradeFilter === g ? "bg-slate-900 border-slate-900 text-white" : "border-slate-200 text-slate-600"}`}>
                  {g}
                </button>
              ))}
              <button onClick={() => exportStreamCSV(results as any, gradeFilter || undefined)}
                disabled={visibleResults.length === 0}
                className={`ml-auto px-4 h-9 rounded-lg text-sm font-semibold ${
                  visibleResults.length === 0
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>
                📊 Выгрузить таблицу{gradeFilter ? ` (${gradeFilter} кл.)` : ""}
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {visibleResults.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm">
                  Пока никто не сдавал срез. Результаты появятся здесь сразу после завершения экзамена.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="p-3">Ученик</th>
                        <th className="p-3">Класс</th>
                        <th className="p-3">Балл</th>
                        <th className="p-3">Рекомендация</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleResults.map(r => (
                        <tr key={r.id} className={`border-b border-slate-100 last:border-0 ${
                          r.superseded ? "opacity-50" : ""}`}>
                          <td className="p-3">
                            <div className="font-medium text-slate-900">
                              {r.studentName}
                              {r.superseded && <span className="ml-2 text-xs font-normal text-slate-400">(пересдал)</span>}
                            </div>
                            <div className="font-mono text-xs text-slate-400">{r.shortId}</div>
                          </td>
                          <td className="p-3 text-slate-600">{r.grade}</td>
                          <td className="p-3 font-mono tabular-nums">
                            {r.correct}/{r.total} <span className="text-slate-400">({r.percent}%)</span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                              r.approved ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
                              {r.finalDecision || r.recommendation}
                            </span>
                            {r.approved && <span className="ml-2 text-xs text-slate-400">утверждено</span>}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <button onClick={() => openStudentReport(r as any) || setError("Браузер заблокировал окно — разрешите всплывающие окна.")}
                              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium mr-1">
                              📄 Протокол
                            </button>
                            <button onClick={() => setOpenStudent(r)}
                              className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium">
                              Разбор
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {tab === "setup" && blueprint && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <span className="text-sm text-slate-600">Настройки для класса:</span>
              <div className="flex gap-1 flex-wrap">
                {GRADES.map(g => (
                  <button key={g} onClick={() => setGrade(g)}
                    className={`w-10 h-9 rounded-lg text-sm font-semibold border transition ${
                      g === grade ? "bg-slate-900 border-slate-900 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 mb-5 text-sm text-slate-700">
              Экзамен для {grade} класса: <b>{totalQuestions} вопросов</b>, <b>{totalMinutes} минут</b>.
              У каждого ученика вопросы свои, но с этим же распределением сложности.
            </div>

            {shortages.length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 mb-5 text-sm text-amber-900">
                <b>В банке не хватает вопросов.</b> Ученик получит секцию короче:
                <ul className="mt-1 ml-4 list-disc">
                  {shortages.map(s => <li key={s}>{s}</li>)}
                </ul>
              </div>
            )}

            <div className="grid gap-4 mb-5">
              {blueprint.sections.map(s => {
                const secTotal = Object.values(s.counts).reduce((a, b) => a + (b || 0), 0);
                return (
                  <div key={s.key} className="border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                      <h3 className="font-bold text-slate-900">{s.title}</h3>
                      <div className="flex items-center gap-2 text-sm">
                        <label className="text-slate-500">Время, мин:</label>
                        <input value={s.minutes} onChange={e => setMinutes(s.key, e.target.value)}
                          inputMode="numeric"
                          className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-center font-mono" />
                        <span className="text-slate-400">· всего {secTotal} вопр.</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {["1", "2", "3"].map(d => {
                        const have = availability[s.key]?.[d] ?? 0;
                        const want = s.counts[d] || 0;
                        return (
                          <div key={d}>
                            <label className="block text-xs text-slate-500 mb-1">{DIFF_LABEL[d]}</label>
                            <input value={want} onChange={e => setCount(s.key, d, e.target.value)}
                              inputMode="numeric"
                              className={`w-full border rounded-lg px-3 py-2 font-mono text-center ${
                                want > have ? "border-amber-400 bg-amber-50" : "border-slate-300"}`} />
                            <div className={`text-xs mt-1 ${want > have ? "text-amber-600 font-medium" : "text-slate-400"}`}>
                              в банке: {have}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <h3 className="font-bold text-slate-900 mb-2 text-sm">Шкала распределения</h3>
            <p className="text-xs text-slate-500 mb-3">От какого процента начинается каждый уровень. Ученик попадает в первый подходящий сверху вниз.</p>
            <div className="grid gap-2 mb-5">
              {blueprint.scale.map((band, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">от</span>
                  <input value={band.minPercent} inputMode="numeric"
                    onChange={e => {
                      const v = Math.max(0, Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0));
                      setBlueprint(bp => bp ? { ...bp, scale: bp.scale.map((b, j) => j === i ? { ...b, minPercent: v } : b) } : bp);
                    }}
                    className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-center font-mono" />
                  <span className="text-sm text-slate-500">% →</span>
                  <input value={band.label}
                    onChange={e => setBlueprint(bp => bp ? { ...bp, scale: bp.scale.map((b, j) => j === i ? { ...b, label: e.target.value } : b) } : bp)}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5" />
                </div>
              ))}
            </div>

            <button onClick={saveBlueprint} disabled={saving}
              className={`px-6 py-3 rounded-xl font-bold text-white ${saving ? "bg-slate-400" : "bg-blue-600 hover:bg-blue-700"}`}>
              {saving ? "Сохраняем…" : `Сохранить настройки для ${grade} класса`}
            </button>
            <p className="text-xs text-slate-400 mt-3">
              Изменения действуют для экзаменов, начатых после сохранения. У тех, кто уже пишет, вариант не меняется.
            </p>
          </div>
        )}

        {tab === "bank" && (
          <div className="grid gap-4">
            <QuestionImport tenantId={tenantId} onImported={() => { void loadBank(); void loadBlueprint(grade); }} />

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-bold text-slate-900">В банке: {bank.length} вопросов</h3>
                {bankNeedsReview > 0 && (
                  <span className="text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-700 font-semibold">
                    {bankNeedsReview} требуют проверки
                  </span>
                )}
              </div>
              {bank.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm">
                  Банк пуст. Загрузите файл с вопросами выше.
                </div>
              ) : (
                <div className="max-h-[28rem] overflow-y-auto">
                  {bank.slice(0, 200).map((q: any) => (
                    <button key={q.id} onClick={() => setEditing({ ...q })}
                      className={`w-full text-left px-5 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 ${
                        q.needsReview ? "bg-amber-50/40" : ""}`}>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5 flex-wrap">
                        <span className="font-mono">{q.id}</span>
                        <span>{q.subject === "english" ? "английский" : "математика"} · сложн. {q.difficulty}</span>
                        <span>{q.type === "text_input" ? "вписать ответ" : "выбор варианта"}</span>
                        {q.needsReview && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">проверить</span>}
                        {q.active === false && <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">выключен</span>}
                      </div>
                      <div className="text-sm text-slate-800 truncate">{q.text}</div>
                    </button>
                  ))}
                  {bank.length > 200 && (
                    <div className="px-5 py-3 text-xs text-slate-400">Показаны первые 200 из {bank.length}.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {editing && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto"
            onClick={() => setEditing(null)}>
            <div className="bg-white rounded-2xl max-w-xl w-full my-8 p-6" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Правка вопроса</h2>
                  <p className="text-xs font-mono text-slate-400">{editing.id}</p>
                </div>
                <button onClick={() => setEditing(null)} className="text-slate-400 text-2xl leading-none">×</button>
              </div>

              {editing.importIssues?.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 mb-4 text-sm text-amber-900">
                  <b>Замечания при загрузке:</b>
                  <ul className="mt-1 ml-4 list-disc text-xs">
                    {editing.importIssues.map((i: string, n: number) => <li key={n}>{i}</li>)}
                  </ul>
                </div>
              )}

              <label className="block text-sm font-medium text-slate-700 mb-1">Текст вопроса</label>
              <textarea value={editing.text || ""} rows={3}
                onChange={e => setEditing({ ...editing, text: e.target.value })}
                className="w-full border border-slate-300 rounded-xl p-3 mb-3 text-sm" />

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Тема</label>
                  <input value={editing.topic || ""} onChange={e => setEditing({ ...editing, topic: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Сложность</label>
                  <select value={editing.difficulty} onChange={e => setEditing({ ...editing, difficulty: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-xl p-2 text-sm">
                    <option value={1}>1 — лёгкий</option><option value={2}>2 — средний</option><option value={3}>3 — сложный</option>
                  </select>
                </div>
              </div>

              {editing.type === "text_input" ? (
                <>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Правильный ответ</label>
                  <input value={editing.answer || ""} onChange={e => setEditing({ ...editing, answer: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl p-2 mb-3 text-sm" />
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Варианты — отметьте правильный</label>
                  <div className="grid gap-2 mb-3">
                    {(editing.options || []).map((o: string, i: number) => {
                      const letter = ["А", "Б", "В", "Г", "Д", "Е"][i];
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <button onClick={() => setEditing({ ...editing, answer: letter })}
                            className={`w-8 h-8 rounded-full border grid place-items-center text-sm font-bold shrink-0 ${
                              editing.answer === letter ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300 text-slate-500"}`}>
                            {letter}
                          </button>
                          <input value={o.replace(/^[А-ЯA-Z][).]\s*/, "")}
                            onChange={e => setEditing({ ...editing,
                              options: editing.options.map((x: string, j: number) => j === i ? `${letter}) ${e.target.value}` : x) })}
                            className="flex-1 border border-slate-300 rounded-lg p-2 text-sm" />
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <label className="flex items-center gap-2 text-sm text-slate-700 mb-4 cursor-pointer">
                <input type="checkbox" checked={editing.active !== false}
                  onChange={e => setEditing({ ...editing, active: e.target.checked })} />
                Вопрос участвует в экзаменах
              </label>

              <div className="flex gap-2">
                <button onClick={async () => {
                    try {
                      const res = await fetch(`/api/placement/questions/${encodeURIComponent(editing.id)}`, {
                        method: "PUT", headers: await authHeaders(),
                        body: JSON.stringify({ tenantId, ...editing }),
                      });
                      const data = await res.json();
                      if (!data.success) { setError(data.error || "Не удалось сохранить."); return; }
                      setEditing(null); void loadBank();
                      setNotice("Вопрос сохранён."); setTimeout(() => setNotice(null), 3000);
                    } catch (e) { setError("Нет связи с сервером."); }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700">
                  Сохранить
                </button>
                <button onClick={() => setEditing(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-semibold text-sm">
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}

        {openStudent && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto"
            onClick={() => setOpenStudent(null)}>
            <div className="bg-white rounded-2xl max-w-2xl w-full my-8 p-6" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{openStudent.studentName}</h2>
                  <p className="text-sm text-slate-500">
                    {openStudent.grade} класс · ID <span className="font-mono">{openStudent.shortId}</span>
                  </p>
                </div>
                <button onClick={() => setOpenStudent(null)} className="text-slate-400 text-2xl leading-none">×</button>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 mb-4">
                <div className="text-3xl font-bold tabular-nums">{openStudent.percent}%</div>
                <div className="text-sm text-slate-500">{openStudent.correct} из {openStudent.total} правильных</div>
              </div>

              {(openStudent.sections || []).map((s: any) => (
                <div key={s.key} className="mb-4">
                  <div className="flex justify-between text-sm font-semibold text-slate-800 mb-2">
                    <span>{s.title}</span>
                    <span className="font-mono">{s.correct}/{s.total}</span>
                  </div>
                  <div className="grid gap-1">
                    {Object.entries(s.byTopic || {}).map(([topic, v]: any) => {
                      const pct = v.total ? Math.round((v.correct / v.total) * 100) : 0;
                      return (
                        <div key={topic} className="flex items-center gap-2 text-xs">
                          <span className="w-44 shrink-0 text-slate-600 truncate">{topic}</span>
                          <div className="flex-1 h-2 rounded bg-slate-100 overflow-hidden">
                            <div className="h-full rounded" style={{
                              width: `${pct}%`,
                              background: pct >= 70 ? "#059669" : pct >= 45 ? "#d97706" : "#dc2626",
                            }} />
                          </div>
                          <span className="w-14 text-right font-mono text-slate-500">{v.correct}/{v.total}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="border-t border-slate-200 pt-4">
                <p className="text-sm text-slate-600 mb-2">
                  Расчёт системы: <b>{openStudent.recommendation}</b>. Решение принимает школа.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => openStudentReport(openStudent) || setError("Браузер заблокировал окно — разрешите всплывающие окна.")}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50">
                    📄 Протокол
                  </button>
                  <button onClick={() => allowRetake(openStudent)}
                    className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 font-semibold text-sm hover:bg-amber-100">
                    ↻ Разрешить пересдачу
                  </button>
                  <button onClick={() => decide(openStudent, openStudent.recommendation)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700">
                    Утвердить
                  </button>
                  <button onClick={() => {
                      const v = prompt("Укажите класс или уровень для этого ученика:", openStudent.finalDecision || openStudent.recommendation);
                      if (v && v.trim()) void decide(openStudent, v.trim());
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50">
                    Изменить решение
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
