import React, { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Search, Plus, FileQuestion, MoreVertical, Play, Settings, Users, ShieldCheck, Copy, Link2 } from 'lucide-react';
import { CopyButton } from '../../../components/ui/CopyButton';

export default function TestList() {
  const { activeTenant } = useOutletContext<any>() || {};
  
  const [tests] = useState([
    { id: '1', title: 'Главный Вступительный Экзамен (10 класс)', status: 'Active', questions: 25, participants: 42, timeLimit: 60, aiProctoring: true },
    { id: '2', title: 'Оценка Английского Языка (CEFR / Вступительный)', status: 'Active', questions: 50, participants: 120, timeLimit: 90, aiProctoring: true },
    { id: '3', title: 'Логика и Психологический Опросник', status: 'Active', questions: 15, participants: 88, timeLimit: 30, aiProctoring: false },
  ]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-[var(--text-main)]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-4">
        <div>
          <h1 className="text-2xl font-bold">Тесты и Экзамены Организации</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">Управление онлайн-тестированием и проверкой ответов для {activeTenant?.name}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link 
            to={`/workspace/${activeTenant?.id}/tests/manage`}
            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition"
          >
            <ShieldCheck className="w-4 h-4" /> Кабинет Проверки Менеджера
          </Link>
          
          <Link 
            to={`/workspace/${activeTenant?.id}/tests/new`}
            className="bg-[var(--accent)] text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:opacity-90 transition shadow-xs"
          >
            <Plus className="w-4 h-4" /> Создать Тест
          </Link>
        </div>
      </div>

      {/* Manager Test Review Banner */}
      <div className="bg-emerald-950/40 border border-emerald-800/80 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h3 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Кабинет Проверки Тестов и Результатов для Управляющего</span>
          </h3>
          <p className="text-xs text-emerald-200/70 mt-1">Просмотр результатов абитуриентов, ответов на тесты, фрагментов видео прокторинга, PDF-отчетов и генерация сертификатов.</p>
        </div>
        <Link
          to={`/workspace/${activeTenant?.id || "org_future_leaders"}/tests/manage`}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 shrink-0"
        >
          <span>Открыть Кабинет Проверки</span>
          <span>➔</span>
        </Link>
      </div>

      {/* List */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--bg-panel)] border-b border-[var(--border-color)] text-[var(--text-muted)] font-mono uppercase">
            <tr>
              <th className="px-6 py-3.5 font-bold">Название Теста</th>
              <th className="px-6 py-3.5 font-bold">Параметры</th>
              <th className="px-6 py-3.5 font-bold">Статус</th>
              <th className="px-6 py-3.5 font-bold text-right">Ссылка для Учеников</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {tests.map(test => {
              const studentLink = `${window.location.origin}/test?orgId=${activeTenant?.id}&testId=${test.id}`;
              return (
                <tr key={test.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition group">
                  <td className="px-6 py-4">
                    <Link to={`/workspace/${activeTenant?.id}/tests/${test.id}`} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center border border-purple-500/20">
                        <FileQuestion className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-[var(--text-main)] group-hover:text-[var(--accent)] transition">{test.title}</span>
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                      <span>{test.questions} вопр.</span>
                      <span>{test.timeLimit} мин.</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {test.participants}
                      </span>
                      {test.aiProctoring && (
                        <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border border-purple-500/20">
                          AI Прокторинг
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      {test.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <CopyButton text={studentLink} label="Скопировать ссылку" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
