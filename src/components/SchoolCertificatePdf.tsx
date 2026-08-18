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
    studentNameGenitive = '',
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
        padding: '12mm 20mm 15mm 20mm',
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontFamily: "'Times New Roman', Times, Georgia, serif",
        lineHeight: '1.6',
        fontSize: '16px'
      }}
    >
      <div>
        {/* 1. Official Header Logo */}
        <div className="w-full text-center mb-3">
          <img
            src="/school_logo.png"
            alt="Академия Будущих Лидеров"
            className="h-28 object-contain mx-auto"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        {/* Thin Orange Separator Line */}
        <div className="w-full h-[1.5px] bg-[#E5833B] mb-5"></div>

        {/* 2. School Address Header (2 Columns) */}
        <div className="flex justify-between items-start text-[13px] font-serif leading-snug mb-8 text-black">
          {/* Kyrgyz Side */}
          <div className="space-y-0.5 max-w-[280px]">
            <div className="font-bold">Келечектеги лидерлердин академиясы</div>
            <div className="font-bold">Лидеров</div>
            <div>720005, Бишкек ш., Жунай Мавлянов кѳчѳсу, 10</div>
            <div>Тел.: 996558398360</div>
          </div>

          {/* Russian Side */}
          <div className="text-right space-y-0.5 max-w-[280px]">
            <div className="font-bold">Академия Будущих</div>
            <div>720005, г. Бишкек, ул. Жуная Мавлянова, 10</div>
            <div>Тел.: 996558398360</div>
          </div>
        </div>

        {/* 3. City Title + Stamp Row & 'Справка' Header */}
        <div className="mt-6 mb-8">
          <div className="text-base font-bold mb-2">г. Бишкек</div>
          
          <div className="flex items-center gap-12">
            {/* Left Corner Stamp Image / Fallback */}
            <div className="w-[310px] min-h-[90px] relative">
              <img
                src="/corner_stamp.png"
                alt="Угловой штамп"
                className="w-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            {/* Title 'Справка' placed to the right of the corner stamp */}
            <div className="text-3xl font-bold font-serif tracking-wide text-black ml-4">
              Справка
            </div>
          </div>
        </div>

        {/* 4. Main Body Text */}
        <div className="space-y-6 text-lg leading-[2] my-10 px-2 text-black">
          <div>
            <span className="font-normal">Выдана </span>
            <span className="inline-block border-b border-black font-bold px-4 text-xl min-w-[450px]">
              {studentNameGenitive}
              {dob ? `, ${dob} г.р.` : ''}
            </span>
          </div>

          <p className="indent-8 text-justify">
            в том, что он(а) действительно является учеником{' '}
            <strong className="text-xl underline px-2">{grade}</strong> класса в средней школе
          </p>

          <p className="text-justify font-normal">
            «Академия Будущих Лидеров» (Лицензия LM.-2025-0006 от 03.03.2026).
          </p>

          <p className="text-justify pt-2">
            Справка выдана для предъявления {purpose || 'по месту требования'}.
          </p>
        </div>
      </div>

      {/* 5. Footer Signatures & Official Round Wet Seal */}
      <div className="pb-6">
        <div className="flex justify-between items-end relative px-2">
          {/* Left: Director Label */}
          <div className="text-xl font-bold font-serif text-black pb-2">
            Директор
          </div>

          {/* Center: Signature Symbol Line */}
          <div className="flex flex-col items-center pb-2">
            <div className="flex items-center gap-2 text-slate-700">
              <div className="w-24 border-b border-slate-400"></div>
              <span className="text-xs">✦</span>
              <div className="w-24 border-b border-slate-400"></div>
            </div>
            <div className="text-xs text-slate-500 font-sans mt-1">
              {directorName ? directorName : 'Подпись / М.П.'}
            </div>
          </div>

          {/* Right: Round Seal Image */}
          <div className="relative w-48 h-24">
            <img
              src="/stamp.png"
              alt="Круглая печать"
              className="absolute -top-16 -left-12 w-48 h-48 object-contain opacity-90 mix-blend-multiply pointer-events-none z-10"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
