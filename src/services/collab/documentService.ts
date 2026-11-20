import { db } from '../../lib/firebase';
import { collection, doc, query, where, onSnapshot, setDoc, updateDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { mergeBlocks } from './docMerge';
import { WorkspaceDocument, DocBlock, DocAccessLevel, UserDocRole } from '../../types/collab';
import { generateShortId } from '../../lib/utils';

// Helper to remove 'undefined' values which cause Firestore write errors
function sanitizeData(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(sanitizeData);
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      cleaned[key] = val === undefined ? null : sanitizeData(val);
    }
    return cleaned;
  }
  return obj;
}

class DocumentService {
  /**
   * Документы, которые сотрудник вправе видеть.
   *
   * Правила базы отдают документ только по его доступу (accessLevel,
   * permissionsMap), поэтому запрос «всё подряд» разрешён лишь тому, кто
   * видит всё. Остальным — три запроса: общие документы, свои и те, куда
   * его добавили по имени.
   */
  subscribeToList(
    tenantId: string,
    staffId: string,
    isFullAdmin: boolean,
    onUpdate: (docs: WorkspaceDocument[]) => void
  ) {
    const col = collection(db, 'tenants', tenantId, 'workspace_documents');
    const onErr = (err: unknown) => console.warn("Docs list notice:", err);
    const read = (snap: { docs: { id: string; data: () => unknown }[] }) =>
      snap.docs.map(d => ({ ...(d.data() as object), id: d.id } as WorkspaceDocument));

    if (isFullAdmin) {
      return onSnapshot(query(col), snap => onUpdate(read(snap)), onErr);
    }

    const parts: (WorkspaceDocument[] | null)[] = [null, null, null];
    const emit = () => {
      if (parts.some(p => p === null)) return;
      const byId = new Map<string, WorkspaceDocument>();
      for (const d of parts.flat() as WorkspaceDocument[]) byId.set(d.id, d);
      onUpdate([...byId.values()]);
    };
    const listen = (i: number, q: ReturnType<typeof query>) =>
      onSnapshot(q, snap => { parts[i] = read(snap); emit(); }, err => { parts[i] = []; emit(); onErr(err); });

    const unsubs = [
      listen(0, query(col, where('accessLevel', 'in', ['company_view', 'company_edit']))),
      listen(1, query(col, where('authorStaffId', '==', staffId))),
      listen(2, query(col, where('accessLevel', '==', 'specific_users'), where(`permissionsMap.${staffId}`, 'in', ['editor', 'commenter', 'viewer']))),
    ];
    return () => unsubs.forEach(u => u());
  }

  subscribeToDocument(tenantId: string, docId: string, onUpdate: (doc: WorkspaceDocument | null) => void) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_documents', docId);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        onUpdate({ ...snap.data(), id: snap.id } as WorkspaceDocument);
      } else {
        onUpdate(null);
      }
    });
  }

  async createDocument(tenantId: string, authorStaffId: string, authorName: string = 'Сотрудник', title: string = 'Новый документ') {
    const ref = doc(collection(db, 'tenants', tenantId, 'workspace_documents'));
    const initialBlocks: DocBlock[] = [
      { id: generateShortId(), type: 'heading_1', content: title },
      { id: generateShortId(), type: 'paragraph', content: '' }
    ];

    const newDoc: WorkspaceDocument = {
      id: ref.id,
      tenantId,
      title,
      authorStaffId,
      authorName,
      lastEditedByStaffId: authorStaffId,
      blocks: initialBlocks,
      isLocked: false,
      accessLevel: 'private',
      permissionsMap: { [authorStaffId]: 'editor' },
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await setDoc(ref, sanitizeData(newDoc));
    return ref.id;
  }

  async updateBlocks(tenantId: string, docId: string, blocks: DocBlock[], staffId: string) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_documents', docId);
    await updateDoc(ref, sanitizeData({
      blocks,
      lastEditedByStaffId: staffId,
      updatedAt: Date.now()
    }));
  }

  /**
   * Записать свои правки поверх того, что успели сохранить коллеги:
   * в транзакции читаем текущие блоки и сливаем с ними (mergeBlocks).
   * Возвращает итоговые блоки, которые легли в базу.
   */
  async commitBlocks(tenantId: string, docId: string, base: DocBlock[], local: DocBlock[], staffId: string): Promise<DocBlock[]> {
    const ref = doc(db, 'tenants', tenantId, 'workspace_documents', docId);
    return runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw Object.assign(new Error('Документ удалён'), { code: 'not-found' });
      const server = ((snap.data() as WorkspaceDocument).blocks || []) as DocBlock[];
      const merged = mergeBlocks(base, local, server);
      tx.update(ref, sanitizeData({ blocks: merged, lastEditedByStaffId: staffId, updatedAt: Date.now() }));
      return merged;
    });
  }

  async updateTitle(tenantId: string, docId: string, title: string, staffId: string) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_documents', docId);
    await updateDoc(ref, sanitizeData({
      title,
      lastEditedByStaffId: staffId,
      updatedAt: Date.now()
    }));
  }

  async updateAccessControl(
    tenantId: string, 
    docId: string, 
    accessLevel: DocAccessLevel, 
    permissionsMap: Record<string, UserDocRole>,
    staffId: string
  ) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_documents', docId);
    await updateDoc(ref, sanitizeData({
      accessLevel,
      permissionsMap,
      lastEditedByStaffId: staffId,
      updatedAt: Date.now()
    }));
  }

  async deleteDocument(tenantId: string, docId: string) {
    const ref = doc(db, 'tenants', tenantId, 'workspace_documents', docId);
    await deleteDoc(ref);
  }
}

export const documentService = new DocumentService();
