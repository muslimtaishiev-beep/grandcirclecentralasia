import { useState, useEffect, useCallback, useRef } from 'react';
import { documentService } from '../../services/collab/documentService';
import { WorkspaceDocument, DocBlock } from '../../types/collab';
import { useAuth } from '../../contexts/AuthContext';
import { generateShortId } from '../../lib/utils';

export function useDocumentEditor(tenantId: string, docId: string | undefined) {
  const { user } = useAuth();
  const [doc, setDoc] = useState<WorkspaceDocument | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // History stack for Undo / Redo
  const historyRef = useRef<DocBlock[][]>([]);
  const historyIdxRef = useRef<number>(-1);

  const pushHistory = (blocks: DocBlock[]) => {
    const nextHistory = historyRef.current.slice(0, historyIdxRef.current + 1);
    nextHistory.push(JSON.parse(JSON.stringify(blocks)));
    historyRef.current = nextHistory;
    historyIdxRef.current = nextHistory.length - 1;
  };

  useEffect(() => {
    if (!tenantId || !docId) {
      setLoading(false);
      return;
    }
    const unsub = documentService.subscribeToDocument(tenantId, docId, (data) => {
      setDoc(data);
      if (data && historyRef.current.length === 0) {
        pushHistory(data.blocks);
        if (data.blocks.length > 0) setActiveBlockId(data.blocks[0].id);
      }
      setLoading(false);
      setSaving(false);
    });
    return () => unsub();
  }, [tenantId, docId]);

  const updateBlock = useCallback((blockId: string, content: string) => {
    if (!doc || !user) return;
    setSaving(true);
    const newBlocks = doc.blocks.map(b => b.id === blockId ? { ...b, content } : b);
    setDoc({ ...doc, blocks: newBlocks });
    documentService.updateBlocks(tenantId, doc.id, newBlocks, user.uid);
  }, [doc, tenantId, user]);

  const updateBlockStyle = useCallback((blockId: string, styleUpdates: Partial<DocBlock>) => {
    if (!doc || !user) return;
    setSaving(true);
    const newBlocks = doc.blocks.map(b => b.id === blockId ? { ...b, ...styleUpdates } : b);
    pushHistory(newBlocks);
    setDoc({ ...doc, blocks: newBlocks });
    documentService.updateBlocks(tenantId, doc.id, newBlocks, user.uid);
  }, [doc, tenantId, user]);

  const updateActiveBlockStyle = useCallback((styleUpdates: Partial<DocBlock>) => {
    if (!doc || !activeBlockId) return;
    updateBlockStyle(activeBlockId, styleUpdates);
  }, [doc, activeBlockId, updateBlockStyle]);

  const toggleCheck = useCallback((blockId: string) => {
    if (!doc || !user) return;
    setSaving(true);
    const newBlocks = doc.blocks.map(b => b.id === blockId ? { ...b, checked: !b.checked } : b);
    pushHistory(newBlocks);
    setDoc({ ...doc, blocks: newBlocks });
    documentService.updateBlocks(tenantId, doc.id, newBlocks, user.uid);
  }, [doc, tenantId, user]);

  const addBlockAfter = useCallback((blockId: string, type: DocBlock['type'] = 'paragraph') => {
    if (!doc || !user) return;
    const idx = doc.blocks.findIndex(b => b.id === blockId);
    if (idx === -1) return;
    
    const newBlock: DocBlock = { id: generateShortId(), type, content: '' };
    const newBlocks = [...doc.blocks];
    newBlocks.splice(idx + 1, 0, newBlock);
    
    pushHistory(newBlocks);
    setDoc({ ...doc, blocks: newBlocks });
    setActiveBlockId(newBlock.id);
    documentService.updateBlocks(tenantId, doc.id, newBlocks, user.uid);
    return newBlock.id;
  }, [doc, tenantId, user]);

  const deleteBlock = useCallback((blockId: string) => {
    if (!doc || !user) return;
    if (doc.blocks.length <= 1) return;
    
    const newBlocks = doc.blocks.filter(b => b.id !== blockId);
    pushHistory(newBlocks);
    setDoc({ ...doc, blocks: newBlocks });
    if (activeBlockId === blockId && newBlocks.length > 0) {
      setActiveBlockId(newBlocks[0].id);
    }
    documentService.updateBlocks(tenantId, doc.id, newBlocks, user.uid);
  }, [doc, activeBlockId, tenantId, user]);

  const changeBlockType = useCallback((blockId: string, type: DocBlock['type']) => {
    if (!doc || !user) return;
    const newBlocks = doc.blocks.map(b => b.id === blockId ? { ...b, type } : b);
    pushHistory(newBlocks);
    setDoc({ ...doc, blocks: newBlocks });
    documentService.updateBlocks(tenantId, doc.id, newBlocks, user.uid);
  }, [doc, tenantId, user]);

  const updateTitle = useCallback((newTitle: string) => {
    if (!doc || !user || !tenantId) return;
    setSaving(true);
    setDoc({ ...doc, title: newTitle });
    documentService.updateTitle(tenantId, doc.id, newTitle, user.uid);
  }, [doc, tenantId, user]);

  const undo = useCallback(() => {
    if (historyIdxRef.current > 0) {
      historyIdxRef.current -= 1;
      const prevBlocks = historyRef.current[historyIdxRef.current];
      if (doc && prevBlocks && user) {
        setDoc({ ...doc, blocks: prevBlocks });
        documentService.updateBlocks(tenantId, doc.id, prevBlocks, user.uid);
      }
    }
  }, [doc, tenantId, user]);

  const redo = useCallback(() => {
    if (historyIdxRef.current < historyRef.current.length - 1) {
      historyIdxRef.current += 1;
      const nextBlocks = historyRef.current[historyIdxRef.current];
      if (doc && nextBlocks && user) {
        setDoc({ ...doc, blocks: nextBlocks });
        documentService.updateBlocks(tenantId, doc.id, nextBlocks, user.uid);
      }
    }
  }, [doc, tenantId, user]);

  const deleteDoc = useCallback(async () => {
    if (!doc || !tenantId) return;
    await documentService.deleteDocument(tenantId, doc.id);
  }, [doc, tenantId]);

  return {
    doc,
    loading,
    saving,
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
    undo,
    redo,
    deleteDoc
  };
}
