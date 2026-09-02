import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Folder, MoreVertical, Lock, Eye, Edit3, ShieldAlert } from 'lucide-react';
import { documentService } from '../../../services/collab/documentService';
import { WorkspaceDocument } from '../../../types/collab';
import { useAuth } from '../../../contexts/AuthContext';

export default function DocumentsListPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [docs, setDocs] = useState<WorkspaceDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Доступ ко всем документам — по праву «Управление сотрудниками»
  // (кто ведёт команду, тот видит её бумаги), а не по названию роли.
  const isFullAdmin = Array.isArray(activeTenant?.effectivePermissions)
    ? activeTenant.effectivePermissions.includes('team:manage')
    : ['owner', 'org:owner', 'superadmin', 'admin', 'org:admin'].includes(String(activeTenant?.role));

  useEffect(() => {
    if (!activeTenant?.id || !user?.uid) return;
    const unsub = documentService.subscribeToList(activeTenant.id, user.uid, isFullAdmin, setDocs);
    return () => unsub();
  }, [activeTenant?.id, user?.uid, isFullAdmin]);

  const handleCreate = async () => {
    if (!activeTenant?.id || !user) return;
    const authorName = user.displayName || user.email?.split('@')[0] || 'Сотрудник';
    const newId = await documentService.createDocument(activeTenant.id, user.uid, authorName);
    navigate(`/workspace/${activeTenant.id}/docs/${newId}`);
  };

  const filteredDocs = docs.filter(d => (d.title || '').toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-[var(--bg-app)]">
      <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-panel)] shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-main)] flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-500" />
            Документы & Регламенты
          </h1>
          <p className="text-[var(--text-muted)] mt-1 font-medium text-sm">База знаний команды с разграничением прав доступа ({docs.length})</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input 
              type="text" 
              placeholder="Поиск документов..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] shadow-sm"
            />
          </div>
          <button 
            onClick={handleCreate}
            data-tooltip="Создать приватный документ"
            data-tooltip-pos="bottom"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition flex items-center gap-2 shrink-0 cursor-pointer text-sm"
          >
            <Plus className="w-4 h-4" /> Создать документ
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredDocs.map(doc => {
            const isAuthor = doc.authorStaffId === user?.uid;
            const level = doc.accessLevel || 'company_edit';

            return (
              <div 
                key={doc.id}
                onClick={() => navigate(`/workspace/${activeTenant?.id}/docs/${doc.id}`)}
                className="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-2xl p-5 hover:border-blue-500 hover:shadow-lg transition cursor-pointer group flex flex-col h-52 relative"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center font-bold text-lg">
                    {doc.icon || <FileText className="w-5 h-5" />}
                  </div>

                  {/* Access Level Badge */}
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                    level === 'private' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                    level === 'company_view' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' :
                    level === 'specific_users' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' :
                    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  }`}>
                    {level === 'private' ? <Lock className="w-3 h-3" /> : level === 'company_view' ? <Eye className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
                    <span>{level === 'private' ? 'Приватно' : level === 'company_view' ? 'Чтение' : level === 'specific_users' ? 'Избранным' : 'Редактирование'}</span>
                  </span>
                </div>

                <h3 className="font-bold text-[var(--text-main)] text-base line-clamp-2 mt-2 group-hover:text-blue-600 transition">{doc.title}</h3>
                
                <div className="mt-auto pt-4 border-t border-[var(--border-color)] flex items-center justify-between text-xs font-medium text-[var(--text-muted)]">
                  <span>{isAuthor ? 'Автор: Вы' : doc.authorName || 'Автор: Сотрудник'}</span>
                  <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}

          {filteredDocs.length === 0 && (
            <div className="col-span-full py-20 text-center flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-color)] rounded-2xl">
              <FileText className="w-12 h-12 text-[var(--text-muted)] opacity-30 mb-4" />
              <h3 className="text-lg font-bold text-[var(--text-main)] mb-1">Документов не найдено</h3>
              <p className="text-[var(--text-muted)] font-medium max-w-sm mb-6">Документы приватны или не расшарены с вами авторами.</p>
              <button 
                onClick={handleCreate}
                className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 transition text-sm cursor-pointer"
              >
                Создать новый документ
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
