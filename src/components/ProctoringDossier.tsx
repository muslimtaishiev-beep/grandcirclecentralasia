import { useEffect, useState } from 'react';
import { collection, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Official proctoring dossier for one exam session: every violation with its
 * timestamp, and the snapshot captured at the moment of each one.
 *
 * There is deliberately no session video — storing 90-minute recordings needs
 * Firebase Storage, which requires the Blaze plan. Snapshots carry the evidence
 * a manager actually acts on and live in Firestore at no cost.
 *
 * The violation list lives on the submission document (read with the students),
 * but the snapshots are in `proctoring_evidence/ev_{shortId}` — base64 frames
 * would bloat the submission, which is re-read on every dashboard render — so
 * they are fetched lazily, only when a manager actually opens this dossier.
 */

export interface ProctoringViolation {
  type: string;
  severity: string;
  description: string;
  atMs: number;
}

export interface ProctoringReport {
  generatedAt?: any;
  startedAt?: number | null;
  endedAt?: number | null;
  unavailable?: boolean;
  honestyIndex?: number | null;
  totalViolations?: number;
  bySeverity?: Record<string, number>;
  violations?: ProctoringViolation[];
  snapshotCount?: number;
}

interface EvidenceSnapshot {
  type?: string;
  // The server stores the offset as `atMs` (see /api/exams/proctoring-report);
  // `timestamp` is only accepted for older evidence documents.
  atMs?: number;
  timestamp?: number;
  dataUrl?: string;
  image?: string;
}

interface Props {
  shortId: string;
  studentName: string;
  grade?: string;
  report: ProctoringReport;
  onClose: () => void;
}

const SEVERITY_LABEL: Record<string, string> = {
  HIGH: 'Грубое',
  MEDIUM: 'Среднее',
  LOW: 'Незначительное',
};

const SEVERITY_CLASS: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-800 border-red-200',
  MEDIUM: 'bg-amber-100 text-amber-800 border-amber-200',
  LOW: 'bg-slate-100 text-slate-700 border-slate-200',
};

// Keys must match ProctoringEvent['type'] in useProctoringEngine.ts exactly.
// An earlier version of this map invented names (GAZE_AWAY, HAND_SIGNAL,
// MULTIPLE_FACES...) that the engine never emits, so real violations printed
// as raw English enum names in the manager's protocol.
const TYPE_LABEL: Record<string, string> = {
  PHONE_DETECTED: 'Обнаружен телефон',
  BOOK_DETECTED: 'Обнаружена книга или конспект',
  SPEECH_CHEAT_DETECTED: 'Разговор или просьба о помощи',
  GESTURE_SIGNAL_DETECTED: 'Сигнал пальцами',
  SWIPE: 'Жест рукой',
  HAND_BELOW: 'Руки вне поля зрения',
  EXTRA_FACE: 'В кадре второй человек',
  FACE_LOST: 'Лицо вне кадра',
  GAZE_LEFT: 'Взгляд в сторону (влево)',
  GAZE_RIGHT: 'Взгляд в сторону (вправо)',
  CAMERA_OFF: 'Камера отключена',
  PASTE_DETECTED: 'Вставка текста из буфера',
  TAB_SWITCH: 'Переключение вкладки',
  LIGHT_ANOMALY: 'Изменение освещения',
  SILENT_LIP_SPEAKING_DETECTED: 'Беззвучная артикуляция',
  FAST_ANSWER: 'Подозрительно быстрый ответ',
};

