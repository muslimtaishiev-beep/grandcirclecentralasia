import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Table, Plus, Search, Folder, MoreVertical } from 'lucide-react';
import { sheetService } from '../../../services/collab/sheetService';
import { WorkspaceSpreadsheet } from '../../../types/collab';
import { useAuth } from '../../../contexts/AuthContext';

export default function SheetsListPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sheets, setSheets] = useState<WorkspaceSpreadsheet[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!activeTenant?.id) return;
    const unsub = sheetService.subscribeToList(activeTenant.id, setSheets);
    return () => unsub();
  }, [activeTenant?.id]);

  const handleCreate = async () => {
    if (!activeTenant?.id || !user) return;
    const newId = await sheetService.createSheet(activeTenant.id, user.uid);
    navigate(`/${activeTenant.id}/sheets/${newId}`);
  };

  const filteredSheets = sheets.filter(s => s.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-[var(--bg-app)]">
      <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-panel)] shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-main)] flex items-center gap-2">
            <Table className="w-6 h-6 text-emerald-500" />
            Таблицы
          </h1>
          <p className="text-[var(--text-muted)] mt-1 font-medium text-sm">Финансы, списки, расчеты</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input 
              type="text" 
              placeholder="Поиск таблиц..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <button 
            onClick={handleCreate}
            className="px-4 py-2 bg-[var(--accent)] text-white font-bold rounded-xl shadow-md hover:brightness-110 transition flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" /> Создать
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredSheets.map(sheet => (
            <div 
              key={sheet.id}
              onClick={() => navigate(`/${activeTenant?.id}/sheets/${sheet.id}`)}
              className="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-2xl p-5 hover:border-[var(--accent)] hover:shadow-md transition cursor-pointer group flex flex-col h-48"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center font-bold text-lg">
                  <Table className="w-5 h-5" />
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); alert('Menu'); }}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] rounded-md opacity-0 group-hover:opacity-100 transition"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
              <h3 className="font-bold text-[var(--text-main)] line-clamp-2 mt-2">{sheet.title}</h3>
              <div className="mt-auto pt-4 flex items-center gap-2 text-xs font-medium text-[var(--text-muted)]">
                <Folder className="w-3.5 h-3.5 opacity-70" /> Мои таблицы
                <span className="ml-auto opacity-70">{new Date(sheet.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}

          {filteredSheets.length === 0 && (
            <div className="col-span-full py-20 text-center flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-color)] rounded-2xl">
              <Table className="w-12 h-12 text-[var(--text-muted)] opacity-30 mb-4" />
              <h3 className="text-lg font-bold text-[var(--text-main)] mb-1">Таблиц нет</h3>
              <p className="text-[var(--text-muted)] font-medium max-w-sm mb-6">Создайте первую электронную таблицу для ведения расчетов.</p>
              <button 
                onClick={handleCreate}
                className="px-6 py-2 bg-[var(--accent)] text-white font-bold rounded-xl shadow-sm hover:brightness-110 transition"
              >
                Создать таблицу
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
