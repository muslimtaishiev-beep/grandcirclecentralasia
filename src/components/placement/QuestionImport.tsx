import { useRef, useState } from "react";
import { auth } from "../../lib/firebase";

/**
 * Загрузка банка вопросов с предпросмотром.
 *
 * The file is parsed on the server and shown back BEFORE anything is written.
 * A question that arrives malformed and gets imported silently becomes a
 * question no student can answer correctly — discovered only after the exam —
 * so every row is classified and the manager confirms with the damage in view.
 *
 * Broken rows are never importable. Rows with warnings can be imported
 * deliberately and fixed later in the bank, which is usually what a manager
 * wants at 2am the night before an exam.
 */

type Row = {
  row: number; id: string; generatedId: boolean;
  subject: string; grades: number[]; topic: string; difficulty: number;
  type: string; text: string; options: string[]; answer: string;
  status: "ok" | "warning" | "error"; issues: string[];
};
type Report = {
  questions: Row[]; ok: number; warnings: number; errors: number;
  fatal: string[]; byBucket: Record<string, number>;
};

async function authHeaders(): Promise<Record<string, string>> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const SUBJECT_LABEL: Record<string, string> = { math: "математика", english: "английский" };
const TYPE_LABEL: Record<string, string> = { multiple_choice: "выбор варианта", text_input: "вписать ответ" };

