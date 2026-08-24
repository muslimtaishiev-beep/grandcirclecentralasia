import { useState, useEffect, useCallback } from 'react';
import { documentService } from '../../services/collab/documentService';
import { WorkspaceDocument, DocBlock } from '../../types/collab';
import { useAuth } from '../../contexts/AuthContext';
import { generateShortId } from '../../lib/utils';

export function useDocumentEditor(tenantId: string, docId: string | undefined) {
  const { user } = useAuth();
  const [doc, setDoc] = useState<WorkspaceDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenantId || !docId) {
      setLoading(false);
      return;
    }
    const unsub = documentService.subscribeToDocument(tenantId, docId, (data) => {
      setDoc(data);
      setLoading(false);
      setSaving(false);
    });
    return () => unsub();
  }, [tenantId, docId]);

  const updateBlock = useCallback((blockId: string, content: string) => {
    if (!doc || !user) return;
    setSaving(true);
    const newBlocks = doc.blocks.map(b => b.id === blockId ? { ...b, content } : b);
    setDoc({ ...doc, blocks: newBlocks }); // optimistic
    // Note: In a real app we would debounce this service call
    documentService.updateBlocks(tenantId, doc.id, newBlocks, user.uid);
  }, [doc, tenantId, user]);

  const toggleCheck = useCallback((blockId: string) => {
    if (!doc || !user) return;
    setSaving(true);
    const newBlocks = doc.blocks.map(b => b.id === blockId ? { ...b, checked: !b.checked } : b);
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
    
    setDoc({ ...doc, blocks: newBlocks });
    documentService.updateBlocks(tenantId, doc.id, newBlocks, user.uid);
    return newBlock.id;
  }, [doc, tenantId, user]);

  const deleteBlock = useCallback((blockId: string) => {
    if (!doc || !user) return;
    // Don't delete the last block
    if (doc.blocks.length <= 1) return;
    
    const newBlocks = doc.blocks.filter(b => b.id !== blockId);
    setDoc({ ...doc, blocks: newBlocks });
    documentService.updateBlocks(tenantId, doc.id, newBlocks, user.uid);
  }, [doc, tenantId, user]);

  const changeBlockType = useCallback((blockId: string, type: DocBlock['type']) => {
    if (!doc || !user) return;
    const newBlocks = doc.blocks.map(b => b.id === blockId ? { ...b, type } : b);
    setDoc({ ...doc, blocks: newBlocks });
    documentService.updateBlocks(tenantId, doc.id, newBlocks, user.uid);
  }, [doc, tenantId, user]);

  return {
    doc,
    loading,
    saving,
    updateBlock,
    toggleCheck,
    addBlockAfter,
    deleteBlock,
    changeBlockType
  };
}
