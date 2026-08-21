import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSpreadsheetList } from '../../../lib/useSpreadsheet';
import { Plus, Table, Search, Trash2, Calendar, FileSpreadsheet, Loader2, Sparkles } from 'lucide-react';

export default function SpreadsheetList() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const { spreadsheets, loading, createSpreadsheet, deleteSpreadsheet } = useSpreadsheetList(orgId);
  const [searchTerm, setSearchTerm] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const newId = await createSpreadsheet('Новая таблица');
      if (newId) {
        navigate(`/workspace/${orgId}/sheets/${newId}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const filtered = spreadsheets.filter(s =>
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[var(--bg-app)] p-6 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[var(--border-color)] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
             Workspace Spreadsheets
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-main)] tracking-tight">Электронные Таблицы</h1>
          <p className="text-sm text-[var(--text-muted)]">Аналог Google Sheets с поддержкой формул, стилей и экспорта.</p>
        </div>

        <button
          onClick={handleCreate}
          disabled={creating}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-sm transition cursor-pointer"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          <span>Создать таблицу</span>
        </button>
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Поиск таблиц по названию..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-main)] outline-hidden focus:border-emerald-500 transition"
          />
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center flex-1 py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)] mb-2" />
          <span className="text-xs text-[var(--text-muted)]">Загрузка таблиц...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-16 border-2 border-dashed border-[var(--border-color)] rounded-2xl bg-[var(--bg-surface)]/50">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
            <Table className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-[var(--text-main)] mb-1">Нет таблиц</h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm text-center mb-4">
            Создайте свою первую электронную таблицу для ведения отчётов, расчёта оценок и управления данными.
          </p>
          <button
            onClick={handleCreate}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" /> Создать таблицу
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((sheet) => {
            const sheetCount = sheet.sheets?.length || 1;
            const updatedDate = sheet.updatedAt?.toDate
              ? sheet.updatedAt.toDate().toLocaleDateString('ru-RU')
              : 'Только что';

            return (
              <div
                key={sheet.id}
                className="group relative bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-emerald-500/50 rounded-2xl p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        if (confirm(`Удалить таблицу "${sheet.title}"?`)) deleteSpreadsheet(sheet.id);
                      }}
                      className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <Link
                    to={`/workspace/${orgId}/sheets/${sheet.id}`}
                    className="font-bold text-[var(--text-main)] group-hover:text-emerald-500 transition line-clamp-1 block mb-1 text-base"
                  >
                    {sheet.title}
                  </Link>

                  <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-500" /> {sheetCount} лист(ов) • Формулы & Стили
                  </p>
                </div>

                <div className="mt-6 pt-3 border-t border-[var(--border-color)] flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{updatedDate}</span>
                  </div>
                  <Link
                    to={`/workspace/${orgId}/sheets/${sheet.id}`}
                    className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
                  >
                    Открыть →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
