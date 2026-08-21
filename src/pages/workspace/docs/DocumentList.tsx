import React, { useState } from 'react';
import { useOutletContext, useParams, Link, useNavigate } from 'react-router-dom';
import { Search, Plus, FileText, MoreVertical, Loader2, Trash } from 'lucide-react';
import { useDocumentList } from '../../../lib/useCollaboration';
import { collection, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export default function DocumentList() {
  const { activeTenant } = useOutletContext<any>();
  const { orgId } = useParams();
  const navigate = useNavigate();
  
  const { documents, loading } = useDocumentList(orgId);
  const [isCreating, setIsCreating] = useState(false);

  const createDocument = async () => {
    setIsCreating(true);
    try {
      const docRef = await addDoc(collection(db, 'documents'), {
        tenantId: orgId,
        title: 'Новый документ',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ydocState: ''
      });
      navigate(`/workspace/${orgId}/docs/${docRef.id}`);
    } catch (e) {
      console.error(e);
      setIsCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, docId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Вы уверены, что хотите удалить этот документ?')) {
      await deleteDoc(doc(db, 'documents', docId));
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6 max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)]">Документы</h1>
          <p className="text-[var(--text-muted)] mt-1">База знаний, договоры и регламенты для {activeTenant?.name}</p>
        </div>
        <button 
          onClick={createDocument}
          disabled={isCreating}
          className="bg-[var(--accent)] text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:opacity-90 transition shadow-sm disabled:opacity-50"
        >
          {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} 
          Создать документ
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex gap-4">
        <div className="w-96 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input 
            type="text" 
            placeholder="Поиск документов..."
            className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text-main)]"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-20 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)] border-dashed">
            <FileText className="w-12 h-12 mx-auto text-[var(--text-muted)] mb-3 opacity-50" />
            <h3 className="text-[var(--text-main)] font-semibold mb-1">Нет документов</h3>
            <p className="text-[var(--text-muted)] text-sm mb-4">Создайте свой первый документ для совместной работы</p>
            <button 
              onClick={createDocument}
              className="text-[var(--accent)] hover:underline text-sm font-medium"
            >
              Создать новый документ
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {documents.map(document => {
              const updatedAt = document.updatedAt?.toDate 
                ? document.updatedAt.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) 
                : 'Недавно';

              return (
                <Link 
                  key={document.id} 
                  to={`/workspace/${orgId}/docs/${document.id}`}
                  className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-4 flex flex-col hover:border-[var(--accent)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <FileText className="w-5 h-5" />
                    </div>
                    <button 
                      onClick={(e) => handleDelete(e, document.id)}
                      className="text-[var(--text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-semibold text-[var(--text-main)] text-sm mb-1 line-clamp-2">{document.title}</h3>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)]">
                    Обновлен: {updatedAt}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
