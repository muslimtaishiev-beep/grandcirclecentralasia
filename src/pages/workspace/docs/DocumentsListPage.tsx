import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Folder, MoreVertical } from 'lucide-react';
import { documentService } from '../../../services/collab/documentService';
import { WorkspaceDocument } from '../../../types/collab';
import { useAuth } from '../../../contexts/AuthContext';

export default function DocumentsListPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [docs, setDocs] = useState<WorkspaceDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!activeTenant?.id) return;
    const unsub = documentService.subscribeToList(activeTenant.id, setDocs);
    return () => unsub();
  }, [activeTenant?.id]);

  const handleCreate = async () => {
    if (!activeTenant?.id || !user) return;
    const newId = await documentService.createDocument(activeTenant.id, user.uid);
    navigate(`/workspace/${activeTenant.id}/docs/${newId}`);
  };

  const filteredDocs = docs.filter(d => d.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-[var(--bg-app)]">
      <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-panel)] shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-main)] flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-500" />
            Документы
          </h1>
          <p className="text-[var(--text-muted)] mt-1 font-medium text-sm">База знаний и регламенты команды</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input 
              type="text" 
              placeholder="Поиск документов..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <button 
            onClick={handleCreate}
            className="px-4 py-2 bg-[var(--accent)] text-white font-bold rounded-xl shadow-md hover:brightness-110 transition flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Создать
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredDocs.map(doc => (
            <div 
              key={doc.id}
              onClick={() => navigate(`/workspace/${activeTenant?.id}/docs/${doc.id}`)}
              className="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-2xl p-5 hover:border-[var(--accent)] hover:shadow-md transition cursor-pointer group flex flex-col h-48"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center font-bold text-lg">
                  {doc.icon || <FileText className="w-5 h-5" />}
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); alert('Menu'); }}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] rounded-md opacity-0 group-hover:opacity-100 transition"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
              <h3 className="font-bold text-[var(--text-main)] line-clamp-2 mt-2">{doc.title}</h3>
              <div className="mt-auto pt-4 flex items-center gap-2 text-xs font-medium text-[var(--text-muted)]">
                <Folder className="w-3.5 h-3.5 opacity-70" /> Общая папка
                <span className="ml-auto opacity-70">{new Date(doc.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}

          {filteredDocs.length === 0 && (
            <div className="col-span-full py-20 text-center flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-color)] rounded-2xl">
              <FileText className="w-12 h-12 text-[var(--text-muted)] opacity-30 mb-4" />
              <h3 className="text-lg font-bold text-[var(--text-main)] mb-1">Документов нет</h3>
              <p className="text-[var(--text-muted)] font-medium max-w-sm mb-6">Создайте первый документ для базы знаний вашей команды.</p>
              <button 
                onClick={handleCreate}
                className="px-6 py-2 bg-[var(--accent)] text-white font-bold rounded-xl shadow-sm hover:brightness-110 transition"
              >
                Создать документ
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
