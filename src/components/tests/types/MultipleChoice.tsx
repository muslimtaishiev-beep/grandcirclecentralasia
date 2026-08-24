import React from 'react';
import DOMPurify from 'dompurify';

export default function MultipleChoice({ question, value, onChange }: any) {
  const options = question.content?.options || [];
  const optionsHtml = question.content?.optionsHtml || options;

  return (
    <div className="space-y-3">
      {options.map((opt: string, idx: number) => {
        const isSelected = value === opt;
        return (
          <label 
            key={idx} 
            className={`flex items-center space-x-3 p-4 border rounded-xl cursor-pointer transition-all ${isSelected ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-purple-300'}`}
          >
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-purple-600' : 'border-slate-300'}`}>
              {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-purple-600" />}
            </div>
            <span 
              className="text-slate-700" 
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(optionsHtml[idx] || opt) }} 
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
  );
}
