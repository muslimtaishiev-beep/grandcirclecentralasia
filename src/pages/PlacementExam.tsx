import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

/**
 * Вступительный срез знаний 5-11 — экран ученика.
 *
 * SAT-style: one question at a time, a question map that shows what is
 * answered / flagged / current, a per-section clock. Everything that decides
 * anything lives on the server — this screen never sees a correct answer, and
 * cannot regenerate its own variant.
 *
 * Answers are saved to the server as they are given (debounced) AND mirrored
 * to localStorage, because a student whose browser dies mid-exam must not lose
 * work. The server copy is authoritative; the local one only survives an
 * offline blip.
 */

type Question = {
  id: string; subject: string; topic: string; difficulty: number;
  type?: "multiple_choice" | "text_input";
  text: string; options: string[]; points: number;
};
type Section = {
  key: string; title: string; minutes: number;
  deadline: number | null; finished: boolean; questions: Question[];
};
type Session = {
  sessionId: string; shortId: string; grade: number;
  status: string; currentSection: number;
  sections: Section[]; answers: Record<string, string>;
};

const LETTERS = ["А", "Б", "В", "Г", "Д", "Е"];
const DIFFICULTY_LABEL: Record<number, string> = { 1: "лёгкий", 2: "средний", 3: "сложный" };

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function PlacementExam() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const tenantId = orgSlug || "";

  const [phase, setPhase] = useState<"login" | "exam" | "between" | "final">("login");
  const [session, setSession] = useState<Session | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [cursor, setCursor] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sectionResult, setSectionResult] = useState<any>(null);
  const [final, setFinal] = useState<any>(null);

  // Login fields
  const [studentName, setStudentName] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [grade, setGrade] = useState("7");
  const [enteredPin, setEnteredPin] = useState("");

  const shortIdRef = useRef<string>("");
  const pendingRef = useRef<Record<string, string>>({});
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoFinishing = useRef(false);

  const storageKey = `placement_${tenantId}`;

  // Restore an interrupted attempt on load: the id is what lets the server
  // hand back the same variant.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (saved.shortId) {
        shortIdRef.current = saved.shortId;
        setStudentName(saved.studentName || "");
        setGrade(String(saved.grade || "7"));
        setAnswers(saved.answers || {});
        setFlags(saved.flags || {});
      }
    } catch (e) { /* corrupt storage must not block the exam */ }
  }, [storageKey]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const activeSection: Section | null = session ? session.sections[session.currentSection] : null;
  const questions = activeSection?.questions || [];
  const question = questions[cursor];
  const remaining = activeSection?.deadline ? activeSection.deadline - now : null;

  const persistLocal = useCallback((patch: Record<string, unknown>) => {
    try {
      const prev = JSON.parse(localStorage.getItem(storageKey) || "{}");
      localStorage.setItem(storageKey, JSON.stringify({ ...prev, ...patch }));
    } catch (e) { /* private mode */ }
  }, [storageKey]);

  /** Sends whatever has accumulated; never throws — a failed save retries on the next answer. */
  const flushAnswers = useCallback(async () => {
    const batch = pendingRef.current;
    if (!Object.keys(batch).length || !shortIdRef.current) return;
    pendingRef.current = {};
    try {
      await fetch("/api/placement/answer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, shortId: shortIdRef.current, answers: batch }),
      });
    } catch (e) {
      // Put them back so the next flush retries rather than dropping answers.
      pendingRef.current = { ...batch, ...pendingRef.current };
    }
  }, [tenantId]);

  const answer = (qid: string, value: string) => {
    setAnswers(prev => {
      const next = { ...prev, [qid]: value };
      persistLocal({ answers: next });
      return next;
    });
    pendingRef.current[qid] = value;
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flushAnswers, 1200);
  };

  const toggleFlag = (qid: string) => {
    setFlags(prev => {
      const next = { ...prev, [qid]: !prev[qid] };
      persistLocal({ flags: next });
      return next;
    });
  };

  const startExam = async () => {
    setError(null);
    if (!studentName.trim() || studentName.trim().split(/\s+/).length < 2) {
      return setError("Введите фамилию и имя полностью.");
    }
    if (!enteredPin.trim()) return setError("Введите PIN-код аудитории — его называет завуч.");
    setBusy(true);
    try {
      const sid = shortIdRef.current || String(Math.floor(100000 + Math.random() * 900000));
      const res = await fetch("/api/placement/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, grade: Number(grade), shortId: sid, studentName, studentPhone, studentEmail, enteredPin }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Не удалось начать экзамен."); return; }
      shortIdRef.current = data.session.shortId;
      persistLocal({ shortId: data.session.shortId, studentName, grade, answers: data.session.answers || {} });
      setSession(data.session);
      setAnswers(prev => ({ ...prev, ...(data.session.answers || {}) }));
      setCursor(0);
      setPhase("exam");
    } catch (e: any) {
      setError("Нет связи с сервером. Проверьте интернет и попробуйте снова.");
    } finally {
      setBusy(false);
    }
  };

  const finishSection = useCallback(async (auto = false) => {
    if (busy || !shortIdRef.current) return;
    setBusy(true);
    try {
      await flushAnswers();
      const res = await fetch("/api/placement/finish-section", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, shortId: shortIdRef.current }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Не удалось завершить секцию."); return; }
      if (data.final) {
        setFinal(data.final);
        setPhase("final");
        try { localStorage.removeItem(storageKey); } catch (e) {}
      } else {
        setSectionResult({ ...data.sectionResult, auto });
        setSession(prev => prev ? {
          ...prev,
          currentSection: data.nextSection.index,
          sections: prev.sections.map((s, i) =>
            i === data.nextSection.index ? { ...s, deadline: data.nextSection.deadline } : s),
        } : prev);
        setCursor(0);
        setPhase("between");
      }
    } catch (e: any) {
      setError("Не удалось отправить результат. Проверьте интернет — ответы сохранены.");
    } finally {
      setBusy(false);
      autoFinishing.current = false;
    }
  }, [busy, flushAnswers, storageKey, tenantId]);

  // Time is up: close the section automatically, keeping what was answered.
  useEffect(() => {
    if (phase !== "exam" || remaining === null || autoFinishing.current) return;
    if (remaining <= 0) {
      autoFinishing.current = true;
      void finishSection(true);
    }
  }, [phase, remaining, finishSection]);

  // Save on the way out — closing the tab must not lose the last answer.
  useEffect(() => {
    const onHide = () => { void flushAnswers(); };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flushAnswers]);

  const answeredCount = useMemo(
    () => questions.filter(q => answers[q.id] !== undefined && answers[q.id] !== "").length,
    [questions, answers]);

  // ── Login ────────────────────────────────────────────────────────────────
  if (phase === "login") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-lg w-full border border-slate-200">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Вступительный срез знаний</h1>
          <p className="text-slate-500 mb-6 text-sm">Математика и английский язык. Результат определяет класс, в который вы будете распределены.</p>

          {shortIdRef.current && (
            <div className="mb-5 rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
              Найдена незаконченная попытка (ID <span className="font-mono font-bold">{shortIdRef.current}</span>).
              Войдите — вы продолжите с того же места, с теми же вопросами.
            </div>
          )}

          <label className="block text-sm font-medium text-slate-700 mb-1">Фамилия и имя</label>
          <input value={studentName} onChange={e => setStudentName(e.target.value)}
            placeholder="Иванов Иван" autoComplete="name"
            className="w-full border border-slate-300 rounded-xl p-3 mb-4 bg-slate-50" />

          <label className="block text-sm font-medium text-slate-700 mb-1">Телефон</label>
          <input value={studentPhone} onChange={e => setStudentPhone(e.target.value)}
            type="tel" placeholder="+996 700 000 000" autoComplete="tel"
            className="w-full border border-slate-300 rounded-xl p-3 mb-4 bg-slate-50" />

          <label className="block text-sm font-medium text-slate-700 mb-1">E-mail (для результата)</label>
          <input value={studentEmail} onChange={e => setStudentEmail(e.target.value)}
            type="email" placeholder="name@example.com" autoComplete="email"
            className="w-full border border-slate-300 rounded-xl p-3 mb-4 bg-slate-50" />

          <label className="block text-sm font-medium text-slate-700 mb-1">Класс, в который поступаете</label>
          <select value={grade} onChange={e => setGrade(e.target.value)}
            className="w-full border border-slate-300 rounded-xl p-3 mb-4 bg-slate-50">
            {[5, 6, 7, 8, 9, 10, 11].map(g => <option key={g} value={g}>{g} класс</option>)}
          </select>

          <label className="block text-sm font-medium text-slate-700 mb-1">PIN-код аудитории</label>
          <input value={enteredPin} onChange={e => setEnteredPin(e.target.value)}
            inputMode="numeric" placeholder="4 цифры" autoComplete="off"
            className="w-full border border-slate-300 rounded-xl p-3 mb-5 bg-slate-50 font-mono tracking-widest text-lg" />

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</div>
          )}

          <button onClick={startExam} disabled={busy}
            className={`w-full py-4 rounded-xl font-bold text-white text-lg transition ${
              busy ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 shadow-lg"}`}>
            {busy ? "Собираем вариант…" : "Начать экзамен"}
          </button>
        </div>
      </div>
    );
  }

  // ── Between sections ─────────────────────────────────────────────────────
  if (phase === "between" && session) {
    const next = session.sections[session.currentSection];
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center border border-slate-200">
          <div className="text-4xl mb-3">✓</div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Секция завершена</h2>
          {sectionResult?.auto && (
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm mb-4">
              Время секции вышло. Всё, что вы успели ответить, сохранено.
            </p>
          )}
          <p className="text-slate-600 mb-6">
            Следующая секция: <b>{next.title}</b>, {next.minutes} минут.
          </p>
          <button onClick={() => { setSectionResult(null); setPhase("exam"); }}
            className="w-full py-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg">
            Перейти к секции «{next.title}»
          </button>
          <p className="text-xs text-slate-400 mt-4">Таймер уже идёт — не задерживайтесь.</p>
        </div>
      </div>
    );
  }

  // ── Finished ─────────────────────────────────────────────────────────────
  if (phase === "final" && final) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-lg w-full text-center border border-slate-200">
          <div className="text-4xl mb-3">🎓</div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Экзамен сдан</h2>
          <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-5 mb-6">
            <div className="text-sm text-blue-900 mb-1">Номер вашей работы</div>
            <div className="text-4xl font-mono font-bold text-blue-700 tracking-widest">{shortIdRef.current}</div>
            <div className="text-xs text-blue-800 mt-2">
              Запишите или сфотографируйте. По этому номеру и вашей фамилии
              вы найдёте результат, когда школа его опубликует.
            </div>
          </div>
          <div className="grid gap-2 mb-6">
            {final.sections.map((s: any) => (
              <div key={s.key} className="flex justify-between items-center border border-slate-200 rounded-xl px-4 py-3">
                <span className="text-slate-700">{s.title}</span>
                <span className="font-mono font-bold text-slate-900">{s.correct} / {s.total}</span>
              </div>
            ))}
          </div>
          <p className="text-slate-600">
            Результат передан завучу. Решение о классе объявит школа — оно может отличаться
            от предварительного расчёта.
          </p>
        </div>
      </div>
    );
  }

  // ── Exam ─────────────────────────────────────────────────────────────────
  if (!session || !activeSection || !question) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Загрузка…</div>;
  }

  const lowTime = remaining !== null && remaining < 5 * 60000;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col select-none">
      {/* Top bar: section, clock, position */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 sticky top-0 z-20">
        <div className="text-sm text-slate-600 min-w-0">
          <span className="font-semibold text-slate-900">{activeSection.title}</span>
          <span className="hidden sm:inline"> · секция {session.currentSection + 1} из {session.sections.length}</span>
          {/* Имя и номер работы всё время на виду: результат ищется по номеру,
              и ученик должен запомнить его к концу экзамена, а не искать потом. */}
          <div className="text-xs text-slate-400 truncate">
            {studentName} · № <span className="font-mono font-semibold text-slate-600">{shortIdRef.current}</span>
          </div>
        </div>
        <div className={`font-mono font-bold text-lg tabular-nums px-3 py-1 rounded-lg ${
          lowTime ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-800"}`}>
          {remaining !== null ? formatClock(remaining) : "—"}
        </div>
        <div className="text-sm text-slate-500 tabular-nums">
          {cursor + 1} / {questions.length}
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 px-4 sm:px-6 py-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3 flex-wrap text-xs">
            <span className={`px-2 py-0.5 rounded-full font-semibold ${
              question.difficulty === 1 ? "bg-emerald-50 text-emerald-700"
              : question.difficulty === 2 ? "bg-amber-50 text-amber-700"
              : "bg-red-50 text-red-700"}`}>
              {DIFFICULTY_LABEL[question.difficulty] || "—"}
            </span>
            {question.topic && <span className="text-slate-500">Тема: {question.topic}</span>}
            <button onClick={() => toggleFlag(question.id)}
              className={`ml-auto font-semibold ${flags[question.id] ? "text-amber-600" : "text-slate-400 hover:text-slate-600"}`}>
              {flags[question.id] ? "⚑ Отмечен" : "⚐ Отметить"}
            </button>
          </div>

          <p className="text-lg sm:text-xl font-semibold text-slate-900 mb-5 leading-snug">{question.text}</p>

          {question.type === "text_input" ? (
            <div>
              <input
                value={answers[question.id] || ""}
                onChange={e => answer(question.id, e.target.value)}
                placeholder="Введите ответ"
                autoComplete="off" autoCorrect="off" spellCheck={false}
                className="w-full border border-slate-300 rounded-xl p-4 text-lg bg-white focus:border-blue-500 focus:outline-none" />
              <p className="text-xs text-slate-400 mt-2">
                Ответ засчитывается независимо от запятой или точки в десятичной дроби.
              </p>
            </div>
          ) : (
          <div className="grid gap-2">
            {question.options.map((opt, i) => {
              const letter = LETTERS[i];
              const selected = answers[question.id] === letter;
              return (
                <button key={i} onClick={() => answer(question.id, letter)}
                  className={`flex items-center gap-3 text-left p-3 rounded-xl border transition ${
                    selected ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                  <span className={`w-7 h-7 rounded-full grid place-items-center text-sm font-bold shrink-0 border ${
                    selected ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 text-slate-500"}`}>
                    {letter}
                  </span>
                  <span className="text-slate-800">{opt.replace(/^[А-ЯA-Z][).]\s*/, "")}</span>
                </button>
              );
            })}
          </div>
          )}

          <div className="flex gap-3 mt-6">
            <button onClick={() => setCursor(c => Math.max(0, c - 1))} disabled={cursor === 0}
              className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold disabled:opacity-40">
              Назад
            </button>
            {cursor < questions.length - 1 ? (
              <button onClick={() => setCursor(c => c + 1)}
                className="flex-1 px-5 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700">
                Далее
              </button>
            ) : (
              <button onClick={() => {
                  const unanswered = questions.length - answeredCount;
                  const msg = unanswered > 0
                    ? `Без ответа осталось вопросов: ${unanswered}. Завершить секцию?`
                    : "Завершить секцию?";
                  if (confirm(msg)) void finishSection();
                }}
                disabled={busy}
                className="flex-1 px-5 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50">
                {busy ? "Отправляем…" : "Завершить секцию"}
              </button>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</div>
          )}
        </div>
      </div>

      {/* Question map */}
      <div className="bg-white border-t border-slate-200 px-4 sm:px-6 py-3 sticky bottom-0">
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {questions.map((q, i) => {
              const done = answers[q.id] !== undefined && answers[q.id] !== "";
              const flagged = flags[q.id];
              const current = i === cursor;
              return (
                <button key={q.id} onClick={() => setCursor(i)}
                  className={`w-8 h-8 rounded-lg text-xs font-mono border transition ${
                    current ? "border-2 border-blue-600 text-blue-700 font-bold"
                    : flagged ? "border-amber-400 text-amber-700 font-bold"
                    : done ? "bg-blue-600 border-blue-600 text-white font-semibold"
                    : "border-slate-200 text-slate-400 hover:border-slate-300"}`}>
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="text-xs text-slate-500">
            Отвечено {answeredCount} из {questions.length}
            {Object.values(flags).some(Boolean) && " · отмеченные вопросы обведены жёлтым"}
          </div>
        </div>
      </div>
    </div>
  );
}
