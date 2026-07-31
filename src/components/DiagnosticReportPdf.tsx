import React from 'react';

interface TopicStat {
  earned: number;
  possible: number;
}

interface DiagnosticReportPdfProps {
  student: any;
}

export const DiagnosticReportPdf: React.FC<DiagnosticReportPdfProps> = ({ student }) => {
  const { childName, grade, date, diagnosticsRaw } = student;
  
  if (!diagnosticsRaw || Object.keys(diagnosticsRaw).length === 0) return (
    <div id="pdf-diagnostic-report" className="bg-white text-black p-10 w-[210mm] min-h-[297mm] absolute top-[-9999px] left-[-9999px]">
      <div className="text-center text-gray-500 mt-20">Нет данных для аналитики</div>
    </div>
  );

  const getStatusColor = (percentage: number) => {
    if (percentage >= 70) return "bg-green-500";
    if (percentage >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };
  
  const getStatusText = (percentage: number) => {
    if (percentage >= 70) return "Усвоено";
    if (percentage >= 50) return "Частично";
    return "Слабо";
  };
  
  const getStatusTextColor = (percentage: number) => {
    if (percentage >= 70) return "text-green-600";
    if (percentage >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getSubjectColor = (topic: string) => {
    if (["Морфология", "Орфоэпия (Ударения)", "Фразеологизмы", "Лексика (Значение слова)", "Склонение числительных", "Дефисное написание слов", "Пунктуация в ССП", "Слитное и раздельное написание НЕ", "Правописание суффиксов причастий", "Вводные слова и обращения", "Типы односоставных предложений", "Пунктуация в сложном предложении с разными видами связи", "Пунктуация при обособленных членах"].some(t => topic.includes(t))) return "text-blue-700 bg-blue-50";
    if (["Свойства степеней и корней", "Логарифмические выражения", "Производная функции", "Тригонометрические уравнения", "Решение неравенств", "Вычитание дробей", "Квадратные корни", "Уравнения"].some(t => topic.includes(t))) return "text-indigo-700 bg-indigo-50";
    if (topic.includes("Логические") || topic.includes("вычисления")) return "text-purple-700 bg-purple-50";
    if (topic.match(/[A-Za-z]/)) return "text-teal-700 bg-teal-50"; // English usually has English letters
    return "text-gray-700 bg-gray-50";
  };

  return (
    <div id="pdf-diagnostic-report" className="bg-white text-black p-12 w-[210mm] min-h-[297mm] absolute top-[-9999px] left-[-9999px]" style={{ fontFamily: '"Inter", "Arial", sans-serif' }}>
      
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-gray-200 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">Академия Будущих Лидеров</h1>
          <h2 className="text-xl font-semibold text-blue-600">Диагностическая Аналитика</h2>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500 uppercase tracking-wider font-semibold mb-1">Официальный отчет</div>
          <div className="text-sm font-medium text-gray-700">Дата: {date ? new Date(date).toLocaleDateString('ru-RU') : new Date().toLocaleDateString('ru-RU')}</div>
        </div>
      </div>

      {/* Student Info */}
      <div className="bg-slate-50 rounded-xl p-6 mb-8 border border-slate-100 flex justify-between items-center shadow-sm">
        <div>
          <div className="text-sm text-slate-500 mb-1">Ученик</div>
          <div className="text-2xl font-bold text-slate-800">{childName || "Без имени"}</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-500 mb-1">Класс</div>
          <div className="text-2xl font-bold text-slate-800">{grade || "?"} класс</div>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-bold text-gray-800 mb-4 uppercase tracking-wide border-b pb-2">Детализация навыков</h3>
        <p className="text-sm text-gray-600 mb-6">
          Ниже представлен детальный разбор усвоения тем. Зеленым отмечены сильные стороны ученика, требующие лишь поддержки. Желтым — темы с пробелами, требующие проработки. Красным — критические зоны, нуждающиеся в интенсивном обучении.
        </p>
        
        <div className="space-y-4">
          {Object.entries(diagnosticsRaw).map(([topic, stats]: [string, any]) => {
            const earned = stats.earned || 0;
            const possible = stats.possible || 0;
            const percentage = possible > 0 ? Math.round((earned / possible) * 100) : 0;
            const subjectClass = getSubjectColor(topic);

            return (
              <div key={topic} className="flex flex-col gap-2 p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="flex justify-between items-center mb-1">
                  <div className="font-semibold text-gray-800">{topic}</div>
                  <div className={`text-sm font-bold px-3 py-1 rounded-full bg-slate-100 ${getStatusTextColor(percentage)}`}>
                    {getStatusText(percentage)} ({percentage}%)
                  </div>
                </div>
                
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div 
                    className={`h-3 rounded-full ${getStatusColor(percentage)} transition-all`} 
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Решено верно: {earned} из {possible}</span>
                  <span className={subjectClass + " px-2 py-0.5 rounded-md font-medium text-[10px]"}>
                    Тема
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer / Conclusion */}
      <div className="mt-12 bg-blue-50 border border-blue-100 p-6 rounded-xl">
        <h4 className="text-blue-800 font-bold mb-2">Заключение специалиста</h4>
        <p className="text-sm text-blue-900 leading-relaxed">
          Данная диагностика является срезом текущих академических навыков. Результаты позволяют адаптировать учебную программу под индивидуальные потребности ученика, сфокусировав внимание на темах, находящихся в "красной" и "желтой" зонах. Рекомендуется обсудить данные результаты с куратором для выстраивания оптимального образовательного маршрута.
        </p>
      </div>

      <div className="mt-12 pt-6 border-t border-gray-200 text-center text-xs text-gray-400">
        Академия Будущих Лидеров • Сгенерировано автоматически
      </div>
    </div>
  );
};
