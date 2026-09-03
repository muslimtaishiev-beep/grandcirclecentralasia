import React from 'react';
import type { LegalProfile } from '../shared/legal';

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
  /** Реквизиты организации: бланк, штамп, печать. Без них печатается только название. */
  legal?: LegalProfile | null;
}

export const SchoolCertificatePdf: React.FC<SchoolCertificatePdfProps> = ({ data, legal }) => {
  const L = legal || { legalName: "" };
  const stampColor = L.stampColor || "var(--stamp)";
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
        fontSize: '16px',
        ['--stamp' as any]: stampColor,
      }}
    >
      <div>
        {/* 1. Official Header Logo */}
        <div className="w-full text-center mb-3">
          {L.logoUrl && (
            <img
              src={L.logoUrl}
              alt={L.legalName}
              className="h-28 object-contain mx-auto"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </div>

        {/* Thin Orange Separator Line */}
        <div className="w-full h-[1.5px] bg-[#E5833B] mb-5"></div>

        {/* 2. School Address Header (2 Columns) */}
        <div className="flex justify-between items-start text-[13px] font-serif leading-snug mb-6 text-black">
          {/* Kyrgyz Side */}
          <div className="space-y-0.5 max-w-[280px]">
            <div className="font-bold">{L.nameKg || L.legalName}</div>
            {(L.addressKg || L.address) && <div>{L.addressKg || L.address}</div>}
            {L.phone && <div>Тел.: {L.phone}</div>}
          </div>

          {/* Russian Side */}
          <div className="text-right space-y-0.5 max-w-[280px]">
            <div className="font-bold">{L.legalName}</div>
            {L.address && <div>{L.address}</div>}
            {L.phone && <div>Тел.: {L.phone}</div>}
          </div>
        </div>

        {/* 3. City Title + Stamp Row & 'Справка' Header */}
        <div className="mt-4 mb-6">
          {L.city && <div className="text-base font-bold mb-2">г. {L.city}</div>}
          
          <div className="flex items-center gap-10">
            {/* Ultra High-Resolution HD Vector Official Corner Stamp (All Stamp Blue var(--stamp)) */}
            <div className="w-[330px] border-[2.5px] border-[var(--stamp)] p-2.5 text-[11px] font-serif leading-tight bg-[#f0f4ff]/20 text-[var(--stamp)] rounded-xs relative select-none">
              <div className="text-[11.5px] font-bold tracking-tight text-center border-b border-[var(--stamp)] pb-1 mb-1.5 font-serif uppercase">
                {L.legalName}
              </div>
              {L.inn && (
                <div className="text-[10px] text-center font-mono text-[var(--stamp)] tracking-wider mb-2 font-bold">
                  ИНН {L.inn}
                </div>
              )}
              <div className="space-y-1.5 text-[11px] font-serif pl-1 text-[var(--stamp)]">
                <div className="flex items-baseline">
                  <span className="font-bold">№</span>
                  <span className="border-b border-[var(--stamp)] px-4 font-mono font-bold ml-2 text-xs text-[var(--stamp)]">
                    {refNumber}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-bold">«</span>
                  <span className="border-b border-[var(--stamp)] px-2 font-bold text-xs text-[var(--stamp)]">{dayStr}</span>
                  <span className="font-bold">»</span>
                  <span className="border-b border-[var(--stamp)] px-3 font-bold text-xs text-[var(--stamp)]">{monthStr}</span>
                  <span className="font-bold">20</span>
                  <span className="border-b border-[var(--stamp)] px-1 font-bold text-xs text-[var(--stamp)]">{yearStr}</span>
                  <span className="font-bold">г.ж.</span>
                </div>
              </div>
              {L.city && (
                <div className="text-right text-[9.5px] text-[var(--stamp)] italic mt-1 pr-1 font-serif font-bold">
                  г. {L.city}
                </div>
              )}
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
            «{L.legalName}»
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
            {L.stampUrl && <img
              src={L.stampUrl}
              alt="Круглая печать"
              className="absolute -top-16 -left-12 w-48 h-48 object-contain opacity-90 mix-blend-multiply pointer-events-none z-10"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />}
          </div>
        </div>
      </div>
    </div>
  );
};
