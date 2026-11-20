import React, { useEffect, useState } from 'react';
import { useOutletContext, useParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useSpreadsheetGrid } from '../../../hooks/collab/useSpreadsheetGrid';
import { useWorkspaceAccess } from '../../../hooks/collab/useWorkspaceAccess';
import { sheetService } from '../../../services/collab/sheetService';
import { parseCell, MAX_COLUMNS } from '../../../services/collab/sheetCore';
import { Button, Spinner, EmptyState, toast, confirmDialog } from '../../../components/ui';
import FormulaBar from './components/FormulaBar';
import CellFormatToolbar from './components/CellFormatToolbar';
import SpreadsheetGrid from './components/SpreadsheetGrid';

export default function SheetSpreadsheetPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  // Маршрут объявлен как :orgId/sheets/:sheetId.
  const { sheetId } = useParams<{ sheetId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const access = useWorkspaceAccess(activeTenant?.id);
  const tenantId: string | undefined = activeTenant?.id;
  const listPath = `/workspace/${tenantId}/sheets`;

  // /sheets/new — создать таблицу и открыть её.
  useEffect(() => {
    if (sheetId !== 'new' || !tenantId || !user) return;
    let alive = true;
    sheetService.createSheet(tenantId, user.uid)
      .then(id => { if (alive) navigate(`${listPath}/${id}`, { replace: true }); })
      .catch(() => { toast.error('Не удалось создать таблицу'); if (alive) navigate(listPath, { replace: true }); });
    return () => { alive = false; };
  }, [sheetId, tenantId, user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const g = useSpreadsheetGrid(tenantId || '', sheetId === 'new' ? undefined : sheetId, (m) => toast.error(m));
  const { sheet, cells, loading, denied, activeCell, setActiveCell, isEditing, setIsEditing, updateCellValue, updateCellStyle, getActiveCellData, navigateCell } = g;

  // Правка — у кого право «Таблицы» или кто автор (как в правилах базы).
  const canEdit = !!sheet && (access.can('sheets:use') || sheet.authorStaffId === user?.uid);

  // Таблица ответов формы: колонки привязаны к полям формы по порядку.
  const [formLinked, setFormLinked] = useState(false);
  useEffect(() => {
    setFormLinked(false);
    if (!tenantId || !sheetId || sheetId === 'new') return;
    getDocs(query(collection(db, 'custom_forms'), where('tenantId', '==', tenantId), where('sheetId', '==', sheetId)))
      .then(s => setFormLinked(!s.empty)).catch(() => {});
  }, [tenantId, sheetId]);

  // Cmd/Ctrl+Z, Shift+Z, Y — отмена и повтор (не в поле ввода).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); void g.undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); void g.redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [g.undo, g.redo]);

  if (loading || sheetId === 'new') return <div className="p-16 flex justify-center"><Spinner /></div>;
  if (!sheet) {
    return (
      <EmptyState
        title={denied ? 'Нет доступа к таблице' : 'Таблица не найдена'}
        action={<Button variant="secondary" onClick={() => navigate(listPath)}>К списку таблиц</Button>}
      />
    );
  }

  const handleCellKeyDown = (_id: string, e: React.KeyboardEvent) => {
    if (isEditing) {
      if (e.key === 'Enter') { setIsEditing(false); navigateCell('down', true); }
      else if (e.key === 'Tab') { e.preventDefault(); setIsEditing(false); navigateCell('right', true); }
    } else {
      if (e.key === 'ArrowUp') navigateCell('up');
      if (e.key === 'ArrowDown') navigateCell('down');
      if (e.key === 'ArrowLeft') navigateCell('left');
      if (e.key === 'ArrowRight' || e.key === 'Tab') navigateCell('right');
    }
  };

  const withUndo = (text: string) => toast(
    <span className="flex items-center gap-3">{text}<button className="font-semibold underline" onClick={() => void g.undo()}>Отменить</button></span>,
  );

  const rowOp = async (at: number, delta: 1 | -1) => {
    if (!canEdit) return;
    if (delta === -1 && !(await confirmDialog({ title: `Удалить строку ${at}?`, confirmLabel: 'Удалить', danger: true }))) return;
    if (await g.shift('row', at, delta)) withUndo(delta === 1 ? 'Строка вставлена' : `Строка ${at} удалена`);
  };
  const colOp = async (at: number, delta: 1 | -1) => {
    if (!canEdit) return;
    if (formLinked) { toast.error('Таблица связана с формой — колонки менять нельзя'); return; }
    if (delta === 1 && (sheet.columnsCount || 26) >= MAX_COLUMNS) { toast.error('Достигнут предел колонок'); return; }
    if (delta === -1 && !(await confirmDialog({ title: 'Удалить колонку?', confirmLabel: 'Удалить', danger: true }))) return;
    if (await g.shift('col', at, delta)) withUndo(delta === 1 ? 'Колонка вставлена' : 'Колонка удалена');
  };

  const active = activeCell ? parseCell(activeCell) : null;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-[var(--bg-app)]">
      <CellFormatToolbar
        onBack={() => navigate(listPath)}
        title={sheet.title}
        onTitleChange={canEdit && user ? (t) => { sheetService.updateTitle(tenantId!, sheet.id, t, user.uid).catch(() => toast.error('Название не сохранено')); } : undefined}
        style={getActiveCellData()?.style}
        onFormat={(updates) => activeCell && updateCellStyle(activeCell, updates)}
        onExport={() => sheetService.exportToCSV({ ...sheet, cells })}
        readOnly={!canEdit}
        onUndo={() => void g.undo()}
        onRedo={() => void g.redo()}
        canUndo={g.canUndo}
        canRedo={g.canRedo}
        onRowAction={(k) => active && void rowOp(active.row, k === 'insert' ? 1 : -1)}
        onColAction={(k) => active && void colOp(active.col, k === 'insert' ? 1 : -1)}
        onAddRows={() => g.addRows(20)}
        onAddColumns={() => g.addColumns(5)}
      />
      <FormulaBar
        activeCell={activeCell}
        activeCellData={getActiveCellData()}
        readOnly={!canEdit}
        onChange={(val) => activeCell && updateCellValue(activeCell, val)}
        onEnter={() => { setIsEditing(false); navigateCell('down', true); }}
      />
      <SpreadsheetGrid
        sheet={sheet}
        cells={cells}
        readOnly={!canEdit}
        activeCell={activeCell}
        isEditing={isEditing}
        onCellClick={(id) => { setActiveCell(id); setIsEditing(false); }}
        onCellDoubleClick={(id) => { if (!canEdit) return; setActiveCell(id); setIsEditing(true); }}
        onCellChange={(id, val) => { updateCellValue(id, val); setIsEditing(false); }}
        onCellKeyDown={handleCellKeyDown}
        onInsertRow={(at) => void rowOp(at, 1)}
        onDeleteRow={(at) => void rowOp(at, -1)}
        onInsertColumn={(at) => void colOp(at, 1)}
        onDeleteColumn={(at) => void colOp(at, -1)}
      />
    </div>
  );
}
