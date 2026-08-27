import { useEffect, useState } from 'react';
import { collection, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Official proctoring dossier for one exam session: the session video, every
 * violation with its timestamp, and the snapshot captured at each violation.
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
  videoUrl?: string | null;
  videoPath?: string | null;
}

interface EvidenceSnapshot {
  type?: string;
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

const TYPE_LABEL: Record<string, string> = {
  PHONE_DETECTED: 'Обнаружен телефон',
  SPEECH_DETECTED: 'Разговор',
  WHISPER_DETECTED: 'Шёпот / подсказка',
  MULTIPLE_FACES: 'В кадре более одного человека',
  FACE_LOST: 'Лицо вне кадра',
  HEAD_TURN: 'Поворот головы',
  GAZE_AWAY: 'Взгляд в сторону',
  CAMERA_OFF: 'Камера отключена',
  HAND_SIGNAL: 'Жестовый сигнал',
  HAND_BELOW_DESK: 'Руки под столом',
  TAB_SWITCH: 'Переключение вкладки',
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

          {/* Video */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Видеозапись сессии
            </h3>
            {report.videoUrl ? (
              <video
                src={report.videoUrl}
                controls
                controlsList="nodownload"
                onContextMenu={(e) => e.preventDefault()}
                className="w-full rounded border border-slate-300 bg-black max-h-[420px]"
              />
            ) : (
              <p className="text-sm text-slate-500 border border-slate-200 rounded p-4">
                {report.unavailable
                  ? 'Запись не производилась — камера не была предоставлена.'
                  : 'Запись недоступна: загрузка видео не была завершена.'}
              </p>
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
                        {s.timestamp
                          ? ` · ${formatOffset(s.timestamp, report.startedAt)}`
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
              onClick={() => window.print()}
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
