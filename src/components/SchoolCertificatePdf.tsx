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
      className="p-10 w-[210mm] min-h-[297mm] bg-white text-slate-900 font-serif relative select-none"
      style={{
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        color: '#0f172a',
        fontFamily: "'Times New Roman', Times, Georgia, serif",
        lineHeight: '1.6',
        fontSize: '17px'
      }}
    >
      {/* Full-width Official Logo Header */}
      <div className="w-full text-center mb-2">
        <img
          src="/school_logo.png"
          alt="Академия Будущих Лидеров"
          className="w-full max-h-24 object-contain mx-auto"
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      </div>

      {/* Decorative Line Under Logo */}
      <div className="w-full h-1 bg-gradient-to-r from-amber-500 via-teal-500 to-amber-600 mb-6 rounded-full"></div>

      {/* Corner Stamp Box (Left) & Ref / Date Row */}
      <div className="flex justify-between items-start mb-8 min-h-[90px]">
        {/* Corner Stamp Image */}
        <div className="w-64">
          <img
            src="/corner_stamp.png"
            alt="Угловой штамп ООО Академия будущих лидеров"
            className="w-full object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        {/* Reference & Date Text */}
        <div className="text-right text-sm font-sans font-medium text-slate-800 space-y-1">
          <div>
            Исх. № <strong className="font-mono text-base text-blue-900">{refNumber}</strong>
          </div>
          <div>г. Бишкек</div>
          <div>
            Дата: <strong className="text-slate-900">{issueDate} г.</strong>
          </div>
        </div>
      </div>

      {/* Document Title */}
      <div className="text-center my-10">
        <h1 className="text-3xl font-bold tracking-widest uppercase text-slate-900 font-serif">
          СПРАВКА
        </h1>
      </div>

      {/* Body Content */}
      <div className="space-y-6 text-justify text-lg leading-relaxed px-4 mb-20">
        <p className="indent-8">
          Выдана <strong className="text-xl underline decoration-slate-400 underline-offset-4">{studentNameGenitive}</strong>
          {dob ? `, ${dob} года рождения,` : ''} в том, что он(а) действительно является учеником(цей){' '}
          <strong className="text-xl">{grade}</strong> класса в средней школе{' '}
          <strong>«Академия Будущих Лидеров»</strong> (Лицензия МОиН КР № LM.-2025-0006 от 03.03.2026 г.).
        </p>

        <p className="indent-8">
          Справка выдана для предъявления {purpose ? <span>{purpose}</span> : <span>по месту требования</span>}.
        </p>
      </div>

      {/* Signatures & Official Wet Seal */}
      <div className="mt-24 pt-8 px-4 flex justify-between items-end relative">
        {/* Left Side: Director Title */}
        <div className="text-left">
          <div className="text-xl font-bold text-slate-900">Директор</div>
          <div className="text-xs text-slate-500 font-sans mt-1">ОсОО «Академия будущих лидеров»</div>
        </div>

        {/* Right Side: Signature Line & Seal */}
        <div className="text-right relative">
          {/* Round Wet Stamp Graphic Overlay */}
          <img
            src="/stamp.png"
            alt="Печать школы"
            className="absolute -top-16 -left-20 w-44 h-44 object-contain opacity-90 mix-blend-multiply pointer-events-none z-10"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />

          <div className="relative z-20">
            <div className="w-56 border-b-2 border-slate-900 mb-1"></div>
            <div className="text-sm font-sans text-slate-800 italic">
              {directorName ? directorName : 'Подпись / М.П.'}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Legal Note */}
      <div className="absolute bottom-6 left-10 right-10 text-center text-xs text-slate-400 font-sans border-t border-slate-200 pt-3">
        720005, г. Бишкек, ул. Жуная Мавлянова, 10 • Тел.: +996 558 398 360 • Лицензия LM.-2025-0006
      </div>
    </div>
  );
};
