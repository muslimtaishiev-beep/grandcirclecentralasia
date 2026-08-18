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

  // Date formatter for stamp
  const dateParts = issueDate.split('.');
  const dayStr = dateParts[0] || String(new Date().getDate()).padStart(2, '0');
  const monthMap: { [key: string]: string } = {
    '01': 'января', '02': 'февраля', '03': 'марта', '04': 'апреля',
    '05': 'мая', '06': 'июня', '07': 'июля', '08': 'августа',
    '09': 'сентября', '10': 'октября', '11': 'ноября', '12': 'декабря'
  };
  const monthStr = monthMap[dateParts[1]] || 'августа';
  const yearStr = (dateParts[2] || String(new Date().getFullYear())).slice(-2);

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
              // Fallback to /logo.png
              const target = e.currentTarget as HTMLImageElement;
              if (target.src.endsWith('/school_logo.png')) {
                target.src = '/logo.png';
              } else {
                target.style.display = 'none';
              }
            }}
          />
        </div>

        {/* Thin Orange Separator Line */}
        <div className="w-full h-[1.5px] bg-[#E5833B] mb-5"></div>

        {/* 2. School Address Header (2 Columns) */}
        <div className="flex justify-between items-start text-[13px] font-serif leading-snug mb-6 text-black">
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
        <div className="mt-4 mb-6">
          <div className="text-base font-bold mb-2">г. Бишкек</div>
          
          <div className="flex items-center gap-10">
            {/* Left Corner Stamp Image / Styled Stamp Fallback */}
            <div className="w-[320px] relative">
              <img
                src="/corner_stamp.png"
                alt="Угловой штамп"
                className="w-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                  const fallback = document.getElementById('vector-corner-stamp');
                  if (fallback) fallback.style.display = 'block';
                }}
              />
              {/* Dynamic Number Overlay on Image Stamp */}
              <div className="absolute top-[52%] left-[45%] font-mono font-bold text-xs text-blue-950 tracking-wider">
                {refNumber}
              </div>
              {/* Dynamic Date Overlay on Image Stamp */}
              <div className="absolute top-[72%] left-[18%] font-serif font-bold text-xs text-blue-950 tracking-wider flex items-center gap-4">
                <span>{dayStr}</span>
                <span className="ml-2">{monthStr}</span>
                <span className="ml-4">{yearStr}</span>
              </div>

              {/* High-Resolution Styled Vector Stamp Box Fallback */}
              <div
                id="vector-corner-stamp"
                className="hidden border-2 border-[#1d4ed8] p-2.5 text-[11px] font-sans leading-tight bg-blue-50/20 text-[#1d4ed8] rounded-sm font-semibold text-center"
              >
                <div className="text-[11px] font-bold tracking-tight border-b border-[#1d4ed8] pb-1 mb-1 uppercase">
                  Общество с ограниченной ответственностью<br />
                  «Академия будущих лидеров»
                </div>
                <div className="text-[10px] font-mono">ИНН 03004202510435</div>
                <div className="mt-1.5 pt-1 border-t border-[#1d4ed8] flex justify-between font-mono font-bold text-[11px] px-1">
                  <span>№ <u className="underline underline-offset-2 font-mono">{refNumber}</u></span>
                  <span>«<u>{dayStr}</u>» <u>{monthStr}</u> 20<u>{yearStr}</u>г.ж.</span>
                </div>
                <div className="text-[9px] text-slate-700 italic mt-0.5">г. Бишкек ш.</div>
              </div>
            </div>

            {/* Title 'Справка' placed right next to the corner stamp */}
            <div className="text-4xl font-bold font-serif tracking-widest text-black ml-4">
              Справка
            </div>
          </div>
        </div>

        {/* 4. Main Body Text (Fills Gaps Dynamically) */}
        <div className="space-y-6 text-lg leading-[2.2] my-8 px-2 text-black">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-normal text-xl">Выдана</span>
            <span className="flex-1 border-b border-black font-bold text-xl px-4 text-center min-w-[400px]">
              {studentNameGenitive || '________________________________________________________'}
              {dob ? `, ${dob} г.р.` : ''}
            </span>
          </div>

          <div className="flex items-baseline gap-2 flex-wrap indent-8">
            <span className="font-normal text-[19px]">в том, что он(а) действительно является учеником(цей)</span>
            <span className="border-b border-black font-bold text-xl px-4 text-center min-w-[60px]">
              {grade || '__'}
            </span>
            <span className="font-normal text-[19px]">класса в средней школе</span>
          </div>

          <p className="text-justify font-normal text-[19px]">
            «Академия Будущих Лидеров» (Лицензия LM.-2025-0006 от 03.03.2026).
          </p>

          <p className="text-justify text-[19px] pt-2">
            Справка выдана для предъявления {purpose ? <span className="font-bold underline px-1">{purpose}</span> : <span>по месту требования</span>}.
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
