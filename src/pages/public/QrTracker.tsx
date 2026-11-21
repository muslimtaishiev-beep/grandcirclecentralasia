import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Ticket } from 'lucide-react';
import FancyQr, { QR_THEMES } from '../../components/forms/FancyQr';
import PublicBrand from '../../components/public/PublicBrand';
import { Spinner } from '../../components/ui';
import type { ResultPageView } from '../../shared/resultPages';

const ResultExperience = lazy(() => import('../../components/resultPage/ResultExperience'));

interface HistoryItem { status: string; label: string; color?: string; at: any; note: string }
interface Submission {
  code: string; formTitle: string; applicantName: string;
  status: string; statusId?: string; statusLabel: string; statusColor?: string;
  mode: 'application' | 'ticket'; ticketActive: boolean; checkedInAt: any; createdAt: any;
  history: HistoryItem[];
}

const toMs = (t: any): number => (t?._seconds ? t._seconds * 1000 : t?.seconds ? t.seconds * 1000 : t ? Date.parse(t) : NaN);
const fmtDate = (t: any) => { const ms = toMs(t); return Number.isFinite(ms) ? new Date(ms).toLocaleDateString('ru-RU') : ''; };
const fmtTime = (t: any) => { const ms = toMs(t); return Number.isFinite(ms) ? new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''; };

/** Страница отслеживания заявки по QR: письмо-страница состояния или аккуратный трекер с билетом. */
export default function QrTracker() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [org, setOrg] = useState<any | null>(null);
  const [page, setPage] = useState<ResultPageView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTracker, setShowTracker] = useState(false);

  useEffect(() => {
    if (!qrToken) return;
    setLoading(true);
    // Через сервер: заявитель анонимен, Firestore ему закрыт. Сервер отдаёт
    // только своё: имя, состояние, даты и страницу этого состояния.
    (async () => {
      try {
        const res = await fetch(`/api/forms/track/${encodeURIComponent(qrToken)}`);
        const j = await res.json();
        if (!j.success) { setError(j.error || 'Заявка по данному коду не найдена'); return; }
        setSubmission(j.submission);
        setPage(j.page || null);
        if (j.org) setOrg(j.org);
      } catch {
        setError('Нет связи с сервером. Проверьте интернет и попробуйте снова.');
      } finally {
        setLoading(false);
      }
    })();
  }, [qrToken]);

  const ticketWord: string = org?.tickets?.ticketWord || 'Билет';

  if (!loading && submission && page && !showTracker) {
    return (
      <Suspense fallback={<div className="min-h-dvh grid place-items-center bg-slate-950"><Spinner /></div>}>
        <ResultExperience variant={page.variant} data={page.data} org={{ name: org?.name || '', logoUrl: org?.logoUrl || null }} mode="live" />
        {submission.ticketActive && (
          <button type="button" onClick={() => setShowTracker(true)}
            className="fixed bottom-4 right-4 z-[70] inline-flex items-center gap-2 rounded-full bg-slate-900/90 text-white px-4 py-2.5 text-sm font-semibold shadow-xl backdrop-blur">
            <Ticket className="w-4 h-4" /> {ticketWord}
          </button>
        )}
      </Suspense>
    );
  }

  const color = submission?.statusColor || '#3b82f6';
  const history = submission?.history || [];
  const checkedIn = submission?.status === 'checked_in';

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
      <PublicBrand name={org?.name} logoUrl={org?.logoUrl} dark />

      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="py-16 grid place-items-center"><Spinner /></div>
        ) : error ? (
          <div className="py-10 px-6 text-center space-y-3">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <div className="font-bold text-sm text-red-400">{error}</div>
            {org?.tickets?.supportPhone && <div className="text-xs text-slate-400">{org.tickets.supportPhone}</div>}
          </div>
        ) : submission && (
          <>
            {/* Шапка в цвете текущего состояния */}
            <div className="px-6 pt-6 pb-5" style={{ background: `linear-gradient(160deg, ${color}33, transparent 70%)` }}>
              {page && (
                <button type="button" onClick={() => setShowTracker(false)} className="mb-3 inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white">
                  <ArrowLeft className="w-3.5 h-3.5" /> Назад
                </button>
              )}
              <div className="text-xs text-slate-400">{submission.formTitle}</div>
              <h1 className="mt-1 text-2xl font-extrabold text-white leading-tight">{submission.applicantName || 'Без имени'}</h1>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold" style={{ background: `${color}26`, color, border: `1px solid ${color}55` }}>
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                {submission.statusLabel}
              </div>
            </div>

            <div className="px-6 pb-6 space-y-5">
              {submission.mode === 'ticket' && submission.ticketActive && (
                <div className="bg-white rounded-2xl p-5 text-center space-y-3">
                  <div className={`flex justify-center ${checkedIn ? 'opacity-30 grayscale' : ''}`}>
                    <FancyQr value={window.location.href} theme={QR_THEMES[0]} size={200} logo={org?.markUrl} />
                  </div>
                  <div className="font-mono text-lg font-bold tracking-widest text-slate-900">{submission.code}</div>
                  {checkedIn && (
                    <div className="text-xs font-bold text-emerald-600">Вход отмечен {fmtDate(submission.checkedInAt)} в {fmtTime(submission.checkedInAt)}</div>
                  )}
                </div>
              )}

              {/* Состояния заявки по порядку: последнее — текущее. */}
              <ol className="relative ml-2 border-l border-slate-700 space-y-4">
                {(history.length ? history : [{ status: submission.status, label: submission.statusLabel, color, at: submission.createdAt, note: '' }]).map((h, i, all) => {
                  const last = i === all.length - 1;
                  const c = h.color || '#64748b';
                  return (
                    <li key={i} className="pl-5 relative">
                      <span className="absolute -left-[7px] top-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900" style={{ background: c, boxShadow: last ? `0 0 0 4px ${c}33` : undefined }} />
                      <div className="flex items-baseline justify-between gap-3">
                        <span className={last ? 'font-bold text-white' : 'font-medium text-slate-300'}>{h.label}</span>
                        <span className="text-[11px] text-slate-500 tabular-nums shrink-0">{fmtDate(h.at)}</span>
                      </div>
                      {h.note && <div className="mt-1.5 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 whitespace-pre-wrap" style={{ borderLeft: `2px solid ${c}` }}>{h.note}</div>}
                    </li>
                  );
                })}
              </ol>

              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono border-t border-slate-800 pt-3">
                <span>{submission.code}</span>
                <span>{org?.name || ''}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
