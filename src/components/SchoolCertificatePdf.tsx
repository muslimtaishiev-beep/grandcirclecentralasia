import React from 'react';

export interface CertificateData {
  refNumber: string;
  issueDate: string;
  studentNameGenitive: string; // ФИО в родительном падеже
  dob?: string;
  grade: string | number;
  purpose?: string;
  directorName?: string;
}

interface SchoolCertificatePdfProps {
  data: CertificateData;
}

export const SchoolCertificatePdf: React.FC<SchoolCertificatePdfProps> = ({ data }) => {
  const {
    refNumber = '26-08-001',
    issueDate = new Date().toLocaleDateString('ru-RU'),
    studentNameGenitive = 'Асанову Бакыту Алмазовичу',
    dob = '',
    grade = '7',
    purpose = 'по месту требования',
    directorName = ''
  } = data || {};

  return (
    <div
      id="pdf-school-certificate"
      className="bg-white text-slate-900 font-serif relative select-none flex flex-col justify-between"
      style={{
        width: '210mm',
        height: '297mm',
        padding: '18mm 20mm 15mm 20mm',
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        color: '#0f172a',
        fontFamily: "'Times New Roman', Times, Georgia, serif",
        lineHeight: '1.6',
        fontSize: '16px'
      }}
    >
      <div>
        {/* Full-width Official Logo Header */}
        <div className="w-full text-center mb-3">
          <img
            src="/school_logo.png"
            alt="Академия Будущих Лидеров"
            className="w-full max-h-28 object-contain mx-auto"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        {/* Decorative Line Under Logo */}
        <div className="w-full h-[3px] bg-gradient-to-r from-amber-500 via-teal-600 to-blue-900 mb-6 rounded-full"></div>

        {/* Top Section: Corner Stamp (Left) & Ref / Date (Right) */}
        <div className="flex justify-between items-start mb-6">
          {/* Top-Left Official Corner Stamp */}
          <div className="w-[300px] border border-slate-400 p-3 rounded text-[11px] font-sans leading-tight bg-slate-50/50">
            <div className="font-bold text-[12px] text-slate-900 mb-1 border-b pb-1">
              Келечектеги лидерлердин академиясы<br />
              Академия Будущих Лидеров
            </div>
            <div className="text-slate-700 space-y-0.5">
              <div>720005, Бишкек ш., Жунай Мавлянов кѳчѳсу, 10</div>
              <div>Тел.: +996 558 398 360</div>
              <div className="pt-1">720005, г. Бишкек, ул. Жуная Мавлянова, 10</div>
              <div>Тел.: +996 558 398 360</div>
            </div>
            <div className="mt-2 pt-1 border-t border-slate-300 font-mono font-bold text-blue-900 flex justify-between">
              <span>Исх. № {refNumber}</span>
              <span>от {issueDate} г.</span>
            </div>
          </div>

          {/* Reference & City Row (Right) */}
          <div className="text-right text-sm font-sans font-semibold text-slate-800 space-y-1">
            <div className="text-base text-slate-900 font-bold">г. Бишкек</div>
            <div className="text-xs text-slate-500 font-mono">№ {refNumber}</div>
            <div className="text-xs text-slate-600">{issueDate} г.</div>
          </div>
        </div>

        {/* Document Title */}
        <div className="text-center my-10">
          <h1 className="text-4xl font-bold tracking-[0.3em] uppercase text-slate-900 font-serif">
            СПРАВКА
          </h1>
        </div>

        {/* Body Content */}
        <div className="space-y-6 text-justify text-lg leading-relaxed px-4 my-10">
          <p className="indent-10">
            Выдана <strong className="text-xl underline decoration-slate-400 underline-offset-4">{studentNameGenitive}</strong>
            {dob ? `, ${dob} года рождения,` : ''} в том, что он(а) действительно является учеником(цей){' '}
            <strong className="text-xl">{grade}</strong> класса в средней школе{' '}
            <strong>«Академия Будущих Лидеров»</strong> (Лицензия МОиН КР № LM.-2025-0006 от 03.03.2026 г.).
          </p>

          <p className="indent-10">
            Справка выдана для предъявления {purpose ? <span>{purpose}</span> : <span>по месту требования</span>}.
          </p>
        </div>
      </div>

      {/* Footer / Signatures & Official Wet Seal */}
      <div>
        <div className="pt-8 px-4 flex justify-between items-end relative mb-12">
          {/* Left Side: Director Title */}
          <div className="text-left">
            <div className="text-2xl font-bold text-slate-900 font-serif">Директор</div>
            <div className="text-xs text-slate-500 font-sans mt-1">ОсОО «Академия будущих лидеров»</div>
          </div>

          {/* Right Side: Signature Line & Seal */}
          <div className="text-right relative">
            {/* Round Wet Stamp Graphic Overlay */}
            <img
              src="/stamp.png"
              alt="Печать школы"
              className="absolute -top-20 -left-24 w-48 h-48 object-contain opacity-90 mix-blend-multiply pointer-events-none z-10"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />

            <div className="relative z-20">
              <div className="w-64 border-b-2 border-slate-900 mb-1"></div>
              <div className="text-sm font-sans text-slate-800 italic">
                {directorName ? directorName : 'Подпись / М.П.'}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Legal Note */}
        <div className="text-center text-[11px] text-slate-400 font-sans border-t border-slate-200 pt-3">
          720005, г. Бишкек, ул. Жуная Мавлянова, 10 • Тел.: +996 558 398 360 • Лицензия МОиН КР № LM.-2025-0006
        </div>
      </div>
    </div>
  );
};
