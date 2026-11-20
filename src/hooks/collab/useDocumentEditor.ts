import { useState, useEffect, useCallback, useRef } from 'react';
import { documentService } from '../../services/collab/documentService';
import { mergeBlocks } from '../../services/collab/docMerge';
import { WorkspaceDocument, DocBlock } from '../../types/collab';
import { useAuth } from '../../contexts/AuthContext';
import { generateShortId } from '../../lib/utils';

const clone = (b: DocBlock[]) => JSON.parse(JSON.stringify(b)) as DocBlock[];
const DEBOUNCE = 400;

/**
 * Редактор документа для нескольких человек сразу.
 *
 * base — последние блоки с сервера, local — то, что видит и правит
 * сотрудник. Правки копятся и уходят пачкой через DEBOUNCE мс: в транзакции
 * они сливаются с тем, что успели сохранить коллеги (mergeBlocks), поэтому
 * чужой текст не затирается. Пришедшие от коллег изменения так же
 * сливаются с несохранёнными своими. «Сохранено» — только после ответа базы.
 */
export function useDocumentEditor(tenantId: string, docId: string | undefined) {
  const { user } = useAuth();
  const [doc, setDocState] = useState<WorkspaceDocument | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const docRef = useRef<WorkspaceDocument | null>(null);
  const baseRef = useRef<DocBlock[]>([]);
  const dirtyRef = useRef(false);
  const inFlightRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleInFlight = useRef(0);

  const historyRef = useRef<DocBlock[][]>([]);
  const historyIdxRef = useRef<number>(-1);
  const pushHistory = (blocks: DocBlock[]) => {
    const next = historyRef.current.slice(0, historyIdxRef.current + 1);
    next.push(clone(blocks));
    historyRef.current = next.slice(-100);
    historyIdxRef.current = historyRef.current.length - 1;
  };

  const publish = (d: WorkspaceDocument | null) => { docRef.current = d; setDocState(d); };

  const flush = useCallback(async () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const d = docRef.current;
    if (!d || !user || !tenantId || !dirtyRef.current || inFlightRef.current) return;
    inFlightRef.current = true;
    dirtyRef.current = false;
    const base = clone(baseRef.current);
    const local = clone(d.blocks);
    try {
      const merged = await documentService.commitBlocks(tenantId, d.id, base, local, user.uid);
      baseRef.current = merged;
      setSaveError(null);
      // Пока шла запись, сотрудник мог напечатать ещё — сливаем и с этим.
      const cur = docRef.current;
      if (cur) publish({ ...cur, blocks: dirtyRef.current ? mergeBlocks(local, cur.blocks, merged) : merged });
    } catch (e: any) {
      dirtyRef.current = true;
      setSaveError(e?.code === 'permission-denied' ? 'Нет прав на правку' : e?.code === 'not-found' ? 'Документ удалён' : 'Не сохранено — повторяем');
    } finally {
      inFlightRef.current = false;
      if (dirtyRef.current) {
        timerRef.current = setTimeout(() => { void flush(); }, DEBOUNCE * 3);
      } else if (!titleInFlight.current) {
        setSaving(false);
      }
    }
  }, [tenantId, user]);

  const schedule = useCallback(() => {
    dirtyRef.current = true;
    setSaving(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void flush(); }, DEBOUNCE);
  }, [flush]);

  useEffect(() => {
    if (!tenantId || !docId) {
      setLoading(false);
      return;
    }
    historyRef.current = [];
    historyIdxRef.current = -1;
    const unsub = documentService.subscribeToDocument(tenantId, docId, (data) => {
      if (!data) { publish(null); setLoading(false); return; }
      const server = data.blocks || [];
      const cur = docRef.current;
      const blocks = cur && cur.id === data.id && (dirtyRef.current || inFlightRef.current)
        ? mergeBlocks(baseRef.current, cur.blocks, server)
        : server;
      if (!inFlightRef.current) baseRef.current = clone(server);
      publish({ ...data, title: titleInFlight.current && cur ? cur.title : data.title, blocks });
      if (historyRef.current.length === 0) {
        pushHistory(blocks);
        if (blocks.length > 0) setActiveBlockId(blocks[0].id);
      }
      setLoading(false);
    });
    return () => { unsub(); void flush(); };
  }, [tenantId, docId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Уходя со страницы, не теряем последние правки.
  useEffect(() => {
    const onHide = () => { void flush(); };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current || inFlightRef.current) { void flush(); e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => { window.removeEventListener('pagehide', onHide); window.removeEventListener('beforeunload', onBeforeUnload); };
  }, [flush]);

  const setBlocks = useCallback((blocks: DocBlock[], history = true) => {
    const d = docRef.current;
    if (!d || !user) return;
    if (history) pushHistory(blocks);
    publish({ ...d, blocks });
    schedule();
  }, [user, schedule]);

  const current = () => docRef.current?.blocks || [];

  const updateBlock = useCallback((blockId: string, content: string) => {
    setBlocks(current().map(b => (b.id === blockId ? { ...b, content } : b)), false);
  }, [setBlocks]);

  const updateBlockStyle = useCallback((blockId: string, styleUpdates: Partial<DocBlock>) => {
    setBlocks(current().map(b => (b.id === blockId ? { ...b, ...styleUpdates } : b)));
  }, [setBlocks]);

  const updateActiveBlockStyle = useCallback((styleUpdates: Partial<DocBlock>) => {
    if (!activeBlockId) return;
    updateBlockStyle(activeBlockId, styleUpdates);
  }, [activeBlockId, updateBlockStyle]);

  const toggleCheck = useCallback((blockId: string) => {
    setBlocks(current().map(b => (b.id === blockId ? { ...b, checked: !b.checked } : b)));
  }, [setBlocks]);

  const addBlockAfter = useCallback((blockId: string, type: DocBlock['type'] = 'paragraph') => {
    const blocks = current();
    const idx = blocks.findIndex(b => b.id === blockId);
    if (idx === -1) return;
    const newBlock: DocBlock = { id: generateShortId(), type, content: '' };
    const next = [...blocks];
    next.splice(idx + 1, 0, newBlock);
    setBlocks(next);
    setActiveBlockId(newBlock.id);
    return newBlock.id;
  }, [setBlocks]);

  const deleteBlock = useCallback((blockId: string) => {
    const blocks = current();
    if (blocks.length <= 1) return;
    const next = blocks.filter(b => b.id !== blockId);
    setBlocks(next);
    if (activeBlockId === blockId && next.length > 0) setActiveBlockId(next[0].id);
  }, [activeBlockId, setBlocks]);

  const changeBlockType = useCallback((blockId: string, type: DocBlock['type']) => {
    setBlocks(current().map(b => (b.id === blockId ? { ...b, type } : b)));
  }, [setBlocks]);

  /** Заменить содержимое целиком (шаблон). Новые id — чтобы не смешаться с прежними блоками. */
  const replaceBlocks = useCallback((blocks: DocBlock[]) => {
    const next = blocks.map(b => ({ ...b, id: generateShortId() }));
    setBlocks(next);
    if (next.length) setActiveBlockId(next[0].id);
  }, [setBlocks]);

  const updateTitle = useCallback((newTitle: string) => {
    const d = docRef.current;
    if (!d || !user || !tenantId) return;
    publish({ ...d, title: newTitle });
    setSaving(true);
    titleInFlight.current++;
    documentService.updateTitle(tenantId, d.id, newTitle, user.uid)
      .then(() => setSaveError(null))
      .catch((e: any) => setSaveError(e?.code === 'permission-denied' ? 'Нет прав на правку' : 'Название не сохранено'))
      .finally(() => {
        titleInFlight.current--;
        if (!titleInFlight.current && !dirtyRef.current && !inFlightRef.current) setSaving(false);
      });
  }, [tenantId, user]);

  const undo = useCallback(() => {
    if (historyIdxRef.current > 0) {
      historyIdxRef.current -= 1;
      setBlocks(clone(historyRef.current[historyIdxRef.current]), false);
    }
  }, [setBlocks]);

  const redo = useCallback(() => {
    if (historyIdxRef.current < historyRef.current.length - 1) {
      historyIdxRef.current += 1;
      setBlocks(clone(historyRef.current[historyIdxRef.current]), false);
    }
  }, [setBlocks]);

  const deleteDoc = useCallback(async () => {
    const d = docRef.current;
    if (!d || !tenantId) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    dirtyRef.current = false;
    await documentService.deleteDocument(tenantId, d.id);
  }, [tenantId]);

  return {
    doc,
    loading,
    saving,
    saveError,
    activeBlockId,
    setActiveBlockId,
    updateTitle,
    updateBlock,
    updateBlockStyle,
    updateActiveBlockStyle,
    toggleCheck,
    addBlockAfter,
    deleteBlock,
    changeBlockType,
    replaceBlocks,
    undo,
    redo,
    deleteDoc
  };
}
