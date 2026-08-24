import React from 'react';
import MultipleChoice from './types/MultipleChoice';
import TextInput from './types/TextInput';
import Ordering from './types/Ordering';
import MatrixGrid from './types/MatrixGrid';
import DOMPurify from 'dompurify';

interface Props {
  question: {
    id: string;
    type: 'MULTIPLE_CHOICE' | 'TEXT_INPUT' | 'ORDERING' | 'MATRIX_GRID';
    prompt: string;
    content: any;
  };
  value: any;
  onChange: (val: any) => void;
}

export default function QuestionFactory({ question, value, onChange }: Props) {
  const isHtmlPrompt = question.content?.html;

  return (
    <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
      {isHtmlPrompt ? (
        <h3 
          className="text-lg md:text-xl font-bold text-slate-800 leading-relaxed" 
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(question.content.html) }} 
        />
      ) : (
        <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-relaxed">
          {question.prompt}
        </h3>
      )}

      {question.content?.instruction && (
        <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">
          {question.content.instruction}
        </p>
      )}

      {question.type === 'MULTIPLE_CHOICE' && (
        <MultipleChoice 
          question={question} 
          value={value} 
          onChange={onChange} 
        />
      )}

      {question.type === 'TEXT_INPUT' && (
        <TextInput 
          question={question}
          value={value} 
          onChange={onChange} 
        />
      )}

      {question.type === 'ORDERING' && (
        <Ordering 
          question={question}
          value={value} 
          onChange={onChange} 
        />
      )}

      {question.type === 'MATRIX_GRID' && (
        <MatrixGrid 
          question={question}
          value={value} 
          onChange={onChange} 
        />
      )}

      {!['MULTIPLE_CHOICE', 'TEXT_INPUT', 'ORDERING', 'MATRIX_GRID'].includes(question.type) && (
        <div className="p-4 bg-amber-50 text-amber-700 rounded-xl border border-amber-200">
          Данный тип вопроса <b>{question.type}</b> пока не поддерживается в этой версии платформы.
        </div>
      )}
    </div>
  );
}