/** Offset from exam start as mm:ss — the manager scrubs the video to it. */
function formatOffset(atMs: number, startedAt?: number | null): string {
  const base = startedAt && atMs > startedAt ? atMs - startedAt : atMs;
  const total = Math.max(0, Math.floor(base / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function formatClock(ms?: number | null): string {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatDuration(startedAt?: number | null, endedAt?: number | null): string {
  if (!startedAt || !endedAt || endedAt <= startedAt) return '—';
  const total = Math.floor((endedAt - startedAt) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h} ч ${m} мин ${s} с` : `${m} мин ${s} с`;
}

export default function ProctoringDossier({ shortId, studentName, grade, report, onClose }: Props) {
  const [snapshots, setSnapshots] = useState<EvidenceSnapshot[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!report.snapshotCount) return;
    setLoadingEvidence(true);
    (async () => {
      try {
        const snap = await getDoc(doc(collection(db, 'proctoring_evidence'), `ev_${shortId}`));
        if (cancelled) return;
        const data = snap.exists() ? snap.data() : null;
        setSnapshots(Array.isArray(data?.snapshots) ? data!.snapshots : []);
      } catch (e: any) {
        if (!cancelled) setEvidenceError(e?.message || 'Не удалось загрузить снимки');
      } finally {
        if (!cancelled) setLoadingEvidence(false);
      }
    })();
    return () => { cancelled = true; };
  }, [shortId, report.snapshotCount]);

  const violations = report.violations || [];

  // window.print() prints the whole document, and this modal is a fixed,
  // scrolling overlay on top of the dashboard — printing it directly produced
  // the roster behind it, or one clipped screenful. Rendering the protocol into
  // its own window sidesteps the dashboard's layout entirely and gives the
  // manager a clean document to print or save as PDF.
  const openPrintable = () => {
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) {
      alert("Браузер заблокировал окно печати. Разрешите всплывающие окна для этого сайта.");
      return;
    }
    const esc = (v: any) => String(v ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const verdict = report.unavailable
      ? "Видеонаблюдение не велось — камера не была предоставлена экзаменуемым."
      : violations.length === 0
        ? "За время сессии нарушений не зафиксировано."
        : `Зафиксировано нарушений: ${violations.length}` +
          (high ? ` · грубых: ${high}` : "") + (medium ? ` · средних: ${medium}` : "") +
          (typeof report.honestyIndex === "number"
            ? `. Индекс добросовестности: ${report.honestyIndex} из 100.` : ".");

    w.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8">
      <title>Протокол ${esc(shortId)} — ${esc(studentName)}</title>
      <style>
        @page { margin: 16mm; }
        body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f172a; margin: 0; }
        h1 { font-size: 18px; text-transform: uppercase; letter-spacing: .04em; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
        h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #64748b; margin-top: 22px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; page-break-inside: auto; }
        th { text-align: left; border-bottom: 2px solid #cbd5e1; padding: 6px 8px 6px 0; }
        td { border-bottom: 1px solid #f1f5f9; padding: 6px 8px 6px 0; vertical-align: top; }
        tr { page-break-inside: avoid; }
        .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 32px; font-size: 13px; }
        .facts div { display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding: 3px 0; }
        .facts span:first-child { color: #64748b; }
        .verdict { border: 1px solid #cbd5e1; background: #f8fafc; padding: 12px; border-radius: 4px; font-size: 13px; }
        .shots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        figure { margin: 0; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; page-break-inside: avoid; }
        figure img { width: 100%; display: block; }
        figcaption { font-size: 10px; padding: 3px 5px; background: #f8fafc; color: #475569; }
        .mono { font-family: ui-monospace, monospace; }
        footer { margin-top: 28px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
      </style></head><body>
      <h1>Протокол наблюдения за экзаменом</h1>
      <h2>Сведения о сессии</h2>
      <div class="facts">
        <div><span>Экзаменуемый</span><span><b>${esc(studentName)}</b></span></div>
        <div><span>Идентификатор</span><span class="mono">${esc(shortId)}</span></div>
        <div><span>Класс</span><span>${esc(grade || "—")}</span></div>
        <div><span>Продолжительность</span><span>${esc(formatDuration(report.startedAt, report.endedAt))}</span></div>
        <div><span>Начало</span><span>${esc(formatClock(report.startedAt))}</span></div>
        <div><span>Окончание</span><span>${esc(formatClock(report.endedAt))}</span></div>
      </div>
      <h2>Заключение</h2>
      <p class="verdict">${esc(verdict)}</p>
      ${violations.length ? `<h2>Журнал нарушений</h2>
      <table><thead><tr><th style="width:64px">Время</th><th>Нарушение</th><th>Описание</th><th style="width:90px">Категория</th></tr></thead>
      <tbody>${violations.map(v => `<tr>
        <td class="mono">${esc(formatOffset(v.atMs, report.startedAt))}</td>
        <td>${esc(TYPE_LABEL[v.type] || v.type)}</td>
        <td style="color:#475569">${esc(v.description || "—")}</td>
        <td>${esc(SEVERITY_LABEL[v.severity] || v.severity)}</td></tr>`).join("")}</tbody></table>` : ""}
      ${snapshots.length ? `<h2>Снимки момента нарушения (${snapshots.length})</h2>
      <div class="shots">${snapshots.map((sn, i) => {
        const src = sn.dataUrl || sn.image;
        if (!src) return "";
        const at = sn.atMs ?? sn.timestamp;
        return `<figure><img src="${src}" alt="Снимок ${i + 1}"><figcaption>${esc(TYPE_LABEL[sn.type || ""] || sn.type || "Снимок")}${typeof at === "number" ? " · " + esc(formatOffset(at, report.startedAt)) : ""}</figcaption></figure>`;
      }).join("")}</div>` : ""}
      <footer>Документ сформирован автоматически системой прокторинга и не требует подписи.</footer>
      </body></html>`);
    w.document.close();
    // Wait for the base64 snapshots to decode, or the print dialog opens over
    // a page of blank frames.
    w.onload = () => setTimeout(() => { w.focus(); w.print(); }, 400);
  };
  const high = report.bySeverity?.HIGH || 0;
  const medium = report.bySeverity?.MEDIUM || 0;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 flex items-start justify-center overflow-y-auto p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl max-w-4xl w-full my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Official header */}
        <div className="border-b-2 border-slate-800 px-8 py-6 print:border-black">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 uppercase tracking-wide">
                Протокол наблюдения за экзаменом
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Автоматическая система прокторинга · документ сформирован системой
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-2xl leading-none print:hidden"
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Session facts */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Сведения о сессии
            </h3>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex justify-between border-b border-slate-100 py-1">
                <dt className="text-slate-500">Экзаменуемый</dt>
                <dd className="font-medium text-slate-900">{studentName}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-1">
                <dt className="text-slate-500">Идентификатор</dt>
                <dd className="font-mono text-slate-900">{shortId}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-1">
                <dt className="text-slate-500">Класс</dt>
                <dd className="font-medium text-slate-900">{grade || '—'}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-1">
                <dt className="text-slate-500">Продолжительность</dt>
                <dd className="font-medium text-slate-900">
                  {formatDuration(report.startedAt, report.endedAt)}
                </dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-1">
                <dt className="text-slate-500">Начало</dt>
                <dd className="text-slate-900">{formatClock(report.startedAt)}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-1">
                <dt className="text-slate-500">Окончание</dt>
                <dd className="text-slate-900">{formatClock(report.endedAt)}</dd>
              </div>
            </dl>
          </section>

          {/* Verdict */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Заключение
            </h3>
            {report.unavailable ? (
              <div className="border border-slate-300 bg-slate-50 rounded p-4 text-sm text-slate-700">
                Видеонаблюдение в ходе сессии <strong>не велось</strong> — камера не была
                предоставлена экзаменуемым. Работа принята без прокторинга; настоящий
                протокол не содержит сведений о нарушениях, поскольку наблюдение
                не осуществлялось.
              </div>
            ) : violations.length === 0 ? (
              <div className="border border-emerald-300 bg-emerald-50 rounded p-4 text-sm text-emerald-900">
                За время сессии нарушений не зафиксировано. Наблюдение велось на
                протяжении всей работы.
              </div>
            ) : (
              <div className="border border-amber-300 bg-amber-50 rounded p-4">
                <p className="text-sm text-amber-900">
                  Зафиксировано нарушений: <strong>{violations.length}</strong>
                  {high > 0 && <> · из них грубых: <strong>{high}</strong></>}
                  {medium > 0 && <> · средних: <strong>{medium}</strong></>}
                </p>
                {typeof report.honestyIndex === 'number' && (
                  <p className="text-sm text-amber-900 mt-1">
                    Индекс добросовестности: <strong>{report.honestyIndex}</strong> из 100
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Violations log */}
          {violations.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Журнал нарушений
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-300 text-left">
                      <th className="py-2 pr-4 font-semibold text-slate-600 w-20">Время</th>
                      <th className="py-2 pr-4 font-semibold text-slate-600">Нарушение</th>
                      <th className="py-2 pr-4 font-semibold text-slate-600">Описание</th>
                      <th className="py-2 font-semibold text-slate-600 w-32">Категория</th>
                    </tr>
                  </thead>
                  <tbody>
                    {violations.map((v, i) => (
                      <tr key={i} className="border-b border-slate-100 align-top">
                        <td className="py-2 pr-4 font-mono text-slate-700">
                          {formatOffset(v.atMs, report.startedAt)}
                        </td>
                        <td className="py-2 pr-4 text-slate-900">
                          {TYPE_LABEL[v.type] || v.type}
                        </td>
                        <td className="py-2 pr-4 text-slate-600">{v.description || '—'}</td>
                        <td className="py-2">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs border ${
                              SEVERITY_CLASS[v.severity] || SEVERITY_CLASS.LOW
                            }`}
                          >
                            {SEVERITY_LABEL[v.severity] || v.severity}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Snapshots */}
          {report.snapshotCount ? (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Снимки момента нарушения ({report.snapshotCount})
              </h3>
              {loadingEvidence && <p className="text-sm text-slate-500">Загрузка снимков…</p>}
              {evidenceError && (
                <p className="text-sm text-red-600">Ошибка: {evidenceError}</p>
              )}
              {!loadingEvidence && !evidenceError && snapshots.length === 0 && (
                <p className="text-sm text-slate-500">Снимки не найдены в архиве.</p>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {snapshots.map((s, i) => {
                  const src = s.dataUrl || s.image;
                  if (!src) return null;
                  return (
                    <figure key={i} className="border border-slate-200 rounded overflow-hidden">
                      <img src={src} alt={`Снимок ${i + 1}`} className="w-full block" />
                      <figcaption className="text-xs text-slate-600 px-2 py-1 bg-slate-50">
                        {TYPE_LABEL[s.type || ''] || s.type || 'Снимок'}
                        {typeof (s.atMs ?? s.timestamp) === 'number'
                          ? ` · ${formatOffset((s.atMs ?? s.timestamp)!, report.startedAt)}`
                          : ''}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        <div className="border-t border-slate-200 px-8 py-4 flex justify-between items-center print:hidden">
          <p className="text-xs text-slate-400">
            Документ сформирован автоматически и не требует подписи.
          </p>
          <div className="flex gap-2">
            <button
              onClick={openPrintable}
              className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Печать / PDF
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded bg-slate-800 text-white hover:bg-slate-700"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
