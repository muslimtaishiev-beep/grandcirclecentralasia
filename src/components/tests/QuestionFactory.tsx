import React from 'react';
import DOMPurify from 'dompurify';

interface Props {
  question: any;
  value: any;
  onChange: (val: any) => void;
}

export default function QuestionFactory({ question, value, onChange }: Props) {
  if (!question) return null;

  const rawType = (question.type || 'multiple_choice').toString().toLowerCase().replace(/[^a-z0-9]/g, '');

  const promptText = question.text || question.prompt || question.content?.prompt || '';
  const htmlPrompt = question.html || question.content?.html;
  const instruction = question.instruction || question.content?.instruction;

  // Type Classifications
  const isMultipleChoice = rawType === 'multiplechoice';
  const isTextInput = rawType === 'textinput' || rawType === 'numberinput' || rawType === 'freetext';
  const isMatrix = rawType === 'matrixgrid' || rawType === 'logicmatrix';
  const isOrdering = rawType === 'ordering' || rawType === 'draganddrop';
  const isDropdown = rawType === 'dropdownmultiple' || rawType === 'inlinedropdown';

  return (
    <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
      
      {/* Question Prompt */}
      {htmlPrompt ? (
        <h3 
          className="text-lg md:text-xl font-bold text-slate-800 leading-relaxed font-sans" 
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlPrompt) }} 
        />
      ) : (
        <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-relaxed font-sans">
          {promptText}
        </h3>
      )}

      {/* Optional Instruction */}
      {instruction && (
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          {instruction}
        </p>
      )}

      {/* 1. MULTIPLE CHOICE */}
      {isMultipleChoice && (
        <div className="space-y-3 pt-2">
          {(question.options || question.content?.options || []).map((opt: string, idx: number) => {
            const isSelected = value === opt;
            const optionsHtml = question.optionsHtml || question.content?.optionsHtml || [];
            const optHtml = optionsHtml[idx] || opt;

            return (
              <label 
                key={idx} 
                className={`flex items-center space-x-3.5 p-4 border-2 rounded-2xl cursor-pointer transition-all ${
                  isSelected 
                    ? 'border-purple-600 bg-purple-50/80 shadow-xs' 
                    : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  isSelected ? 'border-purple-600 bg-purple-600' : 'border-slate-300'
                }`}>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <span 
                  className="text-slate-800 font-medium text-base leading-snug" 
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(optHtml) }} 
                />
                <input
                  type="radio"
                  className="hidden"
                  checked={isSelected}
                  onChange={() => onChange(opt)}
                />
              </label>
            );
          })}
        </div>
      )}

      {/* 2. TEXT / NUMBER INPUT / FREE TEXT */}
      {isTextInput && (
        <div className="pt-2">
          <input
            type={rawType === 'numberinput' ? 'number' : 'text'}
            className="w-full border-b-2 border-slate-300 bg-slate-50/50 text-xl py-3 px-4 rounded-t-xl focus:outline-none focus:border-purple-600 focus:bg-white transition-all font-mono text-slate-900"
            placeholder="Введите ваш ответ..."
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )}

      {/* 3. LOGIC MATRIX GRID */}
      {isMatrix && (() => {
        const rows = question.matrixRows || question.rows || question.content?.rows || [];
        const cols = question.matrixCols || question.columns || question.content?.columns || [];
        const answers = (typeof value === 'object' && value !== null) ? value : {};

        return (
          <div className="overflow-x-auto pt-2">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b-2 border-slate-200 bg-slate-50/80">
                  <th className="p-3 text-xs font-bold uppercase tracking-wider text-slate-500">Элемент</th>
                  {cols.map((col: string, idx: number) => (
                    <th key={idx} className="p-3 text-xs font-bold uppercase tracking-wider text-center text-slate-700">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row: any, rIdx: number) => {
                  const rowLabel = typeof row === 'string' ? row : (row.label || row.name || `Элемент ${rIdx + 1}`);
                  const rowKey = typeof row === 'string' ? row : (row.id || rowLabel);
                  return (
                    <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 text-sm font-semibold text-slate-800">{rowLabel}</td>
                      {cols.map((col: string, cIdx: number) => {
                        const isSelected = answers[rowKey] === col;
                        return (
                          <td key={cIdx} className="p-3 text-center align-middle">
                            <button
                              type="button"
                              onClick={() => onChange({ ...answers, [rowKey]: col })}
                              className={`w-6 h-6 rounded-full border-2 mx-auto flex items-center justify-center transition-all cursor-pointer ${
                                isSelected ? 'border-purple-600 bg-purple-600' : 'border-slate-300 hover:border-purple-400'
                              }`}
                            >
                              {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* 4. DROPDOWN / INLINE DROPDOWN */}
      {isDropdown && (() => {
        const dropdownItems = question.dropdownItems || question.content?.dropdownItems || [];
        const inlineOptions = question.inlineOptions || question.content?.inlineOptions || [];

        if (dropdownItems.length > 0) {
          const answers = (typeof value === 'object' && value !== null) ? value : {};
          return (
            <div className="space-y-4 pt-2">
              {dropdownItems.map((item: any, idx: number) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="font-medium text-slate-800 text-sm">{item.label}</span>
                  <select
                    value={answers[item.label] || ''}
                    onChange={(e) => onChange({ ...answers, [item.label]: e.target.value })}
                    className="px-4 py-2 bg-white border-2 border-slate-200 rounded-xl font-medium text-slate-800 text-sm focus:outline-none focus:border-purple-600 transition"
                  >
                    <option value="">-- Выберите вариант --</option>
                    {(item.options || []).map((opt: string, oIdx: number) => (
                      <option key={oIdx} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          );
        }

        if (inlineOptions.length > 0) {
          return (
            <div className="pt-2">
              <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-slate-800 text-base focus:outline-none focus:border-purple-600 focus:bg-white transition"
              >
                <option value="">-- Выберите правильный вариант --</option>
                {inlineOptions.map((opt: string, idx: number) => (
                  <option key={idx} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          );
        }

        return null;
      })()}

      {/* 5. DRAG AND DROP / ORDERING */}
      {isOrdering && (() => {
        const items = question.dragItems || question.items || question.content?.items || [];
        const currentList = Array.isArray(value) && value.length > 0 ? value : items;

        const moveItem = (fromIdx: number, toIdx: number) => {
          const updated = [...currentList];
          const [moved] = updated.splice(fromIdx, 1);
          updated.splice(toIdx, 0, moved);
          onChange(updated);
        };

        return (
          <div className="space-y-3 pt-2">
            <p className="text-xs font-semibold text-slate-400">Упорядочите элементы, нажимая стрелки вверх/вниз:</p>
            {currentList.map((item: any, idx: number) => {
              const itemText = typeof item === 'string' ? item : (item.text || item.label);
              return (
                <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-800 font-bold text-sm">
                  <span>{idx + 1}. {itemText}</span>
                  <div className="flex items-center gap-2">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => moveItem(idx, idx - 1)}
                        className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs hover:bg-slate-100 transition cursor-pointer"
                      >
                        ▲ Вверх
                      </button>
                    )}
                    {idx < currentList.length - 1 && (
                      <button
                        type="button"
                        onClick={() => moveItem(idx, idx + 1)}
                        className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs hover:bg-slate-100 transition cursor-pointer"
                      >
                        ▼ Вниз
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Fallback for unrecognized types */}
      {!isMultipleChoice && !isTextInput && !isMatrix && !isOrdering && !isDropdown && (
        <div className="p-4 bg-amber-50 text-amber-800 rounded-2xl border border-amber-200 text-sm font-medium">
          Вопрос типа <b>{question.type}</b>:
          <div className="mt-2">
            <input
              type="text"
              className="w-full border border-amber-300 rounded-xl p-3 bg-white text-slate-900 text-sm font-medium"
              placeholder="Введите ваш ответ..."
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
            />
          </div>
        </div>
      )}

    </div>
  );
}
