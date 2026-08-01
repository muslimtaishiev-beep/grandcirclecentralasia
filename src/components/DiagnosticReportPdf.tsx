import React from 'react';

interface TopicStat {
  earned: number;
  possible: number;
}

interface DiagnosticReportPdfProps {
  student: any;
}

const C = {
  white: '#ffffff',
  black: '#000000',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate500: '#64748b',
  slate800: '#1e293b',

  blue50: '#eff6ff',
  blue100: '#dbeafe',
  blue600: '#2563eb',
  blue700: '#1d4ed8',
  blue800: '#1e40af',
  blue900: '#1e3a8a',

  indigo50: '#eef2ff',
  indigo700: '#4338ca',

  purple50: '#faf5ff',
  purple700: '#7e22ce',

  teal50: '#f0fdfa',
  teal700: '#0f766e',

  green500: '#22c55e',
  green600: '#16a34a',

  yellow500: '#eab308',
  yellow600: '#ca8a04',

  red500: '#ef4444',
  red600: '#dc2626',
};

export const DiagnosticReportPdf: React.FC<DiagnosticReportPdfProps> = ({ student }) => {
  const { childName, studentName, grade, date, diagnosticsRaw } = student;
  const displayName = childName || studentName;
  
  if (!diagnosticsRaw || Object.keys(diagnosticsRaw).length === 0) return (
    <div id="pdf-diagnostic-report" className="p-10 w-[210mm] min-h-[297mm] " style={{ backgroundColor: C.white, color: C.black }}>
      <div className="text-center mt-20" style={{ color: C.gray500 }}>Нет данных для аналитики</div>
    </div>
  );

  const getStatusColor = (percentage: number) => {
    if (percentage >= 70) return C.green500;
    if (percentage >= 50) return C.yellow500;
    return C.red500;
  };
  
  const getStatusText = (percentage: number) => {
    if (percentage >= 70) return "Усвоено";
    if (percentage >= 50) return "Частично";
    return "Слабо";
  };
  
  const getStatusTextColor = (percentage: number) => {
    if (percentage >= 70) return C.green600;
    if (percentage >= 50) return C.yellow600;
    return C.red600;
  };

  const getSubjectColor = (macro: string) => {
    if (macro.includes("Русский")) return { color: C.blue700, backgroundColor: C.blue50, label: "Русский язык" };
    if (macro.includes("Математика")) return { color: C.indigo700, backgroundColor: C.indigo50, label: "Математика" };
    if (macro.includes("Логика")) return { color: C.purple700, backgroundColor: C.purple50, label: "Логика" };
    if (macro.includes("English")) return { color: C.teal700, backgroundColor: C.teal50, label: "English" };
    return { color: C.gray700, backgroundColor: C.gray50, label: "Общее" };
  };

  const MACRO_CATEGORY_MAP: Record<string, string[]> = {
    "Русский язык: Орфография": ["н и нн", "правописание", "суффикс", "гласная", "орфография", "дефисное", "слитное", "корней", "раздельное"],
    "Русский язык: Пунктуация": ["пунктуация", "бсп", "ссп", "запятые", "оборот", "вводные", "обособленных", "однородных"],
    "Русский язык: Синтаксис и Грамматика": ["основа", "односоставных", "сказуемых", "связи", "синтаксис", "морфология", "склонение"],
    "Русский язык: Лексика и Речь": ["лексика", "паронимы", "фразеологизмы", "смысловые", "слова", "значение", "обращения"],

    "Математика: Вычисления и алгебра": ["дроби", "корни", "выражений", "вычисления", "степеней", "многочлены", "прогрессии", "умножения"],
    "Математика: Уравнения и неравенства": ["уравнения", "неравенства", "системы", "интервалов"],
    "Математика: Функции и графики": ["функции", "графики", "парабола", "производная", "логарифмические", "тригонометрические"],
    "Математика: Геометрия": ["пифагора", "вектора", "площадь", "геометрия", "стереометрия", "планиметрия", "треугольники", "углы", "треугольника"],
    "Математика: Текстовые задачи": ["совместную", "текстовые", "проценты", "доли"],

    "Логика и мышление": ["матрицы", "очереди", "утверждениями", "логика", "работу"],

    "English: Tenses & Grammar": ["perfect", "continuous", "conditionals", "future", "tenses", "verb", "grammar"],
    "English: Vocabulary & Prepositions": ["prepositions", "vocabulary", "phrasal", "linking"],
    "English: Reading & Structure": ["reading", "comprehension", "reordering", "correction"]
  };

  const getMacroCategory = (microTopic: string) => {
    for (const [macro, keywords] of Object.entries(MACRO_CATEGORY_MAP)) {
      if (keywords.some(kw => microTopic.toLowerCase().includes(kw))) {
        return macro;
      }
    }
    return "Остальные темы";
  };

  const aggregatedStats: Record<string, { earned: number, possible: number }> = {};
  
  for (const [microTopic, stats] of Object.entries(diagnosticsRaw)) {
    const s = stats as { earned: number, possible: number };
    if (s.possible === 0) continue; 
    const macro = getMacroCategory(microTopic);
    if (!aggregatedStats[macro]) aggregatedStats[macro] = { earned: 0, possible: 0 };
    aggregatedStats[macro].earned += s.earned;
    aggregatedStats[macro].possible += s.possible;
  }

  return (
    <div id="pdf-diagnostic-report" className="p-12 w-[210mm] min-h-[297mm] " style={{ backgroundColor: C.white, color: C.black, fontFamily: '"Inter", "Arial", sans-serif' }}>
      
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 pb-6 mb-8" style={{ borderColor: C.gray200 }}>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2" style={{ color: C.gray900 }}>Академия Будущих Лидеров</h1>
          <h2 className="text-xl font-semibold" style={{ color: C.blue600 }}>Диагностическая Аналитика</h2>
        </div>
        <div className="text-right">
          <div className="text-sm uppercase tracking-wider font-semibold mb-1" style={{ color: C.gray500 }}>Официальный отчет</div>
          <div className="text-sm font-medium" style={{ color: C.gray700 }}>Дата: {date ? new Date(date).toLocaleDateString('ru-RU') : new Date().toLocaleDateString('ru-RU')}</div>
        </div>
      </div>

      {/* Student Info */}
      <div className="rounded-xl p-6 mb-8 border flex justify-between items-center shadow-sm" style={{ backgroundColor: C.slate50, borderColor: C.slate100 }}>
        <div>
          <div className="text-sm mb-1" style={{ color: C.slate500 }}>Ученик</div>
          <div className="text-2xl font-bold" style={{ color: C.slate800 }}>{displayName || "Без имени"}</div>
        </div>
        <div className="text-right">
          <div className="text-sm mb-1" style={{ color: C.slate500 }}>Класс</div>
          <div className="text-2xl font-bold" style={{ color: C.slate800 }}>{grade || "?"} класс</div>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-bold mb-4 uppercase tracking-wide border-b pb-2" style={{ color: C.gray800, borderColor: C.gray200 }}>Детализация навыков</h3>
        <p className="text-sm mb-6" style={{ color: C.gray600 }}>
          Ниже представлен детальный разбор усвоения тем. Зеленым отмечены сильные стороны ученика, требующие лишь поддержки. Желтым — темы с пробелами, требующие проработки. Красным — критические зоны, нуждающиеся в интенсивном обучении.
        </p>
        
        <div className="space-y-4">
          {Object.entries(aggregatedStats)
            .sort((a, b) => (b[1].earned / b[1].possible) - (a[1].earned / a[1].possible))
            .map(([topic, stats]) => {
            const earned = stats.earned || 0;
            const possible = stats.possible || 0;
            const percentage = possible > 0 ? Math.round((earned / possible) * 100) : 0;
            const styleObj = getSubjectColor(topic);

            return (
              <div key={topic} className="flex flex-col gap-2 p-4 rounded-xl border shadow-sm" style={{ backgroundColor: C.white, borderColor: C.gray100 }}>
                <div className="flex justify-between items-center mb-1">
                  <div className="font-semibold" style={{ color: C.gray800 }}>{topic}</div>
                  <div className="text-sm font-bold px-3 py-1 rounded-full" style={{ backgroundColor: C.slate100, color: getStatusTextColor(percentage) }}>
                    {getStatusText(percentage)} ({percentage}%)
                  </div>
                </div>
                
                <div className="w-full rounded-full h-3 overflow-hidden" style={{ backgroundColor: C.gray100 }}>
                  <div 
                    className="h-3 rounded-full transition-all" 
                    style={{ width: `${percentage}%`, backgroundColor: getStatusColor(percentage) }}
                  ></div>
                </div>
                
                <div className="flex justify-between text-xs mt-1" style={{ color: C.gray500 }}>
                  <span>Решено верно: {earned} из {possible}</span>
                  <span className="px-2 py-0.5 rounded-md font-medium text-[10px]" style={{ color: styleObj.color, backgroundColor: styleObj.backgroundColor }}>
                    {styleObj.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer / Conclusion */}
      <div className="mt-12 border p-6 rounded-xl" style={{ backgroundColor: C.blue50, borderColor: C.blue100 }}>
        <h4 className="font-bold mb-2" style={{ color: C.blue800 }}>Заключение специалиста</h4>
        <p className="text-sm leading-relaxed" style={{ color: C.blue900 }}>
          Данная диагностика является срезом текущих академических навыков. Результаты позволяют адаптировать учебную программу под индивидуальные потребности ученика, сфокусировав внимание на темах, находящихся в "красной" и "желтой" зонах. Рекомендуется обсудить данные результаты с куратором для выстраивания оптимального образовательного маршрута.
        </p>
      </div>

      <div className="mt-12 pt-6 border-t text-center text-xs" style={{ borderColor: C.gray200, color: C.gray400 }}>
        Академия Будущих Лидеров • Сгенерировано автоматически
      </div>
    </div>
  );
};
