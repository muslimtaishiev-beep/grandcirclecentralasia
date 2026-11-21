import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Table, Plus, Search, MoreVertical, Copy, Archive, ArchiveRestore, Trash2, Pencil, ScanText } from 'lucide-react';
import { sheetService } from '../../../services/collab/sheetService';
import { WorkspaceSpreadsheet } from '../../../types/collab';
import { useAuth } from '../../../contexts/AuthContext';
import { useWorkspaceAccess } from '../../../hooks/collab/useWorkspaceAccess';
import { Button, EmptyState, Spinner, toast, confirmDialog } from '../../../components/ui';

export default function SheetsListPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const access = useWorkspaceAccess(activeTenant?.id);
  const seeAll = access.can('sheets:use');
  const canCreate = seeAll;
  const [sheets, setSheets] = useState<WorkspaceSpreadsheet[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenant?.id || !user?.uid) return;
    setFailed(false);
    const unsub = sheetService.subscribeToList(activeTenant.id, user.uid, seeAll, setSheets, () => { setFailed(true); setSheets([]); });
    return () => unsub();
  }, [activeTenant?.id, user?.uid, seeAll]);

  useEffect(() => {
    if (!menuId) return;
    const close = () => setMenuId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuId]);

  const visible = useMemo(() => (sheets || [])
    .filter(s => !!s.archivedAt === showArchive)
    .filter(s => (s.title || '').toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)), [sheets, showArchive, searchTerm]);
  const archivedCount = (sheets || []).filter(s => s.archivedAt).length;

  const handleCreate = async () => {
    if (!activeTenant?.id || !user) return;
    try {
      const newId = await sheetService.createSheet(activeTenant.id, user.uid);
      navigate(`/workspace/${activeTenant.id}/sheets/${newId}`);
    } catch { toast.error('Не удалось создать таблицу'); }
  };

  const run = async (p: Promise<unknown>, ok: string) => {
    try { await p; toast.success(ok); } catch (e: any) { toast.error(e?.code === 'permission-denied' ? 'Нет прав на это действие' : 'Не получилось — повторите'); }
  };

  const rename = async (s: WorkspaceSpreadsheet) => {
    const t = window.prompt('Название таблицы', s.title)?.trim();
    if (t && t !== s.title && user) await run(sheetService.updateTitle(activeTenant.id, s.id, t, user.uid), 'Переименовано');
  };

  const remove = async (s: WorkspaceSpreadsheet) => {
    if (!(await confirmDialog({ title: `Удалить таблицу «${s.title}»?`, message: 'Восстановить будет нельзя. Лучше отправить в архив.', confirmLabel: 'Удалить', danger: true }))) return;
    await run(sheetService.deleteSheet(activeTenant.id, s.id), 'Таблица удалена');
  };

  const item = 'w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-surface-hover)] flex items-center gap-2 text-[var(--text-main)]';

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-[var(--bg-app)]">
      <div className="p-4 sm:p-6 border-b border-[var(--border-color)] bg-[var(--bg-panel)] shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-black text-[var(--text-main)] flex items-center gap-2">
          <Table className="w-6 h-6 text-emerald-500" /> Таблицы
        </h1>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input type="text" placeholder="Поиск" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2 text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]" />
          </div>
          {archivedCount > 0 && (
            <Button variant="secondary" onClick={() => setShowArchive(v => !v)}>{showArchive ? 'Таблицы' : `Архив · ${archivedCount}`}</Button>
          )}
          {canCreate && <Button variant="secondary" icon={<ScanText className="w-4 h-4" />} onClick={() => navigate(`/workspace/${activeTenant.id}/digitize`)}>Оцифровать</Button>}
          {canCreate && <Button icon={<Plus className="w-4 h-4" />} onClick={() => void handleCreate()}>Создать</Button>}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {sheets === null ? (
          <div className="py-20 flex justify-center"><Spinner /></div>
        ) : failed ? (
          <EmptyState title="Нет доступа к таблицам" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {visible.map(sheet => {
              const mine = sheet.authorStaffId === user?.uid;
              const canDelete = mine || access.isAdmin;
              return (
                <div key={sheet.id} onClick={() => navigate(`/workspace/${activeTenant?.id}/sheets/${sheet.id}`)}
                  className="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-2xl p-5 hover:border-[var(--accent)] hover:shadow-md transition cursor-pointer group flex flex-col h-44 relative">
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center"><Table className="w-5 h-5" /></div>
                    <button onClick={(e) => { e.stopPropagation(); setMenuId(menuId === sheet.id ? null : sheet.id); }}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] rounded-md sm:opacity-0 group-hover:opacity-100 transition">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                  {menuId === sheet.id && (
                    <div onClick={e => e.stopPropagation()} className="absolute right-4 top-14 z-20 w-48 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xl py-1">
                      <button className={item} onClick={() => { setMenuId(null); void rename(sheet); }}><Pencil className="w-4 h-4" /> Переименовать</button>
                      {canCreate && <button className={item} onClick={() => { setMenuId(null); if (user) void run(sheetService.duplicateSheet(activeTenant.id, sheet, user.uid), 'Копия создана'); }}><Copy className="w-4 h-4" /> Копировать</button>}
                      <button className={item} onClick={() => { setMenuId(null); if (user) void run(sheetService.setArchived(activeTenant.id, sheet.id, !sheet.archivedAt, user.uid), sheet.archivedAt ? 'Возвращено из архива' : 'Отправлено в архив'); }}>
                        {sheet.archivedAt ? <><ArchiveRestore className="w-4 h-4" /> Из архива</> : <><Archive className="w-4 h-4" /> В архив</>}
                      </button>
                      {canDelete && <button className={`${item} !text-red-500`} onClick={() => { setMenuId(null); void remove(sheet); }}><Trash2 className="w-4 h-4" /> Удалить</button>}
                    </div>
                  )}
                  <h3 className="font-bold text-[var(--text-main)] line-clamp-2 mt-2">{sheet.title}</h3>
                  <div className="mt-auto pt-3 flex items-center gap-2 text-xs font-medium text-[var(--text-muted)]">
                    <span className="truncate">{mine ? 'Вы' : ''}</span>
                    <span className="ml-auto opacity-70">{new Date(sheet.updatedAt).toLocaleDateString('ru-RU')}</span>
                  </div>
                </div>
              );
            })}
            {visible.length === 0 && (
              <div className="col-span-full">
                <EmptyState icon={<Table className="w-10 h-10" />} title={showArchive ? 'Архив пуст' : 'Таблиц нет'}
                  action={!showArchive && canCreate ? <Button onClick={() => void handleCreate()}>Создать таблицу</Button> : undefined} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
