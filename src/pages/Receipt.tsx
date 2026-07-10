import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import Barcode from "react-barcode";

export default function Receipt() {
  const { shortId } = useParams();
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudent = async () => {
      try {
        const gasUrl = import.meta.env.VITE_GAS_URL || "";
        const res = await fetch(gasUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "getPsychologistStudent", shortId })
        });
        const data = await res.json();
        if (data.success) {
          setStudent(data.student);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudent();
  }, [shortId]);

  if (loading) return <div className="text-center p-10 font-serif">Загрузка данных документа...</div>;
  if (!student) return <div className="text-center p-10 text-red-500 font-serif">Ученик не найден или не направлен к психологу</div>;

  const psychUrl = `https://studyfreeforum.com/psychologist/${shortId}`;

  return (
    <>
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-receipt, #printable-receipt * {
              visibility: visible;
            }
            #printable-receipt {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 0;
            }
            @page {
              size: A4 portrait;
              margin: 1cm;
            }
          }
        `}
      </style>
      <div className="min-h-screen bg-gray-200 py-10 px-4 print:bg-white print:p-0 flex flex-col items-center">
        {/* Document Container */}
        <div id="printable-receipt" className="bg-white shadow-2xl p-10 max-w-2xl w-full border border-gray-400 print:shadow-none print:border-none print:w-full print:max-w-none text-black font-serif relative">
        
        {/* Header - Official State Look */}
        <div className="text-center border-b-2 border-black pb-4 mb-6">
          <h1 className="text-xl font-bold uppercase tracking-wide">ОсОО «Академия Будущих Лидеров»</h1>
          <p className="text-sm mt-1">Кыргызская Республика, г. Бишкек, ул. Турусбекова 109/3</p>
          <div className="mt-4 border-t border-black pt-2 w-3/4 mx-auto">
            <h2 className="text-2xl font-bold uppercase tracking-widest mt-2">Направление № {student.shortId}</h2>
            <p className="text-sm">Для прохождения психологического собеседования</p>
          </div>
        </div>

        <div className="flex justify-between items-start mb-6 text-sm">
          <div>
            <p><strong>Дата выдачи:</strong> {student.date}</p>
            <p><strong>Ответственный менеджер:</strong> {student.managerName}</p>
          </div>
          <div className="text-right">
            <Barcode value={String(student.shortId)} width={2} height={40} displayValue={false} margin={0} />
            <div className="text-center text-xs mt-1 font-mono">{student.shortId}</div>
          </div>
        </div>

        {/* Data Table */}
        <table className="w-full border-collapse border border-black text-sm mb-6">
          <tbody>
            <tr>
              <td className="border border-black p-2 bg-gray-100 font-bold w-1/3">ФИО Ученика:</td>
              <td className="border border-black p-2">{student.childName}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 bg-gray-100 font-bold">ФИО Родителя:</td>
              <td className="border border-black p-2">{student.parentName}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 bg-gray-100 font-bold">Контактный телефон:</td>
              <td className="border border-black p-2">{student.phone}</td>
            </tr>
          </tbody>
        </table>

        {/* Test Results Table */}
        <h3 className="font-bold mb-2 uppercase text-sm border-b border-black inline-block pb-1">Результаты тестирования</h3>
        <table className="w-full border-collapse border border-black text-sm mb-6 text-center">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-2">Русский язык</th>
              <th className="border border-black p-2">Математика</th>
              <th className="border border-black p-2">Логика</th>
              <th className="border border-black p-2 font-bold">ИТОГО</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-2">{student.ru}</td>
              <td className="border border-black p-2">{student.ma}</td>
              <td className="border border-black p-2">{student.lo}</td>
              <td className="border border-black p-2 font-bold">{student.ru + student.ma + student.lo}</td>
            </tr>
          </tbody>
        </table>

        {student.managerComment && (
          <div className="mb-8">
            <h3 className="font-bold mb-1 text-sm">Особые отметки / Комментарий:</h3>
            <div className="border-b border-black italic text-sm pb-1 min-h-[1.5rem]">
              {student.managerComment}
            </div>
          </div>
        )}

        {/* Footer with QR */}
        <div className="flex justify-between items-end border-t-2 border-black pt-6 mt-10">
          <div className="w-2/3 pr-8">
            <p className="text-xs text-justify leading-tight">
              Настоящее направление действительно только при предъявлении. Направление подлежит передаче штатному психологу Академии для проведения финального этапа вступительного тестирования. 
            </p>
            <div className="mt-8 text-sm">
              <div className="flex items-end mb-4">
                <span className="w-1/3">Подпись менеджера:</span>
                <div className="w-2/3 border-b border-black"></div>
              </div>
              <div className="flex items-end">
                <span className="w-1/3">М.П.</span>
                <div className="w-2/3"></div>
              </div>
            </div>
          </div>
          
          <div className="w-1/3 flex flex-col items-center text-center">
            <p className="text-[10px] uppercase font-bold mb-2">Для сканирования психологом</p>
            <div className="border border-black p-2 bg-white inline-block">
              <QRCodeCanvas value={psychUrl} size={110} level="M" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Print Button (hidden when printing) */}
      <div className="mt-8 print:hidden">
        <button onClick={() => window.print()} className="bg-black text-white px-8 py-3 rounded uppercase font-bold tracking-wider hover:bg-gray-800 transition shadow-lg">
          Распечатать документ
        </button>
        </div>
      </div>
    </>
  );
}
