import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QrCode, CheckCircle2, Clock, ShieldCheck, AlertCircle, Building2, ArrowLeft, Loader2, Award, Calendar, FileText } from 'lucide-react';
import FancyQr, { QR_THEMES } from '../../components/forms/FancyQr';


/** Дата из Firestore Timestamp, который пришёл по сети как {_seconds}. */
function fmtDate(t: any): string {
  const ms = t?._seconds ? t._seconds * 1000 : t?.seconds ? t.seconds * 1000 : t ? Date.parse(t) : NaN;
  return Number.isFinite(ms) ? new Date(ms).toLocaleDateString("ru-RU") : "—";
}

function fmtTime(t: any): string {
  const ms = t?._seconds ? t._seconds * 1000 : t?.seconds ? t.seconds * 1000 : t ? Date.parse(t) : NaN;
  return Number.isFinite(ms)
    ? new Date(ms).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : "—";
}

export default function QrTracker() {
  const { qrToken } = useParams<{ qrToken: string }>();

  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<any | null>(null);
  const [org, setOrg] = useState<any | null>(null);
  const ticketWord: string = org?.tickets?.ticketWord || "Билет";
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    if (!qrToken) return;

    setLoading(true);
    // Через сервер, а не напрямую в Firestore: правила требуют доступа к
    // тенанту, а заявитель анонимен — с клиента этот запрос всегда падал с
    // permission-denied. Сервер отдаёт только то, что можно показать
    // постороннему: статус, даты и его собственное имя.
    const fetchByQr = async () => {
      try {
        const res = await fetch(`/api/forms/track/${encodeURIComponent(qrToken)}`);
        const j = await res.json();
        if (!j.success) {
          setError(j.error || 'Заявка по данному QR-коду не найдена в системе');
          return;
        }
        setSubmission(j.submission);
        if (j.org) setOrg(j.org);
      } catch (err: any) {
        setError('Нет связи с сервером. Проверьте интернет и попробуйте снова.');
      } finally {
        setLoading(false);
      }
    };

    fetchByQr();
  }, [qrToken]);


  // Подпись берём из общего модуля статусов (сервер шлёт statusLabel) —
  // раньше здесь жила третья независимая копия подписей, и статус
  // «Гость пришёл» показывался как «Новая Заявка (Получена)».
  const getStatusBadge = (status: string) => {
    const styles: Record<string, { color: string; icon: any }> = {
      approved:   { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
      paid:       { color: 'bg-teal-500/20 text-teal-400 border-teal-500/30', icon: CheckCircle2 },
      checked_in: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: ShieldCheck },
      testing:    { color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Award },
      review:     { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
      waitlist:   { color: 'bg-slate-500/20 text-slate-300 border-slate-500/30', icon: Clock },
      rejected:   { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: AlertCircle },
      cancelled:  { color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: AlertCircle },
    };
    const st = styles[status] || { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Clock };
    return { label: submission?.statusLabel || status, ...st };
  };

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
      
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-500" />
            <span className="font-bold text-sm tracking-wide text-slate-200">{org?.tickets?.publicTitle || org?.name || "Проверка заявки"}</span>
          </div>
          <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/30">
            VERIFIED
          </span>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <span>Проверка QR-паспорта в системе...</span>
          </div>
        ) : error ? (
          <div className="py-8 text-center space-y-3">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <div className="font-bold text-sm text-red-400">{error}</div>
            <p className="text-xs text-slate-400">
              Проверьте правильность ссылки{org?.tickets?.supportPhone ? ` или позвоните: ${org.tickets.supportPhone}` : " или обратитесь к организатору"}
            </p>
          </div>
        ) : submission && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Applicant Banner */}
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-2 text-center">
              <div className="text-[10px] uppercase font-mono font-bold text-slate-400">Заявитель</div>
              <h2 className="text-xl font-extrabold text-white">{submission.applicantName || 'Без имени'}</h2>
              <div className="text-xs font-mono text-emerald-400 font-bold">{submission.formTitle || 'Заявка'}</div>
            </div>

            {/* Live Status Pass Card */}
            {(() => {
              const badge = getStatusBadge(submission.status);
              const Icon = badge.icon;
              return (
                <div className={`p-4 rounded-2xl border ${badge.color} flex items-center gap-3`}>
                  <div className="p-2 rounded-xl bg-black/20">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-mono font-bold opacity-80">Текущий Статус Заявки:</div>
                    <div className="font-bold text-sm">{badge.label}</div>
                  </div>
                </div>
              );
            })()}

            {/* Билет. Появляется только после одобрения: до того заявка на
                билет — ещё не билет. При отметке входа QR глушится, чтобы
                скриншот использованного билета не выглядел действительным. */}
            {submission.mode === "ticket" && (
              submission.ticketActive ? (
                <div className="bg-white rounded-2xl p-5 space-y-3 text-center">
                  <div className="text-[10px] uppercase font-mono font-bold text-slate-500">
                    {submission.status === "checked_in" ? `${ticketWord} использован` : `Ваш ${ticketWord.toLowerCase()} — покажите на входе`}
                  </div>
                  <div className={`flex justify-center ${submission.status === "checked_in" ? "opacity-30 grayscale" : ""}`}>
                    <FancyQr value={window.location.href} theme={QR_THEMES[0]} size={200} />
                  </div>
                  <div className="font-mono text-lg font-bold tracking-widest text-slate-900">{submission.code}</div>
                  {submission.status === "checked_in" && (
                    <div className="text-xs font-bold text-emerald-600">
                      ✓ Вход отмечен {fmtDate(submission.checkedInAt)} в {fmtTime(submission.checkedInAt)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center text-xs text-slate-400">
                  🎟 Заявка на рассмотрении. {ticketWord} появится на этой странице после одобрения.
                </div>
              )
            )}

            {/* Timeline Details */}
            <div className="space-y-3 bg-slate-950 border border-slate-800 p-4 rounded-2xl text-xs">
              <div className="font-bold text-slate-300 font-mono uppercase text-[10px] border-b border-slate-800 pb-2 flex items-center justify-between">
                <span>Ход рассмотрения</span>
                <span className="font-mono text-slate-500">Код: {submission.code}</span>
              </div>

              {/* История статусов вместо содержимого заявки: код короткий, и
                  по нему не должны открываться данные, которые заявитель уже
                  и так знает, а посторонний знать не должен. */}
              <div className="space-y-2 text-slate-300 pt-1">
                {(submission.history || []).map((h: any, i: number) => (
                  <div key={i} className="flex justify-between items-center py-1 border-b border-slate-900">
                    <span className="font-semibold text-white">{h.label}</span>
                    <span className="text-slate-400 font-mono text-[11px]">{fmtDate(h.at)}</span>
                  </div>
                ))}

                <div className="flex justify-between items-center py-1 text-slate-400 font-mono text-[11px]">
                  <span>Заявка подана:</span>
                  <span>{fmtDate(submission.createdAt)}</span>
                </div>
              </div>
            </div>

          </div>
        )}


        {/* Footer */}
        <div className="pt-2 text-center text-[11px] text-slate-500 font-mono border-t border-slate-800">
          {org?.name || ""}
        </div>

      </div>

    </div>
  );
}
