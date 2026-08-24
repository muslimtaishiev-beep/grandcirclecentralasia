import React from 'react';

export default function TextInput({ question, value, onChange }: any) {
  return (
    <div className="mt-4">
      <input
        type="text"
        className="w-full border-b-2 border-slate-300 bg-transparent text-xl py-2 px-1 focus:outline-none focus:border-purple-600 transition-colors"
        placeholder="Введите ваш ответ здесь..."
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
