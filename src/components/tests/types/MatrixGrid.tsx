import React from 'react';

export default function MatrixGrid({ question, value, onChange }: any) {
  const columns = question.content?.columns || [];
  const rows = question.content?.rows || [];
  const answers = value || {};

  const handleSelect = (rowId: string, colValue: string) => {
    onChange({
      ...answers,
      [rowId]: colValue,
    });
  };

  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-left border-collapse min-w-[600px]">
        <thead>
          <tr className="border-b-2 border-slate-200">
            <th className="p-4 text-sm font-semibold text-slate-500 w-1/3">Критерий / Вариант</th>
            {columns.map((col: string, idx: number) => (
              <th key={idx} className="p-4 text-sm font-semibold text-center text-slate-700">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row: any) => (
            <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="p-4 text-sm font-medium text-slate-900 leading-relaxed">{row.label}</td>
              {columns.map((col: string, idx: number) => {
                const isSelected = answers[row.id] === col;
                return (
                  <td key={idx} className="p-4 text-center align-middle">
                    <label className="inline-flex items-center justify-center w-full h-full cursor-pointer">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'border-purple-600 bg-purple-50' : 'border-slate-300 hover:border-purple-300'}`}>
                        {isSelected && <div className="w-3 h-3 rounded-full bg-purple-600" />}
                      </div>
                      <input
                        type="radio"
                        className="hidden"
                        name={`row-${row.id}`}
                        checked={isSelected}
                        onChange={() => handleSelect(row.id, col)}
                      />
                    </label>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
