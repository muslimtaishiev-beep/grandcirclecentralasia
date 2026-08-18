import React from 'react';

export interface CertificateData {
  refNumber: string;
  issueDate: string;
  studentName: string;
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
    refNumber = '№ 01-2026/01',
    issueDate = new Date().toLocaleDateString('ru-RU'),
    studentName = 'Иванов Иван Иванович',
    dob = '',
    grade = '7',
    purpose = 'по месту требования',
    directorName = ''
  } = data || {};

  return (
    <div
      id="pdf-school-certificate"
      className="p-12 w-[210mm] min-h-[297mm] bg-white text-slate-900 font-serif relative select-none"
      style={{
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        color: '#0f172a',
        fontFamily: "'Times New Roman', Times, Georgia, serif",
        lineHeight: '1.6',
        fontSize: '16px'
      }}
    >
      {/* Top Header Grid: Kyrgyz Left, Russian Right */}
      <div className="border-b-2 border-slate-900 pb-6 mb-8">
        <div className="flex justify-between items-start text-xs leading-relaxed font-sans text-slate-800 mb-4">
          {/* Left Column - Kyrgyz */}
          <div className="w-[48%] text-left">
            <div className="font-bold text-sm text-blue-900 uppercase tracking-wide mb-1">
              Келечектеги лидерлердин академиясы
            </div>
            <div>720005, Бишкек ш., Жунай Мавлянов кѳчѳсү, 10</div>
            <div>Тел.: +996 558 398 360</div>
          </div>

          {/* Vertical Divider */}
          <div className="w-[1px] bg-slate-300 h-16 self-center"></div>

          {/* Right Column - Russian */}
          <div className="w-[48%] text-right">
            <div className="font-bold text-sm text-blue-900 uppercase tracking-wide mb-1">
              Академия Будущих Лидеров
            </div>
            <div>720005, г. Бишкек, ул. Жуная Мавлянова, 10</div>
            <div>Тел.: +996 558 398 360</div>
          </div>
        </div>
      </div>

      {/* Outgoing Reference & Date */}
      <div className="flex justify-between items-center text-sm font-sans font-medium text-slate-700 mb-12">
        <div>
          Исх. <span className="font-mono font-bold text-slate-900">{refNumber}</span>
        </div>
        <div>г. Бишкек</div>
        <div>
          Дата: <span className="font-bold text-slate-900">{issueDate} г.</span>
        </div>
      </div>

      {/* Document Title */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold tracking-widest uppercase text-slate-900 font-serif">
          СПРАВКА
        </h1>
      </div>

      {/* Body Content */}
      <div className="space-y-6 text-justify text-lg leading-relaxed px-4 mb-16">
        <p>
          Выдана <strong className="text-xl underline decoration-slate-400 underline-offset-4">{studentName}</strong>
          {dob ? `, ${dob} года рождения,` : ''} в том, что он(а) действительно является учеником(цей){' '}
          <strong className="text-xl">{grade}</strong> класса в средней школе{' '}
          <strong>«Академия Будущих Лидеров»</strong> (Лицензия МОиН КР № LM.-2025-0006 от 03.03.2026 г.).
        </p>

        <p>
          Справка выдана для предъявления {purpose ? <span>{purpose}</span> : <span>по месту требования</span>}.
        </p>
      </div>

      {/* Signatures & Official Stamp */}
      <div className="mt-20 pt-8 px-4 flex justify-between items-end relative">
        {/* Left Side: Director Title */}
        <div className="text-left">
          <div className="text-lg font-bold text-slate-900">Директор</div>
          <div className="text-sm text-slate-500 font-sans mt-1">ОсОО «Академия будущих лидеров»</div>
        </div>

        {/* Right Side: Signature Line & Seal */}
        <div className="text-right relative">
          {/* Stamp Graphic Overlay */}
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
            <div className="text-sm font-sans text-slate-700 italic">
              {directorName ? directorName : 'Подпись / М.П.'}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Line */}
      <div className="absolute bottom-8 left-12 right-12 text-center text-xs text-slate-400 font-sans border-t border-slate-200 pt-3">
        Официальный документ ОсОО «Академия будущих лидеров» • Лицензия LM.-2025-0006 от 03.03.2026 г.
      </div>
    </div>
  );
};
