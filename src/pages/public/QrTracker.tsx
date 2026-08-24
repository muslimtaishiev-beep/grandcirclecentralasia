import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QrCode, CheckCircle2, Clock, ShieldCheck, AlertCircle, Building2, ArrowLeft, Loader2, Award, Calendar, FileText } from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function QrTracker() {
  const { qrToken } = useParams<{ qrToken: string }>();

  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!qrToken) return;

    setLoading(true);
    const fetchByQr = async () => {
      try {
        // First try by doc ID
        const docRef = doc(db, 'form_submissions', qrToken);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
          setSubmission({ id: snap.id, ...snap.data() });
        } else {
          // Fallback query by qrToken field
          const q = query(collection(db, 'form_submissions'), where('qrToken', '==', qrToken));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            const firstDoc = querySnap.docs[0];
            setSubmission({ id: firstDoc.id, ...firstDoc.data() });
          } else {
            setError('Заявка по данному QR-коду не найдена в системе');
          }
        }
      } catch (err: any) {
        setError(`Ошибка получения данных: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchByQr();
  }, [qrToken]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return { label: 'Успешно Зачислен / Принят', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 };
      case 'testing':
        return { label: 'Экзамен / Тестирование', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Award };
      case 'review':
        return { label: 'На Проверке Координатора', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock };
      case 'rejected':
        return { label: 'Отклонено', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: AlertCircle };
      default:
        return { label: 'Новая Заявка (Получена)', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Clock };
    }
  };

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
      
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-500" />
            <span className="font-bold text-sm tracking-wide text-slate-200">Официальный QR-Паспорт</span>
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
            <p className="text-xs text-slate-400">Проверьте правильность ссылки или обратитесь в приемную комиссию</p>
          </div>
        ) : submission && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Applicant Banner */}
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-2 text-center">
              <div className="text-[10px] uppercase font-mono font-bold text-slate-400">Заявитель / Абитуриент</div>
              <h2 className="text-xl font-extrabold text-white">{submission.applicantName || 'Ученик'}</h2>
              <div className="text-xs font-mono text-emerald-400 font-bold">{submission.formTitle || 'Заявка на обучение'}</div>
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

            {/* Timeline Details */}
            <div className="space-y-3 bg-slate-950 border border-slate-800 p-4 rounded-2xl text-xs">
              <div className="font-bold text-slate-300 font-mono uppercase text-[10px] border-b border-slate-800 pb-2 flex items-center justify-between">
                <span>Детали Заявки</span>
                <span className="font-mono text-slate-500">ID: {submission.qrToken || submission.id?.substring(0, 8)}</span>
              </div>

              <div className="space-y-2 text-slate-300 pt-1">
                {Object.entries(submission.data || {}).map(([key, val]: any) => (
                  <div key={key} className="flex justify-between items-center py-1 border-b border-slate-900">
                    <span className="text-slate-400 font-mono">{key}:</span>
                    <span className="font-semibold text-white">{String(val)}</span>
                  </div>
                ))}

                <div className="flex justify-between items-center py-1 text-slate-400 font-mono text-[11px]">
                  <span>Дата регистрации:</span>
                  <span>{submission.createdAt ? new Date(submission.createdAt.seconds ? submission.createdAt.seconds * 1000 : submission.createdAt).toLocaleDateString() : 'Сегодня'}</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Footer */}
        <div className="pt-2 text-center text-[11px] text-slate-500 font-mono border-t border-slate-800">
          Платформа Цифрового Образования & Enterprise B2B SaaS
        </div>

      </div>

    </div>
  );
}
