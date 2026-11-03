import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, FileDown, Loader2, PlayCircle, Upload } from "lucide-react";
import ImportGuide from "./ImportGuide";
import { Modal, btn, btnPrimary, input } from "../journals/components/ui";
import type { DisciplineRow, SetRow } from "./examApi";
import { TYPE_LABEL, type QuestionType } from "../../../shared/exams";
import { downloadTemplate, readSheetFile } from "./bankSheets";

type Api = (path: string, init?: RequestInit) => Promise<any>;
type PreviewRow = { row: number; id: string | null; discipline: string; ok: boolean; type: QuestionType | null; text: string; options: number; answer: string; levels: string[]; sets: string[] };
type Report = { row: number; id: string | null; discipline: string; issues: { level: "error" | "warning"; message: string }[] }[];

/**
 * Загрузка вопросов таблицей: сначала проверка (что создастся, что
 * обновится, где ошибки), потом запись. Дисциплину, которой нет, можно
 * создать прямо здесь — задав ей название.
 */
export default function ImportModal({ api, disciplines, sets = [], defaultSet, onClose, onDone }: {
  api: Api; disciplines: DisciplineRow[]; sets?: SetRow[]; defaultSet?: string; onClose: () => void; onDone: () => void;
}) {
  const [setId, setSetId] = useState(defaultSet || "");
  const [guide, setGuide] = useState(false);
  const [file, setFile] = useState<{ name: string; header: string[]; rows: string[][] } | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [report, setReport] = useState<Report>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [tab, setTab] = useState<"table" | "issues">("table");
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ created: number; updated: number } | null>(null);

  const createDisciplines = Object.entries(names).filter(([, n]) => n.trim()).map(([code, name]) => ({ code, name }));

  const check = async (f = file, extraNames = names) => {
    if (!f) return;
    setBusy(true); setError(null);
    try {
      const j = await api("/import", { method: "POST", body: JSON.stringify({
        header: f.header, rows: f.rows, setId: setId || undefined,
        createDisciplines: Object.entries(extraNames).filter(([, n]) => n.trim()).map(([code, name]) => ({ code, name })),
      }) });
      setSummary(j.summary); setReport(j.report || []); setPreview(j.preview || []);
      setTab(j.summary.errors ? "issues" : "table");
      setNames(n => { const m = { ...n }; for (const c of j.summary.missingDisciplines) if (!(c in m)) m[c] = ""; return m; });
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const pick = async (fl?: File) => {
    if (!fl) return;
    setError(null); setSummary(null); setReport([]); setPreview([]); setNames({});
    try {
      const r = await readSheetFile(fl);
      if (!r.rows.length) { setError("В файле нет строк с вопросами"); return; }
      const f = { name: fl.name, ...r };
      setFile(f);
      await check(f, {});
    } catch (e: any) { setError(`Не удалось прочитать файл: ${e.message}`); }
  };

  const commit = async () => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const j = await api("/import", { method: "POST", body: JSON.stringify({ header: file.header, rows: file.rows, commit: true, createDisciplines, setId: setId || undefined }) });
      setDone({ created: j.created, updated: j.updated });
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const missing = Object.keys(names);
  const errorsLeft = summary ? summary.errors : 0;

  return (
    <Modal title="Загрузить вопросы таблицей" onClose={done ? onDone : onClose} wide>
      {done ? (
        <div className="py-8 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600" />
          <div className="font-semibold text-[var(--text-main)]">Загружено: новых {done.created}, обновлено {done.updated}</div>
          <button className={btnPrimary} onClick={onDone}>Готово</button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-[var(--text-muted)] space-y-1">
            <p>Excel (.xlsx) или CSV. Обязательные колонки — <b>Дисциплина</b> (код: {disciplines.map(d => d.code).join(", ") || "MAT, ENG…"}), <b>Вопрос</b> и <b>Правильный ответ</b>.</p>
            <p>Строка с <b>номером</b> (MAT-0042) обновит этот вопрос; без номера — создаст новый. Выгрузка банка в Excel — готовый образец для правки.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={btn} onClick={() => downloadTemplate(disciplines[0]?.code)}><FileDown className="w-4 h-4" /> Шаблон</button>
            <button className={`${btn} text-blue-600`} onClick={() => setGuide(true)}><PlayCircle className="w-4 h-4" /> Инструкция</button>
            <label className={btnPrimary}>
              <Upload className="w-4 h-4" /> {file ? "Другой файл" : "Выбрать файл"}
              <input type="file" accept=".xlsx,.csv,.tsv,.txt" className="hidden" onChange={e => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {file && <span className="text-sm text-[var(--text-muted)] self-center">{file.name} · {file.rows.length} строк</span>}
          </div>
          {sets.length > 0 && (
            <label className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-main)]">
              Добавить все загруженные вопросы в набор
              <select className={`${input} !w-auto`} value={setId} onChange={e => setSetId(e.target.value)}>
                <option value="">— не добавлять —</option>
                {sets.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
          )}

          {busy && !summary && <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" /></div>}

          {missing.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
              <div className="text-sm font-semibold text-amber-700">В таблице есть дисциплины, которых нет в банке. Дайте им названия — они будут созданы:</div>
              {missing.map(c => (
                <div key={c} className="flex items-center gap-2">
                  <span className="font-mono text-sm w-16">{c}</span>
                  <input className={`${input} flex-1`} value={names[c]} onChange={e => setNames(n => ({ ...n, [c]: e.target.value }))} placeholder="Название, например «Физика»" />
                </div>
              ))}
              <button className={btn} disabled={busy} onClick={() => check()}>Проверить ещё раз</button>
            </div>
          )}

          {summary?.newSets?.length > 0 && (
            <div className="text-sm text-violet-700">Будут созданы наборы из колонки «Наборы»: {summary.newSets.map((n: string) => `«${n}»`).join(", ")}</div>
          )}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {[["Новых", summary.create, "text-emerald-600"], ["Обновится", summary.update, "text-sky-600"], ["С ошибками", summary.errors, "text-rose-600"], ["С замечаниями", summary.warnings, "text-amber-600"]].map(([t, v, c]) => (
                <div key={t as string} className="rounded-lg border border-[var(--border-color)] p-2">
                  <div className={`text-2xl font-bold tabular-nums ${c}`}>{v as number}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">{t as string}</div>
                </div>
              ))}
            </div>
          )}

          {preview.length > 0 && (
            <div className="flex gap-1.5">
              <button className={`px-3 py-1.5 rounded-full text-xs font-medium border ${tab === "table" ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border-color)]"}`} onClick={() => setTab("table")}>Как прочитались вопросы</button>
              {report.length > 0 && <button className={`px-3 py-1.5 rounded-full text-xs font-medium border ${tab === "issues" ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border-color)]"}`} onClick={() => setTab("issues")}>Ошибки и замечания ({report.length})</button>}
            </div>
          )}
          {tab === "table" && preview.length > 0 && (
            <div className="max-h-72 overflow-auto rounded-lg border border-[var(--border-color)]">
              <table className="w-full text-xs min-w-[720px]">
                <thead className="sticky top-0 bg-[var(--bg-panel)] text-[10px] uppercase font-mono text-[var(--text-muted)]">
                  <tr>{["Стр.", "Номер", "Дисц.", "Тип", "Вопрос", "Вар.", "Ответ", "Классы"].map(h => <th key={h} className="px-2 py-1.5 text-left">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.map(r => (
                    <tr key={r.row} className={`border-t border-[var(--border-color)] ${r.ok ? "" : "bg-rose-500/5 text-rose-700"}`}>
                      <td className="px-2 py-1.5 tabular-nums text-[var(--text-muted)]">{r.row}</td>
                      <td className="px-2 py-1.5 font-mono whitespace-nowrap">{r.id || <span className="text-emerald-700">новый</span>}</td>
                      <td className="px-2 py-1.5 font-mono">{r.discipline}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.type ? TYPE_LABEL[r.type] : "—"}</td>
                      <td className="px-2 py-1.5 max-w-[280px]"><div className="line-clamp-2">{r.text || "—"}</div></td>
                      <td className="px-2 py-1.5 tabular-nums text-center">{r.options || ""}</td>
                      <td className="px-2 py-1.5 max-w-[140px] truncate text-emerald-700">{r.ok ? r.answer : "ошибка"}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.levels.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {summary && summary.rows > preview.length && <div className="px-3 py-2 text-[11px] text-[var(--text-muted)]">Показаны первые {preview.length} из {summary.rows} строк</div>}
            </div>
          )}

          {tab === "issues" && report.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--border-color)] divide-y divide-[var(--border-color)]">
              {report.map(r => (
                <div key={r.row} className="px-3 py-2 text-xs">
                  <span className="font-mono text-[var(--text-muted)]">строка {r.row}{r.id ? ` · ${r.id}` : ""}</span>
                  {r.issues.map((i, k) => (
                    <div key={k} className={i.level === "error" ? "text-rose-600" : "text-amber-600"}>
                      <AlertTriangle className="inline w-3 h-3 mr-1 -mt-0.5" />{i.message}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {error && <div className="text-sm text-rose-600">{error}</div>}
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
            <button className={btn} onClick={onClose}>Отмена</button>
            <button className={btnPrimary} disabled={busy || !summary || errorsLeft > 0 || (summary.create + summary.update) === 0} onClick={commit}
              title={errorsLeft ? "Исправьте строки с ошибками в файле" : ""}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Загрузить {summary ? summary.create + summary.update : ""}
            </button>
          </div>
        </div>
      )}
      {guide && <ImportGuide disciplineCode={disciplines[0]?.code} onClose={() => setGuide(false)} />}
    </Modal>
  );
}
