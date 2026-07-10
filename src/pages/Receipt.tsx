import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";

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

  if (loading) return <div className="text-center p-10">Загрузка чека...</div>;
  if (!student) return <div className="text-center p-10 text-red-500">Ученик не найден или не направлен к психологу</div>;

  const psychUrl = `https://studyfreeforum.com/psychologist/${shortId}`;

  return (
    <div className="min-h-screen bg-slate-200 py-12 px-4 font-mono">
      <div className="max-w-md mx-auto bg-white shadow-2xl p-8 relative">
        {/* Jagged edges for receipt look */}
        <div className="absolute top-0 left-0 right-0 h-4 bg-repeat-x" style={{backgroundImage: "radial-gradient(circle, transparent 4px, white 5px)", backgroundSize: "10px 10px", backgroundPosition: "top center", marginTop: "-4px"}}></div>

        <div className="text-center border-b-2 border-dashed pb-6 mb-6">
          <h1 className="text-2xl font-bold uppercase tracking-widest">Направление</h1>
          <p className="text-sm mt-1">к психологу Академии</p>
          <div className="mt-4 text-sm">ДАТА: {student.date.split(',')[0]}</div>
        </div>

        <div className="space-y-4 text-sm mb-6">
          <div className="flex justify-between"><span className="text-slate-500">МЕНЕДЖЕР:</span> <span className="font-bold">{student.managerName}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">УЧЕНИК:</span> <span className="font-bold">{student.childName}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">РОДИТЕЛИ:</span> <span className="font-bold">{student.parentName}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">ТЕЛЕФОН:</span> <span className="font-bold">{student.phone}</span></div>
        </div>

        <div className="border-t-2 border-dashed pt-6 mb-6">
          <h3 className="font-bold mb-3 text-center">РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Русский язык:</span> <span>{student.ru}</span></div>
            <div className="flex justify-between"><span>Математика:</span> <span>{student.ma}</span></div>
            <div className="flex justify-between"><span>Логика:</span> <span>{student.lo}</span></div>
            <div className="flex justify-between font-bold pt-2 border-t"><span>ИТОГО:</span> <span>{student.ru + student.ma + student.lo}</span></div>
          </div>
        </div>

        {student.managerComment && (
          <div className="border-t-2 border-dashed pt-6 mb-6">
            <h3 className="font-bold mb-2 text-center text-xs text-slate-500">КОММЕНТАРИЙ МЕНЕДЖЕРА</h3>
            <p className="text-sm italic text-center">"{student.managerComment}"</p>
          </div>
        )}

        <div className="border-t-2 border-dashed pt-8 text-center flex flex-col items-center">
          <p className="text-xs mb-4">Для психолога: отсканируйте код ниже</p>
          <QRCodeCanvas value={psychUrl} size={150} />
          
          <div className="mt-6 pt-6 border-t w-full text-center">
            <p className="text-xs text-slate-500 mb-1">ID УЧЕНИКА</p>
            <div className="text-3xl font-bold tracking-[0.3em]">{student.shortId}</div>
          </div>
        </div>
      </div>
      
      <div className="text-center mt-8">
        <button onClick={() => window.print()} className="bg-slate-800 text-white px-8 py-3 rounded-full font-sans font-medium shadow-lg hover:bg-slate-900 transition">
          🖨️ Распечатать чек
        </button>
      </div>
    </div>
  );
}