export default function QuestionImport({ tenantId, onImported }: { tenantId: string; onImported: () => void }) {
  const [csv, setCsv] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [acceptWarnings, setAcceptWarnings] = useState(false);
  const [filter, setFilter] = useState<"all" | "problems">("problems");
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFile = async (file: File) => {
    setError(null); setDone(null); setReport(null);
    if (file.size > 4 * 1024 * 1024) { setError("Файл больше 4 МБ — разделите его на части."); return; }
    const text = await file.text();
    setCsv(text); setFileName(file.name);
    await preview(text);
  };

  const preview = async (text: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/placement/preview", {
        method: "POST", headers: await authHeaders(),
        body: JSON.stringify({ tenantId, csv: text }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Не удалось разобрать файл."); return; }
      setReport(data);
      setFilter(data.errors + data.warnings > 0 ? "problems" : "all");
    } catch (e: any) {
      setError("Не удалось отправить файл на проверку.");
    } finally { setBusy(false); }
  };

  const doImport = async () => {
    if (!report) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/placement/import", {
        method: "POST", headers: await authHeaders(),
        body: JSON.stringify({ tenantId, csv, includeWarnings: acceptWarnings }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Не удалось импортировать."); return; }
      setDone(
        `Загружено вопросов: ${data.written}.` +
        (data.needsReview ? ` Из них ${data.needsReview} помечены «требует проверки».` : "") +
        (data.skipped ? ` Пропущено с ошибками: ${data.skipped}.` : ""));
      setReport(null); setCsv(""); setFileName("");
      onImported();
    } catch (e: any) {
      setError("Не удалось импортировать — нет связи с сервером.");
    } finally { setBusy(false); }
  };

  const shown = report
    ? (filter === "problems" ? report.questions.filter(q => q.status !== "ok") : report.questions)
    : [];
  const importable = report ? report.ok + (acceptWarnings ? report.warnings : 0) : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="font-bold text-slate-900 mb-1">Загрузка вопросов</h3>
      <p className="text-sm text-slate-500 mb-4">
        Файл CSV из шаблона школы. Перед записью система разберёт его и покажет,
        что попадёт в банк — импорт начнётся только после вашего подтверждения.
      </p>

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <input ref={inputRef} type="file" accept=".csv,text/csv,text/plain" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void pickFile(f); }} />
        <button onClick={() => inputRef.current?.click()} disabled={busy}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 disabled:opacity-50">
          {busy && !report ? "Разбираем…" : "Выбрать файл"}
        </button>
        {fileName && <span className="text-sm text-slate-500">{fileName}</span>}
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800 mb-4">{error}</div>}
      {done && <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800 mb-4">{done}</div>}

      {report?.fatal?.length ? (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          <b>Файл не подходит:</b>
          <ul className="mt-1 ml-4 list-disc">{report.fatal.map(f => <li key={f}>{f}</li>)}</ul>
        </div>
      ) : null}

      {report && !report.fatal.length && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              ["Готовы к загрузке", report.ok, "text-emerald-700 bg-emerald-50 border-emerald-200"],
              ["Требуют внимания", report.warnings, "text-amber-700 bg-amber-50 border-amber-200"],
              ["С ошибками", report.errors, "text-red-700 bg-red-50 border-red-200"],
            ].map(([l, v, cls]) => (
              <div key={String(l)} className={`border rounded-xl p-3 ${v ? cls : "border-slate-200 text-slate-400"}`}>
                <div className="text-2xl font-bold tabular-nums">{v as number}</div>
                <div className="text-xs">{l}</div>
              </div>
            ))}
          </div>

          {Object.keys(report.byBucket).length > 0 && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 mb-4 text-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Пополнение банка</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-700">
                {Object.entries(report.byBucket).sort().map(([k, n]) => (
                  <span key={k}>{k}: <b className="tabular-nums">{n}</b></span>
                ))}
              </div>
            </div>
          )}

          {report.errors > 0 && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-900 mb-4">
              Строки с ошибками <b>не будут загружены</b> — их нельзя ни показать ученику,
              ни проверить. Исправьте их в файле и загрузите заново.
            </div>
          )}

          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <div className="flex gap-1">
              {([["problems", `Проблемные (${report.warnings + report.errors})`],
                 ["all", `Все строки (${report.questions.length})`]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setFilter(k)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    filter === k ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden mb-4 max-h-96 overflow-y-auto">
            {shown.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                {filter === "problems" ? "Проблемных строк нет — файл разобран полностью." : "Пусто."}
              </div>
            ) : shown.map(q => (
              <div key={q.row} className={`p-3 border-b border-slate-100 last:border-0 ${
                q.status === "error" ? "bg-red-50/50" : q.status === "warning" ? "bg-amber-50/40" : ""}`}>
                <div className="flex items-start gap-2 flex-wrap text-xs mb-1">
                  <span className="font-mono text-slate-400">стр. {q.row}</span>
                  <span className={`px-2 py-0.5 rounded font-semibold ${
                    q.status === "error" ? "bg-red-100 text-red-700"
                    : q.status === "warning" ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"}`}>
                    {q.status === "error" ? "не загрузится" : q.status === "warning" ? "проверьте" : "готов"}
                  </span>
                  <span className="text-slate-500">
                    {SUBJECT_LABEL[q.subject] || "?"} · сложн. {q.difficulty || "?"} · {TYPE_LABEL[q.type] || q.type}
                    {q.grades.length ? ` · ${q.grades.join(", ")} кл.` : ""}
                  </span>
                  <span className="font-mono text-slate-400 ml-auto">
                    {q.id}{q.generatedId && <span className="text-blue-500"> (ID создан)</span>}
                  </span>
                </div>
                <div className="text-sm text-slate-800 mb-1">{q.text || <i className="text-red-600">пустой вопрос</i>}</div>
                {q.options.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600 mb-1">
                    {q.options.map((o, i) => {
                      const letter = ["А", "Б", "В", "Г", "Д", "Е"][i];
                      const right = letter === q.answer;
                      return <span key={i} className={right ? "text-emerald-700 font-semibold" : ""}>
                        {o}{right && " ✓"}
                      </span>;
                    })}
                  </div>
                )}
                {q.type === "text_input" && q.answer && (
                  <div className="text-xs text-slate-600 mb-1">Ответ: <b className="text-emerald-700">{q.answer}</b></div>
                )}
                {q.issues.length > 0 && (
                  <ul className="text-xs mt-1 ml-4 list-disc text-slate-600">
                    {q.issues.map((iss, i) => <li key={i}>{iss}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {report.warnings > 0 && (
            <label className="flex items-start gap-2 mb-4 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={acceptWarnings} onChange={e => setAcceptWarnings(e.target.checked)}
                className="mt-0.5" />
              <span>
                Загрузить также {report.warnings} вопр. с замечаниями. Они будут помечены
                «требует проверки» — их можно поправить в банке в любой момент,
                но <b>ученики увидят их уже сейчас</b>.
              </span>
            </label>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={doImport} disabled={busy || importable === 0}
              className={`px-5 py-3 rounded-xl font-bold text-white ${
                busy || importable === 0 ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}>
              {busy ? "Загружаем…" : `Загрузить ${importable} вопр. в банк`}
            </button>
            <button onClick={() => { setReport(null); setCsv(""); setFileName(""); }}
              className="px-4 py-3 rounded-xl border border-slate-300 text-slate-600 text-sm font-semibold">
              Отмена
            </button>
          </div>
        </>
      )}
    </div>
  );
}
